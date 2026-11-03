# ElementCut: Web Video Editor for Shorts & Social Media

ElementCut is a fast, desktop-grade video editor tailored for vertical Shorts and social video creation, featuring a multi-track magnetic timeline, transform and opacity keyframing, rich typography tools, and fast client-side MP4 export.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions incorporate your preferences from the initial interview:
> - **Aspect Ratios**: Defaults to 9:16 vertical (1080×1920) optimized for Shorts, TikTok, and Reels, with instant one-click toggles for 1:1 (Square) and 16:9 (Landscape).
> - **Preloaded Media**: Ships with built-in royalty-free video clips, background audio, sound effects, and stickers for instant experimentation alongside local file upload.
> - **Keyframe System**: Diamond keyframe toggle buttons in the Properties panel with visual diamond keyframe pins on timeline clips and real-time interpolation during playback and rendering.

- **Confirmed Decision 1**: Aspect Ratio toggle supporting 9:16, 1:1, and 16:9.
- **Confirmed Decision 2**: Starter media library included (video loops, music, stickers).
- **Confirmed Decision 3**: Diamond keyframe buttons with visual clip markers and value interpolation.

---

## 1. Overview & Core Concept

ElementCut provides creators and editors with a responsive workspace designed for rapid creation of short-form videos. Built to operate smoothly on local desktop hardware without server dependencies:
- **Left Column**: Live Canvas Preview Player with aspect ratio frame, safe zone overlay, timecode, play/pause, scrub bar, and interactive on-screen drag handles.
- **Top Right Column**: Contextual Properties Inspector for selected clips (Transform: Scale X/Y, Position X/Y; Opacity; Typography; Audio Volume; and Keyframe Diamonds).
- **Bottom Right Column**: Multi-Track Magnetic Timeline (Video/Visual Tracks, Text Tracks, Audio Tracks) with non-overflowing viewport, magnetic snapping, split/cut, trim handles, and clip slip.
- **Header Actions**: Clean 3-zone bar with brand mark, resolution switcher, media import, split/delete tools, and one-click MP4 Export.

---

## 2. User Experience & Visual Design

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ElementCut     [9:16 ▼] [Fit Zoom]              [+ Add Text] [Import Media] [Export MP4]│
├───────────────────────────────────────┬────────────────────────────────────────────────┤
│                                       │  PROPERTIES INSPECTOR                          │
│   CANVAS PREVIEW (9:16 Shorts)        │  Selected: "Intro_Hook.mp4" [Track 1]          │
│   ┌───────────────────────────────┐   ├────────────────────────────────────────────────┤
│   │                               │   │  Transform & Opacity                           │
│   │                               │   │  Position X: [ 0px ]   ◇ Keyframe              │
│   │         VIDEO CANVAS          │   │  Position Y: [ 0px ]   ◇ Keyframe              │
│   │                               │   │  Scale:      [ 100% ]  ◇ Keyframe              │
│   │                               │   │  Opacity:    [ 100% ]  ◇ Keyframe              │
│   │                               │   │  Volume:     [ 85%  ]  ◇ Keyframe              │
│   │                               │   ├────────────────────────────────────────────────┤
│   │                               │   │  Text Styling (When Text Clip Selected)        │
│   │                               │   │  Font: [ Plus Jakarta Sans ▼ ]  Size: [ 48px ] │
│   │                               │   │  Style: [B] [I]  Color: [ #FFFFFF ]            │
│   └───────────────────────────────┘   ├────────────────────────────────────────────────┤
│   [⏮] [⏪] [ ▶ ] [⏩] [⏭]  00:03.12 / 00:15.00 │  TIMELINE (Multi-Track & Magnetic)         │
│   Tools: [✂ Split] [🗑 Delete] [🧲 Magnet: ON]│  [Track 3: Text]  |── "Big Hook" ──|       │
│                                       │  [Track 2: Video] |─ Clip A ─◇───◇─|─ Clip B ──|│
│                                       │  [Track 1: Audio] |────── Lo-Fi Beat ──────────|│
└───────────────────────────────────────┴────────────────────────────────────────────────┘
```

### Visual Identity & Theme
- **Color Discipline**: Studio dark workspace (`#0D1117` base, `#161B22` panel surfaces, `#21262D` hairline borders) with vibrant electric blue (`#2563EB` / `#3B82F6`) accent highlights for playhead and active selections.
- **Typography**: `Plus Jakarta Sans` for clean, professional studio UI controls and `JetBrains Mono` / `tabular-nums` for precise SMPTE timecode (HH:MM:SS:FF).
- **Layout Math**: Split desktop workspace (45% Preview Left, 55% Tools & Inspector Right), fully contained in the viewport without window scrolling. Timeline tracks feature an internal auto-fitting horizontal zoom and smooth panning scrollbar.
- **Interactive Feedback**: Real-time canvas rendering, playhead scrubbing, hover boundary indicators on clip edges for trimming, and active keyframe diamonds that highlight when playhead sits on a keyframe.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Client-Side MP4 Export Engine
- **Approach**: High-performance browser rendering pipeline using HTML5 Canvas offscreen frame-by-frame rasterization and WebCodecs / MediaRecorder with Fast MP4 Muxer (fallback to WebM/MP4 transcoder container).
- **Why**: Allows instant offline rendering directly on the user's PC with zero cloud cost, zero privacy exposure, and 60 FPS deterministic keyframe playback.
- **Alternatives Considered**: Server-side FFmpeg rendering (rejected because it requires uploading large video files over internet and defeats local PC usage).

### Decision 2: Multi-Track State & Keyframe Interpolation
- **Approach**: Normalized state model where each clip has a time range (`start`, `duration`, `sourceOffset`) and property keyframe arrays (`keyframes: { positionX, positionY, scale, opacity, volume }`).
- **Why**: Enables clean linear/cubic interpolation at any fractional timestamp for butter-smooth preview and export.
- **Snapping / Magnet**: Clamped collision detection that automatically snaps clip start/end boundaries to neighbor clips, the playhead, and zero marker within a 10px snap radius.

### Decision 3: Audio Mixing & Web Audio Graph
- **Approach**: Dynamic Web Audio `AudioContext` with individual `GainNode` chains per track/clip to evaluate volume keyframes and produce synchronized mixed audio during export.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                             EditorState Store                          │
│  - currentTime, duration, isPlaying, zoomLevel, magnetEnabled          │
│  - canvasResolution: { width: 1080, height: 1920, aspectRatio: '9:16' } │
│  - tracks: Array<Track> [VideoTrack, TextTrack, AudioTrack]            │
│  - selectedClipId, activeTool (select, cut, slip)                      │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
      ┌─────────────────────────┐       ┌─────────────────────────┐
      │     Playback Engine     │       │   Properties Inspector  │
      │  - Canvas 2D Renderer   │       │  - Transform (X, Y, S)  │
      │  - Clip Transformer     │       │  - Opacity & Volume     │
      │  - Keyframe Evaluator   │       │  - Diamond Keyframers   │
      │  - Web Audio Context    │       │  - Text Typography      │
      └────────────┬────────────┘       └─────────────────────────┘
                   │
                   ▼
      ┌─────────────────────────┐
      │    Export Renderer      │
      │  - Offscreen Canvas     │
      │  - Frame-by-Frame Mux   │
      │  - MP4 Video Generation │
      └─────────────────────────┘
```

### Component Hierarchy
- `src/App.tsx`: Top-level workspace container & layout controller
- `src/components/Header.tsx`: Top bar with brand, aspect selector, import media, and export button
- `src/components/CanvasPreview.tsx`: Video stage with aspect letterboxing, safe area guides, and play controls
- `src/components/PropertiesPanel.tsx`: Inspector for Transform, Opacity, Text, Audio, and Keyframes
- `src/components/Timeline/`:
  - `TimelineToolbar.tsx`: Split, Trim, Delete, Magnet toggle, Zoom controls
  - `TimelineRuler.tsx`: Millisecond and frame accurate time ruler with draggable playhead
  - `TimelineTracks.tsx`: Multi-track lanes with clip drag-and-drop, resize trim handles, and diamond keyframe badges
- `src/utils/renderer.ts`: Synchronous frame renderer calculating transform matrices and keyframe interpolation
- `src/utils/exportMp4.ts`: Fast client-side MP4 recorder and muxer with progress modal
- `src/utils/starterMedia.ts`: Preloaded video clips, audio tracks, and sample sticker assets

---

## 5. Implementation Phases

1. **Environment & Layout Foundation**: Setup studio theme tokens, fonts, layout grid (Left: Player, Top Right: Inspector, Bottom Right: Timeline).
2. **Media Engine & Preloaded Library**: Starter video loops, audio tracks, and dynamic local file uploader supporting MP4, WebM, PNG, JPG, MP3, WAV.
3. **Multi-Track Timeline with Magnetic Snapping**: Split clip at playhead, trim handles, track rearrangement, and magnetic snapping.
4. **Keyframe System & Inspector**: Scale, position X/Y, opacity, and audio volume keyframes with diamond buttons and clip indicators.
5. **Text Overlay Engine**: Typography styling (Plus Jakarta Sans, Outfit, Oswald, etc.), bold, italic, font size, color, and animated transforms.
6. **MP4 Export Engine**: Deterministic canvas frame renderer with audio mixing and progress bar for direct MP4 download.
