import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.resolve(CLIENT_DIR, 'public');
const LOCAL_ASSETS_DIR = path.resolve(PUBLIC_DIR, 'local-assets');

const DIRS = [
  LOCAL_ASSETS_DIR,
  path.resolve(LOCAL_ASSETS_DIR, 'pdfjs'),
  path.resolve(LOCAL_ASSETS_DIR, 'tesseract'),
  path.resolve(LOCAL_ASSETS_DIR, 'tesseract', 'lang'),
  path.resolve(LOCAL_ASSETS_DIR, 'imgly'),
];

// Ensure directories exist
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Helper to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`Already exists (skipping): ${path.basename(dest)}`);
      resolve();
      return;
    }

    console.log(`Downloading: ${url} -> ${path.basename(dest)}`);
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: Status code ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Success: ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Helper to copy a file
function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Source file not found (cannot copy): ${src}`);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    fs.copyFile(src, dest, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Copied: ${path.basename(src)} -> ${path.basename(dest)}`);
        resolve();
      }
    });
  });
}

async function run() {
  try {
    console.log('--- Phase 1: Copying local dependencies from node_modules ---');
    
    // Copy PDF.js worker
    const pdfJsSrc = path.resolve(CLIENT_DIR, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
    const pdfJsDest = path.resolve(LOCAL_ASSETS_DIR, 'pdfjs', 'pdf.worker.min.mjs');
    await copyFile(pdfJsSrc, pdfJsDest);

    // Copy Tesseract JS worker & core WASM
    const tesseractSrcs = [
      { src: 'tesseract.js/dist/worker.min.js', dest: 'tesseract/tesseract-ocr.worker.min.js' },
      { src: 'tesseract.js-core/tesseract-core.wasm.js', dest: 'tesseract/tesseract-ocr-core.wasm.js' },
      { src: 'tesseract.js-core/tesseract-core.wasm', dest: 'tesseract/tesseract-core.wasm' },
      { src: 'tesseract.js-core/tesseract-core-simd.wasm', dest: 'tesseract/tesseract-core-simd.wasm' },
      { src: 'tesseract.js-core/tesseract-core-simd.wasm.js', dest: 'tesseract/tesseract-core-simd.wasm.js' }
    ];

    for (const t of tesseractSrcs) {
      await copyFile(
        path.resolve(CLIENT_DIR, 'node_modules', ...t.src.split('/')),
        path.resolve(LOCAL_ASSETS_DIR, ...t.dest.split('/'))
      );
    }

    console.log('--- Phase 2: Downloading Tesseract Language Assets ---');
    
    const tesseractDownloads = [
      {
        url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata',
        dest: path.resolve(LOCAL_ASSETS_DIR, 'tesseract', 'lang', 'eng.traineddata')
      },
      {
        url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/nep.traineddata',
        dest: path.resolve(LOCAL_ASSETS_DIR, 'tesseract', 'lang', 'nep.traineddata')
      },
      {
        url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/hin.traineddata',
        dest: path.resolve(LOCAL_ASSETS_DIR, 'tesseract', 'lang', 'hin.traineddata')
      },
      {
        url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/osd.traineddata',
        dest: path.resolve(LOCAL_ASSETS_DIR, 'tesseract', 'lang', 'osd.traineddata')
      }
    ];

    for (const td of tesseractDownloads) {
      await downloadFile(td.url, td.dest);
    }

    console.log('--- Phase 3: Setting up Imgly Background Removal Assets ---');
    
    // 1. Download resources.json from imgly CDN
    const resourcesUrl = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/resources.json';
    const resourcesDest = path.resolve(LOCAL_ASSETS_DIR, 'imgly', 'resources.json');
    
    // We force download of resources.json to always have the latest mapping
    if (fs.existsSync(resourcesDest)) {
      fs.unlinkSync(resourcesDest);
    }
    await downloadFile(resourcesUrl, resourcesDest);
    
    // 2. Read resources.json to identify chunks we need
    const resources = JSON.parse(fs.readFileSync(resourcesDest, 'utf-8'));
    
    // We need all chunk files for onnxruntime-web and the medium model (isnet_fp16)
    const neededKeys = Object.keys(resources).filter(key => 
      key.startsWith('/onnxruntime-web/') || key === '/models/isnet_fp16'
    );
    
    console.log(`Found ${neededKeys.length} asset groups to download.`);
    
    const chunkDownloads = [];
    for (const key of neededKeys) {
      const entry = resources[key];
      for (const chunk of entry.chunks) {
        chunkDownloads.push({
          url: `https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/${chunk.name}`,
          dest: path.resolve(LOCAL_ASSETS_DIR, 'imgly', chunk.name)
        });
      }
    }
    
    console.log(`Downloading ${chunkDownloads.length} chunk files for background removal...`);
    for (const cd of chunkDownloads) {
      await downloadFile(cd.url, cd.dest);
    }

    console.log('\n--- Offline assets successfully configured! ---');
  } catch (error) {
    console.error('Error during asset preparation:', error);
    process.exit(1);
  }
}

run();
