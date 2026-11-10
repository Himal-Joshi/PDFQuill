import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasToPdfCoords, hexToRgb, clamp } from './editorCoordinates.ts';

test('canvasToPdfCoords inverts Y-axis and scales proportionally', () => {
  const canvasSize = { width: 800, height: 1000 };
  const pdfSize = { width: 400, height: 500 };

  const elemTopLeft = { x: 0, y: 0, width: 100, height: 50 };
  const pdfTopLeft = canvasToPdfCoords(elemTopLeft, canvasSize, pdfSize);

  assert.equal(pdfTopLeft.x, 0);
  assert.equal(pdfTopLeft.width, 50);
  assert.equal(pdfTopLeft.height, 25);
  assert.equal(pdfTopLeft.y, 475);
});

test('canvasToPdfCoords handles bottom-right element', () => {
  const canvasSize = { width: 1000, height: 1000 };
  const pdfSize = { width: 500, height: 500 };
  const elem = { x: 800, y: 900, width: 200, height: 100 };
  const result = canvasToPdfCoords(elem, canvasSize, pdfSize);

  assert.equal(result.x, 400);
  assert.equal(result.width, 100);
  assert.equal(result.height, 50);
  assert.equal(result.y, 0);
});

test('hexToRgb correctly parses 6-digit hex values', () => {
  assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(hexToRgb('#ffffff'), { r: 1, g: 1, b: 1 });
  assert.deepEqual(hexToRgb('#ff0000'), { r: 1, g: 0, b: 0 });
  assert.deepEqual(hexToRgb('invalid'), { r: 0, g: 0, b: 0 });
});

test('clamp restricts number to range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});
