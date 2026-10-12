import React, { useState, useEffect } from 'react';
import { X, Save, FolderOpen, Download, Upload, Trash2, Clock, FileCode } from 'lucide-react';

export interface SavedProject {
  id: string;
  name: string;
  code: string;
  updatedAt: string;
}

interface SaveOpenModalProps {
  isOpen: boolean;
  mode: 'save' | 'open';
  onClose: () => void;
  currentCode: string;
  onLoadCode: (code: string, projectName: string) => void;
}

const STORAGE_KEY = 'codeflow_saved_projects_v1';

export const SaveOpenModal: React.FC<SaveOpenModalProps> = ({
  isOpen,
  mode,
  onClose,
  currentCode,
  onLoadCode,
}) => {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [projectName, setProjectName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setProjects(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
      setSaveSuccess(false);
      if (mode === 'save' && !projectName) {
        setProjectName('MyProject_' + new Date().toLocaleDateString().replace(/\//g, '-'));
      }
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!projectName.trim()) return;
    const newProject: SavedProject = {
      id: 'proj_' + Date.now(),
      name: projectName.trim(),
      code: currentCode,
      updatedAt: new Date().toLocaleString(),
    };
    const updated = [newProject, ...projects.filter((p) => p.name !== projectName.trim())];
    setProjects(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportJava = () => {
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (projectName || 'Main') + '.java';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const name = file.name.replace(/\.java$/, '');
        onLoadCode(content, name);
        onClose();
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-lg max-w-lg w-full flex flex-col shadow-2xl text-neutral-200 font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-[#222222] bg-[#161616]">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#242424] border border-[#444444] flex items-center justify-center text-neutral-200 shrink-0">
              {mode === 'save' ? (
                <Save className="w-4 h-4 text-neutral-200" />
              ) : (
                <FolderOpen className="w-4 h-4 text-neutral-200" />
              )}
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
              {mode === 'save' ? 'Save Project Locally' : 'Open Saved Project'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#242424] text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-3.5 sm:p-5 space-y-4 text-xs bg-[#121212]">
          {mode === 'save' && (
            <div className="space-y-3">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Project Name:
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. FactorialRecursion"
                  className="w-full bg-[#181818] border border-[#333333] focus:border-[#666666] rounded-md px-3.5 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleExportJava}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#242424] hover:bg-[#323232] border border-[#444444] text-neutral-200 transition-colors font-medium text-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-300" />
                  <span>Export .java File</span>
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#242424] hover:bg-[#323232] border border-[#555555] text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saveSuccess ? 'Saved!' : 'Save Project'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Saved Projects List */}
          <div className="space-y-2 pt-2 border-t border-[#222222]">
            <div className="flex items-center justify-between text-neutral-400 font-semibold">
              <span>Saved Projects ({projects.length})</span>
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-300 hover:text-white cursor-pointer transition-colors">
                <Upload className="w-3 h-3 text-neutral-400" />
                <span>Import .java File</span>
                <input
                  type="file"
                  accept=".java,.txt"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>

            {projects.length === 0 ? (
              <div className="p-4 rounded-md bg-[#0d0d0d] border border-[#262626] text-center text-neutral-500">
                No saved projects found in local storage.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => {
                      onLoadCode(proj.code, proj.name);
                      onClose();
                    }}
                    className="p-2.5 rounded-md bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] hover:border-[#444444] cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-neutral-400" />
                      <div>
                        <span className="font-semibold text-neutral-200 block text-xs">
                          {proj.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {proj.updatedAt}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleDelete(proj.id, e)}
                        title="Delete project"
                        className="p-1 rounded hover:bg-[#333333] text-neutral-500 hover:text-neutral-200 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
