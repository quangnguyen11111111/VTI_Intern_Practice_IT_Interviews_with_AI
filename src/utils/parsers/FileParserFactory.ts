import { IFileParser } from './IFileParser';
import { PdfParser } from './PdfParser';
import { DocxParser } from './DocxParser';

export class FileParserFactory {
  static getParser(mimetype: string): IFileParser {
    switch (mimetype) {
      case 'application/pdf':
        return new PdfParser();
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return new DocxParser();
      default:
        throw new Error(`Unsupported file type: ${mimetype}`);
    }
  }
}
