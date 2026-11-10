import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { exportEditedPdf } from '../../lib/pdfEditorProcessing.ts';
import type { TextElement, StampElement, ImageElement } from './types.ts';

test('Full flow: multi-page PDF with annotations on page 1 and page 2 exports correctly', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([500, 700]);
  doc.addPage([500, 700]);
  const originalBytes = await doc.save();

  const elements: (TextElement | StampElement | ImageElement)[] = [
    {
      id: 'text-p1',
      type: 'text',
      pageIndex: 0,
      text: 'First Page Text',
      fontFamily: 'Helvetica',
      fontSize: 14,
      color: '#000000',
      bold: false,
      italic: false,
      x: 50,
      y: 50,
      width: 150,
      height: 30,
    },
    {
      id: 'stamp-p2',
      type: 'stamp',
      stampType: 'check',
      pageIndex: 1,
      color: '#16a34a',
      fontSize: 20,
      x: 100,
      y: 200,
      width: 40,
      height: 40,
    },
  ];

  const canvasSizes = new Map([
    [0, { width: 500, height: 700 }],
    [1, { width: 500, height: 700 }],
  ]);

  const outputBytes = await exportEditedPdf(originalBytes, elements, canvasSizes);
  assert.ok(outputBytes.length > originalBytes.length);

  const reloaded = await PDFDocument.load(outputBytes);
  assert.equal(reloaded.getPageCount(), 2);
});
