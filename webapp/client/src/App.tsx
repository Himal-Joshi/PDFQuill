import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileImage,
  FileText,
  Hash,
  Layers,
  Loader2,
  Merge,
  Minimize2,
  RotateCw,
  Scissors,
  Trash2,
  Type,
  Upload,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type Tool = 'merge' | 'split' | 'compress' | 'rotate' | 'watermark' | 'page-numbers' | 'organize' | 'convert';

type ToolConfig = {
  id: Tool;
  label: string;
  description: string;
  endpoint: string;
  icon: string; // Used material symbol name
  lucideIcon: LucideIcon;
  acceptsImages?: boolean;
  multiple?: boolean;
};

const tools: ToolConfig[] = [
  {
    id: 'merge',
    label: 'Merge PDF',
    description: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    endpoint: '/api/merge',
    icon: 'merge',
    lucideIcon: Merge,
    multiple: true,
  },
  {
    id: 'split',
    label: 'Split PDF',
    description: 'Separate one page or a whole set for easy conversion into independent PDF files.',
    endpoint: '/api/split',
    icon: 'call_split',
    lucideIcon: Scissors,
  },
  {
    id: 'compress',
    label: 'Compress PDF',
    description: 'Reduce file size while optimizing for maximal PDF quality.',
    endpoint: '/api/compress',
    icon: 'compress',
    lucideIcon: Minimize2,
  },
  {
    id: 'convert',
    label: 'Images to PDF',
    description: 'Turn PNG or JPG images into one PDF.',
    endpoint: '/api/convert',
    icon: 'image',
    lucideIcon: FileImage,
    acceptsImages: true,
    multiple: true,
  },
  {
    id: 'rotate',
    label: 'Rotate PDF',
    description: 'Rotate all pages clockwise by a fixed angle.',
    endpoint: '/api/rotate',
    icon: 'rotate_right',
    lucideIcon: RotateCw,
  },
  {
    id: 'watermark',
    label: 'Watermark PDF',
    description: 'Add a text or image watermark to each page.',
    endpoint: '/api/watermark',
    icon: 'text_fields',
    lucideIcon: Type,
  },
  {
    id: 'page-numbers',
    label: 'Page Numbers',
    description: 'Place simple page numbers at the bottom center.',
    endpoint: '/api/page-numbers',
    icon: 'pin',
    lucideIcon: Hash,
  },
  {
    id: 'organize',
    label: 'Organize Pages',
    description: 'Reorder pages or remove selected pages.',
    endpoint: '/api/organize',
    icon: 'view_list',
    lucideIcon: Layers,
  },
];

function App() {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);

  // Workspace States
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState('');
  const [splitMode, setSplitMode] = useState<'all' | 'range'>('all');
  const [pageRange, setPageRange] = useState('');
  const [rotation, setRotation] = useState(90);
  const [watermarkMode, setWatermarkMode] = useState<'text' | 'image'>('text');
  const [watermarkText, setWatermarkText] = useState('DRAFT');
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
  const [organizeAction, setOrganizeAction] = useState<'reorder' | 'delete'>('reorder');

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === activeTool) ?? tools[0],
    [activeTool],
  );

  const selectTool = (tool: Tool) => {
    setActiveTool(tool);
    setFiles([]);
    setDownloadUrl('');
    setError('');
    setWatermarkImage(null);
  };

  const goHome = () => {
    setActiveTool(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedTool.multiple ? [...files, ...selectedFiles] : selectedFiles.slice(0, 1));
    setDownloadUrl('');
    setError('');
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((currentFiles) => currentFiles.filter((_file, fileIndex) => fileIndex !== index));
  };

  const processFile = async () => {
    if (files.length === 0) return;
    if (activeTool === 'watermark' && watermarkMode === 'image' && !watermarkImage) {
      setError('Choose a watermark image first.');
      return;
    }

    const formData = new FormData();
    setLoading(true);
    setError('');
    setDownloadUrl('');

    try {
      if (activeTool === 'merge' || activeTool === 'convert') {
        files.forEach((file) => formData.append('files', file));
      } else {
        formData.append('file', files[0]);
      }

      if (activeTool === 'split') {
        formData.append('mode', splitMode);
        if (splitMode === 'range') formData.append('pages', pageRange);
      }
      if (activeTool === 'rotate') {
        formData.append('rotation', String(rotation));
      }
      if (activeTool === 'watermark') {
        if (watermarkMode === 'image' && watermarkImage) formData.append('image', watermarkImage);
        else formData.append('text', watermarkText);
      }
      if (activeTool === 'organize') {
        formData.append('action', organizeAction);
        formData.append('pages', pageRange);
      }
      if (activeTool === 'convert') {
        formData.append('to', 'pdf');
      }

      const response = await axios.post<{ downloadUrl: string }>(
        `${API_BASE}${selectedTool.endpoint}`,
        formData,
      );
      setDownloadUrl(`${API_BASE}${response.data.downloadUrl}`);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError)) {
        setError(requestError.response?.data?.error || requestError.message);
      } else if (requestError instanceof Error) {
        setError(requestError.message);
      } else {
        setError('Operation failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const needsPageRange = activeTool === 'organize' || (activeTool === 'split' && splitMode === 'range');
  const canProcess = files.length > 0 && !loading && (!needsPageRange || pageRange.trim().length > 0);

  return (
    <div className="font-body-md text-on-surface bg-background min-h-screen selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-surface border-b border-secondary-container shadow-sm">
        <div className="flex justify-between items-center h-16 px-gutter max-w-container-max mx-auto">
          <div className="flex items-center gap-base cursor-pointer select-none" onClick={goHome}>
            <span className="font-brand text-2xl font-black tracking-tight text-primary">
              PDF<span className="text-secondary font-semibold">quill</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-lg">
            <button onClick={goHome} className="font-body-md text-body-md text-primary font-semibold border-b-2 border-primary transition-colors duration-150">Tools</button>
            <a className="font-body-md text-body-md text-secondary hover:text-primary transition-colors duration-150" href="#">Pricing</a>
            <a className="font-body-md text-body-md text-secondary hover:text-primary transition-colors duration-150" href="#">Solutions</a>
          </div>
          <div className="flex items-center gap-sm">
            <button className="px-md py-xs font-label-md text-label-md text-secondary hover:text-primary active:scale-95 transition-all">Login</button>
            <button className="px-md py-xs bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container active:scale-95 transition-all shadow-sm">Sign Up</button>
          </div>
        </div>
      </nav>

      <main className="pt-16 pb-xl min-h-screen flex flex-col">
        {activeTool === null ? (
          // Landing View
          <div className="flex-1 flex flex-col">
            {/* Compact Hero */}
            <section className="relative overflow-hidden bg-surface pt-md pb-sm md:pt-lg md:pb-md">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[80px] pointer-events-none"></div>
              <div className="px-gutter max-w-container-max mx-auto text-center relative z-10">
                <h1 className="font-display-lg text-2xl md:text-4xl text-on-surface mb-xs md:mb-sm max-w-3xl mx-auto leading-tight font-bold">
                  Every tool you need to work with PDFs
                </h1>
                <p className="font-body-md text-sm md:text-base text-secondary max-w-xl mx-auto">
                  100% FREE — Merge, split, compress, convert, rotate and watermark PDFs with just a few clicks.
                </p>
              </div>
            </section>

            {/* Compact Rounded-Square Tool Grid */}
            <section className="flex-1 flex items-start justify-center py-sm md:py-md bg-background">
              <div className="px-gutter w-full max-w-[520px] md:max-w-container-max mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                  {tools.map((tool, i) => {
                    const gradients = [
                      'from-rose-500 to-red-600',
                      'from-amber-500 to-orange-600',
                      'from-emerald-500 to-teal-600',
                      'from-sky-500 to-blue-600',
                      'from-violet-500 to-purple-600',
                      'from-pink-500 to-fuchsia-600',
                      'from-cyan-500 to-teal-600',
                      'from-indigo-500 to-blue-600',
                    ];
                    return (
                      <div
                        key={tool.id}
                        onClick={() => selectTool(tool.id)}
                        className="group relative aspect-square rounded-2xl cursor-pointer overflow-hidden bg-surface-container-lowest border border-outline-variant/50 shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.97] transition-all duration-250"
                      >
                        {/* Gradient background on hover */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradients[i % gradients.length]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                        
                        {/* Content */}
                        <div className="relative z-10 h-full flex flex-col items-center justify-center p-3 text-center gap-2">
                          <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 group-hover:bg-white/20 flex items-center justify-center transition-colors duration-300">
                            <span className="material-symbols-outlined text-[28px] md:text-[32px] text-primary group-hover:text-white transition-colors duration-300">
                              {tool.icon}
                            </span>
                          </div>
                          <span className="font-headline-md text-xs md:text-sm font-semibold text-on-surface group-hover:text-white transition-colors duration-300 leading-tight">
                            {tool.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        ) : (
          // Workspace View
          <div className="flex-1 bg-background px-4 py-8">
            <div className="mx-auto max-w-4xl">
              <button 
                onClick={goHome}
                className="mb-6 flex items-center gap-2 text-secondary hover:text-primary transition-colors font-label-md"
              >
                <ArrowLeft size={18} /> Back to tools
              </button>
              
              <header className="mb-8 flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-3xl font-display-lg text-on-surface tracking-tight">{selectedTool.label}</h2>
                  <p className="mt-2 text-secondary font-body-lg">{selectedTool.description}</p>
                </div>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm border border-primary/20">
                  <span className="material-symbols-outlined text-[36px]">{selectedTool.icon}</span>
                </div>
              </header>

              <section className="grid gap-6">
                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    multiple={selectedTool.multiple}
                    accept={selectedTool.acceptsImages ? '.png,.jpg,.jpeg' : '.pdf'}
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="file-input"
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-12 text-center transition-all',
                      files.length > 0
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-outline-variant bg-surface hover:border-primary/50'
                    )}
                  >
                    <Upload size={40} className={files.length > 0 ? 'text-primary' : 'text-secondary'} />
                    <span className="mt-4 text-lg font-headline-md text-on-surface">
                      Select {selectedTool.acceptsImages ? 'images' : 'PDF files'}
                    </span>
                    <span className="mt-1 text-sm text-secondary">
                      {selectedTool.multiple ? 'Multiple files supported.' : 'One file for this operation.'}
                    </span>
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                        Selected files ({files.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setFiles([])}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-error hover:bg-error-container/50 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="grid gap-3">
                      {files.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary shadow-sm border border-outline-variant">
                              {file.type.startsWith('image/') ? <FileImage size={20} /> : <FileText size={20} />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-on-surface">{file.name}</p>
                              <p className="text-xs text-secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="rounded-lg p-2 text-secondary hover:bg-surface-container-highest hover:text-error transition-colors"
                            aria-label={`Remove ${file.name}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                  <ToolOptions
                    activeTool={activeTool}
                    splitMode={splitMode}
                    setSplitMode={setSplitMode}
                    pageRange={pageRange}
                    setPageRange={setPageRange}
                    rotation={rotation}
                    setRotation={setRotation}
                    watermarkMode={watermarkMode}
                    setWatermarkMode={setWatermarkMode}
                    watermarkText={watermarkText}
                    setWatermarkText={setWatermarkText}
                    setWatermarkImage={setWatermarkImage}
                    organizeAction={organizeAction}
                    setOrganizeAction={setOrganizeAction}
                  />

                  <button
                    type="button"
                    onClick={processFile}
                    disabled={!canProcess}
                    className={cn(
                      'mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-4 text-lg font-bold transition-all shadow-md',
                      canProcess
                        ? 'bg-primary text-on-primary hover:bg-primary-container hover:shadow-lg active:scale-[0.98]'
                        : 'cursor-not-allowed bg-surface-container-highest text-secondary shadow-none'
                    )}
                  >
                    {loading ? <Loader2 className="animate-spin" size={24} /> : <selectedTool.lucideIcon size={24} />}
                    {loading ? 'Processing...' : 'Process file'}
                  </button>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-3 rounded-xl border border-error bg-error-container/20 px-5 py-4 text-error"
                    >
                      <AlertCircle size={22} />
                      <p className="text-sm font-medium">{error}</p>
                    </motion.div>
                  )}

                  {downloadUrl && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex flex-col gap-4 rounded-xl border border-emerald-300 bg-emerald-50 px-6 py-6 text-emerald-950 sm:flex-row sm:items-center sm:justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <CheckCircle size={28} className="text-emerald-600" />
                        <div>
                          <h3 className="font-bold text-lg">Task Complete!</h3>
                          <p className="text-sm text-emerald-700 mt-1">Your processed file is ready for download.</p>
                        </div>
                      </div>
                      <a
                        href={downloadUrl}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <Download size={20} />
                        Download File
                      </a>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-lg bg-surface-container border-t border-secondary-container mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-md px-gutter max-w-container-max mx-auto">
          <div className="flex flex-col items-center md:items-start gap-xs">
            <span className="font-brand text-xl font-black tracking-tight text-primary select-none cursor-pointer" onClick={goHome}>
              PDF<span className="text-secondary font-semibold">quill</span>
            </span>
            <p className="font-label-sm text-label-sm text-secondary mt-1">© 2026 PDFquill Tool Suite. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-md">
            <a className="font-label-sm text-label-sm text-secondary hover:text-primary underline transition-all duration-200" href="#">Privacy Policy</a>
            <a className="font-label-sm text-label-sm text-secondary hover:text-primary underline transition-all duration-200" href="#">Terms of Service</a>
            <a className="font-label-sm text-label-sm text-secondary hover:text-primary underline transition-all duration-200" href="#">Help Center</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

type ToolOptionsProps = {
  activeTool: Tool | null;
  splitMode: 'all' | 'range';
  setSplitMode: (value: 'all' | 'range') => void;
  pageRange: string;
  setPageRange: (value: string) => void;
  rotation: number;
  setRotation: (value: number) => void;
  watermarkMode: 'text' | 'image';
  setWatermarkMode: (value: 'text' | 'image') => void;
  watermarkText: string;
  setWatermarkText: (value: string) => void;
  setWatermarkImage: (value: File | null) => void;
  organizeAction: 'reorder' | 'delete';
  setOrganizeAction: (value: 'reorder' | 'delete') => void;
};

function ToolOptions({
  activeTool,
  splitMode,
  setSplitMode,
  pageRange,
  setPageRange,
  rotation,
  setRotation,
  watermarkMode,
  setWatermarkMode,
  watermarkText,
  setWatermarkText,
  setWatermarkImage,
  organizeAction,
  setOrganizeAction,
}: ToolOptionsProps) {
  if (activeTool === 'split') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Split mode">
          <select
            value={splitMode}
            onChange={(event) => setSplitMode(event.target.value as 'all' | 'range')}
            className="input-control"
          >
            <option value="all">Every page</option>
            <option value="range">Specific range</option>
          </select>
        </Field>
        {splitMode === 'range' && (
          <Field label="Pages">
            <input
              value={pageRange}
              onChange={(event) => setPageRange(event.target.value)}
              className="input-control"
              placeholder="1-3,5"
            />
          </Field>
        )}
      </div>
    );
  }

  if (activeTool === 'rotate') {
    return (
      <Field label="Rotation">
        <div className="grid grid-cols-3 gap-3">
          {[90, 180, 270].map((angle) => (
            <button
              key={angle}
              type="button"
              onClick={() => setRotation(angle)}
              className={cn(
                'rounded-lg border px-4 py-3 text-sm font-semibold transition-colors',
                rotation === angle
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant bg-surface text-secondary hover:border-primary/50 hover:bg-primary/5'
              )}
            >
              {angle} deg
            </button>
          ))}
        </div>
      </Field>
    );
  }

  if (activeTool === 'watermark') {
    return (
      <div className="grid gap-5">
        <Field label="Watermark type">
          <div className="grid grid-cols-2 gap-3">
            {(['text', 'image'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWatermarkMode(mode)}
                className={cn(
                  'rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition-colors',
                  watermarkMode === mode
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant bg-surface text-secondary hover:border-primary/50 hover:bg-primary/5'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </Field>
        {watermarkMode === 'text' ? (
          <Field label="Watermark text">
            <input
              value={watermarkText}
              onChange={(event) => setWatermarkText(event.target.value)}
              className="input-control"
              placeholder="DRAFT"
            />
          </Field>
        ) : (
          <Field label="Watermark image">
            <input
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={(event) => setWatermarkImage(event.target.files?.[0] ?? null)}
              className="input-control"
            />
          </Field>
        )}
      </div>
    );
  }

  if (activeTool === 'organize') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Action">
          <select
            value={organizeAction}
            onChange={(event) => setOrganizeAction(event.target.value as 'reorder' | 'delete')}
            className="input-control"
          >
            <option value="reorder">Reorder pages</option>
            <option value="delete">Delete pages</option>
          </select>
        </Field>
        <Field label="Pages">
          <input
            value={pageRange}
            onChange={(event) => setPageRange(event.target.value)}
            className="input-control"
            placeholder={organizeAction === 'reorder' ? '3,1,2' : '2,4'}
          />
        </Field>
      </div>
    );
  }

  if (activeTool === 'convert') {
    return <p className="text-sm text-secondary font-label-md">PNG and JPG files will be placed into one PDF in the order selected.</p>;
  }

  if (activeTool === 'compress') {
    return <p className="text-sm text-secondary font-label-md">Optimization rewrites the PDF using compact object streams.</p>;
  }

  if (activeTool === null) return null;

  return <p className="text-sm text-secondary font-label-md">No extra options needed for this operation.</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-secondary">{label}</span>
      {children}
    </label>
  );
}

export default App;
