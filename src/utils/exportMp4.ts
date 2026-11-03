import { Resolution, Track } from '../types/editor';
import { renderCanvasFrame } from './canvasRenderer';
import { evaluatePropertyAtTime } from './keyframeMath';
import confetti from 'canvas-confetti';

export interface ExportProgress {
  progress: number; // 0 to 1
  currentTime: number;
  totalTime: number;
  status: string;
}

export async function exportToMp4(
  resolution: Resolution,
  tracks: Track[],
  duration: number,
  fps = 30,
  onProgress?: (p: ExportProgress) => void
): Promise<Blob> {
  const width = resolution.width;
  const height = resolution.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // Setup Web Audio graph to mix audio tracks
  const audioCtx = new AudioContext();
  const audioDest = audioCtx.createMediaStreamDestination();

  // Prepare audio buffers for clips
  const audioNodes: { clipStart: number; clipDuration: number; clipOffset: number; source: AudioBufferSourceNode; gainNode: GainNode; clip: any }[] = [];

  for (const track of tracks) {
    if (track.isMuted) continue;
    for (const clip of track.clips) {
      if ((clip.type === 'audio' || clip.type === 'video') && clip.src) {
        try {
          const resp = await fetch(clip.src);
          const arrayBuf = await resp.arrayBuffer();
          const decodedBuf = await audioCtx.decodeAudioData(arrayBuf);
          const source = audioCtx.createBufferSource();
          source.buffer = decodedBuf;
          const gainNode = audioCtx.createGain();
          gainNode.gain.setValueAtTime(clip.transform.volume, 0);

          // Connect
          source.connect(gainNode);
          gainNode.connect(audioDest);

          audioNodes.push({
            clipStart: clip.start,
            clipDuration: clip.duration,
            clipOffset: clip.sourceOffset,
            source,
            gainNode,
            clip,
          });
        } catch (e) {
          console.warn('Could not decode audio for clip:', clip.name, e);
        }
      }
    }
  }

  // Combine canvas video stream + mixed audio stream
  const videoStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  // Determine optimal MP4 MIME type supported by browser
  let mimeType = 'video/mp4;codecs=avc1';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/mp4';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp9,opus';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 8000000, // 8 Mbps high quality for Shorts
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      // Create blob with mp4 mime type
      const exportBlob = new Blob(chunks, { type: 'video/mp4' });
      resolve(exportBlob);
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  // Schedule audio playback nodes
  const startTime = audioCtx.currentTime;
  audioNodes.forEach((an) => {
    const playAt = startTime + an.clipStart;
    try {
      an.source.start(playAt, an.clipOffset, an.clipDuration);
    } catch (e) {
      console.warn('Audio schedule warning:', e);
    }
  });

  const totalFrames = Math.ceil(duration * fps);
  const frameIntervalMs = 1000 / fps;

  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;

    // Render frame
    renderCanvasFrame(ctx, resolution, tracks, t, { showSafeZones: false });

    // Update dynamic audio keyframe gains
    audioNodes.forEach((an) => {
      if (t >= an.clipStart && t <= an.clipStart + an.clipDuration) {
        const relTime = t - an.clipStart;
        const curVol = evaluatePropertyAtTime(an.clip, 'volume', relTime);
        an.gainNode.gain.setValueAtTime(curVol, audioCtx.currentTime);
      }
    });

    if (onProgress) {
      onProgress({
        progress: (f + 1) / totalFrames,
        currentTime: t,
        totalTime: duration,
        status: `Rendering frame ${f + 1} of ${totalFrames}...`,
      });
    }

    // Keep pacing aligned
    await new Promise((r) => setTimeout(r, frameIntervalMs));
  }

  // Stop recording
  recorder.stop();
  audioNodes.forEach((an) => {
    try {
      an.source.stop();
    } catch (_) {}
  });
  await audioCtx.close();

  const finalBlob = await recordingPromise;

  // Trigger celebration confetti
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  } catch (_) {}

  return finalBlob;
}

/**
 * Initiates direct browser download of the exported MP4
 */
export function downloadBlob(blob: Blob, filename = 'ElementCut_Short.mp4') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
