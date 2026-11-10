import { useState, useRef, useEffect, type PointerEvent, type ChangeEvent } from 'react';
import { Trash2, Copy, Bold, Italic } from 'lucide-react';
import type { TextElement, FontChoice } from './types.ts';

interface TextElementOverlayProps {
  element: TextElement;
  isSelected: boolean;
  scale: number;
  onSelect: () => void;
  onChange: (updated: Partial<TextElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 30, 36];
const TEXT_COLORS = ['#000000', '#1d4ed8', '#b91c1c', '#15803d', '#475569'];

export function TextElementOverlay({
  element,
  isSelected,
  scale,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
}: TextElementOverlayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; elemX: number; elemY: number }>({ x: 0, y: 0, elemX: 0, elemY: 0 });
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ x: number; y: number; elemW: number; elemH: number }>({ x: 0, y: 0, elemW: 0, elemH: 0 });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();
    if (isEditing) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      elemX: element.x,
      elemY: element.y,
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = (moveEvent.clientX - dragStartRef.current.x) / scale;
      const dy = (moveEvent.clientY - dragStartRef.current.y) / scale;
      onChange({
        x: Math.max(0, dragStartRef.current.elemX + dx),
        y: Math.max(0, dragStartRef.current.elemY + dy),
      });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResizePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      elemW: element.width,
      elemH: element.height,
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (!isResizingRef.current) return;
      const dx = (moveEvent.clientX - resizeStartRef.current.x) / scale;
      const dy = (moveEvent.clientY - resizeStartRef.current.y) / scale;
      onChange({
        width: Math.max(60, resizeStartRef.current.elemW + dx),
        height: Math.max(24, resizeStartRef.current.elemH + dy),
      });
    };

    const handlePointerUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const getFontFamilyStyle = (font: FontChoice) => {
    if (font === 'TimesRoman') return 'Times New Roman, serif';
    if (font === 'Courier') return 'Courier New, monospace';
    return 'Helvetica, Arial, sans-serif';
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`absolute group select-none ${
        isSelected
          ? 'ring-2 ring-indigo-500 rounded bg-indigo-50/15'
          : 'hover:ring-1 hover:ring-indigo-300'
      }`}
      style={{
        left: `${element.x * scale}px`,
        top: `${element.y * scale}px`,
        width: `${element.width * scale}px`,
        height: `${element.height * scale}px`,
        cursor: isEditing ? 'text' : 'move',
      }}
    >
      {/* Floating Toolbar when Selected */}
      {isSelected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-11 left-0 z-30 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg px-2 py-1 text-xs whitespace-nowrap"
        >
          {/* Font Family */}
          <select
            value={element.fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value as FontChoice })}
            className="bg-transparent border-none text-slate-700 dark:text-slate-200 font-medium py-0.5 px-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          >
            <option value="Helvetica">Helvetica</option>
            <option value="TimesRoman">Times</option>
            <option value="Courier">Courier</option>
          </select>

          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Font Size */}
          <select
            value={element.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="bg-transparent border-none text-slate-700 dark:text-slate-200 font-medium py-0.5 px-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}pt
              </option>
            ))}
          </select>

          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Bold */}
          <button
            type="button"
            onClick={() => onChange({ bold: !element.bold })}
            className={`p-1 rounded transition-colors ${
              element.bold ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => onChange({ italic: !element.italic })}
            className={`p-1 rounded transition-colors ${
              element.italic ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Color palette */}
          <div className="flex items-center gap-1">
            {TEXT_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => onChange({ color: col })}
                className={`w-3.5 h-3.5 rounded-full border ${
                  element.color === col ? 'ring-2 ring-indigo-500 scale-110' : 'border-slate-300 dark:border-slate-600'
                }`}
                style={{ backgroundColor: col }}
              />
            ))}
          </div>

          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Duplicate */}
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Content Area */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={element.text}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange({ text: e.target.value })}
          onBlur={() => setIsEditing(false)}
          className="w-full h-full p-1 resize-none bg-white/95 dark:bg-slate-900/95 border border-indigo-400 rounded outline-none text-slate-900 dark:text-white"
          style={{
            fontSize: `${element.fontSize * scale}px`,
            fontFamily: getFontFamilyStyle(element.fontFamily),
            fontWeight: element.bold ? 'bold' : 'normal',
            fontStyle: element.italic ? 'italic' : 'normal',
            color: element.color,
          }}
        />
      ) : (
        <div
          className="w-full h-full p-1 overflow-hidden whitespace-pre-wrap break-words leading-tight"
          style={{
            fontSize: `${element.fontSize * scale}px`,
            fontFamily: getFontFamilyStyle(element.fontFamily),
            fontWeight: element.bold ? 'bold' : 'normal',
            fontStyle: element.italic ? 'italic' : 'normal',
            color: element.color,
          }}
        >
          {element.text || <span className="opacity-40 italic">Click to edit text</span>}
        </div>
      )}

      {/* Resize Handle */}
      {isSelected && (
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white dark:border-slate-900 rounded-full cursor-nwse-resize shadow"
        />
      )}
    </div>
  );
}
