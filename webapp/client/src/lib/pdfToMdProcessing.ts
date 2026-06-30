/**
 * Client-side module for converting PDF files to Markdown
 * via the Vercel Python serverless function (/api/pdf_to_md).
 *
 * Files are sent as base64-encoded JSON — no multipart form parsing needed.
 * The PDF never touches a third-party service; it goes only to the user's
 * own Vercel deployment.
 */

const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB

export interface MarkdownResult {
  /** The raw Markdown text extracted from the PDF. */
  text: string;
}

/**
 * Convert a PDF `File` to Markdown by calling the serverless function.
 *
 * @throws {Error} If validation fails or the API returns an error.
 */
export async function pdfToMarkdown(file: File): Promise<MarkdownResult> {
  // ── client-side validation ────────────────────────────────
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files are supported.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 4.5 MB.`
    );
  }

  // ── read file as base64 ───────────────────────────────────
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Build a binary string in chunks to avoid call-stack overflow on large files
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const base64 = btoa(binary);

  // ── call the API ──────────────────────────────────────────
  const response = await fetch('/api/pdf_to_md', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: base64, filename: file.name }),
  });

  let data: { markdown?: string; error?: string };
  try {
    // Check if the response is JSON before parsing
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      // Vercel often returns HTML error pages for 500s/timeouts
      if (response.status === 504) {
        throw new Error('The conversion timed out. Try a smaller PDF (under 2 MB).');
      }
      if (response.status === 413) {
        throw new Error('File too large for the server. Maximum size is 4.5 MB.');
      }
      throw new Error(
        `Server error (${response.status}): ${text.substring(0, 200).replace(/<[^>]*>/g, '').trim() || 'No details available.'}`
      );
    }
    data = await response.json();
  } catch (e) {
    if (e instanceof Error && e.message !== 'Received an invalid response from the server.') {
      throw e; // Re-throw our specific errors above
    }
    throw new Error('Received an invalid response from the server. The function may not be deployed correctly.');
  }

  if (!response.ok) {
    throw new Error(data.error || 'Failed to convert PDF to Markdown.');
  }

  if (!data.markdown) {
    throw new Error('The server returned an empty Markdown result.');
  }

  return { text: data.markdown };
}
