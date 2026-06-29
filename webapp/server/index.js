const archiver = require('archiver');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib');
const { initializeApp, getApps, applicationDefault, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Initialize Firebase Admin
if (getApps().length === 0) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
    } else {
      initializeApp({ credential: applicationDefault() });
    }
  } catch (err) {
    console.warn('Firebase Admin init warning:', err.message);
  }
}
const port = Number(process.env.PORT || 3001);

const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');

for (const dir of [uploadsDir, outputsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

// Background Cleanup: Delete outputs older than 1 hour every 15 minutes
setInterval(async () => {
  try {
    const files = await fsp.readdir(outputsDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(outputsDir, file);
      const stats = await fsp.stat(filePath);
      if (now - stats.mtimeMs > 60 * 60 * 1000) { // 1 hour
        await fsp.rm(filePath, { force: true, recursive: true });
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}, 15 * 60 * 1000);

app.use(helmet());

const allowedOrigins = ['https://himal-joshi.github.io', 'https://pdfquill.vercel.app', 'https://pdfquill.com.np', 'http://localhost:5173'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Auth Middleware
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      req.user = decodedToken;
    } catch (error) {
      console.warn('Invalid token:', error.message);
    }
  }
  next();
}

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hrs
  max: (req, res) => {
    if (req.user) return 10;
    return 5;
  },
  keyGenerator: (req) => {
    return req.user ? req.user.uid : req.ip;
  },
  message: { error: 'Daily processing limit exceeded. Please try again tomorrow or login to increase your limit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', authMiddleware, apiLimiter);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDir),
    filename: (_req, file, callback) => {
      const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
      callback(null, `${randomUUID()}-${safeName}`);
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // Reduced for stability
  },
});

function outputPath(label, extension = 'pdf') {
  return path.join(outputsDir, `${randomUUID()}-${label}.${extension}`);
}

function downloadUrl(filePath) {
  return `/download/${path.relative(outputsDir, filePath).replaceAll(path.sep, '/')}`;
}

async function loadPdf(filePath) {
  const bytes = await fsp.readFile(filePath);
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

async function savePdf(pdfDoc, filePath) {
  const bytes = await pdfDoc.save({ useObjectStreams: true });
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, bytes);
}

function parsePageList(value, totalPages) {
  if (!value || !value.trim()) {
    return Array.from({ length: totalPages }, (_item, index) => index);
  }

  const pages = [];
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      throw new Error('Use pages like 1,3,5-7.');
    }

    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > totalPages) {
      throw new Error(`Page range must be between 1 and ${totalPages}.`);
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page - 1);
    }
  }

  return pages;
}

async function copyPages(sourceDoc, targetDoc, indices) {
  const copiedPages = await targetDoc.copyPages(sourceDoc, indices);
  copiedPages.forEach((page) => targetDoc.addPage(page));
}

function requireFiles(files, count = 1) {
  if (!files || files.length < count) {
    throw new Error(count === 1 ? 'Choose a file first.' : `Choose at least ${count} files.`);
  }
}

async function zipDirectory(sourceDir, targetPath) {
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function cleanupUploads(files) {
  const list = Array.isArray(files) ? files : Object.values(files || {}).flat();
  await Promise.all(
    list
      .filter((file) => file && file.path)
      .map((file) => fsp.rm(file.path, { force: true }).catch(() => undefined)),
  );
}

function sendError(res, error) {
  console.error('API Error:', error);
  const status = error.name === 'Error' && error.message.includes('PDF') ? 400 : 500;
  res.status(status).json({ error: error.message || 'Operation failed.' });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/merge', upload.array('files'), async (req, res) => {
  try {
    requireFiles(req.files, 2);

    const merged = await PDFDocument.create();
    for (const file of req.files) {
      const source = await loadPdf(file.path);
      await copyPages(source, merged, source.getPageIndices());
    }

    const target = outputPath('merged');
    await savePdf(merged, target);
    res.json({ downloadUrl: downloadUrl(target) });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupUploads(req.files);
  }
});

app.post('/api/split', upload.single('file'), async (req, res) => {
  try {
    requireFiles([req.file]);

    const source = await loadPdf(req.file.path);
    const pages = source.getPages();
    const mode = req.body.mode || 'all';

    if (mode === 'range') {
      const selectedPages = parsePageList(req.body.pages, pages.length);
      const targetDoc = await PDFDocument.create();
      await copyPages(source, targetDoc, selectedPages);

      const target = outputPath('split');
      await savePdf(targetDoc, target);
      res.json({ downloadUrl: downloadUrl(target) });
      return;
    }

    const outputDir = path.join(outputsDir, randomUUID());
    await fsp.mkdir(outputDir, { recursive: true });

    for (let index = 0; index < pages.length; index += 1) {
      const targetDoc = await PDFDocument.create();
      await copyPages(source, targetDoc, [index]);
      await savePdf(targetDoc, path.join(outputDir, `page-${index + 1}.pdf`));
    }

    const zipPath = `${outputDir}.zip`;
    await zipDirectory(outputDir, zipPath);
    res.json({ downloadUrl: downloadUrl(zipPath) });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupUploads([req.file]);
  }
});

app.post('/api/compress', upload.single('file'), async (req, res) => {
  try {
    requireFiles([req.file]);

    const source = await loadPdf(req.file.path);
    const target = outputPath('optimized');
    await savePdf(source, target);
    res.json({ downloadUrl: downloadUrl(target) });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupUploads([req.file]);
  }
});

app.post('/api/rotate', upload.single('file'), async (req, res) => {
  try {
    requireFiles([req.file]);

    const source = await loadPdf(req.file.path);
    const rotation = Number(req.body.rotation || 90);
    if (![90, 180, 270].includes(rotation)) {
      throw new Error('Choose a rotation of 90, 180, or 270 degrees.');
    }

    source.getPages().forEach((page) => {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + rotation) % 360));
    });

    const target = outputPath('rotated');
    await savePdf(source, target);
    res.json({ downloadUrl: downloadUrl(target) });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupUploads([req.file]);
  }
});

app.post('/api/watermark', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (req, res) => {
  try {
    const pdfFile = req.files?.file?.[0];
    const imageFile = req.files?.image?.[0];
    requireFiles([pdfFile]);

    const source = await loadPdf(pdfFile.path);
    const pages = source.getPages();

    if (imageFile) {
      const imageBytes = await fsp.readFile(imageFile.path);
      const image = imageFile.mimetype === 'image/png'
        ? await source.embedPng(imageBytes)
        : await source.embedJpg(imageBytes);

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const scaled = image.scale(Math.min(width / image.width, height / image.height) * 0.42);
        page.drawImage(image, {
          x: (width - scaled.width) / 2,
          y: (height - scaled.height) / 2,
          width: scaled.width,
          height: scaled.height,
          opacity: 0.25,
        });
      });
    } else {
      const text = req.body.text || 'DRAFT';
      const font = await source.embedFont(StandardFonts.HelveticaBold);

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const size = Math.max(28, Math.min(width, height) / 8);
        const textWidth = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size,
          font,
          color: rgb(0.85, 0.13, 0.18),
          opacity: 0.18,
          rotate: degrees(-35),
        });
      });
    }

    const target = outputPath('watermarked');
    await savePdf(source, target);
    res.json({ downloadUrl: downloadUrl(target) });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupUploads(req.files);
  }
});

app.post('/api/page-numbers', upload.single('file'), async (req, res) => {
  try {
    requireFiles([req.file]);

    const source = await loadPdf(req.file.path);
    const pages = source.getPages();
    const font = await source.embedFont(StandardFonts.Helvetica);

    pages.forEach((page, index) => {
      const { width } = page.getSize();
      const label = `${index + 1} / ${pages.length}`;
      const size = 11;
      const textWidth = font.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: (width - textWidth) / 2,
        y: 24,
        size,
        font,
        color: rgb(0.2, 0.25, 0.33),
      });
    });

    const target = outputPath('numbered');
    await savePdf(source, target);
    res.json({ downloadUrl: downloadUrl(target) });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupUploads([req.file]);
  }
});

app.post('/api/organize', upload.single('file'), async (req, res) => {
  try {
    requireFiles([req.file]);

    const source = await loadPdf(req.file.path);
    const totalPages = source.getPageCount();
    const selectedPages = parsePageList(req.body.pages, totalPages);
    const selectedSet = new Set(selectedPages);
    const targetDoc = await PDFDocument.create();

    if (req.body.action === 'delete') {
      const remainingPages = source.getPageIndices().filter((index) => !selectedSet.has(index));
      if (remainingPages.length === 0) {
        throw new Error('Deleting every page would create an empty PDF.');
      }
      await copyPages(source, targetDoc, remainingPages);
    } else {
      await copyPages(source, targetDoc, selectedPages);
    }

    const target = outputPath('organized');
    await savePdf(targetDoc, target);
    res.json({ downloadUrl: downloadUrl(target) });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupUploads([req.file]);
  }
});

app.post('/api/convert', upload.array('files'), async (req, res) => {
  try {
    requireFiles(req.files, 1);

    if (req.body.to !== 'pdf') {
      throw new Error('This web-only version converts images to PDF.');
    }

    const pdfDoc = await PDFDocument.create();
    for (const file of req.files) {
      const imageBytes = await fsp.readFile(file.path);
      const image = file.mimetype === 'image/png'
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }

    const target = outputPath('converted');
    await savePdf(pdfDoc, target);
    res.json({ downloadUrl: downloadUrl(target) });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupUploads(req.files);
  }
});

function resolveOutputPath(relativePath) {
  const target = path.resolve(outputsDir, relativePath);
  const allowedRoot = path.resolve(outputsDir);
  if (!target.startsWith(allowedRoot + path.sep) && target !== allowedRoot) {
    throw new Error('Invalid download path.');
  }
  return target;
}

app.get('/download/*', async (req, res) => {
  try {
    const filePath = resolveOutputPath(req.params[0]);
    await fsp.access(filePath);
    res.download(filePath);
  } catch (error) {
    res.status(404).json({ error: 'File not found.' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 50MB).' });
    }
    return res.status(400).json({ error: 'Upload error.' });
  }
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS error: Origin not allowed.' });
  }

  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({ error: isDev ? err.message : 'Internal server error.' });
});

app.listen(port, () => {
  console.log(`PDFQuill web API running at http://localhost:${port}`);
});
