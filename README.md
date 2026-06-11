# PDFQuill

PDFQuill is a modern, privacy-first web application for everyday PDF processing. The entire application is built as a **100% client-side** React/Vite Single Page Application (SPA). All PDF processing is handled securely inside your web browser using `pdf-lib` and `jszip`—no files are ever uploaded to a backend server!

## Features

- **100% Private Processing:** Files never leave your browser.
- **Merge PDFs:** Combine multiple PDFs into one, with easy drag-and-drop file reordering.
- **Split & Extract:** Extract specific page ranges or split every page into a downloadable `.zip` file.
- **Compress PDF:** Optimize and reduce the file size of your PDFs.
- **Rotate Pages:** Rotate all pages or specify specific page ranges (e.g. 1, 3-5).
- **Watermark:** Add custom text or image watermarks.
- **Add Page Numbers:** Automatically stamp page numbers.
- **Organize Pages:** Reorder or delete pages visually with an interactive drag-and-drop thumbnail grid.
- **Convert Images:** Convert PNG/JPG images into a single PDF document.
- **Office Converters (Mocked):** Simulated Word and PPT to PDF converters (demonstration only, as client-side office rendering is not feasible without a backend).
- **Modern UI:** Features a premium 2-column layout workspace, dark mode support, client-side routing, and simulated authentication/pricing guards for demonstration.

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

Open the Vite URL shown in your terminal, usually `http://localhost:5173` or `http://localhost:5174`.

## Scripts (Inside `webapp/client`)

- `npm run dev` starts the Vite web app.
- `npm run build` builds the React client for production (used for GitHub Pages deployment).
- `npm run lint` runs the ESLint checks.
- `npm run preview` previews the production build locally.

## License

This project is licensed under the terms in [LICENSE](LICENSE).
