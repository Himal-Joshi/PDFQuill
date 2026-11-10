import { useRef, type PointerEvent } from 'react';
import { Trash2, Copy } from 'lucide-react';
import type { ShapeElement } from './types.ts';

interface ShapeElementOverlayProps {
  element: ShapeElement;
  isSelected: boolean;
  scale: number;
  onSelect: () => void;
  onChange: (updated: Partial<ShapeElement>, commitToHistory?: boolean) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const FILL_COLORS = ['transparent', '#ffffff', '#fef08a', '#dbeafe', '#f1f5f9', '#0f172a'];
const STROKE_COLORS = ['transparent', '#0f172a', '#dc2626', '#1d4ed8', '#16a34a'];

export function ShapeElementOverlay({
  element,
  isSelected,
  scale,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
}: ShapeElementOverlayProps) {
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; elemX: number; elemY: number }>({ x: 0, y: 0, elemX: 0, elemY: 0 });
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ x: number; y: number; elemW: number; elemH: number }>({ x: 0, y: 0, elemW: 0, elemH: 0 });

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

  const handleResizePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      elemW: element.width,
      elemH: element.height,
    };

    let latestW = element.width;
    let latestH = element.height;

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (!isResizingRef.current) return;
      const dx = (moveEvent.clientX - resizeStartRef.current.x) / scale;
      const dy = (moveEvent.clientY - resizeStartRef.current.y) / scale;
      latestW = Math.max(16, resizeStartRef.current.elemW + dx);
      latestH = Math.max(16, resizeStartRef.current.elemH + dy);
      onChange({ width: latestW, height: latestH }, false);
    };

    const handlePointerUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        onChange({ width: latestW, height: latestH }, true);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`absolute group select-none ${
        isSelected
          ? 'ring-2 ring-indigo-500 rounded'
          : 'hover:ring-1 hover:ring-indigo-300'
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
          className="absolute -top-11 left-0 z-30 flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg px-2.5 py-1 text-xs whitespace-nowrap"
        >
          {/* Fill swatch */}
          <span className="text-[10px] uppercase font-bold text-slate-400">Fill:</span>
          <div className="flex items-center gap-1">
            {FILL_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => onChange({ fillColor: col }, true)}
                className={`w-3.5 h-3.5 rounded-sm border ${
                  col === 'transparent'
                    ? 'border-dashed border-slate-400 bg-transparent'
                    : 'border-slate-300'
                } ${element.fillColor === col ? 'ring-2 ring-indigo-500 scale-110' : ''}`}
                style={{ backgroundColor: col === 'transparent' ? undefined : col }}
                title={col === '#ffffff' ? 'Whiteout' : col}
              />
            ))}
          </div>

          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Stroke swatch */}
          <span className="text-[10px] uppercase font-bold text-slate-400">Border:</span>
          <div className="flex items-center gap-1">
            {STROKE_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => onChange({ strokeColor: col, strokeWidth: col === 'transparent' ? 0 : Math.max(1, element.strokeWidth) }, true)}
                className={`w-3.5 h-3.5 rounded-sm border ${
                  col === 'transparent'
                    ? 'border-dashed border-slate-400 bg-transparent'
                    : 'border-slate-300'
                } ${element.strokeColor === col ? 'ring-2 ring-indigo-500 scale-110' : ''}`}
                style={{ backgroundColor: col === 'transparent' ? undefined : col }}
                title={col}
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

      {/* SVG Shape View */}
      <svg className="w-full h-full overflow-visible pointer-events-none">
        {element.shapeType === 'rectangle' && (
          <rect
            x={0}
            y={0}
            width={element.width * scale}
            height={element.height * scale}
            fill={element.fillColor === 'transparent' ? 'none' : element.fillColor}
            stroke={element.strokeColor === 'transparent' ? 'none' : element.strokeColor}
            strokeWidth={(element.strokeWidth || 1) * scale}
            opacity={element.opacity ?? 1}
          />
        )}
        {element.shapeType === 'circle' && (
          <ellipse
            cx={(element.width * scale) / 2}
            cy={(element.height * scale) / 2}
            rx={(element.width * scale) / 2}
            ry={(element.height * scale) / 2}
            fill={element.fillColor === 'transparent' ? 'none' : element.fillColor}
            stroke={element.strokeColor === 'transparent' ? 'none' : element.strokeColor}
            strokeWidth={(element.strokeWidth || 1) * scale}
            opacity={element.opacity ?? 1}
          />
        )}
        {element.shapeType === 'line' && (
          <line
            x1={0}
            y1={0}
            x2={element.width * scale}
            y2={element.height * scale}
            stroke={element.strokeColor === 'transparent' ? '#000000' : element.strokeColor}
            strokeWidth={(element.strokeWidth || 2) * scale}
            opacity={element.opacity ?? 1}
          />
        )}
      </svg>

      {/* Resize Handle */}
      {isSelected && (
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white dark:border-slate-900 rounded-full cursor-nwse-resize shadow"
          title="Drag to resize"
        />
      )}
    </div>
  );
}
