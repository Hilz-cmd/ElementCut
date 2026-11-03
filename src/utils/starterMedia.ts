import { Clip, Track } from '../types/editor';

/**
 * Procedurally generates a WAV audio blob using Web Audio API
 */
export async function generateSyntheticAudio(
  type: 'lofi' | 'trap' | 'whoosh',
  durationSeconds = 8
): Promise<string> {
  const AudioCtxClass =
    typeof window !== 'undefined'
      ? window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
      : null;

  if (!AudioCtxClass) {
    return '';
  }

  const sampleRate = 44100;
  const numFrames = Math.floor(sampleRate * durationSeconds);
  const offlineCtx = new AudioCtxClass(2, numFrames, sampleRate);

  if (type === 'lofi') {
    // Warm chords + lo-fi beat
    const chords = [261.63, 329.63, 392.0, 523.25]; // C major 7th chord tones
    chords.forEach((freq, idx) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * (1 + idx * 0.005), 0);

      // Lowpass filter for warm tone
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, 0);

      gain.gain.setValueAtTime(0.08, 0);
      gain.gain.exponentialRampToValueAtTime(0.01, durationSeconds);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.start(0);
      osc.stop(durationSeconds);
    });

    // Gentle rhythmic bass kick pulse every 1 second
    for (let t = 0; t < durationSeconds; t += 1.0) {
      const kickOsc = offlineCtx.createOscillator();
      const kickGain = offlineCtx.createGain();
      kickOsc.frequency.setValueAtTime(120, t);
      kickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      kickGain.gain.setValueAtTime(0.4, t);
      kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      kickOsc.connect(kickGain);
      kickGain.connect(offlineCtx.destination);
      kickOsc.start(t);
      kickOsc.stop(t + 0.3);
    }
  } else if (type === 'trap') {
    // 808 sub bass and snappy click
    for (let t = 0; t < durationSeconds; t += 0.5) {
      const bassOsc = offlineCtx.createOscillator();
      const bassGain = offlineCtx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(90, t);
      bassOsc.frequency.exponentialRampToValueAtTime(55, t + 0.3);

      bassGain.gain.setValueAtTime(0.4, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      bassOsc.connect(bassGain);
      bassGain.connect(offlineCtx.destination);
      bassOsc.start(t);
      bassOsc.stop(t + 0.45);
    }
  } else {
    // Whoosh / sweep transition
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();
    const filter = offlineCtx.createBiquadFilter();
    osc.type = 'sawtooth';
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, 0);
    filter.frequency.exponentialRampToValueAtTime(3500, durationSeconds * 0.7);
    filter.frequency.exponentialRampToValueAtTime(100, durationSeconds);
    gain.gain.setValueAtTime(0.01, 0);
    gain.gain.linearRampToValueAtTime(0.3, durationSeconds * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, durationSeconds);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start(0);
    osc.stop(durationSeconds);
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWavUrl(renderedBuffer);
}

/**
 * Converts an AudioBuffer into a WAV Blob URL
 */
function audioBufferToWavUrl(buffer: AudioBuffer): string {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write PCM audio samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Generates an animated video clip locally using HTML5 canvas and MediaRecorder
 */
export async function generateSyntheticVideo(
  theme: 'cyber' | 'sunset',
  durationSec = 6
): Promise<string> {
  const width = 540;
  const height = 960; // 9:16 vertical short
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
    ? 'video/mp4;codecs=avc1'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const donePromise = new Promise<string>((resolve) => {
    recorder.onstop = () => {
      const videoBlob = new Blob(chunks, { type: mimeType });
      resolve(URL.createObjectURL(videoBlob));
    };
  });

  recorder.start();

  const fps = 30;
  const totalFrames = fps * durationSec;

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    const progress = t / durationSec;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (theme === 'cyber') {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#020617');
    } else {
      grad.addColorStop(0, '#4c0519');
      grad.addColorStop(0.4, '#831843');
      grad.addColorStop(0.8, '#f59e0b');
      grad.addColorStop(1, '#fbbf24');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Glowing geometric shapes
    const centerX = width / 2;
    const centerY = height / 2;

    if (theme === 'cyber') {
      // Dynamic cyber rings and grid
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + 0.3 * Math.sin(t * 3)})`;
      ctx.lineWidth = 3;
      for (let r = 50; r <= 220; r += 40) {
        ctx.beginPath();
        ctx.arc(centerX, centerY + Math.sin(t * 2 + r) * 20, r + Math.sin(t * 4) * 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Neon pulse dot
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30 + Math.sin(t * 5) * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Glowing sun and wave horizon
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 60, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Dark silhouette mountain / waves
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.moveTo(0, centerY + 100);
      for (let x = 0; x <= width; x += 10) {
        const y = centerY + 120 + Math.sin((x + t * 60) * 0.02) * 25;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    }

    // Yield small time for recorder
    await new Promise((r) => setTimeout(r, 1000 / fps));
  }

  recorder.stop();
  return donePromise;
}

/**
 * Creates SVG sticker URLs
 */
export function createStickerSvg(type: 'fire' | 'lightning' | 'subscribe'): string {
  let svg = '';
  if (type === 'fire') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240">
      <defs>
        <linearGradient id="fireGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#dc2626"/>
          <stop offset="50%" stop-color="#ea580c"/>
          <stop offset="100%" stop-color="#fbbf24"/>
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#ea580c" flood-opacity="0.6"/>
        </filter>
      </defs>
      <circle cx="60" cy="60" r="54" fill="#18181b" stroke="#f97316" stroke-width="3" filter="url(#shadow)"/>
      <path d="M60 22 C62 38, 76 46, 76 62 C76 74, 68 84, 60 84 C52 84, 44 74, 44 62 C44 46, 58 38, 60 22 Z" fill="url(#fireGrad)"/>
      <path d="M60 48 C61 56, 68 62, 68 70 C68 76, 64 80, 60 80 C56 80, 52 76, 52 70 C52 62, 59 56, 60 48 Z" fill="#fef08a"/>
    </svg>`;
  } else if (type === 'lightning') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240">
      <defs>
        <linearGradient id="boltGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="100%" stop-color="#eab308"/>
        </linearGradient>
        <filter id="glow">
          <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#eab308" flood-opacity="0.8"/>
        </filter>
      </defs>
      <rect x="8" y="8" width="104" height="104" rx="28" fill="#111827" stroke="#eab308" stroke-width="3" filter="url(#glow)"/>
      <polygon points="68,22 36,62 58,62 50,98 84,54 62,54" fill="url(#boltGrad)"/>
    </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 64" width="300" height="96">
      <defs>
        <linearGradient id="subGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#e11d48"/>
          <stop offset="100%" stop-color="#be123c"/>
        </linearGradient>
        <filter id="subShadow">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#e11d48" flood-opacity="0.5"/>
        </filter>
      </defs>
      <rect x="4" y="4" width="192" height="56" rx="28" fill="url(#subGrad)" filter="url(#subShadow)"/>
      <polygon points="34,22 34,42 50,32" fill="#ffffff"/>
      <text x="60" y="38" fill="#ffffff" font-family="'Plus Jakarta Sans', sans-serif" font-weight="700" font-size="18" letter-spacing="1">SUBSCRIBE</text>
    </svg>`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Initializes default tracks and clips preloaded for the editor
 */
export async function createInitialProject(): Promise<Track[]> {
  // Generate synthetic starter audio (instantaneous in memory)
  let lofiAudioUrl = '';
  try {
    lofiAudioUrl = await generateSyntheticAudio('lofi', 10);
  } catch (e) {
    console.warn('Initial synthetic audio skipped:', e);
  }
  const fireSticker = createStickerSvg('fire');

  const textTrack: Track = {
    id: 'track-text-1',
    name: 'Text & Titles',
    type: 'text',
    clips: [
      {
        id: 'clip-text-hook',
        trackId: 'track-text-1',
        type: 'text',
        name: 'Shorts Hook Title',
        start: 0.5,
        duration: 4.5,
        sourceOffset: 0,
        color: '#8b5cf6',
        textProperties: {
          text: 'WAIT FOR THE DROP 🔥',
          fontSize: 52,
          fontFamily: 'Outfit',
          isBold: true,
          isItalic: false,
          color: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          textAlign: 'center',
          letterSpacing: 2,
        },
        transform: {
          posX: 0,
          posY: -280,
          scale: 1.0,
          opacity: 1.0,
          volume: 1.0,
          keyframes: {
            scale: [
              { id: 'kf-s1', time: 0.0, value: 0.8 },
              { id: 'kf-s2', time: 0.5, value: 1.15 },
              { id: 'kf-s3', time: 0.8, value: 1.0 },
            ],
            opacity: [
              { id: 'kf-o1', time: 0.0, value: 0.0 },
              { id: 'kf-o2', time: 0.4, value: 1.0 },
              { id: 'kf-o3', time: 4.0, value: 1.0 },
              { id: 'kf-o4', time: 4.5, value: 0.0 },
            ],
          },
        },
      },
    ],
  };

  const overlayTrack: Track = {
    id: 'track-overlay-1',
    name: 'Overlays & Stickers',
    type: 'video',
    clips: [
      {
        id: 'clip-sticker-fire',
        trackId: 'track-overlay-1',
        type: 'image',
        name: 'Fire Badge',
        start: 1.0,
        duration: 3.5,
        sourceOffset: 0,
        src: fireSticker,
        color: '#f97316',
        transform: {
          posX: 0,
          posY: -140,
          scale: 0.9,
          opacity: 1.0,
          volume: 1.0,
          keyframes: {
            scale: [
              { id: 'kf-st1', time: 0.0, value: 0.2 },
              { id: 'kf-st2', time: 0.4, value: 1.2 },
              { id: 'kf-st3', time: 0.7, value: 0.9 },
            ],
          },
        },
      },
    ],
  };

  const videoTrack: Track = {
    id: 'track-video-1',
    name: 'Video A',
    type: 'video',
    clips: [
      {
        id: 'clip-video-cyber',
        trackId: 'track-video-1',
        type: 'video',
        name: 'Neon Horizon (Short)',
        start: 0,
        duration: 6.0,
        sourceOffset: 0,
        sourceDuration: 6.0,
        color: '#2563eb',
        transform: {
          posX: 0,
          posY: 0,
          scale: 1.0,
          opacity: 1.0,
          volume: 1.0,
          keyframes: {
            scale: [
              { id: 'kf-v1', time: 0.0, value: 1.0 },
              { id: 'kf-v2', time: 5.5, value: 1.25 },
            ],
            opacity: [
              { id: 'kf-vo1', time: 0.0, value: 1.0 },
              { id: 'kf-vo2', time: 5.5, value: 1.0 },
              { id: 'kf-vo3', time: 6.0, value: 0.0 },
            ],
          },
        },
      },
    ],
  };

  const audioTrack: Track = {
    id: 'track-audio-1',
    name: 'Audio Track',
    type: 'audio',
    clips: [
      {
        id: 'clip-audio-lofi',
        trackId: 'track-audio-1',
        type: 'audio',
        name: 'Lo-Fi Chill Beat.wav',
        start: 0,
        duration: 7.5,
        sourceOffset: 0,
        sourceDuration: 8.0,
        src: lofiAudioUrl,
        color: '#10b981',
        transform: {
          posX: 0,
          posY: 0,
          scale: 1.0,
          opacity: 1.0,
          volume: 0.85,
          keyframes: {
            volume: [
              { id: 'kf-a1', time: 0.0, value: 0.1 },
              { id: 'kf-a2', time: 0.8, value: 0.9 },
              { id: 'kf-a3', time: 6.5, value: 0.9 },
              { id: 'kf-a4', time: 7.5, value: 0.0 },
            ],
          },
        },
      },
    ],
  };

  return [textTrack, overlayTrack, videoTrack, audioTrack];
}
