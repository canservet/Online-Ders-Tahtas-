import React, { useState } from 'react';
import type { WhiteboardElement, BoardBackgroundType } from '../types/whiteboard.ts';
import { BOARD_BACKGROUNDS } from '../types/whiteboard.ts';
import { exportWhiteboardToPdf } from '../utils/pdfExport.ts';
import { 
  FileText, 
  Download, 
  Check, 
  Layers, 
  FileCheck, 
  Loader2, 
  Calendar, 
  X
} from 'lucide-react';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: WhiteboardElement[];
  backgroundType: BoardBackgroundType;
  totalPages: number;
  activePage: number;
  roomTitle: string;
  roomCode: string;
  teacherName: string;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  elements,
  backgroundType,
  totalPages,
  activePage,
  roomTitle,
  roomCode,
  teacherName,
}) => {
  const [exportMode, setExportMode] = useState<'all' | 'current'>('all');
  const [customTitle, setCustomTitle] = useState(roomTitle || 'Ders Notları');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; text: string } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const bgConfig = BOARD_BACKGROUNDS[backgroundType] || BOARD_BACKGROUNDS['chalkboard-black'];

  const handleStartExport = async () => {
    setIsExporting(true);
    setIsSuccess(false);

    try {
      await exportWhiteboardToPdf({
        elements,
        backgroundType,
        totalPages,
        activePage,
        lessonTitle: customTitle,
        teacherName,
        roomCode,
        exportMode,
        onProgress: (current, total, text) => {
          setProgress({ current, total, text });
        },
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsExporting(false);
        setIsSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('PDF export failed:', err);
      setIsExporting(false);
      alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const pagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-black border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Ders Notlarını PDF Al
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {exportMode === 'all' ? `${totalPages} Sayfa` : '1 Sayfa'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Tahtadaki çizimleri ve notları PDF olarak kaydedin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white flex items-center justify-center transition-colors text-sm disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* Export Mode Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">İndirilecek Sayfalar</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setExportMode('all')}
                disabled={isExporting}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  exportMode === 'all'
                    ? 'border-white bg-zinc-900 ring-2 ring-white/20 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Layers className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Tüm Sayfalar ({totalPages})</span>
                  </div>
                  {exportMode === 'all' && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-[11px] opacity-75">
                  Tüm tahta slaytlarını tek PDF dosyasında toplar.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setExportMode('current')}
                disabled={isExporting}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  exportMode === 'current'
                    ? 'border-white bg-zinc-900 ring-2 ring-white/20 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <FileCheck className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Sadece Sayfa {activePage}</span>
                  </div>
                  {exportMode === 'current' && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-[11px] opacity-75">
                  Yalnızca ekranda açık olan aktif sayfayı kaydeder.
                </span>
              </button>
            </div>
          </div>

          {/* Lesson Title Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Ders Başlığı</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              disabled={isExporting}
              placeholder="Örn: Ders Notu"
              className="w-full bg-zinc-900 text-white text-xs px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-white font-sans"
            />
          </div>

          {/* Document Summary Info */}
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-zinc-500 block text-[10px]">Format</span>
              <span className="font-semibold text-zinc-300">Yatay A4</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">Zemin</span>
              <span className="font-semibold text-zinc-300 truncate block">{bgConfig.name}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">Çizim Sayısı</span>
              <span className="font-semibold text-zinc-300">
                {exportMode === 'all' 
                  ? `${elements.length} Öğe` 
                  : `${elements.filter(e => e.pageId === activePage).length} Öğe`}
              </span>
            </div>
          </div>

          {/* Progress bar if exporting */}
          {isExporting && (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  <span>{progress?.text || 'PDF oluşturuluyor...'}</span>
                </div>
                <span>
                  {progress ? `${Math.round((progress.current / progress.total) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${progress ? (progress.current / progress.total) * 100 : 15}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-black flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date().toLocaleDateString('tr-TR')}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Vazgeç
            </button>

            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-sm"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Hazırlanıyor...</span>
                </>
              ) : isSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>İndirildi</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF İndir</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
