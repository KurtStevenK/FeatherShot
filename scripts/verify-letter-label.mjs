#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const cases = JSON.parse(
  readFileSync(join(root, 'shared', 'letterLabel.cases.json'), 'utf8')
);

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const canonical = join(root, 'shared', 'letterLabel.js');
const copies = [
  join(root, 'chrome-extension', 'letterLabel.js'),
  join(root, 'electron-app', 'shared', 'letterLabel.js'),
];

const canonicalHash = sha256(canonical);
for (const copy of copies) {
  const copyHash = sha256(copy);
  if (copyHash !== canonicalHash) {
    console.error(`letterLabel.js out of sync: ${copy}`);
    console.error('Run: npm run sync:shared');
    process.exit(1);
  }
}

const { letterLabel } = require(canonical);
let failed = 0;
for (const { n, label } of cases) {
  const got = letterLabel(n);
  if (got !== label) {
    console.error(`letterLabel(${n}): expected "${label}", got "${got}"`);
    failed++;
  }
}
if (failed > 0) {
  process.exit(1);
}

console.log(`letterLabel: ${cases.length} cases OK, copies in sync`);
