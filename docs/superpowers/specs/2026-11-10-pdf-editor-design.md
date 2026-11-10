# PDFQuill PDF Editor (Text Fill & Signatures) Design Specification

**Date:** 2026-11-10  
**Feature:** PDF Edit Tool (Interactive Text Fill, Image/Drawn Signatures & Stamps)  
**Status:** Approved for Implementation Planning  
**Target Platform:** Web Client (`webapp/client`) & Desktop (Tauri v2)

---

## 1. Overview & Objectives

PDFQuill currently supports 22+ file and PDF manipulation operations (merge, split, compress, watermark, ocr, format conversions, etc.). A critical missing capability is an interactive, in-browser document editor where users can open any PDF, fill in form text, draw or upload signatures, insert date/checkbox stamps, manipulate them on a visual canvas, and export a finalized, professional PDF document.

### Key Objectives
1. **100% Client-Side & Private:** All rendering, drawing, signature handling, and PDF generation occurs strictly in the browser using `pdfjs-dist` and `pdf-lib`. No files are uploaded to any server.
2. **Professional Interactive UI:** Clean, intuitive workspace inspired by modern document tools (such as iLovePDF Edit PDF and Adobe Acrobat Web):
   - Centered zoomable/pannable high-DPI document canvas.
   - Left-hand page thumbnail preview rail for effortless multi-page navigation.
   - Top floating/docked toolbar with tool selectors, element-specific controls, zoom controls, and undo/redo buttons.
   - Distinct, draggable, resizable bounding boxes with active manipulation handles and quick deletion/duplication badges.
3. **Robust Input Modes:**
   - **Text:** Freeform text blocks with adjustable font family, font size, text color, bold, and italic styling.
   - **Signatures:** Dual-mode signature creator — smooth vector-like freehand drawing pad or image upload (with optional white background removal).
   - **Stamps & Quick Fill:** One-click Date stamp and Checkmark (✓) / Cross (✕) symbols for rapid form completion.
4. **Pixel-Perfect PDF Export:** Accurate coordinate transformation between browser screen pixels and standard PDF coordinate space (72 DPI, bottom-left origin), embedding standard fonts and lossless images.

---

## 2. Architecture & File Structure

The PDF editor is implemented as a modular subsystem under `webapp/client/src/components/editor/` to avoid bloating the existing `App.tsx` and preserve separation of concerns.

```
webapp/client/src/
├── components/
│   └── editor/
│       ├── PdfEditor.tsx           # Primary workspace container & layout coordinator
│       ├── EditorToolbar.tsx       # Top toolbar (tools, formatting, zoom, undo/redo)
│       ├── EditorSidebar.tsx       # Left-hand page thumbnail drawer & page switching
│       ├── EditorCanvas.tsx        # High-DPI PDF page renderer & element overlay container
│       ├── TextElementOverlay.tsx  # Draggable/resizable text element component
│       ├── ImageElementOverlay.tsx # Draggable/resizable signature & image element component
│       ├── SignatureModal.tsx      # Draw signature pad & image upload dialog
│       └── types.ts                # TypeScript interfaces, types, and constants
└── lib/
    ├── pdfEditorProcessing.ts     # pdf-lib export engine (bakes elements into PDF bytes)
    └── editorCoordinates.ts       # Coordinate conversion (screen space <-> PDF points)
```

---

## 3. Data Models & Types (`types.ts`)

```typescript
export type EditorToolMode = 'select' | 'text' | 'signature' | 'stamp-check' | 'stamp-cross' | 'stamp-date';

export type FontChoice = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface BaseElement {
  id: string;
  pageIndex: number;
  x: number;       // Normalized or pixel X coordinate on canvas
  y: number;       // Normalized or pixel Y coordinate on canvas
  width: number;
  height: number;
  rotation?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: FontChoice;
  fontSize: number; // in points
  color: string;    // hex color (e.g. #000000)
  bold: boolean;
  italic: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image' | 'signature';
  dataUrl: string;       // base64 PNG data URL
  aspectRatio: number;   // width / height
  isSignature?: boolean;
}

export interface StampElement extends BaseElement {
  type: 'stamp';
  stampType: 'check' | 'cross' | 'date';
  textValue?: string;    // formatted date or symbol
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

---

## 4. UI / UX Specifications

### 4.1 Layout Overview
- **Top Bar:** 
  - Left: Back to Tools button, Document title, Page indicator (`Page X of Y`).
  - Center: Tool mode group (`Add Text`, `Add Signature`, `Date`, `Checkmark`, `Cross`).
  - Right: Undo (`Ctrl+Z`), Redo (`Ctrl+Y`), Zoom Out / Zoom In / Fit buttons, and Primary action: **"Save & Download PDF"** with a download icon.
- **Left Rail (Page Navigator):**
  - Collapsible thumbnail sidebar showing all document pages.
  - Active page highlighted with an accent border and page badge.
  - Displays count of annotations placed on each page.
- **Center Canvas:**
  - Viewport with neutral background (`bg-slate-100 dark:bg-slate-900`) and subtle drop-shadow behind the active page sheet.
  - Page sheet renders the PDF page via `pdfjs-dist` scaled to crisp resolution using `window.devicePixelRatio`.
  - Absolute positioning layer directly overlying the rendered page canvas.

### 4.2 Text Element Interaction
- Click "Add Text" or click anywhere on the page when text tool is active.
- Default text: "Type here...". Immediately gains focus with editable `<textarea>` or `contentEditable`.
- When selected, a floating format bar appears directly above the bounding box offering:
  - Font size (small, medium, large, or numeric 10-36pt dropdown).
  - Bold (`B`) and Italic (`I`) toggles.
  - Color palette swatch (Black, Navy Blue, Dark Red, Dark Green, Custom).
  - Delete and Duplicate buttons.
- Drag handle to reposition anywhere on the page; corner handles to adjust width.

### 4.3 Signature Modal & Image Placement
- Clicking "Add Signature" opens a professional modal with two tabs:
  1. **Draw:**
     - HTML5 canvas with smooth stroke interpolation (Bézier smoothing for clean signatures).
     - Stroke color selection (Black, Navy Blue, Red).
     - "Clear" button and "Save Signature" button.
     - Auto-trims transparent whitespace margins so the signature fits neatly onto documents.
  2. **Upload:**
     - File dropzone for PNG, JPG, or SVG signatures.
     - "Remove white background" preview toggle (makes scanned signatures transparent).
- Upon confirmation, signature is placed at center of current view with locked aspect ratio and active corner scaling handles.

### 4.4 History Management (Undo / Redo)
- Every mutation (add element, move element on drag end, resize on handle release, property change, delete) pushes a snapshot to `history.past`.
- Undo/Redo handles standard shortcut bindings (`Ctrl+Z` / `Cmd+Z`, `Ctrl+Y` / `Cmd+Shift+Z`) and toolbar buttons.
- History is preserved across page switches.

---

## 5. Export Engine Specifications (`pdfEditorProcessing.ts`)

### 5.1 Coordinate Mapping
1. Browser viewport coordinates:
   - Origin $(0, 0)$ is top-left of the canvas.
   - Canvas has rendered dimensions $(W_{\text{canvas}}, H_{\text{canvas}})$.
2. PDF page coordinates:
   - Origin $(0, 0)$ is bottom-left of the page.
   - Page dimensions in points $(W_{\text{pdf}}, H_{\text{pdf}})$.
3. Transformation:
   $$scaleX = \frac{W_{\text{pdf}}}{W_{\text{canvas}}}, \quad scaleY = \frac{H_{\text{pdf}}}{H_{\text{canvas}}}$$
   $$pdfX = element.x \times scaleX$$
   $$pdfY = H_{\text{pdf}} - ((element.y + element.height) \times scaleY)$$
   $$pdfWidth = element.width \times scaleX$$
   $$pdfHeight = element.height \times scaleY$$

### 5.2 Embedding in `pdf-lib`
- **Fonts:** Standard PDF fonts (`StandardFonts.Helvetica`, `StandardFonts.HelveticaBold`, `StandardFonts.HelveticaOblique`, `StandardFonts.TimesRoman`, `StandardFonts.Courier`) are embedded directly without external font file overhead.
- **Images & Signatures:**
  - Base64 data URLs decoded to byte arrays.
  - Embedded via `pdfDoc.embedPng(imageBytes)` or `pdfDoc.embedJpg(imageBytes)`.
  - Cached by image source hash so duplicate signatures embed only once in the PDF dictionary.
- **Color Conversion:**
  - Hex colors (`#RRGGBB`) converted to `rgb(r/255, g/255, b/255)`.
- **Download Output:**
  - Serialized via `await pdfDoc.save()`.
  - Downloaded via Blob URL as `<original_name>_edited.pdf`.

---

## 6. Error Handling & Quality Guarantees
- **Password-protected PDFs:** Caught during `pdfjs-dist` load; triggers clear user prompt recommending the "Unlock PDF" tool.
- **Zero Blurriness:** High-DPI canvas scaling prevents blurry rendering on Retina/4K displays.
- **Memory Safety:** Canvas contexts and data URLs are cleaned up on unmount or file reset.
- **Non-destructive:** Original PDF file bytes remain untouched; modifications are layered on top during export.

---

## 7. Verification & Testing Plan
1. **Unit/Integration Testing:**
   - Coordinate conversion accuracy between canvas and PDF bounds across portrait and landscape pages.
   - Hex to RGB parsing and font embedding coverage.
2. **Interactive UI Verification:**
   - Loading 1-page and multi-page PDFs.
   - Adding text, moving, resizing, and changing typography.
   - Drawing a signature and placing it on a form line.
   - Uploading a signature image and resizing it.
   - Switching pages in the sidebar and verifying annotations persist.
   - Testing Undo and Redo operations.
3. **Export Verification:**
   - Downloading edited PDF and validating with PDF viewer that text and signatures appear at the exact visual positions without distortion.
   - Verifying clean build via `npm run build`.
