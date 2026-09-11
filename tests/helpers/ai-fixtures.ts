import { deflateRawSync } from 'node:zlib';
export const QUESTION_IDS = Array.from({ length: 5 }, (_, i) => (i + 1).toString(16).padStart(24, '0'));
export const questions = () => QUESTION_IDS.map((id, i) => ({ id, order: i + 1, difficulty: 'Easy', category: 'Programming',
  content: { en: `Explain technical concept ${i + 1}.`, vi: `Giải thích khái niệm ${i + 1}.` } }));
export const generated = () => questions().map(({ id, ...q }) => q);
export const answers = () => QUESTION_IDS.map(questionId => ({ questionId, candidateAnswer: 'A technical answer.' }));
export const dimensions = ['Technical Depth', 'Problem Solving', 'System Design & Best Practices', 'Communication', 'Practical Experience'];
export const evaluation = () => ({ evaluations: QUESTION_IDS.map(questionId => ({ questionId, score: 7,
  feedback: { en: 'Explain tradeoffs.', vi: 'Giải thích đánh đổi.' } })), overallScore: 10,
  dimensions: dimensions.map(name => ({ name, score: 7, reasoning: 'Reasonable technical understanding.' })), learningPath: [] });
function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export interface ZipEntry { name: string; text?: string; declaredSize?: number }
// Deliberately writes raw names/sizes so attack fixtures cannot be normalized by a ZIP writer.
export function zip(entries: ZipEntry[]) {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), plain = Buffer.from(entry.text ?? ''), compressed = deflateRawSync(plain);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(plain), 14); local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.declaredSize ?? plain.length, 22); local.writeUInt16LE(name.length, 26);
    parts.push(local, name, compressed);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(crc32(plain), 16); dir.writeUInt32LE(compressed.length, 20);
    dir.writeUInt32LE(entry.declaredSize ?? plain.length, 24); dir.writeUInt16LE(name.length, 28); dir.writeUInt32LE(offset, 42);
    central.push(dir, name); offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}
export function docx(text = 'Technical job description', extra: ZipEntry[] = []) {
  return zip([
    { name: '[Content_Types].xml', text: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: 'word/document.xml', text: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>` },
    ...extra,
  ]);
}
export function pdf(text = 'Technical job description', pages = 1) {
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids: string[] = [];
  for (let i = 0; i < pages; i++) {
    const pageId = objects.length + 1; kids.push(`${pageId} 0 R`);
    const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`;
  let result = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(result)); result += `${i+1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  result += offsets.slice(1).map(n => `${n.toString().padStart(10,'0')} 00000 n \n`).join('');
  result += `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(result);
}
