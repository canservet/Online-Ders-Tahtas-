import React from 'react';
import type { BoardBackgroundType } from '../types/whiteboard.ts';
import { BOARD_BACKGROUNDS } from '../types/whiteboard.ts';
import { Check, Lock, Palette, X } from 'lucide-react';

interface BackgroundSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBackground: BoardBackgroundType;
  onSelectBackground: (type: BoardBackgroundType) => void;
  isTeacher: boolean;
}

const MONOCHROME_BACKGROUND_KEYS: BoardBackgroundType[] = [
  'chalkboard-black',
  'whiteboard-clean',
  'grid-black',
  'grid-white',
  'lined-black',
  'lined-white',
  'dots-black',
  'dots-white',
];

export const BackgroundSelectorModal: React.FC<BackgroundSelectorModalProps> = ({
  isOpen,
  onClose,
  currentBackground,
  onSelectBackground,
  isTeacher,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-black border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Ders Tahtası Arka Planı
              </h2>
              <p className="text-xs text-zinc-400">
                Siyah & Beyaz yüksek kontrastlı minimal ders zeminleri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {!isTeacher && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs">
              <Lock className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
              <span>İzleme modundasınız. Tahta arka planı öğretmen tarafından değiştirilir.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MONOCHROME_BACKGROUND_KEYS.map((key) => {
              const bg = BOARD_BACKGROUNDS[key];
              if (!bg) return null;
              const isSelected = currentBackground === key;

              return (
                <div
                  key={key}
                  onClick={() => {
                    if (isTeacher) {
                      onSelectBackground(key);
                    }
                  }}
                  className={`group relative p-3 rounded-xl border text-left transition-all ${
                    isTeacher ? 'cursor-pointer hover:border-zinc-500' : 'opacity-80'
                  } ${
                    isSelected
                      ? 'border-white bg-zinc-900 ring-2 ring-white/20 shadow-md'
                      : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60'
                  }`}
                >
                  {/* Swatch Preview */}
                  <div 
                    className="w-full h-20 rounded-lg relative overflow-hidden border border-zinc-700/60 mb-2.5 flex items-center justify-center"
                    style={{ backgroundColor: bg.bgColor }}
                  >
                    {/* Pattern Preview */}
                    <svg className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id={`preview-grid-${key}`} width="16" height="16" patternUnits="userSpaceOnUse">
                          <path d="M 16 0 L 0 0 0 16" fill="none" stroke={bg.lineColor} strokeWidth="1" />
                        </pattern>
                        <pattern id={`preview-lined-${key}`} width="100%" height="16" patternUnits="userSpaceOnUse">
                          <line x1="0" y1="16" x2="100%" y2="16" stroke={bg.lineColor} strokeWidth="1" />
                        </pattern>
                        <pattern id={`preview-dots-${key}`} width="16" height="16" patternUnits="userSpaceOnUse">
                          <circle cx="8" cy="8" r="1" fill={bg.lineColor} />
                        </pattern>
                      </defs>

                      {bg.pattern === 'grid' && (
                        <rect width="100%" height="100%" fill={`url(#preview-grid-${key})`} />
                      )}
                      {bg.pattern === 'lined' && (
                        <rect width="100%" height="100%" fill={`url(#preview-lined-${key})`} />
                      )}
                      {bg.pattern === 'dots' && (
                        <rect width="100%" height="100%" fill={`url(#preview-dots-${key})`} />
                      )}
                    </svg>

                    <span 
                      className="text-xs font-mono font-bold select-none relative z-10"
                      style={{ color: bg.defaultStrokeColor }}
                    >
                      f(x) = y²
                    </span>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        {bg.name}
                      </span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        {bg.description}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-black flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-lg transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
