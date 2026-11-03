import React, { useRef, useState, useEffect } from 'react';
import { Clip, Track, KeyframableProperty } from '../../types/editor';
import { formatTimecode } from '../../utils/keyframeMath';
import { 
  Scissors, 
  Trash2, 
  Magnet, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Plus, 
  Volume2, 
  VolumeX, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Video, 
  Type, 
  Music 
} from 'lucide-react';

interface TimelineProps {
  tracks: Track[];
  currentTime: number;
  duration: number;
  selectedClipId: string | null;
  magnetEnabled: boolean;
  onToggleMagnet: () => void;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateTracks: (newTracks: Track[]) => void;
  onSplitClip: () => void;
  onDeleteClip: (clipId: string) => void;
  onAddTrack: (type: 'video' | 'audio' | 'text') => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  tracks,
  currentTime,
  duration,
  selectedClipId,
  magnetEnabled,
  onToggleMagnet,
  onSeek,
  onSelectClip,
  onUpdateTracks,
  onSplitClip,
  onDeleteClip,
  onAddTrack,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);

  // Zoom level: pixels per second (e.g. 60px = 1s)
  const [zoom, setZoom] = useState(60);

  // Active interaction drag state
  const [dragAction, setDragAction] = useState<{
    type: 'move' | 'trim-start' | 'trim-end' | 'scrub';
    clipId?: string;
    trackId?: string;
    startX: number;
    initialStart?: number;
    initialDuration?: number;
    initialSourceOffset?: number;
  } | null>(null);

  // Fit timeline to current container width
  const handleFitZoom = () => {
    if (lanesRef.current) {
      const containerWidth = lanesRef.current.clientWidth - 100;
      const targetDuration = Math.max(8, duration + 2);
      const calculatedZoom = Math.max(20, Math.min(200, containerWidth / targetDuration));
      setZoom(calculatedZoom);
    }
  };

  // Keyboard shortcut listener for Cut (S/C) and Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        onSplitClip();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          onDeleteClip(selectedClipId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, onSplitClip, onDeleteClip]);

  // Snapping / Magnet logic helper
  const calculateMagneticSnap = (targetTime: number, clipDuration: number, excludeClipId?: string): number => {
    if (!magnetEnabled) return Math.max(0, targetTime);

    const snapThresholdSec = 10 / zoom; // ~10 pixels
    const snapCandidates: number[] = [0, currentTime];

    tracks.forEach((t) => {
      t.clips.forEach((c) => {
        if (c.id !== excludeClipId) {
          snapCandidates.push(c.start);
          snapCandidates.push(c.start + c.duration);
        }
      });
    });

    let snappedStart = targetTime;
    let minDistance = snapThresholdSec;

    // Check snapping clip start to candidates
    for (const cand of snapCandidates) {
      const dist = Math.abs(targetTime - cand);
      if (dist < minDistance) {
        minDistance = dist;
        snappedStart = cand;
      }
    }

    // Check snapping clip end to candidates
    for (const cand of snapCandidates) {
      const dist = Math.abs(targetTime + clipDuration - cand);
      if (dist < minDistance) {
        minDistance = dist;
        snappedStart = cand - clipDuration;
      }
    }

    return Math.max(0, snappedStart);
  };

  // Window mouse move listener for smooth drag handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragAction) return;

      const deltaX = e.clientX - dragAction.startX;
      const deltaTime = deltaX / zoom;

      if (dragAction.type === 'scrub') {
        if (lanesRef.current) {
          const rect = lanesRef.current.getBoundingClientRect();
          const clickX = e.clientX - rect.left + lanesRef.current.scrollLeft;
          const newTime = Math.max(0, Math.min(duration + 10, clickX / zoom));
          onSeek(newTime);
        }
      } else if (dragAction.type === 'move' && dragAction.clipId && dragAction.initialStart !== undefined && dragAction.initialDuration !== undefined) {
        const rawNewStart = dragAction.initialStart + deltaTime;
        const snappedStart = calculateMagneticSnap(rawNewStart, dragAction.initialDuration, dragAction.clipId);

        onUpdateTracks(
          tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === dragAction.clipId ? { ...clip, start: snappedStart } : clip
            ),
          }))
        );
      } else if (dragAction.type === 'trim-start' && dragAction.clipId && dragAction.initialStart !== undefined && dragAction.initialDuration !== undefined && dragAction.initialSourceOffset !== undefined) {
        let newStart = dragAction.initialStart + deltaTime;
        if (newStart < 0) newStart = 0;

        const maxStart = dragAction.initialStart + dragAction.initialDuration - 0.2;
        newStart = Math.min(newStart, maxStart);

        if (magnetEnabled) {
          newStart = calculateMagneticSnap(newStart, 0, dragAction.clipId);
        }

        const addedStart = newStart - dragAction.initialStart;
        const newDuration = Math.max(0.2, dragAction.initialDuration - addedStart);
        const newSourceOffset = Math.max(0, dragAction.initialSourceOffset + addedStart);

        onUpdateTracks(
          tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === dragAction.clipId
                ? {
                    ...clip,
                    start: newStart,
                    duration: newDuration,
                    sourceOffset: newSourceOffset,
                  }
                : clip
            ),
          }))
        );
      } else if (dragAction.type === 'trim-end' && dragAction.clipId && dragAction.initialStart !== undefined && dragAction.initialDuration !== undefined) {
        let newDuration = dragAction.initialDuration + deltaTime;
        newDuration = Math.max(0.2, newDuration);

        if (magnetEnabled) {
          const potentialEnd = dragAction.initialStart + newDuration;
          const snappedEnd = calculateMagneticSnap(potentialEnd, 0, dragAction.clipId);
          newDuration = Math.max(0.2, snappedEnd - dragAction.initialStart);
        }

        onUpdateTracks(
          tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === dragAction.clipId ? { ...clip, duration: newDuration } : clip
            ),
          }))
        );
      }
    };

    const handleMouseUp = () => {
      setDragAction(null);
    };

    if (dragAction) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragAction, zoom, tracks, magnetEnabled, duration, onSeek, onUpdateTracks]);

  // Handle starting a clip move drag
  const startClipMove = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();
    onSelectClip(clip.id);
    setDragAction({
      type: 'move',
      clipId: clip.id,
      trackId: clip.trackId,
      startX: e.clientX,
      initialStart: clip.start,
      initialDuration: clip.duration,
    });
  };

  // Handle starting a left trim handle drag
  const startTrimStart = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();
    onSelectClip(clip.id);
    setDragAction({
      type: 'trim-start',
      clipId: clip.id,
      startX: e.clientX,
      initialStart: clip.start,
      initialDuration: clip.duration,
      initialSourceOffset: clip.sourceOffset,
    });
  };

  // Handle starting a right trim handle drag
  const startTrimEnd = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();
    onSelectClip(clip.id);
    setDragAction({
      type: 'trim-end',
      clipId: clip.id,
      startX: e.clientX,
      initialStart: clip.start,
      initialDuration: clip.duration,
    });
  };

  // Handle clicking ruler to scrub
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    if (!lanesRef.current) return;
    const rect = lanesRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + lanesRef.current.scrollLeft;
    const newTime = Math.max(0, clickX / zoom);
    onSeek(newTime);
    setDragAction({
      type: 'scrub',
      startX: e.clientX,
    });
  };

  const totalTimelineWidth = Math.max(1200, (duration + 5) * zoom);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-neutral-900 border-t border-neutral-800 overflow-hidden select-none"
    >
      {/* Timeline Action Toolbar */}
      <div className="h-10 bg-neutral-900 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Split / Cut Button */}
          <button
            onClick={onSplitClip}
            title="Split Clip at Playhead (S)"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 text-blue-400" />
            <span>Split</span>
          </button>

          {/* Delete Button */}
          <button
            onClick={() => selectedClipId && onDeleteClip(selectedClipId)}
            disabled={!selectedClipId}
            title="Delete Selected Clip (Delete)"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-800 hover:bg-red-500/20 hover:text-red-300 text-neutral-400 border border-neutral-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          {/* Magnetic Snapping Toggle */}
          <button
            onClick={onToggleMagnet}
            title={`Magnet Snapping: ${magnetEnabled ? 'ON' : 'OFF'} (Clips snap automatically)`}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              magnetEnabled
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-500'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Magnet: {magnetEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Zoom and Fit Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(20, zoom - 15))}
            title="Zoom Out"
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={20}
            max={200}
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value))}
            className="w-20 h-1 bg-neutral-800 rounded appearance-none cursor-pointer accent-blue-600"
          />

          <button
            onClick={() => setZoom(Math.min(200, zoom + 15))}
            title="Zoom In"
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleFitZoom}
            title="Fit Timeline to Screen"
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Timeline Workspace: Left Track Headers & Right Track Lanes */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Track Headers (Left sidebar) */}
        <div className="w-44 bg-neutral-950 border-r border-neutral-800 shrink-0 flex flex-col z-10 select-none">
          {/* Header top ruler spacer */}
          <div className="h-7 border-b border-neutral-800 bg-neutral-900/60 px-3 flex items-center justify-between text-[11px] font-semibold text-neutral-400">
            <span>TRACKS</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAddTrack('video')}
                title="Add Video Track"
                className="hover:text-blue-400"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Track Labels */}
          <div className="flex-1 overflow-y-auto">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="h-14 border-b border-neutral-850 px-3 flex items-center justify-between hover:bg-neutral-900/40 transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-neutral-500">
                    {track.type === 'video' ? (
                      <Video className="w-3.5 h-3.5" />
                    ) : track.type === 'text' ? (
                      <Type className="w-3.5 h-3.5" />
                    ) : (
                      <Music className="w-3.5 h-3.5" />
                    )}
                  </span>
                  <span className="text-xs font-medium text-neutral-300 truncate max-w-[80px]">
                    {track.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-neutral-500">
                  <button
                    onClick={() =>
                      onUpdateTracks(
                        tracks.map((t) =>
                          t.id === track.id ? { ...t, isMuted: !t.isMuted } : t
                        )
                      )
                    }
                    className="p-1 hover:text-white rounded"
                    title={track.isMuted ? 'Unmute' : 'Mute'}
                  >
                    {track.isMuted ? (
                      <VolumeX className="w-3 h-3 text-red-400" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    onClick={() =>
                      onUpdateTracks(
                        tracks.map((t) =>
                          t.id === track.id ? { ...t, isHidden: !t.isHidden } : t
                        )
                      )
                    }
                    className="p-1 hover:text-white rounded"
                    title={track.isHidden ? 'Unhide' : 'Hide'}
                  >
                    {track.isHidden ? (
                      <EyeOff className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Track Lanes and Time Ruler (Scrollable right area) */}
        <div
          ref={lanesRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#0a0d14]"
          onClick={() => onSelectClip(null)}
        >
          {/* Time Ruler */}
          <div
            className="h-7 border-b border-neutral-800 sticky top-0 bg-neutral-900/90 backdrop-blur-xs z-20 cursor-pointer flex items-center relative"
            style={{ width: `${totalTimelineWidth}px` }}
            onMouseDown={handleRulerMouseDown}
          >
            {/* Tick marks every second */}
            {Array.from({ length: Math.ceil(duration + 8) }).map((_, sec) => (
              <div
                key={sec}
                className="absolute top-0 bottom-0 border-l border-neutral-700/60 pl-1 text-[10px] font-timecode text-neutral-400 select-none pointer-events-none"
                style={{ left: `${sec * zoom}px` }}
              >
                {formatTimecode(sec).slice(0, 5)}
              </div>
            ))}
          </div>

          {/* Red Playhead Vertical Marker */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none"
            style={{ left: `${currentTime * zoom}px` }}
          >
            {/* Playhead Top Knob */}
            <div className="w-3 h-3 bg-red-500 rotate-45 -translate-x-1.5 -translate-y-1 shadow-md shadow-red-500/50" />
            {/* Playhead Line */}
            <div className="w-[2px] h-full bg-red-500/90 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          </div>

          {/* Multi-Track Lanes Container */}
          <div style={{ width: `${totalTimelineWidth}px` }}>
            {tracks.map((track) => (
              <div
                key={track.id}
                className={`h-14 border-b border-neutral-800/80 relative transition-colors ${
                  track.isHidden ? 'opacity-30' : ''
                }`}
              >
                {/* Visual grid vertical tick guides */}
                {Array.from({ length: Math.ceil(duration + 8) }).map((_, sec) => (
                  <div
                    key={sec}
                    className="absolute top-0 bottom-0 border-l border-neutral-850 pointer-events-none"
                    style={{ left: `${sec * zoom}px` }}
                  />
                ))}

                {/* Track Clips */}
                {track.clips.map((clip) => {
                  const clipLeft = clip.start * zoom;
                  const clipWidth = Math.max(16, clip.duration * zoom);
                  const isSelected = selectedClipId === clip.id;

                  // Collect all keyframe relative positions for diamond indicators
                  const keyframeOffsets: { prop: string; time: number; left: number }[] = [];
                  Object.entries(clip.transform.keyframes).forEach(([prop, list]) => {
                    (list || []).forEach((kf) => {
                      keyframeOffsets.push({
                        prop,
                        time: kf.time,
                        left: (kf.time / clip.duration) * 100,
                      });
                    });
                  });

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(clip.id);
                      }}
                      onMouseDown={(e) => startClipMove(e, clip)}
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`,
                      }}
                      className={`absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between overflow-hidden cursor-move select-none transition-shadow ${
                        isSelected
                          ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/30'
                          : 'border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Clip background color based on type/setting */}
                      <div
                        className="absolute inset-0 opacity-80"
                        style={{ backgroundColor: clip.color || '#2563eb' }}
                      />

                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => startTrimStart(e, clip)}
                        className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-white/60 cursor-ew-resize transition-all z-10"
                        title="Drag to trim start"
                      />

                      {/* Content Label */}
                      <div className="relative z-1 flex items-center gap-1.5 overflow-hidden pointer-events-none">
                        <span className="text-[11px] font-semibold text-white truncate max-w-[140px] drop-shadow-md">
                          {clip.name}
                        </span>
                        <span className="text-[10px] font-timecode text-white/70">
                          {formatTimecode(clip.duration)}
                        </span>
                      </div>

                      {/* Diamond Keyframe Markers rendered on clip surface */}
                      <div className="absolute inset-0 pointer-events-none flex items-center">
                        {keyframeOffsets.map((kfo, idx) => (
                          <div
                            key={idx}
                            style={{ left: `${kfo.left}%` }}
                            className="absolute -translate-x-1/2 text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                            title={`Keyframe: ${kfo.prop} @ ${formatTimecode(kfo.time)}`}
                          >
                            <span className="text-[12px] font-bold">◇</span>
                          </div>
                        ))}
                      </div>

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => startTrimEnd(e, clip)}
                        className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-white/60 cursor-ew-resize transition-all z-10"
                        title="Drag to trim end"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
