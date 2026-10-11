import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Wrench,
  Bot,
  ExternalLink,
  Sparkles,
  Info,
  Clock,
  ShieldCheck,
  Square,
  CornerDownLeft,
} from 'lucide-react';
import { CompilerDiagnostic } from '../engine/types.ts';

export interface ConsoleEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'stdin' | 'status';
  text: string;
  timestamp: number;
}

interface OutputAssistantWindowProps {
  output: string;
  stderr: string;
  consoleEntries: ConsoleEntry[];
  isProcessRunning: boolean;
  processStatus: 'idle' | 'running' | 'completed' | 'error' | 'terminated';
  processExitCode: number | null;
  onSendInput: (input: string) => void;
  onStopProcess: () => void;
  diagnostics: CompilerDiagnostic[];
  executionTimeMs: number;
  executedVia: 'host_jvm' | 'ast_engine';
  onClearOutput: () => void;
  onApplyFix: (fixedCode: string) => void;
  onSelectLine: (line: number) => void;
  code: string;
}

export const OutputAssistantWindow: React.FC<OutputAssistantWindowProps> = ({
  output,
  stderr,
  consoleEntries,
  isProcessRunning,
  processStatus,
  processExitCode,
  onSendInput,
  onStopProcess,
  diagnostics,
  executionTimeMs,
  executedVia,
  onClearOutput,
  onApplyFix,
  onSelectLine,
  code,
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'diagnostics' | 'ai'>('console');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [selectedDiagnosticIdx, setSelectedDiagnosticIdx] = useState<number>(0);
  const [inputValue, setInputValue] = useState('');
  const consoleEndRef = useRef<HTMLDivElement | null>(null);
  const inputFieldRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom of console as new entries or output arrive
  useEffect(() => {
    if (activeTab === 'console' && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleEntries, output, stderr, isProcessRunning, activeTab]);

  // Keep input field auto-focused when running and console is active
  useEffect(() => {
    if (isProcessRunning && activeTab === 'console' && inputFieldRef.current) {
      inputFieldRef.current.focus();
    }
  }, [isProcessRunning, activeTab, consoleEntries.length]);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProcessRunning) return;
    const trimmedVal = inputValue;
    onSendInput(trimmedVal);
    setInputValue('');
  };

  const requestAiTutor = async () => {
    setAiLoading(true);
    setAiExplanation(null);
    try {
      const activeDiag = diagnostics[0];
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          line: activeDiag?.line,
          errorContext: activeDiag ? `${activeDiag.title}: ${activeDiag.rawMessage}` : undefined,
        }),
      });
      const data = await res.json();
      setAiExplanation(data.explanation || 'No explanation generated.');
    } catch {
      setAiExplanation(
        'Unable to reach AI Tutor endpoint. CodeFlow rule-based diagnostics are active in the Diagnostics tab.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const getCategoryBadge = (category: CompilerDiagnostic['category']) => {
    switch (category) {
      case 'SYNTAX_ERROR':
        return {
          label: 'Syntax Error',
          bg: 'bg-rose-950/80 text-rose-300 border-rose-800',
        };
      case 'TYPE_MISMATCH':
        return {
          label: 'Type Mismatch',
          bg: 'bg-amber-950/80 text-amber-300 border-amber-800',
        };
      case 'COMPILATION_ERROR':
        return {
          label: 'Compilation Error',
          bg: 'bg-red-950/80 text-red-300 border-red-800',
        };
      case 'RUNTIME_ERROR':
        return {
          label: 'Runtime Error',
          bg: 'bg-purple-950/80 text-purple-300 border-purple-800',
        };
      case 'LOGICAL_WARNING':
        return {
          label: 'Logical Warning',
          bg: 'bg-yellow-950/80 text-yellow-300 border-yellow-800',
        };
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#090d16] text-slate-200 select-none">
      {/* Header and Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-xs ${
              activeTab === 'console'
                ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console Output</span>
            {isProcessRunning && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-xs ${
              activeTab === 'diagnostics'
                ? 'bg-slate-800 text-rose-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Error Assistant</span>
            {diagnostics.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                {diagnostics.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-xs ${
              activeTab === 'ai'
                ? 'bg-slate-800 text-indigo-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Tutor</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          {activeTab === 'console' && (
            <>
              {executionTimeMs > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {executionTimeMs}ms
                </span>
              )}
              <button
                onClick={onClearOutput}
                title="Clear console output"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Terminal Console Output */}
      {activeTab === 'console' && (
        <div className="flex-1 flex flex-col font-mono text-xs overflow-hidden bg-[#070b12]">
          {/* Terminal meta banner */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-950/60 text-[11px] shrink-0">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Runtime: {executedVia === 'host_jvm' ? 'OpenJDK Runtime Environment' : 'CodeFlow AST Execution Engine'}
              </span>
            </span>

            {/* Dynamic Process Status Display */}
            <div className="flex items-center gap-2">
              {isProcessRunning && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-amber-300 bg-amber-950/60 border border-amber-800/70 px-2 py-0.5 rounded text-[11px] font-sans font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Running</span>
                  </span>
                  <button
                    onClick={onStopProcess}
                    title="Stop running Java process"
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 text-[10px] font-sans transition-colors cursor-pointer"
                  >
                    <Square className="w-2.5 h-2.5 fill-rose-400 text-rose-400" />
                    <span>Stop</span>
                  </button>
                </div>
              )}
              {!isProcessRunning && processStatus === 'completed' && (
                <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded text-[11px] font-sans">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Process exited cleanly (exit code {processExitCode ?? 0})</span>
                </span>
              )}
              {!isProcessRunning && processStatus === 'error' && (
                <span className="flex items-center gap-1 text-rose-400 bg-rose-950/40 border border-rose-800/50 px-2 py-0.5 rounded text-[11px] font-sans">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>Process exited with error (exit code {processExitCode ?? 1})</span>
                </span>
              )}
              {!isProcessRunning && processStatus === 'terminated' && (
                <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-sans">
                  Process stopped by user
                </span>
              )}
              {!isProcessRunning && processStatus === 'idle' && (
                <span className="text-slate-500 text-[11px] font-sans">Ready</span>
              )}
            </div>
          </div>

          {/* Terminal Console Output Scroll Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-1 select-text">
            {consoleEntries.length > 0 ? (
              <div className="font-mono text-xs leading-relaxed">
                {consoleEntries.map((entry) => {
                  if (entry.type === 'stdout') {
                    return (
                      <span
                        key={entry.id}
                        className="text-emerald-400 whitespace-pre-wrap font-mono"
                      >
                        {entry.text}
                      </span>
                    );
                  }
                  if (entry.type === 'stderr') {
                    return (
                      <div
                        key={entry.id}
                        className="text-rose-400 whitespace-pre-wrap font-mono my-0.5"
                      >
                        {entry.text}
                      </div>
                    );
                  }
                  if (entry.type === 'stdin') {
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-1.5 my-1 font-mono text-cyan-300 font-semibold"
                      >
                        <span className="text-cyan-500 font-bold select-none">&gt;</span>
                        <span className="bg-cyan-950/80 border border-cyan-800/70 px-2 py-0.5 rounded text-cyan-200">
                          {entry.text}
                        </span>
                      </div>
                    );
                  }
                  if (entry.type === 'status') {
                    return (
                      <div key={entry.id} className="text-slate-500 italic text-[11px] my-1 font-mono">
                        {entry.text}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ) : isProcessRunning ? (
              <div className="text-slate-400 italic py-4 font-mono text-[11px] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>Process is running... waiting for output or input.</span>
              </div>
            ) : output ? (
              <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed font-mono">
                {output}
              </pre>
            ) : stderr ? (
              <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed font-mono">
                {stderr}
              </pre>
            ) : (
              <div className="text-slate-600 italic py-8 text-center">
                Console is empty. Run a program to view standard output.
              </div>
            )}
            <div ref={consoleEndRef} />
          </div>

          {/* Interactive Console Input Field when process is running */}
          {isProcessRunning ? (
            <form
              onSubmit={handleInputSubmit}
              className="p-2.5 bg-slate-900/95 border-t border-cyan-500/40 flex items-center gap-2 shadow-lg shrink-0"
            >
              <div className="flex items-center gap-2 flex-1 bg-slate-950 rounded px-3 py-1.5 border border-cyan-500/60 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-500/40">
                <span className="text-cyan-400 font-bold font-mono text-xs select-none">&gt;</span>
                <input
                  ref={inputFieldRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter input for Scanner (press Enter to send)..."
                  disabled={!isProcessRunning}
                  className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 font-mono text-xs focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!isProcessRunning}
                className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-sans text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-900/30 transition-colors cursor-pointer"
              >
                <span>Send</span>
                <CornerDownLeft className="w-3.5 h-3.5 text-cyan-200" />
              </button>
            </form>
          ) : (
            /* Non-running footer status bar (truthful and non-misleading) */
            <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between select-none shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">$</span>
                <span className="text-slate-400 font-mono truncate">
                  {processStatus === 'completed'
                    ? 'Java execution completed'
                    : processStatus === 'error'
                    ? 'Java execution failed'
                    : 'Java Console Ready'}
                </span>
              </div>
              {processStatus === 'completed' && (
                <span className="text-emerald-400/80 text-[10px] flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" /> Clean exit
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Error Assistant & Fix Review */}
      {activeTab === 'diagnostics' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {diagnostics.length === 0 ? (
            <div className="p-6 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">No Diagnostics or Errors</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Your Java code compiled cleanly without syntax, type mismatch, or runtime errors!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {diagnostics.map((diag, idx) => {
                const badge = getCategoryBadge(diag.category);
                const isSelected = selectedDiagnosticIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3.5 space-y-3 transition-colors ${
                      isSelected
                        ? 'bg-slate-900/90 border-rose-500/80 shadow-lg shadow-rose-950/20'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          <button
                            onClick={() => onSelectLine(diag.line)}
                            className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                          >
                            <span>Line {diag.line}:{diag.column}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100">{diag.title}</h4>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
                        <Info className="w-3.5 h-3.5" />
                        <span>Beginner-Friendly Explanation:</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        {diag.friendlyExplanation}
                      </p>
                    </div>

                    <div className="text-[11px] font-mono p-2 rounded bg-slate-950/80 border border-slate-800/60 text-slate-400">
                      <span className="text-rose-400 font-semibold">Compiler Output:</span>
                      <pre className="mt-1 whitespace-pre-wrap">{diag.rawMessage}</pre>
                    </div>

                    {diag.fixAvailable && diag.fixedCode && (
                      <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            Suggested Correction
                          </span>
                          <button
                            onClick={() => onApplyFix(diag.fixedCode!)}
                            className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Apply Fix to Editor</span>
                          </button>
                        </div>
                        <div className="text-[11px] font-mono bg-slate-950/80 p-2 rounded border border-emerald-900/60 text-emerald-200">
                          {diag.suggestedCorrection}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Gemini AI Tutor */}
      {activeTab === 'ai' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-indigo-400" />
                CodeFlow Algorithmic Tutor
              </span>
              <button
                onClick={requestAiTutor}
                disabled={aiLoading}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                {aiLoading ? 'Explaining...' : 'Explain Current Code'}
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Provides step-by-step conceptual guidance for BCA coursework, algorithmic breakdowns, and debugging tips tailored for college students.
            </p>
          </div>

          {aiExplanation && (
            <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs leading-relaxed space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Tutor Feedback
              </span>
              <div className="whitespace-pre-wrap text-slate-200 font-sans leading-relaxed">
                {aiExplanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
