# PDFQuill

PDFQuill is a local web app for everyday PDF work. It has a React/Vite client and a Node/Express API, with PDF processing handled in JavaScript.

## Features

- Merge multiple PDFs
- Split a PDF into pages or extract a page range
- Optimize a PDF by rewriting it with compact object streams
- Rotate all pages
- Add text or image watermarks
- Add page numbers
- Reorder or delete pages
- Convert PNG/JPG images into a PDF

## Requirements

- Node.js 20 or newer
- npm

## Setup

Install both the server and client dependencies:

```bash
npm run install:all
```

Start the API:

```bash
npm run dev:server
```

Start the web client in a second terminal:

```bash
npm run dev:client
```

Open the Vite URL shown in the client terminal, usually `http://localhost:5173`.

## Scripts

- `npm run dev:server` starts the local PDF API on port `4000`.
- `npm run dev:client` starts the Vite web app.
- `npm run build` builds the React client.
- `npm run lint` runs the client linter.
- `npm run check:server` syntax-checks the Node API.

## Configuration

The client uses `http://localhost:4000` by default. Override it with `VITE_API_BASE_URL` when needed:

```bash
VITE_API_BASE_URL=http://localhost:4000 npm run dev:client
```

## License

This project is licensed under the terms in [LICENSE](LICENSE).
