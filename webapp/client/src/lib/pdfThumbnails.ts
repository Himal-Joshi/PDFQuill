/**
 * PDF page thumbnail generator using pdfjs-dist.
 *
 * Renders each page of a PDF to a small JPEG data URL for preview purposes.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Use CDN worker that matches the installed version exactly
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface PageThumbnail {
  /** 1-based page number */
  pageNumber: number;
  /** JPEG data URL of the rendered page */
  dataUrl: string;
  /** Original page width in PDF units */
  width: number;
  /** Original page height in PDF units */
  height: number;
}

/**
 * Generate thumbnail images for every page of a PDF file.
 *
 * @param file - The PDF File object to render
 * @param maxWidth - Maximum pixel width for each thumbnail (default 200)
 * @returns Array of PageThumbnail objects
 */
export async function generateThumbnails(
  file: File,
  maxWidth = 200,
): Promise<PageThumbnail[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const thumbnails: PageThumbnail[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const unscaledViewport = page.getViewport({ scale: 1 });

    // Scale so that the width fits within maxWidth
    const scale = maxWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) continue;

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    thumbnails.push({
      pageNumber: i,
      dataUrl: canvas.toDataURL('image/jpeg', 0.7),
      width: unscaledViewport.width,
      height: unscaledViewport.height,
    });
  }

  return thumbnails;
}

/**
 * Get the total page count of a PDF without rendering.
 */
export async function getPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  return pdf.numPages;
}
