/**
 * 100% Browser-side Video Segment Recording, Snapshot Capture, and Sample Generation
 */

function getSupportedVideoMimeType(): string {
  const candidates = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4',
    'video/webm;codecs="vp9,opus"',
    'video/webm;codecs="vp8,opus"',
    'video/webm',
  ];

  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return 'video/webm';
}

/**
 * Extracts a high-res still image frame from a video at the specified timestamp
 */
export async function captureVideoFrame(
  videoSourceUrl: string,
  timestamp: number
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoSourceUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to generate image blob'));
            return;
          }
          cleanup();
          resolve({ blob, dataUrl });
        }, 'image/png');
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    const onError = (e: any) => {
      cleanup();
      reject(new Error('Failed to seek video for snapshot frame'));
    };

    const onLoadedMetadata = () => {
      video.currentTime = Math.max(0, Math.min(video.duration - 0.05, timestamp));
    };

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.pause();
      video.src = '';
      video.load();
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    // In case metadata is already loaded
    if (video.readyState >= 1) {
      onLoadedMetadata();
    }
  });
}

/**
 * Slices a video segment between startTime and endTime in the browser via MediaRecorder
 */
export async function captureVideoSegment(
  videoSourceUrl: string,
  startTime: number,
  endTime: number,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const segmentDuration = Math.max(0.1, endTime - startTime);

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoSourceUrl;
    video.crossOrigin = 'anonymous';
    video.muted = false; // Capture audio track as well
    video.preload = 'auto';
    video.playsInline = true;

    let mediaRecorder: MediaRecorder | null = null;
    const recordedChunks: Blob[] = [];
    let progressInterval: any = null;

    const cleanup = () => {
      if (progressInterval) clearInterval(progressInterval);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch {}
      }
      video.pause();
      video.src = '';
      video.load();
    };

    video.onloadedmetadata = () => {
      video.currentTime = startTime;
    };

    video.onseeked = () => {
      try {
        const stream = (video as any).captureStream
          ? (video as any).captureStream(30)
          : (video as any).mozCaptureStream
          ? (video as any).mozCaptureStream(30)
          : null;

        if (!stream) {
          cleanup();
          reject(new Error('Browser does not support video.captureStream()'));
          return;
        }

        const mimeType = getSupportedVideoMimeType();
        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000,
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const finalBlob = new Blob(recordedChunks, { type: mimeType });
          cleanup();
          resolve(finalBlob);
        };

        mediaRecorder.onerror = (event: any) => {
          cleanup();
          reject(new Error(event?.error?.message || 'MediaRecorder failed during video slicing'));
        };

        mediaRecorder.start(100); // 100ms timeslices
        video.play().catch((err) => {
          // If browser policy blocks autoplay with sound, mute temporarily
          video.muted = true;
          video.play().catch(() => {});
        });

        // Track progress and stop when reaching endTime
        progressInterval = setInterval(() => {
          const elapsed = video.currentTime - startTime;
          const percent = Math.min(100, Math.max(0, Math.round((elapsed / segmentDuration) * 100)));
          onProgress?.(percent);

          if (video.currentTime >= endTime || video.ended) {
            clearInterval(progressInterval);
            onProgress?.(100);
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }
        }, 50);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video element for slicing'));
    };

    if (video.readyState >= 1) {
      video.currentTime = startTime;
    }
  });
}

/**
 * Generates an animated 20-second test video 100% inside the browser
 */
export async function generateBrowserVideoSample(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const dest = audioCtx.createMediaStreamDestination();

  // Create oscillator beep
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.setValueAtTime(440, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(dest);
  osc.start();

  const canvasStream = canvas.captureStream(30);
  const audioTrack = dest.stream.getAudioTracks()[0];
  if (audioTrack) {
    canvasStream.addTrack(audioTrack);
  }

  const mimeType = getSupportedVideoMimeType();
  const recorder = new MediaRecorder(canvasStream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const durationSec = 20;
  let startTime = performance.now();

  return new Promise((resolve) => {
    recorder.onstop = () => {
      osc.stop();
      audioCtx.close();
      resolve(new Blob(chunks, { type: mimeType }));
    };

    recorder.start(100);

    const render = () => {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      if (elapsed >= durationSec) {
        recorder.stop();
        return;
      }

      // Draw futuristic synth-wave grid & timer
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Rotating geometric hexagon
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(elapsed * 1.5);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const r = 70 + Math.sin(elapsed * 4) * 15;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Text HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SplitWave Browser Sample', canvas.width / 2, 70);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '16px monospace';
      ctx.fillText(`Timestamp: ${elapsed.toFixed(2)}s / 20.00s`, canvas.width / 2, 105);

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(canvas.width / 2 - 100, 290, (elapsed / durationSec) * 200, 8);
      ctx.strokeStyle = '#3f3f46';
      ctx.strokeRect(canvas.width / 2 - 100, 290, 200, 8);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  });
}
