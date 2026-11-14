/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWhiteboardSocket } from './hooks/useWhiteboardSocket.ts';
import { BoardBackgroundLayer } from './components/BoardBackgroundLayer.tsx';
import { WhiteboardCanvas } from './components/WhiteboardCanvas.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { HeaderBar } from './components/HeaderBar.tsx';
import { BackgroundSelectorModal } from './components/BackgroundSelectorModal.tsx';
import { ChatAndQuestions } from './components/ChatAndQuestions.tsx';
import { PageManagerDrawer } from './components/PageManagerDrawer.tsx';
import { PdfExportModal } from './components/PdfExportModal.tsx';
import type { ToolType, BoardBackgroundType, WhiteboardElement } from './types/whiteboard.ts';
import { 
  Users, 
  Sparkles, 
  Eye, 
  GraduationCap, 
  Play, 
  Info, 
  Share2, 
  Hand,
  CheckCircle2,
  Lock
} from 'lucide-react';

export default function App() {
  // Read initial query params
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const initialRoom = (searchParams.get('room') || 'DERS-101').toUpperCase().trim();
  const initialRole = searchParams.get('role') === 'student' ? 'student' : 'teacher';

  const [roomId, setRoomId] = useState(initialRoom);
  const [userRole, setUserRole] = useState<'teacher' | 'student'>(initialRole);
  const [userName, setUserName] = useState<string>(() => {
    return initialRole === 'teacher' ? 'Ahmet Hoca (Öğretmen)' : 'Öğrenci Can';
  });

  // Split view to test Teacher + Student side-by-side
  const [isSplitView, setIsSplitView] = useState(false);

  // Tools state for local user
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isFilled, setIsFilled] = useState(false);

  // Modals & Drawers
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isPageManagerOpen, setIsPageManagerOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Infinite 2D Canvas Scroll and Mobile UI Auto-Collapse
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [isUiCollapsed, setIsUiCollapsed] = useState(false);
  const [isTabletWritingMode, setIsTabletWritingMode] = useState(false);

  // Main socket hook for primary window/user
  const {
    userId,
    userColor,
    connectionStatus,
    roomState,
    remotePointers,
    liveRemoteStrokes,
    toastNotification,
    remoteScroll,
    sendScroll,
    sendStrokeStart,
    sendStrokePoint,
    sendStrokeEnd,
    addElement,
    updateElement,
    deleteElement,
    clearBoard,
    setBackground,
    setPage,
    addPage,
    deletePage,
    duplicatePage,
    sendPointerMove,
    toggleStudentDraw,
    grantStudentDraw,
    revokeStudentDraw,
    raiseHand,
    sendChatMessage,
    markQuestionAnswered,
    undo,
    redo,
  } = useWhiteboardSocket({
    roomId,
    userName,
    userRole,
  });

  // When teacher scrolls or expands in 2D, broadcast to all students
  const handleScrollXChange = useCallback((newX: number) => {
    const clampedX = Math.max(0, newX);
    setScrollX(clampedX);
    if (userRole === 'teacher') {
      sendScroll(clampedX, scrollY);
    }
  }, [userRole, scrollY, sendScroll]);

  const handleScrollYChange = useCallback((newY: number) => {
    const clampedY = Math.max(0, newY);
    setScrollY(clampedY);
    if (userRole === 'teacher') {
      sendScroll(scrollX, clampedY);
    }
  }, [userRole, scrollX, sendScroll]);

  // Synchronize student's screen viewport with teacher's view in real-time
  useEffect(() => {
    if (userRole === 'student') {
      setScrollX(remoteScroll.x);
      setScrollY(remoteScroll.y);
    }
  }, [remoteScroll, userRole]);

  // Reset scroll offset when switching pages
  useEffect(() => {
    setScrollX(0);
    setScrollY(0);
    if (userRole === 'teacher') {
      sendScroll(0, 0);
    }
  }, [roomState.activePage, userRole, sendScroll]);

  // Adjust default stroke color when background changes (pure black on white backgrounds, pure white on black backgrounds)
  useEffect(() => {
    if (['whiteboard-clean', 'grid-white', 'lined-white', 'dots-white', 'notebook-grid', 'notebook-lined', 'isometric'].includes(roomState.background)) {
      if (strokeColor === '#ffffff') {
        setStrokeColor('#000000');
      }
    } else {
      if (strokeColor === '#000000' || strokeColor === '#1e293b') {
        setStrokeColor('#ffffff');
      }
    }
  }, [roomState.background]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'p' || e.key === 'P') {
        setCurrentTool('pen');
      } else if (e.key === 'l' || e.key === 'L') {
        setCurrentTool('laser');
      } else if (e.key === 'e' || e.key === 'E') {
        setCurrentTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Student hand raising handler
  const handleToggleHand = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    raiseHand(nextState);
  };


  // Export board as PNG image
  const handleExportBoard = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Create a temporary composited canvas with the background color
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = roomState.background === 'whiteboard-clean' ? '#f8fafc' : '#1a382b';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Canli_Ders_Tahtasi_Sayfa_${roomState.activePage}.png`;
    link.href = dataUrl;
    link.click();
  };

  const grantedStudentIds = roomState.grantedStudentIds || [];
  const studentHasFloor = userRole === 'student' && (roomState.studentsCanDraw || grantedStudentIds.includes(userId));
  const canDraw = userRole === 'teacher' || studentHasFloor;

  // When teacher grants or revokes student's floor, sync student's hand-raise and default pen
  useEffect(() => {
    if (userRole === 'student') {
      if (studentHasFloor) {
        setIsHandRaised(false);
        setCurrentTool('pen');
      } else {
        setIsHandRaised(false);
        setIsUiCollapsed(false);
      }
    }
  }, [studentHasFloor, userRole]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-sans select-none text-white">
      {/* Top Header Navigation */}
      <HeaderBar
        roomId={roomId}
        roomTitle={roomState.roomTitle}
        connectionStatus={connectionStatus}
        userRole={userRole}
        userName={userName}
        activeUsers={roomState.activeUsers}
        studentsCanDraw={roomState.studentsCanDraw}
        grantedStudentIds={grantedStudentIds}
        studentHasFloor={studentHasFloor}
        onToggleStudentsDraw={toggleStudentDraw}
        onGrantStudentDraw={grantStudentDraw}
        onRevokeStudentDraw={revokeStudentDraw}
        isHandRaised={isHandRaised}
        onToggleHand={handleToggleHand}
        unreadChatCount={roomState.chatMessages.filter(m => m.senderId !== userId).length}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
        isSplitView={isSplitView}
        onToggleSplitView={() => setIsSplitView(!isSplitView)}
        backgroundType={roomState.background}
        onOpenBackgroundModal={() => setIsBackgroundModalOpen(true)}
        activePage={roomState.activePage}
        totalPages={roomState.totalPages}
        onOpenPageManager={() => setIsPageManagerOpen(true)}
        onOpenPdfModal={() => setIsPdfModalOpen(true)}
        isUiCollapsed={isUiCollapsed}
        isTabletWritingMode={isTabletWritingMode}
        onToggleTabletWritingMode={() => setIsTabletWritingMode(prev => !prev)}
      />

      {/* Main View Area (Single View or Split Teacher/Student View) */}
      <div className={`w-full h-full flex transition-all duration-300 ${isUiCollapsed ? 'pt-0' : 'pt-14'}`}>
        {/* Left / Primary Canvas (Teacher or Standard User) */}
        <div className={`relative h-full transition-all duration-300 ${isSplitView ? 'w-1/2 border-r border-zinc-800' : 'w-full'}`}>
          {isSplitView && (
            <div className="absolute top-2 left-4 z-20 px-3 py-1 rounded-md bg-white text-black text-xs font-semibold tracking-wide shadow-md flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Öğretmen Ekranı (Çizim)</span>
            </div>
          )}

          {/* Board Background Layer with infinite 2D scroll alignment */}
          <BoardBackgroundLayer backgroundType={roomState.background} scrollX={scrollX} scrollY={scrollY} />

          {/* Whiteboard Interactive Infinite Canvas */}
          <WhiteboardCanvas
            activePage={roomState.activePage}
            currentTool={currentTool}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            isFilled={isFilled}
            backgroundType={roomState.background}
            canDraw={canDraw}
            elements={roomState.elements}
            remotePointers={remotePointers}
            liveRemoteStrokes={liveRemoteStrokes}
            userId={userId}
            userName={userName}
            userRole={userRole}
            scrollX={scrollX}
            scrollY={scrollY}
            onScrollXChange={handleScrollXChange}
            onScrollYChange={handleScrollYChange}
            onMobileDrawStart={() => {
              if (window.innerWidth < 768 && userRole === 'teacher') {
                setIsUiCollapsed(true);
              }
            }}
            onAddElement={addElement}
            onDeleteElement={deleteElement}
            onStrokeStart={sendStrokeStart}
            onStrokePoint={sendStrokePoint}
            onStrokeEnd={sendStrokeEnd}
            onPointerMove={sendPointerMove}
            isTabletWritingMode={isTabletWritingMode}
            onSelectTool={setCurrentTool}
          />
        </div>

        {/* Right Panel: Student Live Mirror View when Split View is enabled */}
        {isSplitView && (
          <div className="relative w-1/2 h-full bg-black overflow-hidden">
            <div className="absolute top-2 left-4 z-20 px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-white text-xs font-semibold tracking-wide shadow-md flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-zinc-400" />
              <span>Öğrenci Canlı İzleme (Canlı Akış)</span>
            </div>

            <div className="absolute top-2 right-4 z-20 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Gecikme: &lt;15ms</span>
            </div>

            {/* Same synced background */}
            <BoardBackgroundLayer backgroundType={roomState.background} scrollX={scrollX} scrollY={scrollY} />

            {/* Synced read-only viewer for student */}
            <WhiteboardCanvas
              activePage={roomState.activePage}
              currentTool="laser"
              strokeColor="#ffffff"
              strokeWidth={4}
              isFilled={false}
              backgroundType={roomState.background}
              canDraw={roomState.studentsCanDraw}
              elements={roomState.elements}
              remotePointers={remotePointers}
              liveRemoteStrokes={liveRemoteStrokes}
              userId="student_preview_id"
              userName="Öğrenci (Önizleme)"
              userRole="student"
              scrollX={scrollX}
              scrollY={scrollY}
              onScrollXChange={handleScrollXChange}
              onScrollYChange={handleScrollYChange}
              onAddElement={() => {}}
              onDeleteElement={() => {}}
              onStrokeStart={() => {}}
              onStrokePoint={() => {}}
              onStrokeEnd={() => {}}
              onPointerMove={() => {}}
              isTabletWritingMode={false}
            />
          </div>
        )}
      </div>

      {/* Floating Bottom Toolbar */}
      <Toolbar
        currentTool={currentTool}
        onSelectTool={setCurrentTool}
        strokeColor={strokeColor}
        onSelectColor={setStrokeColor}
        strokeWidth={strokeWidth}
        onSelectStrokeWidth={setStrokeWidth}
        isFilled={isFilled}
        onToggleFilled={() => setIsFilled(!isFilled)}
        canDraw={canDraw}
        isTeacher={userRole === 'teacher'}
        activePage={roomState.activePage}
        totalPages={roomState.totalPages}
        onSetPage={(page) => setPage(page)}
        onAddPage={addPage}
        onUndo={undo}
        onRedo={redo}
        onClearPage={() => clearBoard(roomState.activePage)}
        currentBackground={roomState.background}
        onOpenPageManager={() => setIsPageManagerOpen(true)}
        isUiCollapsed={isUiCollapsed}
        onToggleUiCollapse={() => setIsUiCollapsed(prev => !prev)}
        isTabletWritingMode={isTabletWritingMode}
        onToggleTabletWritingMode={() => setIsTabletWritingMode(prev => !prev)}
      />

      {/* Sayfalar ve Slaytlar Paneli Drawer */}
      <PageManagerDrawer
        isOpen={isPageManagerOpen}
        onClose={() => setIsPageManagerOpen(false)}
        activePage={roomState.activePage}
        totalPages={roomState.totalPages}
        onSelectPage={(pageNum) => setPage(pageNum)}
        onAddPage={addPage}
        onDeletePage={(pageNum) => deletePage(pageNum)}
        onDuplicatePage={(pageNum) => duplicatePage(pageNum)}
        onClearPage={(pageNum) => clearBoard(pageNum)}
        elements={roomState.elements}
        backgroundType={roomState.background}
        isTeacher={userRole === 'teacher'}
        onOpenPdfModal={() => setIsPdfModalOpen(true)}
      />

      {/* PDF Al / Çok Sayfalı PDF İndirme Modalı */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        elements={roomState.elements}
        backgroundType={roomState.background}
        totalPages={roomState.totalPages}
        activePage={roomState.activePage}
        roomTitle={roomState.roomTitle}
        roomCode={roomId}
        teacherName={userName}
      />

      {/* Background Selector Modal ("Arka Planı Yap") */}
      <BackgroundSelectorModal
        isOpen={isBackgroundModalOpen}
        onClose={() => setIsBackgroundModalOpen(false)}
        currentBackground={roomState.background}
        onSelectBackground={(bg) => setBackground(bg)}
        isTeacher={userRole === 'teacher'}
      />

      {/* Live Chat & Student Q&A Drawer */}
      <ChatAndQuestions
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={roomState.chatMessages}
        onSendMessage={sendChatMessage}
        onMarkAnswered={markQuestionAnswered}
        currentUserId={userId}
        isTeacher={userRole === 'teacher'}
      />
    </div>
  );
}
