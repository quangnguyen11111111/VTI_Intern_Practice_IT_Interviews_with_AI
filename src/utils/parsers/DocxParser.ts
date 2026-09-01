import { IFileParser } from './IFileParser';
import mammoth from 'mammoth';

export class DocxParser implements IFileParser {
  async parse(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
