import { describe, it, expect, vi } from 'vitest';
import { FileParserFactory } from '../src/utils/parsers/FileParserFactory';
import { PdfParser } from '../src/utils/parsers/PdfParser';
import { DocxParser } from '../src/utils/parsers/DocxParser';

// Mock dependencies
vi.mock('pdf-parse', () => {
  return {
    default: vi.fn().mockResolvedValue({ text: 'Mocked PDF Text' })
  };
});

vi.mock('mammoth', () => {
  return {
    default: {
      extractRawText: vi.fn().mockResolvedValue({ value: 'Mocked DOCX Text' })
    }
  };
});

describe('FileParserFactory & Parsers', () => {
  
  describe('FileParserFactory', () => {
    it('should return PdfParser for application/pdf', () => {
      const parser = FileParserFactory.getParser('application/pdf');
      expect(parser).toBeInstanceOf(PdfParser);
    });

    it('should return DocxParser for application/msword', () => {
      const parser = FileParserFactory.getParser('application/msword');
      expect(parser).toBeInstanceOf(DocxParser);
    });

    it('should return DocxParser for application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => {
      const parser = FileParserFactory.getParser('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(parser).toBeInstanceOf(DocxParser);
    });

    it('should throw Error for unsupported mimetype', () => {
      expect(() => FileParserFactory.getParser('image/png')).toThrow('Unsupported file type: image/png');
    });
  });

  describe('PdfParser', () => {
    it('should parse PDF buffer and return text', async () => {
      const parser = new PdfParser();
      const mockBuffer = Buffer.from('fake pdf data');
      const result = await parser.parse(mockBuffer);
      
      expect(result).toBe('Mocked PDF Text');
    });
  });

  describe('DocxParser', () => {
    it('should parse DOCX buffer and return text', async () => {
      const parser = new DocxParser();
      const mockBuffer = Buffer.from('fake docx data');
      const result = await parser.parse(mockBuffer);
      
      expect(result).toBe('Mocked DOCX Text');
    });
  });
});
