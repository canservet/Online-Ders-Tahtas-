import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { 
  ToolType, 
  WhiteboardElement, 
  Point, 
  LaserPointer,
  BoardBackgroundType 
} from '../types/whiteboard.ts';
import { BOARD_BACKGROUNDS } from '../types/whiteboard.ts';
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Hand, Pen, Tablet } from 'lucide-react';
import { drawSmoothStroke, filterAndSmoothPoints } from '../utils/strokeSmoothing.ts';

interface WhiteboardCanvasProps {
  activePage: number;
  currentTool: ToolType;
  strokeColor: string;
  strokeWidth: number;
  isFilled: boolean;
  backgroundType: BoardBackgroundType;
  canDraw: boolean;
  elements: WhiteboardElement[];
  remotePointers: Record<string, LaserPointer>;
  liveRemoteStrokes: Record<string, Partial<WhiteboardElement>>;
  userId: string;
  userName: string;
  userRole: 'teacher' | 'student';
  scrollX?: number;
  scrollY: number;
  onScrollXChange?: (newX: number) => void;
  onScrollYChange: (newY: number) => void;
  onMobileDrawStart?: () => void;
  onAddElement: (element: WhiteboardElement) => void;
  onDeleteElement: (id: string) => void;
  onStrokeStart: (strokeId: string, partial: Partial<WhiteboardElement>) => void;
  onStrokePoint: (strokeId: string, point: Point) => void;
  onStrokeEnd: (element: WhiteboardElement) => void;
  onPointerMove: (x: number, y: number, active: boolean) => void;
  isTabletWritingMode?: boolean;
  onSelectTool?: (tool: ToolType) => void;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  activePage,
  currentTool,
  strokeColor,
  strokeWidth,
  isFilled,
  backgroundType,
  canDraw,
  elements,
  remotePointers,
  liveRemoteStrokes,
  userId,
  userName,
  userRole,
  scrollX = 0,
  scrollY,
  onScrollXChange = () => {},
  onScrollYChange,
  onMobileDrawStart,
  onAddElement,
  onDeleteElement,
  onStrokeStart,
  onStrokePoint,
  onStrokeEnd,
  onPointerMove,
  isTabletWritingMode = false,
  onSelectTool,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  const activePointsRef = useRef<Point[]>([]);
  const startPointRef = useRef<Point | null>(null);

  // Pan / Hand Tool & Tablet Stylus tracking
  const panStartXRef = useRef<number>(0);
  const initialScrollXRef = useRef<number>(0);
  const panStartYRef = useRef<number>(0);
  const initialScrollYRef = useRef<number>(0);
  const isStylusDrawingRef = useRef<boolean>(false);

  // Touch tracking for 2-finger panning / 2D scrolling
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialTouchDistRef = useRef<number | null>(null);

  // Laser trail points for local and remote users
  const laserTrailsRef = useRef<Record<string, { x: number; y: number; time: number; color: string }[]>>({});

  // Active text input modal
  const [activeTextInput, setActiveTextInput] = useState<{ x: number; y: number; text: string } | null>(null);

  // Re-render canvas loop with scrollX and scrollY translation
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const now = Date.now();
    const bgConfig = BOARD_BACKGROUNDS[backgroundType] || BOARD_BACKGROUNDS['chalkboard-black'];

    // Apply scroll offset so drawings exist in an infinite 2D world space
    ctx.save();
    ctx.translate(-scrollX, -scrollY);

    // 1. Draw stored elements for this active page
    const pageElements = elements.filter(e => e.pageId === activePage);
    for (const elem of pageElements) {
      drawElement(ctx, elem, bgConfig.chalkEffect);
    }

    // 2. Draw live in-progress remote strokes
    for (const strokeId in liveRemoteStrokes) {
      const stroke = liveRemoteStrokes[strokeId];
      if (stroke && stroke.pageId === activePage && stroke.points && stroke.points.length > 0) {
        drawStroke(ctx, stroke.points, stroke.color || '#fff', stroke.strokeWidth || 4, stroke.type || 'pen', bgConfig.chalkEffect);
      }
    }

    // 3. Draw active local stroke if drawing
    if (isDrawingRef.current && activePointsRef.current.length > 0) {
      if (['pen', 'chalk', 'highlighter', 'eraser'].includes(currentTool)) {
        drawStroke(ctx, activePointsRef.current, strokeColor, strokeWidth, currentTool, bgConfig.chalkEffect);
      } else if (startPointRef.current && activePointsRef.current.length > 1) {
        const lastPt = activePointsRef.current[activePointsRef.current.length - 1];
        drawShape(ctx, currentTool, startPointRef.current, lastPt, strokeColor, strokeWidth, isFilled);
      }
    }

    // 4. Draw Laser trails
    for (const uid in laserTrailsRef.current) {
      const trail = laserTrailsRef.current[uid];
      if (!trail) continue;

      const recent = trail.filter(p => now - p.time < 1200);
      laserTrailsRef.current[uid] = recent;

      if (recent.length > 1) {
        ctx.save();
        for (let i = 1; i < recent.length; i++) {
          const p1 = recent[i - 1];
          const p2 = recent[i];
          const ageRatio = (now - p2.time) / 1200;
          const alpha = Math.max(0, 1 - ageRatio);
          const size = Math.max(1, 8 * (1 - ageRatio));

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = p2.color || '#ffffff';
          ctx.lineWidth = size;
          ctx.lineCap = 'round';
          ctx.globalAlpha = alpha * 0.75;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 5. Draw Remote laser heads & active pointers
    for (const uid in remotePointers) {
      const ptr = remotePointers[uid];
      if (ptr && ptr.active && ptr.pageId === activePage && now - ptr.lastActive < 4000) {
        if (!laserTrailsRef.current[uid]) laserTrailsRef.current[uid] = [];
        const trail = laserTrailsRef.current[uid];
        const lastP = trail[trail.length - 1];
        if (!lastP || Math.hypot(lastP.x - ptr.x, lastP.y - ptr.y) > 4) {
          trail.push({ x: ptr.x, y: ptr.y, time: now, color: ptr.color || '#ffffff' });
        }

        ctx.save();
        ctx.fillStyle = ptr.color || '#ffffff';
        ctx.beginPath();
        ctx.arc(ptr.x, ptr.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '600 12px Outfit, sans-serif';
        const tagText = `${ptr.userName} ${ptr.userRole === 'teacher' ? '★' : ''}`;
        const tagWidth = ctx.measureText(tagText).width;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.roundRect(ptr.x + 10, ptr.y - 12, tagWidth + 14, 22, 4);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(tagText, ptr.x + 16, ptr.y + 3);
        ctx.restore();
      }
    }

    ctx.restore();
  }, [activePage, backgroundType, currentTool, elements, isFilled, liveRemoteStrokes, remotePointers, strokeColor, strokeWidth, scrollX, scrollY]);

  // Request Animation Frame loop
  useEffect(() => {
    let animId: number;
    const loop = () => {
      renderCanvas();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Resize canvas when container changes
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      renderCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  // Coordinate normalizer taking scrollX and scrollY into account
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) + scrollX,
      y: (e.clientY - rect.top) + scrollY,
      pressure: e.pressure || 0.5,
    };
  };

  // Mouse Wheel scroll to navigate canvas (Shift+wheel or trackpad horizontal for X, standard wheel for Y)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      onScrollXChange(Math.max(0, scrollX + e.deltaY));
    } else {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        onScrollXChange(Math.max(0, scrollX + e.deltaX));
      } else {
        onScrollYChange(Math.max(0, scrollY + e.deltaY));
      }
    }
  };

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Track touches for two-finger pan gesture
    touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // If 2 touches are active on mobile screen, cancel drawing and handle panning
    if (touchPointsRef.current.size >= 2) {
      isDrawingRef.current = false;
      return;
    }

    // Palm Rejection: If user is drawing with a stylus/pen, ignore accidental palm/finger touch
    if (e.pointerType === 'pen') {
      isStylusDrawingRef.current = true;
    } else if (e.pointerType === 'touch' && isStylusDrawingRef.current) {
      return;
    }

    // Pan / Sayfa Kaydırma Aracı (Drawing Tablet Hand Tool)
    if (currentTool === 'pan') {
      isDrawingRef.current = true;
      panStartXRef.current = e.clientX;
      initialScrollXRef.current = scrollX;
      panStartYRef.current = e.clientY;
      initialScrollYRef.current = scrollY;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (!canDraw && currentTool !== 'laser') return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Trigger mobile UI auto-collapse when drawing starts
    onMobileDrawStart?.();

    const coords = getCanvasCoords(e);
    isDrawingRef.current = true;
    startPointRef.current = coords;
    activePointsRef.current = [coords];

    if (currentTool === 'laser') {
      if (!laserTrailsRef.current[userId]) laserTrailsRef.current[userId] = [];
      laserTrailsRef.current[userId].push({ x: coords.x, y: coords.y, time: Date.now(), color: '#ffffff' });
      onPointerMove(coords.x, coords.y, true);
      return;
    }

    if (currentTool === 'text') {
      setActiveTextInput({ x: coords.x, y: coords.y, text: '' });
      isDrawingRef.current = false;
      return;
    }

    if (currentTool === 'sticky') {
      const stickyElement: WhiteboardElement = {
        id: 'elem_' + Math.random().toString(36).substring(2, 9),
        pageId: activePage,
        type: 'sticky',
        x: coords.x,
        y: coords.y,
        width: 190,
        height: 140,
        color: '#ffffff',
        fillColor: '#18181b', // sleek dark card
        strokeWidth: 1,
        text: 'Ders Notu:\nBuraya not ekleyebilirsiniz.',
        fontSize: 14,
        authorId: userId,
        authorName: userName,
        authorRole: userRole,
        createdAt: Date.now(),
      };
      onAddElement(stickyElement);
      isDrawingRef.current = false;
      return;
    }

    if (currentTool === 'axes') {
      const axesElement: WhiteboardElement = {
        id: 'elem_' + Math.random().toString(36).substring(2, 9),
        pageId: activePage,
        type: 'axes',
        x: coords.x,
        y: coords.y,
        width: 260,
        height: 220,
        color: strokeColor,
        strokeWidth: 2,
        authorId: userId,
        authorName: userName,
        authorRole: userRole,
        createdAt: Date.now(),
      };
      onAddElement(axesElement);
      isDrawingRef.current = false;
      return;
    }

    if (currentTool === 'eraser') {
      deleteElementsAtPoint(coords.x, coords.y);
      return;
    }

    const strokeId = 'elem_' + Math.random().toString(36).substring(2, 9);
    currentStrokeIdRef.current = strokeId;

    if (['pen', 'chalk', 'highlighter'].includes(currentTool)) {
      onStrokeStart(strokeId, {
        id: strokeId,
        pageId: activePage,
        type: currentTool,
        points: [coords],
        color: strokeColor,
        strokeWidth,
        authorId: userId,
        authorName: userName,
        authorRole: userRole,
        createdAt: Date.now(),
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Check if 2-finger touch panning is happening
    if (touchPointsRef.current.size >= 2) {
      const prevTouch = touchPointsRef.current.get(e.pointerId);
      if (prevTouch) {
        const deltaX = prevTouch.x - e.clientX;
        const deltaY = prevTouch.y - e.clientY;
        onScrollXChange(Math.max(0, scrollX + deltaX * 1.2));
        onScrollYChange(Math.max(0, scrollY + deltaY * 1.2));
        touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      return;
    }

    const coords = getCanvasCoords(e);

    // Pan / Sayfa Kaydırma Hareketi
    if (currentTool === 'pan') {
      if (isDrawingRef.current) {
        const deltaX = panStartXRef.current - e.clientX;
        const deltaY = panStartYRef.current - e.clientY;
        onScrollXChange(Math.max(0, initialScrollXRef.current + deltaX));
        onScrollYChange(Math.max(0, initialScrollYRef.current + deltaY));
      }
      return;
    }

    if (currentTool === 'laser' || e.buttons === 1) {
      if (currentTool === 'laser') {
        if (!laserTrailsRef.current[userId]) laserTrailsRef.current[userId] = [];
        laserTrailsRef.current[userId].push({ x: coords.x, y: coords.y, time: Date.now(), color: '#ffffff' });
        onPointerMove(coords.x, coords.y, true);
      }
    }

    if (!isDrawingRef.current) return;

    if (currentTool === 'eraser') {
      deleteElementsAtPoint(coords.x, coords.y);
      return;
    }

    // Auto-advance infinite scroll when pen approaches edges of viewport
    const container = containerRef.current;
    if (container) {
      const viewportX = e.clientX - container.getBoundingClientRect().left;
      const viewportY = e.clientY - container.getBoundingClientRect().top;
      const viewportWidth = container.clientWidth;
      const viewportHeight = container.clientHeight;
      if (viewportY > viewportHeight - 45) {
        onScrollYChange(scrollY + 15);
      }
      if (viewportX > viewportWidth - 45) {
        onScrollXChange(scrollX + 15);
      }
    }

    // Skip tiny micro-jitter movements (< 1.8px) while drawing to maintain clean curves
    if (activePointsRef.current.length > 0) {
      const lastPt = activePointsRef.current[activePointsRef.current.length - 1];
      if (Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y) < 1.8) {
        return;
      }
    }

    activePointsRef.current.push(coords);

    if (['pen', 'chalk', 'highlighter'].includes(currentTool) && currentStrokeIdRef.current) {
      onStrokePoint(currentStrokeIdRef.current, coords);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touchPointsRef.current.delete(e.pointerId);

    if (e.pointerType === 'pen') {
      isStylusDrawingRef.current = false;
    }

    if (currentTool === 'pan') {
      isDrawingRef.current = false;
      return;
    }

    if (!isDrawingRef.current && currentTool !== 'laser') return;
    isDrawingRef.current = false;

    if (currentTool === 'laser') {
      onPointerMove(0, 0, false);
      return;
    }

    const strokeId = currentStrokeIdRef.current || ('elem_' + Math.random().toString(36).substring(2, 9));
    const points = activePointsRef.current;
    const startPt = startPointRef.current;

    if (['pen', 'chalk', 'highlighter'].includes(currentTool)) {
      if (points.length > 0) {
        // Filter and smooth points for pristine Catmull-Rom interpolation
        const smoothedPoints = filterAndSmoothPoints(points, 2.0);
        const strokeElem: WhiteboardElement = {
          id: strokeId,
          pageId: activePage,
          type: currentTool,
          points: smoothedPoints,
          color: strokeColor,
          strokeWidth,
          authorId: userId,
          authorName: userName,
          authorRole: userRole,
          createdAt: Date.now(),
        };
        onStrokeEnd(strokeElem);
      }
    } else if (startPt && points.length > 1 && ['line', 'arrow', 'rect', 'circle', 'triangle'].includes(currentTool)) {
      const endPt = points[points.length - 1];
      const shapeElem: WhiteboardElement = {
        id: strokeId,
        pageId: activePage,
        type: currentTool,
        x: Math.min(startPt.x, endPt.x),
        y: Math.min(startPt.y, endPt.y),
        width: Math.abs(endPt.x - startPt.x),
        height: Math.abs(endPt.y - startPt.y),
        points: [startPt, endPt],
        color: strokeColor,
        strokeWidth,
        isFilled,
        fillColor: isFilled ? strokeColor + '20' : undefined,
        authorId: userId,
        authorName: userName,
        authorRole: userRole,
        createdAt: Date.now(),
      };
      onAddElement(shapeElem);
    }

    currentStrokeIdRef.current = null;
    activePointsRef.current = [];
    startPointRef.current = null;
  };

  // Eraser intersection detection in world coordinates
  const deleteElementsAtPoint = (x: number, y: number) => {
    const eraserRadius = 24;
    const pageElems = elements.filter(e => e.pageId === activePage);

    for (const elem of pageElems) {
      if (elem.points && elem.points.length > 0) {
        for (const pt of elem.points) {
          if (Math.hypot(pt.x - x, pt.y - y) <= eraserRadius) {
            onDeleteElement(elem.id);
            return;
          }
        }
      } else if (elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        if (
          x >= elem.x - eraserRadius &&
          x <= elem.x + elem.width + eraserRadius &&
          y >= elem.y - eraserRadius &&
          y <= elem.y + elem.height + eraserRadius
        ) {
          onDeleteElement(elem.id);
          return;
        }
      }
    }
  };

  return (
    <div 
      ref={containerRef} 
      onWheel={handleWheel}
      className="relative w-full h-full overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full block touch-none ${
          currentTool === 'laser' 
            ? 'cursor-crosshair' 
            : currentTool === 'pan'
              ? isDrawingRef.current ? 'cursor-grabbing' : 'cursor-grab'
              : currentTool === 'eraser' 
                ? 'cursor-cell' 
                : currentTool === 'text' 
                  ? 'cursor-text' 
                  : 'cursor-crosshair'
        }`}
      />

      {/* Minimal 4-Way Directional Navigation Pad (Öğrenci ve Öğretmen için Ekrandan Gezinme) */}
      <div className="absolute left-3 sm:left-5 bottom-20 z-30 flex flex-col items-start gap-1 pointer-events-auto select-none">
        <div className="bg-black/90 backdrop-blur-md border border-zinc-800/90 rounded-2xl p-1.5 sm:p-2 shadow-2xl flex flex-col items-center">
          {/* Yukarı (Up) */}
          <button
            onClick={() => onScrollYChange(Math.max(0, scrollY - 250))}
            title="Yukarı Kaydır (-250px)"
            disabled={scrollY <= 0}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-white hover:text-black disabled:opacity-25 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-300 transition-all active:scale-90"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {/* Sola (Left), Merkez (0,0), Sağa (Right) */}
          <div className="flex items-center gap-1 my-1">
            <button
              onClick={() => onScrollXChange(Math.max(0, scrollX - 250))}
              title="Sola Kaydır (-250px)"
              disabled={scrollX <= 0}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-white hover:text-black disabled:opacity-25 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-300 transition-all active:scale-90"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                onScrollXChange(0);
                onScrollYChange(0);
              }}
              title="Başlangıç Noktasına Dön (X:0, Y:0)"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold transition-all active:scale-90 border ${
                scrollX === 0 && scrollY === 0
                  ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                  : 'bg-white text-black hover:bg-zinc-200 border-white shadow-md'
              }`}
            >
              0,0
            </button>

            <button
              onClick={() => onScrollXChange(scrollX + 250)}
              title="Sağa Kaydır (+250px)"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-white hover:text-black transition-all active:scale-90"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Aşağı (Down) */}
          <button
            onClick={() => onScrollYChange(scrollY + 250)}
            title="Aşağı Kaydır (+250px)"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-white hover:text-black transition-all active:scale-90"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Minimal Koordinat Göstergesi */}
          {(scrollX > 0 || scrollY > 0) && (
            <div className="mt-1 text-[9px] font-mono text-zinc-400 text-center tracking-tighter">
              {Math.round(scrollX)},{Math.round(scrollY)}
            </div>
          )}
        </div>
      </div>

      {/* Floating Vertical Infinite Page & Tablet Mode Controls */}
      <div className="absolute right-3 sm:right-5 bottom-20 z-30 flex flex-col items-end gap-2 pointer-events-auto select-none">
        {/* Tablet Writing Mode Floating Control Bar */}
        {isTabletWritingMode && (
          <div className="bg-black/90 backdrop-blur-md border border-zinc-700/80 rounded-2xl p-2.5 shadow-2xl flex flex-col items-center gap-2 mb-1 animate-in fade-in slide-in-from-right-3 duration-200">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white text-black text-[10px] font-bold tracking-wider uppercase">
              <Tablet className="w-3 h-3" />
              <span>Yazı Tahtası</span>
            </div>

            {/* Quick Switch: Pen vs Pan (Hand) */}
            {onSelectTool && (
              <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 w-full">
                <button
                  onClick={() => onSelectTool('pen')}
                  title="Yazma Modu (Kalem)"
                  className={`flex-1 py-1 px-2 rounded-md flex items-center justify-center gap-1 text-[11px] font-semibold transition-all ${
                    currentTool === 'pen' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Pen className="w-3 h-3" />
                  <span>Yaz</span>
                </button>
                <button
                  onClick={() => onSelectTool('pan')}
                  title="Kaydırma Modu (Sayfayı Yukarı/Aşağı/Sağa/Sola Kaydır)"
                  className={`flex-1 py-1 px-2 rounded-md flex items-center justify-center gap-1 text-[11px] font-semibold transition-all ${
                    currentTool === 'pan' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Hand className="w-3 h-3" />
                  <span>Kaydır</span>
                </button>
              </div>
            )}

            {/* Tablet Quick Scroll 4-Way Buttons */}
            <div className="flex flex-col items-center gap-1 w-full">
              <button
                onClick={() => onScrollYChange(Math.max(0, scrollY - 250))}
                title="Sayfayı Yukarı Kaydır (-250px)"
                disabled={scrollY <= 0}
                className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-white text-[11px] font-semibold transition-all"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Yukarı</span>
              </button>
              <div className="flex items-center gap-1 w-full">
                <button
                  onClick={() => onScrollXChange(Math.max(0, scrollX - 250))}
                  title="Sola Kaydır (-250px)"
                  disabled={scrollX <= 0}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-white text-[11px] font-semibold transition-all"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Sol</span>
                </button>
                <button
                  onClick={() => onScrollXChange(scrollX + 250)}
                  title="Sağa Kaydır (+250px)"
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold transition-all"
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>Sağ</span>
                </button>
              </div>
              <button
                onClick={() => onScrollYChange(scrollY + 250)}
                title="Sayfayı Aşağı Kaydır (+250px)"
                className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold transition-all"
              >
                <ArrowDown className="w-3 h-3" />
                <span>Aşağı</span>
              </button>
            </div>
          </div>
        )}

        {/* Standard Infinite Scroll Controls */}
        <div className="flex items-center gap-1.5">
          {scrollY > 100 && (
            <button
              onClick={() => onScrollYChange(0)}
              title="Tahtanın Başına Dön (0px)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/85 hover:bg-black border border-zinc-700 text-white text-[11px] font-medium shadow-lg backdrop-blur-md transition-all active:scale-95"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>En Üst</span>
            </button>
          )}

          {/* Depth Indicator / Expand Downward button */}
          <button
            onClick={() => onScrollYChange(scrollY + 350)}
            title="Aşağı Doğru Genişlet (+350px)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/85 hover:bg-black border border-zinc-700 text-white text-xs font-semibold shadow-lg backdrop-blur-md transition-all active:scale-95"
          >
            <ArrowDown className="w-3.5 h-3.5 text-zinc-400" />
            <span>Aşağı Genişlet ({Math.round(scrollY)}px)</span>
          </button>
        </div>
      </div>

      {/* Inline Text Input Modal */}
      {activeTextInput && (
        <div 
          className="absolute z-40 bg-black/95 border border-zinc-800 p-3 rounded-xl shadow-2xl flex flex-col gap-2 min-w-[280px]"
          style={{ 
            left: Math.min(activeTextInput.x, window.innerWidth - 300), 
            top: Math.min(activeTextInput.y - scrollY, window.innerHeight - 180) 
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Metin Ekle</span>
            <button 
              onClick={() => setActiveTextInput(null)} 
              className="text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>
          <textarea
            autoFocus
            rows={3}
            placeholder="Ders notu veya başlık yazın..."
            value={activeTextInput.text}
            onChange={(e) => setActiveTextInput({ ...activeTextInput, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                if (activeTextInput.text.trim()) {
                  onAddElement({
                    id: 'elem_' + Math.random().toString(36).substring(2, 9),
                    pageId: activePage,
                    type: 'text',
                    x: activeTextInput.x,
                    y: activeTextInput.y,
                    color: strokeColor,
                    strokeWidth: 2,
                    text: activeTextInput.text.trim(),
                    fontSize: 22,
                    authorId: userId,
                    authorName: userName,
                    authorRole: userRole,
                    createdAt: Date.now(),
                  });
                }
                setActiveTextInput(null);
              }
            }}
            className="w-full bg-zinc-900 text-white p-2.5 rounded-lg border border-zinc-800 text-sm focus:outline-none focus:border-white font-sans resize-none"
          />
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Ctrl + Enter ile ekle</span>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTextInput(null)}
                className="px-2.5 py-1 text-zinc-400 hover:text-white"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  if (activeTextInput.text.trim()) {
                    onAddElement({
                      id: 'elem_' + Math.random().toString(36).substring(2, 9),
                      pageId: activePage,
                      type: 'text',
                      x: activeTextInput.x,
                      y: activeTextInput.y,
                      color: strokeColor,
                      strokeWidth: 2,
                      text: activeTextInput.text.trim(),
                      fontSize: 22,
                      authorId: userId,
                      authorName: userName,
                      authorRole: userRole,
                      createdAt: Date.now(),
                    });
                  }
                  setActiveTextInput(null);
                }}
                className="px-3 py-1 bg-white text-black hover:bg-zinc-200 rounded font-semibold"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Canvas Drawing Helper Functions
function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  width: number,
  tool: ToolType,
  chalkEffect: boolean
) {
  drawSmoothStroke(ctx, points, color, width, tool, chalkEffect);
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  tool: ToolType,
  p1: Point,
  p2: Point,
  color: string,
  width: number,
  isFilled: boolean
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (isFilled) {
    ctx.fillStyle = color + '20';
  }

  if (tool === 'line') {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  } else if (tool === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const headLen = Math.max(14, width * 3.5);

    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(
      p2.x - headLen * Math.cos(angle - Math.PI / 6),
      p2.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      p2.x - headLen * Math.cos(angle + Math.PI / 6),
      p2.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  } else if (tool === 'rect') {
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    if (isFilled) ctx.fill();
    ctx.stroke();
  } else if (tool === 'circle') {
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (isFilled) ctx.fill();
    ctx.stroke();
  } else if (tool === 'triangle') {
    const x1 = Math.min(p1.x, p2.x) + Math.abs(p2.x - p1.x) / 2;
    const y1 = Math.min(p1.y, p2.y);
    const x2 = Math.min(p1.x, p2.x);
    const y2 = Math.max(p1.y, p2.y);
    const x3 = Math.max(p1.x, p2.x);
    const y3 = Math.max(p1.y, p2.y);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    if (isFilled) ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  elem: WhiteboardElement,
  chalkEffect: boolean
) {
  if (['pen', 'chalk', 'highlighter'].includes(elem.type) && elem.points) {
    drawStroke(ctx, elem.points, elem.color, elem.strokeWidth, elem.type, chalkEffect);
    return;
  }

  if (['line', 'arrow', 'rect', 'circle', 'triangle'].includes(elem.type) && elem.points && elem.points.length >= 2) {
    drawShape(ctx, elem.type, elem.points[0], elem.points[1], elem.color, elem.strokeWidth, !!elem.isFilled);
    return;
  }

  if (elem.type === 'axes' && elem.x !== undefined && elem.y !== undefined) {
    ctx.save();
    ctx.strokeStyle = elem.color;
    ctx.lineWidth = elem.strokeWidth || 2;
    ctx.fillStyle = elem.color;
    ctx.font = '600 13px JetBrains Mono, monospace';

    const w = elem.width || 260;
    const h = elem.height || 220;
    const originX = elem.x + w / 2;
    const originY = elem.y + h / 2;

    ctx.beginPath();
    ctx.moveTo(elem.x, originY);
    ctx.lineTo(elem.x + w, originY);
    ctx.moveTo(originX, elem.y + h);
    ctx.lineTo(originX, elem.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(elem.x + w, originY);
    ctx.lineTo(elem.x + w - 10, originY - 5);
    ctx.lineTo(elem.x + w - 10, originY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(originX, elem.y);
    ctx.lineTo(originX - 5, elem.y + 10);
    ctx.lineTo(originX + 5, elem.y + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillText('x', elem.x + w - 4, originY + 16);
    ctx.fillText('y', originX + 8, elem.y + 12);
    ctx.fillText('0', originX - 12, originY + 14);

    ctx.restore();
    return;
  }

  if (elem.type === 'text' && elem.x !== undefined && elem.y !== undefined && elem.text) {
    ctx.save();
    ctx.fillStyle = elem.color;
    ctx.font = `600 ${elem.fontSize || 22}px Outfit, sans-serif`;
    const lines = elem.text.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, elem.x!, elem.y! + (i * ((elem.fontSize || 22) + 6)));
    });
    ctx.restore();
    return;
  }

  if (elem.type === 'sticky' && elem.x !== undefined && elem.y !== undefined) {
    ctx.save();
    const w = elem.width || 190;
    const h = elem.height || 140;

    ctx.fillStyle = elem.fillColor || '#18181b';
    ctx.beginPath();
    ctx.roundRect(elem.x, elem.y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 11px Outfit, sans-serif';
    ctx.fillText(`📌 ${elem.authorName || 'Not'}`, elem.x + 10, elem.y + 18);

    ctx.fillStyle = elem.color || '#ffffff';
    ctx.font = '500 13px Outfit, sans-serif';
    const lines = (elem.text || '').split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, elem.x! + 12, elem.y! + 44 + (i * 18));
    });

    ctx.restore();
    return;
  }
}
