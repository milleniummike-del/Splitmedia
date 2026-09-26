export interface AttachedImage {
  id: string;
  dataUrl: string;
  blob: Blob;
  fileName: string;
}

export interface ClientMediaFile {
  id: string;
  file: File | Blob;
  name: string;
  mediaType: 'video' | 'audio';
  duration: number; // in seconds
  size: number; // in bytes
  url: string; // Object URL
  videoDetails?: {
    width: number;
    height: number;
  };
  audioDetails?: {
    sampleRate: number;
    channels: number;
    audioBuffer?: AudioBuffer;
  };
}

export type SplitMode = 'fixed' | 'equal' | 'custom';

export interface SplitPiece {
  id: string;
  index: number;
  fileName: string;
  audioFileName: string;
  startTime: number;
  endTime: number;
  duration: number;
  audioBlob?: Blob;
  audioBlobUrl?: string;
  videoBlob?: Blob;
  videoBlobUrl?: string;
  isProcessing?: boolean;
  processProgress?: number;
  attachedImage?: AttachedImage;
  promptText?: string;
}

export interface SplitConfig {
  mode: SplitMode;
  intervalSeconds: number;
  equalPartsCount: number;
  customCutPoints: number[];
}
