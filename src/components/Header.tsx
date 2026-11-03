import React, { useRef } from 'react';
import { AspectRatio, RESOLUTION_PRESETS } from '../types/editor';
import { 
  Scissors, 
  Download, 
  Upload, 
  Type, 
  Sparkles, 
  Smartphone, 
  Square, 
  Monitor, 
  Grid 
} from 'lucide-react';
import { createStickerSvg, generateSyntheticAudio } from '../utils/starterMedia';

interface HeaderProps {
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ar: AspectRatio) => void;
  showSafeZones: boolean;
  onToggleSafeZones: () => void;
  onAddTextClip: () => void;
  onImportFiles: (files: FileList) => void;
  onInsertSample: (type: 'cyber' | 'sunset' | 'trap' | 'lofi' | 'whoosh' | 'sticker') => void;
  onExportClick: () => void;
  isExporting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  aspectRatio,
  onAspectRatioChange,
  showSafeZones,
  onToggleSafeZones,
  onAddTextClip,
  onImportFiles,
  onInsertSample,
  onExportClick,
  isExporting,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sampleMenuOpen, setSampleMenuOpen] = React.useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <header className="h-14 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between select-none shrink-0 z-20">
      {/* Zone 1: Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Scissors className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white font-['Outfit']">
            ElementCut
          </span>
        </div>

        <div className="h-4 w-px bg-neutral-800 mx-1" />

        {/* Aspect Ratio Switcher */}
        <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          <button
            onClick={() => onAspectRatioChange('9:16')}
            title="9:16 Shorts / TikTok (1080x1920)"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              aspectRatio === '9:16'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16 Shorts</span>
          </button>

          <button
            onClick={() => onAspectRatioChange('1:1')}
            title="1:1 Square (1080x1080)"
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
              aspectRatio === '1:1'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>1:1</span>
          </button>

          <button
            onClick={() => onAspectRatioChange('16:9')}
            title="16:9 Landscape (1920x1080)"
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
              aspectRatio === '16:9'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>16:9</span>
          </button>
        </div>

        {/* Safe Area Guides Toggle */}
        <button
          onClick={onToggleSafeZones}
          title="Toggle Shorts Safe Zone Overlay"
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
            showSafeZones
              ? 'bg-neutral-800 border-neutral-700 text-blue-400'
              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Safe Zones</span>
        </button>
      </div>

      {/* Zone 3: Actions (Add Text, Sample Media, Import, Export) */}
      <div className="flex items-center gap-2">
        {/* Add Text Button */}
        <button
          onClick={onAddTextClip}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
        >
          <Type className="w-3.5 h-3.5 text-purple-400" />
          <span>Add Text</span>
        </button>

        {/* Sample Library Dropdown */}
        <div className="relative">
          <button
            onClick={() => setSampleMenuOpen(!sampleMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Samples</span>
          </button>

          {sampleMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 z-30">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                Video Clips
              </div>
              <button
                onClick={() => { onInsertSample('cyber'); setSampleMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 text-neutral-300 hover:text-white"
              >
                + Neon Horizon Loop
              </button>
              <button
                onClick={() => { onInsertSample('sunset'); setSampleMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 text-neutral-300 hover:text-white"
              >
                + Sunset Glow Loop
              </button>

              <div className="border-t border-neutral-800 my-1" />
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                Audio Tracks
              </div>
              <button
                onClick={() => { onInsertSample('lofi'); setSampleMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 text-neutral-300 hover:text-white"
              >
                + Lo-Fi Chill Beat
              </button>
              <button
                onClick={() => { onInsertSample('trap'); setSampleMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 text-neutral-300 hover:text-white"
              >
                + Upbeat 808 Hook
              </button>
              <button
                onClick={() => { onInsertSample('whoosh'); setSampleMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 text-neutral-300 hover:text-white"
              >
                + Whoosh Transition SFX
              </button>

              <div className="border-t border-neutral-800 my-1" />
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                Stickers & Badges
              </div>
              <button
                onClick={() => { onInsertSample('sticker'); setSampleMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 text-neutral-300 hover:text-white"
              >
                + Lightning / Fire Badge
              </button>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="video/*,audio/*,image/*"
          className="hidden"
        />

        {/* Import Media Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-blue-400" />
          <span>Import</span>
        </button>

        {/* Export MP4 Button */}
        <button
          onClick={onExportClick}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Exporting...' : 'Export MP4'}</span>
        </button>
      </div>
    </header>
  );
};
