import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { createBrowserQpdfRunner } from 'qpdf-run';

// Ensure worker is configured for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

async function fileToUint8Array(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function parsePageList(value: string, totalPages: number): number[] {
  if (!value || !value.trim()) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const pages: number[] = [];
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      throw new Error('Use pages like 1,3,5-7.');
    }

    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > totalPages) {
      throw new Error(`Page range must be between 1 and ${totalPages}.`);
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page - 1);
    }
  }

  return pages;
}

async function copyPages(sourceDoc: PDFDocument, targetDoc: PDFDocument, indices: number[]) {
  const copiedPages = await targetDoc.copyPages(sourceDoc, indices);
  copiedPages.forEach((page) => targetDoc.addPage(page));
}

export async function mergePdfs(files: File[], onProgress?: (p: number) => void): Promise<string> {
  const merged = await PDFDocument.create();
  let processed = 0;
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    await copyPages(source, merged, source.getPageIndices());
    processed++;
    if (onProgress) onProgress(Math.round((processed / files.length) * 50));
  }
  const mergedBytes = await merged.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  const blob = new Blob([mergedBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export type SplitResult = string | { url: string; name: string }[];

export async function splitPdf(
  file: File,
  mode: 'all' | 'range' | 'color',
  pageRange: string,
  onProgress?: (p: number) => void
): Promise<SplitResult> {
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = source.getPageCount();

  if (mode === 'color') {
    // 1. Render and analyze pages
    const colorPages: number[] = [];
    const bwPages: number[] = [];
    
    // We load a separate instance in pdfjs-dist to render pages
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
    
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      // Low resolution scale to save memory/time
      const viewport = page.getViewport({ scale: 0.5 });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let coloredPixels = 0;
      const threshold = 15; // color difference tolerance (to account for JPEG artifacts)
      
      // Analyze every pixel (R, G, B, A)
      for (let p = 0; p < data.length; p += 4) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        
        // If max diff between color channels is > threshold, it's a colored pixel
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        if (maxDiff > threshold) {
          coloredPixels++;
        }
      }
      
      const totalPixels = canvas.width * canvas.height;
      const colorRatio = coloredPixels / totalPixels;
      
      // If more than 0.1% of pixels are colored, we consider the page "Color"
      if (colorRatio > 0.001) {
        colorPages.push(i - 1); // 0-indexed
      } else {
        bwPages.push(i - 1); // 0-indexed
      }
      
      if (onProgress) onProgress(Math.round((i / totalPages) * 50));
    }

    const results: { url: string; name: string }[] = [];
    
    // 2. Create the Color PDF
    if (colorPages.length > 0) {
      const colorDoc = await PDFDocument.create();
      await copyPages(source, colorDoc, colorPages);
      const colorBytes = await colorDoc.save({ useObjectStreams: true });
      const blob = new Blob([colorBytes as unknown as BlobPart], { type: 'application/pdf' });
      results.push({ url: URL.createObjectURL(blob), name: 'Color_Pages.pdf' });
    }
    
    if (onProgress) onProgress(75);
    
    // 3. Create the B&W PDF
    if (bwPages.length > 0) {
      const bwDoc = await PDFDocument.create();
      await copyPages(source, bwDoc, bwPages);
      const bwBytes = await bwDoc.save({ useObjectStreams: true });
      const blob = new Blob([bwBytes as unknown as BlobPart], { type: 'application/pdf' });
      results.push({ url: URL.createObjectURL(blob), name: 'BW_Pages.pdf' });
    }
    
    if (onProgress) onProgress(100);
    return results;
  }

  if (mode === 'range') {
    const selectedPages = parsePageList(pageRange, totalPages);
    const targetDoc = await PDFDocument.create();
    await copyPages(source, targetDoc, selectedPages);
    const splitBytes = await targetDoc.save({ useObjectStreams: true });
    if (onProgress) onProgress(100);
    const blob = new Blob([splitBytes as unknown as BlobPart], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }

  const zip = new JSZip();
  for (let index = 0; index < totalPages; index += 1) {
    const targetDoc = await PDFDocument.create();
    await copyPages(source, targetDoc, [index]);
    const splitBytes = await targetDoc.save({ useObjectStreams: true });
    zip.file(`page-${index + 1}.pdf`, splitBytes);
    if (onProgress) onProgress(Math.round((index / totalPages) * 80));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  if (onProgress) onProgress(100);
  return URL.createObjectURL(zipBlob);
}

export async function compressPdf(file: File, onProgress?: (p: number) => void): Promise<string> {
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const optimizedBytes = await source.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  const blob = new Blob([optimizedBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function rotatePdf(file: File, rotation: number, mode: 'all' | 'specific', pageRange: string, onProgress?: (p: number) => void): Promise<string> {
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  const pagesToRotate = new Set(mode === 'specific' ? parsePageList(pageRange, totalPages) : Array.from({ length: totalPages }, (_, i) => i));

  source.getPages().forEach((page, index) => {
    if (pagesToRotate.has(index)) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + rotation) % 360));
    }
  });

  const rotatedBytes = await source.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  const blob = new Blob([rotatedBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function watermarkPdf(file: File, mode: 'text' | 'image', text: string, imageFile: File | null, onProgress?: (p: number) => void): Promise<string> {
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = source.getPages();

  if (mode === 'image' && imageFile) {
    const imageBytes = await imageFile.arrayBuffer();
    const image = imageFile.type === 'image/png'
      ? await source.embedPng(imageBytes)
      : await source.embedJpg(imageBytes);

    pages.forEach((page) => {
      const { width, height } = page.getSize();
      const scaled = image.scale(Math.min(width / image.width, height / image.height) * 0.42);
      page.drawImage(image, {
        x: (width - scaled.width) / 2,
        y: (height - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
        opacity: 0.25,
      });
    });
  } else {
    const font = await source.embedFont(StandardFonts.HelveticaBold);
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      const size = Math.max(28, Math.min(width, height) / 8);
      const textWidth = font.widthOfTextAtSize(text, size);
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size,
        font,
        color: rgb(0.85, 0.13, 0.18),
        opacity: 0.18,
        rotate: degrees(-35),
      });
    });
  }

  const watermarkedBytes = await source.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  const blob = new Blob([watermarkedBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function addPageNumbers(file: File, onProgress?: (p: number) => void): Promise<string> {
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = source.getPages();
  const font = await source.embedFont(StandardFonts.Helvetica);

  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const label = `${index + 1} / ${pages.length}`;
    const size = 11;
    const textWidth = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: (width - textWidth) / 2,
      y: 24,
      size,
      font,
      color: rgb(0.2, 0.25, 0.33),
    });
  });

  const numberedBytes = await source.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  const blob = new Blob([numberedBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function organizePdf(file: File, action: 'reorder' | 'delete', sequence: string, onProgress?: (p: number) => void): Promise<string> {
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  const selectedPages = parsePageList(sequence, totalPages);
  const selectedSet = new Set(selectedPages);
  const targetDoc = await PDFDocument.create();

  if (action === 'delete') {
    const remainingPages = source.getPageIndices().filter((index) => !selectedSet.has(index));
    if (remainingPages.length === 0) {
      throw new Error('Deleting every page would create an empty PDF.');
    }
    await copyPages(source, targetDoc, remainingPages);
  } else {
    await copyPages(source, targetDoc, selectedPages);
  }

  const organizedBytes = await targetDoc.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  const blob = new Blob([organizedBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function imagesToPdf(files: File[], onProgress?: (p: number) => void): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  let processed = 0;

  for (const file of files) {
    const imageBytes = await file.arrayBuffer();
    const image = file.type === 'image/png'
      ? await pdfDoc.embedPng(imageBytes)
      : await pdfDoc.embedJpg(imageBytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
    processed++;
    if (onProgress) onProgress(Math.round((processed / files.length) * 80));
  }

  const convertedBytes = await pdfDoc.save({ useObjectStreams: true });
  if (onProgress) onProgress(100);
  const blob = new Blob([convertedBytes as unknown as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export type ConversionResult = { url: string; extension: string };

export async function pdfToImages(file: File, onProgress?: (p: number) => void): Promise<ConversionResult> {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const totalPages = pdf.numPages;

  if (totalPages === 1) {
    // Single page → return a single PNG
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context.');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    if (onProgress) onProgress(80);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create image.'))), 'image/png');
    });
    if (onProgress) onProgress(100);
    return { url: URL.createObjectURL(blob), extension: 'png' };
  }

  // Multi-page → return a ZIP of PNGs
  const zip = new JSZip();
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create image.'))), 'image/png');
    });
    zip.file(`page-${i}.png`, blob);
    if (onProgress) onProgress(Math.round((i / totalPages) * 80));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  if (onProgress) onProgress(100);
  return { url: URL.createObjectURL(zipBlob), extension: 'zip' };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImages(
  files: File[],
  quality: number,
  scale: number,
  onProgress?: (p: number) => void
): Promise<ConversionResult> {
  const compressOne = async (file: File): Promise<Blob> => {
    const img = await loadImage(file);
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context.');
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(img.src);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to compress image.'))),
        'image/jpeg',
        quality
      );
    });
  };

  if (files.length === 1) {
    const blob = await compressOne(files[0]);
    if (onProgress) onProgress(100);
    return { url: URL.createObjectURL(blob), extension: 'jpg' };
  }

  const zip = new JSZip();
  for (let i = 0; i < files.length; i++) {
    const blob = await compressOne(files[i]);
    const baseName = files[i].name.replace(/\.[^.]+$/, '');
    zip.file(`${baseName}_compressed.jpg`, blob);
    if (onProgress) onProgress(Math.round(((i + 1) / files.length) * 80));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  if (onProgress) onProgress(100);
  return { url: URL.createObjectURL(zipBlob), extension: 'zip' };
}


export async function flattenPdf(file: File, onProgress?: (p: number) => void): Promise<string> {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const totalPages = pdf.numPages;
  const outDoc = await PDFDocument.create();
  
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');
    
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Canvas error')), 'image/png');
    });
    
    const pngBytes = await blob.arrayBuffer();
    const pngImage = await outDoc.embedPng(pngBytes);
    const outPage = outDoc.addPage([viewport.width, viewport.height]);
    outPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
    
    if (onProgress) onProgress(Math.round((i / totalPages) * 90));
  }
  
  const pdfBytes = await outDoc.save();
  if (onProgress) onProgress(100);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export async function protectPdf(file: File, password: string): Promise<string> {
  const runner = await createBrowserQpdfRunner();
  try {
    const inputBytes = await fileToUint8Array(file);
    const result = await runner.runOne({
      input: inputBytes,
      args: ['--encrypt', password, password, '256', '--'],
    });
    const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } finally {
    await runner.destroy();
  }
}

export async function unlockPdf(file: File, password: string): Promise<string> {
  const runner = await createBrowserQpdfRunner();
  try {
    const inputBytes = await fileToUint8Array(file);
    const result = await runner.runOne({
      input: inputBytes,
      args: ['--password=' + password, '--decrypt'],
    });
    const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } finally {
    await runner.destroy();
  }
}
