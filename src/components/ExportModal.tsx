import React from 'react';
import { ExportProgress, downloadBlob } from '../utils/exportMp4';
import { Resolution } from '../types/editor';
import { Download, CheckCircle2, Film, X } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: ExportProgress | null;
  completedBlob: Blob | null;
  resolution: Resolution;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  progress,
  completedBlob,
  resolution,
}) => {
  if (!isOpen) return null;

  const isComplete = !!completedBlob;
  const percentage = progress ? Math.round(progress.progress * 100) : 0;

  const handleDownload = () => {
    if (completedBlob) {
      downloadBlob(completedBlob, `ElementCut_${resolution.aspectRatio.replace(':', 'x')}_${Date.now()}.mp4`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden">
        {/* Close button if complete or ready */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            {isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Film className="w-5 h-5 animate-pulse text-blue-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isComplete ? 'Export Ready' : 'Exporting MP4 Video'}
            </h3>
            <p className="text-xs text-neutral-400">
              {resolution.label} · {resolution.width}×{resolution.height} @ 30fps
            </p>
          </div>
        </div>

        {/* Progress or Completion Body */}
        {!isComplete ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">
                  {progress?.status || 'Preparing rendering engine...'}
                </span>
                <span className="font-timecode font-semibold text-blue-400">
                  {percentage}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-blue-600 transition-all duration-150 rounded-full shadow-[0_0_12px_rgba(37,99,235,0.8)]"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
              Synthesizing canvas transforms, keyframe transitions, and mixed audio tracks locally on your PC.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 text-center space-y-1">
              <span className="text-xs text-emerald-400 font-semibold block">
                Video Rendered Successfully!
              </span>
              <span className="text-xs text-neutral-400 block font-timecode">
                Size: {(completedBlob.size / (1024 * 1024)).toFixed(2)} MB · Format: MP4
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download MP4</span>
              </button>

              <button
                onClick={onClose}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
