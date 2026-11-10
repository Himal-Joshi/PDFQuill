import { useState, useRef, useEffect, useCallback, type PointerEvent, type ChangeEvent } from 'react';
import { X, PenLine, Upload, RotateCcw, Check, Sparkles } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSignature: (dataUrl: string, aspectRatio: number) => void;
}

const PEN_COLORS = [
  { name: 'Ink Black', value: '#0f172a' },
  { name: 'Classic Blue', value: '#1d4ed8' },
  { name: 'Crimson', value: '#b91c1c' },
];

export function SignatureModal({ isOpen, onClose, onSaveSignature }: SignatureModalProps) {
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
  const [penColor, setPenColor] = useState('#0f172a');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [rawUploadedDataUrl, setRawUploadedDataUrl] = useState<string | null>(null);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and clear drawing canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 2;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = penColor;
      }
      clearCanvas();
    }
  }, [isOpen, activeTab, clearCanvas, penColor]);

  // Reactive image rasterization to PNG & white background removal
  useEffect(() => {
    if (!rawUploadedDataUrl) {
      setUploadedDataUrl(null);
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      const offCanvas = document.createElement('canvas');
      const w = img.naturalWidth || img.width || 400;
      const h = img.naturalHeight || img.height || 200;
      offCanvas.width = w;
      offCanvas.height = h;

      const ctx = offCanvas.getContext('2d');
      if (!ctx) {
        setUploadedDataUrl(rawUploadedDataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0);

      if (removeBg) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          // If close to white (brightness > 215)
          if (r > 215 && g > 215 && b > 215) {
            d[i + 3] = 0; // transparent
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      // Always standardize to PNG data URL so pdf-lib embeds safely
      setUploadedDataUrl(offCanvas.toDataURL('image/png'));
    };
    img.src = rawUploadedDataUrl;
  }, [rawUploadedDataUrl, removeBg]);

  if (!isOpen) return null;

  // Pointer event handlers for smooth drawing
  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    lastPointRef.current = { x, y };

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = penColor;
      ctx.beginPath();
      ctx.arc(x, y, 1.25, 0, Math.PI * 2);
      ctx.fillStyle = penColor;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    setHasDrawn(true);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth quadratic curve through midpoint
    const midX = (lastPointRef.current.x + x) / 2;
    const midY = (lastPointRef.current.y + y) / 2;
    ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
    ctx.stroke();

    lastPointRef.current = { x, y };
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  // Crop transparent whitespace from canvas
  const getCroppedCanvasDataUrl = (canvas: HTMLCanvasElement): { dataUrl: string; aspectRatio: number } | null => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = pixels[(y * width + x) * 4 + 3];
        if (alpha > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      return null;
    }

    // Add 12px padding
    const padding = 12;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width, maxX + padding);
    maxY = Math.min(height, maxY + padding);

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const cropCtx = croppedCanvas.getContext('2d');
    if (!cropCtx) return null;

    cropCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return {
      dataUrl: croppedCanvas.toDataURL('image/png'),
      aspectRatio: cropWidth / cropHeight,
    };
  };

  // Handle image file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      if (!dataUrl) return;
      setRawUploadedDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      const result = getCroppedCanvasDataUrl(canvas);
      if (result) {
        onSaveSignature(result.dataUrl, result.aspectRatio);
        onClose();
      }
    } else if (uploadedDataUrl) {
      const img = new window.Image();
      img.onload = () => {
        const aspectRatio = (img.naturalWidth || 200) / (img.naturalHeight || 80);
        onSaveSignature(uploadedDataUrl, aspectRatio);
        onClose();
      };
      img.src = uploadedDataUrl;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PenLine className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Add Signature
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Draw with your mouse/touchpad or upload an existing signature image
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex px-6 pt-4 gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'draw'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <PenLine className="w-4 h-4" />
            Draw Signature
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload Image
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {activeTab === 'draw' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                {/* Pen color picker */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ink Color:</span>
                  <div className="flex items-center gap-1.5">
                    {PEN_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setPenColor(color.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          penColor === color.value ? 'scale-110 border-indigo-600 shadow-sm' : 'border-white dark:border-slate-800'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearCanvas}
                  disabled={!hasDrawn}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>

              {/* Drawing Area */}
              <div className="relative w-full h-44 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/50 overflow-hidden cursor-crosshair">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full touch-none"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm select-none">
                    Sign with your mouse or finger here
                  </div>
                )}
                {/* Baseline Guide */}
                <div className="absolute bottom-8 left-8 right-8 border-b border-slate-300/60 dark:border-slate-700/60 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-indigo-500 bg-slate-50/70 dark:bg-slate-950/50 transition-colors p-4">
                {uploadedDataUrl ? (
                  <div className="relative max-h-full max-w-full flex items-center justify-center p-2">
                    <img src={uploadedDataUrl} alt="Signature Preview" className="max-h-32 object-contain" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Click to upload or drag & drop signature
                    </p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, or SVG up to 5MB</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {/* Auto transparent background toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Remove white background from scanned paper</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={activeTab === 'draw' ? !hasDrawn : !uploadedDataUrl}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Check className="w-4 h-4" />
            Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
}
