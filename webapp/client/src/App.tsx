import { useMemo, useState, useEffect, type ChangeEvent, type ReactNode } from 'react';
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
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

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
    <div className="min-h-screen selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 glass">
        <div className="flex justify-between items-center h-20 px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 cursor-pointer select-none group" onClick={goHome}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
              <img src="/PDFQuill/logo.svg" alt="PDFQuill" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              <span className="dark:text-white">PDF</span><span className="text-primary">Quill</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button onClick={goHome} className={cn("text-sm font-semibold transition-colors duration-200", activeTool === null ? "text-primary" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100")}>Tools</button>
            <a className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200" href="#">Pricing</a>
            <a className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200" href="#">Solutions</a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="hidden sm:block btn btn-ghost">Login</button>
            <button className="btn btn-primary">Get Started</button>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-20 flex-1">
        {activeTool === null ? (
          // Landing View
          <div className="flex flex-col">
            {/* Hero Section */}
            <section className="relative pt-20 pb-16 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/10 blur-[120px] rounded-full -z-10 animate-pulse"></div>
              <div className="px-6 max-w-7xl mx-auto text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider uppercase mb-6 border border-primary/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    The Ultimate PDF Toolkit
                  </span>
                  <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight leading-[1.1]">
                    Professional PDF tools, <br className="hidden sm:block" />
                    <span className="text-primary">beautifully simplified.</span>
                  </h1>
                  <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                    Merge, split, compress, and convert your documents with a premium toolkit designed for modern workflows. Fast, private, and 100% free.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button className="btn btn-primary px-8 py-4 text-base w-full sm:w-auto">
                      Explore All Tools
                    </button>
                    <button className="btn btn-secondary px-8 py-4 text-base w-full sm:w-auto">
                      View Documentation
                    </button>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* Tool Grid */}
            <section className="py-12 px-6 max-w-7xl mx-auto w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {tools.map((tool, i) => (
                  <motion.div
                    key={tool.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    onClick={() => selectTool(tool.id)}
                    className="group card cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[100px] -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>

                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm">
                        <tool.lucideIcon size={28} strokeWidth={1.5} />
                      </div>
                      <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors">
                        {tool.label}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {tool.description}
                      </p>

                      <div className="mt-8 flex items-center text-xs font-bold text-primary opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                        TRY IT NOW <ArrowLeft className="ml-2 rotate-180" size={14} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          // Workspace View
          <div className="px-6 py-12">
            <div className="mx-auto max-w-4xl">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={goHome}
                className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors font-semibold text-sm"
              >
                <ArrowLeft size={16} /> Back to all tools
              </motion.button>
              
              <motion.header
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h2 className="text-4xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">{selectedTool.label}</h2>
                  <p className="mt-3 text-lg text-slate-600 dark:text-slate-400 max-w-xl">{selectedTool.description}</p>
                </div>
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner border border-primary/20">
                  <selectedTool.lucideIcon size={40} strokeWidth={1.5} />
                </div>
              </motion.header>

              <section className="grid gap-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="card p-8 group relative"
                >
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
                      'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-all duration-300',
                      files.length > 0
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-primary/50 group-hover:bg-white dark:group-hover:bg-slate-900 shadow-inner'
                    )}
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-all duration-300",
                      files.length > 0 ? "bg-primary text-white scale-110" : "bg-white dark:bg-slate-800 text-slate-400 group-hover:text-primary group-hover:scale-110 shadow-sm"
                    )}>
                      <Upload size={32} />
                    </div>
                    <span className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      {files.length > 0 ? `${files.length} files selected` : `Drop your ${selectedTool.acceptsImages ? 'images' : 'PDFs'} here`}
                    </span>
                    <p className="text-slate-500 dark:text-slate-400 max-w-xs">
                      {selectedTool.multiple ? 'Click to browse or drag and drop multiple files' : 'Select a single file to begin processing'}
                    </p>
                  </label>
                </motion.div>

                {files.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-6"
                  >
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Queue ({files.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setFiles([])}
                        className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                      >
                        REMOVE ALL
                      </button>
                    </div>
                    <div className="grid gap-3">
                      {files.map((file, index) => (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-3 group/item"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-100 dark:border-slate-700">
                              {file.type.startsWith('image/') ? <FileImage size={20} /> : <FileText size={20} />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{file.name}</p>
                              <p className="text-xs font-medium text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all opacity-0 group-item-hover:opacity-100"
                            aria-label={`Remove ${file.name}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="card p-8"
                >
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
                      'btn btn-primary mt-8 w-full py-4 text-lg shadow-xl shadow-primary/20',
                      !canProcess && 'opacity-50 grayscale cursor-not-allowed'
                    )}
                  >
                    {loading ? <Loader2 className="animate-spin mr-2" size={24} /> : <selectedTool.lucideIcon className="mr-2" size={24} />}
                    {loading ? 'Processing...' : `Start ${selectedTool.label}`}
                  </button>
                </motion.div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-6 py-4 text-red-600 dark:text-red-400 shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                        <AlertCircle size={20} />
                      </div>
                      <p className="text-sm font-bold">{error}</p>
                    </motion.div>
                  )}

                  {downloadUrl && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col gap-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 px-8 py-8 text-emerald-900 dark:text-emerald-100 sm:flex-row sm:items-center sm:justify-between shadow-xl shadow-emerald-500/10"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle size={32} />
                        </div>
                        <div>
                          <h3 className="font-display text-2xl font-extrabold tracking-tight">Ready to Download</h3>
                          <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-1">Your file was processed successfully.</p>
                        </div>
                      </div>
                      <a
                        href={downloadUrl}
                        className="btn bg-emerald-600 text-white hover:bg-emerald-700 px-8 py-4 text-lg shadow-lg shadow-emerald-600/20"
                      >
                        <Download size={20} className="mr-2" />
                        Download PDF
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
      <footer className="w-full py-12 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 px-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2 select-none cursor-pointer group" onClick={goHome}>
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                <img src="/PDFQuill/logo.svg" alt="" className="w-5 h-5" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                <span className="dark:text-white">PDF</span><span className="text-primary">Quill</span>
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">© 2026 PDFQuill Toolkit. Built for security & speed.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            <a className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest" href="#">Privacy</a>
            <a className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest" href="#">Terms</a>
            <a className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest" href="#">Github</a>
            <a className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest" href="#">Contact</a>
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
      <div className="grid gap-6 sm:grid-cols-2">
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
          <Field label="Pages to Extract">
            <input
              value={pageRange}
              onChange={(event) => setPageRange(event.target.value)}
              className="input-control"
              placeholder="e.g. 1-3, 5, 8-10"
            />
          </Field>
        )}
      </div>
    );
  }

  if (activeTool === 'rotate') {
    return (
      <Field label="Rotation Angle">
        <div className="grid grid-cols-3 gap-4">
          {[90, 180, 270].map((angle) => (
            <button
              key={angle}
              type="button"
              onClick={() => setRotation(angle)}
              className={cn(
                'rounded-xl border-2 py-4 text-sm font-bold transition-all duration-200',
                rotation === angle
                  ? 'border-primary bg-primary/5 text-primary shadow-inner'
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-primary/30'
              )}
            >
              {angle}°
            </button>
          ))}
        </div>
      </Field>
    );
  }

  if (activeTool === 'watermark') {
    return (
      <div className="grid gap-8">
        <Field label="Watermark type">
          <div className="grid grid-cols-2 gap-4">
            {(['text', 'image'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWatermarkMode(mode)}
                className={cn(
                  'rounded-xl border-2 py-4 text-sm font-bold capitalize transition-all duration-200',
                  watermarkMode === mode
                    ? 'border-primary bg-primary/5 text-primary shadow-inner'
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-primary/30'
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
              placeholder="Enter watermark text..."
            />
          </Field>
        ) : (
          <Field label="Watermark image">
            <input
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={(event) => setWatermarkImage(event.target.files?.[0] ?? null)}
              className="input-control file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
          </Field>
        )}
      </div>
    );
  }

  if (activeTool === 'organize') {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
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
        <Field label="Page Sequence">
          <input
            value={pageRange}
            onChange={(event) => setPageRange(event.target.value)}
            className="input-control"
            placeholder={organizeAction === 'reorder' ? 'e.g. 3,1,2' : 'e.g. 2,4'}
          />
        </Field>
      </div>
    );
  }

  if (activeTool === 'convert') {
    return <p className="text-sm font-medium text-slate-500 dark:text-slate-400">All selected images will be merged into a single professional PDF document in the specified order.</p>;
  }

  if (activeTool === 'compress') {
    return <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Our advanced compression algorithm will optimize your PDF for the web while maintaining high visual quality.</p>;
  }

  if (activeTool === null) return null;

  return <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No additional configuration required for this operation.</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-3">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default App;
