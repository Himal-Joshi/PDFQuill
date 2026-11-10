import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { exportEditedPdf } from './pdfEditorProcessing.ts';
import type { TextElement, ImageElement } from '../components/editor/types.ts';

test('exportEditedPdf adds text element and produces valid PDF bytes', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const baseBytes = await doc.save();

  const textElement: TextElement = {
    id: 'text-1',
    type: 'text',
    pageIndex: 0,
    text: 'Hello PDFQuill',
    fontFamily: 'Helvetica',
    fontSize: 16,
    color: '#000000',
    bold: false,
    italic: false,
    x: 50,
    y: 50,
    width: 200,
    height: 30,
  };

  const canvasSizes = new Map([[0, { width: 600, height: 800 }]]);
  const editedBytes = await exportEditedPdf(baseBytes, [textElement], canvasSizes);

  assert.ok(editedBytes.length > baseBytes.length);
  const reloaded = await PDFDocument.load(editedBytes);
  assert.equal(reloaded.getPageCount(), 1);
});

test('exportEditedPdf embeds 1x1 PNG image correctly', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const baseBytes = await doc.save();

  const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAEAST/4AYAAAAASUVORK5CYII=';

  const imageElement: ImageElement = {
    id: 'img-1',
    type: 'signature',
    pageIndex: 0,
    dataUrl: pngDataUrl,
    aspectRatio: 1,
    x: 100,
    y: 100,
    width: 150,
    height: 150,
  };

  const canvasSizes = new Map([[0, { width: 600, height: 800 }]]);
  const editedBytes = await exportEditedPdf(baseBytes, [imageElement], canvasSizes);

  assert.ok(editedBytes.length > baseBytes.length);
});
