#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const extDir = join(root, 'chrome-extension');

const manifest = JSON.parse(readFileSync(join(extDir, 'manifest.json'), 'utf8'));

const errors = [];

if (manifest.manifest_version !== 3) {
  errors.push('manifest_version must be 3');
}
if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  errors.push('version must be semver x.y.z');
}
if (!manifest.background?.service_worker) {
  errors.push('background.service_worker is required');
}

const requiredScripts = [
  manifest.background.service_worker,
  'selector.js',
  'selector.css',
  'editor.html',
  'editor.js',
  'editor.css',
  'letterLabel.js',
  'popup.html',
  'popup.js',
];

for (const rel of requiredScripts) {
  if (!rel) continue;
  const path = join(extDir, rel);
  if (!existsSync(path)) {
    errors.push(`missing file: ${rel}`);
  }
}

for (const size of ['16', '48', '128']) {
  const icon = manifest.icons?.[size] ?? manifest.action?.default_icon?.[size];
  if (!icon || !existsSync(join(extDir, icon))) {
    errors.push(`missing icon: ${size}px (${icon})`);
  }
}

// The Chrome Web Store rejects permissions the code never uses, so each one
// must map to an API call found in the extension's scripts.
const permissionUse = {
  activeTab: /chrome\.tabs\.captureVisibleTab/,
  scripting: /chrome\.scripting\./,
  storage: /chrome\.storage\./,
  downloads: /chrome\.downloads\./,
  tabs: /chrome\.tabs\.(query|get|update)/,
};
const allScripts = requiredScripts
  .filter((rel) => rel && rel.endsWith('.js') && existsSync(join(extDir, rel)))
  .map((rel) => readFileSync(join(extDir, rel), 'utf8'))
  .join('\n');
for (const perm of manifest.permissions ?? []) {
  const pattern = permissionUse[perm];
  if (!pattern) {
    errors.push(`permission "${perm}" has no usage check in validate-chrome-extension.mjs; add one`);
  } else if (!pattern.test(allScripts)) {
    errors.push(`permission "${perm}" is requested but never used; remove it from manifest.json`);
  }
}

const editorHtml = readFileSync(join(extDir, 'editor.html'), 'utf8');
if (!editorHtml.includes('letterLabel.js')) {
  errors.push('editor.html must load letterLabel.js before editor.js');
}

if (errors.length > 0) {
  console.error('Chrome extension validation failed:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`Chrome extension OK (v${manifest.version})`);
