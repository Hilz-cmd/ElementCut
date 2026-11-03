import { Clip, KeyframableProperty, Keyframe } from '../types/editor';

/**
 * Linearly interpolates between two numbers
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Smoothstep easing for natural keyframe transitions
 */
export function smoothstep(a: number, b: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const eased = clamped * clamped * (3 - 2 * clamped);
  return a + (b - a) * eased;
}

/**
 * Evaluates the value of a keyframable property at a given clip-relative time.
 */
export function evaluatePropertyAtTime(
  clip: Clip,
  prop: KeyframableProperty,
  clipRelativeTime: number
): number {
  const keyframes = clip.transform.keyframes[prop];

  // If no keyframes are defined or empty array, return base static value
  if (!keyframes || keyframes.length === 0) {
    return clip.transform[prop];
  }

  // Sort keyframes chronologically
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // If before first keyframe
  if (clipRelativeTime <= sorted[0].time) {
    return sorted[0].value;
  }

  // If after last keyframe
  if (clipRelativeTime >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value;
  }

  // Find bounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const kfA = sorted[i];
    const kfB = sorted[i + 1];

    if (clipRelativeTime >= kfA.time && clipRelativeTime <= kfB.time) {
      const duration = kfB.time - kfA.time;
      if (duration <= 0.0001) return kfB.value;
      const t = (clipRelativeTime - kfA.time) / duration;
      return lerp(kfA.value, kfB.value, t);
    }
  }

  return clip.transform[prop];
}

/**
 * Checks if a keyframe exists at the specified clip-relative time within a tolerance
 */
export function findKeyframeNear(
  keyframes: Keyframe[] | undefined,
  time: number,
  tolerance = 0.08
): Keyframe | undefined {
  if (!keyframes) return undefined;
  return keyframes.find((kf) => Math.abs(kf.time - time) <= tolerance);
}

/**
 * Formats seconds into standard SMPTE timecode MM:SS.SS
 */
export function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);

  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');
  const hStr = String(hundredths).padStart(2, '0');

  return `${mStr}:${sStr}.${hStr}`;
}
