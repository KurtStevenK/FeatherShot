#!/usr/bin/env node
// Release asset names and uploads that in-app updates and the package managers rely on.
// GitHub rewrites other characters in uploaded asset names ("FeatherShot-Setup-1.3.31-(Windows).exe"
// became "FeatherShot-Setup-1.3.31-.Windows.exe"), so latest.yml, the Chocolatey script and the
// Homebrew cask would point at files that do not exist.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('electron-app/package.json'));
const { build } = pkg;
const workflow = read('.github/workflows/build-release.yml');
const [, owner, repo] = pkg.repository.url.match(/github\.com\/([^/]+)\/([^/.]+)/);
const downloadBase = `https://github.com/${owner}/${repo}/releases/download`;

// Letters, digits, ".", "-" and "_", not starting or ending with "." — kept as-is by GitHub.
const GITHUB_SAFE = /^[A-Za-z0-9_-]([A-Za-z0-9._-]*[A-Za-z0-9_-])?$/;

// electron-builder config key and file extension for each Windows / Linux target.
const TARGETS = {
  nsis: ['nsis', 'exe'],
  portable: ['portable', 'exe'],
  deb: ['deb', 'deb'],
  AppImage: ['appImage', 'AppImage'],
  pacman: ['pacman', 'pacman'],
};

function render(template, version, ext) {
  const name = template.replaceAll('${version}', version).replaceAll('${ext}', ext);
  assert.ok(!name.includes('${'), `unsupported macro in ${template}`);
  return name;
}

const failures = [];
function test(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

test('Windows and Linux asset names survive the GitHub upload', () => {
  const unsafe = [];
  for (const { target } of [...build.win.target, ...build.linux.target]) {
    const [key, ext] = TARGETS[target] || [];
    assert.ok(key, `no artifactName check for target ${target}`);
    const template = build[key]?.artifactName;
    assert.ok(template, `${key}.artifactName is not set (the default name has spaces)`);
    const name = render(template, pkg.version, ext);
    if (!GITHUB_SAFE.test(name)) unsafe.push(name);
  }
  assert.deepEqual(unsafe, [], `rewritten by GitHub: ${unsafe.join(', ')}`);
});

const dmgTemplate = read('build_release.sh').match(/^DMG_NAME="([^"]+)"/m)?.[1];

test('macOS DMG name survives the GitHub upload', () => {
  assert.ok(dmgTemplate, 'DMG_NAME not found in build_release.sh');
  const name = dmgTemplate.replaceAll('${VERSION}', pkg.version);
  assert.match(name, GITHUB_SAFE, `build_release.sh DMG_NAME gives ${name}`);
});

test('in-app updates read this repository', () => {
  const [publish] = build.publish;
  assert.deepEqual(
    { provider: publish.provider, owner: publish.owner, repo: publish.repo },
    { provider: 'github', owner, repo }
  );
});

test('latest.yml and the installer blockmap are attached to the release', () => {
  for (const line of [
    'electron-app/dist/latest.yml',
    'electron-app/dist/*.exe.blockmap',
    'release-artifacts/**/latest.yml',
    'release-artifacts/**/*.blockmap',
  ]) {
    assert.ok(workflow.includes(line), `build-release.yml does not upload ${line}`);
  }
});

test('Chocolatey downloads the NSIS installer by its release asset name', () => {
  const url = read('packaging/chocolatey/tools/chocolateyinstall.ps1').match(/url\s*=\s*'([^']+)'/)?.[1];
  const installer = render(build.nsis.artifactName, '__VERSION__', 'exe');
  assert.equal(url, `${downloadBase}/v__VERSION__/${installer}`);
});

test('the Homebrew cask downloads the DMG by its release asset name', () => {
  const url = read('packaging/homebrew/feathershot.rb').match(/url "([^"]+)"/)?.[1];
  const dmg = dmgTemplate.replaceAll('${VERSION}', '#{version}');
  assert.equal(url, `${downloadBase}/v#{version}/${dmg}`);
});

if (failures.length) {
  console.error(`Release asset checks failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Release assets OK');
