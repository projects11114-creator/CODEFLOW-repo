import {
  ActionType,
  CompilerDiagnostic,
  DataStructureNode,
  ExecutionResult,
  ExecutionStep,
  HeapObject,
  StackFrame,
  VariableInfo,
  VisualizationCapability,
} from './types.ts';

// Supported Java primitive and reference type keywords
export const SUPPORTED_PRIMITIVES = [
  'byte',
  'short',
  'int',
  'long',
  'float',
  'double',
  'char',
  'boolean',
] as const;

export const SUPPORTED_ARRAY_TYPES = [
  'byte[]',
  'short[]',
  'int[]',
  'long[]',
  'float[]',
  'double[]',
  'char[]',
  'boolean[]',
  'String[]',
  'int[][]',
  'double[][]',
  'char[][]',
  'boolean[][]',
  'String[][]',
] as const;

/**
 * Returns the default initial value for a given Java type.
 */
export function getDefaultValue(type: string): any {
  switch (type) {
    case 'byte':
    case 'short':
    case 'int':
    case 'long':
      return 0;
    case 'float':
    case 'double':
      return 0.0;
    case 'boolean':
      return false;
    case 'char':
      return '\0';
    case 'String':
      return null;
    default:
      if (type.endsWith('[]') || type.endsWith('[][]')) {
        return null;
      }
      return null;
  }
}

/**
 * Returns the default element value for an allocated array of the given base type.
 */
export function getDefaultArrayElement(baseType: string): any {
  switch (baseType) {
    case 'byte':
    case 'short':
    case 'int':
    case 'long':
      return 0;
    case 'float':
    case 'double':
      return 0.0;
    case 'boolean':
      return false;
    case 'char':
      return '\0';
    case 'String':
      return null;
    default:
      return null;
  }
}

/**
 * Normalizes and formats values according to Java type rules.
 */
export function normalizeValueForType(type: string, val: any): any {
  if (val === null || val === undefined) {
    if (type === 'String' || type.endsWith('[]')) return null;
    return getDefaultValue(type);
  }
  switch (type) {
    case 'byte': {
      const num = typeof val === 'number' ? Math.trunc(val) : parseInt(String(val), 10) || 0;
      return ((((num + 128) % 256) + 256) % 256) - 128;
    }
    case 'short': {
      const num = typeof val === 'number' ? Math.trunc(val) : parseInt(String(val), 10) || 0;
      return ((((num + 32768) % 65536) + 65536) % 65536) - 32768;
    }
    case 'int': {
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (typeof val === 'string' && val.length === 1 && !/^\d$/.test(val)) {
        return val.charCodeAt(0);
      }
      const num = typeof val === 'number' ? Math.trunc(val) : parseInt(String(val), 10) || 0;
      return num | 0;
    }
    case 'long': {
      const num = typeof val === 'number' ? Math.trunc(val) : parseInt(String(val).replace(/[Ll]$/, ''), 10) || 0;
      return num;
    }
    case 'float': {
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[Ff]$/, '')) || 0.0;
      return Math.fround ? Math.fround(num) : Number(num.toPrecision(7));
    }
    case 'double': {
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[Dd]$/, '')) || 0.0;
      return num;
    }
    case 'char': {
      if (typeof val === 'number') {
        return String.fromCharCode(val & 0xffff);
      }
      const str = String(val);
      if (str.startsWith("'") && str.endsWith("'")) {
        return unescapeJavaChar(str.slice(1, -1));
      }
      return str.length > 0 ? str[0] : '\0';
    }
    case 'boolean': {
      if (typeof val === 'boolean') return val;
      return String(val).trim() === 'true';
    }
    case 'String': {
      return String(val);
    }
    default:
      return val;
  }
}

/**
 * Formats a character escape sequence.
 */
function unescapeJavaChar(str: string): string {
  if (str === '\\n') return '\n';
  if (str === '\\t') return '\t';
  if (str === '\\r') return '\r';
  if (str === '\\\\') return '\\';
  if (str === "\\'") return "'";
  if (str === '\\0') return '\0';
  return str;
}

/**
 * Splits top-level tokens taking quotes and parentheses into account.
 */
export function splitTopLevel(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const prev = i > 0 ? str[i - 1] : '';

    if ((ch === '"' || ch === "'") && prev !== '\\') {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = ch;
      } else if (quoteChar === ch) {
        inQuotes = false;
        quoteChar = '';
      }
    }

    if (!inQuotes) {
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      else if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
      else if (ch === '[') bracketDepth++;
      else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    }

    if (
      ch === delimiter &&
      !inQuotes &&
      parenDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0
    ) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}

export class ScannerInputBuffer {
  private rawLines: string[];
  private lineIndex: number = 0;
  private currentLineTokens: string[] = [];
  private tokenIndexInLine: number = 0;

  constructor(input: string = '') {
    if (!input || input.trim() === '') {
      this.rawLines = [];
    } else {
      // Split strictly by \n to preserve lines for nextLine()
      this.rawLines = input.split('\n');
      this.loadLine(0);
    }
  }

  private loadLine(idx: number) {
    this.lineIndex = idx;
    if (idx < this.rawLines.length) {
      const line = this.rawLines[idx];
      this.currentLineTokens = line.trim().length > 0 ? line.trim().split(/\s+/) : [];
      this.tokenIndexInLine = 0;
    } else {
      this.currentLineTokens = [];
      this.tokenIndexInLine = 0;
    }
  }

  public hasAvailableToken(): boolean {
    let curLine = this.lineIndex;
    let curTok = this.tokenIndexInLine;
    let tokens = this.currentLineTokens;

    while (curLine < this.rawLines.length) {
      if (curTok < tokens.length) {
        return true;
      }
      curLine++;
      if (curLine < this.rawLines.length) {
        const line = this.rawLines[curLine];
        tokens = line.trim().length > 0 ? line.trim().split(/\s+/) : [];
        curTok = 0;
      }
    }
    return false;
  }

  public hasAvailableLine(): boolean {
    return this.lineIndex < this.rawLines.length;
  }

  public nextToken(): string {
    while (this.lineIndex < this.rawLines.length) {
      if (this.tokenIndexInLine < this.currentLineTokens.length) {
        return this.currentLineTokens[this.tokenIndexInLine++];
      }
      this.loadLine(this.lineIndex + 1);
    }
    throw new Error('ScannerWaitingForInput');
  }

  public nextLine(): string {
    if (this.lineIndex >= this.rawLines.length) {
      throw new Error('ScannerWaitingForInput');
    }
    const line = this.rawLines[this.lineIndex];
    this.loadLine(this.lineIndex + 1);
    return line;
  }
}

interface CustomClassDef {
  name: string;
  fields: { type: string; name: string }[];
  methods: string[];
}

export class JavaExecutionEngine {
  /**
   * Diagnostic static analyzer for Java code.
   */
  public static analyzeCode(code: string): CompilerDiagnostic[] {
    const diagnostics: CompilerDiagnostic[] = [];
    const lines = code.split('\n');

    let openBraces = 0;
    let closeBraces = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const ch of line) {
        if (ch === '{') openBraces++;
        if (ch === '}') closeBraces++;
      }
    }

    if (openBraces !== closeBraces) {
      diagnostics.push({
        category: 'SYNTAX_ERROR',
        title: 'Mismatched Curly Braces',
        line: lines.length,
        column: 1,
        rawMessage: `Syntax error: unmatched curly braces (found ${openBraces} '{' and ${closeBraces} '}').`,
        friendlyExplanation:
          'In Java, every opening brace "{" must have a matching closing brace "}". Your class or method body may be missing a closing "}" at the end.',
        suggestedCorrection: 'Add a closing "}" at the end of the file.',
        codeSnippet: lines[lines.length - 1] || '',
        fixAvailable: true,
        fixedCode: code.trimEnd() + '\n}',
      });
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (
        !trimmed ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('public class') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('import ') ||
        trimmed.startsWith('package ') ||
        trimmed === '{' ||
        trimmed === '}'
      ) {
        continue;
      }

      // Check for unsupported constructs
      if (/^\s*(?:public\s+)?interface\s+[a-zA-Z_]\w*/.test(trimmed)) {
        diagnostics.push({
          category: 'COMPILATION_ERROR',
          title: 'Unsupported Construct: Java Interface',
          line: lineNum,
          column: 1,
          rawMessage: `error: interface declarations are not supported in the AST simulator\n    ${trimmed}`,
          friendlyExplanation: 'The browser-based AST simulation engine is designed for standard algorithmic and procedural Java programs. Interfaces are not currently supported in AST mode.',
          suggestedCorrection: 'Use regular class definitions or run in Real JDK mode with a configured JDK backend.',
          codeSnippet: trimmed,
          fixAvailable: false,
        });
      }

      if (/^\s*(?:public\s+)?enum\s+[a-zA-Z_]\w*/.test(trimmed)) {
        diagnostics.push({
          category: 'COMPILATION_ERROR',
          title: 'Unsupported Construct: Java Enum',
          line: lineNum,
          column: 1,
          rawMessage: `error: enum declarations are not supported in the AST simulator\n    ${trimmed}`,
          friendlyExplanation: 'The browser-based AST simulation engine does not currently interpret enum declarations.',
          suggestedCorrection: 'Use constant variables (e.g. static final int/String) or run in Real JDK mode.',
          codeSnippet: trimmed,
          fixAvailable: false,
        });
      }

      if (/\b(?:try\s*\{|catch\s*\(|finally\s*\{)/.test(trimmed)) {
        diagnostics.push({
          category: 'COMPILATION_ERROR',
          title: 'Unsupported Construct: Try/Catch Exception Blocks',
          line: lineNum,
          column: 1,
          rawMessage: `error: try/catch/finally blocks are not supported in the AST simulator\n    ${trimmed}`,
          friendlyExplanation: 'The AST simulator does not currently support try-catch blocks. Runtime errors are caught and visualized directly.',
          suggestedCorrection: 'Remove the try-catch block and let runtime errors be surfaced in the Error Assistant.',
          codeSnippet: trimmed,
          fixAvailable: false,
        });
      }

      // Type mismatch: int x = "string"
      const intAssignStringMatch = trimmed.match(
        /^(?:int|long|short|byte)\s+([a-zA-Z_]\w*)\s*=\s*("(?:[^"\\]|\\.)*")\s*;?/
      );
      if (intAssignStringMatch) {
        const varName = intAssignStringMatch[1];
        const stringVal = intAssignStringMatch[2];
        const fixedLine = rawLine.replace(/^(.*?\b)(?:int|long|short|byte)(\s+)/, '$1String$2');
        const linesCopy = [...lines];
        linesCopy[i] = fixedLine.endsWith(';') ? fixedLine : fixedLine + ';';
        diagnostics.push({
          category: 'TYPE_MISMATCH',
          title: 'Incompatible Types: String cannot be converted to integer',
          line: lineNum,
          column: rawLine.indexOf(varName) + 1,
          rawMessage: `error: incompatible types: String cannot be converted to int\n    ${trimmed}`,
          friendlyExplanation: `You defined variable "${varName}" with integer type, but assigned text ${stringVal}. An integer can only store whole numbers. To store text, declare it as "String".`,
          suggestedCorrection: `Change type to "String ${varName} = ${stringVal};"`,
          codeSnippet: trimmed,
          fixAvailable: true,
          fixedCode: linesCopy.join('\n'),
        });
      }

      // Type mismatch: boolean b = 123
      const boolAssignNumberMatch = trimmed.match(/^boolean\s+([a-zA-Z_]\w*)\s*=\s*(\d+)\s*;?/);
      if (boolAssignNumberMatch) {
        const varName = boolAssignNumberMatch[1];
        const numVal = boolAssignNumberMatch[2];
        const fixedLine = rawLine.replace(/^(.*?\b)boolean(\s+)/, '$1int$2');
        const linesCopy = [...lines];
        linesCopy[i] = fixedLine;
        diagnostics.push({
          category: 'TYPE_MISMATCH',
          title: 'Incompatible Types: int cannot be converted to boolean',
          line: lineNum,
          column: rawLine.indexOf(varName) + 1,
          rawMessage: `error: incompatible types: int cannot be converted to boolean\n    ${trimmed}`,
          friendlyExplanation: `A boolean variable can only be true or false. You assigned ${numVal}. To store integers, use "int ${varName} = ${numVal};"`,
          suggestedCorrection: `Use "int ${varName} = ${numVal};" or "boolean ${varName} = true;"`,
          codeSnippet: trimmed,
          fixAvailable: true,
          fixedCode: linesCopy.join('\n'),
        });
      }

      // Missing semicolon check
      const needsSemicolon =
        !trimmed.endsWith(';') &&
        !trimmed.endsWith('{') &&
        !trimmed.endsWith('}') &&
        !trimmed.startsWith('if') &&
        !trimmed.startsWith('else') &&
        !trimmed.startsWith('for') &&
        !trimmed.startsWith('while') &&
        !trimmed.startsWith('do') &&
        !trimmed.startsWith('switch') &&
        !trimmed.startsWith('case') &&
        !trimmed.startsWith('default') &&
        !trimmed.startsWith('public') &&
        !trimmed.startsWith('private') &&
        !trimmed.startsWith('protected') &&
        !trimmed.startsWith('static') &&
        (trimmed.includes('=') ||
          trimmed.includes('System.out') ||
          trimmed.includes('return') ||
          trimmed.endsWith('++') ||
          trimmed.endsWith('--'));

      if (needsSemicolon) {
        const linesCopy = [...lines];
        linesCopy[i] = rawLine + ';';
        diagnostics.push({
          category: 'SYNTAX_ERROR',
          title: "Missing Semicolon ';'",
          line: lineNum,
          column: rawLine.length + 1,
          rawMessage: `error: ';' expected\n    ${trimmed}`,
          friendlyExplanation:
            'Every statement in Java must terminate with a semicolon ";". You omitted the semicolon at the end of this statement.',
          suggestedCorrection: `Add ';' at the end: ${trimmed};`,
          codeSnippet: trimmed,
          fixAvailable: true,
          fixedCode: linesCopy.join('\n'),
        });
      }
    }

    return diagnostics;
  }

  /**
   * Primary Universal Java Execution & Trace Engine.
   * Produces complete, high-fidelity execution traces across variables, 1D/2D arrays,
   * loops, recursion, objects, linked lists, and algorithms.
   */
  public static executeAndTrace(code: string, standardInput: string = ''): ExecutionResult {
    const startTime = performance.now();
    const diagnostics = this.analyzeCode(code);
    const fatalErrors = diagnostics.filter(
      (d) =>
        d.category === 'SYNTAX_ERROR' ||
        d.category === 'TYPE_MISMATCH' ||
        d.category === 'COMPILATION_ERROR'
    );
    if (fatalErrors.length > 0) {
      const err = fatalErrors[0];
      return {
        success: false,
        stdout: '',
        stderr: err.rawMessage,
        executionTimeMs: Math.round(performance.now() - startTime),
        trace: [
          {
            stepNumber: 1,
            line: err.line,
            column: err.column,
            description: `Compilation Error at line ${err.line}: ${err.title}`,
            actionType: 'error',
            variables: {},
            callStack: [],
            heap: [],
            output: '',
          },
        ],
        diagnostics,
        executedVia: 'ast_engine',
        totalSteps: 1,
        capabilityStatus: 'compilation_error',
      };
    }

    // Inspect program constructs
    const hasScanner = /\bScanner\b/.test(code);
    const hasRecursion = /\b([a-zA-Z_]\w*)\s*\([^)]*\).*?\b\1\s*\(/s.test(code);
    const has2DArrays = /\[\s*\]\s*\[\s*\]/.test(code);
    const hasCustomClasses = /\bclass\s+(?!Main\b)([a-zA-Z_]\w*)/.test(code);

    let capabilityStatus: VisualizationCapability = 'fully_supported';
    let unsupportedNote: string | undefined = undefined;

    if (hasScanner && !standardInput) {
      capabilityStatus = 'waiting_for_input';
      unsupportedNote =
        'Interactive Scanner mode: Console input is executed live in the AST Engine; 3D view displays memory structures in real time.';
    } else if (hasCustomClasses) {
      unsupportedNote =
        'Custom OOP Class mode: Dynamic objects and reference fields are rendered in the 3D Heap.';
    } else if (hasRecursion) {
      unsupportedNote =
        'Recursion Mode: Stack frames dynamically grow and unwind in 3D Stack memory.';
    } else if (has2DArrays) {
      unsupportedNote =
        '2D Matrix Mode: Multi-dimensional array cells are rendered in a 3D planar grid.';
    }

    const trace: ExecutionStep[] = [];
    const lines = code.split('\n');
    let outputAccumulator = '';

    const mainFrame: StackFrame = {
      frameId: 'frame-main-1',
      methodName: 'main',
      className: 'Main',
      line: 1,
      locals: {},
      depth: 0,
    };
    const callStack: StackFrame[] = [mainFrame];
    const heap: Record<string, HeapObject> = {};
    const variables: Record<string, VariableInfo> = {};

    // Scanner input buffer for AST simulation
    const inputBuffer = new ScannerInputBuffer(standardInput);

    // Helper to snapshot current execution state
    const createStep = (
      line: number,
      description: string,
      actionType: ActionType,
      extras?: Partial<ExecutionStep>
    ) => {
      const varsSnapshot: Record<string, VariableInfo> = {};
      for (const [k, v] of Object.entries(variables)) {
        varsSnapshot[k] = { ...v };
      }
      const stackSnapshot: StackFrame[] = callStack.map((frame) => ({
        ...frame,
        line,
        locals: { ...frame.locals },
      }));
      const heapSnapshot: HeapObject[] = Object.values(heap).map((obj) => ({
        ...obj,
        elements: obj.elements ? [...obj.elements] : undefined,
        matrix2D: obj.matrix2D ? obj.matrix2D.map((row) => [...row]) : undefined,
        fields: obj.fields ? { ...obj.fields } : undefined,
        nodes: obj.nodes ? obj.nodes.map((n) => ({ ...n })) : undefined,
      }));

      trace.push({
        stepNumber: trace.length + 1,
        line,
        column: 1,
        description,
        actionType,
        variables: varsSnapshot,
        callStack: stackSnapshot,
        heap: heapSnapshot,
        output: outputAccumulator,
        ...extras,
      });
    };

    // Find main method start line
    let mainStartLine = 1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('public static void main')) {
        mainStartLine = i + 1;
        break;
      }
    }

    createStep(mainStartLine, 'Program started: entered Main.main()', 'program_start');

    // Parse custom class definitions
    const customClasses: Record<string, CustomClassDef> = {};
    const classRegex = /class\s+([a-zA-Z_]\w*)\s*\{([^}]*)\}/g;
    let classMatch: RegExpExecArray | null;
    while ((classMatch = classRegex.exec(code)) !== null) {
      const clsName = classMatch[1];
      if (clsName === 'Main') continue;
      const clsBody = classMatch[2];
      const fields: { type: string; name: string }[] = [];
      const fieldLines = clsBody.split(';');
      for (const fLine of fieldLines) {
        const fTrim = fLine.trim();
        const fMatch = fTrim.match(/^(int|double|float|String|boolean|char|[a-zA-Z_]\w*)\s+([a-zA-Z_]\w*)/);
        if (fMatch) {
          fields.push({ type: fMatch[1], name: fMatch[2] });
        }
      }
      customClasses[clsName] = {
        name: clsName,
        fields,
        methods: [],
      };
    }

    // Parse methods in Main
    const methods: Record<
      string,
      {
        returnType: string;
        params: { type: string; name: string }[];
        startLine: number;
        endLine: number;
        bodyLines: { lineNum: number; text: string }[];
      }
    > = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const methodMatch = line.match(
        /public\s+static\s+([a-zA-Z_]\w*(?:\[\])?)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{?/
      );
      if (methodMatch && methodMatch[2] !== 'main') {
        const retType = methodMatch[1];
        const methodName = methodMatch[2];
        const rawParams = methodMatch[3].trim();
        const params: { type: string; name: string }[] = [];
        if (rawParams) {
          rawParams.split(',').forEach((p) => {
            const parts = p.trim().split(/\s+/);
            if (parts.length >= 2) {
              params.push({ type: parts[0], name: parts[1] });
            }
          });
        }

        let open = 0;
        let started = false;
        const bodyLines: { lineNum: number; text: string }[] = [];
        for (let j = i; j < lines.length; j++) {
          const l = lines[j];
          for (const ch of l) {
            if (ch === '{') {
              open++;
              started = true;
            }
            if (ch === '}') open--;
          }
          if (started && j > i && open > 0) {
            bodyLines.push({ lineNum: j + 1, text: l.trim() });
          }
          if (started && open === 0) {
            methods[methodName] = {
              returnType: retType,
              params,
              startLine: i + 1,
              endLine: j + 1,
              bodyLines,
            };
            break;
          }
        }
      }
    }

    // Method Executor & Expression Evaluator
    let executeMethod: (
      methodDef: (typeof methods)[string],
      args: any[],
      methodName: string
    ) => any;

    // Expression Evaluator
    const evaluateExpr = (exprStr: string, localScope: Record<string, VariableInfo>): any => {
      let expr = exprStr.trim();
      if (expr.endsWith(';')) expr = expr.slice(0, -1).trim();
      if (expr === 'true') return true;
      if (expr === 'false') return false;
      if (expr === 'null') return null;
      if (/^'([^']*)'$/.test(expr)) {
        return unescapeJavaChar(expr.slice(1, -1));
      }
      if (expr.startsWith('"') && expr.endsWith('"') && !expr.slice(1, -1).includes('"')) {
        return expr.slice(1, -1);
      }

      // Scanner method calls
      if (
        /\b[a-zA-Z_]\w*\s*\.\s*(?:nextLine|nextInt|nextDouble|nextLong|nextFloat|nextBoolean|nextByte|nextShort|next|hasNext|hasNextInt|hasNextLine)\s*\(\s*\)/i.test(
          expr
        )
      ) {
        // Pure Scanner call check
        const pureMatch = expr.match(
          /^\s*[a-zA-Z_]\w*\s*\.\s*(nextLine|nextInt|nextDouble|nextLong|nextFloat|nextBoolean|nextByte|nextShort|next|hasNext|hasNextInt|hasNextLine)\s*\(\s*\)\s*$/i
        );
        if (pureMatch) {
          const method = pureMatch[1].toLowerCase();
          if (method === 'nextline') {
            return inputBuffer.nextLine();
          }
          if (method === 'hasnext' || method === 'hasnextint') {
            return inputBuffer.hasAvailableToken();
          }
          if (method === 'hasnextline') {
            return inputBuffer.hasAvailableLine();
          }
          const tok = inputBuffer.nextToken();
          if (method === 'nextint' || method === 'nextshort' || method === 'nextbyte')
            return parseInt(tok, 10) || 0;
          if (method === 'nextlong') return parseInt(tok, 10) || 0;
          if (method === 'nextdouble' || method === 'nextfloat')
            return parseFloat(tok) || 0.0;
          if (method === 'nextboolean') return tok.toLowerCase() === 'true';
          return tok;
        }

        // Replace embedded Scanner method calls in compound expressions
        expr = expr.replace(
          /\b[a-zA-Z_]\w*\s*\.\s*(nextLine|nextInt|nextDouble|nextLong|nextFloat|nextBoolean|nextByte|nextShort|next|hasNext|hasNextInt|hasNextLine)\s*\(\s*\)/gi,
          (_m, methodName) => {
            const method = methodName.toLowerCase();
            if (method === 'nextline') {
              const lineVal = inputBuffer.nextLine();
              return JSON.stringify(lineVal);
            }
            if (method === 'hasnext' || method === 'hasnextint') {
              return String(inputBuffer.hasAvailableToken());
            }
            if (method === 'hasnextline') {
              return String(inputBuffer.hasAvailableLine());
            }
            const tok = inputBuffer.nextToken();
            if (method === 'nextint' || method === 'nextshort' || method === 'nextbyte')
              return String(parseInt(tok, 10) || 0);
            if (method === 'nextlong') return String(parseInt(tok, 10) || 0);
            if (method === 'nextdouble' || method === 'nextfloat')
              return String(parseFloat(tok) || 0.0);
            if (method === 'nextboolean') return String(tok.toLowerCase() === 'true');
            return JSON.stringify(tok);
          }
        );
      }

      // String method calls: s.length(), s.toUpperCase(), s.toLowerCase(), s.charAt(i), s.substring(a, b)
      const strMethodMatch = expr.match(/^([a-zA-Z_]\w*)\.(length|toUpperCase|toLowerCase|charAt|substring)\(([^)]*)\)$/);
      if (strMethodMatch) {
        const strVar = strMethodMatch[1];
        const method = strMethodMatch[2];
        const rawArgs = strMethodMatch[3];
        const targetVal = String(localScope[strVar]?.value ?? variables[strVar]?.value ?? '');
        if (method === 'length') return targetVal.length;
        if (method === 'toUpperCase') return targetVal.toUpperCase();
        if (method === 'toLowerCase') return targetVal.toLowerCase();
        if (method === 'charAt') {
          const idx = Number(evaluateExpr(rawArgs, localScope));
          return targetVal.charAt(idx);
        }
        if (method === 'substring') {
          const args = rawArgs.split(',').map((a) => Number(evaluateExpr(a.trim(), localScope)));
          return args.length === 2 ? targetVal.substring(args[0], args[1]) : targetVal.substring(args[0]);
        }
      }

      // Array length checks anywhere within expressions: arr.length or matrix[r].length
      expr = expr.replace(/([a-zA-Z_]\w*)\[([^\]]+)\]\.length/g, (_m, mName, rExpr) => {
        const rIdx = Number(evaluateExpr(rExpr, localScope));
        const heapObj = heap[mName];
        if (heapObj?.matrix2D && heapObj.matrix2D[rIdx]) {
          return String(heapObj.matrix2D[rIdx].length);
        }
        return '0';
      });

      expr = expr.replace(/([a-zA-Z_]\w*)\.length/g, (_m, aName) => {
        const heapKey = localScope[aName]?.heapKey || variables[aName]?.heapKey || aName;
        const heapObj = heap[heapKey] || heap[aName];
        if (heapObj?.elements) return String(heapObj.elements.length);
        if (heapObj?.matrix2D) return String(heapObj.matrix2D.length);
        const v = localScope[aName]?.value ?? variables[aName]?.value;
        if (Array.isArray(v)) return String(v.length);
        if (typeof v === 'string') return String(v.length);
        return _m;
      });

      // Math numeric literals
      if (/^0x[0-9a-fA-F_]+$/i.test(expr)) return parseInt(expr.replace(/_/g, ''), 16);
      if (/^0b[01_]+$/i.test(expr)) return parseInt(expr.slice(2).replace(/_/g, ''), 2);
      if (/^-?\d[0-9_]*[Ll]$/.test(expr)) return parseInt(expr.replace(/_/g, '').slice(0, -1), 10);
      if (/^-?\d[0-9_]*(\.\d[0-9_]*)?[Ff]$/.test(expr)) return parseFloat(expr.replace(/_/g, '').slice(0, -1));
      if (/^-?\d[0-9_]*(\.\d[0-9_]*)?[Dd]$/.test(expr)) return parseFloat(expr.replace(/_/g, '').slice(0, -1));
      if (/^-?\d[0-9_]*$/.test(expr)) return parseInt(expr.replace(/_/g, ''), 10);
      if (/^-?\d[0-9_]*\.\d[0-9_]*$/.test(expr)) return parseFloat(expr.replace(/_/g, ''));

      // 2D Array allocation: new int[3][4]
      const new2DMatch = expr.match(/^new\s+([a-zA-Z_]\w*)\[([^\]]+)\]\[([^\]]+)\]$/);
      if (new2DMatch) {
        const baseType = new2DMatch[1];
        const rows = Number(evaluateExpr(new2DMatch[2], localScope));
        const cols = Number(evaluateExpr(new2DMatch[3], localScope));
        const defaultElem = getDefaultArrayElement(baseType);
        return Array.from({ length: rows }, () => new Array(cols).fill(defaultElem));
      }

      // 1D Array allocation: new int[5]
      const newArrayMatch = expr.match(/^new\s+([a-zA-Z_]\w*)\[([^\]]+)\]$/);
      if (newArrayMatch) {
        const baseType = newArrayMatch[1];
        const sizeExpr = newArrayMatch[2];
        const rawSize = evaluateExpr(sizeExpr, localScope);
        const size = Number(rawSize);
        if (isNaN(size) || size < 0) {
          throw new Error('NegativeArraySizeException: ' + rawSize);
        }
        const defaultElem = getDefaultArrayElement(baseType);
        return new Array(size).fill(defaultElem);
      }

      // Object allocation: new Person("Alice", 21) or new Node(10)
      const newObjMatch = expr.match(/^new\s+([a-zA-Z_]\w*)\(([^)]*)\)$/);
      if (newObjMatch) {
        const clsName = newObjMatch[1];
        const argStr = newObjMatch[2].trim();
        const evaluatedArgs = argStr ? splitTopLevel(argStr, ',').map((a) => evaluateExpr(a, localScope)) : [];
        const classDef = customClasses[clsName];
        const fieldsObj: Record<string, any> = {};
        if (classDef) {
          classDef.fields.forEach((f, idx) => {
            fieldsObj[f.name] = evaluatedArgs[idx] !== undefined ? evaluatedArgs[idx] : getDefaultValue(f.type);
          });
        } else {
          fieldsObj['val'] = evaluatedArgs[0] ?? 0;
        }
        return { __class: clsName, ...fieldsObj };
      }

      // Cast
      const castMatch = expr.match(/^\(([a-zA-Z_]\w*)\)\s*(.+)$/);
      if (castMatch) {
        const targetType = castMatch[1];
        const innerVal = evaluateExpr(castMatch[2], localScope);
        return normalizeValueForType(targetType, innerVal);
      }

      // Method call (including recursion)
      const methodCallMatch = expr.match(/^([a-zA-Z_]\w*)\s*\(([\s\S]*)\)$/);
      if (methodCallMatch) {
        const methodName = methodCallMatch[1];
        const argStr = methodCallMatch[2].trim();
        const targetMethod = methods[methodName];
        if (targetMethod) {
          const evaluatedArgs = argStr
            ? splitTopLevel(argStr, ',').map((a) => {
                const trimmedArg = a.trim();
                if (heap[trimmedArg]) {
                  return { __isHeapRef: true, heapKey: trimmedArg };
                }
                if (localScope[trimmedArg]?.heapKey) {
                  return { __isHeapRef: true, heapKey: localScope[trimmedArg].heapKey };
                }
                return evaluateExpr(trimmedArg, localScope);
              })
            : [];
          return executeMethod(targetMethod, evaluatedArgs, methodName);
        }
      }

      // Evaluate 2D Array accesses inside expression: matrix[r][c]
      let resolvedExpr = expr.replace(/([a-zA-Z_]\w*)\[([^\[\]]+)\]\[([^\[\]]+)\]/g, (_m, arrName, rExpr, cExpr) => {
        const r = Number(evaluateExpr(rExpr, localScope));
        const c = Number(evaluateExpr(cExpr, localScope));
        const heapObj = heap[arrName];
        if (heapObj?.matrix2D && heapObj.matrix2D[r] && heapObj.matrix2D[r][c] !== undefined) {
          const val = heapObj.matrix2D[r][c];
          return typeof val === 'number' || typeof val === 'boolean' ? String(val) : JSON.stringify(val);
        }
        return _m;
      });

      // Evaluate 1D Array accesses inside expression: arr[index]
      resolvedExpr = resolvedExpr.replace(/([a-zA-Z_]\w*)\[([^\[\]]+)\]/g, (_m, arrName, idxExpr) => {
        const idx = Number(evaluateExpr(idxExpr, localScope));
        const heapKey = localScope[arrName]?.heapKey || variables[arrName]?.heapKey || arrName;
        const heapObj = heap[heapKey] || heap[arrName];
        if (heapObj?.elements && !isNaN(idx)) {
          if (idx < 0 || idx >= heapObj.elements.length) {
            throw new Error(`ArrayIndexOutOfBoundsException: Index ${idx} out of bounds for length ${heapObj.elements.length}`);
          }
          const val = heapObj.elements[idx];
          return typeof val === 'number' || typeof val === 'boolean' ? String(val) : JSON.stringify(val);
        }
        return _m;
      });

      // Object field access: p.age or node.data
      resolvedExpr = resolvedExpr.replace(/([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)/g, (m, objName, fieldName) => {
        if (fieldName === 'length') return m;
        const heapObj = heap[objName];
        if (heapObj && heapObj.fields && heapObj.fields[fieldName] !== undefined) {
          const val = heapObj.fields[fieldName];
          return typeof val === 'number' || typeof val === 'boolean' ? String(val) : JSON.stringify(val);
        }
        return m;
      });

      // Variable lookup for pure identifier
      if (/^[a-zA-Z_]\w*$/.test(resolvedExpr)) {
        if (localScope[resolvedExpr] !== undefined) return localScope[resolvedExpr].value;
        if (variables[resolvedExpr] !== undefined) return variables[resolvedExpr].value;
      }

      // String concatenation
      if (resolvedExpr.includes('+') && (resolvedExpr.includes('"') || resolvedExpr.includes("'"))) {
        const parts = splitTopLevel(resolvedExpr, '+');
        if (parts.length > 1) {
          const evaluatedParts = parts.map((p) => evaluateExpr(p, localScope));
          if (evaluatedParts.some((p) => typeof p === 'string')) {
            return evaluatedParts.map((p) => (p === null ? 'null' : String(p))).join('');
          }
        }
      }

      // Math & Logical evaluation
      let jsExpr = resolvedExpr;
      jsExpr = jsExpr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
        if (match === 'true' || match === 'false' || match === 'null' || match === 'Math') return match;
        // Don't replace if it's an array or object heap reference
        if (heap[match]?.elements || heap[match]?.matrix2D) return match;
        if (localScope[match] !== undefined) {
          const val = localScope[match].value;
          return typeof val === 'string' ? JSON.stringify(val) : String(val);
        }
        if (variables[match] !== undefined) {
          const val = variables[match].value;
          return typeof val === 'string' ? JSON.stringify(val) : String(val);
        }
        return match;
      });

      if (/\/\s*0(?!\.)\b/.test(jsExpr)) {
        throw new Error('ArithmeticException: / by zero');
      }

      try {
        jsExpr = jsExpr.replace(/(\d+)[Ll]\b/g, '$1');
        jsExpr = jsExpr.replace(/(\d+(?:\.\d+)?)[Ff]\b/g, '$1');
        const hasDecimals = /\d+\.\d+/.test(jsExpr);
        // eslint-disable-next-line no-new-func
        const fn = new Function(`return (${jsExpr});`);
        const result = fn();
        if (!hasDecimals && typeof result === 'number' && jsExpr.includes('/')) {
          return Math.trunc(result);
        }
        return result;
      } catch {
        return 0;
      }
    };

    // Recursive Statement Execution Engine & Method Handler
    try {
      let stepCount = 0;
      const MAX_STEPS = 3000;
      let lastSwapCandidate: { arrName: string; idx: number; tempVar?: string; val: any } | null = null;
      let recursionDepth = 0;
      const MAX_RECURSION_DEPTH = 50;

      const extractBlock = (
        list: { lineNum: number; text: string }[],
        startIdx: number
      ): { bodyLines: { lineNum: number; text: string }[]; endIdx: number } => {
        const startText = list[startIdx]?.text || '';
        let hasBrace = startText.includes('{');
        let braceStartLine = startIdx;
        if (!hasBrace && startIdx + 1 < list.length && list[startIdx + 1].text.trim().startsWith('{')) {
          hasBrace = true;
          braceStartLine = startIdx + 1;
        }

        if (!hasBrace) {
          const parenIdx = startText.lastIndexOf(')');
          if (parenIdx !== -1 && parenIdx < startText.length - 1) {
            const rest = startText.substring(parenIdx + 1).trim();
            if (rest && rest !== ';') {
              return {
                bodyLines: [{ lineNum: list[startIdx].lineNum, text: rest }],
                endIdx: startIdx,
              };
            }
          }
          if (startIdx + 1 < list.length) {
            return {
              bodyLines: [list[startIdx + 1]],
              endIdx: startIdx + 1,
            };
          }
          return { bodyLines: [], endIdx: startIdx };
        }

        let brace = 0;
        let started = false;
        let endIdx = startIdx;
        const bodyLines: { lineNum: number; text: string }[] = [];

        for (let k = braceStartLine; k < list.length; k++) {
          const text = list[k].text;
          const searchStart = k === braceStartLine && text.includes('{') ? text.indexOf('{') : 0;
          let hitZero = false;

          for (let ci = searchStart; ci < text.length; ci++) {
            const ch = text[ci];
            if (ch === '{') {
              brace++;
              started = true;
            }
            if (ch === '}') {
              brace--;
            }
            if (started && brace === 0) {
              endIdx = k;
              hitZero = true;
              break;
            }
          }
          if (k > braceStartLine && !hitZero) {
            bodyLines.push(list[k]);
          }
          if (hitZero) break;
        }
        return { bodyLines, endIdx };
      };

      let executeBlock: (
        stmtList: { lineNum: number; text: string }[],
        localScope: Record<string, VariableInfo>
      ) => any;

      executeMethod = (
        methodDef: (typeof methods)[string],
        args: any[],
        methodName: string
      ): any => {
        recursionDepth++;
        if (recursionDepth > MAX_RECURSION_DEPTH) {
          throw new Error('StackOverflowError: recursive limit reached');
        }

        const frameId = `frame-${methodName}-${callStack.length + 1}`;
        const isRecursive = callStack.some((f) => f.methodName === methodName);

        const methodFrame: StackFrame = {
          frameId,
          methodName,
          className: 'Main',
          line: methodDef.startLine,
          locals: {},
          isRecursive,
          depth: callStack.length,
          args: {},
        };

        // Bind parameters
        methodDef.params.forEach((param, idx) => {
          const rawArg = args[idx];
          if (param.type.includes('[]')) {
            let heapKey = '';
            if (rawArg && typeof rawArg === 'object' && rawArg.__isHeapRef) {
              heapKey = rawArg.heapKey;
            } else if (typeof rawArg === 'string' && heap[rawArg]) {
              heapKey = rawArg;
            } else if (heap['arr']) {
              heapKey = 'arr';
            }
            if (heapKey && heap[heapKey]) {
              const heapObj = heap[heapKey];
              heap[param.name] = heapObj;
              const varInfo: VariableInfo = {
                name: param.name,
                type: param.type,
                value: `[${heapObj?.elements ? heapObj.elements.join(', ') : ''}]`,
                scope: methodName,
                hasChanged: true,
                heapKey,
              };
              methodFrame.locals[param.name] = varInfo;
              variables[param.name] = varInfo;
              if (methodFrame.args) methodFrame.args[param.name] = varInfo.value;
              return;
            }
          }

          const val = normalizeValueForType(param.type, rawArg);
          const varInfo: VariableInfo = {
            name: param.name,
            type: param.type,
            value: val,
            scope: methodName,
            hasChanged: true,
          };
          methodFrame.locals[param.name] = varInfo;
          variables[param.name] = varInfo;
          if (methodFrame.args) methodFrame.args[param.name] = val;
          variables[`${methodName}_${callStack.length}.${param.name}`] = varInfo;
        });

        callStack.push(methodFrame);
        createStep(
          methodDef.startLine,
          `Invoked ${isRecursive ? 'recursive ' : ''}method ${methodName}(${args
            .map((a) => (a && typeof a === 'object' && a.__isHeapRef ? a.heapKey : JSON.stringify(a)))
            .join(', ')}): Stack frame pushed (Depth ${callStack.length})`,
          isRecursive ? 'recursion_frame' : 'method_call'
        );

        let returnValue: any = undefined;
        const blockResult = executeBlock(methodDef.bodyLines, methodFrame.locals);
        if (blockResult && typeof blockResult === 'object' && blockResult.signal === 'return') {
          returnValue = blockResult.value;
        } else if (methodFrame.returnValue !== undefined) {
          returnValue = methodFrame.returnValue;
        }

        callStack.pop();
        recursionDepth--;
        methodDef.params.forEach((p) => {
          delete variables[`${methodName}_${callStack.length + 1}.${p.name}`];
          if (p.name !== 'arr' && !callStack.some((f) => f.locals[p.name])) {
            delete variables[p.name];
          }
        });

        if (callStack.length > 0) {
          const topFrame = callStack[callStack.length - 1];
          for (const [k, v] of Object.entries(topFrame.locals)) {
            variables[k] = v;
          }
        }

        createStep(
          methodDef.endLine,
          `Popped stack frame [${methodName}]: Returning ${JSON.stringify(returnValue)} to caller`,
          'method_return'
        );

        return returnValue;
      };

      executeBlock = (
        stmtList: { lineNum: number; text: string }[],
        localScope: Record<string, VariableInfo>
      ): any => {
        let idx = 0;
        while (idx < stmtList.length && stepCount < MAX_STEPS) {
          const item = stmtList[idx];
          const lineNum = item.lineNum;
          const trimmed = item.text.trim();
          stepCount++;

          if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '{' || trimmed === '}') {
            idx++;
            continue;
          }

          // 1. Scanner initialization
          if (trimmed.includes('new Scanner(')) {
            const scMatch = trimmed.match(/Scanner\s+([a-zA-Z_]\w*)/);
            const scName = scMatch ? scMatch[1] : 'sc';
            variables[scName] = {
              name: scName,
              type: 'Scanner',
              value: 'System.in',
              scope: 'main',
              hasChanged: true,
            };
            localScope[scName] = variables[scName];
            createStep(
              lineNum,
              `Initialized Scanner instance on standard input (System.in)`,
              'declaration',
              { activeVariableKey: scName }
            );
            idx++;
            continue;
          }

          // 2. Scanner input read without provided stdin or when tokens are exhausted
          const hasScannerReadCall = /\b[a-zA-Z_]\w*\s*\.\s*(?:nextLine|nextInt|nextDouble|nextLong|nextFloat|nextBoolean|nextByte|nextShort|next)\s*\(\s*\)/i.test(
            trimmed
          );
          if (hasScannerReadCall) {
            const isNextLineCall = /\b[a-zA-Z_]\w*\s*\.\s*nextLine\s*\(\s*\)/i.test(trimmed);
            const inputAvailable = isNextLineCall ? inputBuffer.hasAvailableLine() : inputBuffer.hasAvailableToken();
            if (!inputAvailable) {
              createStep(
                lineNum,
                `Interactive input waiting: User provides input via the Console Window`,
                'unsupported_note'
              );
              throw new Error('ScannerWaitingForInput');
            }
          }

          // 3. For loop (handles outer AND nested loops!)
          const forMatch = trimmed.match(/^for\s*\(\s*(.*?);\s*(.*?);\s*(.*?)\)\s*\{?/);
          if (forMatch) {
            const initClause = forMatch[1].trim();
            const condClause = forMatch[2].trim();
            const stepClause = forMatch[3].trim();
            const { bodyLines, endIdx } = extractBlock(stmtList, idx);
            idx = endIdx + 1;

            // Parse and execute loop init
            let loopVar = '';
            const initDeclMatch = initClause.match(/^(?:(byte|short|int|long)\s+)?([a-zA-Z_]\w*)\s*=\s*(.*)$/);
            if (initDeclMatch) {
              const vType = initDeclMatch[1] || 'int';
              loopVar = initDeclMatch[2];
              const initVal = normalizeValueForType(vType, evaluateExpr(initDeclMatch[3], localScope));
              variables[loopVar] = {
                name: loopVar,
                type: vType,
                value: initVal,
                scope: 'loop',
                hasChanged: true,
              };
              localScope[loopVar] = variables[loopVar];
              createStep(lineNum, `Loop initialized: ${vType} ${loopVar} = ${initVal}`, 'loop_header', {
                activeVariableKey: loopVar,
                loopState: {
                  loopVariable: loopVar,
                  iteration: 0,
                  condition: condClause,
                  willContinue: true,
                  summary: `Initialized ${loopVar} = ${initVal}`,
                },
              });
            }

            let iteration = 0;
            const MAX_LOOP_ITER = 60;
            while (iteration < MAX_LOOP_ITER && stepCount < MAX_STEPS) {
              iteration++;
              const condResult = Boolean(evaluateExpr(condClause, localScope));
              createStep(
                lineNum,
                `Loop condition check (#${iteration}): ${condClause} -> ${condResult}`,
                'loop_header',
                {
                  activeVariableKey: loopVar,
                  branchDecision: {
                    condition: condClause,
                    result: condResult,
                    explanation: `Evaluated loop condition: ${condClause} -> ${condResult}`,
                    branchTaken: condResult ? 'Enter Loop Body' : 'Exit Loop',
                  },
                  loopState: {
                    loopVariable: loopVar,
                    iteration,
                    condition: condClause,
                    willContinue: condResult,
                    summary: condResult ? `Iteration #${iteration} active` : 'Loop finished',
                  },
                }
              );

              if (!condResult) break;

              // Execute loop body
              const sig = executeBlock(bodyLines, localScope);
              if (sig === 'break') break;
              if (sig === 'return' || (sig && typeof sig === 'object' && sig.signal === 'return')) return sig;

              // Execute loop step
              if (stepClause.includes('++')) {
                const currentV = Number(localScope[loopVar]?.value ?? variables[loopVar]?.value) || 0;
                variables[loopVar] = { ...variables[loopVar], value: currentV + 1, prevValue: currentV, hasChanged: true };
                localScope[loopVar] = variables[loopVar];
              } else if (stepClause.includes('--')) {
                const currentV = Number(localScope[loopVar]?.value ?? variables[loopVar]?.value) || 0;
                variables[loopVar] = { ...variables[loopVar], value: currentV - 1, prevValue: currentV, hasChanged: true };
                localScope[loopVar] = variables[loopVar];
              } else if (stepClause.includes('+=')) {
                const rhs = Number(evaluateExpr(stepClause.split('+=')[1], localScope)) || 1;
                const currentV = Number(localScope[loopVar]?.value ?? variables[loopVar]?.value) || 0;
                variables[loopVar] = { ...variables[loopVar], value: currentV + rhs, prevValue: currentV, hasChanged: true };
                localScope[loopVar] = variables[loopVar];
              } else if (stepClause.includes('*=')) {
                const rhs = Number(evaluateExpr(stepClause.split('*=')[1], localScope)) || 2;
                const currentV = Number(localScope[loopVar]?.value ?? variables[loopVar]?.value) || 0;
                variables[loopVar] = { ...variables[loopVar], value: currentV * rhs, prevValue: currentV, hasChanged: true };
                localScope[loopVar] = variables[loopVar];
              } else if (stepClause.includes('=')) {
                const parts = stepClause.split('=');
                const sVar = parts[0].trim();
                const rhs = Number(evaluateExpr(parts.slice(1).join('='), localScope)) || 0;
                const currentV = Number(localScope[sVar]?.value ?? variables[sVar]?.value) || 0;
                variables[sVar] = { ...variables[sVar], value: rhs, prevValue: currentV, hasChanged: true };
                localScope[sVar] = variables[sVar];
              }
            }
            continue;
          }

          // 4. While loop
          const whileMatch = trimmed.match(/^while\s*\((.*?)\)\s*\{?/);
          if (whileMatch && !trimmed.endsWith(';')) {
            const condClause = whileMatch[1].trim();
            const { bodyLines, endIdx } = extractBlock(stmtList, idx);
            idx = endIdx + 1;
            let iter = 0;
            while (iter < 100 && stepCount < MAX_STEPS) {
              iter++;
              const condRes = Boolean(evaluateExpr(condClause, localScope));
              createStep(lineNum, `While condition (#${iter}): ${condClause} -> ${condRes}`, 'loop_header');
              if (!condRes) break;
              const sig = executeBlock(bodyLines, localScope);
              if (sig === 'break') break;
              if (sig === 'return' || (sig && typeof sig === 'object' && sig.signal === 'return')) return sig;
            }
            continue;
          }

          // 4b. Do-While loop: do { ... } while (...);
          if (trimmed === 'do' || trimmed.startsWith('do{') || trimmed.startsWith('do ') || /^do\s*\{?$/.test(trimmed)) {
            const { bodyLines, endIdx } = extractBlock(stmtList, idx);
            let condClause = 'false';
            let nextIdx = endIdx + 1;

            const endLineText = stmtList[endIdx]?.text || '';
            const whileOnEndLineMatch = endLineText.match(/while\s*\((.*?)\)\s*;?/);
            if (whileOnEndLineMatch) {
              condClause = whileOnEndLineMatch[1].trim();
            } else if (endIdx + 1 < stmtList.length) {
              const nextLineText = stmtList[endIdx + 1].text.trim();
              const whileNextLineMatch = nextLineText.match(/^while\s*\((.*?)\)\s*;?/);
              if (whileNextLineMatch) {
                condClause = whileNextLineMatch[1].trim();
                nextIdx = endIdx + 2;
              }
            }

            idx = nextIdx;
            let iter = 0;
            const MAX_DO_WHILE_ITER = 100;
            createStep(lineNum, `Entered do-while loop`, 'loop_header');
            while (iter < MAX_DO_WHILE_ITER && stepCount < MAX_STEPS) {
              iter++;
              const sig = executeBlock(bodyLines, localScope);
              if (sig === 'break') break;
              if (sig === 'return' || (sig && typeof sig === 'object' && sig.signal === 'return')) return sig;

              const condRes = Boolean(evaluateExpr(condClause, localScope));
              createStep(
                lineNum,
                `Do-while condition check (#${iter}): ${condClause} -> ${condRes}`,
                'loop_header',
                {
                  branchDecision: {
                    condition: condClause,
                    result: condRes,
                    explanation: `Evaluated do-while condition: ${condClause} -> ${condRes}`,
                    branchTaken: condRes ? 'Continue Loop' : 'Exit Loop',
                  },
                }
              );
              if (!condRes) break;
            }
            continue;
          }

          // 4c. Standalone while trailing do-while: while (...);
          if (/^while\s*\(.*?\)\s*;?$/.test(trimmed)) {
            idx++;
            continue;
          }

          // 5. If-Else / Else-If chain statement
          const ifMatch = trimmed.match(/^if\s*\((.*?)\)\s*\{?/);
          if (ifMatch) {
            const branches: {
              cond: string | null;
              bodyLines: { lineNum: number; text: string }[];
              lineNum: number;
            }[] = [];

            const firstCond = ifMatch[1].trim();
            const { bodyLines: firstBody, endIdx: firstEnd } = extractBlock(stmtList, idx);
            branches.push({ cond: firstCond, bodyLines: firstBody, lineNum });
            let currEnd = firstEnd;

            while (currEnd < stmtList.length) {
              const lineAtEnd = stmtList[currEnd].text;
              const afterBrace = lineAtEnd.includes('}')
                ? lineAtEnd.substring(lineAtEnd.indexOf('}') + 1).trim()
                : '';

              if (afterBrace.startsWith('else if') || /^else\s+if\s*\(/.test(afterBrace)) {
                const m = afterBrace.match(/else\s+if\s*\((.*?)\)\s*\{?/);
                const nextCond = m ? m[1].trim() : '';
                const nextBlock = extractBlock(stmtList, currEnd);
                branches.push({
                  cond: nextCond,
                  bodyLines: nextBlock.bodyLines,
                  lineNum: stmtList[currEnd].lineNum,
                });
                currEnd = nextBlock.endIdx;
              } else if (afterBrace.startsWith('else')) {
                const nextBlock = extractBlock(stmtList, currEnd);
                branches.push({
                  cond: null,
                  bodyLines: nextBlock.bodyLines,
                  lineNum: stmtList[currEnd].lineNum,
                });
                currEnd = nextBlock.endIdx;
                break;
              } else if (
                currEnd + 1 < stmtList.length &&
                stmtList[currEnd + 1].text.trim().startsWith('else if')
              ) {
                const nextText = stmtList[currEnd + 1].text.trim();
                const m = nextText.match(/^else\s+if\s*\((.*?)\)\s*\{?/);
                const nextCond = m ? m[1].trim() : '';
                const nextBlock = extractBlock(stmtList, currEnd + 1);
                branches.push({
                  cond: nextCond,
                  bodyLines: nextBlock.bodyLines,
                  lineNum: stmtList[currEnd + 1].lineNum,
                });
                currEnd = nextBlock.endIdx;
              } else if (
                currEnd + 1 < stmtList.length &&
                stmtList[currEnd + 1].text.trim().startsWith('else')
              ) {
                const nextBlock = extractBlock(stmtList, currEnd + 1);
                branches.push({
                  cond: null,
                  bodyLines: nextBlock.bodyLines,
                  lineNum: stmtList[currEnd + 1].lineNum,
                });
                currEnd = nextBlock.endIdx;
                break;
              } else {
                break;
              }
            }

            idx = currEnd + 1;

            // Execute the first matching branch
            for (const branch of branches) {
              if (branch.cond !== null) {
                const bCond = branch.cond;
                // Check if array elements are being compared
                const arrCompMatch = bCond.match(
                  /([a-zA-Z_]\w*)\[([^\]]+)\]\s*(>|<|>=|<=|==|!=)\s*([a-zA-Z_]\w*(?:\[[^\]]+\])?|\d+)/
                );
                let comparedArr: string | undefined = undefined;
                let idx1: number | undefined = undefined;
                let idx2: number | undefined = undefined;
                if (arrCompMatch) {
                  comparedArr = arrCompMatch[1];
                  idx1 = Number(evaluateExpr(arrCompMatch[2], localScope));
                  if (arrCompMatch[4].includes('[')) {
                    const idx2Expr = arrCompMatch[4].substring(
                      arrCompMatch[4].indexOf('[') + 1,
                      arrCompMatch[4].indexOf(']')
                    );
                    idx2 = Number(evaluateExpr(idx2Expr, localScope));
                  } else if (arrCompMatch[4] === 'pivot' || arrCompMatch[4] === 'p') {
                    if (localScope['high'] !== undefined) {
                      idx2 = Number(localScope['high'].value);
                    }
                  }
                  if (heap[comparedArr]) {
                    heap[comparedArr].comparedIndices =
                      idx2 !== undefined ? [Math.min(idx1, idx2), Math.max(idx1, idx2)] : [idx1, idx1];
                  }
                }

                const condResult = Boolean(evaluateExpr(bCond, localScope));
                const compDesc = `Evaluated if (${bCond}) -> ${condResult}`;

                createStep(branch.lineNum, compDesc, 'branch_condition', {
                  activeArrayKey: comparedArr,
                  activeArrayIndex: idx1,
                  branchDecision: {
                    condition: bCond,
                    result: condResult,
                    explanation: compDesc,
                    branchTaken: condResult ? 'Condition True' : 'Condition False',
                  },
                });

                if (comparedArr && heap[comparedArr]) {
                  heap[comparedArr].comparedIndices = undefined;
                }

                if (condResult) {
                  const sig = executeBlock(branch.bodyLines, localScope);
                  if (sig === 'break' || sig === 'return' || (sig && typeof sig === 'object' && sig.signal === 'return')) return sig;
                  break; // Matching branch executed; do not evaluate subsequent else-ifs/else
                }
              } else {
                // Unconditional else branch
                createStep(branch.lineNum, 'Executing else branch', 'branch_condition', {
                  branchDecision: {
                    condition: 'else',
                    result: true,
                    explanation: 'Else branch matched',
                    branchTaken: 'Else branch',
                  },
                });
                const sig = executeBlock(branch.bodyLines, localScope);
                if (sig === 'break' || sig === 'return' || (sig && typeof sig === 'object' && sig.signal === 'return')) return sig;
                break;
              }
            }
            continue;
          }

          // 6. 2D Array Declaration: int[][] matrix = { { 1, 2 }, { 3, 4 } };
          const array2DDeclMatch = trimmed.match(
            /^(byte|short|int|long|float|double|char|boolean|String)\[\s*\]\[\s*\]\s+([a-zA-Z_]\w*)\s*=\s*(?:\{([^}]+(?:\{[^}]*\}[^}]*)*)\}|new\s+(?:byte|short|int|long|float|double|char|boolean|String)\[([^\]]+)\]\[([^\]]+)\]);?/
          );
          if (array2DDeclMatch) {
            const elemType = array2DDeclMatch[1];
            const arrName = array2DDeclMatch[2];
            const literalContent = array2DDeclMatch[3];
            const rowExpr = array2DDeclMatch[4];
            const colExpr = array2DDeclMatch[5];
            let matrix: any[][] = [];
            if (literalContent !== undefined) {
              const rowsRaw = literalContent.split('},').map((r) => r.replace(/[{}]/g, '').trim());
              matrix = rowsRaw.map((r) =>
                splitTopLevel(r, ',').map((c) => normalizeValueForType(elemType, evaluateExpr(c, localScope)))
              );
            } else if (rowExpr && colExpr) {
              const rCount = Number(evaluateExpr(rowExpr, localScope));
              const cCount = Number(evaluateExpr(colExpr, localScope));
              const defVal = getDefaultArrayElement(elemType);
              matrix = Array.from({ length: rCount }, () => new Array(cCount).fill(defVal));
            }

            const heapObj: HeapObject = {
              id: `matrix-${arrName}-${Date.now()}`,
              name: arrName,
              type: `${elemType}[][]`,
              matrix2D: matrix,
              collectionType: 'matrix2d',
              activeRow: 0,
              activeCol: 0,
            };
            heap[arrName] = heapObj;
            variables[arrName] = {
              name: arrName,
              type: `${elemType}[][]`,
              value: `Matrix ${matrix.length}x${matrix[0]?.length || 0}`,
              scope: 'main',
              hasChanged: true,
            };
            localScope[arrName] = variables[arrName];

            createStep(
              lineNum,
              `Allocated 2D Matrix ${arrName} in 3D Heap (${matrix.length}x${matrix[0]?.length || 0})`,
              'array_declaration',
              { activeArrayKey: arrName }
            );
            idx++;
            continue;
          }

          // 7. 2D Array Element Mutation: matrix[r][c] = val;
          const array2DMutationMatch = trimmed.match(/^([a-zA-Z_]\w*)\[([^\]]+)\]\[([^\]]+)\]\s*=\s*(.*?);?$/);
          if (array2DMutationMatch) {
            const arrName = array2DMutationMatch[1];
            const r = Number(evaluateExpr(array2DMutationMatch[2], localScope));
            const c = Number(evaluateExpr(array2DMutationMatch[3], localScope));
            const rhsVal = evaluateExpr(array2DMutationMatch[4], localScope);
            if (heap[arrName]?.matrix2D && heap[arrName].matrix2D![r]) {
              heap[arrName].matrix2D![r][c] = rhsVal;
              heap[arrName].activeRow = r;
              heap[arrName].activeCol = c;
              createStep(
                lineNum,
                `Updated 2D Matrix element: ${arrName}[${r}][${c}] = ${JSON.stringify(rhsVal)}`,
                'array_mutation',
                { activeArrayKey: arrName }
              );
            }
            idx++;
            continue;
          }

          // 8. 1D Array Declaration: int[] arr = { 19, 28, 14, 25, 12, 22, 11 }; or int arr[] = { ... };
          const array1DDeclMatch = trimmed.match(
            /^(byte|short|int|long|float|double|char|boolean|String)(?:\[\s*\]\s+([a-zA-Z_]\w*)|\s+([a-zA-Z_]\w*)\[\s*\])\s*=\s*(?:\{([^}]+)\}|new\s+(?:byte|short|int|long|float|double|char|boolean|String)\[([^\]]+)\]);?/
          );
          if (array1DDeclMatch) {
            const elemType = array1DDeclMatch[1];
            const arrName = array1DDeclMatch[2] || array1DDeclMatch[3];
            const literalContent = array1DDeclMatch[4];
            const newSizeExpr = array1DDeclMatch[5];
            let elements: any[] = [];
            if (literalContent !== undefined) {
              elements = splitTopLevel(literalContent, ',').map((item) =>
                normalizeValueForType(elemType, evaluateExpr(item, localScope))
              );
            } else if (newSizeExpr !== undefined) {
              const rawSize = evaluateExpr(newSizeExpr, localScope);
              const size = Number(rawSize);
              if (isNaN(size) || size < 0) {
                throw new Error('NegativeArraySizeException: ' + rawSize);
              }
              elements = new Array(size).fill(getDefaultArrayElement(elemType));
            }

            const heapObj: HeapObject = {
              id: `arr-${arrName}-${Date.now()}`,
              name: arrName,
              type: `${elemType}[]`,
              elements: [...elements],
              collectionType: 'array',
              activeIndex: 0,
            };
            heap[arrName] = heapObj;
            variables[arrName] = {
              name: arrName,
              type: `${elemType}[]`,
              value: `[${elements.map((e) => JSON.stringify(e)).join(', ')}]`,
              scope: 'main',
              hasChanged: true,
            };
            localScope[arrName] = variables[arrName];

            createStep(
              lineNum,
              `Allocated ${elemType}[] array "${arrName}" (${elements.length} elements) in 3D Heap`,
              'array_declaration',
              { activeArrayKey: arrName }
            );
            idx++;
            continue;
          }

          // 9. 1D Array Element Mutation: arr[j] = arr[j + 1]; or arr[minIndex] = arr[i]; or arr[i] = temp;
          const array1DMutationMatch = trimmed.match(/^([a-zA-Z_]\w*)\[([^\]]+)\]\s*=\s*(.*?);?$/);
          if (array1DMutationMatch) {
            const arrName = array1DMutationMatch[1];
            const idxExpr = array1DMutationMatch[2];
            const rhsExpr = array1DMutationMatch[3];
            const targetIdx = Number(evaluateExpr(idxExpr, localScope));
            const rhsVal = evaluateExpr(rhsExpr, localScope);

            const heapKey = localScope[arrName]?.heapKey || variables[arrName]?.heapKey || arrName;
            const targetHeapObj = heap[heapKey] || heap[arrName];
            if (targetHeapObj?.elements && !isNaN(targetIdx)) {
              if (targetIdx < 0 || targetIdx >= targetHeapObj.elements.length) {
                throw new Error(`ArrayIndexOutOfBoundsException: Index ${targetIdx} out of bounds for length ${targetHeapObj.elements.length}`);
              }
              const prevVal = targetHeapObj.elements[targetIdx];
              targetHeapObj.elements[targetIdx] = rhsVal;
              targetHeapObj.activeIndex = targetIdx;
              const formattedArrVal = `[${targetHeapObj.elements.map((e) => JSON.stringify(e)).join(', ')}]`;
              variables[arrName] = {
                ...(variables[arrName] || { name: arrName, type: targetHeapObj.type, scope: 'main' }),
                value: formattedArrVal,
                hasChanged: true,
              };
              if (variables[heapKey]) {
                variables[heapKey].value = formattedArrVal;
                variables[heapKey].hasChanged = true;
              }

              // Check if this mutation completes a swap
              let isSwap = false;
              let swapPartner = targetIdx;
              if (lastSwapCandidate && (lastSwapCandidate.arrName === arrName || heap[lastSwapCandidate.arrName] === heap[arrName]) && lastSwapCandidate.tempVar !== undefined) {
                if (lastSwapCandidate.idx !== targetIdx && (rhsExpr.trim() === lastSwapCandidate.tempVar || rhsVal === lastSwapCandidate.val)) {
                  swapPartner = lastSwapCandidate.idx;
                  heap[arrName].swappingIndices = [Math.min(swapPartner, targetIdx), Math.max(swapPartner, targetIdx)];
                  isSwap = true;
                }
              }

              createStep(
                lineNum,
                isSwap
                  ? `Sorting Swap: ${arrName}[${swapPartner}] <-> ${arrName}[${targetIdx}] (now ${rhsVal})`
                  : `Array mutation: ${arrName}[${targetIdx}] = ${rhsVal} (was ${prevVal})`,
                'array_mutation',
                {
                  activeArrayKey: arrName,
                  activeArrayIndex: targetIdx,
                }
              );

              if (isSwap) {
                heap[arrName].swappingIndices = undefined;
                lastSwapCandidate = null;
              }
            }
            idx++;
            continue;
          }

          // 10. Temporary swap variable declaration: int temp = arr[j]; or int temp = arr[minIndex];
          const swapTempDeclMatch = trimmed.match(
            /^(?:int|long|short|byte|double|float|char|boolean|String)\s+([a-zA-Z_]\w*)\s*=\s*([a-zA-Z_]\w*)\[([^\]]+)\];?$/
          );
          if (swapTempDeclMatch) {
            const varName = swapTempDeclMatch[1];
            const arrName = swapTempDeclMatch[2];
            const sourceIdx = Number(evaluateExpr(swapTempDeclMatch[3], localScope));
            const heapKey = localScope[arrName]?.heapKey || variables[arrName]?.heapKey || arrName;
            const targetHeapObj = heap[heapKey] || heap[arrName];
            if (!targetHeapObj?.elements || isNaN(sourceIdx) || sourceIdx < 0 || sourceIdx >= targetHeapObj.elements.length) {
              throw new Error(`ArrayIndexOutOfBoundsException: Index ${sourceIdx} out of bounds for length ${targetHeapObj?.elements?.length ?? 0}`);
            }
            const sourceVal = targetHeapObj.elements[sourceIdx];
            lastSwapCandidate = { arrName, idx: sourceIdx, tempVar: varName, val: sourceVal };
            variables[varName] = {
              name: varName,
              type: 'int',
              value: sourceVal,
              scope: 'main',
              hasChanged: true,
            };
            localScope[varName] = variables[varName];

            createStep(
              lineNum,
              `Saved temporary swap value: ${varName} = ${arrName}[${sourceIdx}] (${sourceVal})`,
              'declaration',
              {
                activeVariableKey: varName,
                activeArrayKey: arrName,
                activeArrayIndex: sourceIdx,
              }
            );
            idx++;
            continue;
          }

          // 11. Object Instantiation: Student s = new Student();
          const objInstMatch = trimmed.match(/^([a-zA-Z_]\w*)\s+([a-zA-Z_]\w*)\s*=\s*new\s+([a-zA-Z_]\w*)\(([^)]*)\);?/);
          if (objInstMatch && customClasses[objInstMatch[1]]) {
            const clsName = objInstMatch[1];
            const varName = objInstMatch[2];
            const rawArgs = objInstMatch[4].trim();
            const args = rawArgs ? splitTopLevel(rawArgs, ',').map((a) => evaluateExpr(a, localScope)) : [];
            const classDef = customClasses[clsName];
            const fieldsObj: Record<string, any> = {};
            if (classDef) {
              classDef.fields.forEach((f, fIdx) => {
                fieldsObj[f.name] = args[fIdx] !== undefined ? args[fIdx] : getDefaultValue(f.type);
              });
            }
            const isNode = classDef.fields.some((f) => f.name === 'next');
            const isTreeNode = classDef.fields.some((f) => f.name === 'left' || f.name === 'right');
            const heapObj: HeapObject = {
              id: `obj-${varName}-${Date.now()}`,
              name: varName,
              type: clsName,
              fields: fieldsObj,
              collectionType: isTreeNode ? 'tree' : isNode ? 'linkedlist' : 'object',
            };
            heap[varName] = heapObj;
            variables[varName] = {
              name: varName,
              type: clsName,
              value: `@${clsName}{${Object.entries(fieldsObj).map(([k, v]) => `${k}:${v}`).join(', ')}}`,
              scope: 'main',
              hasChanged: true,
            };
            localScope[varName] = variables[varName];

            createStep(
              lineNum,
              `Created object instance of class ${clsName} in Heap: ${varName}`,
              'object_instantiation',
              { activeVariableKey: varName }
            );
            idx++;
            continue;
          }

          // 12. Object Field Mutation: s.marks = 95;
          const fieldMutationMatch = trimmed.match(/^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\s*=\s*(.*?);?$/);
          if (fieldMutationMatch && fieldMutationMatch[2] !== 'length') {
            const objName = fieldMutationMatch[1];
            const fieldName = fieldMutationMatch[2];
            const rhsVal = evaluateExpr(fieldMutationMatch[3], localScope);
            if (heap[objName]?.fields) {
              heap[objName].fields![fieldName] = rhsVal;
              if (variables[objName]) {
                variables[objName].value = `@${heap[objName].type}{${Object.entries(heap[objName].fields!).map(([k, v]) => `${k}:${v}`).join(', ')}}`;
                variables[objName].hasChanged = true;
              }
              createStep(
                lineNum,
                `Updated object field: ${objName}.${fieldName} = ${JSON.stringify(rhsVal)} in Heap`,
                'field_mutation',
                { activeVariableKey: objName }
              );
            }
            idx++;
            continue;
          }

          // 13. Print Statements: System.out.println(...)
          if (trimmed.startsWith('System.out.println') || trimmed.startsWith('System.out.print')) {
            const printMatch = trimmed.match(/System\.out\.print(?:ln)?\s*\((.*)\)\s*;?/);
            if (printMatch) {
              const printArg = printMatch[1];
              const trimmedArg = printArg.trim();
              const result = trimmedArg === '' ? '' : evaluateExpr(trimmedArg, localScope);
              const isLn = trimmed.startsWith('System.out.println');
              const displayStr = result === null ? 'null' : String(result);
              const chunk = displayStr + (isLn ? '\n' : '');
              outputAccumulator += chunk;
              createStep(
                lineNum,
                `Standard Output: System.out.print${isLn ? 'ln' : ''}(${JSON.stringify(displayStr)})`,
                'print',
                { newOutputChunk: chunk }
              );
            }
            idx++;
            continue;
          }

          // 14. Compound Assignment: sum += i;
          const compoundMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*(\+=|-=|\*=|\/=|%=)\s*(.*?);?$/);
          if (compoundMatch) {
            const targetVar = compoundMatch[1];
            const op = compoundMatch[2];
            const rhsVal = evaluateExpr(compoundMatch[3], localScope);
            const curVal = variables[targetVar]?.value || 0;
            let newVal = curVal;
            if (op === '+=') newVal = curVal + rhsVal;
            else if (op === '-=') newVal = curVal - rhsVal;
            else if (op === '*=') newVal = curVal * rhsVal;
            else if (op === '/=') newVal = Math.trunc(curVal / rhsVal);
            else if (op === '%=') newVal = curVal % rhsVal;

            variables[targetVar] = {
              ...variables[targetVar],
              value: newVal,
              prevValue: curVal,
              hasChanged: true,
            };
            localScope[targetVar] = variables[targetVar];

            createStep(
              lineNum,
              `Updated ${targetVar}: ${curVal} ${op} ${rhsVal} -> ${newVal}`,
              'assignment',
              { activeVariableKey: targetVar }
            );
            idx++;
            continue;
          }

          // 15. Increments: i++; or i--;
          const incMatch = trimmed.match(/^([a-zA-Z_]\w*)(\+\+|--);?$/);
          if (incMatch) {
            const targetVar = incMatch[1];
            const isInc = incMatch[2] === '++';
            const curVal = Number(localScope[targetVar]?.value ?? variables[targetVar]?.value ?? 0);
            const newVal = isInc ? curVal + 1 : curVal - 1;
            variables[targetVar] = {
              ...variables[targetVar],
              name: targetVar,
              type: variables[targetVar]?.type || 'int',
              value: newVal,
              prevValue: curVal,
              hasChanged: true,
            };
            localScope[targetVar] = variables[targetVar];

            createStep(
              lineNum,
              `${isInc ? 'Incremented' : 'Decremented'} ${targetVar}: ${curVal} -> ${newVal}`,
              'assignment',
              { activeVariableKey: targetVar }
            );
            idx++;
            continue;
          }

          // 16. Variable Declarations: int marks = 100; int n = arr.length;
          const varDeclPrefixMatch = trimmed.match(
            /^(byte|short|int|long|float|double|char|boolean|String)\s+(.+?);?$/
          );
          if (varDeclPrefixMatch && !trimmed.startsWith('return')) {
            const type = varDeclPrefixMatch[1];
            const rest = varDeclPrefixMatch[2];
            const declList = splitTopLevel(rest, ',');
            for (const item of declList) {
              const itemMatch = item.match(/^([a-zA-Z_]\w*)(?:\s*=\s*(.*?))?$/);
              if (itemMatch) {
                const name = itemMatch[1];
                const initExpr = itemMatch[2];
                const val = initExpr
                  ? normalizeValueForType(type, evaluateExpr(initExpr, localScope))
                  : getDefaultValue(type);
                variables[name] = {
                  name,
                  type,
                  value: val,
                  scope: 'main',
                  hasChanged: true,
                };
                localScope[name] = variables[name];

                createStep(
                  lineNum,
                  `Declared variable "${name}" (${type}) = ${JSON.stringify(val)} in Stack memory`,
                  'declaration',
                  { activeVariableKey: name }
                );
              }
            }
            idx++;
            continue;
          }

          // 17. Variable Reassignment: marks = 150; or minIndex = j;
          const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(.*?);?$/);
          if (assignMatch && !trimmed.startsWith('return')) {
            const name = assignMatch[1];
            const rhsExpr = assignMatch[2];
            const prevVal = variables[name]?.value;
            const varType = variables[name]?.type || 'int';
            const newVal = normalizeValueForType(varType, evaluateExpr(rhsExpr, localScope));
            variables[name] = {
              name,
              type: varType,
              value: newVal,
              prevValue: prevVal,
              scope: variables[name]?.scope || 'main',
              hasChanged: true,
            };
            localScope[name] = variables[name];

            createStep(
              lineNum,
              `Variable Reassignment: "${name}" changed from ${JSON.stringify(prevVal)} to ${JSON.stringify(newVal)}`,
              'assignment',
              { activeVariableKey: name }
            );
            idx++;
            continue;
          }

          // 18. Standalone Method Call: calculateSquare(x);
          const standaloneMethodCall = trimmed.match(/^([a-zA-Z_]\w*)\s*\(([\s\S]*)\)\s*;?$/);
          if (standaloneMethodCall && methods[standaloneMethodCall[1]]) {
            evaluateExpr(standaloneMethodCall[0], localScope);
            idx++;
            continue;
          }

          // 19. Break statement: break;
          if (trimmed === 'break;' || trimmed.startsWith('break;')) {
            createStep(lineNum, 'Break statement reached: exiting loop', 'branch_condition');
            return 'break';
          }

          // 20. Return statement: return; or return val;
          if (trimmed === 'return;' || /^return(?:\s+.*)?;?$/.test(trimmed)) {
            const retExpr = trimmed.replace(/^return\s*/, '').replace(/;$/, '').trim();
            const retVal = retExpr ? evaluateExpr(retExpr, localScope) : undefined;
            if (callStack.length > 0) {
              callStack[callStack.length - 1].returnValue = retVal;
            }
            createStep(lineNum, `Return statement reached: returning ${JSON.stringify(retVal)}`, 'method_return');
            return { signal: 'return', value: retVal };
          }

          idx++;
        }
        return 'none';
      };

      // Extract main method body lines and execute
      let mainOpenBrace = -1;
      let mainCloseBrace = -1;
      let braceTrack = 0;
      for (let k = mainStartLine - 1; k < lines.length; k++) {
        for (const ch of lines[k]) {
          if (ch === '{') {
            braceTrack++;
            if (mainOpenBrace === -1) mainOpenBrace = k;
          }
          if (ch === '}') {
            braceTrack--;
            if (braceTrack === 0 && mainOpenBrace !== -1) {
              mainCloseBrace = k;
              break;
            }
          }
        }
        if (mainCloseBrace !== -1) break;
      }

      const mainLinesToExecute: { lineNum: number; text: string }[] = [];
      if (mainOpenBrace !== -1 && mainCloseBrace === mainOpenBrace) {
        const fullLine = lines[mainOpenBrace];
        const mainIdx = fullLine.indexOf('public static void main');
        const braceOpen = fullLine.indexOf('{', mainIdx !== -1 ? mainIdx : 0);
        let depth = 0;
        let braceClose = -1;
        if (braceOpen !== -1) {
          for (let ci = braceOpen; ci < fullLine.length; ci++) {
            if (fullLine[ci] === '{') depth++;
            if (fullLine[ci] === '}') {
              depth--;
              if (depth === 0) {
                braceClose = ci;
                break;
              }
            }
          }
        }
        const bodyContent = braceClose !== -1 ? fullLine.substring(braceOpen + 1, braceClose) : '';
        const stmts = bodyContent.split(';').map((s) => s.trim()).filter(Boolean);
        for (const stmt of stmts) {
          mainLinesToExecute.push({ lineNum: mainOpenBrace + 1, text: stmt + ';' });
        }
      } else {
        const startK = mainOpenBrace !== -1 ? mainOpenBrace + 1 : mainStartLine;
        const endK = mainCloseBrace !== -1 ? mainCloseBrace : lines.length;
        for (let k = startK; k < endK; k++) {
          mainLinesToExecute.push({ lineNum: k + 1, text: lines[k] });
        }
      }

      executeBlock(mainLinesToExecute, mainFrame.locals);

      createStep(lines.length, 'Program execution finished cleanly (exit code 0)', 'program_end');

      return {
        success: true,
        stdout: outputAccumulator,
        stderr: '',
        executionTimeMs: Math.round(performance.now() - startTime),
        trace,
        diagnostics,
        executedVia: 'ast_engine',
        totalSteps: trace.length,
        capabilityStatus,
        unsupportedConstructNote: unsupportedNote,
      };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      if (errorMsg === 'ScannerWaitingForInput') {
        return {
          success: true,
          stdout: outputAccumulator,
          stderr: '',
          executionTimeMs: Math.round(performance.now() - startTime),
          trace,
          diagnostics,
          executedVia: 'ast_engine',
          totalSteps: trace.length,
          capabilityStatus: 'waiting_for_input',
          unsupportedConstructNote: 'Waiting for next input in console...',
        };
      }
      createStep(
        trace[trace.length - 1]?.line || 1,
        `Runtime Exception thrown: ${errorMsg}`,
        'exception_thrown',
        {
          exceptionInfo: {
            type: errorMsg.split(':')[0] || 'RuntimeException',
            message: errorMsg,
            line: trace[trace.length - 1]?.line || 1,
          },
        }
      );
      return {
        success: false,
        stdout: '',
        stderr: `Exception in thread "main" java.lang.${errorMsg}`,
        executionTimeMs: Math.round(performance.now() - startTime),
        trace,
        diagnostics: [
          ...diagnostics,
          {
            category: 'RUNTIME_ERROR',
            title: errorMsg.split(':')[0] || 'Runtime Error',
            line: trace[trace.length - 1]?.line || 1,
            column: 1,
            rawMessage: `Runtime Error: ${errorMsg}`,
            friendlyExplanation: `A runtime exception halted execution: ${errorMsg}.`,
            suggestedCorrection: 'Check array bounds, arithmetic operations, or null pointers.',
            codeSnippet: lines[trace[trace.length - 1]?.line - 1] || '',
            fixAvailable: false,
          },
        ],
        executedVia: 'ast_engine',
        totalSteps: trace.length,
        capabilityStatus: 'runtime_error',
        unsupportedConstructNote: unsupportedNote,
      };
    }
  }
}
