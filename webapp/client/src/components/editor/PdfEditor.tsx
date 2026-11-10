import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { EditorElement, EditorToolMode, EditorHistoryState, ImageElement } from './types.ts';
import { EditorToolbar } from './EditorToolbar.tsx';
import { EditorSidebar } from './EditorSidebar.tsx';
import { EditorCanvas } from './EditorCanvas.tsx';
import { SignatureModal } from './SignatureModal.tsx';
import { generateThumbnails, type PageThumbnail } from '../../lib/pdfThumbnails.ts';
import { exportEditedPdf } from '../../lib/pdfEditorProcessing.ts';

interface PdfEditorProps {
  file: File;
  onBack: () => void;
}

export function PdfEditor({ file, onBack }: PdfEditorProps) {
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0); // 0-based
  const [zoom, setZoom] = useState(1.0);
  const [activeTool, setActiveTool] = useState<EditorToolMode>('select');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const [elements, setElements] = useState<EditorElement[]>([]);
  const [history, setHistory] = useState<EditorHistoryState>({
    past: [],
    present: [],
    future: [],
  });

  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const pageCanvasSizesRef = useRef<Map<number, { width: number; height: number }>>(new Map());

  // Load PDF.js document and generate page thumbnails
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      try {
        const buffer = await file.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        if (isCancelled) return;

        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);

        // Generate thumbnails in background
        const thumbs = await generateThumbnails(file, 160);
        if (!isCancelled) {
          setThumbnails(thumbs);
        }
      } catch (err: any) {
        console.error('Failed to load PDF in editor:', err);
        if (err?.name === 'PasswordException') {
          alert('This PDF is password-protected. Please use the Unlock PDF tool to remove the password first.');
          onBack();
        }
      }
    }

    loadDocument();
    return () => {
      isCancelled = true;
    };
  }, [file, onBack]);

  // History Helper: push a new snapshot
  const commitElementsChange = useCallback((newElements: EditorElement[]) => {
    setElements(newElements);
    setHistory((prev) => ({
      past: [...prev.past.slice(-30), prev.present], // keep last 30 actions
      present: newElements,
      future: [],
    }));
  }, []);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);
      setElements(previous);
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      setElements(next);
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // Keyboard shortcuts (Undo, Redo, Delete, Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTagName = (document.activeElement?.tagName || '').toLowerCase();
      const isInputActive = activeTagName === 'input' || activeTagName === 'textarea';

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Delete selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive && selectedElementId) {
        e.preventDefault();
        const updated = elements.filter((el) => el.id !== selectedElementId);
        commitElementsChange(updated);
        setSelectedElementId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedElementId, elements, commitElementsChange]);

  // Element actions
  const handleAddElement = (element: EditorElement) => {
    commitElementsChange([...elements, element]);
  };

  const handleUpdateElement = (id: string, updated: Partial<EditorElement>, commitToHistory = true) => {
    const newElements = elements.map((el) => (el.id === id ? ({ ...el, ...updated } as EditorElement) : el));
    if (commitToHistory) {
      commitElementsChange(newElements);
    } else {
      setElements(newElements);
    }
  };

  const handleDeleteElement = (id: string) => {
    const newElements = elements.filter((el) => el.id !== id);
    commitElementsChange(newElements);
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  const handleDuplicateElement = (id: string) => {
    const target = elements.find((el) => el.id === id);
    if (!target) return;

    const duplicated: EditorElement = {
      ...target,
      id: `${target.type}-${Date.now()}`,
      x: target.x + 20,
      y: target.y + 20,
    };
    commitElementsChange([...elements, duplicated]);
    setSelectedElementId(duplicated.id);
  };

  // Add signature from modal in canonical PDF points
  const handleSaveSignature = (dataUrl: string, aspectRatio: number) => {
    const currentCanvasSize = pageCanvasSizesRef.current.get(currentPage) || { width: 595, height: 842 };
    const defaultWidth = Math.min(180, currentCanvasSize.width * 0.35);
    const defaultHeight = defaultWidth / (aspectRatio || 2);

    const signatureElement: ImageElement = {
      id: `sig-${Date.now()}`,
      type: 'signature',
      pageIndex: currentPage,
      dataUrl,
      aspectRatio,
      isSignature: true,
      x: Math.max(20, Math.round((currentCanvasSize.width - defaultWidth) / 2)),
      y: Math.max(20, Math.round((currentCanvasSize.height - defaultHeight) / 2)),
      width: Math.round(defaultWidth),
      height: Math.round(defaultHeight),
    };

    commitElementsChange([...elements, signatureElement]);
    setSelectedElementId(signatureElement.id);
    setActiveTool('select');
  };

  const handleCanvasSizeChange = useCallback((pageIndex: number, width: number, height: number) => {
    pageCanvasSizesRef.current.set(pageIndex, { width, height });
  }, []);

  // Back guard for unsaved changes
  const handleBackWithConfirm = () => {
    if (elements.length > 0) {
      const confirmed = window.confirm('You have unsaved edits on this document. Are you sure you want to exit without saving?');
      if (!confirmed) return;
    }
    onBack();
  };

  // Export and download edited PDF
  const handleExportPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const originalBytes = new Uint8Array(await file.arrayBuffer());
      const editedBytes = await exportEditedPdf(originalBytes, elements, pageCanvasSizesRef.current);

      const blob = new Blob([editedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const originalName = file.name.replace(/\.[^/.]+$/, '');
      a.download = `${originalName}_edited.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export edited PDF:', err);
      alert('Failed to save edited PDF. Please check the document and try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {/* Top Toolbar */}
      <EditorToolbar
        fileName={file.name}
        currentPage={currentPage}
        numPages={numPages}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}
        onZoomOut={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))}
        onZoomReset={() => setZoom(1.0)}
        isExporting={isExporting}
        onSave={handleExportPdf}
        onBack={handleBackWithConfirm}
      />

      {/* Main Workspace: Left Sidebar + Center Scrollable Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Page Thumbnail Rail */}
        <EditorSidebar
          numPages={numPages}
          currentPage={currentPage}
          onSelectPage={(idx) => {
            setCurrentPage(idx);
            setSelectedElementId(null);
          }}
          elements={elements}
          thumbnails={thumbnails}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)}
        />

        {/* Center Canvas Viewport */}
        <main className="flex-1 overflow-auto bg-slate-200/60 dark:bg-slate-950 flex flex-col items-center justify-start custom-scrollbar">
          {pdfDoc && (
            <EditorCanvas
              pdfDoc={pdfDoc}
              currentPage={currentPage}
              zoom={zoom}
              elements={elements}
              activeTool={activeTool}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onAddElement={handleAddElement}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              onDuplicateElement={handleDuplicateElement}
              onCanvasSizeChange={handleCanvasSizeChange}
            />
          )}
        </main>
      </div>

      {/* Signature Creator Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSaveSignature={handleSaveSignature}
      />
    </div>
  );
}
