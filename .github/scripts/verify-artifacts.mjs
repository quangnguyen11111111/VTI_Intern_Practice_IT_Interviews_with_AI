import { readdirSync, statSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';

const forbiddenSegment = /^(?:\.env(?:\..+)?|coverage|logs?|fixtures?|tests?|__tests__|seeds?)$/i;
const forbiddenFile = /^\.env(?:\.|$)|\.log$|(?:^|[._-])(?:test|spec)\.[^.]+$/i;

export function unsafeArtifactPaths(paths) {
  return paths.filter(path => path.split(/[\\/]/).some(part => forbiddenSegment.test(part)) || forbiddenFile.test(basename(path)));
}

function filesUnder(root) {
  const base = resolve(root);
  const pending = [base];
  const files = [];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = resolve(current, entry.name);
      if (!full.startsWith(base + sep) && full !== base) throw new Error('Artifact path escaped its root');
      if (entry.isSymbolicLink()) throw new Error(`Artifact contains symlink: ${relative(base, full)}`);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile() && statSync(full).size >= 0) files.push(relative(base, full));
    }
  }
  return files;
}

function main() {
  if (process.argv.includes('--self-test')) {
    const unsafe = unsafeArtifactPaths(['app.js', 'tests/private.fixture', '.env.production', 'logs/runtime.log']);
    if (unsafe.length !== 3) process.exitCode = 1;
    return;
  }
  const roots = process.argv.slice(2);
  if (!roots.length) throw new Error('Provide at least one artifact directory');
  const findings = roots.flatMap(root => unsafeArtifactPaths(filesUnder(root)).map(path => `${root}/${path}`));
  if (findings.length) {
    for (const path of findings) process.stderr.write(`Forbidden production artifact path: ${path}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Production artifact contents passed.\n');
  }
}

main();
