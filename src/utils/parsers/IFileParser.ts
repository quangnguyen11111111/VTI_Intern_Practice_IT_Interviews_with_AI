export interface IFileParser {
  parse(buffer: Buffer): Promise<string>;
}
