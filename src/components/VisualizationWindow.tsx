import React, { useState } from 'react';
import {
  Activity,
  Layers,
  Database,
  GitBranch,
  Play,
  Pause,
  StepForward,
  StepBack,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Code2,
  Box,
  Repeat,
  CheckCircle2,
  Cuboid,
} from 'lucide-react';
import { ExecutionStep, VariableInfo, VisualizationCapability } from '../engine/types.ts';
import { ThreeDMemoryVisualizer } from './ThreeDMemoryVisualizer.tsx';
import { ThreeDErrorBoundary } from './ThreeDErrorBoundary.tsx';

function formatVariableValue(type: string, val: any): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (type === 'char') {
    if (val === '\0') return "'\\0'";
    if (val === '\n') return "'\\n'";
    if (val === '\t') return "'\\t'";
    return `'${val}'`;
  }
  if (type === 'String') return `"${val}"`;
  if (type === 'long') return `${val}L`;
  if (type === 'float') {
    const num = Number(val);
    return Number.isInteger(num) ? `${num}.0f` : `${val}f`;
  }
  if (type === 'double') {
    const num = Number(val);
    return Number.isInteger(num) ? `${num}.0` : `${val}`;
  }
  return String(val);
}

function getTypeBadgeStyle(type: string): string {
  switch (type) {
    case 'byte':
    case 'short':
    case 'int':
    case 'long':
      return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
    case 'float':
    case 'double':
      return 'bg-purple-950/80 text-purple-300 border-purple-800/80';
    case 'char':
      return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
    case 'boolean':
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
    case 'String':
      return 'bg-teal-950/80 text-teal-300 border-teal-800/80';
    default:
      if (type.endsWith('[]')) {
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80';
      }
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

interface VisualizationWindowProps {
  currentStep: ExecutionStep | null;
  currentStepIndex: number;
  totalSteps: number;
  onStepIndexChange: (idx: number) => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onReset: () => void;
  onPauseResume: () => void;
  isPlaying: boolean;
  canStepForward: boolean;
  canStepBackward: boolean;
  unsupportedConstructNote?: string;
  capabilityStatus?: VisualizationCapability;
}

export const VisualizationWindow: React.FC<VisualizationWindowProps> = ({
  currentStep,
  currentStepIndex,
  totalSteps,
  onStepIndexChange,
  onStepForward,
  onStepBackward,
  onReset,
  onPauseResume,
  isPlaying,
  canStepForward,
  canStepBackward,
  unsupportedConstructNote,
  capabilityStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'variables' | 'arrays' | 'control'>('all');
  // 2D is the primary default visualization; 3D remains an optional view
  const [is3DEnabled, setIs3DEnabled] = useState<boolean>(false);

  const handleToggle3D = () => {
    setIs3DEnabled((prev) => !prev);
  };

  if (!currentStep) {
    return (
      <div className="flex flex-col h-full bg-[#0b0f19] border-r border-slate-800 text-slate-300">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">Execution Visualizer</span>
          </div>
          {/* 3D Visualization: ON/OFF Button */}
          <button
            onClick={handleToggle3D}
            title="3D Visualization: Toggle ON/OFF. 2D is the default view; enable 3D for spatial algorithmic representation."
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer border ${
              is3DEnabled
                ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/80 shadow-sm shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/80'
            }`}
          >
            <Cuboid className={`w-3.5 h-3.5 ${is3DEnabled ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span>3D Visualization: {is3DEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-4 shadow-xl">
            <Activity className="w-8 h-8 text-cyan-400/80 animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Live Execution Visualization</h3>
          <p className="text-xs max-w-sm text-slate-400 leading-relaxed mb-4">
            Click <strong className="text-emerald-400">Run</strong> in the toolbar above to watch variables mutate, stack frames allocate, and array cells update in real time.
          </p>
          <div className="text-[11px] bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-lg text-slate-400 text-left space-y-1">
            <div className="flex items-center gap-1.5 text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Features in Window 2:</span>
            </div>
            <div>• Real-time variable memory boxes</div>
            <div>• Dynamic mutation transitions (<code className="text-amber-300">marks: 100 → 150</code>)</div>
            <div>• Array heap indexing, comparison & swap animations</div>
            <div>• Call stack frame tracking</div>
            <div>• Optional interactive 3D spatial memory view</div>
          </div>
        </div>
      </div>
    );
  }

  const variablesList: VariableInfo[] = Object.values(currentStep.variables || {});
  const heapArrays = currentStep.heap || [];
  const callStack = currentStep.callStack || [];
  const loopState = currentStep.loopState;
  const branchDecision = currentStep.branchDecision;

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] border-r border-slate-800 text-slate-200 select-none">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 font-semibold text-[11px]">
            <Activity className="w-3.5 h-3.5" />
            <span>Execution Trace</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Line {currentStep.line}
          </span>
          {capabilityStatus && (
            <span
              className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-semibold border ${
                capabilityStatus === 'fully_supported'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : capabilityStatus === 'waiting_for_input'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse'
                  : capabilityStatus === 'partially_supported'
                  ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {capabilityStatus === 'waiting_for_input'
                ? 'Console I/O Active'
                : capabilityStatus === 'fully_supported'
                ? 'Universal Trace'
                : capabilityStatus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 3D Visualization: ON/OFF Button */}
          <button
            onClick={handleToggle3D}
            title="3D Visualization: Toggle ON/OFF. 2D is primary view; turn on 3D for spatial algorithmic engine."
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer border ${
              is3DEnabled
                ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/80 shadow-sm shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/80'
            }`}
          >
            <Cuboid className={`w-3.5 h-3.5 ${is3DEnabled ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
            <span>3D Visualization: {is3DEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Sub-view switcher */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded border border-slate-800 text-[10px]">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeTab === 'all' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeTab === 'variables' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Variables ({variablesList.length})
            </button>
            {heapArrays.length > 0 && (
              <button
                onClick={() => setActiveTab('arrays')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeTab === 'arrays' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Arrays ({heapArrays.length})
              </button>
            )}
            {(loopState || branchDecision) && (
              <button
                onClick={() => setActiveTab('control')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeTab === 'control' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Logic
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline & Step Controller Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-3 py-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onStepBackward}
              disabled={!canStepBackward}
              title="Previous Step"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <StepBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onPauseResume}
              title={isPlaying ? 'Pause' : 'Play'}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 text-amber-400 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
              )}
            </button>
            <button
              onClick={onStepForward}
              disabled={!canStepForward}
              title="Next Step"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <StepForward className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onReset}
              title="Reset Trace"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-cyan-300 font-semibold ml-1">
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Line {currentStep.line}
          </div>
        </div>

        {/* Interactive scrubber slider */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={currentStepIndex}
            onChange={(e) => onStepIndexChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        {/* Current Step Description Banner */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded px-2.5 py-1.5 flex items-start gap-2 shadow-inner">
          <div className="mt-0.5">
            {currentStep.actionType === 'assignment' && <ArrowRight className="w-3.5 h-3.5 text-amber-400" />}
            {currentStep.actionType === 'declaration' && <Box className="w-3.5 h-3.5 text-cyan-400" />}
            {currentStep.actionType === 'branch_condition' && <GitBranch className="w-3.5 h-3.5 text-purple-400" />}
            {currentStep.actionType === 'loop_header' && <Repeat className="w-3.5 h-3.5 text-emerald-400" />}
            {currentStep.actionType === 'print' && <Code2 className="w-3.5 h-3.5 text-blue-400" />}
            {currentStep.actionType === 'method_call' && <Layers className="w-3.5 h-3.5 text-indigo-400" />}
            {currentStep.actionType === 'method_return' && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />}
            {(currentStep.actionType === 'program_start' || currentStep.actionType === 'program_end') && (
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            )}
            {currentStep.actionType === 'error' && <span className="w-2 h-2 rounded-full bg-rose-500 block mt-1" />}
          </div>
          <div className="flex-1 text-[11px] font-sans leading-snug text-slate-200">
            <span className="font-semibold text-cyan-300 mr-1.5">[Line {currentStep.line}]</span>
            {currentStep.description}
          </div>
        </div>
      </div>

      {/* Main Visualization Canvas Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Optional 3D Visualization Canvas (Safe Error-Bounded View) */}
        {is3DEnabled && (
          <ThreeDErrorBoundary onDisable3D={() => setIs3DEnabled(false)}>
            <ThreeDMemoryVisualizer
              currentStep={currentStep}
              currentStepIndex={currentStepIndex}
              totalSteps={totalSteps}
              onTurnOff={() => setIs3DEnabled(false)}
            />
          </ThreeDErrorBoundary>
        )}

        {unsupportedConstructNote && (
          <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-200/90 flex items-start gap-2 shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{unsupportedConstructNote}</div>
          </div>
        )}

        {/* Section 1: Memory & Variables (Stack Frame Locals) */}
        {(activeTab === 'all' || activeTab === 'variables') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Variables in Memory (Stack Frame)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {variablesList.length} active
              </span>
            </div>
            {variablesList.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 text-center text-xs text-slate-500">
                No local variables declared yet in this execution scope.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {variablesList.map((variable) => {
                  const isActive = currentStep.activeVariableKey === variable.name;
                  const hasChanged = variable.hasChanged;
                  return (
                    <div
                      key={variable.name}
                      className={`relative rounded-lg p-3 transition-all duration-300 border ${
                        isActive
                          ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-100">
                            {variable.name}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold ${getTypeBadgeStyle(variable.type)}`}>
                            {variable.type}
                          </span>
                        </div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 bg-slate-950/70 px-1.5 py-0.5 rounded border border-slate-800">
                          {variable.scope}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-800/60">
                        <div className="flex items-center gap-2">
                          {variable.prevValue !== undefined &&
                            variable.prevValue !== variable.value && (
                              <span className="text-xs font-mono line-through text-slate-500">
                                {formatVariableValue(variable.type, variable.prevValue)}
                              </span>
                            )}
                          <span
                            className={`font-mono text-sm font-semibold transition-transform ${
                              hasChanged
                                ? 'text-amber-300 font-bold scale-105'
                                : 'text-emerald-400'
                            }`}
                          >
                            {formatVariableValue(variable.type, variable.value)}
                          </span>
                        </div>
                        {isActive && (
                          <span className="text-[10px] text-cyan-300 bg-cyan-900/60 px-1.5 py-0.5 rounded animate-pulse">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Section 2: Heap & Arrays */}
        {(activeTab === 'all' || activeTab === 'arrays') && heapArrays.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/70">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-blue-400" />
                <span>Heap Memory • Array Objects</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {heapArrays.length} array(s)
              </span>
            </div>
            <div className="space-y-3">
              {heapArrays.map((arr) => {
                const elements = arr.elements || [];
                return (
                  <div
                    key={arr.id}
                    className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-300">{arr.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                          {arr.type} [length: {elements.length}]
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Heap Ref @{arr.id.slice(-6)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {elements.map((elem, idx) => {
                        const isCurrentActive =
                          currentStep.activeArrayKey === arr.name &&
                          currentStep.activeArrayIndex === idx;
                        const isSwapping =
                          arr.swappingIndices &&
                          (arr.swappingIndices[0] === idx || arr.swappingIndices[1] === idx);
                        const isCompared =
                          arr.comparedIndices &&
                          (arr.comparedIndices[0] === idx || arr.comparedIndices[1] === idx);

                        return (
                          <div
                            key={idx}
                            className={`flex flex-col items-center border rounded-md min-w-[50px] transition-all duration-200 ${
                              isSwapping
                                ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/30 scale-105'
                                : isCompared
                                ? 'bg-purple-950/80 border-purple-400 ring-2 ring-purple-500/50 shadow-md shadow-purple-500/20'
                                : isCurrentActive
                                ? 'bg-cyan-950 border-cyan-400 ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/30'
                                : 'bg-slate-950 border-slate-800'
                            }`}
                          >
                            <div className={`w-full text-center py-0.5 text-[9px] font-mono border-b ${
                              isSwapping
                                ? 'text-amber-300 border-amber-800/80 bg-amber-900/40 font-bold'
                                : isCompared
                                ? 'text-purple-300 border-purple-800/80 bg-purple-900/40 font-bold'
                                : 'text-slate-500 border-slate-800/70 bg-slate-900/60'
                            }`}>
                              [{idx}]
                            </div>
                            <div
                              className={`py-1.5 px-2 text-xs font-mono font-bold ${
                                isSwapping
                                  ? 'text-amber-200'
                                  : isCompared
                                  ? 'text-purple-200'
                                  : isCurrentActive
                                  ? 'text-cyan-300'
                                  : 'text-slate-200'
                              }`}
                            >
                              {String(elem)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 3: Control Flow, Branches & Loop Tracker */}
        {(activeTab === 'all' || activeTab === 'control') && (loopState || branchDecision) && (
          <div className="space-y-2 pt-2 border-t border-slate-800/70">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                <span>Control Flow & Decision Logic</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {loopState && (
                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-300 flex items-center gap-1">
                      <Repeat className="w-3.5 h-3.5" />
                      Loop Monitor
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                      Iteration #{loopState.iteration}
                    </span>
                  </div>
                  <div className="text-xs font-mono bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Condition: {loopState.condition}</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                        loopState.willContinue
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {loopState.willContinue ? 'CONTINUE' : 'TERMINATED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{loopState.summary}</p>
                </div>
              )}

              {branchDecision && (
                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-300 flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5" />
                      Branch Evaluation
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        branchDecision.result
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {branchDecision.result ? 'TRUE' : 'FALSE'}
                    </span>
                  </div>
                  <div className="text-xs font-mono bg-slate-950 p-2 rounded border border-slate-800 text-slate-300">
                    {branchDecision.condition} → <strong className="text-cyan-300">{branchDecision.branchTaken}</strong>
                  </div>
                  <p className="text-[11px] text-slate-400">{branchDecision.explanation}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 4: Call Stack */}
        {callStack.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/70">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Call Stack</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {callStack.length} frame(s)
              </span>
            </div>
            <div className="flex flex-col-reverse gap-1.5">
              {callStack.map((frame, index) => (
                <div
                  key={frame.frameId}
                  className={`p-2 rounded border text-xs font-mono flex items-center justify-between ${
                    index === callStack.length - 1
                      ? 'bg-indigo-950/60 border-indigo-700/80 text-indigo-200 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">#{index}</span>
                    <span className="font-bold text-slate-100">
                      {frame.className}.{frame.methodName}()
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Line {frame.line}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
