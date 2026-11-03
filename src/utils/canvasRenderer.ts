import { Clip, Resolution, Track } from '../types/editor';
import { evaluatePropertyAtTime } from './keyframeMath';

// Global media element cache to avoid re-instantiating on every tick
const mediaCache = new Map<string, HTMLImageElement | HTMLVideoElement | HTMLAudioElement>();

export function getCachedMedia(src: string, type: 'image' | 'video' | 'audio'): HTMLImageElement | HTMLVideoElement | HTMLAudioElement {
  if (mediaCache.has(src)) {
    return mediaCache.get(src)!;
  }

  if (type === 'image') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    mediaCache.set(src, img);
    return img;
  } else if (type === 'video') {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    mediaCache.set(src, video);
    return video;
  } else {
    const audio = new Audio();
    audio.src = src;
    audio.preload = 'auto';
    mediaCache.set(src, audio);
    return audio;
  }
}

/**
 * Draws safe zone overlays for vertical Shorts / Reels
 */
export function drawSafeZones(ctx: CanvasRenderingContext2D, width: number, height: number, aspectRatio: string) {
  if (aspectRatio !== '9:16') return;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);

  // Safe margin inset (approx 80px left/right, 180px top, 380px bottom for Shorts buttons/captions)
  const topSafe = height * 0.1;
  const bottomSafe = height * 0.82;
  const leftSafe = width * 0.08;
  const rightSafe = width * 0.92;

  ctx.strokeRect(leftSafe, topSafe, rightSafe - leftSafe, bottomSafe - topSafe);

  // Subtle label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillText('SHORTS SAFE AREA', leftSafe + 8, topSafe + 22);

  ctx.restore();
}

/**
 * Renders procedural animation for clips that don't have external media src
 */
function renderProceduralBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  name: string
) {
  // Correct coordinate-space gradient from (-w/2, -h/2) to (w/2, h/2)
  const grad = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
  if (name.toLowerCase().includes('sunset')) {
    grad.addColorStop(0, '#3b0764');
    grad.addColorStop(0.3, '#701a75');
    grad.addColorStop(0.6, '#be123c');
    grad.addColorStop(1, '#f59e0b');
  } else {
    // Cyber / Neon dark futuristic backdrop
    grad.addColorStop(0, '#020617');
    grad.addColorStop(0.4, '#0f172a');
    grad.addColorStop(0.8, '#1e1b4b');
    grad.addColorStop(1, '#090d16');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  // Animated dynamic perspective grid
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 1.5;
  const gridSize = 50;
  const offsetY = (time * 60) % gridSize;

  for (let x = -width / 2; x <= width / 2; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, -height / 2);
    ctx.lineTo(x, height / 2);
    ctx.stroke();
  }

  for (let y = -height / 2 + offsetY; y <= height / 2; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(-width / 2, y);
    ctx.lineTo(width / 2, y);
    ctx.stroke();
  }
  ctx.restore();

  // Floating animated particle sparks
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const seed = i * 137.5;
    const px = Math.sin(seed + time * 0.4) * (width * 0.42);
    const py = (((seed * 31.7 + time * 120) % height) - height / 2);
    const radius = 2 + (i % 3);
    const opacity = 0.3 + 0.4 * Math.sin(time * 3 + i);

    ctx.fillStyle = `rgba(147, 197, 253, ${opacity})`;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Central glowing core with rotating cyber rings
  ctx.save();
  const pulse = Math.sin(time * 4) * 18;
  const coreRadius = 90 + pulse;

  const radGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, coreRadius);
  radGrad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
  radGrad.addColorStop(0.5, 'rgba(129, 140, 248, 0.25)');
  radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  // Rotating outer ring
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 0.75, time * 2, time * 2 + Math.PI * 1.4);
  ctx.stroke();

  // Counter-rotating inner ring
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 0.5, -time * 2.5, -time * 2.5 + Math.PI * 1.2);
  ctx.stroke();
  ctx.restore();

  // Animated audio spectrum visualizer bars at the bottom
  ctx.save();
  const barCount = 28;
  const barWidth = 8;
  const spacing = 6;
  const totalW = barCount * (barWidth + spacing);
  const startX = -totalW / 2;
  const bottomY = height * 0.38;

  for (let b = 0; b < barCount; b++) {
    const freq = 1.5 + (b % 5) * 0.8;
    const waveHeight = (Math.sin(time * 8 + b * freq) * 0.5 + 0.5) * 60 + 10;
    const bx = startX + b * (barWidth + spacing);

    const barGrad = ctx.createLinearGradient(0, bottomY, 0, bottomY - waveHeight);
    barGrad.addColorStop(0, '#2563eb');
    barGrad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = barGrad;
    ctx.fillRect(bx, bottomY - waveHeight, barWidth, waveHeight);
  }
  ctx.restore();
}

/**
 * Main Canvas Frame Renderer
 */
export function renderCanvasFrame(
  ctx: CanvasRenderingContext2D,
  resolution: Resolution,
  tracks: Track[],
  currentTime: number,
  options?: { showSafeZones?: boolean; selectedClipId?: string | null }
) {
  const { width, height } = resolution;

  // Clear canvas with crisp deep dark background
  ctx.fillStyle = '#080a0f';
  ctx.fillRect(0, 0, width, height);

  // Render tracks from bottom to top (reversed track list or ordered by type)
  // Ordered: video background tracks first, then overlays/images, then text on top
  const sortedTracks = [...tracks].sort((a, b) => {
    const order: Record<string, number> = { audio: 0, video: 1, text: 2 };
    return (order[a.type] ?? 1) - (order[b.type] ?? 1);
  });

  for (const track of sortedTracks) {
    if (track.isHidden || track.type === 'audio') continue;

    for (const clip of track.clips) {
      // Check if clip is active at currentTime
      if (currentTime < clip.start || currentTime >= clip.start + clip.duration) {
        continue;
      }

      const clipRelativeTime = currentTime - clip.start;

      // Evaluate interpolated keyframes
      const posX = evaluatePropertyAtTime(clip, 'posX', clipRelativeTime);
      const posY = evaluatePropertyAtTime(clip, 'posY', clipRelativeTime);
      const scale = evaluatePropertyAtTime(clip, 'scale', clipRelativeTime);
      const opacity = evaluatePropertyAtTime(clip, 'opacity', clipRelativeTime);

      if (opacity <= 0.001) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

      // Translate to center + positional offset
      ctx.translate(width / 2 + posX, height / 2 + posY);
      ctx.scale(scale, scale);

      // Render clip by type
      if (clip.type === 'text' && clip.textProperties) {
        const tp = clip.textProperties;
        ctx.font = `${tp.isItalic ? 'italic ' : ''}${tp.isBold ? 'bold ' : ''}${tp.fontSize}px "${tp.fontFamily}", sans-serif`;
        ctx.textAlign = tp.textAlign;
        ctx.textBaseline = 'middle';

        const lines = tp.text.split('\n');
        const lineHeight = tp.fontSize * 1.25;
        const totalTextHeight = lines.length * lineHeight;

        lines.forEach((line, idx) => {
          const lineY = (idx - (lines.length - 1) / 2) * lineHeight;
          const textMetrics = ctx.measureText(line);
          const textWidth = textMetrics.width;

          // Draw background capsule if specified
          if (tp.backgroundColor && tp.backgroundColor !== 'transparent') {
            ctx.save();
            ctx.fillStyle = tp.backgroundColor;
            const padX = tp.fontSize * 0.4;
            const padY = tp.fontSize * 0.2;
            let bgX = -textWidth / 2 - padX;
            if (tp.textAlign === 'left') bgX = -padX;
            if (tp.textAlign === 'right') bgX = -textWidth - padX;

            const bgY = lineY - lineHeight / 2 - padY / 2;
            const bgW = textWidth + padX * 2;
            const bgH = lineHeight + padY;
            const r = Math.min(12, bgH / 3);

            ctx.beginPath();
            ctx.roundRect(bgX, bgY, bgW, bgH, r);
            ctx.fill();
            ctx.restore();
          }

          // Text shadow for high legibility on video
          ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 3;

          ctx.fillStyle = tp.color;
          ctx.fillText(line, 0, lineY);
        });
      } else if (clip.type === 'image' && clip.src) {
        const img = getCachedMedia(clip.src, 'image') as HTMLImageElement;
        if (img && img.complete && img.naturalWidth > 0) {
          const imgW = img.naturalWidth;
          const imgH = img.naturalHeight;
          ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
        }
      } else if (clip.type === 'video') {
        if (clip.src) {
          const video = getCachedMedia(clip.src, 'video') as HTMLVideoElement;
          if (video && video.readyState >= 2) {
            // Calculate aspect fill or fit
            const vW = video.videoWidth || width;
            const vH = video.videoHeight || height;
            const targetRatio = width / height;
            const videoRatio = vW / vH;

            let drawW = width;
            let drawH = height;
            if (videoRatio > targetRatio) {
              drawW = height * videoRatio;
            } else {
              drawH = width / videoRatio;
            }
            ctx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);
          } else {
            renderProceduralBackground(ctx, width, height, currentTime, clip.name);
          }
        } else {
          renderProceduralBackground(ctx, width, height, currentTime, clip.name);
        }
      }

      // Draw subtle selection boundary if selected
      if (options?.selectedClipId === clip.id) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3 / scale;
        ctx.setLineDash([6 / scale, 6 / scale]);
        const bW = (width * 0.7);
        const bH = (height * 0.4);
        ctx.strokeRect(-bW / 2, -bH / 2, bW, bH);
      }

      ctx.restore();
    }
  }

  // Safe zones for Shorts overlay
  if (options?.showSafeZones) {
    drawSafeZones(ctx, width, height, resolution.aspectRatio);
  }
}
