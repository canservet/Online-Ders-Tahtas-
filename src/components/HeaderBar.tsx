import React, { useState } from 'react';
import type { UserPresence, BoardBackgroundType } from '../types/whiteboard.ts';
import { BOARD_BACKGROUNDS } from '../types/whiteboard.ts';
import { 
  Users, 
  Copy, 
  Check, 
  Hand, 
  MessageSquare, 
  Lock, 
  Unlock, 
  Columns, 
  GraduationCap,
  Layers,
  FileText,
  Tablet,
  Pen,
  XCircle
} from 'lucide-react';

interface HeaderBarProps {
  roomId: string;
  roomTitle: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  userRole: 'teacher' | 'student';
  userName: string;
  activeUsers: UserPresence[];
  studentsCanDraw: boolean;
  grantedStudentIds: string[];
  studentHasFloor: boolean;
  onToggleStudentsDraw: (enabled: boolean) => void;
  onGrantStudentDraw: (studentId: string) => void;
  onRevokeStudentDraw: (studentId: string) => void;
  isHandRaised: boolean;
  onToggleHand: () => void;
  unreadChatCount: number;
  onToggleChat: () => void;
  isChatOpen: boolean;
  isSplitView: boolean;
  onToggleSplitView: () => void;
  backgroundType: BoardBackgroundType;
  onOpenBackgroundModal: () => void;
  activePage: number;
  totalPages: number;
  onOpenPageManager: () => void;
  onOpenPdfModal: () => void;
  isUiCollapsed?: boolean;
  isTabletWritingMode?: boolean;
  onToggleTabletWritingMode?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  roomId,
  roomTitle,
  connectionStatus,
  userRole,
  activeUsers,
  studentsCanDraw,
  grantedStudentIds,
  studentHasFloor,
  onToggleStudentsDraw,
  onGrantStudentDraw,
  onRevokeStudentDraw,
  isHandRaised,
  onToggleHand,
  unreadChatCount,
  onToggleChat,
  isChatOpen,
  isSplitView,
  onToggleSplitView,
  backgroundType,
  onOpenBackgroundModal,
  activePage,
  totalPages,
  onOpenPageManager,
  onOpenPdfModal,
  isUiCollapsed = false,
  isTabletWritingMode = false,
  onToggleTabletWritingMode,
}) => {
  const [copied, setCopied] = useState(false);
  const [usersDropdownOpen, setUsersDropdownOpen] = useState(false);
  const [handQueueOpen, setHandQueueOpen] = useState(false);

  const handleCopyStudentLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    url.searchParams.set('role', 'student');
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bgConfig = BOARD_BACKGROUNDS[backgroundType] || BOARD_BACKGROUNDS['chalkboard-black'];
  const handRaisedUsers = activeUsers.filter(u => u.role === 'student' && u.handRaised);
  const grantedUsers = activeUsers.filter(u => u.role === 'student' && grantedStudentIds.includes(u.id));
  const isTeacher = userRole === 'teacher';

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-b border-zinc-800 px-3 sm:px-5 py-2.5 flex items-center justify-between text-white select-none transition-all duration-300 ${
      isUiCollapsed ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
    }`}>
      {/* Left: Brand & Room Info (+ Öğrenci Linki for Teacher only) */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold shadow-sm shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight hidden sm:inline text-white">Canlı Ders Tahtası</span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono">
                <span className="text-zinc-500">Oda:</span>
                <span className="font-semibold text-white">{roomId}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1.5 text-[11px] font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus === 'connected' 
                    ? 'bg-white' 
                    : connectionStatus === 'connecting' 
                      ? 'bg-zinc-500 animate-pulse' 
                      : 'bg-zinc-700'
                }`} />
                <span className="text-zinc-400">
                  {connectionStatus === 'connected' ? 'Canlı' : connectionStatus === 'connecting' ? 'Bağlanıyor...' : 'Çevrimdışı'}
                </span>
              </span>
              {isTeacher && (
                <>
                  <span className="text-zinc-700 text-xs hidden sm:inline">•</span>
                  <span className="text-[11px] text-zinc-400 truncate max-w-[140px] sm:max-w-none hidden sm:inline">
                    {roomTitle}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Copy Student Link Button (Öğretmen için - Öğrenci göremez) */}
        {isTeacher && (
          <button
            onClick={handleCopyStudentLink}
            title="Öğrenciler için Katılım Linkini Kopyala"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors text-xs font-medium shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Kopyalandı' : 'Öğrenci Linki'}</span>
          </button>
        )}
      </div>

      {/* Middle: Teacher Controls (Board Background, Pages, Split View Test, Lock) */}
      {isTeacher && (
        <div className="hidden lg:flex items-center gap-2">
          {/* Ders Tahtası Seçimi (Üst Barda) */}
          <button
            onClick={onOpenBackgroundModal}
            title="Ders Tahtası Seçimi (Siyah, Beyaz, Kareli, Çizgili)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-all text-xs font-medium"
          >
            <span
              className="w-3.5 h-3.5 rounded border border-zinc-600 shadow-sm shrink-0"
              style={{ backgroundColor: bgConfig.bgColor }}
            />
            <span>{bgConfig.name}</span>
          </button>

          {/* Split View Test Button (Öğretmen için - Öğrenci göremez) */}
          <button
            onClick={onToggleSplitView}
            title="Çift Ekran: Sol tarafta öğretmen gibi çizin, sağ tarafta öğrencinin anlık nasıl gördüğünü test edin!"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isSplitView 
                ? 'bg-white text-black border-white' 
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{isSplitView ? 'Çift Ekran Açık' : 'Öğrenci Görünümünü Test Et'}</span>
          </button>

          {/* Page Manager Drawer Trigger */}
          <button
            onClick={onOpenPageManager}
            title="Sayfalar ve Slaytlar Paneli"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 text-xs font-medium transition-all"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sayfa {activePage} / {totalPages}</span>
          </button>

          {/* Global Teacher Drawing Permission Toggle */}
          <button
            onClick={() => onToggleStudentsDraw(!studentsCanDraw)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              studentsCanDraw 
                ? 'bg-zinc-800 border-zinc-600 text-white' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title={studentsCanDraw ? 'Tüm öğrenciler tahtaya çizebiliyor' : 'Tahta kilitli (söz verilen öğrenci veya öğretmen çizer)'}
          >
            {studentsCanDraw ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{studentsCanDraw ? 'Herkese Açık' : 'Tahta: Kilitli'}</span>
          </button>
        </div>
      )}

      {/* Right: PDF Al, Teacher/Student specific actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* PDF Al (Üst Barda Sadece Bulunsun - Öğretmen ve Öğrenci erişebilir) */}
        <button
          onClick={onOpenPdfModal}
          title="Ders Notlarını PDF Olarak İndir"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black border border-white text-xs font-bold transition-all shadow-sm"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDF Al</span>
        </button>

        {/* STUDENT VIEW: Sadece Söz İste (+ Söz verilmişse durum bilgisi) */}
        {!isTeacher && (
          <>
            {studentHasFloor ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/60 text-white text-xs font-semibold">
                <Pen className="w-3.5 h-3.5 text-white" />
                <span>Söz Hakkınız Açık</span>
              </div>
            ) : (
              <button
                onClick={onToggleHand}
                title={isHandRaised ? 'Söz isteğini geri çek' : 'Söz İste'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  isHandRaised 
                    ? 'bg-white text-black border-white' 
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800'
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span>{isHandRaised ? 'Söz İstendi' : 'Söz İste'}</span>
              </button>
            )}
          </>
        )}

        {/* TEACHER VIEW: Board selector on mobile, Çizim Modu, Söz Ver / Sözü Geri Al, Participants, Chat */}
        {isTeacher && (
          <>
            {/* Mobile Ders Tahtası Butonu */}
            <button
              onClick={onOpenBackgroundModal}
              title="Ders Tahtası Seçimi"
              className="lg:hidden flex items-center gap-1 p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 transition-all"
            >
              <span
                className="w-4 h-4 rounded border border-zinc-600"
                style={{ backgroundColor: bgConfig.bgColor }}
              />
            </button>

            {/* Çizim Modu / Tablet Modu Butonu */}
            {onToggleTabletWritingMode && (
              <button
                onClick={onToggleTabletWritingMode}
                title="Çizim Modu (Tabletle Yazı Yazma & Sayfayı Kaydırma)"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  isTabletWritingMode
                    ? 'bg-white text-black border-white shadow-md ring-2 ring-white/40'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-semibold">Çizim Modu</span>
                {isTabletWritingMode && (
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                )}
              </button>
            )}

            {/* Aktif Söz Verilen Öğrenci: Tek Tıkla "Sözü Geri Al" */}
            {grantedUsers.map(student => (
              <button
                key={student.id}
                onClick={() => onRevokeStudentDraw(student.id)}
                title={`${student.name} adlı öğrenciden sözü geri al`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/80 border border-red-500/60 text-white text-xs font-semibold transition-all"
              >
                <Pen className="w-3 h-3 text-red-400" />
                <span className="max-w-[90px] truncate">{student.name}</span>
                <span className="text-red-400 font-bold">• Sözü Geri Al</span>
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              </button>
            ))}

            {/* Söz İsteyen Öğrenciler (Söz Ver Dropdown) */}
            {handRaisedUsers.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setHandQueueOpen(!handQueueOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-black border border-white text-xs font-bold transition-all shadow-sm"
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>{handRaisedUsers.length} Söz İsteği</span>
                </button>

                {handQueueOpen && (
                  <div
                    className="absolute right-0 top-11 w-64 bg-black border border-zinc-800 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
                      <span className="text-xs font-semibold text-zinc-200">Söz İsteyenler</span>
                      <button
                        onClick={() => setHandQueueOpen(false)}
                        className="text-zinc-500 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {handRaisedUsers.map(student => (
                        <div key={student.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                          <span className="text-xs font-medium text-white truncate">{student.name}</span>
                          <button
                            onClick={() => {
                              onGrantStudentDraw(student.id);
                              if (handRaisedUsers.length <= 1) setHandQueueOpen(false);
                            }}
                            className="px-2.5 py-1 rounded-md bg-white hover:bg-zinc-200 text-black text-[11px] font-bold shrink-0 transition-colors"
                          >
                            Söz Ver
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Participants Dropdown Trigger (Katılımcılar & Söz Ver / Geri Al) */}
            <div className="relative">
              <button
                onClick={() => setUsersDropdownOpen(!usersDropdownOpen)}
                title="Katılımcılar ve Söz Yönetimi"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>{activeUsers.length}</span>
              </button>

              {usersDropdownOpen && (
                <div 
                  className="absolute right-0 top-11 w-72 bg-black border border-zinc-800 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
                    <span className="text-xs font-semibold text-zinc-300">Katılımcılar ({activeUsers.length})</span>
                    <button 
                      onClick={() => setUsersDropdownOpen(false)}
                      className="text-zinc-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                    {activeUsers.map(user => {
                      const hasFloor = grantedStudentIds.includes(user.id);
                      return (
                        <div key={user.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-zinc-900 border border-zinc-800/80 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${hasFloor ? 'bg-red-500' : 'bg-zinc-400'}`} />
                            <span className="font-medium text-zinc-200 truncate">{user.name}</span>
                            {user.role === 'teacher' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium shrink-0">
                                Öğretmen
                              </span>
                            )}
                            {user.handRaised && (
                              <span className="text-zinc-300 text-xs shrink-0" title="Söz hakkı istedi">
                                ✋
                              </span>
                            )}
                          </div>

                          {user.role === 'student' && (
                            hasFloor ? (
                              <button
                                onClick={() => onRevokeStudentDraw(user.id)}
                                className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold shrink-0 transition-colors"
                              >
                                Sözü Geri Al
                              </button>
                            ) : (
                              <button
                                onClick={() => onGrantStudentDraw(user.id)}
                                className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 transition-colors ${
                                  user.handRaised
                                    ? 'bg-white text-black hover:bg-zinc-200'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                                }`}
                              >
                                Söz Ver
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live Chat & Questions Drawer Trigger */}
            <button
              onClick={onToggleChat}
              title="Ders Notları & Soru Paneli"
              className={`relative p-2 rounded-lg transition-colors border ${
                isChatOpen 
                  ? 'bg-white text-black border-white' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white text-black text-[9px] font-bold flex items-center justify-center">
                  {unreadChatCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </header>
  );
};
