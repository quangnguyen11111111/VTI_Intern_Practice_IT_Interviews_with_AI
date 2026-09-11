import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('AIP-53 CI security tooling', () => {
  it('detects credential shapes while honoring only the controlled scanner fixture', () => {
    expect(() => execFileSync(process.execPath, ['.github/scripts/secret-scan.mjs', '--self-test'])).not.toThrow();
  });

  it('rejects forbidden production artifact paths', () => {
    expect(() => execFileSync(process.execPath, ['.github/scripts/verify-artifacts.mjs', '--self-test'])).not.toThrow();
  });
});
