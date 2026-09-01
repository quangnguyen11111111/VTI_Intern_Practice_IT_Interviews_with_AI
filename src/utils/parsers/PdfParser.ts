const pdfParse = require('pdf-parse');
import { IFileParser } from './IFileParser';


export class PdfParser implements IFileParser {
  async parse(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
