import React from 'react';
import { X, CheckCircle2, Terminal, BookOpen, HelpCircle, Laptop, ArrowRight } from 'lucide-react';

interface CollegeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CollegeGuideModal: React.FC<CollegeGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg max-w-3xl w-full max-h-[92dvh] flex flex-col shadow-2xl text-neutral-200 font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-[#222222] bg-[#161616]">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#242424] border border-[#444444] flex items-center justify-center text-neutral-200 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                BCA College Project Guide &amp; Windows Setup
              </h2>
              <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate max-w-[200px] xs:max-w-none">
                CodeFlow (Fast Learning on Windows) - Project Defense Manual
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#242424] text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 text-xs leading-relaxed select-text bg-[#121212]">
          {/* Section 1: Project Overview */}
          <div className="p-4 rounded-lg bg-[#181818] border border-[#2a2a2a] space-y-2">
            <h3 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-neutral-400" />
              1. Project Title & Abstract
            </h3>
            <p className="text-neutral-300">
              <strong className="text-white">Project Title:</strong> CodeFlow (Fast Learning on Windows)
            </p>
            <p className="text-neutral-400 leading-relaxed">
              CodeFlow is an educational Integrated Development Environment (IDE) built specifically for undergraduate Computer Applications (BCA) students. It solves a primary pedagogical problem: traditional compilers present black-box text execution and cryptic compiler errors. CodeFlow provides three simultaneous synchronized windows (Code Editor, Live Execution Visualizer, and Output/Error Assistant) to render memory states, call stack frames, loop iterations, and one-click diagnostic fixes.
            </p>
          </div>

          {/* Section 2: Windows Setup Instructions */}
          <div className="p-4 rounded-lg bg-[#181818] border border-[#2a2a2a] space-y-3">
            <h3 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-neutral-400" />
              2. How to Run CodeFlow on Windows (Step-by-Step)
            </h3>
            <div className="space-y-2 font-mono text-[11px] text-neutral-300">
              <div className="p-2.5 rounded-md bg-[#0d0d0d] border border-[#262626]">
                <span className="text-neutral-400 block mb-1"># Step 1: Install OpenJDK (Java 17 or 21)</span>
                Download OpenJDK from Adoptium (Eclipse Temurin) or Oracle JDK. Ensure &quot;Add to PATH&quot; checkbox is checked during installation.
              </div>
              <div className="p-2.5 rounded-md bg-[#0d0d0d] border border-[#262626]">
                <span className="text-neutral-400 block mb-1"># Step 2: Verify in Windows Command Prompt (cmd)</span>
                <code className="text-neutral-200 bg-[#1c1c1c] px-1.5 py-0.5 rounded border border-[#333333]">javac -version</code><br className="my-1" />
                <code className="text-neutral-200 bg-[#1c1c1c] px-1.5 py-0.5 rounded border border-[#333333]">node -v</code>
              </div>
              <div className="p-2.5 rounded-md bg-[#0d0d0d] border border-[#262626]">
                <span className="text-neutral-400 block mb-1"># Step 3: Run CodeFlow</span>
                <code className="text-neutral-200 bg-[#1c1c1c] px-1.5 py-0.5 rounded border border-[#333333]">npm install</code><br className="my-1" />
                <code className="text-neutral-200 bg-[#1c1c1c] px-1.5 py-0.5 rounded border border-[#333333]">npm run dev</code>
              </div>
            </div>
          </div>

          {/* Section 3: Demonstration Script for Your College Project Guide */}
          <div className="p-4 rounded-lg bg-[#181818] border border-[#2a2a2a] space-y-2.5">
            <h3 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-neutral-400" />
              3. Demonstration Script for Your College Project Guide
            </h3>
            <ol className="list-decimal pl-4 space-y-1.5 text-neutral-300 text-[11px] leading-relaxed">
              <li>
                <strong className="text-white">Demo 1: Variable Mutation (User Spec)</strong> - Select Sample 1 (<code className="text-neutral-200 bg-[#1c1c1c] px-1 py-0.5 rounded border border-[#333333]">int x = 100; x = 200;</code>). Click <em>Run</em> and watch x dynamically change from 100 to 200 in the memory card with animated transition and output 200.
              </li>
              <li>
                <strong className="text-white">Demo 2: Control Flow & Loops</strong> - Load Sample 4 (For Loop Accumulator) or Sample 7 (Bubble Sort). Step forward through the loop and show the guide the loop iteration counter and array element swapping in the heap.
              </li>
              <li>
                <strong className="text-white">Demo 3: Error Assistant & One-Click Fix</strong> - Load Sample 9 (<code className="text-neutral-200 bg-[#1c1c1c] px-1 py-0.5 rounded border border-[#333333]">int name = &quot;user&quot;;</code>). Show the Error Assistant tab classifying it as a <em className="text-white font-medium">TYPE MISMATCH</em> with beginner explanation. Click <strong className="text-white">Apply Fix to Editor</strong> to show automatic code repair!
              </li>
              <li>
                <strong className="text-white">Demo 4: Local Persistence</strong> - Save the project using the Save button, reload, and demonstrate project persistence.
              </li>
            </ol>
          </div>

          {/* Section 4: Viva-Voce Questions & Model Answers */}
          <div className="p-4 rounded-lg bg-[#181818] border border-[#2a2a2a] space-y-3">
            <h3 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-neutral-400" />
              4. Expected Viva-Voce Questions & Model Answers
            </h3>
            
            <div className="space-y-2.5 text-[11px]">
              <div className="p-2.5 rounded-md bg-[#0d0d0d] border border-[#262626]">
                <p className="font-semibold text-white mb-1">Q1: How does CodeFlow animate program execution without recorded videos?</p>
                <p className="text-neutral-400 leading-relaxed">
                  <strong className="text-neutral-200">Answer:</strong> CodeFlow uses an AST-driven execution instrumenter. On each evaluation step, it captures an immutable snapshot of local variables, call stack frames, heap arrays, and console buffers, producing an execution trace array synchronized with Monaco Editor decorations.
                </p>
              </div>

              <div className="p-2.5 rounded-md bg-[#0d0d0d] border border-[#262626]">
                <p className="font-semibold text-white mb-1">Q2: Does it support genuine Java compiler execution?</p>
                <p className="text-neutral-400 leading-relaxed">
                  <strong className="text-neutral-200">Answer:</strong> Yes. The Node.js Express backend directly invokes the host Java compiler (<code className="text-neutral-200 bg-[#1c1c1c] px-1 py-0.5 rounded border border-[#333333]">javac</code>) and Java Virtual Machine (<code className="text-neutral-200 bg-[#1c1c1c] px-1 py-0.5 rounded border border-[#333333]">java</code>) when available, while the AST engine ensures seamless client-side visualization on any host.
                </p>
              </div>

              <div className="p-2.5 rounded-md bg-[#0d0d0d] border border-[#262626]">
                <p className="font-semibold text-white mb-1">Q3: How are future languages (Python, C++) supported?</p>
                <p className="text-neutral-400 leading-relaxed">
                  <strong className="text-neutral-200">Answer:</strong> CodeFlow is architected with a decoupled language driver interface (<code className="text-neutral-200 bg-[#1c1c1c] px-1 py-0.5 rounded border border-[#333333]">ExecutionEngine</code>). Adding Python or C++ requires only plugging in their respective parser/tracer driver into the unified three-window pipeline.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#222222] bg-[#161616] flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#242424] hover:bg-[#323232] border border-[#444444] hover:border-[#555555] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>Close Manual</span>
            <ArrowRight className="w-3.5 h-3.5 text-neutral-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
