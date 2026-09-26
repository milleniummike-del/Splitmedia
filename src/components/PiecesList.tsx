import React, { useState, useRef } from 'react';
import {
  Download,
  Archive,
  Play,
  Pause,
  CheckCircle2,
  Image as ImageIcon,
  Upload,
  X,
  Maximize2,
  Loader2,
  Film,
  Sparkles,
  MessageSquare,
  Copy,
  Check,
} from 'lucide-react';
import { SplitPiece, ClientMediaFile, AttachedImage } from '../types.ts';
import { formatSeconds, formatDurationLabel, formatFileSize } from '../utils/formatters.ts';
import { createAndDownloadBrowserZip } from '../utils/browserZipExporter.ts';

interface PiecesListProps {
  pieces: SplitPiece[];
  mediaFile: ClientMediaFile;
  currentTime: number;
  isPlaying: boolean;
  activePieceId?: string | null;
  onAuditionPiece: (piece: SplitPiece) => void;
  onPlayFullSlideshow: () => void;
  onUpdatePieceImage: (pieceId: string, image: AttachedImage | undefined) => void;
  onUpdatePiecePrompt: (pieceId: string, promptText: string) => void;
  onApplyPromptToAll: (promptText: string) => void;
  onDownloadAudioPiece: (piece: SplitPiece) => Promise<void>;
  isProcessingAll?: boolean;
}

export const PiecesList: React.FC<PiecesListProps> = ({
  pieces,
  mediaFile,
  currentTime,
  isPlaying,
  activePieceId,
  onAuditionPiece,
  onPlayFullSlideshow,
  onUpdatePieceImage,
  onUpdatePiecePrompt,
  onApplyPromptToAll,
  onDownloadAudioPiece,
  isProcessingAll = false,
}) => {
  const [downloadedPieceIds, setDownloadedPieceIds] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copiedPieceId, setCopiedPieceId] = useState<string | null>(null);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const DEFAULT_PROMPT = 'The character follows the audio and lip syncs';
  const SUGGESTED_PROMPT_1 = 'The character follows the audio and lip syncs';
  const SUGGESTED_PROMPT_2 = 'The video follows the rhythm of the audio';

  const attachedImagesCount = pieces.filter((p) => !!p.attachedImage).length;
  const promptedCount = pieces.filter((p) => (p.promptText || '').trim().length > 0).length;

  const handleDownloadImage = (image: AttachedImage) => {
    const url = URL.createObjectURL(image.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = image.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleImageFileChange = (piece: SplitPiece, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const dataUrl = URL.createObjectURL(file);
      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.png';
      const baseName = piece.audioFileName.substring(0, piece.audioFileName.lastIndexOf('.'));

      const attached: AttachedImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dataUrl,
        blob: file,
        fileName: `${baseName}_cover${ext}`,
      };

      onUpdatePieceImage(piece.id, attached);
    }
  };

  const handleDownloadPieceAudio = async (piece: SplitPiece) => {
    await onDownloadAudioPiece(piece);
    setDownloadedPieceIds((prev) => new Set(prev).add(piece.id));
  };

  const handleCopyPrompt = (pieceId: string, text: string) => {
    navigator.clipboard.writeText(text || DEFAULT_PROMPT);
    setCopiedPieceId(pieceId);
    setTimeout(() => setCopiedPieceId(null), 1500);
  };

  const handleDownloadAllZip = async () => {
    try {
      setIsZipping(true);
      setZipProgress(0);

      for (const piece of pieces) {
        if (!piece.audioBlob) {
          await onDownloadAudioPiece(piece);
        }
      }

      const baseName =
        mediaFile.name.substring(0, mediaFile.name.lastIndexOf('.')) || 'splitwave_export';
      await createAndDownloadBrowserZip(pieces, baseName, (p) => setZipProgress(p));
    } catch (err: any) {
      alert('Error generating browser ZIP: ' + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  if (pieces.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col gap-6">
      {/* Top Header & Slideshow Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-400" />
              Timeline Storyboard & Audio Slideshow ({pieces.length} Segments)
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              · {attachedImagesCount}/{pieces.length} images · {promptedCount}/{pieces.length} custom prompts
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Attach images and specify generation prompts for each segment, with quick suggestion pills
          </p>
        </div>

        {/* Global batch actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onApplyPromptToAll(SUGGESTED_PROMPT_1)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors"
            title="Set default lip-sync prompt across all segments"
          >
            Apply &quot;Lip Sync&quot; to All
          </button>

          <button
            onClick={() => onApplyPromptToAll(SUGGESTED_PROMPT_2)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors"
            title="Set rhythm prompt across all segments"
          >
            Apply &quot;Rhythm&quot; to All
          </button>

          <button
            onClick={onPlayFullSlideshow}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-medium text-xs transition-all flex items-center gap-1.5 border border-zinc-700 shadow-sm"
          >
            {isPlaying && !activePieceId ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Pause Slideshow</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>Play Full Slideshow</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={isZipping || isProcessingAll}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-semibold text-xs transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
          >
            {isZipping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Packaging ZIP {zipProgress}%...</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 text-black" />
                <span>Download All as ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Storyboard Timeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
        {pieces.map((piece) => {
          const isDownloaded = downloadedPieceIds.has(piece.id);
          const isCurrentTimeInPiece =
            currentTime >= piece.startTime && currentTime < piece.endTime;
          const isAuditioningThis = activePieceId === piece.id && isPlaying;
          const isHighlighted = isAuditioningThis || (isPlaying && isCurrentTimeInPiece);
          const hasImage = !!piece.attachedImage;
          const currentPrompt = piece.promptText ?? '';

          const segmentProgress = Math.max(
            0,
            Math.min(
              100,
              ((currentTime - piece.startTime) / (piece.endTime - piece.startTime)) * 100
            )
          );

          return (
            <div
              key={piece.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3.5 relative overflow-hidden ${
                isHighlighted
                  ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.15)] ring-1 ring-amber-400'
                  : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Active Segment Progress Bar Line at top */}
              {isHighlighted && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800">
                  <div
                    className="bg-amber-400 h-full transition-all duration-100 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
                    style={{ width: `${segmentProgress}%` }}
                  />
                </div>
              )}

              {/* Card Header: Part Number & Timestamp Range */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-mono transition-colors ${
                      isHighlighted
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {piece.index.toString().padStart(2, '0')}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1">
                      Part {piece.index}
                      {isHighlighted && (
                        <span className="text-[10px] text-amber-400 font-semibold animate-pulse">
                          · Playing
                        </span>
                      )}
                    </h3>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      {formatSeconds(piece.startTime)} → {formatSeconds(piece.endTime)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-zinc-300 block font-mono">
                    {formatDurationLabel(piece.duration)}
                  </span>
                  {piece.audioBlob && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {formatFileSize(piece.audioBlob.size)}
                    </span>
                  )}
                </div>
              </div>

              {/* Attached Image Artwork Frame */}
              <div className="bg-zinc-900 rounded-lg p-2 border border-zinc-800/80">
                {hasImage ? (
                  <div className="relative group/art rounded-md overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <img
                      src={piece.attachedImage!.dataUrl}
                      alt={`Cover for Part ${piece.index}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/art:scale-105"
                    />

                    {/* Image Hover Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLightboxImage(piece.attachedImage!.dataUrl)}
                        className="p-1.5 rounded-full bg-zinc-800 text-white hover:bg-zinc-700"
                        title="View Full Size"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(piece.attachedImage!)}
                        className="p-1.5 rounded-full bg-zinc-800 text-white hover:bg-amber-500 hover:text-black transition-colors"
                        title="Download Artwork"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[piece.id]?.click()}
                        className="p-1.5 rounded-full bg-zinc-800 text-white hover:bg-zinc-700"
                        title="Replace Image"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePieceImage(piece.id, undefined)}
                        className="p-1.5 rounded-full bg-red-950/80 text-red-300 hover:bg-red-900"
                        title="Remove Image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="absolute bottom-1 left-1.5 bg-black/70 backdrop-blur-xs text-[10px] text-zinc-300 font-mono px-1.5 py-0.5 rounded truncate max-w-[85%] pointer-events-none">
                      {piece.attachedImage!.fileName}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRefs.current[piece.id]?.click()}
                    className="border border-dashed border-zinc-800 hover:border-amber-500/60 rounded-md p-3 text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-zinc-950/50 hover:bg-zinc-950/90 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-zinc-800/80 text-zinc-400 flex items-center justify-center">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-300 hover:text-white">
                      Attach Image
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Upload JPG, PNG, WEBP
                    </span>
                  </div>
                )}

                {/* Hidden File Picker per Piece */}
                <input
                  ref={(el) => {
                    fileInputRefs.current[piece.id] = el;
                  }}
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                  className="hidden"
                  onChange={(e) => handleImageFileChange(piece, e)}
                />
              </div>

              {/* Segment Prompt Section with Suggested Quick Pills */}
              <div className="flex flex-col gap-2 bg-zinc-900/70 border border-zinc-800/80 rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-1 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                    <MessageSquare className="w-3 h-3 text-amber-400" />
                    Segment Prompt
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(piece.id, currentPrompt || DEFAULT_PROMPT)}
                      className="p-1 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
                      title="Copy prompt"
                    >
                      {copiedPieceId === piece.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {currentPrompt && (
                      <button
                        type="button"
                        onClick={() => onUpdatePiecePrompt(piece.id, '')}
                        className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors"
                        title="Clear custom prompt (restore default)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Prompt Text Input / Textarea */}
                <textarea
                  rows={2}
                  value={currentPrompt}
                  placeholder={DEFAULT_PROMPT}
                  onChange={(e) => onUpdatePiecePrompt(piece.id, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/80 resize-none font-sans"
                />

                {/* Suggested Quick Prompt Pill Buttons */}
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <span className="text-[10px] text-zinc-500 font-medium">Quick Suggestions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdatePiecePrompt(piece.id, SUGGESTED_PROMPT_1)}
                      className={`text-[11px] px-2 py-1 rounded-md transition-all text-left truncate max-w-full border ${
                        currentPrompt === SUGGESTED_PROMPT_1
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-medium'
                          : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-750'
                      }`}
                      title={SUGGESTED_PROMPT_1}
                    >
                      🗣️ {SUGGESTED_PROMPT_1}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdatePiecePrompt(piece.id, SUGGESTED_PROMPT_2)}
                      className={`text-[11px] px-2 py-1 rounded-md transition-all text-left truncate max-w-full border ${
                        currentPrompt === SUGGESTED_PROMPT_2
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-medium'
                          : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-750'
                      }`}
                      title={SUGGESTED_PROMPT_2}
                    >
                      🎵 {SUGGESTED_PROMPT_2}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Audition Audio & Download Audio */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => onAuditionPiece(piece)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isAuditioningThis
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                  }`}
                  title="Audition this audio segment with image preview"
                >
                  {isAuditioningThis ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-black" />
                      <span>Auditioning</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Audition</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPieceAudio(piece)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border ${
                    isDownloaded
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white'
                  }`}
                  title="Download piece audio WAV file"
                >
                  {isDownloaded ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Audio WAV</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden p-2">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/70 text-white hover:bg-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Attached artwork preview"
              className="max-h-[80vh] w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};
