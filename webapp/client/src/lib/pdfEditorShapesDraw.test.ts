import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { exportEditedPdf } from './pdfEditorProcessing.ts';
import type { ShapeElement, DrawingElement } from '../components/editor/types.ts';

test('exportEditedPdf correctly bakes rectangle shapes (whiteout and borders)', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const baseBytes = await doc.save();

  const whiteoutRect: ShapeElement = {
    id: 'rect-whiteout',
    type: 'shape',
    shapeType: 'rectangle',
    pageIndex: 0,
    x: 100,
    y: 100,
    width: 200,
    height: 50,
    fillColor: '#ffffff',
    strokeColor: 'transparent',
    strokeWidth: 0,
    opacity: 1,
  };

  const borderCircle: ShapeElement = {
    id: 'circle-border',
    type: 'shape',
    shapeType: 'circle',
    pageIndex: 0,
    x: 350,
    y: 100,
    width: 80,
    height: 80,
    fillColor: 'transparent',
    strokeColor: '#dc2626',
    strokeWidth: 2,
    opacity: 1,
  };

  const edited = await exportEditedPdf(baseBytes, [whiteoutRect, borderCircle]);
  assert.ok(edited.length > baseBytes.length);
  const reloaded = await PDFDocument.load(edited);
  assert.equal(reloaded.getPageCount(), 1);
});

test('exportEditedPdf correctly bakes freehand drawing paths', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const baseBytes = await doc.save();

  const drawing: DrawingElement = {
    id: 'draw-1',
    type: 'drawing',
    pageIndex: 0,
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    color: '#1d4ed8',
    strokeWidth: 3,
    opacity: 1,
    points: [
      { x: 50, y: 50 },
      { x: 80, y: 70 },
      { x: 120, y: 110 },
      { x: 150, y: 150 },
    ],
  };

  const edited = await exportEditedPdf(baseBytes, [drawing]);
  assert.ok(edited.length > baseBytes.length);
});
