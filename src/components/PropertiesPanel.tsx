import React from 'react';
import { Clip, KeyframableProperty, Keyframe } from '../types/editor';
import { 
  findKeyframeNear, 
  evaluatePropertyAtTime, 
  formatTimecode 
} from '../utils/keyframeMath';
import { 
  Sliders, 
  Type, 
  Volume2, 
  Eye, 
  Move, 
  Maximize, 
  Trash2, 
  Copy, 
  Bold, 
  Italic, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Sparkles
} from 'lucide-react';

interface PropertiesPanelProps {
  selectedClip: Clip | null;
  currentTime: number;
  onUpdateClip: (updatedClip: Clip) => void;
  onDeleteClip: (clipId: string) => void;
  onDuplicateClip: (clip: Clip) => void;
  onSeek: (time: number) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedClip,
  currentTime,
  onUpdateClip,
  onDeleteClip,
  onDuplicateClip,
  onSeek,
}) => {
  if (!selectedClip) {
    return (
      <div className="h-full bg-neutral-900 flex flex-col items-center justify-center p-6 text-center text-neutral-400 select-none">
        <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-500 mb-3">
          <Sliders className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-200 mb-1">Properties Inspector</h3>
        <p className="text-xs text-neutral-500 max-w-xs leading-relaxed mb-4">
          Click any clip in the timeline or preview stage to edit transforms, keyframes, typography, and audio.
        </p>
        <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 text-left w-full max-w-xs text-[11px] space-y-1.5 text-neutral-400">
          <div className="font-semibold text-neutral-300 mb-1">Pro Tips:</div>
          <div><span className="text-neutral-200">◇ Diamond Icon:</span> Toggle keyframe at playhead</div>
          <div><span className="text-neutral-200">Space:</span> Play / pause preview</div>
          <div><span className="text-neutral-200">Split Tool:</span> Cut clip at current time</div>
        </div>
      </div>
    );
  }

  // Calculate clip-relative time
  const clipRelativeTime = Math.max(0, Math.min(selectedClip.duration, currentTime - selectedClip.start));
  const isPlayheadInsideClip = currentTime >= selectedClip.start && currentTime <= selectedClip.start + selectedClip.duration;

  // Keyframe toggle handler
  const handleToggleKeyframe = (prop: KeyframableProperty, currentValue: number) => {
    if (!isPlayheadInsideClip) return;

    const existingKeyframes = selectedClip.transform.keyframes[prop] || [];
    const nearKf = findKeyframeNear(existingKeyframes, clipRelativeTime);

    let updatedList: Keyframe[];

    if (nearKf) {
      // Remove keyframe if already present at playhead
      updatedList = existingKeyframes.filter((kf) => kf.id !== nearKf.id);
    } else {
      // Add new keyframe at playhead
      const newKf: Keyframe = {
        id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        time: parseFloat(clipRelativeTime.toFixed(2)),
        value: currentValue,
      };
      updatedList = [...existingKeyframes, newKf].sort((a, b) => a.time - b.time);
    }

    onUpdateClip({
      ...selectedClip,
      transform: {
        ...selectedClip.transform,
        keyframes: {
          ...selectedClip.transform.keyframes,
          [prop]: updatedList,
        },
      },
    });
  };

  // Direct property value change handler
  const handleValueChange = (prop: KeyframableProperty, val: number) => {
    const existingKeyframes = selectedClip.transform.keyframes[prop] || [];
    const nearKf = findKeyframeNear(existingKeyframes, clipRelativeTime);

    let updatedKeyframes = selectedClip.transform.keyframes;

    // If a keyframe already exists at the current playhead, update that keyframe value
    if (nearKf && isPlayheadInsideClip) {
      const updatedList = existingKeyframes.map((kf) =>
        kf.id === nearKf.id ? { ...kf, value: val } : kf
      );
      updatedKeyframes = {
        ...updatedKeyframes,
        [prop]: updatedList,
      };
    }

    onUpdateClip({
      ...selectedClip,
      transform: {
        ...selectedClip.transform,
        [prop]: val,
        keyframes: updatedKeyframes,
      },
    });
  };

  // Helper to render property slider row with Diamond Keyframe button
  const renderPropertyRow = (
    label: string,
    prop: KeyframableProperty,
    min: number,
    max: number,
    step: number,
    unit = '',
    icon: React.ReactNode
  ) => {
    const evaluatedVal = evaluatePropertyAtTime(selectedClip, prop, clipRelativeTime);
    const existingKeyframes = selectedClip.transform.keyframes[prop] || [];
    const hasKeyframeNow = !!findKeyframeNear(existingKeyframes, clipRelativeTime);
    const hasAnyKeyframe = existingKeyframes.length > 0;

    return (
      <div className="space-y-1 py-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-neutral-300 font-medium">
            <span className="text-neutral-500">{icon}</span>
            <span>{label}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-timecode text-neutral-400 text-[11px]">
              {unit === '%' ? `${Math.round(evaluatedVal * 100)}%` : `${evaluatedVal.toFixed(step < 1 ? 2 : 0)}${unit}`}
            </span>

            {/* Diamond Keyframe Button */}
            <button
              onClick={() => handleToggleKeyframe(prop, evaluatedVal)}
              disabled={!isPlayheadInsideClip}
              title={
                !isPlayheadInsideClip
                  ? 'Move playhead over clip to add keyframe'
                  : hasKeyframeNow
                  ? 'Remove Keyframe at playhead'
                  : 'Add Keyframe at playhead'
              }
              className={`p-1 rounded transition-all cursor-pointer ${
                hasKeyframeNow
                  ? 'text-amber-400 bg-amber-400/20 scale-110'
                  : hasAnyKeyframe
                  ? 'text-neutral-400 hover:text-amber-300'
                  : 'text-neutral-600 hover:text-neutral-300'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {/* Custom SVG Diamond */}
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <polygon points="12,2 22,12 12,22 2,12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Range Slider */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={evaluatedVal}
            onChange={(e) => handleValueChange(prop, parseFloat(e.target.value))}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-y-auto select-none">
      {/* Top Header of Inspector */}
      <div className="h-11 px-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/80 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs font-semibold text-white truncate max-w-[160px]">
            {selectedClip.name}
          </span>
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
            {selectedClip.type}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onDuplicateClip(selectedClip)}
            title="Duplicate Clip"
            className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded hover:bg-neutral-800 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteClip(selectedClip.id)}
            title="Delete Clip (Delete/Backspace)"
            className="p-1.5 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5 text-neutral-300">
        {/* Clip Timing Info */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
          <div>
            <span className="text-neutral-500 text-[11px] block">Start Time</span>
            <span className="font-timecode font-medium text-neutral-200">
              {formatTimecode(selectedClip.start)}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 text-[11px] block">Duration</span>
            <span className="font-timecode font-medium text-neutral-200">
              {formatTimecode(selectedClip.duration)}
            </span>
          </div>
        </div>

        {/* Text Properties Section (if text clip) */}
        {selectedClip.type === 'text' && selectedClip.textProperties && (
          <div className="space-y-3 pt-1 border-b border-neutral-800 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-purple-400" />
                Text Typography
              </span>
            </div>

            {/* Text Input */}
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">Content</label>
              <textarea
                value={selectedClip.textProperties.text}
                onChange={(e) =>
                  onUpdateClip({
                    ...selectedClip,
                    textProperties: {
                      ...selectedClip.textProperties!,
                      text: e.target.value,
                    },
                  })
                }
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Enter text..."
              />
            </div>

            {/* Font Family & Size */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Font Family</label>
                <select
                  value={selectedClip.textProperties.fontFamily}
                  onChange={(e) =>
                    onUpdateClip({
                      ...selectedClip,
                      textProperties: {
                        ...selectedClip.textProperties!,
                        fontFamily: e.target.value,
                      },
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Outfit">Outfit (Bold Modern)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="Oswald">Oswald (Punchy)</option>
                  <option value="Playfair Display">Playfair (Serif)</option>
                  <option value="JetBrains Mono">JetBrains (Mono)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Font Size</label>
                <input
                  type="number"
                  min={12}
                  max={160}
                  value={selectedClip.textProperties.fontSize}
                  onChange={(e) =>
                    onUpdateClip({
                      ...selectedClip,
                      textProperties: {
                        ...selectedClip.textProperties!,
                        fontSize: parseInt(e.target.value) || 32,
                      },
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-timecode"
                />
              </div>
            </div>

            {/* Styling Toggles (Bold, Italic, Alignments) */}
            <div className="flex items-center justify-between bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    onUpdateClip({
                      ...selectedClip,
                      textProperties: {
                        ...selectedClip.textProperties!,
                        isBold: !selectedClip.textProperties!.isBold,
                      },
                    })
                  }
                  className={`p-1.5 rounded text-xs transition-colors ${
                    selectedClip.textProperties.isBold
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() =>
                    onUpdateClip({
                      ...selectedClip,
                      textProperties: {
                        ...selectedClip.textProperties!,
                        isItalic: !selectedClip.textProperties!.isItalic,
                      },
                    })
                  }
                  className={`p-1.5 rounded text-xs transition-colors ${
                    selectedClip.textProperties.isItalic
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    onUpdateClip({
                      ...selectedClip,
                      textProperties: { ...selectedClip.textProperties!, textAlign: 'left' },
                    })
                  }
                  className={`p-1.5 rounded text-xs transition-colors ${
                    selectedClip.textProperties.textAlign === 'left'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    onUpdateClip({
                      ...selectedClip,
                      textProperties: { ...selectedClip.textProperties!, textAlign: 'center' },
                    })
                  }
                  className={`p-1.5 rounded text-xs transition-colors ${
                    selectedClip.textProperties.textAlign === 'center'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    onUpdateClip({
                      ...selectedClip,
                      textProperties: { ...selectedClip.textProperties!, textAlign: 'right' },
                    })
                  }
                  className={`p-1.5 rounded text-xs transition-colors ${
                    selectedClip.textProperties.textAlign === 'right'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Text Color</label>
                <div className="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
                  <input
                    type="color"
                    value={selectedClip.textProperties.color}
                    onChange={(e) =>
                      onUpdateClip({
                        ...selectedClip,
                        textProperties: {
                          ...selectedClip.textProperties!,
                          color: e.target.value,
                        },
                      })
                    }
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="text-xs font-timecode text-neutral-300">
                    {selectedClip.textProperties.color}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Capsule BG</label>
                <div className="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
                  <button
                    onClick={() =>
                      onUpdateClip({
                        ...selectedClip,
                        textProperties: {
                          ...selectedClip.textProperties!,
                          backgroundColor:
                            selectedClip.textProperties!.backgroundColor === 'transparent'
                              ? 'rgba(0, 0, 0, 0.75)'
                              : 'transparent',
                        },
                      })
                    }
                    className="text-xs text-neutral-300 hover:text-white"
                  >
                    {selectedClip.textProperties.backgroundColor === 'transparent' ? 'None' : 'Active'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transform & Keyframes Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-blue-400" />
              Transform & Keyframes
            </span>
            <span className="text-[10px] text-amber-400/80 font-medium">
              ◇ Toggle Keyframe
            </span>
          </div>

          <div className="space-y-3 bg-neutral-950/60 p-3 rounded-lg border border-neutral-850">
            {renderPropertyRow('Position X', 'posX', -600, 600, 1, 'px', <Move className="w-3 h-3" />)}
            {renderPropertyRow('Position Y', 'posY', -1000, 1000, 1, 'px', <Move className="w-3 h-3 rotate-90" />)}
            {renderPropertyRow('Scale', 'scale', 0.1, 3.0, 0.02, '%', <Maximize className="w-3 h-3" />)}
            {renderPropertyRow('Opacity', 'opacity', 0.0, 1.0, 0.01, '%', <Eye className="w-3 h-3" />)}

            {(selectedClip.type === 'audio' || selectedClip.type === 'video') && (
              renderPropertyRow('Volume', 'volume', 0.0, 1.5, 0.02, '%', <Volume2 className="w-3 h-3" />)
            )}
          </div>
        </div>

        {/* Keyframe Navigator Strip */}
        <div className="pt-2 border-t border-neutral-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold text-neutral-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Keyframe Markers
            </span>
          </div>

          {/* List of Keyframes */}
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {Object.entries(selectedClip.transform.keyframes).flatMap(([prop, list]) =>
              (list || []).map((kf) => (
                <div
                  key={kf.id}
                  className="flex items-center justify-between bg-neutral-950 px-2.5 py-1.5 rounded border border-neutral-800 text-[11px]"
                >
                  <button
                    onClick={() => onSeek(selectedClip.start + kf.time)}
                    className="flex items-center gap-2 text-left hover:text-amber-400 transition-colors"
                  >
                    <span className="text-amber-400 font-bold">◇</span>
                    <span className="font-medium capitalize text-neutral-200">{prop}:</span>
                    <span className="font-timecode text-neutral-400">
                      {formatTimecode(kf.time)}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      const updatedKeyframes = {
                        ...selectedClip.transform.keyframes,
                        [prop]: (selectedClip.transform.keyframes[prop as KeyframableProperty] || []).filter(
                          (item) => item.id !== kf.id
                        ),
                      };
                      onUpdateClip({
                        ...selectedClip,
                        transform: {
                          ...selectedClip.transform,
                          keyframes: updatedKeyframes,
                        },
                      });
                    }}
                    className="text-neutral-500 hover:text-red-400 p-0.5"
                    title="Remove keyframe"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}

            {Object.values(selectedClip.transform.keyframes).every((list) => !list || list.length === 0) && (
              <p className="text-neutral-500 text-xs italic text-center py-2">
                No keyframes yet. Click any ◇ icon to add a keyframe at the playhead!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
