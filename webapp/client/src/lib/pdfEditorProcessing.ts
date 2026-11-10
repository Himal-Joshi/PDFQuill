import { PDFDocument, rgb, StandardFonts, type PDFImage } from 'pdf-lib';
import type { EditorElement, TextElement, ImageElement, StampElement, ShapeElement, DrawingElement } from '../components/editor/types.ts';
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
  pageCanvasSizes?: Map<number, { width: number; height: number }>
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
    const canvasSize = pageCanvasSizes?.get(element.pageIndex) || { width: pdfWidth, height: pdfHeight };

    const coords = canvasToPdfCoords(element, canvasSize, { width: pdfWidth, height: pdfHeight });

    if (element.type === 'text') {
      const textElem = element as TextElement;

      // Draw background fill if set (e.g. whiteout or yellow highlight)
      if (textElem.backgroundColor && textElem.backgroundColor !== 'transparent') {
        const bgRgb = hexToRgb(textElem.backgroundColor);
        page.drawRectangle({
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height,
          color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
        });
      }

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
          x: coords.x + 4, // 4px padding offset matching textarea p-1
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
    } else if (element.type === 'shape') {
      const shapeElem = element as ShapeElement;
      const hasFill = shapeElem.fillColor && shapeElem.fillColor !== 'transparent';
      const hasStroke = shapeElem.strokeColor && shapeElem.strokeColor !== 'transparent' && shapeElem.strokeWidth > 0;

      const fill = hasFill ? hexToRgb(shapeElem.fillColor) : null;
      const stroke = hasStroke ? hexToRgb(shapeElem.strokeColor) : null;

      if (shapeElem.shapeType === 'rectangle') {
        page.drawRectangle({
          x: coords.x,
          y: coords.y,
          width: Math.max(1, coords.width),
          height: Math.max(1, coords.height),
          color: fill ? rgb(fill.r, fill.g, fill.b) : undefined,
          borderColor: stroke ? rgb(stroke.r, stroke.g, stroke.b) : undefined,
          borderWidth: hasStroke ? shapeElem.strokeWidth : 0,
          opacity: shapeElem.opacity ?? 1,
        });
      } else if (shapeElem.shapeType === 'circle') {
        const radiusX = Math.max(1, coords.width / 2);
        const radiusY = Math.max(1, coords.height / 2);
        page.drawEllipse({
          x: coords.x + radiusX,
          y: coords.y + radiusY,
          xScale: radiusX,
          yScale: radiusY,
          color: fill ? rgb(fill.r, fill.g, fill.b) : undefined,
          borderColor: stroke ? rgb(stroke.r, stroke.g, stroke.b) : undefined,
          borderWidth: hasStroke ? shapeElem.strokeWidth : 0,
          opacity: shapeElem.opacity ?? 1,
        });
      } else if (shapeElem.shapeType === 'line') {
        const lineCol = stroke || { r: 0, g: 0, b: 0 };
        page.drawLine({
          start: { x: coords.x, y: coords.y + coords.height },
          end: { x: coords.x + coords.width, y: coords.y },
          thickness: shapeElem.strokeWidth || 2,
          color: rgb(lineCol.r, lineCol.g, lineCol.b),
          opacity: shapeElem.opacity ?? 1,
        });
      }
    } else if (element.type === 'drawing') {
      const drawElem = element as DrawingElement;
      if (drawElem.points && drawElem.points.length >= 2) {
        const drawColor = hexToRgb(drawElem.color || '#000000');
        const color = rgb(drawColor.r, drawColor.g, drawColor.b);
        const opacity = drawElem.isHighlighter ? 0.35 : (drawElem.opacity ?? 1);
        const thickness = drawElem.strokeWidth || 3;

        for (let i = 0; i < drawElem.points.length - 1; i++) {
          const pt1 = drawElem.points[i];
          const pt2 = drawElem.points[i + 1];
          const p1 = canvasToPdfCoords({ x: pt1.x, y: pt1.y, width: 0, height: 0 }, canvasSize, { width: pdfWidth, height: pdfHeight });
          const p2 = canvasToPdfCoords({ x: pt2.x, y: pt2.y, width: 0, height: 0 }, canvasSize, { width: pdfWidth, height: pdfHeight });

          page.drawLine({
            start: { x: p1.x, y: p1.y },
            end: { x: p2.x, y: p2.y },
            thickness,
            color,
            opacity,
          });
        }
      }
    } else if (element.type === 'stamp') {
      const stampElem = element as StampElement;
      const { r, g, b } = hexToRgb(stampElem.color);
      const color = rgb(r, g, b);

      if (stampElem.stampType === 'check') {
        const thickness = Math.max(2, (stampElem.fontSize || 18) * 0.12);
        const p1 = { x: coords.x + coords.width * 0.1, y: coords.y + coords.height * 0.45 };
        const p2 = { x: coords.x + coords.width * 0.38, y: coords.y + coords.height * 0.15 };
        const p3 = { x: coords.x + coords.width * 0.9, y: coords.y + coords.height * 0.85 };
        page.drawLine({ start: p1, end: p2, thickness, color });
        page.drawLine({ start: p2, end: p3, thickness, color });
      } else if (stampElem.stampType === 'cross') {
        const thickness = Math.max(2, (stampElem.fontSize || 18) * 0.12);
        page.drawLine({
          start: { x: coords.x + coords.width * 0.15, y: coords.y + coords.height * 0.15 },
          end: { x: coords.x + coords.width * 0.85, y: coords.y + coords.height * 0.85 },
          thickness,
          color,
        });
        page.drawLine({
          start: { x: coords.x + coords.width * 0.15, y: coords.y + coords.height * 0.85 },
          end: { x: coords.x + coords.width * 0.85, y: coords.y + coords.height * 0.15 },
          thickness,
          color,
        });
      } else if (stampElem.textValue) {
        page.drawText(stampElem.textValue, {
          x: coords.x,
          y: coords.y,
          size: stampElem.fontSize || 14,
          font: fonts.helveticaBold,
          color,
        });
      }
    }
  }

  return await pdfDoc.save();
}
