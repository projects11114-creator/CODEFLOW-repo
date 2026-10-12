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
    <header className="bg-[#101010] border-b border-[#292929] px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 text-[#F5F5F5] select-none shadow-md z-30 shrink-0">
      {/* Top row on mobile / Left group on tablet & PC */}
      <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3 w-full md:w-auto">
        {/* Brand */}
        <button
          type="button"
          onClick={onGoHome}
          title="Return to CodeFlow Landing Page"
          className="flex items-center gap-2 sm:gap-2.5 text-left cursor-pointer hover:opacity-90 transition-opacity shrink-0"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#181818] border border-[#292929] flex items-center justify-center shadow-md">
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#F5F5F5] flex items-center gap-1.5 font-sans">
              CodeFlow <span className="text-[10px] sm:text-xs font-normal text-cyan-400 bg-[#151515] px-1.5 sm:px-2 py-0.5 rounded border border-[#292929] hidden xl:inline-block">(Fast Learning on Windows)</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-[#A0A0A0] -mt-0.5 hidden 2xl:block">BCA College Project • Live Execution Visualizer</p>
          </div>
        </button>

        <div className="h-5 w-px bg-[#292929] mx-1 hidden lg:block" />

        {/* Mobile-only right quick actions */}
        <div className="flex md:hidden items-center gap-1.5">
          {onCreateProject && (
            <button
              onClick={onCreateProject}
              title="Create New Project / Program File"
              className="p-1.5 rounded-md text-xs bg-[#181818] hover:bg-[#242424] border border-[#292929] text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onOpenSaveModal}
            title="Save Project locally"
            className="p-1.5 rounded-md text-xs bg-[#181818] hover:bg-[#242424] border border-[#292929] text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenLoadModal}
            title="Open Saved Project or .java file"
            className="p-1.5 rounded-md text-xs bg-[#181818] hover:bg-[#242424] border border-[#292929] text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenGuideModal}
            title="BCA Project Guide"
            className="p-1.5 rounded-md text-xs bg-[#181818] hover:bg-[#242424] border border-[#292929] text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Language & Program Selector (Desktop / Tablet view) */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#151515] border border-[#292929] hover:border-[#383838] text-[#F5F5F5] transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Java</span>
              <ChevronDown className="w-3 h-3 text-[#A0A0A0]" />
            </button>
            <div className="absolute left-0 mt-1 w-44 rounded-md shadow-2xl bg-[#101010] border border-[#292929] p-1 hidden group-hover:block z-50 text-xs">
              <div className="px-2 py-1.5 font-semibold text-[#F5F5F5] flex items-center justify-between">
                <span>Java SE</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1 rounded border border-emerald-800">Active</span>
              </div>
              <div className="px-2 py-1.5 text-[#555555] flex items-center justify-between cursor-not-allowed">
                <span>Python</span>
                <span className="text-[10px] bg-[#181818] text-[#777777] px-1 rounded border border-[#292929]">Coming Soon</span>
              </div>
              <div className="px-2 py-1.5 text-[#555555] flex items-center justify-between cursor-not-allowed">
                <span>C++</span>
                <span className="text-[10px] bg-[#181818] text-[#777777] px-1 rounded border border-[#292929]">Coming Soon</span>
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
              className="bg-[#151515] hover:bg-[#1a1a1a] border border-[#292929] hover:border-[#383838] rounded-md px-2.5 py-1 text-xs text-[#F5F5F5] cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[150px] lg:max-w-[190px] xl:max-w-[220px] truncate transition-colors"
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

      {/* Middle row on mobile / Middle & Right groups on tablet/PC */}
      <div className="flex items-center justify-between md:justify-center gap-1.5 sm:gap-2 w-full md:w-auto overflow-x-auto no-scrollbar py-0.5">
        {/* Mobile Program Selector */}
        <div className="flex md:hidden items-center shrink-0">
          <select
            aria-label="Select sample program"
            value={selectedSampleId}
            onChange={(e) => {
              const sample = SAMPLE_PROGRAMS.find((s) => s.id === e.target.value);
              if (sample) onSelectSample(sample);
            }}
            className="bg-[#151515] border border-[#292929] rounded-md px-2 py-1.5 text-xs text-[#F5F5F5] cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[130px] xs:max-w-[160px] truncate"
          >
            <optgroup label="DSA Algorithms">
              {SAMPLE_PROGRAMS.filter((s) => s.id.startsWith('dsa-')).map((sample) => (
                <option key={sample.id} value={sample.id}>
                  {sample.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Java Concepts">
              {SAMPLE_PROGRAMS.filter((s) => !s.id.startsWith('dsa-')).map((sample) => (
                <option key={sample.id} value={sample.id}>
                  {sample.title}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Execution Controls Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-[#151515] p-1 rounded-lg border border-[#292929] shrink-0">
          {/* Run or Stop Button */}
          {isProcessRunning ? (
            <button
              onClick={onStopProcess}
              title="Stop running Java process"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-700/30 transition-colors animate-pulse cursor-pointer shrink-0"
            >
              <Square className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={onRun}
              title="Compile and Run Java Code (F5)"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-700/30 transition-colors cursor-pointer shrink-0"
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              <span>Run</span>
            </button>
          )}

          {/* Pause / Resume */}
          {hasTrace && (
            <button
              onClick={onPauseResume}
              title={isPlaying ? 'Pause auto-play' : 'Resume auto-play'}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md text-xs font-medium bg-[#1f1f1f] hover:bg-[#282828] border border-[#292929] text-[#F5F5F5] transition-colors shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current text-amber-400" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current text-cyan-400" />
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
            className="p-1 sm:p-1.5 rounded-md text-xs font-medium bg-[#1f1f1f] hover:bg-[#282828] border border-[#292929] text-[#F5F5F5] disabled:opacity-30 disabled:text-[#555555] disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <StepBack className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>

          {/* Step Forward */}
          <button
            onClick={onStepForward}
            disabled={!canStepForward}
            title="Step Forward (Next State)"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md text-xs font-medium bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-200 disabled:opacity-30 disabled:text-[#555555] disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <StepForward className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Step</span>
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            disabled={!hasTrace}
            title="Reset Execution to Step 1"
            className="p-1 sm:p-1.5 rounded-md text-xs font-medium bg-[#1f1f1f] hover:bg-[#282828] border border-[#292929] text-[#A0A0A0] hover:text-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>

          {/* Clear Code */}
          <button
            onClick={onClear}
            title="Clear editor code"
            className="p-1 sm:p-1.5 rounded-md text-xs font-medium bg-[#1f1f1f] hover:bg-[#282828] border border-[#292929] text-[#A0A0A0] hover:text-rose-400 transition-colors shrink-0"
          >
            <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>

          {/* Speed Selector */}
          {hasTrace && (
            <div className="flex items-center gap-1 border-l border-[#292929] pl-1.5 sm:pl-2 ml-0.5 shrink-0">
              <span className="text-[10px] text-[#A0A0A0] hidden lg:inline">Speed:</span>
              <select
                aria-label="Execution replay speed"
                value={speed}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                className="bg-[#181818] border border-[#292929] rounded px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] text-[#F5F5F5] focus:outline-none"
              >
                <option value={1500}>0.5x</option>
                <option value={800}>1x</option>
                <option value={400}>2x</option>
                <option value={150}>5x</option>
              </select>
            </div>
          )}
        </div>

        {/* Mobile Step Badge */}
        {hasTrace && (
          <div className="md:hidden text-[10px] font-mono px-2 py-1 rounded bg-[#151515] border border-[#292929] text-cyan-400 shrink-0">
            {currentStepIndex + 1}/{totalSteps}
          </div>
        )}
      </div>

      {/* Desktop / Tablet Right Actions & Status */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        {/* Step indicator tag */}
        {hasTrace && (
          <div className="text-[11px] font-mono px-2 py-1 rounded bg-[#151515] border border-[#292929] text-cyan-400 hidden xl:block">
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
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#151515] border border-[#292929] text-[11px] text-[#A0A0A0] cursor-help"
        >
          <Cpu className={`w-3.5 h-3.5 ${systemStatus.javacAvailable ? 'text-emerald-400' : 'text-cyan-400'}`} />
          <span className="hidden xl:inline">{systemStatus.javacAvailable ? 'Host JDK Active' : 'AST Tracer Engine'}</span>
        </div>

        {/* Create Project / Save / Open Project */}
        {onCreateProject && (
          <button
            onClick={onCreateProject}
            title="Create New Project / Program File"
            className="p-1.5 rounded-md text-xs font-medium bg-[#181818] hover:bg-[#242424] border border-[#292929] text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onOpenSaveModal}
          title="Save Project locally"
          className="p-1.5 rounded-md text-xs font-medium bg-[#181818] hover:bg-[#242424] border border-[#292929] text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenLoadModal}
          title="Open Saved Project or .java file"
          className="p-1.5 rounded-md text-xs font-medium bg-[#181818] hover:bg-[#242424] border border-[#292929] text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        {/* BCA College Project Guide Modal */}
        <button
          onClick={onOpenGuideModal}
          title="College Project Documentation & Windows Setup Guide"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#181818] hover:bg-[#242424] border border-[#292929] hover:border-[#383838] text-[#F5F5F5] transition-colors shadow-sm cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden lg:inline">BCA Guide</span>
        </button>
      </div>
    </header>
  );
};
