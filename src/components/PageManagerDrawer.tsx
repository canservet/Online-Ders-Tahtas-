import React from 'react';
import type { WhiteboardElement, BoardBackgroundType } from '../types/whiteboard.ts';
import { BOARD_BACKGROUNDS } from '../types/whiteboard.ts';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Layers, 
  Eraser, 
  X,
  FileText
} from 'lucide-react';

interface PageManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePage: number;
  totalPages: number;
  onSelectPage: (pageId: number) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: number) => void;
  onDuplicatePage: (pageId: number) => void;
  onClearPage: (pageId: number) => void;
  elements: WhiteboardElement[];
  backgroundType: BoardBackgroundType;
  isTeacher: boolean;
  onOpenPdfModal: () => void;
}

export const PageManagerDrawer: React.FC<PageManagerDrawerProps> = ({
  isOpen,
  onClose,
  activePage,
  totalPages,
  onSelectPage,
  onAddPage,
  onDeletePage,
  onDuplicatePage,
  onClearPage,
  elements,
  backgroundType,
  isTeacher,
  onOpenPdfModal,
}) => {
  if (!isOpen) return null;

  const bgConfig = BOARD_BACKGROUNDS[backgroundType] || BOARD_BACKGROUNDS['chalkboard-black'];
  const pagesList = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-black/95 backdrop-blur-2xl border-r border-zinc-800 shadow-2xl flex flex-col text-white animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sayfalar & Slaytlar</h3>
            <span className="text-[11px] text-zinc-400">Toplam {totalPages} Sayfa</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons: Add Page & PDF Al */}
      <div className="p-3 border-b border-zinc-800 bg-black flex gap-2">
        {isTeacher && (
          <button
            onClick={onAddPage}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yeni Sayfa</span>
          </button>
        )}

        <button
          onClick={() => {
            onClose();
            onOpenPdfModal();
          }}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 font-semibold text-xs transition-all"
          title="Tüm Sayfaları PDF Olarak İndir"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDF Al</span>
        </button>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {pagesList.map((pageNum) => {
          const isActive = pageNum === activePage;
          const pageElems = elements.filter(e => e.pageId === pageNum);

          return (
            <div
              key={pageNum}
              onClick={() => onSelectPage(pageNum)}
              className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'border-white bg-zinc-900 ring-2 ring-white/20 shadow-md'
                  : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                    Sayfa {pageNum}
                  </span>
                  {isActive && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-black font-bold">
                      Aktif
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-zinc-500 font-medium">
                  {pageElems.length} öğe
                </span>
              </div>

              {/* Mini Board Swatch Preview */}
              <div 
                className="w-full h-14 rounded-lg relative overflow-hidden border border-zinc-700/60 p-2 flex items-center justify-center"
                style={{ backgroundColor: bgConfig.bgColor }}
              >
                <span 
                  className="text-[11px] font-mono font-semibold select-none truncate"
                  style={{ color: bgConfig.defaultStrokeColor }}
                >
                  {pageElems.length > 0 ? `${pageElems.length} Çizim` : 'Boş'}
                </span>
              </div>

              {/* Quick Actions (Duplicate, Clear, Delete) for Teacher */}
              {isTeacher && (
                <div 
                  className="flex items-center justify-end gap-1.5 mt-2 pt-1.5 border-t border-zinc-800/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onDuplicatePage(pageNum)}
                    title="Bu Sayfayı Çoğalt"
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onClearPage(pageNum)}
                    title="Bu Sayfadaki Çizimleri Temizle"
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>

                  {totalPages > 1 && (
                    <button
                      onClick={() => onDeletePage(pageNum)}
                      title="Bu Sayfayı Sil"
                      className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
