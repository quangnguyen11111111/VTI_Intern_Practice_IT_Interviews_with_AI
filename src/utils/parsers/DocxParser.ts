import { IFileParser } from './IFileParser';
import { parseIsolated } from './isolated-parser';

export class DocxParser implements IFileParser {
  async parse(buffer: Buffer): Promise<string> {
    return parseIsolated(buffer, 'docx');
  }
}
