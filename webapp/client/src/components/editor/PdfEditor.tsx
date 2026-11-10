import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type {
  EditorElement,
  EditorToolMode,
  EditorHistoryState,
  ImageElement,
  FontChoice,
  ShapeType,
  TextElement,
  ShapeElement,
  StampElement,
} from './types.ts';
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

  // Active Tool Contextual Options (iLovePDF Style)
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle');
  const [shapeFill, setShapeFill] = useState<string>('transparent');
  const [shapeStroke, setShapeStroke] = useState<string>('#2563eb');

  const [drawMode, setDrawMode] = useState<'pen' | 'highlighter'>('pen');
  const [drawColor, setDrawColor] = useState<string>('#dc2626');
  const [drawWidth, setDrawWidth] = useState<number>(3);

  const [textFont, setTextFont] = useState<FontChoice>('Helvetica');
  const [textSize, setTextSize] = useState<number>(14);
  const [textColor, setTextColor] = useState<string>('#0f172a');
  const [textBgColor, setTextBgColor] = useState<string>('transparent');
  const [textBold, setTextBold] = useState<boolean>(false);
  const [textItalic, setTextItalic] = useState<boolean>(false);

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

  // Handle file upload for images
  const handleUploadImageFile = (imageFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const currentCanvasSize = pageCanvasSizesRef.current.get(currentPage) || { width: 595, height: 842 };
        const imgAspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        const defaultWidth = Math.min(220, currentCanvasSize.width * 0.4);
        const defaultHeight = defaultWidth / imgAspect;

        const imageElement: ImageElement = {
          id: `img-${Date.now()}`,
          type: 'image',
          pageIndex: currentPage,
          dataUrl,
          aspectRatio: imgAspect,
          x: Math.max(20, Math.round((currentCanvasSize.width - defaultWidth) / 2)),
          y: Math.max(20, Math.round((currentCanvasSize.height - defaultHeight) / 2)),
          width: Math.round(defaultWidth),
          height: Math.round(defaultHeight),
        };

        commitElementsChange([...elements, imageElement]);
        setSelectedElementId(imageElement.id);
        setActiveTool('select');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(imageFile);
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

  // Tool Selection with Instant Instantiation on Current Page (iLovePDF behavior)
  const handleSelectTool = (newTool: EditorToolMode) => {
    setActiveTool(newTool);

    const currentCanvasSize = pageCanvasSizesRef.current.get(currentPage) || { width: 595, height: 842 };

    if (newTool === 'text') {
      const textElem: TextElement = {
        id: `text-${Date.now()}`,
        type: 'text',
        pageIndex: currentPage,
        x: Math.max(20, Math.round((currentCanvasSize.width - 160) / 2)),
        y: Math.max(20, Math.round((currentCanvasSize.height - 36) / 2)),
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
      commitElementsChange([...elements, textElem]);
      setSelectedElementId(textElem.id);
    } else if (newTool === 'shape') {
      const isLine = shapeType === 'line';
      const shapeElem: ShapeElement = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        shapeType,
        pageIndex: currentPage,
        x: Math.max(20, Math.round((currentCanvasSize.width - (isLine ? 160 : 120)) / 2)),
        y: Math.max(20, Math.round((currentCanvasSize.height - (isLine ? 2 : 60)) / 2)),
        width: isLine ? 160 : 120,
        height: isLine ? 2 : 60,
        fillColor: shapeFill,
        strokeColor: shapeStroke,
        strokeWidth: shapeStroke === 'transparent' ? 0 : 2,
        opacity: 1,
      };
      commitElementsChange([...elements, shapeElem]);
      setSelectedElementId(shapeElem.id);
    } else if (newTool === 'stamp-check') {
      const stampElem: StampElement = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        stampType: 'check',
        pageIndex: currentPage,
        x: Math.max(20, Math.round((currentCanvasSize.width - 44) / 2)),
        y: Math.max(20, Math.round((currentCanvasSize.height - 44) / 2)),
        width: 44,
        height: 44,
        color: '#16a34a',
        fontSize: 20,
      };
      commitElementsChange([...elements, stampElem]);
      setSelectedElementId(stampElem.id);
      setActiveTool('select');
    } else if (newTool === 'stamp-cross') {
      const stampElem: StampElement = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        stampType: 'cross',
        pageIndex: currentPage,
        x: Math.max(20, Math.round((currentCanvasSize.width - 44) / 2)),
        y: Math.max(20, Math.round((currentCanvasSize.height - 44) / 2)),
        width: 44,
        height: 44,
        color: '#dc2626',
        fontSize: 20,
      };
      commitElementsChange([...elements, stampElem]);
      setSelectedElementId(stampElem.id);
      setActiveTool('select');
    } else if (newTool === 'stamp-date') {
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const stampElem: StampElement = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        stampType: 'date',
        pageIndex: currentPage,
        x: Math.max(20, Math.round((currentCanvasSize.width - 120) / 2)),
        y: Math.max(20, Math.round((currentCanvasSize.height - 30) / 2)),
        width: 120,
        height: 30,
        color: '#2563eb',
        textValue: today,
        fontSize: 14,
      };
      commitElementsChange([...elements, stampElem]);
      setSelectedElementId(stampElem.id);
      setActiveTool('select');
    }
  };

  // Real-time synchronization when selecting elements
  const handleSelectElement = (id: string | null) => {
    setSelectedElementId(id);
    if (!id) return;
    const target = elements.find((el) => el.id === id);
    if (target?.type === 'text') {
      const t = target as TextElement;
      setTextFont(t.fontFamily || 'Helvetica');
      setTextSize(t.fontSize || 14);
      setTextColor(t.color || '#0f172a');
      setTextBgColor(t.backgroundColor || 'transparent');
      setTextBold(!!t.bold);
      setTextItalic(!!t.italic);
      setActiveTool('text');
    } else if (target?.type === 'shape') {
      const s = target as ShapeElement;
      setShapeType(s.shapeType);
      setShapeFill(s.fillColor);
      setShapeStroke(s.strokeColor);
      setActiveTool('shape');
    }
  };

  // Active Tool Setting Handlers with dynamic updates to selected element
  const handleSetTextFont = (font: FontChoice) => {
    setTextFont(font);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'text') handleUpdateElement(selectedElementId, { fontFamily: font });
    }
  };

  const handleSetTextSize = (size: number) => {
    setTextSize(size);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'text') handleUpdateElement(selectedElementId, { fontSize: size });
    }
  };

  const handleSetTextColor = (color: string) => {
    setTextColor(color);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'text') handleUpdateElement(selectedElementId, { color });
    }
  };

  const handleSetTextBgColor = (bg: string) => {
    setTextBgColor(bg);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'text') handleUpdateElement(selectedElementId, { backgroundColor: bg });
    }
  };

  const handleSetTextBold = (bold: boolean) => {
    setTextBold(bold);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'text') handleUpdateElement(selectedElementId, { bold });
    }
  };

  const handleSetTextItalic = (italic: boolean) => {
    setTextItalic(italic);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'text') handleUpdateElement(selectedElementId, { italic });
    }
  };

  const handleSetShapeType = (shape: ShapeType) => {
    setShapeType(shape);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'shape') handleUpdateElement(selectedElementId, { shapeType: shape });
    }
  };

  const handleSetShapeFill = (fill: string) => {
    setShapeFill(fill);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'shape') handleUpdateElement(selectedElementId, { fillColor: fill });
    }
  };

  const handleSetShapeStroke = (stroke: string) => {
    setShapeStroke(stroke);
    if (selectedElementId) {
      const el = elements.find((e) => e.id === selectedElementId);
      if (el?.type === 'shape') {
        handleUpdateElement(selectedElementId, {
          strokeColor: stroke,
          strokeWidth: stroke === 'transparent' ? 0 : 2,
        });
      }
    }
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
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {/* Top Toolbar */}
      <EditorToolbar
        fileName={file.name}
        currentPage={currentPage}
        numPages={numPages}
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
        onUploadImageFile={handleUploadImageFile}
        shapeType={shapeType}
        onSetShapeType={handleSetShapeType}
        shapeFill={shapeFill}
        onSetShapeFill={handleSetShapeFill}
        shapeStroke={shapeStroke}
        onSetShapeStroke={handleSetShapeStroke}
        drawMode={drawMode}
        onSetDrawMode={setDrawMode}
        drawColor={drawColor}
        onSetDrawColor={setDrawColor}
        drawWidth={drawWidth}
        onSetDrawWidth={setDrawWidth}
        textFont={textFont}
        onSetTextFont={handleSetTextFont}
        textSize={textSize}
        onSetTextSize={handleSetTextSize}
        textColor={textColor}
        onSetTextColor={handleSetTextColor}
        textBgColor={textBgColor}
        onSetTextBgColor={handleSetTextBgColor}
        textBold={textBold}
        onSetTextBold={handleSetTextBold}
        textItalic={textItalic}
        onSetTextItalic={handleSetTextItalic}
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
            const pageEl = document.getElementById(`editor-page-${idx}`);
            if (pageEl) {
              pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
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
              numPages={numPages}
              currentPage={currentPage}
              zoom={zoom}
              elements={elements}
              activeTool={activeTool}
              selectedElementId={selectedElementId}
              shapeType={shapeType}
              shapeFill={shapeFill}
              shapeStroke={shapeStroke}
              drawMode={drawMode}
              drawColor={drawColor}
              drawWidth={drawWidth}
              textFont={textFont}
              textSize={textSize}
              textColor={textColor}
              textBgColor={textBgColor}
              textBold={textBold}
              textItalic={textItalic}
              onSelectElement={handleSelectElement}
              onAddElement={handleAddElement}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              onDuplicateElement={handleDuplicateElement}
              onCanvasSizeChange={handleCanvasSizeChange}
              onPageVisible={(idx) => setCurrentPage(idx)}
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
