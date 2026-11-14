import React, { useState, useEffect } from 'react';
import type { ToolType, BoardBackgroundType } from '../types/whiteboard.ts';
import { 
  Pen, 
  Highlighter, 
  Radio, 
  Eraser, 
  Square, 
  Circle, 
  Triangle, 
  ArrowRight, 
  Minus, 
  TrendingUp, 
  Type, 
  StickyNote, 
  Undo2, 
  Redo2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Layers,
  EyeOff,
  Hand,
  Tablet
} from 'lucide-react';

interface ToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  strokeColor: string;
  onSelectColor: (color: string) => void;
  strokeWidth: number;
  onSelectStrokeWidth: (width: number) => void;
  isFilled: boolean;
  onToggleFilled: () => void;
  canDraw: boolean;
  isTeacher: boolean;
  activePage: number;
  totalPages: number;
  onSetPage: (page: number) => void;
  onAddPage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
  currentBackground: BoardBackgroundType;
  onOpenPageManager: () => void;
  isUiCollapsed: boolean;
  onToggleUiCollapse: () => void;
  isTabletWritingMode?: boolean;
  onToggleTabletWritingMode?: () => void;
}

const PEN_PRESET_COLORS = [
  { color: '#ffffff', label: 'Beyaz' },
  { color: '#000000', label: 'Siyah' },
  { color: '#ef4444', label: 'Kırmızı' },
  { color: '#38bdf8', label: 'Mavi' },
  { color: '#fef08a', label: 'Sarı' },
  { color: '#22c55e', label: 'Yeşil' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  strokeColor,
  onSelectColor,
  strokeWidth,
  onSelectStrokeWidth,
  canDraw,
  isTeacher,
  activePage,
  totalPages,
  onSetPage,
  onAddPage,
  onUndo,
  onRedo,
  onClearPage,
  currentBackground,
  onOpenPageManager,
  isUiCollapsed,
  onToggleUiCollapse,
  isTabletWritingMode = false,
  onToggleTabletWritingMode,
}) => {
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [openPenColorSlot, setOpenPenColorSlot] = useState<1 | 2 | null>(null);

  const isLightBoard = ['whiteboard-clean', 'grid-white', 'lined-white', 'dots-white', 'notebook-grid', 'notebook-lined', 'isometric'].includes(currentBackground);
  const defaultPrimaryColor = isLightBoard ? '#000000' : '#ffffff';

  const [activePenSlot, setActivePenSlot] = useState<1 | 2>(1);
  const [pen1Color, setPen1Color] = useState<string>(defaultPrimaryColor);
  const [pen2Color, setPen2Color] = useState<string>('#ef4444');

  // Keep Pen 1 contrast synced when board flips between dark and light
  useEffect(() => {
    setPen1Color(prev => {
      if (isLightBoard && prev === '#ffffff') return '#000000';
      if (!isLightBoard && prev === '#000000') return '#ffffff';
      return prev;
    });
  }, [isLightBoard]);

  // Keep local slot color synced with external strokeColor changes
  useEffect(() => {
    if (currentTool === 'pen') {
      if (activePenSlot === 1) {
        setPen1Color(strokeColor);
      } else {
        setPen2Color(strokeColor);
      }
    }
  }, [strokeColor, currentTool, activePenSlot]);

  // If user is a student without drawing permission ("söz verilmemişse"), hide toolbar completely
  if (!isTeacher && !canDraw) {
    return null;
  }

  const handleSelectPenSlot = (slot: 1 | 2) => {
    setShapesMenuOpen(false);
    const slotColor = slot === 1 ? pen1Color : pen2Color;

    // If clicking the already-active pen slot, toggle its color palette popover
    if (currentTool === 'pen' && activePenSlot === slot) {
      setOpenPenColorSlot(prev => (prev === slot ? null : slot));
      return;
    }

    setActivePenSlot(slot);
    setOpenPenColorSlot(null);
    onSelectTool('pen');
    onSelectColor(slotColor);
  };

  const handlePickColorForSlot = (slot: 1 | 2, color: string) => {
    if (slot === 1) {
      setPen1Color(color);
    } else {
      setPen2Color(color);
    }
    setActivePenSlot(slot);
    onSelectTool('pen');
    onSelectColor(color);
    setOpenPenColorSlot(null);
  };

  const handleToolClick = (tool: ToolType) => {
    onSelectTool(tool);
    setShapesMenuOpen(false);
    setOpenPenColorSlot(null);
    if (window.innerWidth < 768 && isTeacher) {
      onToggleUiCollapse();
    }
  };

  // STUDENT BAR (Söz verilmişse çıkar: İki kalem yazma/çizme + renk seçimi + silme)
  if (!isTeacher && canDraw) {
    return (
      <div className="fixed bottom-5 left-1/2 transform -translate-x-1/2 z-40 max-w-[96vw]">
        <div className="relative bg-black/95 backdrop-blur-xl border border-zinc-700 rounded-2xl shadow-2xl p-2 flex items-center gap-1.5 text-white">
          {/* Geri Al */}
          <button
            onClick={onUndo}
            title="Geri Al"
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border-r border-zinc-800 pr-2.5"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* 1. Kalem (Tıklayınca seç, tekrar tıklayınca renk seç) */}
          <div className="relative">
            <button
              onClick={() => handleSelectPenSlot(1)}
              title="1. Kalem (Renk değiştirmek için tekrar tıklayın)"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                currentTool === 'pen' && activePenSlot === 1
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              <Pen className="w-4 h-4" />
              <span>Kalem 1</span>
              <span
                className="w-3.5 h-3.5 rounded-full border border-zinc-500 shadow-sm"
                style={{ backgroundColor: pen1Color }}
              />
            </button>

            {openPenColorSlot === 1 && (
              <div className="absolute bottom-14 left-0 bg-black border border-zinc-700 rounded-xl shadow-2xl p-2.5 w-48 z-50 space-y-2">
                <div className="text-[11px] font-semibold text-zinc-400">Kalem 1 Rengi</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PEN_PRESET_COLORS.map(item => (
                    <button
                      key={item.color}
                      onClick={() => handlePickColorForSlot(1, item.color)}
                      title={item.label}
                      className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
                        pen1Color === item.color ? 'border-white ring-2 ring-white/50' : 'border-zinc-600'
                      }`}
                      style={{ backgroundColor: item.color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Kalem (Tıklayınca seç, tekrar tıklayınca renk seç) */}
          <div className="relative">
            <button
              onClick={() => handleSelectPenSlot(2)}
              title="2. Kalem (Renk değiştirmek için tekrar tıklayın)"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                currentTool === 'pen' && activePenSlot === 2
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              <Pen className="w-4 h-4" />
              <span>Kalem 2</span>
              <span
                className="w-3.5 h-3.5 rounded-full border border-zinc-500 shadow-sm"
                style={{ backgroundColor: pen2Color }}
              />
            </button>

            {openPenColorSlot === 2 && (
              <div className="absolute bottom-14 left-0 bg-black border border-zinc-700 rounded-xl shadow-2xl p-2.5 w-48 z-50 space-y-2">
                <div className="text-[11px] font-semibold text-zinc-400">Kalem 2 Rengi</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PEN_PRESET_COLORS.map(item => (
                    <button
                      key={item.color}
                      onClick={() => handlePickColorForSlot(2, item.color)}
                      title={item.label}
                      className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
                        pen2Color === item.color ? 'border-white ring-2 ring-white/50' : 'border-zinc-600'
                      }`}
                      style={{ backgroundColor: item.color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Doğrudan Renk Ver (Aktif kaleme tek tık renk) */}
          <div className="hidden sm:flex items-center gap-1 px-2 border-l border-r border-zinc-800">
            {PEN_PRESET_COLORS.slice(0, 5).map(item => (
              <button
                key={item.color}
                onClick={() => handlePickColorForSlot(activePenSlot, item.color)}
                title={`${item.label} Renk`}
                className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                  currentTool === 'pen' && strokeColor === item.color
                    ? 'border-white ring-2 ring-white/60 scale-110'
                    : 'border-zinc-600'
                }`}
                style={{ backgroundColor: item.color }}
              />
            ))}
          </div>

          {/* Silgi (Silme) */}
          <button
            onClick={() => handleToolClick('eraser')}
            title="Silgi"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              currentTool === 'eraser'
                ? 'bg-white text-black border-white shadow-md'
                : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            <Eraser className="w-4 h-4" />
            <span>Silgi</span>
          </button>
        </div>
      </div>
    );
  }

  // TEACHER BAR
  return (
    <>
      {/* Floating Minimal Restore Trigger Button on Mobile/Collapsed Mode */}
      {isUiCollapsed && (
        <button
          onClick={onToggleUiCollapse}
          title="Araç Çubuğunu Göster"
          className="fixed bottom-5 right-5 z-40 px-3.5 py-2.5 rounded-full bg-white text-black font-semibold text-xs shadow-2xl border border-zinc-300 flex items-center gap-2 hover:bg-zinc-200 transition-all transform hover:scale-105 active:scale-95"
        >
          <Pen className="w-3.5 h-3.5" />
          <span>Araçlar</span>
        </button>
      )}

      {/* Main floating bar (Hidden when isUiCollapsed is true) */}
      <div 
        className={`fixed bottom-5 left-1/2 transform -translate-x-1/2 z-40 max-w-[96vw] transition-all duration-300 ${
          isUiCollapsed 
            ? 'opacity-0 pointer-events-none translate-y-10' 
            : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="bg-black/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-1.5 sm:p-2 flex items-center gap-1 sm:gap-1.5 text-white">
          {/* Undo & Redo */}
          {canDraw && (
            <div className="flex items-center gap-0.5 pr-1 border-r border-zinc-800">
              <button
                onClick={onUndo}
                title="Geri Al (Ctrl+Z)"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={onRedo}
                title="Yinele (Ctrl+Y)"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Primary Drawing Tools: 2 Pens with clickable color selection (No Chalk!) */}
          <div className="flex items-center gap-0.5">
            {/* Kalem 1 (Tıklayınca seç, tekrar tıklayınca renk & kalınlık seç) */}
            <div className="relative">
              <button
                onClick={() => handleSelectPenSlot(1)}
                disabled={!canDraw}
                title="1. Kalem (Renk vermek için tekrar tıklayın)"
                className={`p-2 rounded-lg transition-all flex items-center gap-1 ${
                  currentTool === 'pen' && activePenSlot === 1
                    ? 'bg-white text-black shadow-sm font-bold'
                    : canDraw 
                      ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' 
                      : 'text-zinc-600 cursor-not-allowed'
                }`}
              >
                <Pen className="w-4 h-4" />
                <span
                  className="w-2.5 h-2.5 rounded-full border border-zinc-500"
                  style={{ backgroundColor: pen1Color }}
                />
              </button>

              {openPenColorSlot === 1 && (
                <div className="absolute bottom-12 left-0 bg-black border border-zinc-800 rounded-xl shadow-2xl p-3 w-52 z-50 animate-in fade-in space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-400 mb-2">1. Kalem Rengi</div>
                    <div className="flex flex-wrap gap-2">
                      {PEN_PRESET_COLORS.map(item => (
                        <button
                          key={item.color}
                          onClick={() => handlePickColorForSlot(1, item.color)}
                          title={item.label}
                          className={`w-7 h-7 rounded-full border transition-transform hover:scale-110 ${
                            pen1Color === item.color ? 'border-white ring-2 ring-white/50' : 'border-zinc-700'
                          }`}
                          style={{ backgroundColor: item.color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-400 mb-2">Çizgi Kalınlığı</div>
                    <div className="flex gap-1">
                      {[2, 4, 8, 14].map(w => (
                        <button
                          key={w}
                          onClick={() => {
                            onSelectStrokeWidth(w);
                            setOpenPenColorSlot(null);
                          }}
                          className={`flex-1 py-1 rounded text-xs font-mono border ${
                            strokeWidth === w 
                              ? 'bg-white text-black border-white font-bold' 
                              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                          }`}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Kalem 2 (Ön tanımlı Kırmızı Kalem - tıklayıp renk verilebilir) */}
            <div className="relative">
              <button
                onClick={() => handleSelectPenSlot(2)}
                disabled={!canDraw}
                title="2. Kalem (Renk vermek için tekrar tıklayın)"
                className={`p-2 rounded-lg transition-all flex items-center gap-1 ${
                  currentTool === 'pen' && activePenSlot === 2
                    ? 'bg-white text-black shadow-sm font-bold'
                    : canDraw 
                      ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' 
                      : 'text-zinc-600 cursor-not-allowed'
                }`}
              >
                <Pen className="w-4 h-4" />
                <span
                  className="w-2.5 h-2.5 rounded-full border border-zinc-500"
                  style={{ backgroundColor: pen2Color }}
                />
              </button>

              {openPenColorSlot === 2 && (
                <div className="absolute bottom-12 left-0 bg-black border border-zinc-800 rounded-xl shadow-2xl p-3 w-52 z-50 animate-in fade-in space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-400 mb-2">2. Kalem Rengi</div>
                    <div className="flex flex-wrap gap-2">
                      {PEN_PRESET_COLORS.map(item => (
                        <button
                          key={item.color}
                          onClick={() => handlePickColorForSlot(2, item.color)}
                          title={item.label}
                          className={`w-7 h-7 rounded-full border transition-transform hover:scale-110 ${
                            pen2Color === item.color ? 'border-white ring-2 ring-white/50' : 'border-zinc-700'
                          }`}
                          style={{ backgroundColor: item.color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-400 mb-2">Çizgi Kalınlığı</div>
                    <div className="flex gap-1">
                      {[2, 4, 8, 14].map(w => (
                        <button
                          key={w}
                          onClick={() => {
                            onSelectStrokeWidth(w);
                            setOpenPenColorSlot(null);
                          }}
                          className={`flex-1 py-1 rounded text-xs font-mono border ${
                            strokeWidth === w 
                              ? 'bg-white text-black border-white font-bold' 
                              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                          }`}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Inline Quick Color Swatches right on bottom bar */}
            {canDraw && (
              <div className="hidden md:flex items-center gap-1 px-1.5 mx-0.5 border-l border-r border-zinc-800">
                {PEN_PRESET_COLORS.map(item => (
                  <button
                    key={item.color}
                    onClick={() => handlePickColorForSlot(activePenSlot, item.color)}
                    title={`Aktif Kalemi ${item.label} Yap`}
                    className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 ${
                      currentTool === 'pen' && strokeColor === item.color
                        ? 'border-white ring-2 ring-white/60 scale-110'
                        : 'border-zinc-600'
                    }`}
                    style={{ backgroundColor: item.color }}
                  />
                ))}
              </div>
            )}

            {/* Highlighter */}
            <button
              onClick={() => handleToolClick('highlighter')}
              disabled={!canDraw}
              title="Fosforlu Kalem"
              className={`p-2 rounded-lg transition-all ${
                currentTool === 'highlighter'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : canDraw 
                    ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' 
                    : 'text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Highlighter className="w-4 h-4" />
            </button>

            {/* Laser Pointer */}
            <button
              onClick={() => handleToolClick('laser')}
              title="Lazer İşaretçi (Tüm öğrencilere anında görünür)"
              className={`p-2 rounded-lg transition-all ${
                currentTool === 'laser'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Radio className="w-4 h-4" />
            </button>

            {/* Eraser */}
            {canDraw && (
              <button
                onClick={() => handleToolClick('eraser')}
                title="Silgi"
                className={`p-2 rounded-lg transition-all ${
                  currentTool === 'eraser'
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Eraser className="w-4 h-4" />
              </button>
            )}

            {/* Pan / Sayfa Kaydır Tool */}
            <button
              onClick={() => handleToolClick('pan')}
              title="Sayfayı Kaydır (El / Pan Aracı)"
              className={`p-2 rounded-lg transition-all ${
                currentTool === 'pan'
                  ? 'bg-white text-black shadow-sm font-bold'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Hand className="w-4 h-4" />
            </button>
          </div>

          {/* Shapes Popover Button */}
          {canDraw && (
            <div className="relative">
              <button
                onClick={() => {
                  setShapesMenuOpen(!shapesMenuOpen);
                  setOpenPenColorSlot(null);
                }}
                title="Geometrik Şekiller & Şablonlar"
                className={`p-2 rounded-lg transition-all flex items-center gap-1 ${
                  ['line', 'arrow', 'rect', 'circle', 'triangle', 'axes'].includes(currentTool)
                    ? 'bg-white text-black shadow-sm font-bold'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Square className="w-4 h-4" />
              </button>

              {shapesMenuOpen && (
                <div 
                  className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-black border border-zinc-800 rounded-xl shadow-2xl p-2 grid grid-cols-3 gap-1.5 w-44 z-50 animate-in fade-in"
                  onClick={() => setShapesMenuOpen(false)}
                >
                  <button
                    onClick={() => handleToolClick('line')}
                    className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[11px] ${
                      currentTool === 'line' ? 'bg-white text-black font-semibold' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                    <span>Çizgi</span>
                  </button>
                  <button
                    onClick={() => handleToolClick('arrow')}
                    className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[11px] ${
                      currentTool === 'arrow' ? 'bg-white text-black font-semibold' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Ok</span>
                  </button>
                  <button
                    onClick={() => handleToolClick('rect')}
                    className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[11px] ${
                      currentTool === 'rect' ? 'bg-white text-black font-semibold' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <Square className="w-4 h-4" />
                    <span>Kutu</span>
                  </button>
                  <button
                    onClick={() => handleToolClick('circle')}
                    className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[11px] ${
                      currentTool === 'circle' ? 'bg-white text-black font-semibold' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <Circle className="w-4 h-4" />
                    <span>Çember</span>
                  </button>
                  <button
                    onClick={() => handleToolClick('triangle')}
                    className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[11px] ${
                      currentTool === 'triangle' ? 'bg-white text-black font-semibold' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <Triangle className="w-4 h-4" />
                    <span>Üçgen</span>
                  </button>
                  <button
                    onClick={() => handleToolClick('axes')}
                    title="Matematik Koordinat Düzlemi (x-y)"
                    className={`p-2 rounded-lg flex flex-col items-center gap-1 text-[11px] ${
                      currentTool === 'axes' ? 'bg-white text-black font-semibold' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>x-y Eksen</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Text & Sticky Note */}
          {canDraw && (
            <div className="flex items-center gap-0.5 pr-1 border-r border-zinc-800">
              <button
                onClick={() => handleToolClick('text')}
                title="Metin Yaz"
                className={`p-2 rounded-lg transition-all ${
                  currentTool === 'text'
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToolClick('sticky')}
                title="Ders Notu Kartı"
                className={`p-2 rounded-lg transition-all ${
                  currentTool === 'sticky'
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <StickyNote className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Slide / Pages Navigation */}
          <div className="flex items-center gap-0.5 px-1">
            <button
              onClick={() => onSetPage(Math.max(1, activePage - 1))}
              disabled={activePage <= 1}
              title="Önceki Sayfa (◀)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <button
              onClick={onOpenPageManager}
              title="Tüm Sayfaları Gör / Sayfalar Paneli"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono font-semibold transition-colors border border-zinc-800"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              <span>{activePage}/{totalPages}</span>
            </button>

            <button
              onClick={() => onSetPage(Math.min(totalPages, activePage + 1))}
              disabled={activePage >= totalPages}
              title="Sonraki Sayfa (▶)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {isTeacher && (
              <button
                onClick={onAddPage}
                title="Yeni Sayfa Ekle (+)"
                className="p-1.5 rounded-lg text-white hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Actions: Tablet Modu, Clear, and Mobile Hide/Collapse */}
          <div className="flex items-center gap-1 pl-1 border-l border-zinc-800">
            {/* Yazı Tahtası / Çizim Tableti Modu */}
            {onToggleTabletWritingMode && (
              <button
                onClick={onToggleTabletWritingMode}
                title="Çizim Tableti / Yazı Tahtası Modu"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  isTabletWritingMode
                    ? 'bg-white text-black border-white shadow-md ring-2 ring-white/40'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800 border-zinc-700/80'
                }`}
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tablet Modu</span>
              </button>
            )}

            {canDraw && (
              <button
                onClick={onClearPage}
                title="Bu Sayfayı Temizle"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Collapse/Hide UI button (Full Screen Focus Mode) */}
            <button
              onClick={onToggleUiCollapse}
              title="Menüyü Gizle (Tam Ekran Çizim Alanı)"
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
