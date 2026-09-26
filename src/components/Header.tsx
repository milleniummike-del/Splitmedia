import React from 'react';
import { Scissors, FileAudio, FileVideo, RotateCcw } from 'lucide-react';
import { ClientMediaFile } from '../types.ts';
import { formatSeconds, formatFileSize } from '../utils/formatters.ts';

interface HeaderProps {
  currentFile: ClientMediaFile | null;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentFile, onReset }) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Scissors className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                SplitWave
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                100% In-Browser
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Browser-Side Audio Splitter & Storyboard Slideshow with Custom Images
            </p>
          </div>
        </div>

        {/* Current File Metadata */}
        {currentFile && (
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-lg text-xs">
            <div className="flex items-center gap-1.5 text-zinc-300">
              {currentFile.mediaType === 'video' ? (
                <FileVideo className="w-4 h-4 text-cyan-400" />
              ) : (
                <FileAudio className="w-4 h-4 text-amber-400" />
              )}
              <span className="max-w-[160px] sm:max-w-[240px] truncate font-medium text-zinc-200">
                {currentFile.name}
              </span>
            </div>
            <span className="text-zinc-600">·</span>
            <span className="font-mono text-zinc-400">
              {formatSeconds(currentFile.duration)}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">
              {formatFileSize(currentFile.size)}
            </span>

            <button
              onClick={onReset}
              title="Change or upload another file"
              className="ml-2 p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
