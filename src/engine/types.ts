export type DiagnosticCategory =
  | 'SYNTAX_ERROR'
  | 'TYPE_MISMATCH'
  | 'COMPILATION_ERROR'
  | 'RUNTIME_ERROR'
  | 'LOGICAL_WARNING';

export interface CompilerDiagnostic {
  category: DiagnosticCategory;
  title: string;
  line: number;
  column: number;
  rawMessage: string;
  friendlyExplanation: string;
  suggestedCorrection: string;
  codeSnippet: string;
  fixedCode?: string;
  fixAvailable: boolean;
}

export type ActionType =
  | 'program_start'
  | 'program_end'
  | 'declaration'
  | 'assignment'
  | 'branch_condition'
  | 'switch_statement'
  | 'loop_header'
  | 'loop_step'
  | 'print'
  | 'method_call'
  | 'method_return'
  | 'array_declaration'
  | 'array_mutation'
  | 'object_instantiation'
  | 'field_mutation'
  | 'data_structure_op'
  | 'recursion_frame'
  | 'exception_thrown'
  | 'error'
  | 'unsupported_note';

export type JavaPrimitiveType =
  | 'byte'
  | 'short'
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'char'
  | 'boolean';

export interface VariableInfo {
  name: string;
  type: string;
  value: any;
  prevValue?: any;
  hasChanged?: boolean;
  scope: string;
}

export interface StackFrame {
  frameId: string;
  methodName: string;
  className: string;
  line: number;
  locals: Record<string, VariableInfo>;
  args?: Record<string, any>;
  isRecursive?: boolean;
  depth?: number;
  returnValue?: any;
}

export interface DataStructureNode {
  id: string;
  val: any;
  next?: string;
  prev?: string;
  left?: string;
  right?: string;
  label?: string;
}

export interface HeapObject {
  id: string;
  name: string;
  type: string;
  elements?: any[];
  matrix2D?: any[][];
  fields?: Record<string, any>;
  nodes?: DataStructureNode[];
  collectionType?: 'array' | 'matrix2d' | 'object' | 'linkedlist' | 'stack' | 'queue' | 'tree' | 'map';
  activeIndex?: number;
  activeRow?: number;
  activeCol?: number;
  swappingIndices?: [number, number];
  comparedIndices?: [number, number];
}

export interface BranchDecision {
  condition: string;
  result: boolean;
  explanation: string;
  branchTaken: string;
}

export interface LoopState {
  loopVariable?: string;
  iteration: number;
  condition: string;
  willContinue: boolean;
  summary: string;
}

export type VisualizationCapability =
  | 'fully_supported'
  | 'partially_supported'
  | 'unsupported_feature'
  | 'waiting_for_input'
  | 'compilation_error'
  | 'runtime_error'
  | 'completed';

export interface ExecutionStep {
  stepNumber: number;
  line: number;
  column: number;
  description: string;
  actionType: ActionType;
  variables: Record<string, VariableInfo>;
  callStack: StackFrame[];
  heap: HeapObject[];
  output: string;
  newOutputChunk?: string;
  branchDecision?: BranchDecision;
  loopState?: LoopState;
  activeVariableKey?: string;
  activeArrayKey?: string;
  activeArrayIndex?: number;
  activeNodeId?: string;
  highlightedLine?: number;
  exceptionInfo?: {
    type: string;
    message: string;
    line: number;
  };
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  trace: ExecutionStep[];
  diagnostics: CompilerDiagnostic[];
  executedVia: 'host_jvm' | 'ast_engine';
  totalSteps: number;
  capabilityStatus?: VisualizationCapability;
  unsupportedConstructNote?: string;
}

export interface SampleProgram {
  id: string;
  title: string;
  category:
    | 'Basics'
    | 'Control Flow'
    | 'Loops'
    | 'Arrays'
    | '2D Arrays'
    | 'Methods'
    | 'Recursion'
    | 'Objects & OOP'
    | 'Data Structures'
    | 'Sorting & Searching'
    | 'Exceptions'
    | 'Error Practice';
  description: string;
  code: string;
  expectedConcepts: string[];
}
