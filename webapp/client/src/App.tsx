import { useMemo, useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react';
// axios removed
import {
  AlertCircle,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Copy,
  Download,
  FileImage,
  FileSearch,
  FileText,
  Hash,
  Image,
  Layers,
  Loader2,
  Merge,
  Minimize2,
  RotateCw,
  ScanText,
  Scissors,
  Trash2,
  Type,
  Upload,
  ArrowLeft,
  Moon,
  Sun,
  Globe,
  FileMinus,
  Lock,
  Unlock,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mergePdfs, splitPdf, compressPdf, rotatePdf, watermarkPdf, addPageNumbers, organizePdf, imagesToPdf, pdfToImages, compressImages, flattenPdf, protectPdf, unlockPdf, type ConversionResult } from './lib/pdfProcessing';
import { ocrMakeSearchable, ocrExtractText, OCR_LANGUAGES, type OcrProgress, type OcrTextResult } from './lib/ocrProcessing';
import html2pdf from 'html2pdf.js';
import { auth } from './lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { validateEmailDomain, validatePassword } from './lib/auth';
import { generateThumbnails, type PageThumbnail } from './lib/pdfThumbnails';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '/PDFQuill' : '/PDFQuill');

type Tool = 'merge' | 'split' | 'compress' | 'rotate' | 'watermark' | 'page-numbers' | 'organize' | 'convert' | 'pdf-to-image' | 'compress-image' | 'ocr' | 'ocr-extract' | 'html-to-pdf' | 'flatten-pdf' | 'protect-pdf' | 'unlock-pdf';

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
    id: 'compress',
    label: 'Compress PDF',
    description: 'Reduce file size while optimizing for maximal PDF quality.',
    endpoint: '/api/compress',
    icon: 'compress',
    lucideIcon: Minimize2,
  },
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
  {
    id: 'pdf-to-image',
    label: 'PDF to Image',
    description: 'Convert each PDF page into a high-resolution PNG image.',
    endpoint: '',
    icon: 'image',
    lucideIcon: Image,
  },
  {
    id: 'compress-image',
    label: 'Compress Image',
    description: 'Reduce image file size with adjustable quality and dimensions.',
    endpoint: '',
    icon: 'compress',
    lucideIcon: Minimize2,
    acceptsImages: true,
    multiple: true,
  },
  {
    id: 'ocr',
    label: 'OCR — Make Searchable',
    description: 'Convert scanned documents into searchable, selectable PDFs using AI-powered text recognition.',
    endpoint: '',
    icon: 'document_scanner',
    lucideIcon: ScanText,
  },
  {
    id: 'ocr-extract',
    label: 'OCR — Extract Text',
    description: 'Extract all text from scanned or image-based PDFs with confidence scoring.',
    endpoint: '',
    icon: 'manage_search',
    lucideIcon: FileSearch,
  },
  {
    id: 'html-to-pdf',
    label: 'HTML to PDF',
    description: 'Convert HTML files or rich text into a formatted PDF document.',
    endpoint: '',
    icon: 'language',
    lucideIcon: Globe,
  },
  {
    id: 'flatten-pdf',
    label: 'Flatten PDF',
    description: 'Convert all pages into uneditable images. Strips metadata and forms.',
    endpoint: '',
    icon: 'layers_clear',
    lucideIcon: FileMinus,
  },
  {
    id: 'protect-pdf',
    label: 'Lock PDF',
    description: 'Encrypt your PDF with a password. Requires password to open.',
    endpoint: '',
    icon: 'lock',
    lucideIcon: Lock,
  },
  {
    id: 'unlock-pdf',
    label: 'Unlock PDF',
    description: 'Remove password protection from an encrypted PDF.',
    endpoint: '',
    icon: 'lock_open',
    lucideIcon: Unlock,
  },
];

type ViewType = 'main' | 'pricing' | 'solutions' | 'privacy' | 'terms' | 'login' | 'docs' | 'get-started';

const getInitialState = () => {
  if (typeof window === 'undefined') return { view: 'main' as ViewType, tool: null as Tool | null };
  const hash = window.location.hash.slice(1);
  if (!hash) return { view: 'main' as ViewType, tool: null as Tool | null };
  if (hash.startsWith('tool/')) return { view: 'main' as ViewType, tool: hash.split('/')[1] as Tool };
  return { view: hash as ViewType, tool: null as Tool | null };
};

function App() {
  const [view, setView] = useState<ViewType>(getInitialState().view);
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
  const [user, setUser] = useState<{ email: string; token: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ 
          email: firebaseUser.email || '', 
          token: await firebaseUser.getIdToken() 
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
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
  const [downloadUrls, setDownloadUrls] = useState<{url: string, name: string}[]>([]);
  const [error, setError] = useState('');
  const [splitMode, setSplitMode] = useState<'all' | 'range' | 'color'>('all');
  const [pageRange, setPageRange] = useState('');
  const [rotation, setRotation] = useState(90);
  const [rotationMode, setRotationMode] = useState<'all' | 'specific'>('all');
  const [rotationPages, setRotationPages] = useState('');
  const [watermarkMode, setWatermarkMode] = useState<'text' | 'image'>('text');
  const [watermarkText, setWatermarkText] = useState('DRAFT');
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
  const [organizeAction, setOrganizeAction] = useState<'reorder' | 'delete'>('reorder');
  const [imageQuality, setImageQuality] = useState(0.75);
  const [imageScale, setImageScale] = useState(1.0);
  const [downloadExtension, setDownloadExtension] = useState('pdf');

  // OCR state
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [ocrAutoRotate, setOcrAutoRotate] = useState(true);
  const [ocrDetectQr, setOcrDetectQr] = useState(true);
  const [ocrExtractTables, setOcrExtractTables] = useState(true);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrTextResult, setOcrTextResult] = useState<OcrTextResult | null>(null);

  // HTML & Encryption state
  const [htmlContent, setHtmlContent] = useState('');
  const [pdfPassword, setPdfPassword] = useState('');

  // Thumbnail state
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);

  // Drag and drop state for thumbnails
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragItem.current = index;
    e.currentTarget.classList.add('opacity-50', 'scale-95');
  };

  const handleDragEnter = (_e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-50', 'scale-95');
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const copyThumbnails = [...thumbnails];
      const dragItemContent = copyThumbnails[dragItem.current];
      copyThumbnails.splice(dragItem.current, 1);
      copyThumbnails.splice(dragOverItem.current, 0, dragItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      setThumbnails(copyThumbnails);
      
      if (activeTool === 'organize' && organizeAction === 'reorder') {
        setPageRange(copyThumbnails.map(t => t.pageNumber).join(','));
      }
    }
  };

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === activeTool) ?? tools[0],
    [activeTool],
  );

  const selectTool = (tool: Tool) => {
    window.location.assign(`#tool/${tool}`);
    setFiles([]);
    setDownloadUrl('');
    setDownloadUrls([]);
    setError('');
    setWatermarkImage(null);
    setThumbnails([]);
    setOcrProgress(null);
    setOcrTextResult(null);
  };

  const goHome = () => {
    window.location.assign('#');
  };

  // Generate thumbnails when files change (for single-file PDF tools)
  useEffect(() => {
    if (files.length === 0 || activeTool === 'convert' || activeTool === 'compress-image') {
      Promise.resolve().then(() => setThumbnails([]));
      return;
    }
    // For merge, don't auto-generate thumbnails (multiple files)
    // For single-file tools, generate thumbnails of the first file
    if (activeTool !== 'merge' && files.length >= 1 && files[0].type === 'application/pdf') {
      Promise.resolve().then(() => {
        setLoadingThumbnails(true);
        generateThumbnails(files[0], 180)
          .then((t) => setThumbnails(t))
          .catch(() => setThumbnails([]))
          .finally(() => setLoadingThumbnails(false));
      });
    } else {
      Promise.resolve().then(() => setThumbnails([]));
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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const newFiles = Array.from(event.target.files);
    
    if (selectedTool.multiple) {
      setFiles((current) => [...current, ...newFiles]);
    } else {
      setFiles([newFiles[0]]);
    }
    setDownloadUrl('');
    setDownloadUrls([]);
    setError('');
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((currentFiles) => currentFiles.filter((_file, fileIndex) => fileIndex !== index));
  };

  const processFile = async () => {
    if (files.length === 0 && !(activeTool === 'html-to-pdf' && htmlContent.trim().length > 0)) return;
    if (activeTool === 'watermark' && watermarkMode === 'image' && !watermarkImage) {
      setError('Choose a watermark image first.');
      return;
    }

    setLoading(true);
    setError('');
    setDownloadUrl('');
    setOcrProgress(null);
    setOcrTextResult(null);
    setDownloadUrls([]);

    try {
      let resultUrl: string | { url: string; name: string }[] = '';
      if (activeTool === 'merge') {
        resultUrl = await mergePdfs(files);
      } else if (activeTool === 'split') {
        resultUrl = await splitPdf(files[0], splitMode, pageRange);
      } else if (activeTool === 'compress') {
        resultUrl = await compressPdf(files[0]);
      } else if (activeTool === 'rotate') {
        resultUrl = await rotatePdf(files[0], rotation, rotationMode, rotationPages);
      } else if (activeTool === 'watermark') {
        resultUrl = await watermarkPdf(files[0], watermarkMode, watermarkText, watermarkImage);
      } else if (activeTool === 'page-numbers') {
        resultUrl = await addPageNumbers(files[0]);
      } else if (activeTool === 'organize') {
        resultUrl = await organizePdf(files[0], organizeAction, pageRange);
      } else if (activeTool === 'convert') {
        resultUrl = await imagesToPdf(files);
      } else if (activeTool === 'pdf-to-image') {
        const result: ConversionResult = await pdfToImages(files[0]);
        resultUrl = result.url;
        setDownloadExtension(result.extension);
      } else if (activeTool === 'compress-image') {
        const result: ConversionResult = await compressImages(files, imageQuality, imageScale);
        resultUrl = result.url;
        setDownloadExtension(result.extension);
      } else if (activeTool === 'ocr') {
        resultUrl = await ocrMakeSearchable(files[0], { language: ocrLanguage, autoRotate: ocrAutoRotate, detectQr: ocrDetectQr, extractTables: ocrExtractTables }, setOcrProgress);
      } else if (activeTool === 'ocr-extract') {
        const textResult = await ocrExtractText(files[0], { language: ocrLanguage, autoRotate: ocrAutoRotate, detectQr: ocrDetectQr, extractTables: ocrExtractTables }, setOcrProgress);
        setOcrTextResult(textResult);
        // No download URL for extract — we show the text inline
        resultUrl = '';
      } else if (activeTool === 'flatten-pdf') {
        resultUrl = await flattenPdf(files[0]);
      } else if (activeTool === 'protect-pdf') {
        if (!pdfPassword) throw new Error('Password is required to lock the PDF.');
        resultUrl = await protectPdf(files[0], pdfPassword);
      } else if (activeTool === 'unlock-pdf') {
        if (!pdfPassword) throw new Error('Password is required to unlock the PDF.');
        resultUrl = await unlockPdf(files[0], pdfPassword);
      } else if (activeTool === 'html-to-pdf') {
        let content = htmlContent;
        if (files.length > 0) {
          content = await files[0].text();
        }
        if (!content.trim()) throw new Error('Please enter some HTML or upload an HTML file.');
        
        const element = document.createElement('div');
        element.innerHTML = content;
        
        const blob = await html2pdf().from(element).output('blob');
        resultUrl = URL.createObjectURL(blob);
      }
      
      if (Array.isArray(resultUrl)) {
        setDownloadUrls(resultUrl);
      } else {
        setDownloadUrl(resultUrl);
      }
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

  const needsPageRange = activeTool === 'organize' || (activeTool === 'split' && splitMode === 'range') || (activeTool === 'rotate' && rotationMode === 'specific');
  const canProcess = !loading && (!needsPageRange || pageRange.trim().length > 0 || rotationPages.trim().length > 0) && (files.length > 0 || (activeTool === 'html-to-pdf' && htmlContent.trim().length > 0));

  return (
    <div className="min-h-screen selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 glass">
        <div className="flex justify-between items-center h-20 px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 cursor-pointer select-none group" onClick={goHome}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
              <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="PDFQuill" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              <span className="dark:text-white">PDF</span><span className="text-primary">Quill</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button onClick={goHome} className={cn("text-sm font-semibold transition-colors duration-200", (activeTool === null && view === 'main') ? "text-primary" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100")}>Tools</button>
            <button onClick={() => window.location.assign('#pricing')} className={cn("text-sm font-semibold transition-colors duration-200", view === 'pricing' ? "text-primary" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100")}>Pricing</button>
            <button onClick={() => window.location.assign('#solutions')} className={cn("text-sm font-semibold transition-colors duration-200", view === 'solutions' ? "text-primary" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100")}>Solutions</button>
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
                <button onClick={() => window.location.assign('#login')} className="hidden sm:block btn btn-ghost">Login</button>
                <button onClick={() => window.location.assign('#get-started')} className="btn btn-primary">Get Started</button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-20 flex-1">
        {view !== 'main' ? (
          <div className="px-6 py-20 max-w-4xl mx-auto">
            {view === 'pricing' && <PricingView user={user} />}
            {view === 'solutions' && <SolutionsView />}
            {view === 'privacy' && <PrivacyView />}
            {view === 'terms' && <TermsView />}
            {view === 'login' && <LoginView onLogin={(u) => { setUser(u); window.location.assign('#'); localStorage.setItem('user', JSON.stringify(u)); }} />}
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
                    <button onClick={() => window.location.assign('#solutions')} className="btn btn-primary px-8 py-4 text-base w-full sm:w-auto">
                      Explore All Tools
                    </button>
                    <button onClick={() => window.location.assign('#docs')} className="btn btn-secondary px-8 py-4 text-base w-full sm:w-auto">
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
            <div className="mx-auto max-w-7xl">
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

              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <section className="flex-1 w-full grid gap-8">
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
                    accept={selectedTool.acceptsImages ? '.png,.jpg,.jpeg' : activeTool === 'html-to-pdf' ? '.html,.htm' : '.pdf'}
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
                      {files.length > 0 ? `${files.length} files selected` : `Drop your ${selectedTool.acceptsImages ? 'images' : activeTool === 'html-to-pdf' ? 'HTML files' : 'PDFs'} here`}
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
                {files.length > 0 && activeTool !== 'merge' && activeTool !== 'convert' && activeTool !== 'compress-image' && (
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
                        {thumbnails.map((thumb, index) => (
                          <div
                            key={thumb.pageNumber}
                            draggable={activeTool === 'organize' && organizeAction === 'reorder'}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className={cn(
                              "group/thumb flex flex-col items-center gap-2 transition-all duration-200",
                              activeTool === 'organize' && organizeAction === 'reorder' && "cursor-grab active:cursor-grabbing"
                            )}
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
                </section>

                <aside className="w-full lg:w-[380px] shrink-0 grid gap-8 lg:sticky lg:top-28">
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
                    rotationMode={rotationMode}
                    setRotationMode={setRotationMode}
                    rotationPages={rotationPages}
                    setRotationPages={setRotationPages}
                    watermarkMode={watermarkMode}
                    setWatermarkMode={setWatermarkMode}
                    watermarkText={watermarkText}
                    setWatermarkText={setWatermarkText}
                    setWatermarkImage={setWatermarkImage}
                    organizeAction={organizeAction}
                    setOrganizeAction={setOrganizeAction}
                    imageQuality={imageQuality}
                    setImageQuality={setImageQuality}
                    imageScale={imageScale}
                    setImageScale={setImageScale}
                    ocrLanguage={ocrLanguage}
                    setOcrLanguage={setOcrLanguage}
                    ocrAutoRotate={ocrAutoRotate}
                    setOcrAutoRotate={setOcrAutoRotate}
                    ocrDetectQr={ocrDetectQr}
                    setOcrDetectQr={setOcrDetectQr}
                    ocrExtractTables={ocrExtractTables}
                    setOcrExtractTables={setOcrExtractTables}
                    htmlContent={htmlContent}
                    setHtmlContent={setHtmlContent}
                    pdfPassword={pdfPassword}
                    setPdfPassword={setPdfPassword}
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

                  {/* OCR Progress Display */}
                  {loading && ocrProgress && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10 p-6"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black uppercase tracking-widest text-blue-500 dark:text-blue-400">
                          {ocrProgress.phase === 'rendering' && '📄 Rendering page'}
                          {ocrProgress.phase === 'recognizing' && '🔍 Recognizing text'}
                          {ocrProgress.phase === 'building' && '🏗️ Building PDF'}
                        </span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-300">
                          Page {ocrProgress.currentPage} of {ocrProgress.totalPages}
                        </span>
                      </div>
                      <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-3 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${ocrProgress.percent}%` }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                      </div>
                      <p className="mt-2 text-xs font-medium text-blue-500 dark:text-blue-400 text-right">{ocrProgress.percent}%</p>
                    </motion.div>
                  )}
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
                        download={`PDFQuill_${activeTool}${activeTool === 'split' && splitMode === 'all' ? '.zip' : (activeTool === 'pdf-to-image' || activeTool === 'compress-image') ? `.${downloadExtension}` : '.pdf'}`}
                        className="btn bg-emerald-600 text-white hover:bg-emerald-700 px-8 py-4 text-lg shadow-lg shadow-emerald-600/20"
                      >
                        <Download size={20} className="mr-2" />
                        Download
                      </a>
                    </motion.div>
                  )}

                  {downloadUrls.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col gap-4 mt-4"
                    >
                      <h3 className="font-display text-xl font-extrabold tracking-tight">Downloads Ready</h3>
                      {downloadUrls.map((dl, idx) => (
                        <a
                          key={idx}
                          href={dl.url}
                          download={dl.name}
                          className="btn bg-emerald-600 text-white hover:bg-emerald-700 px-8 py-4 text-lg shadow-lg shadow-emerald-600/20 flex justify-center items-center"
                        >
                          <Download size={20} className="mr-2" />
                          Download {dl.name.replace('.pdf', '').replace('_', ' ')}
                        </a>
                      ))}
                    </motion.div>
                  )}

                  {/* OCR Extracted Text Results */}
                  {ocrTextResult && activeTool === 'ocr-extract' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col gap-4 rounded-2xl border border-violet-100 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/10 p-6 shadow-xl shadow-violet-500/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                            <FileSearch size={20} />
                          </div>
                          <div>
                            <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">Text Extracted</h3>
                            <p className="text-xs font-medium text-violet-500">
                              {ocrTextResult.pages.length} page{ocrTextResult.pages.length !== 1 ? 's' : ''} · Avg. confidence: {ocrTextResult.confidence}%
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(ocrTextResult.text);
                          }}
                          className="btn btn-secondary flex items-center gap-2 text-sm"
                          title="Copy to clipboard"
                        >
                          <Copy size={16} /> Copy
                        </button>
                      </div>

                      {/* Confidence badges per page */}
                      <div className="flex flex-wrap gap-2">
                        {ocrTextResult.pages.map((page) => (
                          <span
                            key={page.pageNumber}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold',
                              page.confidence >= 90
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                : page.confidence >= 70
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            )}
                          >
                            P{page.pageNumber}: {page.confidence}%
                          </span>
                        ))}
                      </div>

                      {/* Text preview */}
                      <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                        <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {ocrTextResult.text}
                        </pre>
                      </div>

                      {/* QR Codes */}
                      {ocrTextResult.qrs && ocrTextResult.qrs.length > 0 && (
                        <div className="mt-2 space-y-2">
                          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Detected QR Codes:</h4>
                          {ocrTextResult.qrs.map((qr, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                              <span className="text-sm font-mono text-slate-600 dark:text-slate-400 break-all">{qr}</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(qr)}
                                className="btn btn-secondary text-xs px-3 py-1"
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Downloads */}
                      <div className="flex flex-col sm:flex-row gap-3 mt-2">
                        <a
                          href={URL.createObjectURL(new Blob([ocrTextResult.text], { type: 'text/plain' }))}
                          download="PDFQuill_extracted_text.txt"
                          className="flex-1 btn bg-violet-600 text-white hover:bg-violet-700 px-6 py-3 text-sm shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2"
                        >
                          <Download size={18} /> Download as .txt
                        </a>
                        
                        {ocrTextResult.csv && (
                          <a
                            href={URL.createObjectURL(new Blob([ocrTextResult.csv], { type: 'text/csv' }))}
                            download="PDFQuill_extracted_tables.csv"
                            className="flex-1 btn bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3 text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                          >
                            <Download size={18} /> Download Tables as .csv
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                </aside>
              </div>
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
                <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="w-5 h-5" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                <span className="dark:text-white">PDF</span><span className="text-primary">Quill</span>
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">© {new Date().getFullYear()} PDFQuill Toolkit. Built for security & speed.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            <button onClick={() => window.location.assign('#privacy')} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">Privacy</button>
            <button onClick={() => window.location.assign('#terms')} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">Terms</button>
            <a className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest" href="https://github.com/Himal-Joshi/PDFQuill" target="_blank" rel="noopener noreferrer">Github</a>
            <a className="text-xs font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-widest" href="https://github.com/Himal-Joshi/PDFQuill" target="_blank" rel="noopener noreferrer">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

type ToolOptionsProps = {
  activeTool: Tool | null;
  splitMode: 'all' | 'range' | 'color';
  setSplitMode: (value: 'all' | 'range' | 'color') => void;
  pageRange: string;
  setPageRange: (value: string) => void;
  rotation: number;
  setRotation: (value: number) => void;
  rotationMode: 'all' | 'specific';
  setRotationMode: (value: 'all' | 'specific') => void;
  rotationPages: string;
  setRotationPages: (value: string) => void;
  watermarkMode: 'text' | 'image';
  setWatermarkMode: (value: 'text' | 'image') => void;
  watermarkText: string;
  setWatermarkText: (value: string) => void;
  setWatermarkImage: (value: File | null) => void;
  organizeAction: 'reorder' | 'delete';
  setOrganizeAction: (value: 'reorder' | 'delete') => void;
  imageQuality: number;
  setImageQuality: (value: number) => void;
  imageScale: number;
  setImageScale: (value: number) => void;
  ocrLanguage: string;
  setOcrLanguage: (value: string) => void;
  ocrAutoRotate: boolean;
  setOcrAutoRotate: (value: boolean) => void;
  ocrDetectQr: boolean;
  setOcrDetectQr: (value: boolean) => void;
  ocrExtractTables: boolean;
  setOcrExtractTables: (value: boolean) => void;
  htmlContent: string;
  setHtmlContent: (value: string) => void;
  pdfPassword: string;
  setPdfPassword: (value: string) => void;
};

function ToolOptions({
  activeTool,
  splitMode,
  setSplitMode,
  pageRange,
  setPageRange,
  rotation,
  setRotation,
  rotationMode,
  setRotationMode,
  rotationPages,
  setRotationPages,
  watermarkMode,
  setWatermarkMode,
  watermarkText,
  setWatermarkText,
  setWatermarkImage,
  organizeAction,
  setOrganizeAction,
  imageQuality,
  setImageQuality,
  imageScale,
  setImageScale,
  ocrLanguage,
  setOcrLanguage,
  ocrAutoRotate,
  setOcrAutoRotate,
  ocrDetectQr,
  setOcrDetectQr,
  ocrExtractTables,
  setOcrExtractTables,
  htmlContent,
  setHtmlContent,
  pdfPassword,
  setPdfPassword,
}: ToolOptionsProps) {
  if (activeTool === 'split') {
    return (
      <div className="grid gap-6">
        <Field label="Split mode">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { id: 'all', label: 'Every page' },
              { id: 'range', label: 'Specific range' },
              { id: 'color', label: 'Color vs B&W' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSplitMode(option.id as 'all' | 'range' | 'color')}
                className={cn(
                  'rounded-xl border-2 py-4 px-2 text-sm font-bold transition-all duration-200 text-center',
                  splitMode === option.id
                    ? 'border-primary bg-primary/5 text-primary shadow-inner'
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-primary/30'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
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
      <div className="grid gap-6">
        <Field label="Rotation Mode">
          <select
            value={rotationMode}
            onChange={(event) => setRotationMode(event.target.value as 'all' | 'specific')}
            className="input-control"
          >
            <option value="all">Every page</option>
            <option value="specific">Specific pages</option>
          </select>
        </Field>
        {rotationMode === 'specific' && (
          <Field label="Pages to Rotate">
            <input
              value={rotationPages}
              onChange={(event) => setRotationPages(event.target.value)}
              className="input-control"
              placeholder="e.g. 1-3, 5, 8-10"
            />
          </Field>
        )}
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
      </div>
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

  if (activeTool === 'pdf-to-image') {
    return <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Each page will be rendered as a high-resolution PNG image. Multi-page PDFs are delivered as a ZIP archive.</p>;
  }

  if (activeTool === 'compress-image') {
    return (
      <div className="grid gap-6">
        <Field label={`Image Quality (${Math.round(imageQuality * 100)}%)`}>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={imageQuality}
            onChange={(e) => setImageQuality(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs font-medium text-slate-400">
            <span>Low</span>
            <span>High</span>
          </div>
        </Field>
        <Field label={`Resize Scale (${Math.round(imageScale * 100)}%)`}>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={imageScale}
            onChange={(e) => setImageScale(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs font-medium text-slate-400">
            <span>Small</span>
            <span>Original</span>
          </div>
        </Field>
      </div>
    );
  }

  if (activeTool === 'ocr' || activeTool === 'ocr-extract') {
    return (
      <div className="grid gap-6">
        <Field label="OCR Language">
          <select
            value={ocrLanguage}
            onChange={(e) => setOcrLanguage(e.target.value)}
            className="input-control"
          >
            {OCR_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </Field>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-start">
              <input 
                type="checkbox" 
                checked={ocrAutoRotate}
                onChange={(e) => setOcrAutoRotate(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                <CheckCircle size={14} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">Auto-Rotate Pages</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Fixes upside-down scans</span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-start">
              <input 
                type="checkbox" 
                checked={ocrDetectQr}
                onChange={(e) => setOcrDetectQr(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                <CheckCircle size={14} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">Detect QR Codes</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Extract links from documents</span>
            </div>
          </label>

          {activeTool === 'ocr-extract' && (
            <label className="flex items-start gap-3 cursor-pointer group col-span-full sm:col-span-1">
              <div className="relative flex items-start">
                <input 
                  type="checkbox" 
                  checked={ocrExtractTables}
                  onChange={(e) => setOcrExtractTables(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                  <CheckCircle size={14} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">Extract Tables (CSV)</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Groups data into rows/columns</span>
              </div>
            </label>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            {activeTool === 'ocr'
              ? '🔍 Scans each page for text and creates an invisible searchable layer. The visual appearance of your PDF remains unchanged.'
              : '📝 Extracts all recognized text with per-page confidence scores. Great for copying text from scanned documents.'}
          </p>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2">
            🔒 100% private — all processing happens in your browser.
          </p>
        </div>
      </div>
    );
  }

  if (activeTool === 'html-to-pdf') {
    return (
      <div className="grid gap-6">
        <Field label="HTML Content">
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            placeholder="Type or paste your HTML here... OR upload an .html file above."
            className="input-control font-mono text-sm min-h-[200px]"
          />
        </Field>
      </div>
    );
  }

  if (activeTool === 'protect-pdf' || activeTool === 'unlock-pdf') {
    return (
      <div className="grid gap-6">
        <Field label="PDF Password">
          <input
            type="password"
            value={pdfPassword}
            onChange={(e) => setPdfPassword(e.target.value)}
            placeholder={activeTool === 'protect-pdf' ? 'Enter a strong password to lock...' : 'Enter the password to unlock...'}
            className="input-control"
          />
        </Field>
      </div>
    );
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

function PricingView({ user }: { user: { email: string; token: string } | null }) {
  const plans = [
    { name: 'Basic', price: 'Free', features: ['All PDF tools', 'Unlimited files', '100% Secure', 'Ad-free'] },
    { name: 'Pro', price: '$9/mo', features: ['Everything in Basic', 'API Access', 'Priority Support', 'Custom Branding'] },
    { name: 'Enterprise', price: 'Custom', features: ['Everything in Pro', 'SSO & SAML', 'Dedicated Infrastructure', 'SLA Guarantees'] },
  ];

  return (
    <div>
      <div className="text-center mb-12">
        <h2 className="text-4xl font-display font-extrabold text-slate-900 dark:text-white mb-4">Simple, transparent pricing.</h2>
        <div className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full font-bold text-sm">
          Note: The Beta version is completely free!
        </div>
      </div>
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
            <button
              onClick={() => {
                if (!user) {
                  window.location.assign('#login');
                } else if (plan.price !== 'Free') {
                  alert('Payments are disabled in the Beta version. Enjoy PDFQuill for free!');
                }
              }}
              className={cn("btn w-full py-3", plan.name === 'Pro' ? "btn-primary" : "btn-secondary")}
            >
              {user ? `Purchase ${plan.name}` : 'Login to Purchase'}
            </button>
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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        onLogin({ email: userCredential.user.email!, token: await userCredential.user.getIdToken() });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onLogin({ email: userCredential.user.email!, token: await userCredential.user.getIdToken() });
      }
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/email-already-in-use') {
          setError('Email already in use. Please sign in instead.');
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          setError('Invalid email or password.');
        } else {
          setError(err.message || 'An unexpected error occurred. Please try again.');
        }
      } else if (err instanceof Error) {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
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
          <button onClick={() => window.location.assign('#login')} className="btn btn-primary w-full py-4">Create Free Account</button>
        </div>
        <div className="card p-10 bg-slate-50 dark:bg-slate-900">
          <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">For Teams</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-8">Collaborative tools, shared assets, and team management.</p>
          <a href="https://github.com/Himal-Joshi/PDFQuill" target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full py-4 inline-block text-center">Contact Sales</a>
        </div>
      </div>
    </div>
  );
}

export default App;
