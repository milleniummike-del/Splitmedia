import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
// @ts-ignore
import { ZipArchive } from 'archiver';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure storage directories exist
const UPLOADS_DIR = path.resolve(__dirname, 'temp_uploads');
const SAMPLES_DIR = path.resolve(__dirname, 'temp_samples');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

// Store metadata in memory
interface FileMetadata {
  fileId: string;
  originalName: string;
  filePath: string;
  extension: string;
  mediaType: 'video' | 'audio';
  duration: number;
  size: number;
  bitrate?: number;
  videoDetails?: {
    codec: string;
    width: number;
    height: number;
    fps: number;
  };
  audioDetails?: {
    codec: string;
    sampleRate: number;
    channels: number;
  };
  createdAt: number;
}

interface SplitPiece {
  id: string;
  index: number;
  fileName: string;
  filePath: string;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
}

const fileRegistry = new Map<string, FileMetadata>();
const splitPiecesRegistry = new Map<string, SplitPiece[]>();

// Configure Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const ext = path.extname(file.originalname) || '';
    cb(null, `upload_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB max
  },
});

// Helper to probe media using ffprobe
async function probeMedia(filePath: string): Promise<{
  duration: number;
  formatName: string;
  size: number;
  mediaType: 'video' | 'audio';
  videoDetails?: { codec: string; width: number; height: number; fps: number };
  audioDetails?: { codec: string; sampleRate: number; channels: number };
}> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  const probe = JSON.parse(stdout);
  const format = probe.format || {};
  const duration = parseFloat(format.duration || '0');
  const size = parseInt(format.size || '0', 10);

  const streams = probe.streams || [];
  const videoStream = streams.find(
    (s: any) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1
  );
  const audioStream = streams.find((s: any) => s.codec_type === 'audio');

  const mediaType: 'video' | 'audio' = videoStream ? 'video' : 'audio';

  let videoDetails: { codec: string; width: number; height: number; fps: number } | undefined;
  if (videoStream) {
    let fps = 30;
    if (videoStream.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split('/');
      if (parts.length === 2 && parseFloat(parts[1]) > 0) {
        fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
      } else if (parseFloat(videoStream.r_frame_rate) > 0) {
        fps = Math.round(parseFloat(videoStream.r_frame_rate));
      }
    }
    videoDetails = {
      codec: videoStream.codec_name || 'unknown',
      width: videoStream.width || 0,
      height: videoStream.height || 0,
      fps: fps || 30,
    };
  }

  let audioDetails: { codec: string; sampleRate: number; channels: number } | undefined;
  if (audioStream) {
    audioDetails = {
      codec: audioStream.codec_name || 'unknown',
      sampleRate: parseInt(audioStream.sample_rate || '44100', 10),
      channels: parseInt(audioStream.channels || '2', 10),
    };
  }

  return {
    duration,
    formatName: format.format_name || '',
    size,
    mediaType,
    videoDetails,
    audioDetails,
  };
}

// Format seconds into MM:SS or HH:MM:SS
function formatTimecodeForFilename(seconds: number): string {
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}h${mins.toString().padStart(2, '0')}m${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins.toString().padStart(2, '0')}m${secs.toString().padStart(2, '0')}s`;
}

// Stream media with Range requests support
function handleStreamMedia(req: Request, res: Response, filePath: string, downloadName?: string) {
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const range = req.headers.range;

  if (downloadName) {
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  }

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable: ${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

// Ensure sample assets exist
async function getOrCreateSample(type: 'audio' | 'video'): Promise<string> {
  const samplePath = path.join(SAMPLES_DIR, `sample_${type}.${type === 'video' ? 'mp4' : 'mp3'}`);
  if (fs.existsSync(samplePath) && fs.statSync(samplePath).size > 0) {
    return samplePath;
  }

  if (type === 'video') {
    // Generate a sleek 30-second test video with visual counter and audio tone
    const cmd = `ffmpeg -y -f lavfi -i "testsrc=duration=30:size=1280x720:rate=30" -f lavfi -i "sine=frequency=523.25:duration=30" -vf "drawtext=text='SplitWave Sample Video %{pts\\:hms}':fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 128k "${samplePath}"`;
    await execAsync(cmd);
  } else {
    // Generate a pleasant 30-second melodic synth arpeggio audio
    const cmd = `ffmpeg -y -f lavfi -i "anoisesrc=d=30:c=pink:r=44100:a=0.08" -f lavfi -i "sine=frequency=440:duration=30" -filter_complex "[0:a][1:a]amix=inputs=2:duration=first[aout]" -map "[aout]" -c:a libmp3lame -b:a 192k "${samplePath}"`;
    await execAsync(cmd);
  }

  return samplePath;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // 1. Upload media file
  app.post('/api/upload', upload.single('mediaFile'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No media file provided' });
        return;
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const extension = path.extname(originalName) || '.mp4';
      const fileId = path.basename(filePath, extension).replace('upload_', '');

      // Probe media
      const probeResult = await probeMedia(filePath);

      if (probeResult.duration <= 0) {
        res.status(400).json({ error: 'Could not detect media duration. The file may be corrupt or an unsupported format.' });
        return;
      }

      const metadata: FileMetadata = {
        fileId,
        originalName,
        filePath,
        extension,
        mediaType: probeResult.mediaType,
        duration: probeResult.duration,
        size: req.file.size,
        videoDetails: probeResult.videoDetails,
        audioDetails: probeResult.audioDetails,
        createdAt: Date.now(),
      };

      fileRegistry.set(fileId, metadata);
      splitPiecesRegistry.delete(fileId); // Clear any previous splits for this ID

      res.json({
        success: true,
        file: {
          fileId: metadata.fileId,
          originalName: metadata.originalName,
          mediaType: metadata.mediaType,
          duration: metadata.duration,
          size: metadata.size,
          extension: metadata.extension,
          videoDetails: metadata.videoDetails,
          audioDetails: metadata.audioDetails,
          streamUrl: `/api/stream/${metadata.fileId}`,
        },
      });
    } catch (err: any) {
      console.error('Upload processing error:', err);
      res.status(500).json({ error: err.message || 'Failed to process media file' });
    }
  });

  // 2. Load built-in sample file
  app.post('/api/sample', async (req: Request, res: Response) => {
    try {
      const type = req.body?.type === 'audio' ? 'audio' : 'video';
      const samplePath = await getOrCreateSample(type);
      const originalName = type === 'video' ? 'splitwave_sample_video.mp4' : 'splitwave_sample_audio.mp3';
      const extension = path.extname(originalName);

      // Create a unique copy in uploads dir
      const uniqueSuffix = `${Date.now()}_sample_${Math.random().toString(36).substring(2, 7)}`;
      const targetPath = path.join(UPLOADS_DIR, `upload_${uniqueSuffix}${extension}`);
      fs.copyFileSync(samplePath, targetPath);

      const probeResult = await probeMedia(targetPath);
      const stat = fs.statSync(targetPath);

      const metadata: FileMetadata = {
        fileId: uniqueSuffix,
        originalName,
        filePath: targetPath,
        extension,
        mediaType: probeResult.mediaType,
        duration: probeResult.duration,
        size: stat.size,
        videoDetails: probeResult.videoDetails,
        audioDetails: probeResult.audioDetails,
        createdAt: Date.now(),
      };

      fileRegistry.set(uniqueSuffix, metadata);
      splitPiecesRegistry.delete(uniqueSuffix);

      res.json({
        success: true,
        file: {
          fileId: metadata.fileId,
          originalName: metadata.originalName,
          mediaType: metadata.mediaType,
          duration: metadata.duration,
          size: metadata.size,
          extension: metadata.extension,
          videoDetails: metadata.videoDetails,
          audioDetails: metadata.audioDetails,
          streamUrl: `/api/stream/${metadata.fileId}`,
        },
      });
    } catch (err: any) {
      console.error('Sample loading error:', err);
      res.status(500).json({ error: err.message || 'Failed to load sample media' });
    }
  });

  // 3. Stream original file
  app.get('/api/stream/:fileId', (req: Request, res: Response) => {
    const fileId = req.params.fileId;
    const metadata = fileRegistry.get(fileId);

    if (!metadata) {
      res.status(404).json({ error: 'File session not found' });
      return;
    }

    handleStreamMedia(req, res, metadata.filePath);
  });

  // 4. Split media into pieces
  app.post('/api/split', async (req: Request, res: Response) => {
    try {
      const {
        fileId,
        mode = 'fixed', // 'fixed' | 'equal' | 'custom'
        intervalSeconds = 15,
        equalPartsCount = 2,
        customCutPoints = [],
        accurateCut = false, // false = fast stream copy, true = re-encode keyframes
      } = req.body;

      const metadata = fileRegistry.get(fileId);
      if (!metadata) {
        res.status(404).json({ error: 'Source file not found or expired' });
        return;
      }

      const totalDuration = metadata.duration;
      if (totalDuration <= 0) {
        res.status(400).json({ error: 'Invalid media duration' });
        return;
      }

      // Calculate time boundaries
      interface TimeSlice {
        start: number;
        end: number;
        index: number;
      }
      const slices: TimeSlice[] = [];

      if (mode === 'fixed') {
        const interval = Math.max(0.5, parseFloat(intervalSeconds) || 10);
        let curr = 0;
        let idx = 0;
        while (curr < totalDuration) {
          const next = Math.min(curr + interval, totalDuration);
          // If the last remaining piece is negligible (< 0.15s) and not the only piece, expand the previous piece
          if (next - curr < 0.15 && slices.length > 0) {
            slices[slices.length - 1].end = totalDuration;
            break;
          }
          slices.push({ start: curr, end: next, index: idx });
          curr = next;
          idx++;
        }
      } else if (mode === 'equal') {
        const parts = Math.max(2, Math.min(50, parseInt(equalPartsCount, 10) || 2));
        const interval = totalDuration / parts;
        for (let i = 0; i < parts; i++) {
          const start = i * interval;
          const end = i === parts - 1 ? totalDuration : (i + 1) * interval;
          slices.push({ start, end, index: i });
        }
      } else if (mode === 'custom') {
        // customCutPoints: array of numbers in seconds e.g. [12.5, 45.0, 90.0]
        const sortedPoints = (customCutPoints as number[])
          .map((n) => parseFloat(n as any))
          .filter((n) => !isNaN(n) && n > 0 && n < totalDuration)
          .sort((a, b) => a - b);

        // Deduplicate points that are too close
        const distinctPoints: number[] = [];
        for (const pt of sortedPoints) {
          if (distinctPoints.length === 0 || pt - distinctPoints[distinctPoints.length - 1] > 0.2) {
            distinctPoints.push(pt);
          }
        }

        let lastTime = 0;
        let idx = 0;
        for (const pt of distinctPoints) {
          slices.push({ start: lastTime, end: pt, index: idx });
          lastTime = pt;
          idx++;
        }
        slices.push({ start: lastTime, end: totalDuration, index: idx });
      }

      if (slices.length === 0) {
        res.status(400).json({ error: 'No split segments could be generated' });
        return;
      }

      // Create a directory for this file's pieces
      const piecesDir = path.join(UPLOADS_DIR, `pieces_${fileId}`);
      if (!fs.existsSync(piecesDir)) {
        fs.mkdirSync(piecesDir, { recursive: true });
      } else {
        // Clean out previous pieces
        const oldFiles = fs.readdirSync(piecesDir);
        for (const f of oldFiles) {
          try {
            fs.unlinkSync(path.join(piecesDir, f));
          } catch {}
        }
      }

      const baseNameWithoutExt = path.parse(metadata.originalName).name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const ext = metadata.extension.toLowerCase();
      const isVideo = metadata.mediaType === 'video';

      const generatedPieces: SplitPiece[] = [];

      // Process segments sequentially or in small parallel batches
      for (const slice of slices) {
        const pieceIndex = slice.index + 1;
        const paddedIndex = pieceIndex.toString().padStart(slices.length > 99 ? 3 : 2, '0');
        const startLabel = formatTimecodeForFilename(slice.start);
        const endLabel = formatTimecodeForFilename(slice.end);
        const pieceFileName = `${baseNameWithoutExt}_part${paddedIndex}_${startLabel}_to_${endLabel}${ext}`;
        const outputPiecePath = path.join(piecesDir, pieceFileName);
        const segmentDuration = slice.end - slice.start;

        let ffmpegArgs: string[] = [];

        if (!accurateCut) {
          // Fast Stream Copy (Lossless & instantaneous)
          // Note: using -ss before -i for input seeking, and -t for duration
          ffmpegArgs = [
            '-ss',
            slice.start.toFixed(3),
            '-t',
            segmentDuration.toFixed(3),
            '-i',
            metadata.filePath,
            '-c',
            'copy',
            '-map',
            '0',
            '-avoid_negative_ts',
            'make_zero',
            '-y',
            outputPiecePath,
          ];
        } else {
          // Frame-Exact Cut: Re-encode keyframe boundaries
          if (isVideo) {
            ffmpegArgs = [
              '-ss',
              slice.start.toFixed(3),
              '-t',
              segmentDuration.toFixed(3),
              '-i',
              metadata.filePath,
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-crf',
              '20',
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-y',
              outputPiecePath,
            ];
          } else {
            ffmpegArgs = [
              '-ss',
              slice.start.toFixed(3),
              '-t',
              segmentDuration.toFixed(3),
              '-i',
              metadata.filePath,
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-y',
              outputPiecePath,
            ];
          }
        }

        try {
          await execFileAsync('ffmpeg', ffmpegArgs);
        } catch (execErr: any) {
          // If stream copy failed due to container flags, fallback to re-encode for this piece
          console.warn(`Stream copy failed for slice ${pieceIndex}, attempting fallback encode...`, execErr.message);
          const fallbackArgs = isVideo
            ? [
                '-ss',
                slice.start.toFixed(3),
                '-t',
                segmentDuration.toFixed(3),
                '-i',
                metadata.filePath,
                '-c:v',
                'libx264',
                '-preset',
                'ultrafast',
                '-c:a',
                'aac',
                '-y',
                outputPiecePath,
              ]
            : [
                '-ss',
                slice.start.toFixed(3),
                '-t',
                segmentDuration.toFixed(3),
                '-i',
                metadata.filePath,
                '-c:a',
                'aac',
                '-y',
                outputPiecePath,
              ];
          await execFileAsync('ffmpeg', fallbackArgs);
        }

        let pieceSize = 0;
        try {
          pieceSize = fs.statSync(outputPiecePath).size;
        } catch {}

        generatedPieces.push({
          id: `piece_${fileId}_${pieceIndex}`,
          index: pieceIndex,
          fileName: pieceFileName,
          filePath: outputPiecePath,
          startTime: slice.start,
          endTime: slice.end,
          duration: segmentDuration,
          size: pieceSize,
        });
      }

      splitPiecesRegistry.set(fileId, generatedPieces);

      res.json({
        success: true,
        fileId,
        totalPieces: generatedPieces.length,
        pieces: generatedPieces.map((p) => ({
          id: p.id,
          index: p.index,
          fileName: p.fileName,
          startTime: p.startTime,
          endTime: p.endTime,
          duration: p.duration,
          size: p.size,
          downloadUrl: `/api/pieces/${fileId}/${p.index}?download=true`,
          previewUrl: `/api/pieces/${fileId}/${p.index}`,
        })),
        zipUrl: `/api/pieces/${fileId}/zip`,
      });
    } catch (err: any) {
      console.error('Split error:', err);
      res.status(500).json({ error: err.message || 'Failed to split media' });
    }
  });

  // 5. Download all pieces as a single ZIP archive
  app.get('/api/pieces/:fileId/zip', (req: Request, res: Response) => {
    const { fileId } = req.params;
    const metadata = fileRegistry.get(fileId);
    const pieces = splitPiecesRegistry.get(fileId);

    if (!metadata || !pieces || pieces.length === 0) {
      res.status(404).json({ error: 'No pieces available to zip' });
      return;
    }

    const baseName = path.parse(metadata.originalName).name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const zipName = `${baseName}_split_pieces_${pieces.length}_parts.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = new (ZipArchive as any)({
      zlib: { level: 5 }, // Moderate compression
    });

    archive.on('error', (err: any) => {
      console.error('Zip archive error:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: 'Error generating zip' });
      }
    });

    archive.pipe(res);

    for (const piece of pieces) {
      if (fs.existsSync(piece.filePath)) {
        archive.file(piece.filePath, { name: piece.fileName });
      }
    }

    archive.finalize();
  });

  // 6. Download or stream a single piece
  app.get('/api/pieces/:fileId/:pieceIndex', (req: Request, res: Response) => {
    const { fileId, pieceIndex } = req.params;
    const pieces = splitPiecesRegistry.get(fileId);

    if (!pieces) {
      res.status(404).json({ error: 'No split pieces found for this session' });
      return;
    }

    const indexNum = parseInt(pieceIndex, 10);
    const piece = pieces.find((p) => p.index === indexNum);

    if (!piece || !fs.existsSync(piece.filePath)) {
      res.status(404).json({ error: 'Piece not found' });
      return;
    }

    const isDownload = req.query.download === 'true';
    handleStreamMedia(req, res, piece.filePath, isDownload ? piece.fileName : undefined);
  });

  // 7. Cleanup task (periodic)
  setInterval(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [fileId, meta] of fileRegistry.entries()) {
      if (meta.createdAt < oneHourAgo) {
        try {
          if (fs.existsSync(meta.filePath)) fs.unlinkSync(meta.filePath);
          const piecesDir = path.join(UPLOADS_DIR, `pieces_${fileId}`);
          if (fs.existsSync(piecesDir)) {
            fs.rmSync(piecesDir, { recursive: true, force: true });
          }
        } catch {}
        fileRegistry.delete(fileId);
        splitPiecesRegistry.delete(fileId);
      }
    }
  }, 15 * 60 * 1000);

  // Mount Vite or serve static files
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SplitWave Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err: any) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
