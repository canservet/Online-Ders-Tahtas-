import { jsPDF } from 'jspdf';
import type { WhiteboardElement, BoardBackgroundType, Point, ToolType } from '../types/whiteboard.ts';
import { BOARD_BACKGROUNDS } from '../types/whiteboard.ts';
import { drawSmoothStroke } from './strokeSmoothing.ts';

interface ExportPdfOptions {
  elements: WhiteboardElement[];
  backgroundType: BoardBackgroundType;
  totalPages: number;
  activePage: number;
  lessonTitle: string;
  teacherName: string;
  roomCode: string;
  exportMode: 'all' | 'current';
  onProgress?: (current: number, total: number, statusText: string) => void;
}

export async function exportWhiteboardToPdf({
  elements,
  backgroundType,
  totalPages,
  activePage,
  lessonTitle,
  teacherName,
  roomCode,
  exportMode,
  onProgress,
}: ExportPdfOptions): Promise<void> {
  const pagesToExport = exportMode === 'current' 
    ? [activePage] 
    : Array.from({ length: totalPages }, (_, i) => i + 1);

  const total = pagesToExport.length;

  // Initialize jsPDF in landscape A4 format
  // A4 Landscape: 297mm width x 210mm height
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidthMm = 297;
  const pageHeightMm = 210;

  // Virtual Canvas resolution for rendering pages
  const canvasWidth = 1920;
  const canvasHeight = 1080;

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = canvasWidth;
  offscreenCanvas.height = canvasHeight;
  const ctx = offscreenCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas render context could not be created');
  }

  const bgConfig = BOARD_BACKGROUNDS[backgroundType];

  let pdfPageCount = 0;

  for (let idx = 0; idx < pagesToExport.length; idx++) {
    const pageNum = pagesToExport[idx];
    const pageElements = elements.filter(e => e.pageId === pageNum);

    // Calculate maximum vertical extent of elements on this page for infinite canvas
    let maxElementY = canvasHeight;
    for (const elem of pageElements) {
      if (elem.points && elem.points.length > 0) {
        for (const p of elem.points) {
          if (p.y > maxElementY) maxElementY = p.y;
        }
      }
      if (elem.y !== undefined) {
        const bottom = elem.y + (elem.height || 100);
        if (bottom > maxElementY) maxElementY = bottom;
      }
    }

    const verticalSlices = Math.max(1, Math.ceil(maxElementY / canvasHeight));

    for (let s = 0; s < verticalSlices; s++) {
      const sliceLabel = verticalSlices > 1 ? ` (Bölüm ${s + 1}/${verticalSlices})` : '';
      onProgress?.(idx + 1, total, `Sayfa ${pageNum}${sliceLabel} işleniyor...`);

      // Add new page to PDF after the first page
      if (pdfPageCount > 0) {
        pdf.addPage('a4', 'landscape');
      }
      pdfPageCount++;

      // 1. Clear offscreen canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // 2. Draw Background with vertical offset alignment
      renderBackgroundToCanvas(ctx, bgConfig, canvasWidth, canvasHeight);

      // 3. Draw Elements for this page slice
      ctx.save();
      ctx.translate(0, -(s * canvasHeight));
      for (const elem of pageElements) {
        renderElementToCanvas(ctx, elem, bgConfig.chalkEffect);
      }
      ctx.restore();

      // 4. Draw Header/Footer watermark on the canvas board
      ctx.save();
      ctx.fillStyle = bgConfig.textColor;
      ctx.globalAlpha = 0.45;
      ctx.font = '600 20px Outfit, sans-serif';
      ctx.fillText(`${lessonTitle || 'Ders Notu'} • Oda: ${roomCode}`, 40, canvasHeight - 35);
      ctx.font = '500 18px Outfit, sans-serif';
      ctx.fillText(`Sayfa ${pageNum}${sliceLabel} / ${totalPages}`, canvasWidth - 220, canvasHeight - 35);
      ctx.restore();

      // 5. Convert to High-Quality Image
      const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.95);

      // 6. Draw image onto PDF (full-bleed landscape)
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidthMm, pageHeightMm);

      // Allow browser tick to update UI
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  onProgress?.(total, total, 'PDF dosyası kaydediliyor...');

  // Generate safe filename
  const cleanTitle = (lessonTitle || 'Ders_Notu').replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${roomCode}_${cleanTitle}_${dateStr}.pdf`;

  pdf.save(fileName);
}

// Background Renderer for Canvas
function renderBackgroundToCanvas(
  ctx: CanvasRenderingContext2D,
  bgConfig: typeof BOARD_BACKGROUNDS[BoardBackgroundType],
  width: number,
  height: number
) {
  ctx.save();
  ctx.fillStyle = bgConfig.bgColor;
  ctx.fillRect(0, 0, width, height);

  // Draw Grid or Lines
  if (bgConfig.pattern === 'grid') {
    const size = bgConfig.gridSize || 32;
    ctx.strokeStyle = bgConfig.lineColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = 0; x <= width; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Major grid lines (every 5 squares)
    ctx.strokeStyle = bgConfig.lineColor;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let x = 0; x <= width; x += size * 5) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += size * 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (bgConfig.pattern === 'lined') {
    const size = bgConfig.gridSize || 36;
    ctx.strokeStyle = bgConfig.lineColor;
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    for (let y = size; y <= height; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Red Left margin guideline
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(110, 0);
    ctx.lineTo(110, height);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (bgConfig.pattern === 'dots') {
    const size = bgConfig.gridSize || 32;
    ctx.fillStyle = bgConfig.lineColor;
    ctx.globalAlpha = 0.6;
    for (let x = size / 2; x <= width; x += size) {
      for (let y = size / 2; y <= height; y += size) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Chalk organic texture
  if (bgConfig.chalkEffect) {
    const grad = ctx.createRadialGradient(width / 2, height / 2, 200, width / 2, height / 2, width);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

// Element Renderer for Canvas
function renderElementToCanvas(
  ctx: CanvasRenderingContext2D,
  elem: WhiteboardElement,
  chalkEffect: boolean
) {
  if (['pen', 'chalk', 'highlighter'].includes(elem.type) && elem.points && elem.points.length > 0) {
    drawSmoothStroke(ctx, elem.points, elem.color, elem.strokeWidth, elem.type, chalkEffect);
    return;
  }

  // Shapes
  if (['line', 'arrow', 'rect', 'circle', 'triangle'].includes(elem.type) && elem.points && elem.points.length >= 2) {
    const p1 = elem.points[0];
    const p2 = elem.points[1];
    ctx.save();
    ctx.strokeStyle = elem.color;
    ctx.lineWidth = elem.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (elem.isFilled) {
      ctx.fillStyle = elem.color + '2b';
    }

    if (elem.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (elem.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const headLen = Math.max(14, elem.strokeWidth * 3.5);
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
      ctx.fillStyle = elem.color;
      ctx.fill();
    } else if (elem.type === 'rect') {
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      if (elem.isFilled) ctx.fill();
      ctx.stroke();
    } else if (elem.type === 'circle') {
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (elem.isFilled) ctx.fill();
      ctx.stroke();
    } else if (elem.type === 'triangle') {
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
      if (elem.isFilled) ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Coordinate Axes
  if (elem.type === 'axes' && elem.x !== undefined && elem.y !== undefined) {
    ctx.save();
    ctx.strokeStyle = elem.color;
    ctx.lineWidth = elem.strokeWidth || 2;
    ctx.fillStyle = elem.color;
    ctx.font = '600 14px monospace';

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

    // Arrows
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

  // Text
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

  // Sticky Note
  if (elem.type === 'sticky' && elem.x !== undefined && elem.y !== undefined) {
    ctx.save();
    const w = elem.width || 180;
    const h = elem.height || 140;

    ctx.fillStyle = elem.fillColor || '#fef08a';
    ctx.beginPath();
    ctx.roundRect(elem.x, elem.y, w, h, 8);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.beginPath();
    ctx.roundRect(elem.x, elem.y, w, 24, [8, 8, 0, 0]);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = '500 11px Outfit, sans-serif';
    ctx.fillText(`📌 ${elem.authorName || 'Not'}`, elem.x + 10, elem.y + 16);

    ctx.fillStyle = elem.color || '#1e293b';
    ctx.font = '500 14px Outfit, sans-serif';
    const lines = (elem.text || '').split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, elem.x! + 12, elem.y! + 46 + (i * 20));
    });

    ctx.restore();
    return;
  }
}
