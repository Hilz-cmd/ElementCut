export type AspectRatio = '9:16' | '1:1' | '16:9';

export interface Resolution {
  width: number;
  height: number;
  label: string;
  aspectRatio: AspectRatio;
}

export const RESOLUTION_PRESETS: Record<AspectRatio, Resolution> = {
  '9:16': { width: 1080, height: 1920, label: '9:16 Shorts / Reels', aspectRatio: '9:16' },
  '1:1': { width: 1080, height: 1080, label: '1:1 Square Feed', aspectRatio: '1:1' },
  '16:9': { width: 1920, height: 1080, label: '16:9 Landscape', aspectRatio: '16:9' },
};

export type MediaType = 'video' | 'image' | 'audio' | 'text';

export interface Keyframe {
  id: string;
  time: number; // Time relative to clip start in seconds
  value: number; // Evaluated numeric value
}

export type KeyframableProperty = 'posX' | 'posY' | 'scale' | 'opacity' | 'volume';

export interface ClipTransform {
  posX: number;      // Offset in canvas pixels from center
  posY: number;      // Offset in canvas pixels from center
  scale: number;     // 1.0 = 100%
  opacity: number;   // 0.0 to 1.0
  volume: number;    // 0.0 to 1.0 (for audio/video)
  keyframes: {
    posX?: Keyframe[];
    posY?: Keyframe[];
    scale?: Keyframe[];
    opacity?: Keyframe[];
    volume?: Keyframe[];
  };
}

export interface TextProperties {
  text: string;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  letterSpacing?: number;
}

export interface Clip {
  id: string;
  trackId: string;
  type: MediaType;
  name: string;
  start: number;          // Timeline placement start time in seconds
  duration: number;       // Duration on timeline in seconds
  sourceOffset: number;   // Offset into source media (for trimmed video/audio)
  sourceDuration?: number;// Total duration of original source
  src?: string;           // Blob or data URL for video, audio, image
  mediaElement?: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
  transform: ClipTransform;
  textProperties?: TextProperties;
  color: string;          // Color accent in timeline
  thumbnail?: string;
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text';
  isMuted?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
  clips: Clip[];
}

export interface EditorHistoryState {
  tracks: Track[];
  selectedClipId: string | null;
}
