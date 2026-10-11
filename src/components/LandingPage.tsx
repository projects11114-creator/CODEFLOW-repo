import React from 'react';
import {
  Play,
  Plus,
  BookOpen,
} from 'lucide-react';
import { SampleProgram } from '../engine/types.ts';

interface LandingPageProps {
  onLaunchIde: () => void;
  onCreateProject: () => void;
  onSelectSample?: (sample: SampleProgram) => void;
  onOpenGuide: () => void;
  systemStatus?: {
    javacAvailable: boolean;
    javacVersion: string;
    geminiConfigured: boolean;
  };
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchIde,
  onCreateProject,
  onOpenGuide,
}) => {
  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col font-sans selection:bg-neutral-800 selection:text-white antialiased overflow-x-hidden">
      {/* Background Video looping seamlessly behind content */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-60"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4"
            type="video/mp4"
          />
        </video>
        {/* Subtle overlay to ensure maximum legibility and cinematic depth */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px]" />
      </div>

      {/* Top Navigation - Aligned to Top-Right */}
      <header className="w-full px-6 py-5 flex items-center justify-end z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenGuide}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-[#242424] hover:bg-[#323232] border border-[#444444] hover:border-[#555555] rounded-md transition-colors duration-200 cursor-pointer shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
            <span>BCA Documentation</span>
          </button>

          <button
            type="button"
            onClick={onLaunchIde}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-[#242424] hover:bg-[#323232] border border-[#444444] hover:border-[#555555] rounded-md transition-colors duration-200 cursor-pointer shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-neutral-400 fill-current" />
            <span>Open IDE</span>
          </button>
        </div>
      </header>

      {/* Main Center Section - Perfectly Centered Horizontally & Visually Vertically */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-10 sm:-mt-14 z-10 text-center">
        {/* Title Treatment: Cinematic, Metallic-Silver, Superhero Title Aesthetic */}
        <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto flex flex-col items-center">
          <h1
            className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black uppercase tracking-[0.22em] sm:tracking-[0.28em] md:tracking-[0.32em] text-transparent bg-clip-text bg-gradient-to-b from-white via-[#dedede] to-[#8c8c8c] select-none drop-shadow-[0_4px_24px_rgba(255,255,255,0.12)] pl-[0.22em] sm:pl-[0.28em] md:pl-[0.32em]"
            style={{
              textShadow: '0 2px 30px rgba(255, 255, 255, 0.08)',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            }}
          >
            CODEFLOW
          </h1>

          {/* Two Buttons Side by Side Directly Beneath Title */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full pt-2">
            <button
              type="button"
              onClick={onCreateProject}
              className="w-full sm:w-auto min-w-[240px] flex items-center justify-center gap-2.5 px-6 py-3 rounded-md text-sm font-medium text-white bg-[#242424] hover:bg-[#323232] border border-[#444444] hover:border-[#555555] transition-colors duration-200 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4 text-neutral-300" />
              <span>Create Project / Program File</span>
            </button>

            <button
              type="button"
              onClick={onLaunchIde}
              className="w-full sm:w-auto min-w-[220px] flex items-center justify-center gap-2.5 px-6 py-3 rounded-md text-sm font-medium text-white bg-[#242424] hover:bg-[#323232] border border-[#444444] hover:border-[#555555] transition-colors duration-200 cursor-pointer shadow-sm"
            >
              <Play className="w-4 h-4 text-neutral-300 fill-current" />
              <span>Open Direct Java IDE</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
