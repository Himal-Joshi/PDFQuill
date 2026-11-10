import { useRef, type PointerEvent } from 'react';
import { Trash2, Copy } from 'lucide-react';
import type { DrawingElement } from './types.ts';

interface DrawingElementOverlayProps {
  element: DrawingElement;
  isSelected: boolean;
  scale: number;
  onSelect: () => void;
  onChange: (updated: Partial<DrawingElement>, commitToHistory?: boolean) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function DrawingElementOverlay({
  element,
  isSelected,
  scale,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
}: DrawingElementOverlayProps) {
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; elemX: number; elemY: number }>({ x: 0, y: 0, elemX: 0, elemY: 0 });

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      elemX: element.x,
      elemY: element.y,
    };

    let latestX = element.x;
    let latestY = element.y;

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = (moveEvent.clientX - dragStartRef.current.x) / scale;
      const dy = (moveEvent.clientY - dragStartRef.current.y) / scale;
      latestX = Math.max(0, dragStartRef.current.elemX + dx);
      latestY = Math.max(0, dragStartRef.current.elemY + dy);
      onChange({ x: latestX, y: latestY }, false);
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onChange({ x: latestX, y: latestY }, true);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Build SVG path data relative to element.x and element.y
  const pathData = element.points.reduce((acc, pt, i) => {
    const rx = (pt.x - element.x) * scale;
    const ry = (pt.y - element.y) * scale;
    return `${acc} ${i === 0 ? 'M' : 'L'} ${rx} ${ry}`;
  }, '');

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`absolute select-none ${
        isSelected ? 'ring-2 ring-indigo-500 rounded bg-indigo-50/10' : 'hover:ring-1 hover:ring-indigo-300'
      }`}
      style={{
        left: `${element.x * scale}px`,
        top: `${element.y * scale}px`,
        width: `${element.width * scale}px`,
        height: `${element.height * scale}px`,
        cursor: 'move',
      }}
    >
      {/* Floating Toolbar when Selected */}
      {isSelected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-10 left-0 z-30 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg px-2 py-1 text-xs whitespace-nowrap"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {element.isHighlighter ? 'Highlighter' : 'Drawing'}
          </span>
          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
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

      {/* SVG Path */}
      <svg className="w-full h-full overflow-visible pointer-events-none">
        <path
          d={pathData}
          fill="none"
          stroke={element.color}
          strokeWidth={(element.strokeWidth || 3) * scale}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={element.isHighlighter ? 0.4 : (element.opacity ?? 1)}
        />
      </svg>
    </div>
  );
}
