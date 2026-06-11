import { useMemo, useState, useEffect, useCallback, type ChangeEvent, type ReactNode } from 'react';
// axios removed
import {
  AlertCircle,
  CheckCircle,
  ChevronUp,
  ChevronDown,
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
import { mergePdfs, splitPdf, compressPdf, rotatePdf, watermarkPdf, addPageNumbers, organizePdf, imagesToPdf } from './lib/pdfProcessing';
import { validateEmailDomain, validatePassword, registerAccount, loginAccount } from './lib/auth';
import { generateThumbnails, type PageThumbnail } from './lib/pdfThumbnails';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '/PDFQuill' : '/PDFQuill');

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
  const getInitialState = () => {
    if (typeof window === 'undefined') return { view: 'main' as const, tool: null as Tool | null };
    const hash = window.location.hash.slice(1);
    if (!hash) return { view: 'main' as const, tool: null as Tool | null };
    if (hash.startsWith('tool/')) return { view: 'main' as const, tool: hash.split('/')[1] as Tool };
    return { view: hash as any, tool: null as Tool | null };
  };

  const [view, setView] = useState<'main' | 'pricing' | 'solutions' | 'privacy' | 'terms' | 'login' | 'docs' | 'get-started'>(getInitialState().view);
  const [activeTool, setActiveTool] = useState<Tool | null>(getInitialState().tool);

  useEffect(() => {
    const handleHashChange = () => {
      const state = getInitialState();
      setView(state.view);
      setActiveTool(state.tool);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [user, setUser] = useState<{ email: string; token: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user');
      if (saved) return JSON.parse(saved);
    }
    return null;
  });

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };
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

  // Thumbnail state
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === activeTool) ?? tools[0],
    [activeTool],
  );

  const selectTool = (tool: Tool) => {
    window.location.hash = `tool/${tool}`;
    setFiles([]);
    setDownloadUrl('');
    setError('');
    setWatermarkImage(null);
    setThumbnails([]);
  };

  const goHome = () => {
    window.location.hash = '';
  };

  // Generate thumbnails when files change (for single-file PDF tools)
  useEffect(() => {
    if (files.length === 0 || activeTool === 'convert') {
      setThumbnails([]);
      return;
    }
    // For merge, don't auto-generate thumbnails (multiple files)
    // For single-file tools, generate thumbnails of the first file
    if (activeTool !== 'merge' && files.length >= 1 && files[0].type === 'application/pdf') {
      setLoadingThumbnails(true);
      generateThumbnails(files[0], 180)
        .then((t) => setThumbnails(t))
        .catch(() => setThumbnails([]))
        .finally(() => setLoadingThumbnails(false));
    } else {
      setThumbnails([]);
    }
  }, [files, activeTool]);

  // Reorder helpers for merge
  const moveFileUp = useCallback((index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveFileDown = useCallback((index: number) => {
    setFiles((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

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

    setLoading(true);
    setError('');
    setDownloadUrl('');

    try {
      let resultUrl = '';
      if (activeTool === 'merge') {
        resultUrl = await mergePdfs(files);
      } else if (activeTool === 'split') {
        resultUrl = await splitPdf(files[0], splitMode, pageRange);
      } else if (activeTool === 'compress') {
        resultUrl = await compressPdf(files[0]);
      } else if (activeTool === 'rotate') {
        resultUrl = await rotatePdf(files[0], rotation);
      } else if (activeTool === 'watermark') {
        resultUrl = await watermarkPdf(files[0], watermarkMode, watermarkText, watermarkImage);
      } else if (activeTool === 'page-numbers') {
        resultUrl = await addPageNumbers(files[0]);
      } else if (activeTool === 'organize') {
        resultUrl = await organizePdf(files[0], organizeAction, pageRange);
      } else if (activeTool === 'convert') {
        resultUrl = await imagesToPdf(files);
      }
      setDownloadUrl(resultUrl);
    } catch (requestError: unknown) {
      if (requestError instanceof Error) {
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
            <button onClick={goHome} className={cn("text-sm font-semibold transition-colors duration-200", (activeTool === null && view === 'main') ? "text-primary" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100")}>Tools</button>
            <button onClick={() => window.location.hash = 'pricing'} className={cn("text-sm font-semibold transition-colors duration-200", view === 'pricing' ? "text-primary" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100")}>Pricing</button>
            <button onClick={() => window.location.hash = 'solutions'} className={cn("text-sm font-semibold transition-colors duration-200", view === 'solutions' ? "text-primary" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100")}>Solutions</button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 hidden sm:block">{user.email}</span>
                <button onClick={logout} className="btn btn-ghost">Logout</button>
              </div>
            ) : (
              <>
                <button onClick={() => window.location.hash = 'login'} className="hidden sm:block btn btn-ghost">Login</button>
                <button onClick={() => window.location.hash = 'get-started'} className="btn btn-primary">Get Started</button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-20 flex-1">
        {view !== 'main' ? (
          <div className="px-6 py-20 max-w-4xl mx-auto">
            {view === 'pricing' && <PricingView />}
            {view === 'solutions' && <SolutionsView />}
            {view === 'privacy' && <PrivacyView />}
            {view === 'terms' && <TermsView />}
            {view === 'login' && <LoginView onLogin={(u) => { setUser(u); window.location.hash = ''; localStorage.setItem('user', JSON.stringify(u)); }} />}
            {view === 'docs' && <DocsView />}
            {view === 'get-started' && <GetStartedView />}
            <button onClick={goHome} className="mt-12 btn btn-secondary">Back to Home</button>
          </div>
        ) : activeTool === null ? (
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
                    <button onClick={() => window.location.hash = 'solutions'} className="btn btn-primary px-8 py-4 text-base w-full sm:w-auto">
                      Explore All Tools
                    </button>
                    <button onClick={() => window.location.hash = 'docs'} className="btn btn-secondary px-8 py-4 text-base w-full sm:w-auto">
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
                        {activeTool === 'merge' ? `Merge Order (${files.length} files)` : `Queue (${files.length})`}
                      </h3>
                      <button
                        type="button"
                        onClick={() => { setFiles([]); setThumbnails([]); }}
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
                            {/* Order badge for merge */}
                            {activeTool === 'merge' && (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-black">
                                {index + 1}
                              </div>
                            )}
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-100 dark:border-slate-700">
                              {file.type.startsWith('image/') ? <FileImage size={20} /> : <FileText size={20} />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{file.name}</p>
                              <p className="text-xs font-medium text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Reorder controls for merge */}
                            {activeTool === 'merge' && files.length > 1 && (
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => moveFileUp(index)}
                                  disabled={index === 0}
                                  className={cn(
                                    "rounded p-1 transition-all",
                                    index === 0
                                      ? "text-slate-200 dark:text-slate-700 cursor-not-allowed"
                                      : "text-slate-400 hover:bg-primary/10 hover:text-primary"
                                  )}
                                  aria-label="Move up"
                                >
                                  <ChevronUp size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveFileDown(index)}
                                  disabled={index === files.length - 1}
                                  className={cn(
                                    "rounded p-1 transition-all",
                                    index === files.length - 1
                                      ? "text-slate-200 dark:text-slate-700 cursor-not-allowed"
                                      : "text-slate-400 hover:bg-primary/10 hover:text-primary"
                                  )}
                                  aria-label="Move down"
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all"
                              aria-label={`Remove ${file.name}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Page Thumbnails Grid */}
                {files.length > 0 && activeTool !== 'merge' && activeTool !== 'convert' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="card p-6"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">
                      Page Preview
                    </h3>
                    {loadingThumbnails ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Rendering pages…</p>
                      </div>
                    ) : thumbnails.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {thumbnails.map((thumb) => (
                          <div
                            key={thumb.pageNumber}
                            className="group/thumb flex flex-col items-center gap-2"
                          >
                            <div className="relative rounded-xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200">
                              <img
                                src={thumb.dataUrl}
                                alt={`Page ${thumb.pageNumber}`}
                                className="w-full h-auto block"
                                loading="lazy"
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover/thumb:text-primary transition-colors">
                              {thumb.pageNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No pages to preview.</p>
                    )}
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
                        download={`PDFQuill${activeTool}${activeTool === 'split' && splitMode === 'all' ? '.zip' : '.pdf'}`}
                        className="btn bg-emerald-600 text-white hover:bg-emerald-700 px-8 py-4 text-lg shadow-lg shadow-emerald-600/20"
                      >
                        <Download size={20} className="mr-2" />
                        Download
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
            <p className="text-xs font-medium text-slate-500">© {new Date().getFullYear()} PDFQuill Toolkit. Built for security & speed.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            <button onClick={() => window.location.hash = 'privacy'} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">Privacy</button>
            <button onClick={() => window.location.hash = 'terms'} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">Terms</button>
            <a className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest" href="https://github.com/Himal-Joshi/PDFQuill" target="_blank" rel="noopener noreferrer">Github</a>
            <a className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest" href="mailto:hello@pdfquill.com">Contact</a>
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

function PricingView() {
  const plans = [
    { name: 'Basic', price: 'Free', features: ['All PDF tools', 'Unlimited files', '100% Secure', 'Ad-free'] },
    { name: 'Pro', price: '$9/mo', features: ['Everything in Basic', 'API Access', 'Priority Support', 'Custom Branding'] },
    { name: 'Enterprise', price: 'Custom', features: ['Everything in Pro', 'SSO & SAML', 'Dedicated Infrastructure', 'SLA Guarantees'] },
  ];

  return (
    <div>
      <h2 className="text-4xl font-display font-extrabold mb-12 text-slate-900 dark:text-white">Simple, transparent pricing.</h2>
      <div className="grid sm:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div key={plan.name} className="card p-8 flex flex-col">
            <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{plan.name}</h3>
            <div className="text-3xl font-extrabold text-primary mb-6">{plan.price}</div>
            <ul className="space-y-4 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-500" /> {f}
                </li>
              ))}
            </ul>
            <button className={cn("btn w-full py-3", plan.name === 'Pro' ? "btn-primary" : "btn-secondary")}>Choose {plan.name}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SolutionsView() {
  const solutions = [
    { title: 'For Developers', desc: 'Integrate PDF processing into your apps with our robust and fast API.' },
    { title: 'For Businesses', desc: 'Automate your document workflows and improve team productivity.' },
    { title: 'For Education', desc: 'Secure and easy-to-use tools for students and faculty members.' },
  ];

  return (
    <div>
      <h2 className="text-4xl font-display font-extrabold mb-12 text-slate-900 dark:text-white">Solutions for every workflow.</h2>
      <div className="grid gap-8">
        {solutions.map((s) => (
          <div key={s.title} className="card p-8">
            <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">{s.title}</h3>
            <p className="text-lg text-slate-600 dark:text-slate-400">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrivacyView() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h2 className="text-4xl font-display font-extrabold mb-8 text-slate-900 dark:text-white">Privacy Policy</h2>
      <p className="text-slate-600 dark:text-slate-400">At PDFQuill, we take your privacy seriously. All file processing is done securely, and files are automatically deleted from our servers after processing.</p>
      <h3 className="text-2xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">1. Data Collection</h3>
      <p className="text-slate-600 dark:text-slate-400">We do not store your PDF files or any data extracted from them. Files are processed in a temporary environment and purged immediately.</p>
      <h3 className="text-2xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">2. Cookies</h3>
      <p className="text-slate-600 dark:text-slate-400">We use local storage to save your theme preference (light/dark mode). No tracking cookies are used.</p>
    </div>
  );
}

function TermsView() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h2 className="text-4xl font-display font-extrabold mb-8 text-slate-900 dark:text-white">Terms of Service</h2>
      <p className="text-slate-600 dark:text-slate-400">By using PDFQuill, you agree to the following terms:</p>
      <h3 className="text-2xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">1. Use of Service</h3>
      <p className="text-slate-600 dark:text-slate-400">PDFQuill is provided "as is" without warranty of any kind. We are not responsible for any data loss or issues arising from the use of our tools.</p>
      <h3 className="text-2xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">2. Prohibited Uses</h3>
      <p className="text-slate-600 dark:text-slate-400">You may not use this service for any illegal activities or to process malicious content.</p>
    </div>
  );
}

function LoginView({ onLogin }: { onLogin: (user: { email: string; token: string }) => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Real-time password validation (only shown during registration)
  const pwValidation = useMemo(() => validatePassword(password), [password]);
  const emailDomainCheck = useMemo(() => {
    if (!email || !email.includes('@')) return null;
    return validateEmailDomain(email);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (isRegistering) {
      // Confirm password check
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setError('');
    setIsLoading(true);

    try {
      // Small delay for perceived UX
      await new Promise((resolve) => setTimeout(resolve, 400));

      if (isRegistering) {
        const result = await registerAccount(email, password);
        if (!result.success) {
          setError(result.error ?? 'Registration failed.');
          setIsLoading(false);
          return;
        }
        onLogin({ email: result.email!, token: result.token! });
      } else {
        const result = await loginAccount(email, password);
        if (!result.success) {
          setError(result.error ?? 'Login failed.');
          setIsLoading(false);
          return;
        }
        onLogin({ email: result.email!, token: result.token! });
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const pwRequirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password) },
  ];

  const strengthPercent = password.length === 0 ? 0 : (pwRequirements.filter((r) => r.met).length / pwRequirements.length) * 100;
  const strengthColor = strengthPercent <= 25 ? 'bg-red-500' : strengthPercent <= 50 ? 'bg-orange-500' : strengthPercent <= 75 ? 'bg-yellow-500' : 'bg-emerald-500';
  const strengthLabel = strengthPercent <= 25 ? 'Weak' : strengthPercent <= 50 ? 'Fair' : strengthPercent <= 75 ? 'Good' : 'Strong';

  return (
    <div className="max-w-md mx-auto">
      <div className="card p-10 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-white/20 dark:border-slate-800/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-[100px] -mr-16 -mt-16 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-tr-[100px] -ml-12 -mb-12 blur-xl"></div>
        
        <div className="relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              {isRegistering 
                ? 'Join thousands of users using PDFQuill'
                : 'Sign in to sync your preferences and history'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className={cn(
                  "input-control w-full bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm",
                  isRegistering && emailDomainCheck && !emailDomainCheck.valid && "border-red-400 dark:border-red-500 focus:ring-red-400"
                )}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
              {isRegistering && emailDomainCheck && !emailDomainCheck.valid && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-xs text-red-500 dark:text-red-400 font-medium"
                >
                  {emailDomainCheck.error}
                </motion.p>
              )}
              {isRegistering && emailDomainCheck && emailDomainCheck.valid && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 font-medium flex items-center gap-1"
                >
                  <CheckCircle size={12} /> Email domain accepted
                </motion.p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="input-control w-full bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-xs font-bold uppercase tracking-wider"
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {/* Password strength meter — only during registration */}
              {isRegistering && password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 space-y-3"
                >
                  {/* Strength bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full transition-colors duration-300", strengthColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${strengthPercent}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider min-w-[50px] text-right",
                      strengthPercent <= 25 ? 'text-red-500' : strengthPercent <= 50 ? 'text-orange-500' : strengthPercent <= 75 ? 'text-yellow-500' : 'text-emerald-500'
                    )}>
                      {strengthLabel}
                    </span>
                  </div>

                  {/* Requirements checklist */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {pwRequirements.map((req) => (
                      <div key={req.label} className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                          req.met 
                            ? "bg-emerald-500 text-white scale-100" 
                            : "bg-slate-200 dark:bg-slate-700 scale-90"
                        )}>
                          {req.met && (
                            <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={cn(
                          "text-xs font-medium transition-colors",
                          req.met ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                        )}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Confirm Password — only during registration */}
            {isRegistering && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  className={cn(
                    "input-control w-full bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm",
                    confirmPassword.length > 0 && password !== confirmPassword && "border-red-400 dark:border-red-500"
                  )}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 text-xs text-red-500 dark:text-red-400 font-medium"
                  >
                    Passwords do not match
                  </motion.p>
                )}
                {confirmPassword.length > 0 && password === confirmPassword && password.length > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 font-medium flex items-center gap-1"
                  >
                    <CheckCircle size={12} /> Passwords match
                  </motion.p>
                )}
              </motion.div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading || (isRegistering && (!pwValidation.valid || (emailDomainCheck !== null && !emailDomainCheck.valid) || password !== confirmPassword))}
              className={cn(
                "btn btn-primary w-full py-4 text-base shadow-xl shadow-primary/20",
                (isLoading || (isRegistering && !pwValidation.valid)) && "opacity-60 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="animate-spin mx-auto" size={20} />
              ) : (
                isRegistering ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 dark:border-slate-800/50 pt-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              {isRegistering ? "Already have an account?" : "Don't have an account?"}
              <button
                type="button"
                onClick={() => { setIsRegistering(!isRegistering); setError(''); setConfirmPassword(''); }}
                className="ml-2 text-primary hover:text-primary/80 font-bold transition-colors"
              >
                {isRegistering ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocsView() {
  const sections = [
    { title: 'Getting Started', topics: ['Quick Start Guide', 'System Requirements', 'Core Features Overview'] },
    { title: 'PDF Tools', topics: ['Merging Documents', 'Splitting & Extracting', 'Compression Techniques', 'Security & Protection'] },
    { title: 'API Reference', topics: ['Authentication', 'Endpoint Usage', 'Rate Limits', 'SDKs & Libraries'] },
  ];

  return (
    <div>
      <h2 className="text-4xl font-display font-extrabold mb-12 text-slate-900 dark:text-white">Documentation</h2>
      <div className="grid gap-12">
        {sections.map((s) => (
          <div key={s.title}>
            <h3 className="text-xl font-bold text-primary uppercase tracking-widest mb-6">{s.title}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {s.topics.map((t) => (
                <div key={t} className="card p-4 hover:border-primary/50 transition-colors cursor-pointer group">
                  <span className="font-bold text-slate-900 dark:text-white group-hover:text-primary">{t}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GetStartedView() {
  return (
    <div className="text-center">
      <h2 className="text-4xl md:text-5xl font-display font-extrabold mb-8 text-slate-900 dark:text-white">Start Building with PDFQuill</h2>
      <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-12">Join thousands of users and developers using the world's most modern and private PDF toolkit.</p>
      <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
        <div className="card p-10 bg-primary/5 border-primary/20">
          <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">For Individuals</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-8">Access all premium tools for free. No credit card required.</p>
          <button className="btn btn-primary w-full py-4">Create Free Account</button>
        </div>
        <div className="card p-10 bg-slate-50 dark:bg-slate-900">
          <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">For Teams</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-8">Collaborative tools, shared assets, and team management.</p>
          <button className="btn btn-secondary w-full py-4">Contact Sales</button>
        </div>
      </div>
    </div>
  );
}

export default App;
