import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import Tesseract from 'tesseract.js';
import jsQR from 'jsqr';

// Ensure worker is configured for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/** Supported OCR languages with display names */
export const OCR_LANGUAGES: { code: string; label: string }[] = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'ita', label: 'Italian' },
  { code: 'por', label: 'Portuguese' },
  { code: 'nep', label: 'Nepali' },
  { code: 'hin', label: 'Hindi' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'chi_tra', label: 'Chinese (Traditional)' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'kor', label: 'Korean' },
  { code: 'ara', label: 'Arabic' },
  { code: 'rus', label: 'Russian' },
  { code: 'tha', label: 'Thai' },
  { code: 'vie', label: 'Vietnamese' },
  { code: 'pol', label: 'Polish' },
  { code: 'tur', label: 'Turkish' },
  { code: 'nld', label: 'Dutch' },
  { code: 'swe', label: 'Swedish' },
];

export type OcrProgress = {
  phase: 'rendering' | 'recognizing' | 'building';
  currentPage: number;
  totalPages: number;
  percent: number;
};

export type OcrTextResult = {
  text: string;
  confidence: number;
  csv: string; // Table extraction
  qrs: string[]; // Detected QR codes
  pages: {
    pageNumber: number;
    text: string;
    confidence: number;
    qrs: string[];
    words: {
      text: string;
      confidence: number;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }[];
  }[];
};

export type OcrOptions = {
  language?: string;
  autoRotate?: boolean;
  detectQr?: boolean;
  extractTables?: boolean;
};

/**
 * Render a single PDF page to a canvas at the given scale.
 * A scale of 2.0 approximates ~300 DPI for letter-sized pages.
 */
async function renderPageToCanvas(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale = 2.0
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

/**
 * Flatten the Tesseract.js Page hierarchy to get all words with bounding boxes.
 */
function flattenWords(page: Tesseract.Page): Tesseract.Word[] {
  const words: Tesseract.Word[] = [];
  if (!page.blocks) return words;
  for (const block of page.blocks) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          words.push(word);
        }
      }
    }
  }
  return words;
}

/**
 * Basic heuristic to detect tables and convert to CSV.
 * Groups words by Y-coordinate (rows) then sorts by X-coordinate (columns).
 */
function wordsToCsv(words: Tesseract.Word[]): string {
  if (words.length === 0) return '';
  
  // Group words into lines based on Y overlap
  const lines: Tesseract.Word[][] = [];
  const Y_TOLERANCE = 10; // Pixels
  
  const sortedWords = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  
  let currentLine: Tesseract.Word[] = [];
  let currentY = sortedWords[0].bbox.y0;

  for (const word of sortedWords) {
    if (Math.abs(word.bbox.y0 - currentY) <= Y_TOLERANCE) {
      currentLine.push(word);
    } else {
      lines.push(currentLine);
      currentLine = [word];
      currentY = word.bbox.y0;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  // Sort words in each line by X-coordinate and join with commas
  return lines.map(line => {
    return line.sort((a, b) => a.bbox.x0 - b.bbox.x0)
      .map(w => {
        // Escape CSV quotes and wrap in quotes if it contains a comma
        const text = w.text.replace(/"/g, '""');
        return text.includes(',') ? `"${text}"` : text;
      })
      .join(',');
  }).join('\n');
}

/**
 * Rotate canvas visually.
 */
function rotateCanvas(canvas: HTMLCanvasElement, angleDegrees: number): HTMLCanvasElement {
  if (angleDegrees === 0 || angleDegrees === 360) return canvas;
  
  const rotated = document.createElement('canvas');
  const ctx = rotated.getContext('2d')!;
  
  if (angleDegrees === 90 || angleDegrees === 270) {
    rotated.width = canvas.height;
    rotated.height = canvas.width;
  } else {
    rotated.width = canvas.width;
    rotated.height = canvas.height;
  }
  
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate((angleDegrees * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  
  return rotated;
}

/**
 * OCR a single canvas and return Tesseract results.
 */
async function ocrCanvas(
  canvas: HTMLCanvasElement,
  language: string
): Promise<Tesseract.Page> {
  const result = await Tesseract.recognize(canvas, language, {
    logger: () => {}, // suppress internal logs
  });
  return result.data;
}

/**
 * Make a scanned PDF searchable by overlaying invisible text.
 *
 * Pipeline:
 *   PDF → pdfjs-dist (render each page to canvas)
 *       → Tesseract.js (OCR each canvas → words + bounding boxes)
 *       → pdf-lib (overlay invisible text at matching positions)
 *       → Searchable PDF blob URL
 */
export async function ocrMakeSearchable(
  file: File,
  options: OcrOptions = { language: 'eng', autoRotate: false },
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  const bytes = await file.arrayBuffer();
  const lang = options.language || 'eng';

  // Load PDF with pdfjs-dist for rendering
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  const totalPages = pdf.numPages;

  // Load PDF with pdf-lib for text overlay
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= totalPages; i++) {
    // Phase 1: Render page to canvas
    onProgress?.({
      phase: 'rendering',
      currentPage: i,
      totalPages,
      percent: Math.round(((i - 1) / totalPages) * 100),
    });

    const canvas = await renderPageToCanvas(pdf, i);
    let finalCanvas = canvas;
    const pdfPage = pdfDoc.getPage(i - 1);

    // Auto-rotate via OSD
    if (options.autoRotate) {
      try {
        const detectResult = await Tesseract.detect(canvas, { logger: () => {} });
        const orientation = detectResult.data.orientation_degrees;
        if (orientation && orientation !== 0 && orientation !== 360) {
          // Rotate canvas for better OCR
          finalCanvas = rotateCanvas(canvas, orientation);
          // Rotate PDF page
          const currentRotation = pdfPage.getRotation().angle;
          pdfPage.setRotation(degrees((currentRotation + orientation) % 360));
        }
      } catch (e) {
        console.warn('OSD detection failed', e);
      }
    }

    // Phase 2: OCR the canvas image
    onProgress?.({
      phase: 'recognizing',
      currentPage: i,
      totalPages,
      percent: Math.round(((i - 0.5) / totalPages) * 100),
    });

    const ocrResult = await ocrCanvas(finalCanvas, lang);

    // Phase 3: Overlay invisible text
    onProgress?.({
      phase: 'building',
      currentPage: i,
      totalPages,
      percent: Math.round((i / totalPages) * 95),
    });

    const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();
    const scaleX = pdfWidth / finalCanvas.width;
    const scaleY = pdfHeight / finalCanvas.height;

    const words = flattenWords(ocrResult);
    for (const word of words) {
      if (!word.text.trim()) continue;

      const x = word.bbox.x0 * scaleX;
      const bboxHeight = (word.bbox.y1 - word.bbox.y0) * scaleY;
      // PDF coordinate system is bottom-up, canvas is top-down
      const y = pdfHeight - word.bbox.y1 * scaleY;

      // Size the text to roughly match the bounding box height
      const fontSize = Math.max(4, bboxHeight * 0.85);

      try {
        pdfPage.drawText(word.text, {
          x,
          y,
          size: fontSize,
          font,
          opacity: 0, // invisible text — only for search & selection
        });
      } catch {
        // Some characters may not be embeddable with Helvetica — skip them
      }
    }
  }

  onProgress?.({
    phase: 'building',
    currentPage: totalPages,
    totalPages,
    percent: 100,
  });

  const resultBytes = await pdfDoc.save({ useObjectStreams: true });
  const blob = new Blob([resultBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

/**
 * Extract all text from a PDF using OCR.
 * Returns structured results with per-page text and confidence scores.
 */
export async function ocrExtractText(
  file: File,
  options: OcrOptions = { language: 'eng', autoRotate: false, detectQr: false, extractTables: false },
  onProgress?: (p: OcrProgress) => void
): Promise<OcrTextResult> {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const totalPages = pdf.numPages;
  const lang = options.language || 'eng';

  const pages: OcrTextResult['pages'] = [];
  let allText = '';
  let allCsv = '';
  const allQrs: string[] = [];
  let totalConfidence = 0;

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.({
      phase: 'rendering',
      currentPage: i,
      totalPages,
      percent: Math.round(((i - 1) / totalPages) * 100),
    });

    const canvas = await renderPageToCanvas(pdf, i);
    let finalCanvas = canvas;

    // Auto-rotate
    if (options.autoRotate) {
      try {
        const detectResult = await Tesseract.detect(canvas, { logger: () => {} });
        const orientation = detectResult.data.orientation_degrees;
        if (orientation && orientation !== 0 && orientation !== 360) {
          finalCanvas = rotateCanvas(canvas, orientation);
        }
      } catch (e) {
        console.warn('OSD detection failed', e);
      }
    }

    // QR Detection
    const qrs: string[] = [];
    if (options.detectQr) {
      const ctx = finalCanvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          qrs.push(code.data);
          allQrs.push(code.data);
        }
      }
    }

    onProgress?.({
      phase: 'recognizing',
      currentPage: i,
      totalPages,
      percent: Math.round(((i - 0.5) / totalPages) * 100),
    });

    const ocrResult = await ocrCanvas(finalCanvas, lang);

    const flatWords = flattenWords(ocrResult);
    
    if (options.extractTables) {
      const csv = wordsToCsv(flatWords);
      if (csv) allCsv += csv + '\n\n';
    }

    const words = flatWords.map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: {
        x0: w.bbox.x0,
        y0: w.bbox.y0,
        x1: w.bbox.x1,
        y1: w.bbox.y1,
      },
    }));

    pages.push({
      pageNumber: i,
      text: ocrResult.text,
      confidence: ocrResult.confidence,
      qrs,
      words,
    });

    allText += ocrResult.text + '\n\n';
    totalConfidence += ocrResult.confidence;
  }

  onProgress?.({
    phase: 'recognizing',
    currentPage: totalPages,
    totalPages,
    percent: 100,
  });

  return {
    text: allText.trim(),
    confidence: totalPages > 0 ? Math.round(totalConfidence / totalPages) : 0,
    csv: allCsv.trim(),
    qrs: allQrs,
    pages,
  };
}
