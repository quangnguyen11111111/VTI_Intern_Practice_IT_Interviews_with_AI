import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceFiles = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  const path = join(root, entry.name);
  if (entry.isDirectory()) return entry.name === 'seeds' ? [] : sourceFiles(path);
  return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.startsWith('test-') ? [path] : [];
});

describe('AIP-53 runtime environment boundary', () => {
  it('allows direct process.env reads only inside getEnv()', () => {
    const readers = sourceFiles('src')
      .filter(path => readFileSync(path, 'utf8').includes('process.env'))
      .map(path => relative('.', path).replaceAll('\\', '/'));
    expect(readers).toEqual(['src/config/env.ts']);
  });
});
