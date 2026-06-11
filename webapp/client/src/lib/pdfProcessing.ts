import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import JSZip from 'jszip';

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

export async function splitPdf(file: File, mode: 'all' | 'range', pageRange: string, onProgress?: (p: number) => void): Promise<string> {
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = source.getPageCount();

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
