import {
  ArrowLeft,
  MousePointer,
  Type,
  PenLine,
  Calendar,
  Check,
  X,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Loader2,
} from 'lucide-react';
import type { EditorToolMode } from './types.ts';

interface EditorToolbarProps {
  fileName: string;
  currentPage: number; // 0-based
  numPages: number;
  activeTool: EditorToolMode;
  onSelectTool: (tool: EditorToolMode) => void;
  onOpenSignatureModal: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  isExporting: boolean;
  onSave: () => void;
  onBack: () => void;
}

export function EditorToolbar({
  fileName,
  currentPage,
  numPages,
  activeTool,
  onSelectTool,
  onOpenSignatureModal,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  isExporting,
  onSave,
  onBack,
}: EditorToolbarProps) {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Back & Document Metadata */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Back to Tools"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-xs">
            {fileName}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Page {currentPage + 1} of {numPages || 1}
          </span>
        </div>
      </div>

      {/* Center: Tools Toolbar */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 gap-0.5">
        <button
          type="button"
          onClick={() => onSelectTool('select')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTool === 'select'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
          title="Select / Move Elements"
        >
          <MousePointer className="w-4 h-4" />
          <span className="hidden md:inline">Select</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTool('text')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTool === 'text'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
          title="Add Text Block (Click to Place)"
        >
          <Type className="w-4 h-4" />
          <span className="hidden md:inline">Text</span>
        </button>

        <button
          type="button"
          onClick={onOpenSignatureModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-all"
          title="Sign Document (Draw or Upload)"
        >
          <PenLine className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="hidden md:inline">Signature</span>
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

        <button
          type="button"
          onClick={() => onSelectTool(activeTool === 'stamp-date' ? 'select' : 'stamp-date')}
          className={`p-1.5 rounded-lg transition-all ${
            activeTool === 'stamp-date'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
          title="Insert Date Stamp"
        >
          <Calendar className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onSelectTool(activeTool === 'stamp-check' ? 'select' : 'stamp-check')}
          className={`p-1.5 rounded-lg transition-all ${
            activeTool === 'stamp-check'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600'
          }`}
          title="Checkmark Stamp (✓)"
        >
          <Check className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onSelectTool(activeTool === 'stamp-cross' ? 'select' : 'stamp-cross')}
          className={`p-1.5 rounded-lg transition-all ${
            activeTool === 'stamp-cross'
              ? 'bg-white dark:bg-slate-700 text-red-600 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-red-600'
          }`}
          title="Cross Stamp (✕)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Right: History, Zoom & Save Action */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* History Controls */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

        {/* Zoom Controls */}
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Primary Save & Download Button */}
        <button
          type="button"
          onClick={onSave}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
