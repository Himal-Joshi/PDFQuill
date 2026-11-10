import { useEffect, useRef, useState, useCallback, type MouseEvent, type PointerEvent } from 'react';
import type { EditorElement, TextElement, ImageElement, StampElement, ShapeElement, DrawingElement, EditorToolMode, FontChoice, ShapeType } from './types.ts';
import { TextElementOverlay } from './TextElementOverlay.tsx';
import { ImageElementOverlay } from './ImageElementOverlay.tsx';
import { StampElementOverlay } from './StampElementOverlay.tsx';
import { ShapeElementOverlay } from './ShapeElementOverlay.tsx';
import { DrawingElementOverlay } from './DrawingElementOverlay.tsx';

interface EditorPageProps {
  pdfDoc: any;
  pageIndex: number; // 0-based
  zoom: number;
  elements: EditorElement[];
  activeTool: EditorToolMode;
  selectedElementId: string | null;

  // Active Tool Settings
  shapeType: ShapeType;
  shapeFill: string;
  shapeStroke: string;

  drawMode: 'pen' | 'highlighter';
  drawColor: string;
  drawWidth: number;

  textFont: FontChoice;
  textSize: number;
  textColor: string;
  textBgColor: string;
  textBold: boolean;
  textItalic: boolean;

  onSelectElement: (id: string | null) => void;
  onAddElement: (element: EditorElement) => void;
  onUpdateElement: (id: string, updated: Partial<EditorElement>, commitToHistory?: boolean) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onCanvasSizeChange: (pageIndex: number, width: number, height: number) => void;
}

export function EditorPage({
  pdfDoc,
  pageIndex,
  zoom,
  elements,
  activeTool,
  selectedElementId,

  shapeType,
  shapeFill,
  shapeStroke,

  drawMode,
  drawColor,
  drawWidth,

  textFont,
  textSize,
  textColor,
  textBgColor,
  textBold,
  textItalic,

  onSelectElement,
  onAddElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onCanvasSizeChange,
}: EditorPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 600, height: 800 });
  const [isLoading, setIsLoading] = useState(true);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const renderTaskRef = useRef<any>(null);

  // Freehand drawing state
  const isDrawingRef = useRef(false);
  const currentDrawPointsRef = useRef<{ x: number; y: number }[]>([]);

  const baseScale = 1.25 * zoom;

  // Intersection observer to only render pages when in or near viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsNearViewport(true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render the PDF page to background canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !isNearViewport) return;
    setIsLoading(true);

    try {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const dpr = window.devicePixelRatio || 2;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const currentScale = 1.25 * zoom;
      const viewport = page.getViewport({ scale: currentScale * dpr });

      const displayWidth = unscaledViewport.width * currentScale;
      const displayHeight = unscaledViewport.height * currentScale;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      // Match drawing canvas size
      if (drawingCanvasRef.current) {
        drawingCanvasRef.current.width = displayWidth;
        drawingCanvasRef.current.height = displayHeight;
      }

      setPageSize({ width: displayWidth, height: displayHeight });
      onCanvasSizeChange(pageIndex, unscaledViewport.width, unscaledViewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderContext = {
        canvasContext: ctx,
        viewport,
        canvas,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
      setIsLoading(false);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`Error rendering PDF page ${pageIndex + 1}:`, err);
      }
    }
  }, [pdfDoc, pageIndex, zoom, isNearViewport, onCanvasSizeChange]);

  useEffect(() => {
    renderPage();
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [renderPage]);

  // Pointer event handlers for active freehand drawing on canvas
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'draw') return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / baseScale;
    const clickY = (e.clientY - rect.top) / baseScale;

    isDrawingRef.current = true;
    currentDrawPointsRef.current = [{ x: clickX, y: clickY }];

    const drawCanvas = drawingCanvasRef.current;
    if (drawCanvas) {
      const ctx = drawCanvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = drawWidth * baseScale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = drawMode === 'highlighter' ? 0.35 : 1.0;
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current || activeTool !== 'draw') return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / baseScale;
    const clickY = (e.clientY - rect.top) / baseScale;

    currentDrawPointsRef.current.push({ x: clickX, y: clickY });

    const drawCanvas = drawingCanvasRef.current;
    if (drawCanvas) {
      const ctx = drawCanvas.getContext('2d');
      if (ctx) {
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || activeTool !== 'draw') return;
    isDrawingRef.current = false;
    const points = currentDrawPointsRef.current;

    // Clear live preview canvas
    const drawCanvas = drawingCanvasRef.current;
    if (drawCanvas) {
      const ctx = drawCanvas.getContext('2d');
      ctx?.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    }

    if (points.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const padding = 6;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      const width = Math.max(10, maxX - minX + padding * 2);
      const height = Math.max(10, maxY - minY + padding * 2);

      const drawElem: DrawingElement = {
        id: `draw-${Date.now()}`,
        type: 'drawing',
        pageIndex,
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(width),
        height: Math.round(height),
        color: drawColor,
        strokeWidth: drawWidth,
        points,
        isHighlighter: drawMode === 'highlighter',
      };
      onAddElement(drawElem);
      onSelectElement(drawElem.id);
    }
    currentDrawPointsRef.current = [];
  };

  // Handle click on canvas surface to add new elements
  const handleCanvasClick = (e: MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'draw') return; // Handled by pointer events

    if (e.target !== containerRef.current && e.target !== canvasRef.current) {
      return;
    }

    if (activeTool === 'select') {
      onSelectElement(null);
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / baseScale;
    const clickY = (e.clientY - rect.top) / baseScale;

    if (activeTool === 'text') {
      const newElem: TextElement = {
        id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'text',
        pageIndex,
        x: Math.max(0, clickX - 10),
        y: Math.max(0, clickY - 10),
        width: 160,
        height: 36,
        text: 'Type text here...',
        fontFamily: textFont,
        fontSize: textSize,
        color: textColor,
        backgroundColor: textBgColor,
        bold: textBold,
        italic: textItalic,
      };
      onAddElement(newElem);
      onSelectElement(newElem.id);
    } else if (activeTool === 'shape') {
      const isLine = shapeType === 'line';
      const shapeElem: ShapeElement = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        shapeType,
        pageIndex,
        x: Math.max(0, clickX - 20),
        y: Math.max(0, clickY - 20),
        width: isLine ? 160 : 120,
        height: isLine ? 2 : 60,
        fillColor: shapeFill,
        strokeColor: shapeStroke,
        strokeWidth: shapeStroke === 'transparent' ? 0 : 2,
        opacity: 1,
      };
      onAddElement(shapeElem);
      onSelectElement(shapeElem.id);
    } else if (activeTool === 'stamp-date') {
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const newElem: TextElement = {
        id: `date-${Date.now()}`,
        type: 'text',
        pageIndex,
        x: clickX,
        y: clickY,
        width: 120,
        height: 28,
        text: today,
        fontFamily: 'Helvetica',
        fontSize: 12,
        color: '#0f172a',
        bold: true,
        italic: false,
      };
      onAddElement(newElem);
      onSelectElement(newElem.id);
    } else if (activeTool === 'stamp-check') {
      const newElem: StampElement = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        stampType: 'check',
        pageIndex,
        x: Math.max(0, clickX - 12),
        y: Math.max(0, clickY - 12),
        width: 24,
        height: 24,
        color: '#16a34a',
        fontSize: 20,
      };
      onAddElement(newElem);
      onSelectElement(newElem.id);
    } else if (activeTool === 'stamp-cross') {
      const newElem: StampElement = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        stampType: 'cross',
        pageIndex,
        x: Math.max(0, clickX - 12),
        y: Math.max(0, clickY - 12),
        width: 24,
        height: 24,
        color: '#dc2626',
        fontSize: 20,
      };
      onAddElement(newElem);
      onSelectElement(newElem.id);
    }
  };

  const pageElements = elements.filter((el) => el.pageIndex === pageIndex);

  return (
    <div
      ref={containerRef}
      id={`editor-page-${pageIndex}`}
      onClick={handleCanvasClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative bg-white shadow-2xl rounded-sm border border-slate-300 dark:border-slate-800 select-none mb-10 transition-shadow"
      style={{
        width: `${pageSize.width}px`,
        height: `${pageSize.height}px`,
        cursor:
          activeTool === 'text'
            ? 'text'
            : activeTool === 'draw'
            ? 'crosshair'
            : activeTool === 'shape'
            ? 'crosshair'
            : activeTool.startsWith('stamp')
            ? 'crosshair'
            : 'default',
      }}
    >
      {/* Background Rendered PDF Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Live drawing preview canvas */}
      <canvas
        ref={drawingCanvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 flex items-center justify-center backdrop-blur-[1px]">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Interactive Annotation Layer scaled to baseScale */}
      {!isLoading &&
        pageElements.map((elem) => {
          if (elem.type === 'text') {
            return (
              <TextElementOverlay
                key={elem.id}
                element={elem as TextElement}
                isSelected={selectedElementId === elem.id}
                scale={baseScale}
                onSelect={() => onSelectElement(elem.id)}
                onChange={(upd, commit) => onUpdateElement(elem.id, upd, commit)}
                onDelete={() => onDeleteElement(elem.id)}
                onDuplicate={() => onDuplicateElement(elem.id)}
              />
            );
          }

          if (elem.type === 'image' || elem.type === 'signature') {
            return (
              <ImageElementOverlay
                key={elem.id}
                element={elem as ImageElement}
                isSelected={selectedElementId === elem.id}
                scale={baseScale}
                onSelect={() => onSelectElement(elem.id)}
                onChange={(upd, commit) => onUpdateElement(elem.id, upd, commit)}
                onDelete={() => onDeleteElement(elem.id)}
                onDuplicate={() => onDuplicateElement(elem.id)}
              />
            );
          }

          if (elem.type === 'shape') {
            return (
              <ShapeElementOverlay
                key={elem.id}
                element={elem as ShapeElement}
                isSelected={selectedElementId === elem.id}
                scale={baseScale}
                onSelect={() => onSelectElement(elem.id)}
                onChange={(upd, commit) => onUpdateElement(elem.id, upd, commit)}
                onDelete={() => onDeleteElement(elem.id)}
                onDuplicate={() => onDuplicateElement(elem.id)}
              />
            );
          }

          if (elem.type === 'drawing') {
            return (
              <DrawingElementOverlay
                key={elem.id}
                element={elem as DrawingElement}
                isSelected={selectedElementId === elem.id}
                scale={baseScale}
                onSelect={() => onSelectElement(elem.id)}
                onChange={(upd, commit) => onUpdateElement(elem.id, upd, commit)}
                onDelete={() => onDeleteElement(elem.id)}
                onDuplicate={() => onDuplicateElement(elem.id)}
              />
            );
          }

          if (elem.type === 'stamp') {
            return (
              <StampElementOverlay
                key={elem.id}
                element={elem as StampElement}
                isSelected={selectedElementId === elem.id}
                scale={baseScale}
                onSelect={() => onSelectElement(elem.id)}
                onChange={(upd, commit) => onUpdateElement(elem.id, upd, commit)}
                onDelete={() => onDeleteElement(elem.id)}
                onDuplicate={() => onDuplicateElement(elem.id)}
              />
            );
          }

          return null;
        })}
    </div>
  );
}
