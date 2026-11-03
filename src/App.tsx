import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AspectRatio, 
  Resolution, 
  RESOLUTION_PRESETS, 
  Track, 
  Clip, 
  KeyframableProperty,
  Keyframe 
} from './types/editor';
import { 
  createInitialProject, 
  createStickerSvg, 
  generateSyntheticAudio, 
  generateSyntheticVideo 
} from './utils/starterMedia';
import { Header } from './components/Header';
import { CanvasPreview } from './components/CanvasPreview';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Timeline } from './components/Timeline/Timeline';
import { ExportModal } from './components/ExportModal';
import { exportToMp4, ExportProgress } from './utils/exportMp4';
import { evaluatePropertyAtTime, findKeyframeNear } from './utils/keyframeMath';

export default function App() {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const resolution: Resolution = RESOLUTION_PRESETS[aspectRatio];

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(8);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [magnetEnabled, setMagnetEnabled] = useState<boolean>(true);
  const [showSafeZones, setShowSafeZones] = useState<boolean>(true);

  // Export state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [completedBlob, setCompletedBlob] = useState<Blob | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Playback animation reference
  const lastPlayTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Audio preview playback sync
  const activeAudioElements = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Initialize preloaded starter project
  useEffect(() => {
    let isMounted = true;
    createInitialProject().then((initialTracks) => {
      if (isMounted) {
        setTracks(initialTracks);
        // Select initial text clip for immediate preview
        setSelectedClipId('clip-text-hook');
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Recalculate total duration whenever clips change
  useEffect(() => {
    let maxEnd = 6.0;
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        const clipEnd = clip.start + clip.duration;
        if (clipEnd > maxEnd) maxEnd = clipEnd;
      });
    });
    setDuration(Math.ceil(maxEnd * 10) / 10);
  }, [tracks]);

  // Synchronize audio elements with timeline playback
  useEffect(() => {
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if ((clip.type === 'audio' || clip.type === 'video') && clip.src) {
          let audioEl = activeAudioElements.current.get(clip.id);
          if (!audioEl) {
            audioEl = new Audio(clip.src);
            activeAudioElements.current.set(clip.id, audioEl);
          }

          const isClipActive = !track.isMuted && currentTime >= clip.start && currentTime < clip.start + clip.duration;

          if (isPlaying && isClipActive) {
            const clipRelativeTime = currentTime - clip.start;
            const targetAudioTime = clip.sourceOffset + clipRelativeTime;

            // Sync volume keyframes
            const vol = evaluatePropertyAtTime(clip, 'volume', clipRelativeTime);
            audioEl.volume = Math.max(0, Math.min(1, vol));

            if (Math.abs(audioEl.currentTime - targetAudioTime) > 0.15) {
              audioEl.currentTime = targetAudioTime;
            }

            if (audioEl.paused) {
              audioEl.play().catch(() => {});
            }
          } else {
            if (!audioEl.paused) {
              audioEl.pause();
            }
          }
        }
      });
    });
  }, [currentTime, isPlaying, tracks]);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      lastPlayTimeRef.current = performance.now();

      const loop = (now: number) => {
        if (lastPlayTimeRef.current !== null) {
          const deltaSec = (now - lastPlayTimeRef.current) / 1000;
          lastPlayTimeRef.current = now;

          setCurrentTime((prev) => {
            const next = prev + deltaSec;
            if (next >= duration) {
              return 0; // Loop seamlessly
            }
            return next;
          });
        }
        animationFrameRef.current = requestAnimationFrame(loop);
      };

      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      lastPlayTimeRef.current = null;
      // Pause all audio
      activeAudioElements.current.forEach((a) => a.pause());
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration]);

  // Find currently selected clip object
  const selectedClip = React.useMemo(() => {
    if (!selectedClipId) return null;
    for (const track of tracks) {
      const match = track.clips.find((c) => c.id === selectedClipId);
      if (match) return match;
    }
    return null;
  }, [tracks, selectedClipId]);

  // Update clip properties
  const handleUpdateClip = useCallback((updatedClip: Clip) => {
    setTracks((prev) =>
      prev.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === updatedClip.id ? updatedClip : clip
        ),
      }))
    );
  }, []);

  // Canvas direct drag update for position
  const handleUpdateClipTransform = useCallback(
    (clipId: string, deltaX: number, deltaY: number) => {
      setTracks((prev) =>
        prev.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            const newX = Math.round(clip.transform.posX + deltaX);
            const newY = Math.round(clip.transform.posY + deltaY);

            const clipRelTime = Math.max(0, Math.min(clip.duration, currentTime - clip.start));
            const nearKfX = findKeyframeNear(clip.transform.keyframes.posX, clipRelTime);
            const nearKfY = findKeyframeNear(clip.transform.keyframes.posY, clipRelTime);

            let kf = { ...clip.transform.keyframes };
            if (nearKfX) {
              kf.posX = (kf.posX || []).map((k) =>
                k.id === nearKfX.id ? { ...k, value: newX } : k
              );
            }
            if (nearKfY) {
              kf.posY = (kf.posY || []).map((k) =>
                k.id === nearKfY.id ? { ...k, value: newY } : k
              );
            }

            return {
              ...clip,
              transform: {
                ...clip.transform,
                posX: newX,
                posY: newY,
                keyframes: kf,
              },
            };
          }),
        }))
      );
    },
    [currentTime]
  );

  // Split clip at playhead
  const handleSplitClip = useCallback(() => {
    let targetClip: Clip | null = null;
    let targetTrackId: string | null = null;

    if (selectedClipId) {
      for (const t of tracks) {
        const c = t.clips.find((item) => item.id === selectedClipId);
        if (c && currentTime > c.start && currentTime < c.start + c.duration) {
          targetClip = c;
          targetTrackId = t.id;
          break;
        }
      }
    }

    // If selected clip isn't at playhead, find the topmost clip under playhead
    if (!targetClip) {
      for (const t of tracks) {
        const c = t.clips.find(
          (item) => currentTime > item.start && currentTime < item.start + item.duration
        );
        if (c) {
          targetClip = c;
          targetTrackId = t.id;
          break;
        }
      }
    }

    if (!targetClip || !targetTrackId) return;

    const splitOffset = currentTime - targetClip.start;
    const firstDuration = splitOffset;
    const secondDuration = targetClip.duration - splitOffset;

    const firstClip: Clip = {
      ...targetClip,
      duration: firstDuration,
      transform: {
        ...targetClip.transform,
        keyframes: splitKeyframes(targetClip.transform.keyframes, 0, splitOffset),
      },
    };

    const secondClipId = `clip-${Date.now()}`;
    const secondClip: Clip = {
      ...targetClip,
      id: secondClipId,
      name: `${targetClip.name} (Part 2)`,
      start: currentTime,
      duration: secondDuration,
      sourceOffset: targetClip.sourceOffset + splitOffset,
      transform: {
        ...targetClip.transform,
        keyframes: splitKeyframes(targetClip.transform.keyframes, splitOffset, targetClip.duration, -splitOffset),
      },
    };

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== targetTrackId) return t;
        const newClips = t.clips.flatMap((c) =>
          c.id === targetClip!.id ? [firstClip, secondClip] : [c]
        );
        return { ...t, clips: newClips };
      })
    );

    setSelectedClipId(secondClipId);
  }, [selectedClipId, currentTime, tracks]);

  // Helper to slice keyframes during split
  function splitKeyframes(
    keyframes: Clip['transform']['keyframes'],
    startTime: number,
    endTime: number,
    timeOffset = 0
  ) {
    const result: Clip['transform']['keyframes'] = {};
    (Object.keys(keyframes) as KeyframableProperty[]).forEach((prop) => {
      const list = keyframes[prop];
      if (list) {
        result[prop] = list
          .filter((kf) => kf.time >= startTime && kf.time <= endTime)
          .map((kf) => ({
            ...kf,
            id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            time: Math.max(0, kf.time + timeOffset),
          }));
      }
    });
    return result;
  }

  // Delete clip
  const handleDeleteClip = useCallback((clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }))
    );
    setSelectedClipId(null);
  }, []);

  // Duplicate clip
  const handleDuplicateClip = useCallback((clip: Clip) => {
    const newId = `clip-${Date.now()}`;
    const duplicated: Clip = {
      ...clip,
      id: newId,
      name: `${clip.name} (Copy)`,
      start: clip.start + clip.duration + 0.2,
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === clip.trackId ? { ...t, clips: [...t.clips, duplicated] } : t
      )
    );
    setSelectedClipId(newId);
  }, []);

  // Add text clip
  const handleAddTextClip = useCallback(() => {
    let textTrack = tracks.find((t) => t.type === 'text');
    let updatedTracks = [...tracks];

    if (!textTrack) {
      textTrack = {
        id: `track-text-${Date.now()}`,
        name: 'Text & Titles',
        type: 'text',
        clips: [],
      };
      updatedTracks.unshift(textTrack);
    }

    const newId = `clip-text-${Date.now()}`;
    const newTextClip: Clip = {
      id: newId,
      trackId: textTrack.id,
      type: 'text',
      name: 'Dynamic Text Hook',
      start: currentTime,
      duration: 3.5,
      sourceOffset: 0,
      color: '#8b5cf6',
      textProperties: {
        text: 'ENTER TEXT HERE ✨',
        fontSize: 48,
        fontFamily: 'Outfit',
        isBold: true,
        isItalic: false,
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        textAlign: 'center',
        letterSpacing: 1,
      },
      transform: {
        posX: 0,
        posY: -100,
        scale: 1.0,
        opacity: 1.0,
        volume: 1.0,
        keyframes: {
          scale: [
            { id: `kf-${Date.now()}-1`, time: 0, value: 0.8 },
            { id: `kf-${Date.now()}-2`, time: 0.3, value: 1.05 },
          ],
        },
      },
    };

    const finalTracks = updatedTracks.map((t) =>
      t.id === textTrack!.id ? { ...t, clips: [...t.clips, newTextClip] } : t
    );

    setTracks(finalTracks);
    setSelectedClipId(newId);
  }, [tracks, currentTime]);

  // Import local user files (video, audio, image)
  const handleImportFiles = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => {
        const fileUrl = URL.createObjectURL(file);
        const fileName = file.name;
        const fileType = file.type;

        let mediaType: Clip['type'] = 'video';
        let targetTrackType: Track['type'] = 'video';
        let color = '#2563eb';

        if (fileType.startsWith('audio/')) {
          mediaType = 'audio';
          targetTrackType = 'audio';
          color = '#10b981';
        } else if (fileType.startsWith('image/')) {
          mediaType = 'image';
          targetTrackType = 'video';
          color = '#f59e0b';
        }

        // Find or create suitable track
        let track = tracks.find((t) => t.type === targetTrackType);
        let currentTracks = [...tracks];

        if (!track) {
          track = {
            id: `track-${targetTrackType}-${Date.now()}`,
            name: `${targetTrackType.toUpperCase()} Track`,
            type: targetTrackType,
            clips: [],
          };
          currentTracks.push(track);
        }

        const newId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const newClip: Clip = {
          id: newId,
          trackId: track.id,
          type: mediaType,
          name: fileName,
          start: currentTime,
          duration: mediaType === 'image' ? 4.0 : 6.0,
          sourceOffset: 0,
          src: fileUrl,
          color,
          transform: {
            posX: 0,
            posY: 0,
            scale: 1.0,
            opacity: 1.0,
            volume: 1.0,
            keyframes: {},
          },
        };

        const updated = currentTracks.map((t) =>
          t.id === track!.id ? { ...t, clips: [...t.clips, newClip] } : t
        );

        setTracks(updated);
        setSelectedClipId(newId);
      });
    },
    [tracks, currentTime]
  );

  // Insert sample clip from library
  const handleInsertSample = useCallback(
    async (type: 'cyber' | 'sunset' | 'trap' | 'lofi' | 'whoosh' | 'sticker') => {
      if (type === 'sticker') {
        const stickerSvg = createStickerSvg('lightning');
        const overlayTrack = tracks.find((t) => t.name.includes('Overlay') || t.type === 'video') || tracks[0];
        const newClip: Clip = {
          id: `clip-sticker-${Date.now()}`,
          trackId: overlayTrack.id,
          type: 'image',
          name: 'Lightning Badge',
          start: currentTime,
          duration: 3.0,
          sourceOffset: 0,
          src: stickerSvg,
          color: '#eab308',
          transform: {
            posX: 0,
            posY: 80,
            scale: 1.0,
            opacity: 1.0,
            volume: 1.0,
            keyframes: {
              scale: [
                { id: `kf-${Date.now()}-1`, time: 0, value: 0.3 },
                { id: `kf-${Date.now()}-2`, time: 0.3, value: 1.1 },
                { id: `kf-${Date.now()}-3`, time: 0.5, value: 1.0 },
              ],
            },
          },
        };

        setTracks((prev) =>
          prev.map((t) => (t.id === overlayTrack.id ? { ...t, clips: [...t.clips, newClip] } : t))
        );
        setSelectedClipId(newClip.id);
      } else if (type === 'lofi' || type === 'trap' || type === 'whoosh') {
        const audioUrl = await generateSyntheticAudio(type, type === 'whoosh' ? 3 : 8);
        const audioTrack = tracks.find((t) => t.type === 'audio') || tracks[tracks.length - 1];
        const newClip: Clip = {
          id: `clip-audio-${Date.now()}`,
          trackId: audioTrack.id,
          type: 'audio',
          name: `${type.toUpperCase()} Beat.wav`,
          start: currentTime,
          duration: type === 'whoosh' ? 3 : 8,
          sourceOffset: 0,
          src: audioUrl,
          color: '#10b981',
          transform: {
            posX: 0,
            posY: 0,
            scale: 1.0,
            opacity: 1.0,
            volume: 0.9,
            keyframes: {},
          },
        };

        setTracks((prev) =>
          prev.map((t) => (t.id === audioTrack.id ? { ...t, clips: [...t.clips, newClip] } : t))
        );
        setSelectedClipId(newClip.id);
      } else {
        // Video clip
        const videoTrack = tracks.find((t) => t.type === 'video') || tracks[0];
        const newClip: Clip = {
          id: `clip-video-${Date.now()}`,
          trackId: videoTrack.id,
          type: 'video',
          name: type === 'cyber' ? 'Cyber Grid Loop' : 'Sunset Horizon Loop',
          start: currentTime,
          duration: 6.0,
          sourceOffset: 0,
          color: '#2563eb',
          transform: {
            posX: 0,
            posY: 0,
            scale: 1.0,
            opacity: 1.0,
            volume: 1.0,
            keyframes: {},
          },
        };

        setTracks((prev) =>
          prev.map((t) => (t.id === videoTrack.id ? { ...t, clips: [...t.clips, newClip] } : t))
        );
        setSelectedClipId(newClip.id);
      }
    },
    [tracks, currentTime]
  );

  // Add new track
  const handleAddTrack = useCallback((type: 'video' | 'audio' | 'text') => {
    const newTrack: Track = {
      id: `track-${type}-${Date.now()}`,
      name: `${type === 'video' ? 'Video' : type === 'audio' ? 'Audio' : 'Text'} Lane ${tracks.length + 1}`,
      type,
      clips: [],
    };
    setTracks((prev) => [newTrack, ...prev]);
  }, [tracks.length]);

  // Launch MP4 Export
  const handleExportClick = useCallback(async () => {
    setIsPlaying(false);
    setIsExportModalOpen(true);
    setCompletedBlob(null);
    setIsExporting(true);
    setExportProgress({
      progress: 0,
      currentTime: 0,
      totalTime: duration,
      status: 'Initializing MP4 rendering pipeline...',
    });

    try {
      const blob = await exportToMp4(
        resolution,
        tracks,
        duration,
        30,
        (p) => setExportProgress(p)
      );
      setCompletedBlob(blob);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please check browser permissions and media codecs.');
    } finally {
      setIsExporting(false);
    }
  }, [resolution, tracks, duration]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 select-none">
      {/* Top Bar with brand, aspect switch, import & export */}
      <Header
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        showSafeZones={showSafeZones}
        onToggleSafeZones={() => setShowSafeZones(!showSafeZones)}
        onAddTextClip={handleAddTextClip}
        onImportFiles={handleImportFiles}
        onInsertSample={handleInsertSample}
        onExportClick={handleExportClick}
        isExporting={isExporting}
      />

      {/* Main Studio Viewport: Left Canvas Preview, Right Top Properties & Bottom Timeline */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Column: Video Preview Player (42% width) */}
        <div className="w-[42%] h-full flex flex-col border-r border-neutral-800">
          <CanvasPreview
            resolution={resolution}
            tracks={tracks}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onSeek={setCurrentTime}
            selectedClipId={selectedClipId}
            onSelectClip={setSelectedClipId}
            onUpdateClipTransform={handleUpdateClipTransform}
            showSafeZones={showSafeZones}
          />
        </div>

        {/* Right Column: Stacked Inspector (Top Right) & Multi-Track Timeline (Bottom Right) (58% width) */}
        <div className="w-[58%] h-full flex flex-col overflow-hidden">
          {/* Top Right: Properties Inspector */}
          <div className="h-[46%] border-b border-neutral-800 overflow-hidden">
            <PropertiesPanel
              selectedClip={selectedClip}
              currentTime={currentTime}
              onUpdateClip={handleUpdateClip}
              onDeleteClip={handleDeleteClip}
              onDuplicateClip={handleDuplicateClip}
              onSeek={setCurrentTime}
            />
          </div>

          {/* Bottom Right: Multi-Track Timeline */}
          <div className="h-[54%] overflow-hidden flex flex-col">
            <Timeline
              tracks={tracks}
              currentTime={currentTime}
              duration={duration}
              selectedClipId={selectedClipId}
              magnetEnabled={magnetEnabled}
              onToggleMagnet={() => setMagnetEnabled(!magnetEnabled)}
              onSeek={setCurrentTime}
              onSelectClip={setSelectedClipId}
              onUpdateTracks={setTracks}
              onSplitClip={handleSplitClip}
              onDeleteClip={handleDeleteClip}
              onAddTrack={handleAddTrack}
            />
          </div>
        </div>
      </div>

      {/* Export Progress & Download Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        progress={exportProgress}
        completedBlob={completedBlob}
        resolution={resolution}
      />
    </div>
  );
}
