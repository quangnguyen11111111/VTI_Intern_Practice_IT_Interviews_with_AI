import { IFileParser } from './IFileParser';
import { PdfParser } from './PdfParser';
import { DocxParser } from './DocxParser';
import { AppError } from '../AppError';

export class FileParserFactory {
  static getParser(mimetype: string): IFileParser {
    switch (mimetype) {
      case 'application/pdf':
        return new PdfParser();
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return new DocxParser();
      default:
        throw new AppError('Only PDF and DOCX files are allowed', 415, 'UNSUPPORTED_FILE_TYPE');
    }
  }
}
