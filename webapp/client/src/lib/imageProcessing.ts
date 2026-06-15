import { removeBackground as imglyRemoveBg } from '@imgly/background-removal';
import JSZip from 'jszip';

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
    const blob = await imglyRemoveBg(file, {
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
    });

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
