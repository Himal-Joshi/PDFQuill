# PDFQuill PDF Editor (Text Fill & Signatures) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professional, 100% client-side interactive PDF Editor tool for PDFQuill supporting text form filling, image & drawn signatures, date/check stamps, and high-fidelity PDF export via `pdf-lib`.

**Architecture:** A modular editor system under `webapp/client/src/components/editor/` featuring a high-DPI PDF.js canvas viewer, an absolute interactive annotation layer for draggable/resizable elements, a signature drawing modal, undo/redo state management, and an export engine that maps screen coordinates to PDF points and embeds fonts and PNG signatures.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, `pdf-lib`, `pdfjs-dist`, and Node.js test runner (`node --test`).

**Spec:** [`docs/superpowers/specs/2026-11-10-pdf-editor-design.md`](file:///e:/Projects/PDFQuill/docs/superpowers/specs/2026-11-10-pdf-editor-design.md)

## Global Constraints

- 100% client-side processing: no document or signature data is ever transmitted to a server.
- High-DPI canvas rendering using `window.devicePixelRatio` to prevent blurry text or pages.
- Standard fonts only (`StandardFonts.Helvetica`, `StandardFonts.TimesRoman`, `StandardFonts.Courier`) for zero network overhead.
- All element positions stored in coordinates relative to rendered canvas and mapped deterministically to PDF point coordinates (72 points per inch, bottom-left origin).
- Build and type-checking must pass cleanly with `tsc -b && vite build`.

## Review Focus

1. **Y-axis inversion during export:** Browser top-left origin $(0,0)$ must correctly invert to PDF bottom-left origin without vertical drift on pages of various heights.
2. **Aspect ratio locking for signatures:** When resizing uploaded or drawn signatures, aspect ratio must be locked by default so signatures do not distort.
3. **Multi-page annotation persistence:** Adding elements to page 1, switching to page 2, and adding elements must preserve page 1's elements without cross-page leakage.
4. **Transparent PNG signature embedding:** Transparent backgrounds in drawn/scanned signatures must render cleanly over existing PDF text and lines.
5. **Undo/Redo stability:** Undoing an element removal or repositioning must restore the exact position, size, and page index without crashing.

---

### Task 1: Coordinate Transformation & Geometry Helpers

**Files:**
- Create: `webapp/client/src/components/editor/types.ts`
- Create: `webapp/client/src/lib/editorCoordinates.ts`
- Test: `webapp/client/src/lib/editorCoordinates.test.ts`

**Interfaces:**
- Consumes: Nothing
- Produces:
  - `types.ts`: `EditorElement`, `TextElement`, `ImageElement`, `StampElement`, `FontChoice`, `EditorToolMode`
  - `editorCoordinates.ts`:
    - `canvasToPdfCoords(elem: { x: number, y: number, width: number, height: number }, canvasSize: { width: number, height: number }, pdfSize: { width: number, height: number }): { x: number, y: number, width: number, height: number }`
    - `hexToRgb(hex: string): { r: number, g: number, b: number }`
    - `clamp(val: number, min: number, max: number): number`

- [ ] **Step 1: Write the failing test for coordinate transformation and color helpers**

```typescript
// webapp/client/src/lib/editorCoordinates.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasToPdfCoords, hexToRgb, clamp } from './editorCoordinates.ts';

test('canvasToPdfCoords inverts Y-axis and scales proportionally', () => {
  // Canvas 800x1000, PDF 400x500 (2x scaling)
  const canvasSize = { width: 800, height: 1000 };
  const pdfSize = { width: 400, height: 500 };

  // Element at top-left (x=0, y=0, w=100, h=50)
  const elemTopLeft = { x: 0, y: 0, width: 100, height: 50 };
  const pdfTopLeft = canvasToPdfCoords(elemTopLeft, canvasSize, pdfSize);

  assert.equal(pdfTopLeft.x, 0);
  assert.equal(pdfTopLeft.width, 50);
  assert.equal(pdfTopLeft.height, 25);
  // In PDF space, top is Y=500. Element height is 25, so bottom Y is 500 - 25 = 475
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
  // Bottom of canvas is y=1000. In PDF space, bottom is y=0.
  // 500 - ((900 + 100) * 0.5) = 0
  assert.equal(result.y, 0);
});

test('hexToRgb correctly parses 6-digit hex values', () => {
  assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(hexToRgb('#ffffff'), { r: 1, g: 1, b: 1 });
  assert.deepEqual(hexToRgb('#ff0000'), { r: 1, g: 0, b: 0 });
  // Default fallback for invalid
  assert.deepEqual(hexToRgb('invalid'), { r: 0, g: 0, b: 0 });
});

test('clamp restricts number to range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test webapp/client/src/lib/editorCoordinates.test.ts`  
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `types.ts` and `editorCoordinates.ts`**

```typescript
// webapp/client/src/components/editor/types.ts
export type EditorToolMode = 'select' | 'text' | 'signature' | 'stamp-check' | 'stamp-cross' | 'stamp-date';

export type FontChoice = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface BaseElement {
  id: string;
  pageIndex: number;
  x: number;       // relative to canvas in px
  y: number;       // relative to canvas in px
  width: number;   // in px
  height: number;  // in px
  rotation?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: FontChoice;
  fontSize: number; // in points
  color: string;    // hex color
  bold: boolean;
  italic: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image' | 'signature';
  dataUrl: string;       // base64 data URL
  aspectRatio: number;   // width / height
  isSignature?: boolean;
}

export interface StampElement extends BaseElement {
  type: 'stamp';
  stampType: 'check' | 'cross' | 'date';
  textValue?: string;
  color: string;
  fontSize: number;
}

export type EditorElement = TextElement | ImageElement | StampElement;

export interface EditorHistoryState {
  past: EditorElement[][];
  present: EditorElement[];
  future: EditorElement[][];
}
```

```typescript
// webapp/client/src/lib/editorCoordinates.ts
export function canvasToPdfCoords(
  elem: { x: number; y: number; width: number; height: number },
  canvasSize: { width: number; height: number },
  pdfSize: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const scaleX = pdfSize.width / canvasSize.width;
  const scaleY = pdfSize.height / canvasSize.height;

  const pdfWidth = elem.width * scaleX;
  const pdfHeight = elem.height * scaleY;
  const pdfX = elem.x * scaleX;
  // Browser top-left (0,0) to PDF bottom-left (0,0)
  const pdfY = pdfSize.height - ((elem.y + elem.height) * scaleY);

  return {
    x: Math.round(pdfX * 100) / 100,
    y: Math.round(pdfY * 100) / 100,
    width: Math.round(pdfWidth * 100) / 100,
    height: Math.round(pdfHeight * 100) / 100,
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: Math.round(r * 1000) / 1000,
    g: Math.round(g * 1000) / 1000,
    b: Math.round(b * 1000) / 1000,
  };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test webapp/client/src/lib/editorCoordinates.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add webapp/client/src/components/editor/types.ts webapp/client/src/lib/editorCoordinates.ts webapp/client/src/lib/editorCoordinates.test.ts
git commit -m "feat(editor): add editor types and coordinate conversion helpers with tests"
```

---

### Task 2: PDF-Lib Export Engine

**Files:**
- Create: `webapp/client/src/lib/pdfEditorProcessing.ts`
- Test: `webapp/client/src/lib/pdfEditorProcessing.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `editorCoordinates.ts`
- Produces:
  - `exportEditedPdf(originalPdfBytes: Uint8Array, elements: EditorElement[], pageCanvasSizes: Map<number, { width: number, height: number }>): Promise<Uint8Array>`

- [ ] **Step 1: Write the failing test for PDF export engine**

```typescript
// webapp/client/src/lib/pdfEditorProcessing.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { exportEditedPdf } from './pdfEditorProcessing.ts';
import type { TextElement, ImageElement } from '../components/editor/types.ts';

test('exportEditedPdf adds text element and produces valid PDF bytes', async () => {
  // Create a minimal blank 1-page PDF
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

  // Valid 1x1 transparent PNG data URL
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test webapp/client/src/lib/pdfEditorProcessing.test.ts`  
Expected: FAIL (cannot find module)

- [ ] **Step 3: Implement `pdfEditorProcessing.ts`**

```typescript
// webapp/client/src/lib/pdfEditorProcessing.ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
  const embeddedImageCache = new Map<string, any>();

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

      // Handle multi-line text
      const lines = textElem.text.split('\n');
      const lineHeight = fontSize * 1.2;

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
        width: coords.width,
        height: coords.height,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test webapp/client/src/lib/pdfEditorProcessing.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add webapp/client/src/lib/pdfEditorProcessing.ts webapp/client/src/lib/pdfEditorProcessing.test.ts
git commit -m "feat(editor): implement pdf-lib export engine with text and image embedding"
```

---

### Task 3: Signature Drawing Pad & Image Upload Modal

**Files:**
- Create: `webapp/client/src/components/editor/SignatureModal.tsx`

**Interfaces:**
- Consumes: Lucide icons, Tailwind styling
- Produces:
  - `<SignatureModal isOpen={boolean} onClose={() => void} onSaveSignature={(dataUrl: string, aspectRatio: number) => void} />`

- [ ] **Step 1: Implement `SignatureModal.tsx`**

Features:
- Dual tabs: "Draw Signature" and "Upload Image"
- Draw tab:
  - Canvas with smooth line drawing using pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`).
  - Color choices: Black (`#0f172a`), Dark Navy (`#1e3a8a`), Crimson (`#991b1b`).
  - Clear canvas button.
  - Auto-crop bounding box to trim transparent margin around drawn signature for clean stamp fit.
- Upload tab:
  - Drag-and-drop or click to browse image (PNG, JPG, SVG).
  - Background removal / thresholding toggle to convert scanned paper signatures to clean transparent PNGs.
  - Calculates true `aspectRatio = image.width / image.height`.
- Professional modal dialog styling with backdrop blur and smooth transitions.

- [ ] **Step 2: Verify type check passes**

Run: `cd webapp/client; npm run build`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add webapp/client/src/components/editor/SignatureModal.tsx
git commit -m "feat(editor): create signature modal with vector-like drawing pad and image upload"
```

---

### Task 4: Interactive Canvas & Element Overlays

**Files:**
- Create: `webapp/client/src/components/editor/TextElementOverlay.tsx`
- Create: `webapp/client/src/components/editor/ImageElementOverlay.tsx`
- Create: `webapp/client/src/components/editor/EditorCanvas.tsx`

**Interfaces:**
- Consumes: `types.ts`, `pdfjs-dist`
- Produces:
  - `<TextElementOverlay element={TextElement} isSelected={boolean} onSelect={fn} onChange={fn} onDelete={fn} onDuplicate={fn} />`
  - `<ImageElementOverlay element={ImageElement} isSelected={boolean} onSelect={fn} onChange={fn} onDelete={fn} onDuplicate={fn} />`
  - `<EditorCanvas pdfDoc={PDFDocumentProxy} currentPage={number} zoom={number} elements={EditorElement[]} ... />`

- [ ] **Step 1: Implement `TextElementOverlay.tsx`**
  - Renders inline editable textarea or text block.
  - Floating contextual formatting menu when selected (Font Size, Bold, Italic, Color picker, Duplicate, Delete).
  - Corner resize handle (adjusts width and height).
  - Drag-to-position with pointer events and bounding box constraints.

- [ ] **Step 2: Implement `ImageElementOverlay.tsx`**
  - Renders signature/image inside a responsive container.
  - 4 corner handles that maintain aspect ratio automatically during resize.
  - Delete and Duplicate badges.
  - Drag-to-position support.

- [ ] **Step 3: Implement `EditorCanvas.tsx`**
  - Uses `pdfjs-dist` to render current PDF page onto `<canvas>` with `window.devicePixelRatio` scaling.
  - Measures rendered canvas dimensions and exposes them to the parent via `onCanvasSizeChange(pageIndex, width, height)`.
  - Overlays active page's elements atop the canvas.
  - Handles click-to-place when tool is in `'text'` or stamp mode.

- [ ] **Step 4: Verify type check passes**

Run: `cd webapp/client; npm run build`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add webapp/client/src/components/editor/TextElementOverlay.tsx webapp/client/src/components/editor/ImageElementOverlay.tsx webapp/client/src/components/editor/EditorCanvas.tsx
git commit -m "feat(editor): build high-DPI canvas viewer and draggable/resizable element overlays"
```

---

### Task 5: Editor Toolbar & Page Navigation Sidebar

**Files:**
- Create: `webapp/client/src/components/editor/EditorToolbar.tsx`
- Create: `webapp/client/src/components/editor/EditorSidebar.tsx`
- Create: `webapp/client/src/components/editor/PdfEditor.tsx`

**Interfaces:**
- Consumes: `EditorCanvas`, `SignatureModal`, `pdfEditorProcessing`, `types.ts`
- Produces:
  - `<PdfEditor file={File} onBack={() => void} />`

- [ ] **Step 1: Implement `EditorSidebar.tsx`**
  - Renders thumbnail carousel/list for all pages using `pdfThumbnails.ts`.
  - Shows page number badges and count of elements on each page.
  - Click to jump to page.

- [ ] **Step 2: Implement `EditorToolbar.tsx`**
  - Tool selectors: `Select`, `Add Text`, `Add Signature`, `Date Stamp`, `Checkmark (✓)`, `Cross (✕)`.
  - Undo / Redo buttons with keyboard indicator (`Ctrl+Z`, `Ctrl+Y`).
  - Zoom controls: Zoom In (`+`), Zoom Out (`-`), Zoom Fit (`100%`).
  - Primary button: "Save & Download PDF" with loading spinner during export.

- [ ] **Step 3: Implement `PdfEditor.tsx` container**
  - Manages full state:
    - `elements: EditorElement[]`
    - `history: EditorHistoryState`
    - `currentPage: number`
    - `zoom: number`
    - `activeTool: EditorToolMode`
    - `selectedElementId: string | null`
  - Keyboard listeners for `Delete`, `Backspace`, `Ctrl+Z`, `Ctrl+Y`.
  - Integrates `exportEditedPdf` to serialize and trigger file download `<filename>_edited.pdf`.

- [ ] **Step 4: Verify build succeeds**

Run: `cd webapp/client; npm run build`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add webapp/client/src/components/editor/EditorToolbar.tsx webapp/client/src/components/editor/EditorSidebar.tsx webapp/client/src/components/editor/PdfEditor.tsx
git commit -m "feat(editor): assemble main PdfEditor workbench with toolbar, sidebar, and undo/redo"
```

---

### Task 6: PDFQuill App Integration & Verification

**Files:**
- Modify: `webapp/client/src/App.tsx`
- Test: `webapp/client/src/components/editor/PdfEditor.test.ts`

- [ ] **Step 1: Register `edit-pdf` tool in `App.tsx`**
  - Add `'edit-pdf'` to the `Tool` type.
  - Add tool card to `tools` array:
    ```typescript
    {
      id: 'edit-pdf',
      label: 'Edit PDF',
      description: 'Fill text, add dates and checkmarks, and draw or place signatures on your PDF.',
      endpoint: '',
      icon: 'edit_document',
      lucideIcon: Edit3, // or PenTool
    }
    ```
  - In workspace view, when `activeTool === 'edit-pdf'` and file is selected, render `<PdfEditor file={files[0]} onBack={handleBackToHome} />`.

- [ ] **Step 2: Write end-to-end integration test**

```typescript
// webapp/client/src/components/editor/PdfEditor.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { exportEditedPdf } from '../../lib/pdfEditorProcessing.ts';
import type { TextElement, StampElement } from './types.ts';

test('Full flow: multi-page PDF with annotations on page 1 and page 2 exports correctly', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([500, 700]);
  doc.addPage([500, 700]);
  const originalBytes = await doc.save();

  const elements: (TextElement | StampElement)[] = [
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
```

- [ ] **Step 3: Run all unit and integration tests**

Run: `node --test webapp/client/src/lib/editorCoordinates.test.ts webapp/client/src/lib/pdfEditorProcessing.test.ts webapp/client/src/components/editor/PdfEditor.test.ts`  
Expected: ALL PASS

- [ ] **Step 4: Run full project type-check and production build**

Run: `cd webapp/client; npm run build`  
Expected: Exit code 0 (clean build)

- [ ] **Step 5: Commit and finalize**

```bash
git add webapp/client/src/App.tsx webapp/client/src/components/editor/PdfEditor.test.ts
git commit -m "feat(editor): integrate Edit PDF tool into PDFQuill with full test verification"
```
