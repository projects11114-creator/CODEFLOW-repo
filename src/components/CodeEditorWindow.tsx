import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Code, Copy, Check, Sparkles } from 'lucide-react';
import { CompilerDiagnostic } from '../engine/types.ts';

// Configure monaco-editor from local bundle for instant, offline-reliable loading
loader.config({ monaco });

// Stable static editor options (constant reference avoids unnecessary updateOptions calls on re-renders)
const STATIC_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  readOnly: false,
  domReadOnly: false,
  fontSize: 14,
  lineHeight: 22,
  fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",
  letterSpacing: 0,
  cursorBlinking: 'blink',
  cursorSmoothCaretAnimation: 'on',
  cursorStyle: 'line',
  cursorWidth: 2,
  selectOnLineNumbers: true,
  roundedSelection: false,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'off',
  glyphMargin: false,
  lineDecorationsWidth: 10,
  lineNumbersMinChars: 3,
  renderLineHighlight: 'all',
  renderWhitespace: 'none',
  folding: false,
  minimap: { enabled: false },
  stickyScroll: { enabled: false },
  contextmenu: true,
  matchBrackets: 'always',
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  formatOnType: false,
  formatOnPaste: true,
  dragAndDrop: true,
  links: false,
};

interface CodeEditorWindowProps {
  code: string;
  onChange: (val: string) => void;
  activeLine: number | null;
  diagnostics: CompilerDiagnostic[];
  readOnly?: boolean;
}

export const CodeEditorWindow: React.FC<CodeEditorWindowProps> = React.memo(({
  code,
  onChange,
  activeLine,
  diagnostics,
  readOnly = false,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const lastActiveLineRef = useRef<number | null>(null);
  const isUserTypingRef = useRef<boolean>(false);
  const [copied, setCopied] = React.useState(false);

  // Keep a stable ref to the parent onChange callback
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Stable change handler passed to Monaco (never changes reference)
  const handleEditorChange = useCallback((val: string | undefined) => {
    isUserTypingRef.current = true;
    onChangeRef.current(val || '');
  }, []);

  // Stable onMount callback (never changes reference)
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Define custom dark theme for CodeFlow
    monacoInstance.editor.defineTheme('codeflow-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
        { token: 'number', foreground: 'f59e0b' },
        { token: 'string', foreground: '34d399' },
        { token: 'type', foreground: 'c084fc' },
      ],
      colors: {
        'editor.background': '#090d16',
        'editor.foreground': '#e2e8f0',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#38bdf8',
        'editor.lineHighlightBackground': '#0f172a',
        'editorCursor.foreground': '#38bdf8',
        'editor.selectionBackground': '#0284c740',
        'editor.inactiveSelectionBackground': '#0284c720',
      },
    });
    monacoInstance.editor.setTheme('codeflow-dark');

    // Remeasure fonts for pixel-perfect character alignment and cursor placement
    monacoInstance.editor.remeasureFonts();
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        try {
          monacoInstance.editor.remeasureFonts();
        } catch {
          // ignore
        }
      });
    }

    editor.focus();
  }, []);

  // Sync external code changes (e.g. sample change, Apply Fix, Clear) to editor model
  useEffect(() => {
    if (isUserTypingRef.current) {
      isUserTypingRef.current = false;
      return;
    }
    if (editorRef.current) {
      const currentEditorValue = editorRef.current.getValue();
      const normalize = (s: string) => s.replace(/\r\n/g, '\n');
      if (normalize(currentEditorValue) !== normalize(code)) {
        const position = editorRef.current.getPosition();
        editorRef.current.setValue(code);
        if (position && position.lineNumber <= code.split('\n').length) {
          editorRef.current.setPosition(position);
        }
      }
    }
  }, [code]);

  // Synchronize active execution line highlight (runs only when activeLine changes)
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;

    const newDecorations = (activeLine && activeLine > 0)
      ? [
          {
            range: new monacoInstance.Range(activeLine, 1, activeLine, 1),
            options: {
              isWholeLine: true,
              className: 'active-execution-line-bg',
              overviewRuler: {
                color: '#06b6d4',
                position: monacoInstance.editor.OverviewRulerLane.Full,
              },
            },
          },
        ]
      : [];

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

    // Smoothly scroll active line into view ONLY when activeLine changes during execution
    if (activeLine && activeLine > 0 && lastActiveLineRef.current !== activeLine) {
      lastActiveLineRef.current = activeLine;
      try {
        editor.revealLineInCenterIfOutsideViewport(activeLine);
      } catch {
        // ignore
      }
    } else if (!activeLine) {
      lastActiveLineRef.current = null;
    }
  }, [activeLine]);

  // Synchronize compiler diagnostic error squiggles via Monaco's native setModelMarkers
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monacoInstance = monacoRef.current;
    const model = editor.getModel();
    if (!model) return;

    const markers = diagnostics.map((diag) => ({
      severity: monacoInstance.MarkerSeverity.Error,
      startLineNumber: diag.line,
      startColumn: Math.max(1, diag.column || 1),
      endLineNumber: diag.line,
      endColumn: Math.max(1, (diag.column || 1) + 2),
      message: `${diag.title}\n\n${diag.friendlyExplanation}`,
      source: 'Java Compiler',
    }));

    monacoInstance.editor.setModelMarkers(model, 'codeflow-diagnostics', markers);
  }, [diagnostics]);

  // Update readOnly dynamically if needed
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
      editorRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#090d16] border-r border-slate-800">
      {/* Editor Header / Tab Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#090d16] border-t-2 border-t-cyan-500 border-x border-b border-slate-800 text-cyan-200 font-mono text-[11px] shadow-sm">
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span>Main.java</span>
          </div>
          {diagnostics.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              {diagnostics.length} {diagnostics.length === 1 ? 'error' : 'errors'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={formatCode}
            title="Auto-format code"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Format</span>
          </button>
          <button
            onClick={copyCode}
            title="Copy code"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Monaco Code Editor Canvas - Native click, selection and cursor handling */}
      <div className="relative flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="java"
          theme="codeflow-dark"
          defaultValue={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={STATIC_EDITOR_OPTIONS}
          loading={
            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-mono">
              Loading CodeFlow Monaco Editor...
            </div>
          }
        />
      </div>

      {/* Editor Footer / Info Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-900/90 border-t border-slate-800 text-[10px] text-slate-400 font-mono select-none">
        <div className="flex items-center gap-3">
          <span>Java 17/21 Standard</span>
          <span>UTF-8</span>
          {activeLine && (
            <span className="text-cyan-400 font-semibold">
              Executing Line: {activeLine}
            </span>
          )}
        </div>
        <div>
          <span>{code.split('\n').length} lines • {code.length} chars</span>
        </div>
      </div>
    </div>
  );
});
