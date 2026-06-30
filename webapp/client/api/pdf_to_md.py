from http.server import BaseHTTPRequestHandler
import json
import base64
import tempfile
import os


# Maximum file size: 4.5 MB (Vercel payload limit is ~4.5 MB)
MAX_FILE_SIZE = 4_500_000


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless function to convert PDF files to Markdown
    using Microsoft's markitdown library."""

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                self._send_json(400, {"error": "Empty request body."})
                return

            # Reject oversized payloads early (~6 MB base64 ≈ 4.5 MB file)
            if content_length > 8_000_000:
                self._send_json(413, {"error": "File too large. Maximum size is 4.5 MB."})
                return

            raw = self.rfile.read(content_length)
            try:
                body = json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                self._send_json(400, {"error": "Invalid JSON in request body."})
                return

            file_b64 = body.get("file")
            filename = body.get("filename", "document.pdf")

            if not file_b64 or not isinstance(file_b64, str):
                self._send_json(400, {"error": "No file data provided."})
                return

            # Validate filename extension
            if not filename.lower().endswith(".pdf"):
                self._send_json(400, {"error": "Only PDF files are supported."})
                return

            # Decode base64
            try:
                file_data = base64.b64decode(file_b64, validate=True)
            except Exception:
                self._send_json(400, {"error": "Invalid base64 file data."})
                return

            # Validate file size after decoding
            if len(file_data) > MAX_FILE_SIZE:
                self._send_json(
                    413,
                    {"error": f"File too large ({len(file_data) / 1_048_576:.1f} MB). Maximum is 4.5 MB."},
                )
                return

            # Validate PDF magic bytes
            if not file_data[:5] == b"%PDF-":
                self._send_json(400, {"error": "Invalid PDF file."})
                return

            # Write to a temp file, convert, and clean up
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(file_data)
                    tmp_path = tmp.name

                from markitdown import MarkItDown  # lazy import for cold-start speed

                md = MarkItDown()
                result = md.convert(tmp_path)
                markdown_text = result.text_content

                if not markdown_text or not markdown_text.strip():
                    self._send_json(
                        422,
                        {"error": "Could not extract any content from this PDF. The file may be image-only or empty."},
                    )
                    return

                self._send_json(200, {"markdown": markdown_text})

            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        except Exception as e:
            self._send_json(500, {"error": f"Conversion failed: {str(e)}"})

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    # ── helpers ──────────────────────────────────────────────

    def _send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _set_cors_headers(self):
        origin = self.headers.get("Origin", "")
        allowed = {
            "https://pdfquill.vercel.app",
            "https://pdfquill.com.np",
            "https://himal-joshi.github.io",
            "http://localhost:5173",
        }
        if origin in allowed:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
