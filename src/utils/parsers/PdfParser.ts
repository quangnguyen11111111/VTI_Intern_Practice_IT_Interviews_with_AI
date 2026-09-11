import { parseIsolated } from './isolated-parser';
import { IFileParser } from './IFileParser';


export class PdfParser implements IFileParser {
  async parse(buffer: Buffer): Promise<string> {
    return parseIsolated(buffer, 'pdf');
  }
}
