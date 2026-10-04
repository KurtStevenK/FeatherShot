#!/usr/bin/env node
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'shared', 'letterLabel.js');

const targets = [
  join(root, 'chrome-extension', 'letterLabel.js'),
  join(root, 'electron-app', 'shared', 'letterLabel.js'),
];

mkdirSync(join(root, 'electron-app', 'shared'), { recursive: true });

for (const target of targets) {
  copyFileSync(source, target);
  console.log(`synced ${target}`);
}
