import { removeBackground as imglyRemoveBg } from '@imgly/background-removal';
import JSZip from 'jszip';
import { isNative } from './platform';

export type ImageRemovalPreview = {
  name: string;
  originalUrl: string;
  processedUrl: string;
};

export type ImageRemovalResult = {
  url: string;
  extension: string;
  previews: ImageRemovalPreview[];
};

/**
 * Remove the background from one or more images using an on-device ML model.
 * All processing happens locally in the browser — images never leave the device.
 *
 * @param files  - Array of image File objects to process
 * @param onProgress - Optional progress callback (0–100)
 * @returns ImageRemovalResult containing final URL (PNG or ZIP) and individual previews
 */
export async function removeBackground(
  files: File[],
  onProgress?: (p: number) => void,
): Promise<ImageRemovalResult> {
  const previews: ImageRemovalPreview[] = [];

  const processOne = async (
    file: File,
    progressOffset: number,
    progressShare: number,
  ): Promise<Blob> => {
    const config: any = {
      progress: (_key: string, current: number, total: number) => {
        if (onProgress && total > 0) {
          const localProgress = (current / total) * progressShare;
          onProgress(Math.min(Math.round(progressOffset + localProgress), 99));
        }
      },
      output: {
        format: 'image/png',
        quality: 1,
      },
    };

    if (isNative()) {
      config.publicPath = '/local-assets/imgly/';
    }

    const blob = await imglyRemoveBg(file, config);
    return blob as Blob;
  };

  if (files.length === 1) {
    const originalUrl = URL.createObjectURL(files[0]);
    const blob = await processOne(files[0], 0, 100);
    const processedUrl = URL.createObjectURL(blob);
    
    previews.push({
      name: files[0].name,
      originalUrl,
      processedUrl,
    });

    if (onProgress) onProgress(100);
    return { url: processedUrl, extension: 'png', previews };
  }

  // Multiple images → process each and bundle into a ZIP
  const zip = new JSZip();
  const sharePerFile = 80 / files.length;

  for (let i = 0; i < files.length; i++) {
    const originalUrl = URL.createObjectURL(files[i]);
    const blob = await processOne(files[i], i * sharePerFile, sharePerFile);
    const processedUrl = URL.createObjectURL(blob);
    
    previews.push({
      name: files[i].name,
      originalUrl,
      processedUrl,
    });

    const baseName = files[i].name.replace(/\.[^.]+$/, '');
    zip.file(`${baseName}_nobg.png`, blob);
  }

  if (onProgress) onProgress(90);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  if (onProgress) onProgress(100);
  return { url: URL.createObjectURL(zipBlob), extension: 'zip', previews };
}

/**
 * Helper to parse SVG dimensions (width, height, or viewBox).
 */
async function getSvgDimensions(file: File): Promise<{ width: number; height: number }> {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) {
      return { width: 800, height: 800 };
    }
    
    const width = parseFloat(svg.getAttribute('width') || '');
    const height = parseFloat(svg.getAttribute('height') || '');
    
    if (isNaN(width) || isNaN(height)) {
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.trim().split(/\s+/).map(parseFloat);
        if (parts.length === 4) {
          return { width: parts[2], height: parts[3] };
        }
      }
    }
    
    return { 
      width: width || 800, 
      height: height || 800 
    };
  } catch {
    return { width: 800, height: 800 };
  }
}

/**
 * Helper to load an image from a URL.
 */
function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to render SVG. Please ensure the file is valid.'));
    img.src = url;
  });
}

/**
 * Convert SVG files to PNG images using HTML5 Canvas.
 */
export async function svgToPng(
  files: File[],
  scale: number = 1.0,
  onProgress?: (p: number) => void
): Promise<{ url: string; extension: string }> {
  const convertOne = async (file: File): Promise<Blob> => {
    const dimensions = await getSvgDimensions(file);
    const width = Math.round(dimensions.width * scale);
    const height = Math.round(dimensions.height * scale);

    const objectUrl = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadSvgImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context.');

    // Clear and draw image
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export PNG.'))), 'image/png');
    });
  };

  if (files.length === 1) {
    const blob = await convertOne(files[0]);
    if (onProgress) onProgress(100);
    return { url: URL.createObjectURL(blob), extension: 'png' };
  }

  const zip = new JSZip();
  const sharePerFile = 80 / files.length;
  for (let i = 0; i < files.length; i++) {
    const blob = await convertOne(files[i]);
    const baseName = files[i].name.replace(/\.[^.]+$/, '');
    zip.file(`${baseName}.png`, blob);
    if (onProgress) onProgress(Math.round(((i + 1) / files.length) * sharePerFile));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  if (onProgress) onProgress(100);
  return { url: URL.createObjectURL(zipBlob), extension: 'zip' };
}

/**
 * Convert images between formats (PNG, JPEG, WebP) using HTML5 Canvas.
 * Handles transparency gracefully (compositing over white background for JPEG).
 */
export async function convertImageFormat(
  files: File[],
  targetFormat: 'png' | 'jpeg' | 'webp',
  options: {
    quality?: number;
    backgroundColor?: string;
  } = {},
  onProgress?: (p: number) => void
): Promise<{ url: string; extension: string }> {
  const extension = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
  const mimeType = `image/${targetFormat}`;
  const quality = options.quality ?? (targetFormat === 'png' ? undefined : targetFormat === 'jpeg' ? 0.92 : 0.85);

  const convertOne = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not create canvas context.'));
          return;
        }

        if (targetFormat === 'jpeg') {
          ctx.fillStyle = options.backgroundColor || '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error(`Failed to convert image to ${extension.toUpperCase()}.`));
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to read image "${file.name}". Please ensure it is a valid image file.`));
      };

      img.src = objectUrl;
    });
  };

  if (files.length === 1) {
    const blob = await convertOne(files[0]);
    if (onProgress) onProgress(100);
    return { url: URL.createObjectURL(blob), extension };
  }

  const zip = new JSZip();
  const sharePerFile = 80 / files.length;
  for (let i = 0; i < files.length; i++) {
    const blob = await convertOne(files[i]);
    const baseName = files[i].name.replace(/\.[^.]+$/, '');
    zip.file(`${baseName}.${extension}`, blob);
    if (onProgress) onProgress(Math.round(((i + 1) / files.length) * sharePerFile));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  if (onProgress) onProgress(100);
  return { url: URL.createObjectURL(zipBlob), extension: 'zip' };
}

