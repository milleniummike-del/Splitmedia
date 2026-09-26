/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { UploadDropzone } from './components/UploadDropzone.tsx';
import { MediaPlayer } from './components/MediaPlayer.tsx';
import { TimelineRuler } from './components/TimelineRuler.tsx';
import { SplitControls } from './components/SplitControls.tsx';
import { PiecesList } from './components/PiecesList.tsx';
import { ClientMediaFile, SplitConfig, SplitPiece, AttachedImage } from './types.ts';
import {
  decodeAudioFile,
  sliceAudioBuffer,
  getAudioContext,
} from './utils/browserAudioSplitter.ts';
import { Scissors, Film } from 'lucide-react';

export default function App() {
  const [currentFile, setCurrentFile] = useState<ClientMediaFile | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePieceRange, setActivePieceRange] = useState<{ start: number; end: number } | null>(null);
  const [activePieceId, setActivePieceId] = useState<string | null>(null);

  // Splitting configuration
  const [config, setConfig] = useState<SplitConfig>({
    mode: 'fixed',
    intervalSeconds: 20, // 20s as default
    equalPartsCount: 4,
    customCutPoints: [],
  });

  // Pieces result state
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitPieces, setSplitPieces] = useState<SplitPiece[]>([]);
  const storyboardRef = useRef<HTMLDivElement>(null);

  // Find the currently active segment based on current playhead position
  const currentSegment = useMemo(() => {
    if (splitPieces.length === 0) return null;
    return (
      splitPieces.find(
        (p) => currentTime >= p.startTime && currentTime < p.endTime
      ) || splitPieces[0]
    );
  }, [currentTime, splitPieces]);

  // Active segment image for the main slideshow stage
  const activePieceImage = useMemo(() => {
    // If auditioning a specific piece, show that piece's image
    if (activePieceId) {
      const p = splitPieces.find((item) => item.id === activePieceId);
      return p?.attachedImage || null;
    }
    // Otherwise show the image for whichever segment is currently playing in slideshow
    return currentSegment?.attachedImage || null;
  }, [activePieceId, currentSegment, splitPieces]);

  // Active segment prompt for the slideshow stage
  const activePiecePrompt = useMemo(() => {
    if (activePieceId) {
      const p = splitPieces.find((item) => item.id === activePieceId);
      return p?.promptText || 'The character follows the audio and lip syncs';
    }
    return currentSegment?.promptText || 'The character follows the audio and lip syncs';
  }, [activePieceId, currentSegment, splitPieces]);

  // Handle User File Selection (Audio or Video, 100% In-Browser)
  const handleFileSelected = async (file: File) => {
    try {
      setErrorMessage(null);
      setIsLoadingFile(true);
      setSplitPieces([]);
      setCurrentTime(0);
      setIsPlaying(false);
      setActivePieceRange(null);
      setActivePieceId(null);

      const isVideo =
        file.type.startsWith('video/') ||
        /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name);

      const objectUrl = URL.createObjectURL(file);

      // Always decode audio buffer from the file (handles MP3, WAV, AAC, MP4, WebM, etc.)
      let audioBuffer: AudioBuffer | undefined = undefined;
      try {
        audioBuffer = await decodeAudioFile(file);
      } catch (audioErr) {
        console.warn('Audio decoding fallback:', audioErr);
      }

      let videoDetails: { width: number; height: number } | undefined = undefined;
      let duration = audioBuffer?.duration || 10;

      if (isVideo) {
        // Load video element to inspect dimensions & duration
        const video = document.createElement('video');
        video.src = objectUrl;
        video.preload = 'metadata';

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            if (video.duration && !isNaN(video.duration)) {
              duration = video.duration;
            }
            videoDetails = {
              width: video.videoWidth || 1280,
              height: video.videoHeight || 720,
            };
            resolve();
          };
          video.onerror = () => resolve();
        });
      }

      const clientMedia: ClientMediaFile = {
        id: `media_${Date.now()}`,
        file,
        name: file.name,
        mediaType: isVideo ? 'video' : 'audio',
        duration,
        size: file.size,
        url: objectUrl,
        videoDetails,
        audioDetails: audioBuffer
          ? {
              sampleRate: audioBuffer.sampleRate,
              channels: audioBuffer.numberOfChannels,
              audioBuffer,
            }
          : undefined,
      };

      setCurrentFile(clientMedia);
      autoConfigureInterval(clientMedia.duration);
    } catch (err: any) {
      console.error('File load error:', err);
      setErrorMessage(err.message || 'Failed to process media file in browser');
    } finally {
      setIsLoadingFile(false);
    }
  };


  const autoConfigureInterval = (dur: number) => {
    if (dur <= 30) {
      setConfig((prev) => ({ ...prev, intervalSeconds: Math.max(5, Math.round(dur / 2)) }));
    } else if (dur <= 60) {
      setConfig((prev) => ({ ...prev, intervalSeconds: 15 }));
    } else if (dur <= 120) {
      setConfig((prev) => ({ ...prev, intervalSeconds: 20 })); // 20s option
    } else if (dur <= 300) {
      setConfig((prev) => ({ ...prev, intervalSeconds: 30 }));
    } else {
      setConfig((prev) => ({ ...prev, intervalSeconds: 60 }));
    }
  };

  const handleReset = () => {
    if (currentFile?.url) {
      URL.revokeObjectURL(currentFile.url);
    }
    splitPieces.forEach((p) => {
      if (p.audioBlobUrl) URL.revokeObjectURL(p.audioBlobUrl);
      if (p.attachedImage?.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(p.attachedImage.dataUrl);
      }
    });
    setCurrentFile(null);
    setSplitPieces([]);
    setCurrentTime(0);
    setIsPlaying(false);
    setActivePieceRange(null);
    setActivePieceId(null);
    setErrorMessage(null);
  };

  const calculatedPiecesCount = useMemo(() => {
    if (!currentFile || currentFile.duration <= 0) return 0;
    const dur = currentFile.duration;

    if (config.mode === 'fixed') {
      const interval = Math.max(0.5, config.intervalSeconds || 10);
      let count = Math.floor(dur / interval);
      const remainder = dur % interval;
      if (remainder > 0.15) count += 1;
      return Math.max(1, count);
    }

    if (config.mode === 'equal') {
      return Math.max(2, Math.min(50, config.equalPartsCount || 2));
    }

    if (config.mode === 'custom') {
      const validPoints = config.customCutPoints.filter((pt) => pt > 0 && pt < dur);
      return validPoints.length + 1;
    }

    return 1;
  }, [currentFile, config]);

  // Execute Browser-Side Split: Prepares audio slices immediately in memory!
  const handleExecuteSplit = async () => {
    if (!currentFile) return;

    try {
      setIsSplitting(true);
      setErrorMessage(null);

      // Ensure audio buffer is available (decodes on demand if needed)
      let audioBuffer = currentFile.audioDetails?.audioBuffer;
      if (!audioBuffer) {
        try {
          audioBuffer = await decodeAudioFile(currentFile.file);
          setCurrentFile((prev) =>
            prev
              ? {
                  ...prev,
                  audioDetails: {
                    sampleRate: audioBuffer!.sampleRate,
                    channels: audioBuffer!.numberOfChannels,
                    audioBuffer: audioBuffer!,
                  },
                }
              : null
          );
        } catch (audioErr) {
          console.warn('Audio decoding fallback:', audioErr);
        }
      }

      const totalDuration = currentFile.duration;
      interface SliceDef {
        start: number;
        end: number;
        index: number;
      }
      const slices: SliceDef[] = [];

      if (config.mode === 'fixed') {
        const interval = Math.max(0.5, config.intervalSeconds || 10);
        let curr = 0;
        let idx = 0;
        while (curr < totalDuration) {
          const next = Math.min(curr + interval, totalDuration);
          if (next - curr < 0.15 && slices.length > 0) {
            slices[slices.length - 1].end = totalDuration;
            break;
          }
          slices.push({ start: curr, end: next, index: idx });
          curr = next;
          idx++;
        }
      } else if (config.mode === 'equal') {
        const parts = Math.max(2, Math.min(50, config.equalPartsCount || 2));
        const interval = totalDuration / parts;
        for (let i = 0; i < parts; i++) {
          const start = i * interval;
          const end = i === parts - 1 ? totalDuration : (i + 1) * interval;
          slices.push({ start, end, index: i });
        }
      } else if (config.mode === 'custom') {
        const sortedPoints = [...config.customCutPoints]
          .filter((pt) => pt > 0 && pt < totalDuration)
          .sort((a, b) => a - b);

        let lastTime = 0;
        let idx = 0;
        for (const pt of sortedPoints) {
          slices.push({ start: lastTime, end: pt, index: idx });
          lastTime = pt;
          idx++;
        }
        slices.push({ start: lastTime, end: totalDuration, index: idx });
      }

      const baseName =
        currentFile.name.substring(0, currentFile.name.lastIndexOf('.')) || 'media';
      const pieces: SplitPiece[] = [];

      for (const slice of slices) {
        const pieceIndex = slice.index + 1;
        const paddedIndex = pieceIndex.toString().padStart(slices.length > 99 ? 3 : 2, '0');
        const startSecs = Math.floor(slice.start);
        const endSecs = Math.floor(slice.end);
        const audioFileName = `${baseName}_part${paddedIndex}_${startSecs}s_to_${endSecs}s.wav`;
        const fileName = `${baseName}_part${paddedIndex}_${startSecs}s_to_${endSecs}s${
          currentFile.mediaType === 'video' ? '.mp4' : '.wav'
        }`;

        // Slice audio immediately in memory! (10ms per slice, NEVER hangs)
        let audioBlob: Blob | undefined = undefined;
        let audioBlobUrl: string | undefined = undefined;

        if (audioBuffer) {
          try {
            audioBlob = sliceAudioBuffer(audioBuffer, slice.start, slice.end);
            audioBlobUrl = URL.createObjectURL(audioBlob);
          } catch (sliceErr) {
            console.warn('Audio slice error for piece', pieceIndex, sliceErr);
          }
        }

        pieces.push({
          id: `piece_${slice.index}_${Date.now()}`,
          index: pieceIndex,
          fileName,
          audioFileName,
          startTime: slice.start,
          endTime: slice.end,
          duration: slice.end - slice.start,
          audioBlob,
          audioBlobUrl,
          promptText: 'The character follows the audio and lip syncs',
          isProcessing: false,
          processProgress: 100,
        });
      }

      setSplitPieces(pieces);

      // Smoothly scroll directly to the Storyboard section (never to page bottom or whitespace)
      setTimeout(() => {
        storyboardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 50);
    } catch (err: any) {
      console.error('Split error:', err);
      setErrorMessage(err.message || 'Failed to split media in browser');
    } finally {
      setIsSplitting(false);
    }
  };

  // Audition a piece: Immediately starts playing and syncs slideshow
  const handleAuditionPiece = (piece: SplitPiece) => {
    getAudioContext();

    if (activePieceId === piece.id && isPlaying) {
      // Pause if already auditioning this piece
      setIsPlaying(false);
    } else {
      setActivePieceId(piece.id);
      setActivePieceRange({
        start: piece.startTime,
        end: piece.endTime,
      });
      setCurrentTime(piece.startTime);
      setIsPlaying(true);
    }
  };

  // Play full slideshow continuously across all segments with image transitions
  const handlePlayFullSlideshow = () => {
    getAudioContext();
    setActivePieceRange(null);
    setActivePieceId(null);

    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentTime >= (currentFile?.duration || 10) - 0.2) {
        setCurrentTime(0);
      }
      setIsPlaying(true);
    }
  };

  // Download piece audio WAV (never hangs because it's computed in memory)
  const handleDownloadAudioPiece = async (piece: SplitPiece): Promise<void> => {
    let blob = piece.audioBlob;
    if (!blob && currentFile) {
      let buffer = currentFile.audioDetails?.audioBuffer;
      if (!buffer) {
        buffer = await decodeAudioFile(currentFile.file);
      }
      blob = sliceAudioBuffer(buffer, piece.startTime, piece.endTime);
    }

    if (!blob) {
      alert('Could not generate audio slice');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = piece.audioFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Update attached image for a piece
  const handleUpdatePieceImage = (pieceId: string, image: AttachedImage | undefined) => {
    setSplitPieces((prev) =>
      prev.map((p) => (p.id === pieceId ? { ...p, attachedImage: image } : p))
    );
  };

  // Update prompt text for a piece
  const handleUpdatePiecePrompt = (pieceId: string, promptText: string) => {
    setSplitPieces((prev) =>
      prev.map((p) => (p.id === pieceId ? { ...p, promptText } : p))
    );
  };

  // Apply a prompt template across all segments
  const handleApplyPromptToAll = (promptText: string) => {
    setSplitPieces((prev) =>
      prev.map((p) => ({ ...p, promptText }))
    );
  };

  const handleSelectSegment = (start: number, end: number, index: number) => {
    const piece = splitPieces[index];
    if (piece) {
      handleAuditionPiece(piece);
    } else {
      setCurrentTime(start);
      setActivePieceRange({ start, end });
    }
  };

  const handleAddCustomCutPoint = (time: number) => {
    if (!currentFile) return;
    const rounded = Math.round(time * 10) / 10;
    if (rounded > 0 && rounded < currentFile.duration) {
      if (!config.customCutPoints.includes(rounded)) {
        setConfig((prev) => ({
          ...prev,
          customCutPoints: [...prev.customCutPoints, rounded].sort((a, b) => a - b),
        }));
      }
    }
  };

  const handleRemoveCustomCutPoint = (time: number) => {
    setConfig((prev) => ({
      ...prev,
      customCutPoints: prev.customCutPoints.filter((pt) => Math.abs(pt - time) > 0.05),
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <Header
        currentFile={currentFile}
        onReset={handleReset}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {!currentFile ? (
          <UploadDropzone
            onFileSelected={handleFileSelected}
            isLoadingFile={isLoadingFile}
            errorMessage={errorMessage}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Top Workspace: Slideshow Stage & Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Media Player Column (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <MediaPlayer
                  mediaFile={currentFile}
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  activePieceRange={activePieceRange}
                  activePieceImage={activePieceImage}
                  activePiecePrompt={activePiecePrompt}
                  currentSegmentNumber={currentSegment ? currentSegment.index : 1}
                  totalSegments={splitPieces.length > 0 ? splitPieces.length : 1}
                  isPlaying={isPlaying}
                  onPlayStateChange={setIsPlaying}
                  onClearActivePiece={() => {
                    setActivePieceRange(null);
                    setActivePieceId(null);
                  }}
                />

                {/* Timeline Ruler below player */}
                <TimelineRuler
                  totalDuration={currentFile.duration}
                  currentTime={currentTime}
                  config={config}
                  activeSegmentIndex={currentSegment ? currentSegment.index - 1 : null}
                  onSelectSegment={handleSelectSegment}
                  onAddCustomCutPoint={handleAddCustomCutPoint}
                  onRemoveCustomCutPoint={handleRemoveCustomCutPoint}
                />
              </div>

              {/* Controls Column (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <SplitControls
                  totalDuration={currentFile.duration}
                  config={config}
                  onChangeConfig={setConfig}
                  onExecuteSplit={handleExecuteSplit}
                  isSplitting={isSplitting}
                  calculatedPiecesCount={calculatedPiecesCount}
                />
              </div>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Timeline Storyboard of Segments with Attached Images & Prompts */}
            <div ref={storyboardRef} className="scroll-mt-6">
              {splitPieces.length > 0 ? (
                <PiecesList
                  pieces={splitPieces}
                  mediaFile={currentFile}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  activePieceId={activePieceId}
                  onAuditionPiece={handleAuditionPiece}
                  onPlayFullSlideshow={handlePlayFullSlideshow}
                  onUpdatePieceImage={handleUpdatePieceImage}
                  onUpdatePiecePrompt={handleUpdatePiecePrompt}
                  onApplyPromptToAll={handleApplyPromptToAll}
                  onDownloadAudioPiece={handleDownloadAudioPiece}
                />
              ) : (
                <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-center text-amber-400">
                    <Scissors className="w-6 h-6 -rotate-45" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Ready to Create Segments
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-md">
                    Choose your split interval above and click{' '}
                    <span className="text-amber-400 font-semibold font-mono">
                      "Create {calculatedPiecesCount} {calculatedPiecesCount === 1 ? 'Piece' : 'Pieces'}"
                    </span>{' '}
                    to generate your timeline storyboard with image attachments.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-900 py-6 px-4 text-center text-xs text-zinc-500">
        <p>
          SplitWave · 100% In-Browser Audio Splitter & Visual Timeline Storyboard Slideshow
        </p>
      </footer>
    </div>
  );
}
