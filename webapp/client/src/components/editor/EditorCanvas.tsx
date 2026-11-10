import { useEffect, useRef } from 'react';
import type { EditorElement, EditorToolMode } from './types.ts';
import { EditorPage } from './EditorPage.tsx';

interface EditorCanvasProps {
  pdfDoc: any;
  numPages: number;
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
  onPageVisible?: (pageIndex: number) => void;
}

export function EditorCanvas({
  pdfDoc,
  numPages,
  currentPage: _currentPage,
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
  onPageVisible,
}: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Intersection observer to track which page is actively centered in viewport during scroll
  useEffect(() => {
    if (!onPageVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageId = entry.target.getAttribute('id');
            if (pageId && pageId.startsWith('editor-page-')) {
              const pageIdx = parseInt(pageId.replace('editor-page-', ''), 10);
              if (!isNaN(pageIdx)) {
                onPageVisible(pageIdx);
              }
            }
          }
        }
      },
      { threshold: 0.4 }
    );

    const pages = document.querySelectorAll('[id^="editor-page-"]');
    pages.forEach((p) => observer.observe(p));

    return () => observer.disconnect();
  }, [numPages, onPageVisible]);

  return (
    <div ref={containerRef} className="flex flex-col items-center py-8 px-6 min-h-full w-full">
      {Array.from({ length: numPages || 1 }).map((_, idx) => (
        <div key={idx} className="flex flex-col items-center w-full">
          {/* Page Indicator Tag */}
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2 select-none tracking-wider uppercase">
            Page {idx + 1}
          </div>

          <EditorPage
            pdfDoc={pdfDoc}
            pageIndex={idx}
            zoom={zoom}
            elements={elements}
            activeTool={activeTool}
            selectedElementId={selectedElementId}
            onSelectElement={onSelectElement}
            onAddElement={onAddElement}
            onUpdateElement={onUpdateElement}
            onDeleteElement={onDeleteElement}
            onDuplicateElement={onDuplicateElement}
            onCanvasSizeChange={onCanvasSizeChange}
          />
        </div>
      ))}
    </div>
  );
}
