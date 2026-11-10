import { useEffect, useRef, useState, useCallback, type MouseEvent } from 'react';
import type { EditorElement, TextElement, ImageElement, StampElement, EditorToolMode } from './types.ts';
import { TextElementOverlay } from './TextElementOverlay.tsx';
import { ImageElementOverlay } from './ImageElementOverlay.tsx';
import { StampElementOverlay } from './StampElementOverlay.tsx';

interface EditorCanvasProps {
  pdfDoc: any;
  currentPage: number; // 0-based
  zoom: number;        // e.g. 1.0 = 100%
  elements: EditorElement[];
  activeTool: EditorToolMode;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onAddElement: (element: EditorElement) => void;
  onUpdateElement: (id: string, updated: Partial<EditorElement>, commitToHistory?: boolean) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onCanvasSizeChange: (pageIndex: number, width: number, height: number) => void;
}

export function EditorCanvas({
  pdfDoc,
  currentPage,
  zoom,
  elements,
  activeTool,
  selectedElementId,
  onSelectElement,
  onAddElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onCanvasSizeChange,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 600, height: 800 });
  const [isLoading, setIsLoading] = useState(true);
  const renderTaskRef = useRef<any>(null);

  const baseScale = 1.25 * zoom;

  // Render the PDF page to background canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc) return;
    setIsLoading(true);

    try {
      // PDF.js uses 1-based page indexing
      const page = await pdfDoc.getPage(currentPage + 1);
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cancel previous render task if still in progress
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

      setPageSize({ width: displayWidth, height: displayHeight });
      // Notify parent of unscaled PDF points dimensions
      onCanvasSizeChange(currentPage, unscaledViewport.width, unscaledViewport.height);

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
        console.error('Error rendering PDF page in editor:', err);
      }
    }
  }, [pdfDoc, currentPage, zoom, onCanvasSizeChange]);

  useEffect(() => {
    renderPage();
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [renderPage]);

  // Handle click on canvas surface to add new elements in canonical PDF points
  const handleCanvasClick = (e: MouseEvent<HTMLDivElement>) => {
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
    // Convert click display pixels directly into canonical PDF points
    const clickX = (e.clientX - rect.left) / baseScale;
    const clickY = (e.clientY - rect.top) / baseScale;

    if (activeTool === 'text') {
      const newElem: TextElement = {
        id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'text',
        pageIndex: currentPage,
        x: Math.max(0, clickX - 10),
        y: Math.max(0, clickY - 10),
        width: 160,
        height: 36,
        text: 'Type text here...',
        fontFamily: 'Helvetica',
        fontSize: 14,
        color: '#000000',
        bold: false,
        italic: false,
      };
      onAddElement(newElem);
      onSelectElement(newElem.id);
    } else if (activeTool === 'stamp-date') {
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const newElem: TextElement = {
        id: `date-${Date.now()}`,
        type: 'text',
        pageIndex: currentPage,
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
        pageIndex: currentPage,
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
        pageIndex: currentPage,
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

  // Filter elements belonging to the active page
  const pageElements = elements.filter((el) => el.pageIndex === currentPage);

  return (
    <div className="relative flex items-center justify-center p-8 min-h-full">
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className="relative bg-white shadow-2xl rounded-sm border border-slate-300 dark:border-slate-800 transition-shadow select-none"
        style={{
          width: `${pageSize.width}px`,
          height: `${pageSize.height}px`,
          cursor: activeTool === 'text' ? 'text' : activeTool.startsWith('stamp') ? 'crosshair' : 'default',
        }}
      >
        {/* Rendered PDF Page Background */}
        <canvas ref={canvasRef} className="block w-full h-full" />

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
    </div>
  );
}
