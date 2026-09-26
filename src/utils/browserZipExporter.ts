import JSZip from 'jszip';
import { SplitPiece } from '../types.ts';
import { formatSeconds } from './formatters.ts';

export async function createAndDownloadBrowserZip(
  pieces: SplitPiece[],
  baseName: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();

  const manifest = {
    projectName: baseName,
    exportedAt: new Date().toISOString(),
    totalPieces: pieces.length,
    pieces: pieces.map((p) => ({
      index: p.index,
      audioFileName: p.audioFileName,
      videoFileName: p.fileName,
      start: p.startTime,
      end: p.endTime,
      duration: p.duration,
      prompt: p.promptText || 'The character follows the audio and lip syncs',
      hasAttachedImage: !!p.attachedImage,
      imageFileName: p.attachedImage ? p.attachedImage.fileName : null,
    })),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Also include human-readable prompts.txt
  const promptsText = pieces
    .map(
      (p) =>
        `Part ${p.index.toString().padStart(2, '0')} (${formatSeconds(p.startTime)} -> ${formatSeconds(
          p.endTime
        )}):\n${p.promptText || 'The character follows the audio and lip syncs'}\n`
    )
    .join('\n');
  zip.file('prompts.txt', promptsText);

  // Add each piece audio file, video file (if present), and attached image
  for (const piece of pieces) {
    if (piece.audioBlob) {
      zip.file(piece.audioFileName, piece.audioBlob);
    } else if (piece.videoBlob) {
      zip.file(piece.fileName, piece.videoBlob);
    }
    if (piece.attachedImage && piece.attachedImage.blob) {
      zip.file(piece.attachedImage.fileName, piece.attachedImage.blob);
    }
  }

  // Generate zip file in browser
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(Math.round(metadata.percent));
    }
  );

  // Trigger browser download
  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${baseName}_split_pieces_${pieces.length}_parts.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}
