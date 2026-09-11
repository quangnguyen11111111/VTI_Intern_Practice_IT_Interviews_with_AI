import { describe, it, expect } from 'vitest';
import { FileParserFactory } from '../src/utils/parsers/FileParserFactory';
import { PdfParser } from '../src/utils/parsers/PdfParser';
import { DocxParser } from '../src/utils/parsers/DocxParser';
import { docx, pdf } from './helpers/ai-fixtures';

describe('FileParserFactory & isolated parsers', () => {
  it('returns PdfParser for application/pdf', () => {
    expect(FileParserFactory.getParser('application/pdf')).toBeInstanceOf(PdfParser);
  });
  it('rejects legacy application/msword', () => {
    expect(() => FileParserFactory.getParser('application/msword')).toThrow('Only PDF and DOCX');
  });
  it('returns DocxParser for DOCX MIME', () => {
    expect(FileParserFactory.getParser('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeInstanceOf(DocxParser);
  });
  it('rejects unsupported types without echoing the MIME', () => {
    expect(() => FileParserFactory.getParser('image/private')).toThrow('Only PDF and DOCX');
  });
  it('parses a real PDF fixture without masking parser errors', async () => {
    expect(await new PdfParser().parse(pdf())).toContain('Technical job description');
  });
  it('parses a real DOCX fixture in an isolated worker', async () => {
    expect(await new DocxParser().parse(docx())).toContain('Technical job description');
  });
});
