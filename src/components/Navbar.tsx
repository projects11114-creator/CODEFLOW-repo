import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  StepBack,
  Trash2,
  Save,
  FolderOpen,
  HelpCircle,
  Cpu,
  Layers,
  ChevronDown,
  Square,
  Plus,
} from 'lucide-react';
import { SampleProgram } from '../engine/types.ts';
import { SAMPLE_PROGRAMS } from '../engine/samples.ts';

interface NavbarProps {
  onRun: () => void;
  onPauseResume: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onReset: () => void;
  onClear: () => void;
  isPlaying: boolean;
  canStepForward: boolean;
  canStepBackward: boolean;
  hasTrace: boolean;
  currentStepIndex: number;
  totalSteps: number;
  speed: number;
  onSpeedChange: (speed: number) => void;
  selectedSampleId: string;
  onSelectSample: (sample: SampleProgram) => void;
  onOpenSaveModal: () => void;
  onOpenLoadModal: () => void;
  onOpenGuideModal: () => void;
  systemStatus: {
    javacAvailable: boolean;
    javacVersion: string;
    geminiConfigured: boolean;
  };
  isProcessRunning?: boolean;
  onStopProcess?: () => void;
  onGoHome?: () => void;
  onCreateProject?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRun,
  onPauseResume,
  onStepForward,
  onStepBackward,
  onReset,
  onClear,
  isPlaying,
  canStepForward,
  canStepBackward,
  hasTrace,
  currentStepIndex,
  totalSteps,
  speed,
  onSpeedChange,
  selectedSampleId,
  onSelectSample,
  onOpenSaveModal,
  onOpenLoadModal,
  onOpenGuideModal,
  systemStatus,
  isProcessRunning = false,
  onStopProcess,
  onGoHome,
  onCreateProject,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-slate-100 select-none shadow-md z-30">
      {/* Brand & Language */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onGoHome}
          title="Return to CodeFlow Landing Page"
          className="flex items-center gap-2.5 text-left cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-cyan-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
              CodeFlow <span className="text-xs font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 hidden sm:inline-block">(Fast Learning on Windows)</span>
            </h1>
            <p className="text-[10px] text-slate-400 -mt-0.5 hidden md:block">BCA College Project • Live Execution Visualizer</p>
          </div>
        </button>
        <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />
        {/* Language selector */}
        <div className="flex items-center gap-1.5">
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Java</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <div className="absolute left-0 mt-1 w-44 rounded-md shadow-xl bg-slate-900 border border-slate-800 p-1 hidden group-hover:block z-50 text-xs">
              <div className="px-2 py-1.5 font-semibold text-slate-300 flex items-center justify-between">
                <span>Java SE</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1 rounded">Active</span>
              </div>
              <div className="px-2 py-1.5 text-slate-500 flex items-center justify-between cursor-not-allowed">
                <span>Python</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded">Coming Soon</span>
              </div>
              <div className="px-2 py-1.5 text-slate-500 flex items-center justify-between cursor-not-allowed">
                <span>C++</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded">Coming Soon</span>
              </div>
            </div>
          </div>
          {/* Sample programs dropdown */}
          <div className="relative">
            <select
              aria-label="Select sample program"
              value={selectedSampleId}
              onChange={(e) => {
                const sample = SAMPLE_PROGRAMS.find((s) => s.id === e.target.value);
                if (sample) onSelectSample(sample);
              }}
              className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-md px-2.5 py-1 text-xs text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[170px] sm:max-w-[210px] truncate"
            >
              <optgroup label="DSA Algorithms (Scanner Array Input)">
                {SAMPLE_PROGRAMS.filter((s) => s.id.startsWith('dsa-')).map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Java Language Concepts">
                {SAMPLE_PROGRAMS.filter((s) => !s.id.startsWith('dsa-')).map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* Execution Controls (Middle Toolbar) */}
      <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
        {/* Run or Stop Button */}
        {isProcessRunning ? (
          <button
            onClick={onStopProcess}
            title="Stop running Java process"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-700/30 transition-colors animate-pulse cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            onClick={onRun}
            title="Compile and Run Java Code (F5)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-700/30 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run</span>
          </button>
        )}

        {/* Pause / Resume */}
        {hasTrace && (
          <button
            onClick={onPauseResume}
            title={isPlaying ? 'Pause auto-play' : 'Resume auto-play'}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-cyan-400" />
                <span className="hidden sm:inline">Play</span>
              </>
            )}
          </button>
        )}

        {/* Step Backward */}
        <button
          onClick={onStepBackward}
          disabled={!canStepBackward}
          title="Step Backward (Previous State)"
          className="p-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <StepBack className="w-3.5 h-3.5" />
        </button>

        {/* Step Forward */}
        <button
          onClick={onStepForward}
          disabled={!canStepForward}
          title="Step Forward (Next State)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-cyan-900/60 hover:bg-cyan-800/80 text-cyan-200 border border-cyan-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <StepForward className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Step</span>
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          disabled={!hasTrace}
          title="Reset Execution to Step 1"
          className="p-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Clear Code */}
        <button
          onClick={onClear}
          title="Clear editor code"
          className="p-1.5 rounded-md text-xs font-medium bg-slate-800/60 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Speed Selector */}
        {hasTrace && (
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2 ml-1">
            <span className="text-[10px] text-slate-400 hidden md:inline">Speed:</span>
            <select
              aria-label="Execution replay speed"
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none"
            >
              <option value={1500}>0.5x</option>
              <option value={800}>1x</option>
              <option value={400}>2x</option>
              <option value={150}>5x</option>
            </select>
          </div>
        )}
      </div>

      {/* Right Actions & Status */}
      <div className="flex items-center gap-2">
        {/* Step indicator tag */}
        {hasTrace && (
          <div className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800/80 border border-slate-700 text-cyan-300 hidden md:block">
            Step {currentStepIndex + 1}/{totalSteps}
          </div>
        )}

        {/* JVM status indicator */}
        <div
          title={
            systemStatus.javacAvailable
              ? `Real JDK detected: ${systemStatus.javacVersion}`
              : 'Using High-Precision Java AST Tracer Engine'
          }
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/70 border border-slate-700/60 text-[11px] text-slate-300 cursor-help"
        >
          <Cpu className={`w-3.5 h-3.5 ${systemStatus.javacAvailable ? 'text-emerald-400' : 'text-cyan-400'}`} />
          <span className="hidden xl:inline">{systemStatus.javacAvailable ? 'Host JDK Active' : 'AST Tracer Engine'}</span>
        </div>

        {/* Create Project / Save / Open Project */}
        {onCreateProject && (
          <button
            onClick={onCreateProject}
            title="Create New Project / Program File"
            className="p-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onOpenSaveModal}
          title="Save Project locally"
          className="p-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenLoadModal}
          title="Open Saved Project or .java file"
          className="p-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        {/* BCA College Project Guide Modal */}
        <button
          onClick={onOpenGuideModal}
          title="College Project Documentation & Windows Setup Guide"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 transition-colors shadow-sm"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">BCA Guide</span>
        </button>
      </div>
    </header>
  );
};
