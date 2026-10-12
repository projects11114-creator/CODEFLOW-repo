import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  FileCode,
  Check,
  Clock,
  Play,
  FolderOpen,
  Info,
  CheckCircle2,
  Code2,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { SAMPLE_PROGRAMS } from '../engine/samples.ts';

interface CreateProjectPageProps {
  onCreateProject: (initialCode: string, sampleId?: string, fileName?: string) => void;
  onCancel: () => void;
  onOpenExisting: () => void;
}

export const CreateProjectPage: React.FC<CreateProjectPageProps> = ({
  onCreateProject,
  onCancel,
  onOpenExisting,
}) => {
  const [fileName, setFileName] = useState<string>('Main.java');
  const [selectedLanguage, setSelectedLanguage] = useState<'java' | 'python' | 'cpp'>('java');
  const [templateType, setTemplateType] = useState<'dsa' | 'blank' | 'scanner' | 'oop'>('dsa');
  const [selectedDsaId, setSelectedDsaId] = useState<string>('dsa-bubble-sort');
  const [isDsaDropdownOpen, setIsDsaDropdownOpen] = useState<boolean>(false);
  const dsaDropdownRef = useRef<HTMLDivElement>(null);

  // Close custom dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dsaDropdownRef.current && !dsaDropdownRef.current.contains(event.target as Node)) {
        setIsDsaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const dsaPrograms = SAMPLE_PROGRAMS.filter((s) => s.id.startsWith('dsa-'));

  // Get current initial code based on selection
  const getInitialCode = (): string => {
    if (templateType === 'dsa') {
      const prog = SAMPLE_PROGRAMS.find((s) => s.id === selectedDsaId);
      return prog ? prog.code : SAMPLE_PROGRAMS[0].code;
    }

    if (templateType === 'blank') {
      const className = fileName.replace(/\.java$/, '').trim() || 'Main';
      return `public class ${className} {\n    public static void main(String[] args) {\n        System.out.println("Hello from ${className}!");\n    }\n}\n`;
    }

    if (templateType === 'scanner') {
      const className = fileName.replace(/\.java$/, '').trim() || 'Main';
      return `import java.util.Scanner;\n\npublic class ${className} {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.print("Enter your name: ");\n        String name = sc.nextLine();\n        System.out.print("Enter an integer: ");\n        int num = sc.nextInt();\n        \n        System.out.println("Hello " + name + ", your value is: " + num);\n    }\n}\n`;
    }

    if (templateType === 'oop') {
      const className = fileName.replace(/\.java$/, '').trim() || 'Main';
      return `class Student {\n    String name;\n    int rollNo;\n    int marks;\n\n    Student(String name, int rollNo, int marks) {\n        this.name = name;\n        this.rollNo = rollNo;\n        this.marks = marks;\n    }\n\n    void display() {\n        System.out.println("Student: " + name + " | Roll: " + rollNo + " | Marks: " + marks);\n    }\n}\n\npublic class ${className} {\n    public static void main(String[] args) {\n        Student s1 = new Student("Alex", 101, 88);\n        Student s2 = new Student("Priya", 102, 94);\n        s1.display();\n        s2.display();\n    }\n}\n`;
    }

    return SAMPLE_PROGRAMS[0].code;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    let finalFileName = fileName.trim();
    if (!finalFileName) finalFileName = 'Main.java';
    if (!finalFileName.endsWith('.java')) {
      finalFileName += '.java';
    }

    const code = getInitialCode();
    const sampleId = templateType === 'dsa' ? selectedDsaId : undefined;
    onCreateProject(code, sampleId, finalFileName);
  };

  return (
    <div className="h-screen w-full overflow-y-auto bg-black text-white flex flex-col font-sans selection:bg-neutral-800 selection:text-white antialiased">
      {/* Top Header - Minimal & Aligned */}
      <header className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-[#222222] bg-black sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-[#242424] hover:bg-[#323232] border border-[#444444] hover:border-[#555555] rounded-md transition-colors cursor-pointer"
            title="Back to Landing Page"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <span className="text-[11px] sm:text-xs uppercase font-bold tracking-widest text-neutral-300 truncate max-w-[150px] xs:max-w-none">
            Create Project / Program File
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenExisting}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-[#242424] hover:bg-[#323232] border border-[#444444] hover:border-[#555555] rounded-md transition-colors cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden xs:inline">Open Existing File</span>
          <span className="xs:hidden">Open File</span>
        </button>
      </header>

      {/* Main Form Container - Centered Card */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8 pb-16">
        <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-8 shadow-2xl">
          <form onSubmit={handleCreate} className="space-y-6">
            {/* Step 1: Program File Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="fileNameInput" className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-neutral-400" />
                  1. Program File &amp; Class Name
                </label>
                <span className="text-[11px] font-mono text-neutral-300 bg-[#242424] px-2 py-0.5 rounded border border-[#383838]">
                  .java
                </span>
              </div>

              <input
                id="fileNameInput"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Main.java"
                className="w-full px-3.5 py-2.5 rounded-md bg-[#1a1a1a] border border-[#383838] focus:border-[#666666] text-white font-mono text-sm outline-none transition-colors placeholder:text-neutral-600"
                required
              />
              <p className="text-[11px] text-neutral-400">
                Specify your Java source file name (e.g. <code>Main.java</code> or <code>BubbleSort.java</code>)
              </p>
            </div>

            {/* Step 2: Language Selection (Java Active, Python Disabled & Coming Soon) */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-neutral-400" />
                2. Select Language
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Java - Active */}
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('java')}
                  className={`p-3.5 rounded-md border text-left transition-colors cursor-pointer ${
                    selectedLanguage === 'java'
                      ? 'bg-[#242424] border-[#666666] text-white'
                      : 'bg-[#181818] border-[#333333] text-neutral-400 hover:border-[#444444]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-white">Java SE</span>
                    <span className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-tight mb-2">
                    OpenJDK execution, 3D memory canvas, runtime Scanner array input.
                  </p>
                  <span className="text-[10px] text-neutral-200 bg-[#303030] border border-[#484848] px-2 py-0.5 rounded font-medium inline-block">
                    Active
                  </span>
                </button>

                {/* Python - Disabled & Coming Soon */}
                <div
                  aria-disabled="true"
                  className="p-3.5 rounded-md border border-[#282828] bg-[#141414] text-left opacity-50 cursor-not-allowed select-none"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-neutral-400">Python</span>
                    <span className="text-[10px] font-medium text-neutral-400 bg-[#242424] border border-[#383838] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Coming Soon
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-tight mb-2">
                    Python tracer and stack visualizer.
                  </p>
                  <span className="text-[10px] text-neutral-500 bg-[#1c1c1c] px-2 py-0.5 rounded font-medium inline-block">
                    Disabled
                  </span>
                </div>

                {/* C++ - Disabled & Coming Soon */}
                <div
                  aria-disabled="true"
                  className="p-3.5 rounded-md border border-[#282828] bg-[#141414] text-left opacity-50 cursor-not-allowed select-none"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-neutral-400">C++</span>
                    <span className="text-[10px] font-medium text-neutral-400 bg-[#242424] border border-[#383838] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Coming Soon
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-tight mb-2">
                    Pointer visualizer &amp; GCC compilation.
                  </p>
                  <span className="text-[10px] text-neutral-500 bg-[#1c1c1c] px-2 py-0.5 rounded font-medium inline-block">
                    Disabled
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Starter Template Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-400" />
                3. Choose Starter Template or DSA Algorithm
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Template: DSA Algorithm */}
                <button
                  type="button"
                  onClick={() => setTemplateType('dsa')}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                    templateType === 'dsa'
                      ? 'bg-[#242424] border-[#666666] text-white'
                      : 'bg-[#181818] border-[#333333] text-neutral-400 hover:border-[#444444]'
                  }`}
                >
                  <div className="font-semibold text-xs text-white mb-1">DSA Algorithm</div>
                  <div className="text-[10px] text-neutral-400 leading-tight">
                    8 sorting &amp; searching programs
                  </div>
                </button>

                {/* Template: Blank Java Class */}
                <button
                  type="button"
                  onClick={() => setTemplateType('blank')}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                    templateType === 'blank'
                      ? 'bg-[#242424] border-[#666666] text-white'
                      : 'bg-[#181818] border-[#333333] text-neutral-400 hover:border-[#444444]'
                  }`}
                >
                  <div className="font-semibold text-xs text-white mb-1">Blank Class</div>
                  <div className="text-[10px] text-neutral-400 leading-tight">
                    Empty <code>main</code> method
                  </div>
                </button>

                {/* Template: Scanner Input */}
                <button
                  type="button"
                  onClick={() => setTemplateType('scanner')}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                    templateType === 'scanner'
                      ? 'bg-[#242424] border-[#666666] text-white'
                      : 'bg-[#181818] border-[#333333] text-neutral-400 hover:border-[#444444]'
                  }`}
                >
                  <div className="font-semibold text-xs text-white mb-1">Scanner Input</div>
                  <div className="text-[10px] text-neutral-400 leading-tight">
                    Interactive user console input
                  </div>
                </button>

                {/* Template: OOP Class */}
                <button
                  type="button"
                  onClick={() => setTemplateType('oop')}
                  className={`p-3 rounded-md border text-left transition-colors cursor-pointer ${
                    templateType === 'oop'
                      ? 'bg-[#242424] border-[#666666] text-white'
                      : 'bg-[#181818] border-[#333333] text-neutral-400 hover:border-[#444444]'
                  }`}
                >
                  <div className="font-semibold text-xs text-white mb-1">OOP Class</div>
                  <div className="text-[10px] text-neutral-400 leading-tight">
                    Objects &amp; constructors
                  </div>
                </button>
              </div>

              {/* Sub-selector if DSA is chosen */}
              {templateType === 'dsa' && (
                <div className="p-3.5 rounded-md bg-[#161616] border border-[#2e2e2e] space-y-2.5 mt-2">
                  <label htmlFor="dsaAlgorithmSelect" className="text-xs font-medium text-neutral-300 block">
                    Select Specific DSA Algorithm (Accepts User Input at Runtime):
                  </label>

                  {/* Accessible, scrollable custom dropdown */}
                  <div ref={dsaDropdownRef} className="relative w-full">
                    <button
                      type="button"
                      id="dsaAlgorithmSelect"
                      aria-haspopup="listbox"
                      aria-expanded={isDsaDropdownOpen}
                      onClick={() => setIsDsaDropdownOpen((prev) => !prev)}
                      className="w-full px-3 py-2 rounded-md bg-[#1f1f1f] border border-[#3c3c3c] text-xs text-white flex items-center justify-between gap-2 outline-none focus:border-[#666666] hover:border-[#555555] transition-colors cursor-pointer text-left"
                    >
                      <span className="truncate font-medium">
                        {dsaPrograms.find((p) => p.id === selectedDsaId)?.title || 'Select DSA Algorithm'}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 ${
                          isDsaDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Scrollable dropdown options menu */}
                    {isDsaDropdownOpen && (
                      <div
                        role="listbox"
                        aria-labelledby="dsaAlgorithmSelect"
                        className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-56 overflow-y-auto rounded-md bg-[#1a1a1a] border border-[#3c3c3c] shadow-2xl divide-y divide-[#262626] focus:outline-none scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900"
                        style={{
                          maxHeight: '14rem',
                          overflowY: 'auto',
                        }}
                      >
                        {dsaPrograms.map((p) => {
                          const isSelected = p.id === selectedDsaId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedDsaId(p.id);
                                setIsDsaDropdownOpen(false);
                                if (p.id.includes('bubble')) setFileName('BubbleSort.java');
                                else if (p.id.includes('selection')) setFileName('SelectionSort.java');
                                else if (p.id.includes('insertion')) setFileName('InsertionSort.java');
                                else if (p.id.includes('merge')) setFileName('MergeSort.java');
                                else if (p.id.includes('quick')) setFileName('QuickSort.java');
                                else if (p.id.includes('heap')) setFileName('HeapSort.java');
                                else if (p.id.includes('linear')) setFileName('LinearSearch.java');
                                else if (p.id.includes('binary')) setFileName('BinarySearch.java');
                              }}
                              className={`w-full px-3 py-2.5 text-xs text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#2a2a2a] text-white font-medium'
                                  : 'text-neutral-300 hover:bg-[#222222] hover:text-white'
                              }`}
                            >
                              <span className="truncate">{p.title}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-neutral-300 shrink-0 stroke-[2.5]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {(() => {
                    const sel = SAMPLE_PROGRAMS.find((s) => s.id === selectedDsaId);
                    return sel ? (
                      <div className="flex items-start gap-2 text-xs text-neutral-400 bg-[#1a1a1a] p-2.5 rounded border border-[#2c2c2c]">
                        <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">{sel.description}</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Code Preview Box */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-mono text-neutral-300">Initial Code Preview:</span>
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" /> Validated Java Syntax
                  </span>
                </div>
                <pre className="p-3.5 rounded-md bg-[#0d0d0d] border border-[#262626] font-mono text-xs text-neutral-300 overflow-auto max-h-52 leading-relaxed">
                  {getInitialCode()}
                </pre>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#262626]">
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-5 py-2.5 rounded-md text-xs font-medium text-neutral-300 hover:text-white bg-[#242424] hover:bg-[#323232] border border-[#444444] hover:border-[#555555] transition-colors cursor-pointer text-center"
              >
                Cancel &amp; Return to Home
              </button>

              <button
                type="submit"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-md text-xs font-medium text-white bg-[#242424] hover:bg-[#323232] border border-[#555555] hover:border-[#777777] transition-colors cursor-pointer shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current text-neutral-300" />
                <span>Create Program &amp; Open in Java IDE</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
