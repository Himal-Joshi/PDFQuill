import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import type { PageThumbnail } from '../../lib/pdfThumbnails.ts';
import type { EditorElement } from './types.ts';

interface EditorSidebarProps {
  numPages: number;
  currentPage: number; // 0-based
  onSelectPage: (pageIndex: number) => void;
  elements: EditorElement[];
  thumbnails: PageThumbnail[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function EditorSidebar({
  numPages,
  currentPage,
  onSelectPage,
  elements,
  thumbnails,
  isCollapsed,
  onToggleCollapse,
}: EditorSidebarProps) {
  return (
    <aside
      className={`relative flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 z-20 ${
        isCollapsed ? 'w-12' : 'w-56'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-slate-800">
        {!isCollapsed && (
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-wider uppercase flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Pages ({numPages})
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mx-auto"
          title={isCollapsed ? 'Expand Page Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3 custom-scrollbar">
        {Array.from({ length: numPages }).map((_, idx) => {
          const isCurrent = idx === currentPage;
          const thumb = thumbnails.find((t) => t.pageNumber === idx + 1);
          const pageElemCount = elements.filter((el) => el.pageIndex === idx).length;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPage(idx)}
              className={`w-full group flex flex-col items-center rounded-xl p-1.5 transition-all text-left ${
                isCurrent
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-indigo-600 shadow-sm'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {/* Thumbnail Container */}
              <div className="relative w-full aspect-[1/1.35] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
                {thumb ? (
                  <img
                    src={thumb.dataUrl}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <FileText className="w-6 h-6 opacity-40" />
                    {!isCollapsed && <span className="text-[10px] mt-1">Loading...</span>}
                  </div>
                )}

                {/* Annotation Count Badge */}
                {pageElemCount > 0 && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-bold shadow-xs">
                    {pageElemCount}
                  </div>
                )}
              </div>

              {/* Page Number Label */}
              <span
                className={`text-[11px] font-semibold mt-1.5 ${
                  isCurrent
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700'
                }`}
              >
                {isCollapsed ? `${idx + 1}` : `Page ${idx + 1}`}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
