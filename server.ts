import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { JavaExecutionEngine } from './src/engine/javaTracer.ts';
import { CompilerDiagnostic } from './src/engine/types.ts';

dotenv.config();

const execAsync = promisify(exec);
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

// Initialize Gemini AI SDK server-side
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Helper to check if javac and java are installed and operational
async function getJavacInfo(): Promise<{ available: boolean; version: string }> {
  try {
    const { stdout: javacOut, stderr: javacErr } = await execAsync('javac -version');
    const { stdout: javaOut, stderr: javaErr } = await execAsync('java -version');
    const ver = (javacOut || javacErr || javaOut || javaErr || '').trim();
    return { available: true, version: ver };
  } catch {
    return { available: false, version: 'Not detected in PATH' };
  }
}

// Parse javac compiler errors into rich CompilerDiagnostics
function parseJavacErrors(stderr: string, code: string): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const lines = stderr.split('\n');
  const codeLines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(?:Main\.java|.+?):(\d+):\s*(error|warning):\s*(.*)/i);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      const isError = match[2].toLowerCase() === 'error';
      const rawTitle = match[3].trim();
      let column = 1;
      let rawMsg = line;
      if (i + 1 < lines.length) {
        rawMsg += '\n' + lines[i + 1];
      }
      if (i + 2 < lines.length) {
        rawMsg += '\n' + lines[i + 2];
        const caretIdx = lines[i + 2].indexOf('^');
        if (caretIdx >= 0) {
          column = caretIdx + 1;
        }
      }
      const snippet = codeLines[lineNum - 1] || '';
      diagnostics.push({
        category: isError ? 'COMPILATION_ERROR' : 'LOGICAL_WARNING',
        title: rawTitle,
        line: lineNum,
        column,
        rawMessage: rawMsg,
        friendlyExplanation: `Java compiler error: "${rawTitle}" on line ${lineNum}. Ensure syntax, variable types, and method calls follow Java specifications.`,
        suggestedCorrection: `Check line ${lineNum}: ${snippet.trim()}`,
        codeSnippet: snippet.trim(),
        fixAvailable: false,
      });
    }
  }
  return diagnostics;
}

// Active session storage for streaming interactive Java executions
export interface SessionEvent {
  seq: number;
  timestamp: number;
  type: 'stdout' | 'stderr' | 'stdin' | 'status' | 'exit' | 'trace';
  data?: string;
  exitCode?: number;
}

interface ExecutionSession {
  id: string;
  child?: ChildProcess;
  isAst?: boolean;
  code?: string;
  accumulatedInput?: string;
  trace?: any[];
  tmpDir: string;
  stdout: string;
  stderr: string;
  status: 'running' | 'completed' | 'error' | 'terminated';
  exitCode: number | null;
  createdAt: number;
  lastActivity: number;
  currentSeq: number;
  events: SessionEvent[];
  sseClients: Response[];
  timeoutTimer: NodeJS.Timeout | null;
}

const activeSessions = new Map<string, ExecutionSession>();

// Centralized event dispatcher guaranteeing unique, monotonically increasing sequence numbers
function emitSessionEvent(
  session: ExecutionSession,
  event: {
    type: 'stdout' | 'stderr' | 'stdin' | 'status' | 'exit' | 'trace';
    data?: string;
    exitCode?: number;
  }
): SessionEvent {
  const full: SessionEvent = {
    seq: ++session.currentSeq,
    timestamp: Date.now(),
    ...event,
  };
  session.events.push(full);
  session.lastActivity = Date.now();

  const payload = `data: ${JSON.stringify(full)}\n\n`;
  for (const clientRes of session.sseClients) {
    try {
      clientRes.write(payload);
    } catch {}
  }
  return full;
}

// 1. System status API
app.get('/api/status', async (_req: Request, res: Response) => {
  const javacInfo = await getJavacInfo();
  res.json({
    appTitle: 'CodeFlow (Fast Learning on Windows)',
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    javacAvailable: javacInfo.available,
    javacVersion: javacInfo.version,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    supportedLanguages: [
      { id: 'java', name: 'Java', version: javacInfo.version || 'SE 17/21', active: true },
      { id: 'python', name: 'Python', version: 'Coming Soon', active: false },
      { id: 'cpp', name: 'C++', version: 'Coming Soon', active: false },
    ],
  });
});

// 2. Interactive Execution: START
app.post('/api/execute/interactive/start', async (req: Request, res: Response) => {
  const { code } = req.body;
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Source code is required' });
  }

  const javacInfo = await getJavacInfo();

  // If javac is not available on host system, fall back cleanly to AST simulation
  if (!javacInfo.available) {
    if (code.includes('Scanner')) {
      const sessionId = 'cf_ast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const session: ExecutionSession = {
        id: sessionId,
        isAst: true,
        code,
        accumulatedInput: '',
        tmpDir: '',
        stdout: '',
        stderr: '',
        status: 'running',
        exitCode: null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        currentSeq: 0,
        events: [],
        sseClients: [],
        timeoutTimer: null,
      };
      activeSessions.set(sessionId, session);
      emitSessionEvent(session, {
        type: 'status',
        data: 'Interactive Scanner active: Enter input below and click Send (e.g. "5" then "64 25 12 22 11"):',
      });
      return res.json({
        success: true,
        sessionId,
        status: 'running',
        executedVia: 'ast_engine',
        trace: [],
        diagnostics: [],
        capabilityStatus: 'waiting_for_input',
        unsupportedConstructNote: 'Interactive Scanner mode: Console input is processed live in the AST Engine.',
      });
    }

    const astResult = JavaExecutionEngine.executeAndTrace(code);
    return res.json({
      success: astResult.success,
      sessionId: null,
      status: astResult.success ? 'completed' : 'error',
      stdout: astResult.stdout,
      stderr: astResult.stderr,
      executedVia: 'ast_engine',
      trace: astResult.trace,
      diagnostics: astResult.diagnostics,
      unsupportedConstructNote: astResult.unsupportedConstructNote,
    });
  }

  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow_'));
    const javaFile = path.join(tmpDir, 'Main.java');
    fs.writeFileSync(javaFile, code, 'utf-8');

    // Compile with javac
    try {
      await execAsync(`javac "${javaFile}"`, { timeout: 10000 });
    } catch (compileErr: any) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      const rawStderr = compileErr.stderr || compileErr.stdout || compileErr.message || '';
      const diagnostics = parseJavacErrors(rawStderr, code);
      return res.json({
        success: false,
        sessionId: null,
        status: 'compilation_error',
        stdout: '',
        stderr: rawStderr,
        diagnostics: diagnostics.length > 0 ? diagnostics : JavaExecutionEngine.analyzeCode(code),
        executedVia: 'host_jvm',
        trace: [],
      });
    }

    // Pre-generate structural AST trace for step-by-step visualizer (without blocking or polluting console)
    let astTrace: any[] = [];
    let unsupportedNote: string | undefined = undefined;
    let capabilityStatus: string | undefined = undefined;
    try {
      const astResult = JavaExecutionEngine.executeAndTrace(code);
      astTrace = astResult.trace;
      unsupportedNote = astResult.unsupportedConstructNote;
      capabilityStatus = astResult.capabilityStatus;
    } catch {
      // AST tracing failure should not prevent real JVM execution
    }

    // Spawn real interactive JVM process with standard pipes
    const sessionId = 'cf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const child = spawn('java', ['-cp', tmpDir, 'Main'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const session: ExecutionSession = {
      id: sessionId,
      child,
      code,
      accumulatedInput: '',
      tmpDir,
      stdout: '',
      stderr: '',
      status: 'running',
      exitCode: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      currentSeq: 0,
      events: [],
      sseClients: [],
      timeoutTimer: null,
    };

    // Auto-terminate runaway processes after 3 minutes
    session.timeoutTimer = setTimeout(() => {
      if (session.status === 'running') {
        session.status = 'terminated';
        session.exitCode = 124;
        try {
          child.kill('SIGKILL');
        } catch {}
        emitSessionEvent(session, {
          type: 'status',
          data: '--- Process timed out after 3 minutes of inactivity ---',
        });
        emitSessionEvent(session, { type: 'exit', exitCode: 124 });
      }
    }, 180000);

    // Stream genuine JVM stdout
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      session.stdout += text;
      emitSessionEvent(session, { type: 'stdout', data: text });
    });

    // Stream genuine JVM stderr
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      session.stderr += text;
      emitSessionEvent(session, { type: 'stderr', data: text });
    });

    // Process termination listener
    child.on('close', (code, signal) => {
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
        session.timeoutTimer = null;
      }
      const exitVal = code ?? (signal ? 137 : 0);
      session.status = exitVal === 0 ? 'completed' : 'error';
      session.exitCode = exitVal;

      // If user provided inputs, regenerate detailed AST trace for memory visualizer
      if (session.code && session.accumulatedInput) {
        try {
          const astResult = JavaExecutionEngine.executeAndTrace(session.code, session.accumulatedInput);
          if (astResult.trace && astResult.trace.length > 0) {
            session.trace = astResult.trace;
            emitSessionEvent(session, {
              type: 'trace',
              data: JSON.stringify(astResult.trace),
            });
          }
        } catch {}
      }

      emitSessionEvent(session, { type: 'exit', exitCode: exitVal });

      for (const clientRes of session.sseClients) {
        try {
          clientRes.end();
        } catch {}
      }
      session.sseClients = [];

      // Clean up temporary compilation directory after 60 seconds
      setTimeout(() => {
        try {
          if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          }
        } catch {}
        activeSessions.delete(sessionId);
      }, 60000);
    });

    child.on('error', (err) => {
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
        session.timeoutTimer = null;
      }
      session.status = 'error';
      session.exitCode = 1;
      emitSessionEvent(session, {
        type: 'stderr',
        data: `JVM Process execution error: ${err.message}\n`,
      });
      emitSessionEvent(session, { type: 'exit', exitCode: 1 });
    });

    activeSessions.set(sessionId, session);

    return res.json({
      success: true,
      sessionId,
      status: 'running',
      executedVia: 'host_jvm',
      jvmVersion: javacInfo.version,
      trace: astTrace,
      diagnostics: [],
      unsupportedConstructNote: unsupportedNote,
      capabilityStatus,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to launch Java process', details: err.message });
  }
});

// 3. Interactive Execution: SSE STREAM
app.get('/api/execute/interactive/stream/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or already closed' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  // Send initial replay packet with all events accumulated so far
  res.write(
    `data: ${JSON.stringify({
      type: 'replay',
      events: session.events,
      status: session.status,
      exitCode: session.exitCode,
    })}\n\n`
  );

  if (session.status !== 'running') {
    res.end();
    return;
  }

  session.sseClients.push(res);

  req.on('close', () => {
    session.sseClients = session.sseClients.filter((c) => c !== res);
  });
});

// 4. Interactive Execution: POLL (reliable fallback)
app.get('/api/execute/interactive/poll/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const afterSeq = parseInt(req.query.after as string, 10) || 0;
  const newEvents = session.events.filter((e) => e.seq > afterSeq);

  res.json({
    status: session.status,
    exitCode: session.exitCode,
    events: newEvents,
    stdout: session.stdout,
    stderr: session.stderr,
  });
});

// 5. Interactive Execution: INPUT
app.post('/api/execute/interactive/input/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { input } = req.body;
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== 'running') {
    return res.status(400).json({ error: 'Process is not active or waiting for input' });
  }

  const inputLine = typeof input === 'string' ? input : '';

  // 1. Emit monotonic stdin event to preserve ordered log of user input
  const event = emitSessionEvent(session, {
    type: 'stdin',
    data: inputLine,
  });

  if (session.isAst && session.code) {
    session.accumulatedInput = (session.accumulatedInput ? session.accumulatedInput + '\n' : '') + inputLine;
    try {
      const astResult = JavaExecutionEngine.executeAndTrace(session.code, session.accumulatedInput);
      session.trace = astResult.trace;

      if (astResult.stdout) {
        // Find new stdout delta
        const newStdout = astResult.stdout.slice(session.stdout.length);
        if (newStdout) {
          emitSessionEvent(session, { type: 'stdout', data: newStdout });
          session.stdout = astResult.stdout;
        }
      }

      if (astResult.capabilityStatus !== 'waiting_for_input' || astResult.stdout.length > 0) {
        session.status = astResult.success ? 'completed' : 'error';
        session.exitCode = astResult.success ? 0 : 1;
        emitSessionEvent(session, { type: 'exit', exitCode: session.exitCode });
        for (const clientRes of session.sseClients) {
          try {
            clientRes.end();
          } catch {}
        }
        session.sseClients = [];
      } else {
        emitSessionEvent(session, {
          type: 'status',
          data: 'Waiting for next input token...',
        });
      }

      return res.json({
        success: true,
        event,
        trace: astResult.trace,
        stdout: session.stdout,
        status: session.status,
      });
    } catch (err: any) {
      emitSessionEvent(session, { type: 'stderr', data: err.message });
      session.status = 'error';
      session.exitCode = 1;
      emitSessionEvent(session, { type: 'exit', exitCode: 1 });
      return res.json({ success: false, event, error: err.message });
    }
  }

  if (!session.child || !session.child.stdin || !session.child.stdin.writable) {
    return res.status(400).json({ error: 'Process stdin is not writable' });
  }

  try {
    // Append to accumulated inputs so trace can be updated
    session.accumulatedInput = (session.accumulatedInput ? session.accumulatedInput + '\n' : '') + inputLine;

    // Write input line followed by newline directly to JVM stdin pipe
    session.child.stdin.write(inputLine + '\n');

    // Optionally generate live trace snapshot if code has Scanner
    let currentTrace: any[] | undefined = undefined;
    if (session.code) {
      try {
        const astResult = JavaExecutionEngine.executeAndTrace(session.code, session.accumulatedInput);
        if (astResult.trace && astResult.trace.length > 0) {
          session.trace = astResult.trace;
          currentTrace = astResult.trace;
        }
      } catch {}
    }

    return res.json({ success: true, event, trace: currentTrace });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to write input to JVM stdin', details: err.message });
  }
});

// 6. Interactive Execution: STOP
app.post('/api/execute/interactive/stop/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  if (session && session.status === 'running') {
    session.status = 'terminated';
    session.exitCode = 130;
    if (session.child) {
      try {
        session.child.kill('SIGTERM');
      } catch {}
      setTimeout(() => {
        try {
          session.child?.kill('SIGKILL');
        } catch {}
      }, 400);
    }
    emitSessionEvent(session, {
      type: 'status',
      data: '--- Process terminated by user ---',
    });
    emitSessionEvent(session, { type: 'exit', exitCode: 130 });
    for (const clientRes of session.sseClients) {
      try {
        clientRes.end();
      } catch {}
    }
    session.sseClients = [];
  }
  res.json({ success: true });
});

// 7. Legacy Execute API (backward compatible)
app.post('/api/execute', async (req: Request, res: Response) => {
  const { code } = req.body;
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Source code is required' });
  }

  const astResult = JavaExecutionEngine.executeAndTrace(code);
  const javacInfo = await getJavacInfo();

  if (javacInfo.available) {
    try {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow_'));
      const javaFile = path.join(tmpDir, 'Main.java');
      fs.writeFileSync(javaFile, code, 'utf-8');

      try {
        await execAsync(`javac "${javaFile}"`, { timeout: 6000 });
        const runResult = await execAsync(`java -cp "${tmpDir}" Main`, {
          timeout: 4000,
          maxBuffer: 1024 * 512,
        });
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return res.json({
          ...astResult,
          stdout: runResult.stdout || astResult.stdout,
          stderr: runResult.stderr || '',
          executedVia: 'host_jvm',
          jvmVersion: javacInfo.version,
        });
      } catch (execErr: any) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        const rawErr = execErr.stderr || execErr.stdout || execErr.message || '';
        return res.json({
          ...astResult,
          success: false,
          stderr: rawErr,
          executedVia: 'host_jvm',
          jvmVersion: javacInfo.version,
        });
      }
    } catch {
      return res.json(astResult);
    }
  }

  return res.json(astResult);
});

// 8. Static Diagnostic API
app.post('/api/diagnose', (req: Request, res: Response) => {
  const { code } = req.body;
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Code is required' });
  }
  const diagnostics = JavaExecutionEngine.analyzeCode(code);
  res.json({ diagnostics });
});

// 9. Gemini AI Tutor & Explainer
app.post('/api/ai/explain', async (req: Request, res: Response) => {
  const { code, line, errorContext } = req.body;
  if (!ai) {
    return res.json({
      explanation: `CodeFlow Rule-Based Tutor:\nThis Java snippet defines code executing at line ${line || 'N/A'}. Variables are stored in memory and assigned via evaluation of expressions. For detailed errors, see the Error Assistant panel.`,
      model: 'rule-based-engine',
    });
  }

  try {
    const prompt = `You are a patient, encouraging Computer Science tutor assisting a BCA college student learning Java. Explain the following code and execution state in a clear, concise, beginner-friendly way (maximum 3 short paragraphs). Highlight: 1. What the code is doing line-by-line. 2. How memory/variables change. 3. Common beginner gotchas to watch out for. Code: \`\`\`java\n${code}\n\`\`\` ${errorContext ? `Current error: ${errorContext}` : ''} ${line ? `Focus line: ${line}` : ''}`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    res.json({
      explanation: response.text,
      model: 'gemini-3.8-flash',
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Failed to generate AI explanation',
      details: err.message,
    });
  }
});

// Initialize Vite in middleware mode
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CodeFlow server running at http://localhost:${PORT}`);
  });
}

startServer();
