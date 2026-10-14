const fs = require('fs');
const { app, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { compareVersions, fetchLatestRelease } = require('./github-release');

const DOWNLOAD_PAGE = 'https://github.com/KurtStevenK/FeatherShot/releases/latest';

function linuxUpgradeHint() {
  if (fs.existsSync('/etc/arch-release')) {
    return 'sudo pacman -Sy feathershot';
  }
  return 'sudo apt-get update && sudo apt-get install --only-upgrade feathershot';
}

let trayRefresh = null;

function initUpdater(onTrayRefresh) {
  trayRefresh = onTrayRefresh;
  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'FeatherShot',
      message: 'An update is available.',
      detail: 'Download and install now? The app will restart when finished.',
      buttons: ['Download', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate().catch(showDownloadFailed);
    });
  });
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'FeatherShot',
      message: 'Update downloaded.',
      detail: 'Restart to apply the update.',
      buttons: ['Restart', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });
  autoUpdater.on('update-not-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'FeatherShot',
      message: `FeatherShot ${app.getVersion()} is the latest release.`,
    });
  });
  autoUpdater.on('error', (err) => {
    console.error('autoUpdater error:', err);
  });
}

function showDownloadFailed(err) {
  dialog.showMessageBox({
    type: 'warning',
    title: 'FeatherShot',
    message: 'Could not download the update.',
    detail: String(err.message || err),
    buttons: ['Open Download Page', 'OK'],
  }).then(({ response }) => {
    if (response === 0) shell.openExternal(DOWNLOAD_PAGE);
  });
}

async function checkForUpdatesInteractive() {
  const current = app.getVersion();

  // electron-updater updates through the NSIS installer, which would install a second copy
  // next to the portable .exe, so the portable build gets the download page instead.
  if (process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE) {
    try {
      await autoUpdater.checkForUpdates();
      return;
    } catch (e) {
      console.warn('electron-updater failed, falling back to GitHub API', e);
    }
  }

  try {
    const release = await fetchLatestRelease();
    const tag = (release.tag_name || '').replace(/^v/, '');
    if (!tag || compareVersions(tag, current) <= 0) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'FeatherShot',
        message: `FeatherShot ${current} is the latest release.`,
      });
      return;
    }
    const detail = process.platform === 'linux'
      ? `Version ${tag} is available.\n\n${linuxUpgradeHint()}\n\nOr open the download page.`
      : `Version ${tag} is available (you have ${current}).`;
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update available',
      message: release.name || `v${tag}`,
      detail,
      buttons: ['Open Download Page', 'OK'],
    });
    if (response === 0) {
      shell.openExternal(DOWNLOAD_PAGE);
    }
  } catch (e) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Check for Updates',
      message: 'Could not check for updates.',
      detail: String(e.message || e),
    });
  }
}

module.exports = { initUpdater, checkForUpdatesInteractive };
