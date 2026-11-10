import { useRef, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  Type,
  Image as ImageIcon,
  Pencil,
  Highlighter,
  Square,
  Circle,
  Minus,
  PenLine,
  Check,
  X,
  Calendar,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Loader2,
  Bold,
  Italic,
} from 'lucide-react';
import type { EditorToolMode, FontChoice, ShapeType } from './types.ts';

interface EditorToolbarProps {
  fileName: string;
  currentPage: number;
  numPages: number;
  activeTool: EditorToolMode;
  onSelectTool: (tool: EditorToolMode) => void;
  onOpenSignatureModal: () => void;
  onUploadImageFile: (file: File) => void;

  // Active Tool Settings (iLovePDF contextual bar)
  shapeType: ShapeType;
  onSetShapeType: (shape: ShapeType) => void;
  shapeFill: string;
  onSetShapeFill: (color: string) => void;
  shapeStroke: string;
  onSetShapeStroke: (color: string) => void;

  drawMode: 'pen' | 'highlighter';
  onSetDrawMode: (mode: 'pen' | 'highlighter') => void;
  drawColor: string;
  onSetDrawColor: (color: string) => void;
  drawWidth: number;
  onSetDrawWidth: (width: number) => void;

  textFont: FontChoice;
  onSetTextFont: (font: FontChoice) => void;
  textSize: number;
  onSetTextSize: (size: number) => void;
  textColor: string;
  onSetTextColor: (color: string) => void;
  textBgColor: string;
  onSetTextBgColor: (color: string) => void;
  textBold: boolean;
  onSetTextBold: (bold: boolean) => void;
  textItalic: boolean;
  onSetTextItalic: (italic: boolean) => void;

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

const PALETTE = ['#0f172a', '#dc2626', '#1d4ed8', '#16a34a', '#eab308', '#ffffff'];
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 30, 36];

export function EditorToolbar({
  fileName,
  currentPage,
  numPages,
  activeTool,
  onSelectTool,
  onOpenSignatureModal,
  onUploadImageFile,

  shapeType,
  onSetShapeType,
  shapeFill,
  onSetShapeFill,
  shapeStroke,
  onSetShapeStroke,

  drawMode,
  onSetDrawMode,
  drawColor,
  onSetDrawColor,
  drawWidth,
  onSetDrawWidth,

  textFont,
  onSetTextFont,
  textSize,
  onSetTextSize,
  textColor,
  onSetTextColor,
  textBgColor,
  onSetTextBgColor,
  textBold,
  onSetTextBold,
  textItalic,
  onSetTextItalic,

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
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImageFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none z-30 shadow-xs">
      {/* Primary Top Bar */}
      <div className="h-14 px-4 flex items-center justify-between gap-2">
        {/* Left: Back & Document Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to all tools"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-xs">
              {fileName}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Page {currentPage + 1} of {numPages || 1}
            </span>
          </div>
        </div>

        {/* Center: Main iLovePDF Tool Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 gap-1 overflow-x-auto">
          {/* Add Text */}
          <button
            type="button"
            onClick={() => onSelectTool(activeTool === 'text' ? 'select' : 'text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTool === 'text'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Type className="w-4 h-4" />
            <span className="hidden sm:inline">Add text</span>
          </button>

          {/* Add Image */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 transition-all"
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Add image</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            className="hidden"
            onChange={handleImageChange}
          />

          {/* Draw */}
          <button
            type="button"
            onClick={() => onSelectTool(activeTool === 'draw' ? 'select' : 'draw')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTool === 'draw'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Pencil className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Draw</span>
          </button>

          {/* Shapes */}
          <button
            type="button"
            onClick={() => onSelectTool(activeTool === 'shape' ? 'select' : 'shape')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTool === 'shape'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Square className="w-4 h-4 text-blue-500" />
            <span className="hidden sm:inline">Shapes</span>
          </button>

          {/* Sign */}
          <button
            type="button"
            onClick={onOpenSignatureModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
          >
            <PenLine className="w-4 h-4 text-purple-600" />
            <span className="hidden sm:inline">Sign</span>
          </button>

          {/* Quick Stamps (Check, Cross, Date) */}
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={() => onSelectTool(activeTool === 'stamp-check' ? 'select' : 'stamp-check')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'stamp-check' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-emerald-600'
            }`}
            title="Checkmark (✓)"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onSelectTool(activeTool === 'stamp-cross' ? 'select' : 'stamp-cross')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'stamp-cross' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-xs' : 'text-slate-500 hover:text-red-600'
            }`}
            title="Cross (✕)"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onSelectTool(activeTool === 'stamp-date' ? 'select' : 'stamp-date')}
            className={`p-1.5 rounded-lg transition-all ${
              activeTool === 'stamp-date' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-indigo-600'
            }`}
            title="Date Stamp"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>

        {/* Right: History, Zoom & Big Edit PDF Action */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* History */}
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

          {/* Zoom */}
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

          {/* iLovePDF-style Big "Edit PDF" Primary Action Button */}
          <button
            type="button"
            onClick={onSave}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-500/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all uppercase tracking-wider"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Edit PDF</span>
                <Download className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contextual Options Bar (iLovePDF Style Secondary Bar) */}
      {(activeTool === 'text' || activeTool === 'draw' || activeTool === 'shape') && (
        <div className="h-10 px-6 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs flex items-center gap-4 text-xs overflow-x-auto">
          {/* TEXT CONTROLS */}
          {activeTool === 'text' && (
            <>
              {/* Font Family */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Font:</span>
                <select
                  value={textFont}
                  onChange={(e) => onSetTextFont(e.target.value as FontChoice)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 py-0.5 px-2 rounded-md font-medium"
                >
                  <option value="Helvetica">Helvetica</option>
                  <option value="TimesRoman">Times New Roman</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>

              {/* Font Size */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Size:</span>
                <select
                  value={textSize}
                  onChange={(e) => onSetTextSize(Number(e.target.value))}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 py-0.5 px-2 rounded-md font-medium"
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s} value={s}>{s}pt</option>
                  ))}
                </select>
              </div>

              {/* Bold & Italic */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSetTextBold(!textBold)}
                  className={`p-1 rounded transition-colors ${
                    textBold ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onSetTextItalic(!textItalic)}
                  className={`p-1 rounded transition-colors ${
                    textItalic ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Text Color */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Color:</span>
                <div className="flex items-center gap-1">
                  {PALETTE.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => onSetTextColor(col)}
                      className={`w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 ${
                        textColor === col ? 'ring-2 ring-indigo-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              {/* Background Color (Whiteout / Highlight) */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Background:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSetTextBgColor('transparent')}
                    className={`px-1.5 py-0.5 rounded border text-[11px] ${
                      textBgColor === 'transparent' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTextBgColor('#ffffff')}
                    className={`px-1.5 py-0.5 rounded border text-[11px] ${
                      textBgColor === '#ffffff' ? 'border-indigo-500 bg-white text-indigo-600 shadow-xs' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    Whiteout
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTextBgColor('#fef08a')}
                    className={`px-1.5 py-0.5 rounded border text-[11px] ${
                      textBgColor === '#fef08a' ? 'border-amber-500 bg-yellow-100 text-amber-800' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    Highlight
                  </button>
                </div>
              </div>
            </>
          )}

          {/* DRAW CONTROLS */}
          {activeTool === 'draw' && (
            <>
              {/* Mode: Pen vs Highlighter */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => onSetDrawMode('pen')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                    drawMode === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Pen
                </button>
                <button
                  type="button"
                  onClick={() => onSetDrawMode('highlighter')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                    drawMode === 'highlighter' ? 'bg-amber-500 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  Highlighter
                </button>
              </div>

              {/* Color Palette */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Color:</span>
                <div className="flex items-center gap-1">
                  {PALETTE.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => onSetDrawColor(col)}
                      className={`w-4 h-4 rounded-full border border-slate-300 ${
                        drawColor === col ? 'ring-2 ring-indigo-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              {/* Line Width */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Size:</span>
                <div className="flex items-center gap-1">
                  {[2, 4, 8].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onSetDrawWidth(w)}
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                        drawWidth === w ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      {w === 2 ? 'Fine' : w === 4 ? 'Medium' : 'Thick'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* SHAPES CONTROLS */}
          {activeTool === 'shape' && (
            <>
              {/* Shape Type */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => onSetShapeType('rectangle')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                    shapeType === 'rectangle' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                  title="Rectangle"
                >
                  <Square className="w-3.5 h-3.5" />
                  Rectangle
                </button>
                <button
                  type="button"
                  onClick={() => onSetShapeType('circle')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                    shapeType === 'circle' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                  title="Circle"
                >
                  <Circle className="w-3.5 h-3.5" />
                  Circle
                </button>
                <button
                  type="button"
                  onClick={() => onSetShapeType('line')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                    shapeType === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                  title="Line"
                >
                  <Minus className="w-3.5 h-3.5" />
                  Line
                </button>
              </div>

              {/* Fill */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Fill:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSetShapeFill('transparent')}
                    className={`px-1.5 py-0.5 rounded border text-[11px] ${
                      shapeFill === 'transparent' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetShapeFill('#ffffff')}
                    className={`px-1.5 py-0.5 rounded border text-[11px] ${
                      shapeFill === '#ffffff' ? 'border-indigo-500 bg-white text-indigo-600 shadow-xs' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    White (Whiteout)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetShapeFill('#fef08a')}
                    className={`px-1.5 py-0.5 rounded border text-[11px] ${
                      shapeFill === '#fef08a' ? 'border-amber-500 bg-yellow-100 text-amber-800' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    Highlight Box
                  </button>
                </div>
              </div>

              {/* Border Color */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Border:</span>
                <div className="flex items-center gap-1">
                  {PALETTE.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => onSetShapeStroke(col)}
                      className={`w-4 h-4 rounded-sm border ${
                        shapeStroke === col ? 'ring-2 ring-indigo-500 scale-110' : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => onSetShapeStroke('transparent')}
                    className={`px-1.5 py-0.5 rounded border text-[10px] ${
                      shapeStroke === 'transparent' ? 'border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-400'
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
