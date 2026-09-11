import { Worker } from 'node:worker_threads';
import { AppError } from '../AppError';
import type { Options as ZipOptions } from 'yauzl';

export const FILE_LIMITS = Object.freeze({ bytes: 5 * 1024 * 1024, entries: 256,
  expandedBytes: 20 * 1024 * 1024, pages: 100, text: 60000, timeoutMs: 5000 });
export const parseFailure = () => new AppError('Không thể phân tích tài liệu', 422, 'FILE_PARSE_FAILED');
const zipOptions: ZipOptions = { lazyEntries: true, strictFileNames: true, validateEntrySizes: true };

// A literal worker program works in both tsx/Vitest and the CommonJS production artifact.
// It receives only this request's bytes and fixed dependency paths, with an empty environment.
const workerProgram = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { buffer, kind, limits, modules } = workerData;
const bytes = Buffer.from(buffer);
const fail = () => { throw new Error('FILE_PARSE_FAILED'); };
async function validateZip() {
  const yauzl = require(modules.zip);
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, workerData.zipOptions, (error, zip) => {
      if (error || !zip) return reject(new Error('invalid'));
      let count = 0, declared = 0, actual = 0, settled = false;
      const names = new Set();
      const stop = () => { if (!settled) { settled = true; zip.close(); reject(new Error('invalid')); } };
      zip.on('error', stop);
      if (zip.entryCount > limits.entries) return stop();
      zip.on('entry', entry => {
        const name = entry.fileName;
        const unixType = (entry.externalFileAttributes >>> 16) & 0xf000;
        declared += entry.uncompressedSize;
        if (++count > limits.entries || declared > limits.expandedBytes || names.has(name) ||
            /[\\:\x00]/.test(name) || name.startsWith('/') || name.split('/').some(p => p === '..' || p === '.') ||
            entry.isEncrypted() || (unixType !== 0 && unixType !== 0x8000 && unixType !== 0x4000)) return stop();
        names.add(name);
        zip.openReadStream(entry, (error, stream) => {
          if (error || !stream) return stop();
          stream.on('error', stop);
          stream.on('data', chunk => {
            actual += chunk.length;
            if (actual > limits.expandedBytes) { stream.destroy(); stop(); }
          });
          stream.on('end', () => { if (!settled) zip.readEntry(); });
        });
      });
      zip.on('end', () => {
        if (settled) return;
        if (!names.has('[Content_Types].xml') || !names.has('word/document.xml') || count !== zip.entryCount) return stop();
        settled = true; zip.close(); resolve();
      });
      zip.readEntry();
    });
  });
}
(async () => {
  let text;
  if (kind === 'pdf') {
    const pdf = require(modules.pdf);
    let chars = 0, pageFailed = false;
    const result = await pdf(Uint8Array.from(bytes), { max: limits.pages + 1, pagerender: async page => {
      try {
      const content = await page.getTextContent({ normalizeWhitespace: true });
      const value = content.items.map(item => item.str).join(' ');
      chars += value.length;
      if (chars > limits.text) fail();
      return value;
      } catch (error) { pageFailed = true; throw error; }
    } });
    if (pageFailed || chars > limits.text || result.numpages < 1 || result.numpages > limits.pages) fail();
    text = result.text;
  } else {
    await validateZip();
    const result = await require(modules.docx).extractRawText({ buffer: bytes });
    text = result.value;
  }
  if (typeof text !== 'string' || !text.trim() || text.length > limits.text) fail();
  parentPort.postMessage({ ok: true, text });
})().catch(() => parentPort.postMessage({ ok: false }));
`;

let active = 0;
export async function parseIsolated(buffer: Buffer, kind: 'pdf' | 'docx'): Promise<string> {
  if (buffer.length > FILE_LIMITS.bytes || !buffer.length || active >= 4) throw parseFailure();
  const signature = kind === 'pdf' ? Buffer.from('%PDF-') : Buffer.from([0x50, 0x4b, 3, 4]);
  if (!buffer.subarray(0, signature.length).equals(signature)) throw parseFailure();
  active++;
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const copy = Uint8Array.from(buffer);
    worker = new Worker(workerProgram, { eval: true, env: {}, stdout: true, stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      workerData: { buffer: copy.buffer, kind, limits: FILE_LIMITS, zipOptions,
        modules: { pdf: require.resolve('pdf-parse/lib/pdf-parse.js'), docx: require.resolve('mammoth'), zip: require.resolve('yauzl') } },
      transferList: [copy.buffer],
    });
    // Drain library diagnostics without retaining or exposing document-derived messages.
    worker.stdout?.resume(); worker.stderr?.resume();
    return await new Promise<string>((resolve, reject) => {
      timer = setTimeout(() => reject(parseFailure()), FILE_LIMITS.timeoutMs);
      worker!.once('error', () => reject(parseFailure()));
      worker!.once('exit', () => reject(parseFailure()));
      worker!.once('message', result => {
        if (result?.ok === true && typeof result.text === 'string' && result.text.length <= FILE_LIMITS.text) {
          resolve(result.text.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''));
        } else reject(parseFailure());
      });
    });
  } catch { throw parseFailure(); }
  finally { if (timer) clearTimeout(timer); await worker?.terminate(); active--; }
}
