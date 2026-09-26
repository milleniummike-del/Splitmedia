# SplitWave - In-Browser Audio Splitter & Storyboard Slideshow

SplitWave is a precision audio and media splitting application running **100% in the browser**. Upload audio or video files without sending anything to a server, choose intervals in seconds (including 20s), lay out segments along a visual storyboard timeline with attached images and AI prompts, audition audio seamlessly like a slideshow, and download pieces individually or packaged in a ZIP archive.

## Key Features

- **Timeline Storyboard & Audio Slideshow**:
  - Each segment is arranged sequentially along an interactive visual timeline.
  - As audio plays, the main preview stage transitions from image to image in sync with the audio playhead, creating a dynamic slideshow preview.
  - "Play Full Slideshow" button continuously auditions the entire audio track with smooth segment image and prompt displays.
  - Segment cards show live progress indicators, playhead highlights, and timecodes (`00:00 → 00:20`).
- **Segment Prompt Text & Quick Suggestions**:
  - Each segment features an editable prompt text area for AI video workflows (Runway, Pika, Kling, Luma, Wan, etc.).
  - Default placeholder: `"The character follows the audio and lip syncs"`.
  - **Quick Prompt Pills**: One-click pills to instantly set:
    - `🗣️ The character follows the audio and lip syncs`
    - `🎵 The video follows the rhythm of the audio`
  - Global batch buttons to apply any prompt template across all segments with a single click.
  - Quick copy to clipboard button on every segment.
  - Active segment prompt is rendered as a clean subtitle banner in the live slideshow viewer.
  - Prompts are bundled directly into the exported ZIP archive as `prompts.txt` and inside `manifest.json`.
- **Instant Audio Auditioning & Extraction**:
  - Clicking "Audition" on any segment immediately plays the audio for that exact slice.
  - Extracts and slices audio from both audio files and video files (`MP4`, `WebM`, `MOV`, `MP3`, `WAV`, `AAC`, etc.) directly in memory into 16-bit PCM WAV blobs.
  - Instantaneous, zero-latency downloads with no hanging or server roundtrips.
- **Custom Image Attachment per Segment**:
  - Attach cover artwork, chapter illustrations, or slide images to any segment (`JPG`, `PNG`, `WEBP`, `GIF`).
  - View full-resolution artwork in lightbox modal, replace, or download individual images.
- **Choice of Seconds with 20s Option**:
  - Quick presets: **15s**, **20s**, **30s**, **60s**, **90s**, **120s**, **300s**.
  - Custom interval input with decimal support.
  - Equal parts and custom marker placement modes.
- **100% Client-Side Downloads & ZIP**:
  - Download individual segment audio (`.wav`) or attached artwork.
  - "Download All as ZIP": Pure in-browser archive generator using `JSZip` bundling all audio pieces, images, `prompts.txt`, and `manifest.json`.

## Technical Architecture

- **Audio Engine**: Web Audio API (`AudioContext`, `decodeAudioData`, in-memory 16-bit PCM WAV interleaver).
- **Packaging**: `JSZip` for client-side ZIP archive generation.
- **UI & Layout**: React 19, TypeScript, Tailwind CSS, Lucide icons, Plus Jakarta Sans & JetBrains Mono fonts.
