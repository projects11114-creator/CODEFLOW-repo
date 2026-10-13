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
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3000', 10);

// Enable CORS for external frontends (e.g. Vercel deployment accessing this JDK backend)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '256kb' }));

// --- SECURITY & RESOURCE ISOLATION CONFIGURATION ---
// 1. Output flood ceiling (prevents memory exhaustion from runaway loops)
const MAX_OUTPUT_CHARS = 100 * 1024; // 100 KB max stdout/stderr

// 2. Concurrency ceiling (prevents server CPU/RAM starvation on Render free tier)
const MAX_CONCURRENT_RUNS = 5;

// 3. Execution timeouts
const TIMEOUT_BATCH_MS = 10000;       // 10s max for non-interactive programs
const TIMEOUT_INTERACTIVE_MS = 45000; // 45s max for interactive Scanner programs

// 4. Stripped environment: Java processes never inherit host secrets (GEMINI_API_KEY, RENDER_*, etc.)
const SAFE_JVM_ENV: NodeJS.ProcessEnv = {
  PATH: process.env.PATH || '',
  JAVA_HOME: process.env.JAVA_HOME || '',
  TMPDIR: os.tmpdir(),
  LANG: 'en_US.UTF-8',
  LC_ALL: 'en_US.UTF-8',
};

// 5. Hardened JVM flags: restrict memory and thread scheduler
const JVM_RESOURCE_FLAGS = [
  '-Xmx64m',                    // Cap heap memory to 64 MB
  '-Xms16m',                    // Initial heap 16 MB
  '-Xss256k',                   // Small stack per thread to prevent stack bombs
  '-XX:+UseSerialGC',           // Single-threaded GC to minimize CPU contention
  '-XX:ActiveProcessorCount=1', // Limit thread pools
  '-XX:+TieredCompilation',
  '-XX:TieredStopAtLevel=1',    // Fast client JIT compilation
  '-Djava.security.egd=file:/dev/./urandom',
];

// Helper to kill entire process tree on POSIX
function killProcessGroup(child?: ChildProcess) {
  if (!child || !child.pid) return;
  try {
    if (process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, 'SIGKILL');
    } else {
      child.kill('SIGKILL');
    }
  } catch {}
}

// 6. In-memory sliding rate limiter (30 requests per minute per IP)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const ipRateLimits = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipRateLimits.entries()) {
    if (now > entry.resetAt) ipRateLimits.delete(ip);
  }
}, 300000);

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateLimits.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 30) {
    return false;
  }
  entry.count++;
  return true;
}

// 7. Security Pre-Check: Prevent dangerous / hostile operations in student submissions
function validateCodeSecurity(code: string): CompilerDiagnostic | null {
  const securityRules: Array<{ regex: RegExp; name: string; reason: string }> = [
    {
      regex: /\b(ProcessBuilder|Runtime\.getRuntime\(\)\.exec|ProcessHandle|java\.lang\.Process\b)/,
      name: 'Subprocess Execution',
      reason: 'Spawning operating system child processes is disabled.',
    },
    {
      regex: /\b(java\.net\.|javax\.net\.|Socket\b|ServerSocket\b|HttpURLConnection\b|HttpClient\b|DatagramSocket\b|URL\b|URI\b|InetAddress\b)/,
      name: 'Network Access',
      reason: 'Outbound network connections, sockets, and web requests are disabled.',
    },
    {
      regex: /\b(java\.io\.(?:File|FileInputStream|FileOutputStream|FileReader|FileWriter|RandomAccessFile|FileDescriptor)|java\.nio\.file\.|(?:File|FileInputStream|FileOutputStream|FileReader|FileWriter|RandomAccessFile)\s+[a-zA-Z0-9_$]+\s*=|new\s+(?:File|FileInputStream|FileOutputStream|FileReader|FileWriter|RandomAccessFile)\s*\(|Files\.|Paths\.)/,
      name: 'Filesystem Access',
      reason: 'Direct filesystem read and write operations are prohibited on CodeFlow. Standard console I/O (Scanner, System.out, System.err, and BufferedReader with InputStreamReader(System.in)) is supported.',
    },
    {
      regex: /\b(Class\.forName|java\.lang\.reflect\.|MethodHandles\.|ClassLoader|URLClassLoader)/,
      name: 'Reflection & Dynamic Code Loading',
      reason: 'Java reflection and dynamic class loading are restricted to maintain sandbox integrity.',
    },
    {
      regex: /\b(new\s+Thread\s*\(|Thread\.sleep|ExecutorService|Executors\.|ForkJoinPool|ThreadPoolExecutor)/,
      name: 'Concurrency / Thread Spawning',
      reason: 'CodeFlow executes educational programs in a single-threaded environment. Spawning background threads is disabled to prevent CPU starvation.',
    },
    {
      regex: /\b(System\.exit|Runtime\.getRuntime\(\)\.halt|addShutdownHook|System\.setSecurityManager|System\.setOut|System\.setErr|System\.setIn)/,
      name: 'System Control & Stream Redirection',
      reason: 'System termination methods and I/O stream redirection are disabled. Allow main() to exit naturally.',
    },
    {
      regex: /\b(System\.load|System\.loadLibrary)/,
      name: 'Native Libraries',
      reason: 'Loading native system libraries (.so/.dll) is prohibited.',
    },
    {
      regex: /\b(sun\.misc\.Unsafe|jdk\.internal\.misc\.Unsafe)/,
      name: 'Unsafe Memory Manipulation',
      reason: 'Direct off-heap memory manipulation is prohibited.',
    },
  ];

  for (const rule of securityRules) {
    const match = code.match(rule.regex);
    if (match) {
      const matchIndex = match.index || 0;
      const linesBefore = code.substring(0, matchIndex).split('\n');
      const lineNum = linesBefore.length;
      const colNum = linesBefore[linesBefore.length - 1].length + 1;
      return {
        category: 'COMPILATION_ERROR',
        title: `Security Policy: ${rule.name}`,
        line: lineNum,
        column: colNum,
        rawMessage: `Security restriction: ${rule.reason}`,
        friendlyExplanation: `The instruction "${match[0]}" is restricted on CodeFlow. ${rule.reason} CodeFlow supports standard algorithms, data structures, recursion, and console I/O.`,
        suggestedCorrection: 'Remove the restricted system, network, or filesystem call.',
        codeSnippet: code.split('\n')[lineNum - 1]?.trim() || '',
        fixAvailable: false,
      };
    }
  }
  return null;
}

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

// Periodic temp directory reaper: removes orphaned /tmp/codeflow_* directories older than 2 minutes
setInterval(() => {
  try {
    const tmpBase = os.tmpdir();
    const entries = fs.readdirSync(tmpBase);
    const now = Date.now();
    for (const entry of entries) {
      if (entry.startsWith('codeflow_')) {
        const fullPath = path.join(tmpBase, entry);
        try {
          const stats = fs.statSync(fullPath);
          if (now - stats.mtimeMs > 120000) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          }
        } catch {}
      }
    }
  } catch {}
}, 120000);

// Periodic session reaper: purges abandoned or completed sessions older than 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (session.status !== 'running' && now - session.lastActivity > 60000) {
      activeSessions.delete(id);
    } else if (session.status === 'running' && now - session.lastActivity > 120000) {
      session.status = 'terminated';
      session.exitCode = 124;
      killProcessGroup(session.child);
      try {
        if (session.tmpDir && fs.existsSync(session.tmpDir)) {
          fs.rmSync(session.tmpDir, { recursive: true, force: true });
        }
      } catch {}
      activeSessions.delete(id);
    }
  }
}, 60000);

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
  // Bound session events to 500 max to prevent memory bloat
  if (session.events.length < 500) {
    session.events.push(full);
  }
  session.lastActivity = Date.now();

  const payload = `data: ${JSON.stringify(full)}\n\n`;
  for (const clientRes of session.sseClients) {
    try {
      clientRes.write(payload);
    } catch {}
  }
  return full;
}

// Health check endpoints for Render, load balancers, and monitoring
app.get(['/healthz', '/api/health'], async (_req: Request, res: Response) => {
  const javacInfo = await getJavacInfo();
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    javacAvailable: javacInfo.available,
    javacVersion: javacInfo.version,
    timestamp: Date.now(),
  });
});

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
    isJdkBackend: true,
    supportedLanguages: [
      { id: 'java', name: 'Java', version: javacInfo.version || 'SE 17/21', active: true },
      { id: 'python', name: 'Python', version: 'Coming Soon', active: false },
      { id: 'cpp', name: 'C++', version: 'Coming Soon', active: false },
    ],
  });
});

// 2. Interactive Execution: START
app.post('/api/execute/interactive/start', async (req: Request, res: Response) => {
  const { code, executionMode } = req.body;
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Source code is required' });
  }
  if (code.length > 65536) {
    return res.status(400).json({ error: 'Source code exceeds maximum allowed size (64 KB).' });
  }

  // 1. Abuse prevention: IP rate limiting
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  if (!checkIpRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded: Maximum 30 executions per minute per client.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      status: 'error',
    });
  }

  // 2. Abuse prevention: Concurrency ceiling (max 5 simultaneous runs)
  let currentActiveCount = 0;
  for (const s of activeSessions.values()) {
    if (s.status === 'running') currentActiveCount++;
  }
  if (currentActiveCount >= MAX_CONCURRENT_RUNS) {
    return res.status(429).json({
      success: false,
      error: 'Server capacity reached (5 concurrent Java runs). Please wait a few seconds and run again.',
      errorCode: 'SERVER_BUSY',
      status: 'error',
    });
  }

  // 3. Security Pre-Check: Scan for malicious/destructive APIs before executing
  const securityDiag = validateCodeSecurity(code);
  if (securityDiag) {
    return res.json({
      success: false,
      sessionId: null,
      status: 'compilation_error',
      stdout: '',
      stderr: `Security restriction: ${securityDiag.friendlyExplanation}`,
      diagnostics: [securityDiag],
      executedVia: 'none',
      trace: [],
    });
  }

  const javacInfo = await getJavacInfo();

  // If client explicitly requested AST simulation fallback
  if (executionMode === 'ast_simulation') {
    if (code.includes('Scanner')) {
      const sessionId = 'cf_ast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const astResult = JavaExecutionEngine.executeAndTrace(code, '');
      const initialStdout = astResult.stdout || '';

      const session: ExecutionSession = {
        id: sessionId,
        isAst: true,
        code,
        accumulatedInput: '',
        tmpDir: '',
        stdout: initialStdout,
        stderr: astResult.stderr || '',
        status: astResult.capabilityStatus === 'waiting_for_input' ? 'running' : (astResult.success ? 'completed' : 'error'),
        exitCode: astResult.capabilityStatus === 'waiting_for_input' ? null : (astResult.success ? 0 : 1),
        createdAt: Date.now(),
        lastActivity: Date.now(),
        currentSeq: 0,
        events: [],
        sseClients: [],
        timeoutTimer: null,
      };
      activeSessions.set(sessionId, session);

      // Emit status banner if waiting for input
      if (astResult.capabilityStatus === 'waiting_for_input') {
        emitSessionEvent(session, {
          type: 'status',
          data: '[AST Simulation Fallback] Interactive Scanner active: Enter input below and click Send:',
        });
      }

      // Emit initial program output (e.g. "Enter number of elements: ")
      if (initialStdout) {
        emitSessionEvent(session, {
          type: 'stdout',
          data: initialStdout,
        });
      }

      // If program already ended without waiting for input, emit exit event
      if (astResult.capabilityStatus !== 'waiting_for_input') {
        emitSessionEvent(session, {
          type: 'exit',
          exitCode: astResult.success ? 0 : 1,
        });
      }

      return res.json({
        success: astResult.success,
        sessionId: astResult.capabilityStatus === 'waiting_for_input' ? sessionId : null,
        status: session.status,
        executedVia: 'ast_engine',
        stdout: initialStdout,
        stderr: astResult.stderr || '',
        trace: astResult.trace,
        diagnostics: astResult.diagnostics,
        capabilityStatus: astResult.capabilityStatus,
        unsupportedConstructNote: astResult.unsupportedConstructNote,
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

  // Real Java (Host JDK) requested: DO NOT silently simulate if javac is unavailable!
  if (!javacInfo.available) {
    return res.status(503).json({
      success: false,
      error: 'Host environment does not have a JDK (javac/java) installed. Cannot execute as a real Java process.',
      errorCode: 'JDK_NOT_AVAILABLE',
      status: 'error',
      executedVia: 'none',
      details: 'This backend environment has no OpenJDK installation in PATH. To simulate this program without a JDK server, switch to "AST Simulation Fallback".',
    });
  }

  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow_'));
    const javaFile = path.join(tmpDir, 'Main.java');
    fs.writeFileSync(javaFile, code, 'utf-8');

    // Compile with javac using isolated environment and 8-second timeout
    try {
      await execAsync(`javac "${javaFile}"`, {
        timeout: 8000,
        env: SAFE_JVM_ENV,
      });
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

    // Determine safe timeout: 45s for Scanner interactive programs, 10s for batch programs
    const isInteractive = code.includes('Scanner');
    const executionTimeoutMs = isInteractive ? TIMEOUT_INTERACTIVE_MS : TIMEOUT_BATCH_MS;

    // Spawn real hardened JVM process with isolated environment and capped memory
    const sessionId = 'cf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const child = spawn('java', [...JVM_RESOURCE_FLAGS, '-cp', tmpDir, 'Main'], {
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: SAFE_JVM_ENV,
      detached: process.platform !== 'win32',
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

    // Auto-terminate runaway processes on timeout
    session.timeoutTimer = setTimeout(() => {
      if (session.status === 'running') {
        session.status = 'terminated';
        session.exitCode = 124;
        killProcessGroup(child);
        emitSessionEvent(session, {
          type: 'status',
          data: `--- Program exceeded ${executionTimeoutMs / 1000}s execution time limit ---`,
        });
        emitSessionEvent(session, { type: 'exit', exitCode: 124 });
      }
    }, executionTimeoutMs);

    // Stream JVM stdout with strict 100 KB memory ceiling
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      if (session.stdout.length + text.length > MAX_OUTPUT_CHARS) {
        if (!session.stdout.includes('[Output limit reached')) {
          session.stdout += '\n[Output limit reached (100 KB). Process terminated to protect server.]\n';
          emitSessionEvent(session, {
            type: 'stdout',
            data: '\n[Output limit reached (100 KB). Process terminated to protect server.]\n',
          });
          killProcessGroup(child);
        }
        return;
      }
      session.stdout += text;
      emitSessionEvent(session, { type: 'stdout', data: text });
    });

    // Stream JVM stderr with strict 100 KB ceiling
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      if (session.stderr.length + text.length > MAX_OUTPUT_CHARS) {
        return;
      }
      session.stderr += text;
      emitSessionEvent(session, { type: 'stderr', data: text });
    });

    // Process termination listener with rapid cleanup (3s)
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

      // Clean up temporary compilation directory after 3 seconds
      setTimeout(() => {
        try {
          if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          }
        } catch {}
        activeSessions.delete(sessionId);
      }, 3000);
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
      try {
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      } catch {}
      activeSessions.delete(sessionId);
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
  if (inputLine.length > 4096) {
    return res.status(400).json({ error: 'Input line exceeds maximum length (4 KB).' });
  }

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

      if (astResult.capabilityStatus !== 'waiting_for_input') {
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
      killProcessGroup(session.child);
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

// 7. Legacy Execute API (backward compatible & security-hardened)
app.post('/api/execute', async (req: Request, res: Response) => {
  const { code, executionMode } = req.body;
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Source code is required' });
  }
  if (code.length > 65536) {
    return res.status(400).json({ error: 'Source code exceeds maximum allowed size (64 KB).' });
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  if (!checkIpRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded: Maximum 30 executions per minute.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      status: 'error',
    });
  }

  const securityDiag = validateCodeSecurity(code);
  if (securityDiag) {
    return res.json({
      success: false,
      status: 'compilation_error',
      stdout: '',
      stderr: `Security restriction: ${securityDiag.friendlyExplanation}`,
      diagnostics: [securityDiag],
      executedVia: 'none',
      trace: [],
    });
  }

  const javacInfo = await getJavacInfo();

  if (executionMode === 'ast_simulation') {
    const astResult = JavaExecutionEngine.executeAndTrace(code);
    return res.json({
      ...astResult,
      executedVia: 'ast_engine',
    });
  }

  if (!javacInfo.available) {
    return res.status(503).json({
      success: false,
      error: 'Host environment does not have a JDK (javac/java) installed.',
      errorCode: 'JDK_NOT_AVAILABLE',
      executedVia: 'none',
      details: 'Deploy to a container with OpenJDK or switch executionMode to ast_simulation.',
    });
  }

  const astResult = JavaExecutionEngine.executeAndTrace(code);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeflow_'));
  const javaFile = path.join(tmpDir, 'Main.java');

  try {
    fs.writeFileSync(javaFile, code, 'utf-8');

    await execAsync(`javac "${javaFile}"`, {
      timeout: 6000,
      env: SAFE_JVM_ENV,
    });

    const runResult = await execAsync(
      `java ${JVM_RESOURCE_FLAGS.join(' ')} -cp "${tmpDir}" Main`,
      {
        timeout: 4000,
        maxBuffer: MAX_OUTPUT_CHARS,
        env: SAFE_JVM_ENV,
      }
    );

    return res.json({
      ...astResult,
      stdout: runResult.stdout || astResult.stdout,
      stderr: runResult.stderr || '',
      executedVia: 'host_jvm',
      jvmVersion: javacInfo.version,
    });
  } catch (execErr: any) {
    const rawErr = execErr.stderr || execErr.stdout || execErr.message || '';
    return res.json({
      ...astResult,
      success: false,
      stderr: rawErr,
      executedVia: 'host_jvm',
      jvmVersion: javacInfo.version,
    });
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}
  }
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
