import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Code2, Activity, Terminal } from 'lucide-react';
import { Navbar } from './components/Navbar.tsx';
import { CodeEditorWindow } from './components/CodeEditorWindow.tsx';
import { VisualizationWindow } from './components/VisualizationWindow.tsx';
import { OutputAssistantWindow, ConsoleEntry } from './components/OutputAssistantWindow.tsx';
import { CollegeGuideModal } from './components/CollegeGuideModal.tsx';
import { SaveOpenModal } from './components/SaveOpenModal.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { CreateProjectPage } from './components/CreateProjectPage.tsx';
import { SAMPLE_PROGRAMS } from './engine/samples.ts';
import { CompilerDiagnostic, ExecutionStep, SampleProgram, VisualizationCapability } from './engine/types.ts';
import { JavaExecutionEngine } from './engine/javaTracer.ts';

export default function App() {
  // Navigation View State
  const [currentView, setCurrentView] = useState<'landing' | 'create-project' | 'ide'>('landing');

  // State for Code Editor
  const [code, setCode] = useState<string>(SAMPLE_PROGRAMS[0].code);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_PROGRAMS[0].id);

  // State for Execution & Trace
  const [trace, setTrace] = useState<ExecutionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(800); // ms per step
  const [capabilityStatus, setCapabilityStatus] = useState<VisualizationCapability>('fully_supported');

  // State for Interactive Process Execution
  const [_sessionId, setSessionId] = useState<string | null>(null);
  const [isProcessRunning, setIsProcessRunning] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<
    'idle' | 'running' | 'completed' | 'error' | 'terminated'
  >('idle');
  const [processExitCode, setProcessExitCode] = useState<number | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);

  // State for Output & Diagnostics
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [consoleStderr, setConsoleStderr] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<CompilerDiagnostic[]>([]);
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);
  const [executedVia, setExecutedVia] = useState<'host_jvm' | 'ast_engine'>('ast_engine');
  const [unsupportedNote, setUnsupportedNote] = useState<string | undefined>(undefined);

  // Modals state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [saveOpenModalMode, setSaveOpenModalMode] = useState<'save' | 'open' | null>(null);

  // System & Host status
  const [systemStatus, setSystemStatus] = useState({
    javacAvailable: false,
    javacVersion: '',
    geminiConfigured: false,
  });

  // Responsive panel focus on mobile/tablet (desktop shows all 3)
  const [mobileTab, setMobileTab] = useState<'editor' | 'visualizer' | 'output'>('editor');

  const timerRef = useRef<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<any>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const processedSeqRef = useRef<Set<number>>(new Set());
  const clientAccumulatedInputRef = useRef<string>('');

  // Close active session streams and background pollers
  const closeCurrentSessionStreams = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Fetch host JVM status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setSystemStatus({
          javacAvailable: Boolean(data.javacAvailable),
          javacVersion: data.javacVersion || '',
          geminiConfigured: Boolean(data.geminiConfigured),
        });
      })
      .catch(() => {
        setSystemStatus({
          javacAvailable: false,
          javacVersion: 'AST Tracer Engine',
          geminiConfigured: false,
        });
      });
  }, []);

  // Static diagnostic analyzer whenever code changes
  useEffect(() => {
    const diags = JavaExecutionEngine.analyzeCode(code);
    setDiagnostics(diags);
  }, [code]);

  // Clean up session streams on unmount
  useEffect(() => {
    return () => {
      closeCurrentSessionStreams();
    };
  }, [closeCurrentSessionStreams]);

  // Stop running JVM process
  const handleStopProcess = useCallback(async () => {
    const currentId = activeSessionIdRef.current;
    if (currentId) {
      try {
        await fetch(`/api/execute/interactive/stop/${currentId}`, { method: 'POST' });
      } catch {
        // ignore
      }
    }
    closeCurrentSessionStreams();
    setIsProcessRunning(false);
    setProcessStatus('terminated');
    setConsoleEntries((prev) => [
      ...prev,
      {
        id: 'term-' + Date.now(),
        type: 'status',
        text: '--- Process terminated by user ---',
        timestamp: Date.now(),
      },
    ]);
  }, [closeCurrentSessionStreams]);

  // Send interactive user input to running process
  const handleSendInput = useCallback(async (input: string) => {
    const currentId = activeSessionIdRef.current;
    if (!currentId) {
      // Client-side AST execution fallback (e.g. deployed on Vercel without host JVM)
      const inputLine = typeof input === 'string' ? input : '';
      clientAccumulatedInputRef.current = (clientAccumulatedInputRef.current ? clientAccumulatedInputRef.current + '\n' : '') + inputLine;
      setConsoleEntries((prev) => [
        ...prev,
        {
          id: `in-client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'stdin',
          text: inputLine,
          timestamp: Date.now(),
        },
      ]);
      try {
        const astResult = JavaExecutionEngine.executeAndTrace(code, clientAccumulatedInputRef.current);
        if (astResult.trace && astResult.trace.length > 0) {
          setTrace(astResult.trace);
          setCurrentStepIndex(0);
        }
        if (astResult.stdout) {
          setConsoleOutput(astResult.stdout);
        }
        if (astResult.stderr) {
          setConsoleStderr(astResult.stderr);
        }
        setDiagnostics(astResult.diagnostics || []);
        setCapabilityStatus(astResult.capabilityStatus || 'fully_supported');
        setUnsupportedNote(astResult.unsupportedConstructNote);
        const isWaiting = astResult.capabilityStatus === 'waiting_for_input';
        setIsProcessRunning(isWaiting);
        setProcessStatus(isWaiting ? 'running' : astResult.success ? 'completed' : 'error');
        setProcessExitCode(isWaiting ? null : astResult.success ? 0 : 1);
        if (!isWaiting && astResult.success) {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.8 },
          });
        }
      } catch (err: any) {
        setConsoleStderr((prev) => prev + (err?.message || String(err)));
        setIsProcessRunning(false);
        setProcessStatus('error');
        setProcessExitCode(1);
      }
      return;
    }
    try {
      const res = await fetch(`/api/execute/interactive/input/${currentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      if (res.ok) {
        const data = await res.json();
        // If event is returned in response, dispatch it immediately to guarantee responsive display
        if (data.event && typeof data.event.seq === 'number') {
          if (!processedSeqRef.current.has(data.event.seq)) {
            processedSeqRef.current.add(data.event.seq);
            setConsoleEntries((prev) => [
              ...prev,
              {
                id: `in-${data.event.seq}-${Date.now()}`,
                type: 'stdin',
                text: data.event.data || input,
                timestamp: data.event.timestamp || Date.now(),
              },
            ]);
          }
        }
        if (data.trace && data.trace.length > 0) {
          setTrace(data.trace);
          setCurrentStepIndex(0);
        }
      }
    } catch (err) {
      console.error('Error submitting input to JVM process:', err);
    }
  }, []);

  // Handle Run
  const handleRun = useCallback(async () => {
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);

    // If an existing session is running, terminate it first
    if (activeSessionIdRef.current && isProcessRunning) {
      try {
        fetch(`/api/execute/interactive/stop/${activeSessionIdRef.current}`, { method: 'POST' });
      } catch {
        // ignore
      }
    }
    closeCurrentSessionStreams();

    // Prepare fresh console run state
    setConsoleOutput('');
    setConsoleStderr('');
    setConsoleEntries([]);
    setIsProcessRunning(true);
    setProcessStatus('running');
    setProcessExitCode(null);
    processedSeqRef.current = new Set<number>();

    const startTime = performance.now();
    try {
      // Start interactive process via backend API
      const res = await fetch('/api/execute/interactive/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      const duration = Math.round(performance.now() - startTime);
      setExecutionTimeMs(duration);

      // Handle compilation errors
      if (!data.success && data.status === 'compilation_error') {
        setIsProcessRunning(false);
        setProcessStatus('error');
        setProcessExitCode(1);
        setConsoleStderr(data.stderr || 'Compilation error');
        setDiagnostics(data.diagnostics || []);
        setExecutedVia('host_jvm');
        if (data.trace) setTrace(data.trace);
        setMobileTab('output');
        return;
      }

      if (data.trace) {
        setTrace(data.trace);
        setCurrentStepIndex(0);
      }
      setDiagnostics(data.diagnostics || []);
      setExecutedVia(data.executedVia || 'host_jvm');
      setUnsupportedNote(data.unsupportedConstructNote);
      setCapabilityStatus(data.capabilityStatus || 'fully_supported');

      if (data.sessionId) {
        const sid = data.sessionId;
        activeSessionIdRef.current = sid;
        setSessionId(sid);

        const dispatchEvent = (ev: {
          seq?: number;
          type: string;
          data?: string;
          exitCode?: number;
          timestamp?: number;
        }) => {
          if (typeof ev.seq === 'number') {
            if (processedSeqRef.current.has(ev.seq)) {
              return; // Deduplicate already processed event
            }
            processedSeqRef.current.add(ev.seq);
          }

          if (ev.type === 'stdout' && ev.data) {
            setConsoleEntries((prev) => [
              ...prev,
              {
                id: 'out-' + (ev.seq || Date.now()) + '-' + Math.random().toString(36).slice(2, 6),
                type: 'stdout',
                text: ev.data!,
                timestamp: ev.timestamp || Date.now(),
              },
            ]);
            setConsoleOutput((prev) => prev + ev.data!);
          } else if (ev.type === 'stderr' && ev.data) {
            setConsoleEntries((prev) => [
              ...prev,
              {
                id: 'err-' + (ev.seq || Date.now()) + '-' + Math.random().toString(36).slice(2, 6),
                type: 'stderr',
                text: ev.data!,
                timestamp: ev.timestamp || Date.now(),
              },
            ]);
            setConsoleStderr((prev) => prev + ev.data!);
          } else if (ev.type === 'stdin' && ev.data !== undefined) {
            setConsoleEntries((prev) => [
              ...prev,
              {
                id: 'in-' + (ev.seq || Date.now()) + '-' + Math.random().toString(36).slice(2, 6),
                type: 'stdin',
                text: ev.data!,
                timestamp: ev.timestamp || Date.now(),
              },
            ]);
          } else if (ev.type === 'status' && ev.data) {
            setConsoleEntries((prev) => [
              ...prev,
              {
                id: 'status-' + (ev.seq || Date.now()),
                type: 'status',
                text: ev.data!,
                timestamp: ev.timestamp || Date.now(),
              },
            ]);
          } else if (ev.type === 'trace' && ev.data) {
            try {
              const updatedTrace = JSON.parse(ev.data);
              if (Array.isArray(updatedTrace) && updatedTrace.length > 0) {
                setTrace(updatedTrace);
                setCurrentStepIndex(0);
              }
            } catch {}
          } else if (ev.type === 'exit') {
            closeCurrentSessionStreams();
            setIsProcessRunning(false);
            const codeVal = ev.exitCode ?? 0;
            setProcessExitCode(codeVal);
            setProcessStatus(codeVal === 0 ? 'completed' : 'error');
            if (codeVal === 0 && (!data.diagnostics || data.diagnostics.length === 0)) {
              confetti({
                particleCount: 40,
                spread: 60,
                origin: { y: 0.8 },
              });
              if (!code.includes('Scanner')) {
                setIsPlaying(true);
              }
            }
          }
        };

        // 1. Primary: Server-Sent Events (SSE) Stream
        const sse = new EventSource(`/api/execute/interactive/stream/${sid}`);
        eventSourceRef.current = sse;
        sse.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'replay' && parsed.events) {
              for (const rev of parsed.events) {
                dispatchEvent(rev);
              }
              if (parsed.status !== 'running') {
                closeCurrentSessionStreams();
                setIsProcessRunning(false);
                setProcessStatus(parsed.status);
                setProcessExitCode(parsed.exitCode ?? 0);
              }
            } else {
              dispatchEvent(parsed);
            }
          } catch {
            // ignore
          }
        };

        // 2. Reliable secondary fallback: Polling interval
        let pollSeq = 0;
        pollTimerRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch(
              `/api/execute/interactive/poll/${sid}?after=${pollSeq}`
            );
            if (pollRes.ok) {
              const pData = await pollRes.json();
              if (pData.events && pData.events.length > 0) {
                for (const ev of pData.events) {
                  pollSeq = Math.max(pollSeq, ev.seq || 0);
                  dispatchEvent(ev);
                }
              }
              if (pData.status !== 'running') {
                closeCurrentSessionStreams();
                setIsProcessRunning(false);
                setProcessStatus(pData.status);
                setProcessExitCode(pData.exitCode ?? 0);
              }
            }
          } catch {
            // ignore
          }
        }, 250);
      } else {
        // Direct AST engine completion (non-JVM mode)
        const isWaiting = data.capabilityStatus === 'waiting_for_input';
        setIsProcessRunning(isWaiting);
        setProcessStatus(isWaiting ? 'running' : data.success ? 'completed' : 'error');
        setProcessExitCode(isWaiting ? null : data.success ? 0 : 1);
        setConsoleOutput(data.stdout || '');
        setConsoleStderr(data.stderr || '');
        if (data.success && !code.includes('Scanner')) {
          setIsPlaying(true);
        }
      }
    } catch {
      // Local AST engine fallback
      clientAccumulatedInputRef.current = '';
      const result = JavaExecutionEngine.executeAndTrace(code);
      setTrace(result.trace);
      setCurrentStepIndex(0);
      setConsoleOutput(result.stdout || '');
      setConsoleStderr(result.stderr || '');
      setDiagnostics(result.diagnostics || []);
      setExecutionTimeMs(Math.round(performance.now() - startTime));
      setExecutedVia('ast_engine');
      setUnsupportedNote(result.unsupportedConstructNote);
      setCapabilityStatus(result.capabilityStatus || 'fully_supported');
      const isWaiting = result.capabilityStatus === 'waiting_for_input';
      setIsProcessRunning(isWaiting);
      setProcessStatus(isWaiting ? 'running' : result.success ? 'completed' : 'error');
      setProcessExitCode(isWaiting ? null : result.success ? 0 : 1);
      if (result.success && !code.includes('Scanner')) {
        setIsPlaying(true);
      }
    }
  }, [code, isProcessRunning, closeCurrentSessionStreams]);

  // Keyboard shortcut: F5 or Ctrl+Enter to Run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun]);

  // Auto-play stepper timer
  useEffect(() => {
    if (isPlaying && trace.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= trace.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, trace.length, playSpeed]);

  const handlePauseResume = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    if (currentStepIndex < trace.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleStepBackward = () => {
    setIsPlaying(false);
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
  };

  const handleClear = () => {
    handleStopProcess();
    setIsPlaying(false);
    setCode(`public class Main {
    public static void main(String[] args) {
        
    }
}`);
    setTrace([]);
    setCurrentStepIndex(0);
    setConsoleOutput('');
    setConsoleStderr('');
    setConsoleEntries([]);
    setDiagnostics([]);
    setUnsupportedNote(undefined);
    setProcessStatus('idle');
    setProcessExitCode(null);
  };

  const handleSelectSample = (sample: SampleProgram) => {
    handleStopProcess();
    setIsPlaying(false);
    setSelectedSampleId(sample.id);
    setCode(sample.code);
    setTrace([]);
    setCurrentStepIndex(0);
    setConsoleOutput('');
    setConsoleStderr('');
    setConsoleEntries([]);
    setUnsupportedNote(undefined);
    setProcessStatus('idle');
    setProcessExitCode(null);
    setMobileTab('editor');
  };

  const handleApplyFix = (fixedCode: string) => {
    setCode(fixedCode);
    const diags = JavaExecutionEngine.analyzeCode(fixedCode);
    setDiagnostics(diags);
  };

  const handleSelectLine = (line: number) => {
    const stepIdx = trace.findIndex((s) => s.line === line);
    if (stepIdx !== -1) {
      setCurrentStepIndex(stepIdx);
    }
    setMobileTab('editor');
  };

  const currentStep = trace[currentStepIndex] || null;
  const activeLine = currentStep ? currentStep.line : null;

  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          onLaunchIde={() => setCurrentView('ide')}
          onCreateProject={() => setCurrentView('create-project')}
          onSelectSample={(sample) => {
            handleSelectSample(sample);
            setCurrentView('ide');
          }}
          onOpenGuide={() => setIsGuideOpen(true)}
          systemStatus={systemStatus}
        />
        <CollegeGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      </>
    );
  }

  if (currentView === 'create-project') {
    return (
      <>
        <CreateProjectPage
          onCreateProject={(newCode, sampleId) => {
            setCode(newCode);
            if (sampleId) {
              setSelectedSampleId(sampleId);
            } else {
              setSelectedSampleId('custom-project');
            }
            setTrace([]);
            setCurrentStepIndex(0);
            setConsoleOutput('');
            setConsoleStderr('');
            setConsoleEntries([]);
            setCurrentView('ide');
          }}
          onCancel={() => setCurrentView('landing')}
          onOpenExisting={() => {
            setCurrentView('ide');
            setSaveOpenModalMode('open');
          }}
        />
        <CollegeGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-[#050505] text-[#F5F5F5] font-sans">
      {/* Top Navigation & Toolbar */}
      <Navbar
        onRun={handleRun}
        onPauseResume={handlePauseResume}
        onStepForward={handleStepForward}
        onStepBackward={handleStepBackward}
        onReset={handleReset}
        onClear={handleClear}
        isPlaying={isPlaying}
        canStepForward={trace.length > 0 && currentStepIndex < trace.length - 1}
        canStepBackward={trace.length > 0 && currentStepIndex > 0}
        hasTrace={trace.length > 0}
        currentStepIndex={currentStepIndex}
        totalSteps={trace.length}
        speed={playSpeed}
        onSpeedChange={setPlaySpeed}
        selectedSampleId={selectedSampleId}
        onSelectSample={handleSelectSample}
        onOpenSaveModal={() => setSaveOpenModalMode('save')}
        onOpenLoadModal={() => setSaveOpenModalMode('open')}
        onOpenGuideModal={() => setIsGuideOpen(true)}
        systemStatus={systemStatus}
        isProcessRunning={isProcessRunning}
        onStopProcess={handleStopProcess}
        onGoHome={() => setCurrentView('landing')}
        onCreateProject={() => setCurrentView('create-project')}
      />

      {/* Mobile/Tablet Adaptive View Switcher Bar */}
      <div className="lg:hidden flex items-center justify-around bg-[#101010] border-b border-[#292929] text-xs py-1.5 px-2 select-none shrink-0 gap-1.5">
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex-1 min-h-[38px] py-1 px-2 rounded-md flex items-center justify-center gap-1.5 text-center font-medium transition-colors cursor-pointer ${
            mobileTab === 'editor'
              ? 'bg-[#1c1c1c] text-cyan-400 border border-[#333333] shadow-sm'
              : 'text-[#A0A0A0] hover:text-[#F5F5F5] hover:bg-[#151515]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">1. Code </span>
          <span>Editor</span>
        </button>
        <button
          onClick={() => setMobileTab('visualizer')}
          className={`flex-1 min-h-[38px] py-1 px-2 rounded-md flex items-center justify-center gap-1.5 text-center font-medium transition-colors cursor-pointer ${
            mobileTab === 'visualizer'
              ? 'bg-[#1c1c1c] text-cyan-400 border border-[#333333] shadow-sm'
              : 'text-[#A0A0A0] hover:text-[#F5F5F5] hover:bg-[#151515]'
          }`}
        >
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">2. Memory &amp; </span>
          <span>Canvas</span>
        </button>
        <button
          onClick={() => setMobileTab('output')}
          className={`flex-1 min-h-[38px] py-1 px-2 rounded-md flex items-center justify-center gap-1.5 text-center font-medium transition-colors cursor-pointer ${
            mobileTab === 'output'
              ? 'bg-[#1c1c1c] text-cyan-400 border border-[#333333] shadow-sm'
              : 'text-[#A0A0A0] hover:text-[#F5F5F5] hover:bg-[#151515]'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">3. Output &amp; </span>
          <span>AI</span>
          {diagnostics.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
              {diagnostics.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Three-Panel Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Window 1: Code Editor Window (35% width on desktop) */}
        <section
          aria-label="Code Editor Window"
          className={`h-full flex-1 lg:w-[35%] lg:flex-none ${
            mobileTab === 'editor' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <CodeEditorWindow
            code={code}
            onChange={setCode}
            activeLine={activeLine}
            diagnostics={diagnostics}
            readOnly={false}
          />
        </section>

        {/* Window 2: Visual Execution Canvas (37% width on desktop) */}
        <section
          aria-label="Visualization Canvas Window"
          className={`h-full flex-1 lg:w-[37%] lg:flex-none ${
            mobileTab === 'visualizer' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <VisualizationWindow
            currentStep={currentStep}
            currentStepIndex={currentStepIndex}
            totalSteps={trace.length}
            onStepIndexChange={setCurrentStepIndex}
            onStepForward={handleStepForward}
            onStepBackward={handleStepBackward}
            onReset={handleReset}
            onPauseResume={handlePauseResume}
            isPlaying={isPlaying}
            canStepForward={trace.length > 0 && currentStepIndex < trace.length - 1}
            canStepBackward={trace.length > 0 && currentStepIndex > 0}
            unsupportedConstructNote={unsupportedNote}
            capabilityStatus={capabilityStatus}
          />
        </section>

        {/* Window 3: Output and Error Assistant (28% width on desktop) */}
        <section
          aria-label="Output and Error Assistant Window"
          className={`h-full flex-1 lg:w-[28%] lg:flex-none ${
            mobileTab === 'output' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <OutputAssistantWindow
            output={consoleOutput}
            stderr={consoleStderr}
            consoleEntries={consoleEntries}
            isProcessRunning={isProcessRunning}
            processStatus={processStatus}
            processExitCode={processExitCode}
            onSendInput={handleSendInput}
            onStopProcess={handleStopProcess}
            diagnostics={diagnostics}
            executionTimeMs={executionTimeMs}
            executedVia={executedVia}
            onClearOutput={() => {
              setConsoleOutput('');
              setConsoleStderr('');
              setConsoleEntries([]);
            }}
            onApplyFix={handleApplyFix}
            onSelectLine={handleSelectLine}
            code={code}
          />
        </section>
      </main>

      {/* Modals */}
      <CollegeGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <SaveOpenModal
        isOpen={saveOpenModalMode !== null}
        mode={saveOpenModalMode || 'save'}
        onClose={() => setSaveOpenModalMode(null)}
        currentCode={code}
        onLoadCode={(loadedCode, loadedName) => {
          setCode(loadedCode);
          setSelectedSampleId('custom-' + loadedName);
          setTrace([]);
          setCurrentStepIndex(0);
        }}
      />
    </div>
  );
}
