import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  Music,
  Image as ImageIcon,
  Upload,
  Maximize2,
  Film,
  Sparkles,
} from 'lucide-react';
import { ClientMediaFile, AttachedImage } from '../types.ts';
import { formatSeconds } from '../utils/formatters.ts';
import { getAudioContext } from '../utils/browserAudioSplitter.ts';

interface MediaPlayerProps {
  mediaFile: ClientMediaFile;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  activePieceRange?: { start: number; end: number } | null;
  activePieceImage?: AttachedImage | null;
  currentSegmentNumber?: number;
  totalSegments?: number;
  activePiecePrompt?: string | null;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  onClearActivePiece?: () => void;
  onRequestUploadImage?: () => void;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  mediaFile,
  currentTime,
  onTimeUpdate,
  activePieceRange,
  activePieceImage,
  currentSegmentNumber = 1,
  totalSegments = 1,
  activePiecePrompt,
  isPlaying,
  onPlayStateChange,
  onClearActivePiece,
  onRequestUploadImage,
}) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [duration, setDuration] = useState(mediaFile.duration);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const isVideo = mediaFile.mediaType === 'video';

  // Compute waveform peaks
  useEffect(() => {
    if (mediaFile.audioDetails?.audioBuffer) {
      const buffer = mediaFile.audioDetails.audioBuffer;
      const channelData = buffer.getChannelData(0);
      const barsCount = 64;
      const blockSize = Math.floor(channelData.length / barsCount);
      const bars: number[] = [];

      for (let i = 0; i < barsCount; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j += 4) {
          sum += Math.abs(channelData[start + j] || 0);
        }
        const avg = sum / (blockSize / 4);
        bars.push(Math.max(0.12, Math.min(0.98, avg * 3.5)));
      }
      setWaveformBars(bars);
    } else {
      const barsCount = 64;
      const bars: number[] = [];
      const seed = mediaFile.size % 1000;
      for (let i = 0; i < barsCount; i++) {
        const sin1 = Math.sin(i * 0.15 + seed);
        const sin2 = Math.cos(i * 0.35 + seed * 2);
        bars.push(Math.max(0.15, Math.min(0.95, Math.abs(sin1 * 0.6 + sin2 * 0.4) + 0.15)));
      }
      setWaveformBars(bars);
    }
  }, [mediaFile]);

  // Synchronize internal media element playback state with isPlaying prop
  useEffect(() => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      // Resume audio context if suspended
      getAudioContext();
      mediaRef.current.play().catch((err) => {
        console.warn('Playback error:', err);
        onPlayStateChange(false);
      });
    } else {
      mediaRef.current.pause();
    }
  }, [isPlaying, onPlayStateChange]);

  // Sync internal currentTime when prop changes from outside
  useEffect(() => {
    if (mediaRef.current && Math.abs(mediaRef.current.currentTime - currentTime) > 0.35) {
      mediaRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Handle active piece range bounds (stops at piece boundary if auditioning single piece)
  useEffect(() => {
    if (!activePieceRange || !isPlaying) return;

    const checkBoundary = () => {
      if (mediaRef.current && isPlaying) {
        if (mediaRef.current.currentTime >= activePieceRange.end) {
          mediaRef.current.pause();
          mediaRef.current.currentTime = activePieceRange.start;
          onPlayStateChange(false);
        }
      }
    };

    const interval = setInterval(checkBoundary, 40);
    return () => clearInterval(interval);
  }, [activePieceRange, isPlaying, onPlayStateChange]);

  const togglePlay = useCallback(() => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      onPlayStateChange(false);
    } else {
      getAudioContext();
      // If at end, loop to beginning or piece start
      if (activePieceRange && mediaRef.current.currentTime >= activePieceRange.end - 0.1) {
        mediaRef.current.currentTime = activePieceRange.start;
      } else if (mediaRef.current.currentTime >= duration - 0.2) {
        mediaRef.current.currentTime = 0;
      }

      mediaRef.current
        .play()
        .then(() => onPlayStateChange(true))
        .catch((err) => {
          console.warn('Play error:', err);
          onPlayStateChange(false);
        });
    }
  }, [isPlaying, activePieceRange, duration, onPlayStateChange]);

  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    onTimeUpdate(mediaRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current && mediaRef.current.duration && !isNaN(mediaRef.current.duration)) {
      setDuration(mediaRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !mediaRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    const targetTime = percentage * duration;

    mediaRef.current.currentTime = targetTime;
    onTimeUpdate(targetTime);

    if (onClearActivePiece && activePieceRange) {
      if (targetTime < activePieceRange.start || targetTime > activePieceRange.end) {
        onClearActivePiece();
      }
    }
  };

  const handleSkip = (seconds: number) => {
    if (!mediaRef.current) return;
    const newTime = Math.max(0, Math.min(duration, mediaRef.current.currentTime + seconds));
    mediaRef.current.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  const handleRateChange = (rate: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    const nextMuted = !isMuted;
    mediaRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (mediaRef.current) {
      mediaRef.current.volume = val;
      mediaRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Hidden media element */}
      {isVideo ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaFile.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => onPlayStateChange(false)}
          playsInline
          className="hidden"
        />
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={mediaFile.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => onPlayStateChange(false)}
        />
      )}

      {/* Main Slideshow Stage & Audio Visualizer */}
      <div className="relative bg-zinc-950 min-h-[300px] sm:min-h-[380px] max-h-[440px] flex items-center justify-center overflow-hidden group">
        {/* Background ambient blur if image is attached */}
        {activePieceImage && (
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-25 scale-125 transition-all duration-700 pointer-events-none"
            style={{ backgroundImage: `url(${activePieceImage.dataUrl})` }}
          />
        )}

        {/* Content Showcase */}
        {activePieceImage ? (
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="relative max-w-md w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-zinc-700/80 group/art bg-black">
              <img
                src={activePieceImage.dataUrl}
                alt="Active segment cover"
                className="w-full h-full object-contain transition-transform duration-500 group-hover/art:scale-102"
              />

              {/* Top Banner Tag */}
              <div className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-semibold text-amber-400 flex items-center gap-1.5 border border-zinc-700/60 shadow-lg">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  Segment {currentSegmentNumber} of {totalSegments}
                </span>
              </div>

              {/* Maximize Button */}
              <button
                onClick={() => setLightboxImage(activePieceImage.dataUrl)}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-black/70 hover:bg-black text-white/80 hover:text-white transition-colors opacity-0 group-hover/art:opacity-100"
                title="View full resolution"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Click to Play/Pause Overlay */}
              <button
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 hover:bg-amber-500 hover:text-black text-white backdrop-blur-xs border border-white/20 flex items-center justify-center transition-all shadow-xl opacity-0 group-hover/art:opacity-100 hover:scale-110"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
            </div>
          </div>
        ) : (
          /* Placeholder when no image is attached to current segment */
          <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center max-w-md">
            <div
              onClick={togglePlay}
              className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-700 text-amber-400 flex items-center justify-center cursor-pointer hover:scale-105 hover:bg-zinc-800 transition-all shadow-xl mb-4"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8" />
              ) : (
                <Play className="w-8 h-8 ml-1" />
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300 border border-zinc-700 mb-2">
              <Film className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Slideshow Preview · Segment {currentSegmentNumber} of {totalSegments}
              </span>
            </div>

            <p className="text-sm font-semibold text-white mb-1">{mediaFile.name}</p>
            <p className="text-xs text-zinc-400 mb-4 font-mono">
              {formatSeconds(currentTime, true)} / {formatSeconds(duration, true)}
            </p>

            {onRequestUploadImage && (
              <button
                type="button"
                onClick={onRequestUploadImage}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Attach Image to Segment {currentSegmentNumber}</span>
              </button>
            )}
          </div>
        )}

        {/* Prompt Caption Overlay in Slideshow Stage */}
        <div className="absolute bottom-12 left-4 right-4 z-20 flex justify-center pointer-events-none">
          <div className="bg-black/85 backdrop-blur-md border border-zinc-700/80 px-3.5 py-1.5 rounded-full text-xs text-zinc-200 max-w-lg text-center shadow-2xl flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              {activePiecePrompt || 'The character follows the audio and lip syncs'}
            </span>
          </div>
        </div>

        {/* Live Audio Waveform bar sitting at the bottom of the stage */}
        <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between gap-[2px] h-8 pointer-events-none opacity-80">
          {waveformBars.map((heightFactor, idx) => {
            const barPosition = (idx / waveformBars.length) * 100;
            const isPassed = barPosition <= progressPercentage;
            return (
              <div
                key={idx}
                className={`flex-1 rounded-full transition-all duration-75 ${
                  isPassed ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]' : 'bg-zinc-800'
                }`}
                style={{
                  height: `${Math.round(
                    heightFactor * (isPlaying ? 85 + Math.sin(idx + currentTime * 8) * 15 : 45)
                  )}%`,
                }}
              />
            );
          })}
        </div>

        {/* Active piece badge indicator */}
        {activePieceRange && (
          <div className="absolute top-3 left-3 z-30 bg-amber-500 text-black font-semibold text-xs px-2.5 py-1 rounded-md shadow-lg flex items-center gap-2">
            <span>
              Auditioning Part {currentSegmentNumber}: {formatSeconds(activePieceRange.start)} -{' '}
              {formatSeconds(activePieceRange.end)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearActivePiece?.();
              }}
              className="text-black/80 hover:text-black font-bold text-xs"
              title="Return to full slideshow mode"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Scrub Bar */}
      <div
        ref={containerRef}
        onClick={handleSeek}
        className="w-full bg-zinc-950 h-3 hover:h-4 transition-all relative cursor-pointer group"
      >
        <div className="absolute inset-0 bg-zinc-800" />

        {activePieceRange && (
          <div
            className="absolute top-0 bottom-0 bg-amber-500/35 border-x border-amber-400"
            style={{
              left: `${(activePieceRange.start / duration) * 100}%`,
              width: `${((activePieceRange.end - activePieceRange.start) / duration) * 100}%`,
            }}
          />
        )}

        <div
          className="absolute top-0 bottom-0 bg-amber-500 group-hover:bg-amber-400 transition-colors"
          style={{ width: `${progressPercentage}%` }}
        />

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progressPercentage}%` }}
        />
      </div>

      {/* Control Bar */}
      <div className="p-3 sm:p-4 bg-zinc-950 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => handleSkip(-5)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="Rewind 5 seconds"
          >
            <Rewind className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-lg bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center font-bold transition-all shadow-md active:scale-95"
            title={isPlaying ? 'Pause' : 'Play Audio & Slideshow'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => handleSkip(5)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="Skip forward 5 seconds"
          >
            <FastForward className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 font-mono text-zinc-300 ml-1">
            <span className="font-semibold text-white">{formatSeconds(currentTime, true)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{formatSeconds(duration, true)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
            {[0.5, 1, 1.5, 2].map((rate) => (
              <button
                key={rate}
                onClick={() => handleRateChange(rate)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  playbackRate === rate
                    ? 'bg-zinc-800 text-amber-400 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <button
              onClick={toggleMute}
              className="hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-amber-500 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden p-2">
            <img
              src={lightboxImage}
              alt="Fullscreen artwork"
              className="max-h-[80vh] w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};
