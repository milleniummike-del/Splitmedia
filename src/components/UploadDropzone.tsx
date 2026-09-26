import React, { useState, useRef, DragEvent } from 'react';
import { UploadCloud, Music, Video, Sparkles, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Image as ImageIcon } from 'lucide-react';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  onLoadSample: (type: 'audio' | 'video') => void;
  isLoadingFile: boolean;
  isLoadingSample: boolean;
  errorMessage: string | null;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelected,
  onLoadSample,
  isLoadingFile,
  isLoadingSample,
  errorMessage,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (
        file.type.startsWith('audio/') ||
        file.type.startsWith('video/') ||
        /\.(mp4|mp3|wav|mov|mkv|webm|m4a|aac|ogg|flac)$/i.test(file.name)
      ) {
        onFileSelected(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Hero Intro */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-semibold mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% Browser-Side Processing · Zero Server Uploads</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          Split Audio or Video in Seconds & Attach Custom Images
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
          Choose your interval in seconds. Every piece is cut directly in your browser.
          Attach custom image artwork or snap video frames to each segment, and download individually or in a ZIP!
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Media Error</p>
            <p className="text-xs text-red-300/80 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoadingFile && !isLoadingSample && fileInputRef.current?.click()}
        className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all p-8 sm:p-12 text-center bg-zinc-900/60 hover:bg-zinc-900/90 ${
          isDragOver
            ? 'border-amber-500 bg-amber-500/10 scale-[1.008]'
            : 'border-zinc-800 hover:border-zinc-700'
        } ${isLoadingFile || isLoadingSample ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*,.mp4,.webm,.mov,.mkv,.avi,.mp3,.wav,.ogg,.aac,.m4a,.flac"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {isLoadingFile ? (
          <div className="py-6 flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-4" />
            <p className="text-base font-semibold text-white mb-2">
              Decoding Media in Browser...
            </p>
            <p className="text-xs text-zinc-400 mb-2">
              Parsing audio waveforms and video frame parameters locally
            </p>
          </div>
        ) : isLoadingSample ? (
          <div className="py-6 flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <p className="text-base font-semibold text-white mb-1">
              Synthesizing In-Browser Sample...
            </p>
            <p className="text-xs text-zinc-400">Rendering canvas visuals & audio oscillators</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-300 group-hover:text-amber-400 group-hover:scale-105 transition-all mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-semibold text-white mb-1">
              Drop your audio or video file here
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              or click to browse from your device
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors">
              Select Media File
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-cyan-400" />
                <span>MP4, WebM, MOV, MKV</span>
              </div>
              <span className="text-zinc-700">·</span>
              <div className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-amber-400" />
                <span>MP3, WAV, AAC, M4A, OGG</span>
              </div>
              <span className="text-zinc-700">·</span>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Never leaves your machine</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Sample Selector */}
      <div className="mt-8 pt-6 border-t border-zinc-800/80">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 text-center mb-4">
          Or test immediately with pure in-browser synthesized samples
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => onLoadSample('video')}
            disabled={isLoadingSample || isLoadingFile}
            className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/70 text-left transition-all group flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 group-hover:scale-105 transition-transform">
              <Video className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">
                  20s Synth-Wave Video (Canvas + Audio)
                </span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Rendered live in your browser using HTML5 Canvas & Web Audio
              </p>
            </div>
          </button>

          <button
            onClick={() => onLoadSample('audio')}
            disabled={isLoadingSample || isLoadingFile}
            className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/70 text-left transition-all group flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400 group-hover:scale-105 transition-transform">
              <Music className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">
                  30s Ambient Melody (Stereo Web Audio)
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Multi-tone ambient chords synthesized directly in client memory
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-zinc-400 text-xs">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-200 block mb-0.5">100% Browser-Side</span>
            No files are uploaded to any server. Complete privacy and zero data limits.
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-200 block mb-0.5">Attach Image per Segment</span>
            Upload cover art, thumbnails, or snap exact video frames to each slice.
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-200 block mb-0.5">Choice of Seconds & ZIP</span>
            Split every 15s, 30s, 60s or custom seconds and download individually or in a ZIP.
          </div>
        </div>
      </div>
    </div>
  );
};
