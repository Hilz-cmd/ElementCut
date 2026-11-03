import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Resolution, Track, Clip } from '../types/editor';
import { renderCanvasFrame } from '../utils/canvasRenderer';
import { formatTimecode } from '../utils/keyframeMath';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronLeft, 
  ChevronRight, 
  Repeat, 
  Volume2, 
  VolumeX,
  Maximize2
} from 'lucide-react';

interface CanvasPreviewProps {
  resolution: Resolution;
  tracks: Track[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClipTransform?: (clipId: string, deltaX: number, deltaY: number) => void;
  showSafeZones: boolean;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  resolution,
  tracks,
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeek,
  selectedClipId,
  onSelectClip,
  onUpdateClipTransform,
  showSafeZones,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isLooping, setIsLooping] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Re-render canvas whenever currentTime, tracks, or resolution change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderCanvasFrame(ctx, resolution, tracks, currentTime, {
      showSafeZones,
      selectedClipId,
    });
  }, [resolution, tracks, currentTime, showSafeZones, selectedClipId]);

  // Keyboard shortcut listener (Space = play/pause, Left/Right = frame step)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        onPlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onSeek(Math.max(0, currentTime - (e.shiftKey ? 1.0 : 0.05)));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onSeek(Math.min(duration, currentTime + (e.shiftKey ? 1.0 : 0.05)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, onPlayPause, onSeek]);

  // Handle direct on-canvas positioning drag for selected clip
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedClipId || !onUpdateClipTransform) return;
    setIsDraggingCanvas(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingCanvas || !dragStartPos.current || !selectedClipId || !onUpdateClipTransform) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert screen drag delta to canvas resolution coordinate scale
    const rect = canvas.getBoundingClientRect();
    const scaleFactor = resolution.width / rect.width;

    const dx = (e.clientX - dragStartPos.current.x) * scaleFactor;
    const dy = (e.clientY - dragStartPos.current.y) * scaleFactor;

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    onUpdateClipTransform(selectedClipId, dx, dy);
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    dragStartPos.current = null;
  };

  const handleStepFrame = (frames: number) => {
    const frameDuration = 1 / 30;
    const newTime = Math.max(0, Math.min(duration, currentTime + frames * frameDuration));
    onSeek(newTime);
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-neutral-950 border-r border-neutral-800 overflow-hidden relative"
    >
      {/* Top stage info bar */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-neutral-900 bg-neutral-900/50 text-neutral-400 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-300">Preview</span>
          <span>·</span>
          <span>{resolution.label} ({resolution.width}×{resolution.height})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            title="Fullscreen Preview"
            className="p-1 hover:text-neutral-200 rounded hover:bg-neutral-800 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport Stage */}
      <div 
        className="flex-1 flex items-center justify-center p-3 relative overflow-hidden bg-[#07090e]"
        onMouseUp={handleMouseUp}
      >
        <div className="relative shadow-2xl shadow-black/80 flex items-center justify-center max-w-full max-h-full">
          <canvas
            ref={canvasRef}
            width={resolution.width}
            height={resolution.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            className={`rounded-lg bg-black object-contain ${
              resolution.aspectRatio === '9:16'
                ? 'aspect-[9/16] max-h-[calc(100vh-140px)]'
                : resolution.aspectRatio === '1:1'
                ? 'aspect-square max-h-[calc(100vh-140px)]'
                : 'aspect-[16/9] max-w-full max-h-[calc(100vh-140px)]'
            } ${selectedClipId ? 'cursor-move' : 'cursor-default'}`}
          />
        </div>
      </div>

      {/* Floating Bottom Transport Controls */}
      <div className="h-12 bg-neutral-900 border-t border-neutral-800 px-4 flex items-center justify-between shrink-0">
        {/* Current Timecode */}
        <div className="flex items-center gap-2 font-timecode text-xs">
          <span className="text-blue-400 font-semibold">{formatTimecode(currentTime)}</span>
          <span className="text-neutral-500">/</span>
          <span className="text-neutral-400">{formatTimecode(duration)}</span>
        </div>

        {/* Playback Transport Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSeek(0)}
            title="Jump to Start"
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleStepFrame(-1)}
            title="Step Back 1 Frame (Arrow Left)"
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={onPlayPause}
            title="Play / Pause (Space)"
            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => handleStepFrame(1)}
            title="Step Forward 1 Frame (Arrow Right)"
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSeek(duration)}
            title="Jump to End"
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Auxiliary toggles (Loop, Audio Mute) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLooping(!isLooping)}
            title={`Loop Playback: ${isLooping ? 'ON' : 'OFF'}`}
            className={`p-1.5 rounded transition-colors ${
              isLooping ? 'text-blue-400 bg-neutral-800' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className={`p-1.5 rounded transition-colors ${
              isMuted ? 'text-red-400 bg-neutral-800' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
