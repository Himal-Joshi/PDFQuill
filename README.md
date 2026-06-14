# PDFQuill

PDFQuill is a modern, privacy-first web application for everyday PDF processing. The entire application is built as a **100% client-side** React/Vite Single Page Application (SPA). All PDF processing is handled securely inside your web browser using cutting-edge WebAssembly (WASM) ports of `qpdf`, `Tesseract.js`, `pdf-lib`, and `jszip`—no files are ever uploaded to a backend server!

## Features

- **100% Private Processing:** Files never leave your browser.
- **Authentication & Rate Limiting:** Google Sign-In via Firebase. Anonymous users are limited to 2 PDF operations per day. Logged-in users are granted 10 operations per day.
- **Advanced OCR (Optical Character Recognition):** 
  - **Make Searchable:** Convert scanned documents into selectable PDFs using Tesseract WASM.
  - **Extract Text:** Extract raw text from image-based PDFs with multi-language support.
- **HTML to PDF:** Convert raw HTML code or upload HTML files to render them directly into formatted PDF documents.
- **Security Tools (QPDF WASM):** 
  - **Flatten PDF:** Strip interactive forms and metadata to create a flat, uneditable PDF.
  - **Lock/Unlock PDF:** Add or remove password protection from PDFs.
- **Merge PDFs:** Combine multiple PDFs into one, with easy drag-and-drop file reordering.
- **Split & Extract:** Extract specific page ranges or split every page into a downloadable `.zip` file (with Color/Grayscale splitting options).
- **Compress PDF:** Optimize and reduce the file size of your PDFs.
- **Rotate Pages:** Rotate all pages or specify specific page ranges (e.g. 1, 3-5).
- **Watermark:** Add custom text or image watermarks.
- **Add Page Numbers:** Automatically stamp page numbers.
- **Organize Pages:** Reorder or delete pages visually with an interactive drag-and-drop thumbnail grid.
- **Convert Images:** Convert PNG/JPG images into a single PDF document.
- **Modern UI:** Features a premium 2-column layout workspace, dark mode support, client-side routing, and seamless UX.

> **Note on "Premium" Tools:** Some advanced features (OCR, Lock/Unlock PDF, Watermark, and Color Splitting) require a user to be signed in with Google to use.

## Requirements

- Node.js 20 or newer
- npm

## Setup

Since PDFQuill has transitioned to a fully serverless architecture, you only need to run the web client.

Navigate to the client directory and install dependencies:

```bash
cd webapp/client
npm install
```

Start the local development server:

```bash
npm run dev
```

Open the Vite URL shown in your terminal, usually `http://localhost:5173`.

> **⚠️ Firebase Authentication Note for Local Development:**
> Localhost has been removed from the authorized domains in the Firebase Console for security purposes. As a result, the "Sign in with Google" functionality and access to premium tools will **not work on `localhost`**. Authentication will only function correctly on the authorized production domains (e.g., `pdfquill.com.np`, `pdfquill.vercel.app`, GitHub Pages).

## Scripts (Inside `webapp/client`)

- `npm run dev` starts the Vite web app.
- `npm run build` builds the React client for production (used for GitHub Pages deployment).
- `npm run lint` runs the ESLint checks.
- `npm run preview` previews the production build locally.

## License

This project is licensed under the terms in [LICENSE](LICENSE).
