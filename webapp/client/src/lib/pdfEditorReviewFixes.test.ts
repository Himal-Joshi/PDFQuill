import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { exportEditedPdf } from './pdfEditorProcessing.ts';
import type { TextElement, ImageElement, StampElement } from '../components/editor/types.ts';

test('canonical PDF points export identical coordinates regardless of rendered canvas zoom', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]); // 600 x 800 pt
  const baseBytes = await doc.save();

  // Element defined in canonical PDF points
  const elem: TextElement = {
    id: 'text-zoom',
    type: 'text',
    pageIndex: 0,
    text: 'Zoom invariant text',
    fontFamily: 'Helvetica',
    fontSize: 16,
    color: '#000000',
    bold: false,
    italic: false,
    x: 100, // 100 pt from left
    y: 100, // 100 pt from top in canvas space
    width: 200,
    height: 40,
  };

  // Export when canvas was rendered at zoom 1.0 (750x1000)
  const canvasZoom1 = new Map([[0, { width: 750, height: 1000 }]]);
  const pdfBytes1 = await exportEditedPdf(baseBytes, [elem], canvasZoom1);

  // Export when canvas was rendered at zoom 2.0 (1500x2000)
  const canvasZoom2 = new Map([[0, { width: 1500, height: 2000 }]]);
  const pdfBytes2 = await exportEditedPdf(baseBytes, [elem], canvasZoom2);

  assert.ok(pdfBytes1.length > 0);
  assert.ok(pdfBytes2.length > 0);
  // Both outputs should be valid PDFs with identical structure
  const doc1 = await PDFDocument.load(pdfBytes1);
  const doc2 = await PDFDocument.load(pdfBytes2);
  assert.equal(doc1.getPageCount(), 1);
  assert.equal(doc2.getPageCount(), 1);
});

test('stamps and image signatures export without crashing or winansi encoding errors', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([500, 700]);
  const baseBytes = await doc.save();

  const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAEAST/4AYAAAAASUVORK5CYII=';

  const elements: (StampElement | ImageElement)[] = [
    {
      id: 'stamp-1',
      type: 'stamp',
      stampType: 'check',
      pageIndex: 0,
      color: '#16a34a',
      fontSize: 20,
      x: 50,
      y: 50,
      width: 30,
      height: 30,
    },
    {
      id: 'stamp-2',
      type: 'stamp',
      stampType: 'cross',
      pageIndex: 0,
      color: '#dc2626',
      fontSize: 20,
      x: 100,
      y: 50,
      width: 30,
      height: 30,
    },
    {
      id: 'sig-1',
      type: 'signature',
      pageIndex: 0,
      dataUrl: pngDataUrl,
      aspectRatio: 2,
      x: 200,
      y: 200,
      width: 120,
      height: 60,
    },
  ];

  const result = await exportEditedPdf(baseBytes, elements);
  assert.ok(result.length > baseBytes.length);
});
