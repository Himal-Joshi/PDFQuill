import { PDFDocument, rgb, StandardFonts, type PDFImage } from 'pdf-lib';
import type { EditorElement, TextElement, ImageElement, StampElement } from '../components/editor/types.ts';
import { canvasToPdfCoords, hexToRgb } from './editorCoordinates.ts';

function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function exportEditedPdf(
  originalPdfBytes: Uint8Array,
  elements: EditorElement[],
  pageCanvasSizes: Map<number, { width: number; height: number }>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();

  // Font cache
  const fonts = {
    helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    helveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    helveticaOblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    timesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    timesBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    courier: await pdfDoc.embedFont(StandardFonts.Courier),
    courierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
  };

  // Cache embedded images to prevent duplication
  const embeddedImageCache = new Map<string, PDFImage>();

  for (const element of elements) {
    if (element.pageIndex < 0 || element.pageIndex >= pages.length) continue;
    const page = pages[element.pageIndex];
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const canvasSize = pageCanvasSizes.get(element.pageIndex) || { width: pdfWidth, height: pdfHeight };

    const coords = canvasToPdfCoords(element, canvasSize, { width: pdfWidth, height: pdfHeight });

    if (element.type === 'text') {
      const textElem = element as TextElement;
      let font = fonts.helvetica;
      if (textElem.fontFamily === 'TimesRoman') {
        font = textElem.bold ? fonts.timesBold : fonts.timesRoman;
      } else if (textElem.fontFamily === 'Courier') {
        font = textElem.bold ? fonts.courierBold : fonts.courier;
      } else {
        font = textElem.bold ? fonts.helveticaBold : (textElem.italic ? fonts.helveticaOblique : fonts.helvetica);
      }

      const { r, g, b } = hexToRgb(textElem.color);
      const fontSize = textElem.fontSize || 14;

      // Split multi-line text
      const lines = textElem.text.split('\n');
      const lineHeight = fontSize * 1.25;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const lineY = coords.y + coords.height - ((i + 1) * lineHeight) + (lineHeight * 0.2);
        page.drawText(line, {
          x: coords.x,
          y: Math.max(0, lineY),
          size: fontSize,
          font,
          color: rgb(r, g, b),
        });
      }
    } else if (element.type === 'image' || element.type === 'signature') {
      const imgElem = element as ImageElement;
      let embeddedImage = embeddedImageCache.get(imgElem.dataUrl);

      if (!embeddedImage) {
        const imageBytes = base64ToUint8Array(imgElem.dataUrl);
        const isJpg = imgElem.dataUrl.startsWith('data:image/jpeg') || imgElem.dataUrl.startsWith('data:image/jpg');
        embeddedImage = isJpg ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes);
        embeddedImageCache.set(imgElem.dataUrl, embeddedImage);
      }

      page.drawImage(embeddedImage, {
        x: coords.x,
        y: coords.y,
        width: Math.max(1, coords.width),
        height: Math.max(1, coords.height),
      });
    } else if (element.type === 'stamp') {
      const stampElem = element as StampElement;
      const { r, g, b } = hexToRgb(stampElem.color);
      const symbolText = stampElem.stampType === 'check' ? '✓' : (stampElem.stampType === 'cross' ? '✕' : stampElem.textValue || '');
      
      page.drawText(symbolText, {
        x: coords.x,
        y: coords.y,
        size: stampElem.fontSize || 18,
        font: fonts.helveticaBold,
        color: rgb(r, g, b),
      });
    }
  }

  return await pdfDoc.save();
}
