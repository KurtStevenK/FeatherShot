#!/usr/bin/env node
// Resolves the Windows in-app update the way an installed FeatherShot does (electron-updater's GitHub
// provider with the "publish" config from electron-app/package.json), then downloads the installer that
// latest.yml points to and checks its SHA-512 and size, as the updater does before installing.
//   node scripts/verify-update-feed.mjs v1.3.33
// Needs electron-app/node_modules (npm ci in electron-app). The tag must be the latest release.
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRequire = createRequire(path.join(root, 'electron-app/package.json'));
const updaterRequire = createRequire(appRequire.resolve('electron-updater'));
const { CancellationToken, HttpExecutor, configureRequestOptions, configureRequestUrl } =
  updaterRequire('builder-util-runtime');
const { GitHubProvider } = updaterRequire('./providers/GitHubProvider');
const { findFile } = updaterRequire('./providers/Provider');

const tag = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) {
  console.error('usage: node scripts/verify-update-feed.mjs vX.Y.Z');
  process.exit(2);
}

// electron-updater's ElectronHttpExecutor, with Node's https in place of Electron's net module.
class NodeHttpExecutor extends HttpExecutor {
  createRequest(options, callback) {
    return https.request(options, callback);
  }

  download(url, destination, options) {
    return options.cancellationToken.createPromise((resolve, reject, onCancel) => {
      const requestOptions = { headers: options.headers || undefined, redirect: 'manual' };
      configureRequestUrl(url, requestOptions);
      configureRequestOptions(requestOptions);
      this.doDownload(requestOptions, {
        destination,
        options,
        onCancel,
        callback: (error) => (error == null ? resolve(destination) : reject(error)),
        responseHandler: null,
      }, 0);
    });
  }
}

const { build } = JSON.parse(fs.readFileSync(path.join(root, 'electron-app/package.json'), 'utf8'));
const executor = new NodeHttpExecutor();
// An installed app on the stable channel; currentVersion only matters for prerelease channels.
const updater = { allowPrerelease: false, channel: null, currentVersion: '0.0.0', fullChangelog: false };
const provider = new GitHubProvider(build.publish[0], updater, { executor, platform: 'win32' });

async function latestUpdateInfo() {
  // releases/latest can still name the previous release for a moment after publishing.
  for (let attempt = 1; ; attempt++) {
    let problem;
    try {
      const info = await provider.getLatestVersion();
      if (info.tag === tag) return info;
      problem = `the latest release is ${info.tag}`;
    } catch (e) {
      // electron-updater appends the stack and response headers.
      problem = e.message.split('\n')[0];
    }
    if (attempt === 6) throw new Error(problem);
    console.log(`  retrying in 10 s: ${problem}`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

async function check() {
  const info = await latestUpdateInfo();
  if (info.version !== tag.slice(1)) throw new Error(`latest.yml is for version ${info.version}`);

  // The file NsisUpdater downloads.
  const installer = findFile(provider.resolveFiles(info), 'exe');
  console.log(`${tag}: electron-updater resolves ${installer.url.href}`);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feathershot-update-'));
  try {
    const file = path.join(dir, 'installer.exe');
    await executor.download(installer.url, file, {
      sha512: installer.info.sha512,
      cancellationToken: new CancellationToken(),
    });
    const { size } = fs.statSync(file);
    if (installer.info.size != null && size !== installer.info.size) {
      throw new Error(`the installer has ${size} bytes, latest.yml says ${installer.info.size}`);
    }
    console.log(`  ${size} bytes, SHA-512 matches latest.yml`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Differential downloads of the next release fetch this release's blockmap next to the installer.
  const blockmap = await fetch(`${installer.url.href}.blockmap`, { method: 'HEAD' });
  if (!blockmap.ok) throw new Error(`no blockmap next to the installer (HTTP ${blockmap.status})`);
  console.log('  blockmap present');
}

try {
  await check();
} catch (e) {
  console.error(`Update feed check failed for ${tag}: ${e.message}`);
  process.exitCode = 1;
}
