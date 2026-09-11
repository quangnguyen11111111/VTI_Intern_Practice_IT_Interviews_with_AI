import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const allowedPaths = new Set(['tests/fixtures/secret-scan/allowed-placeholder.txt']);
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,255}\b/g],
  ['google-api-key', /\bAIza[A-Za-z0-9_-]{30,}\b/g],
  ['credentialed-uri', /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|smtp):\/\/[^\s/:]+:[^\s@/]+@/gi],
];

export function scanText(path, text) {
  if (allowedPaths.has(path.replaceAll('\\', '/'))) return [];
  return rules.filter(([, pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }).map(([rule]) => rule);
}

function trackedAndUntrackedFiles() {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter(Boolean);
}

function main() {
  if (process.argv.includes('--self-test')) {
    const fake = 'ghp_' + 'A'.repeat(36);
    if (!scanText('src/example.ts', fake).includes('github-token')) process.exitCode = 1;
    if (scanText('tests/fixtures/secret-scan/allowed-placeholder.txt', fake).length !== 0) process.exitCode = 1;
    return;
  }
  const findings = [];
  for (const path of trackedAndUntrackedFiles()) {
    let buffer;
    try { buffer = readFileSync(path); } catch { continue; }
    if (buffer.length > 5 * 1024 * 1024 || buffer.includes(0)) continue;
    for (const rule of scanText(path, buffer.toString('utf8'))) findings.push({ path, rule });
  }
  if (findings.length) {
    // Never print matched lines or values.
    for (const finding of findings) process.stderr.write(`Secret-like value: ${finding.rule} in ${finding.path}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Working-tree secret scan passed.\n');
  }
}

main();
