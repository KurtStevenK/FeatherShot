(function () {
  const FALLBACK = 'https://github.com/KurtStevenK/FeatherShot/releases/latest';

  const cardMap = {
    macos_dmg: 0,
    windows_exe: 1,
    linux_deb: 2,
    android_apk: 4,
    // The Chrome card links to the Chrome Web Store listing, not the ZIP.
  };

  function applyManifest(data) {
    const badge = document.querySelector('.badge');
    if (badge && data.version) {
      badge.textContent = `✨ v${data.version} — download from Firebase mirror`;
    }

    const cards = document.querySelectorAll('.download-grid .download-card');
    const assets = data.assets || {};

    Object.entries(cardMap).forEach(([key, index]) => {
      const card = cards[index];
      const asset = assets[key];
      if (!card || !asset?.url) return;
      card.href = asset.url;
      card.setAttribute('download', asset.filename || '');
      const format = card.querySelector('.download-format');
      if (format && asset.filename) {
        format.textContent = asset.filename;
      }
    });

    const msiLink = document.getElementById('msi-link');
    if (msiLink && assets.windows_msi?.url) {
      msiLink.href = assets.windows_msi.url;
      msiLink.setAttribute('download', assets.windows_msi.filename || '');
    }

    applyVirusTotal(assets);
    setupVerify(assets);

    if (assets.linux_deb?.url || assets.linux_appimage?.url || assets.linux_pacman?.url) {
      const linuxCard = cards[2];
      if (linuxCard) {
        linuxCard.href =
          assets.linux_deb?.url ||
          assets.linux_appimage?.url ||
          assets.linux_pacman?.url ||
          FALLBACK;
      }
    }
  }

  const VT_FILE = (sha256) => `https://www.virustotal.com/gui/file/${sha256}`;

  // The "Scanned by VirusTotal" line sits inside a card link, so it opens its own link by script.
  function applyVirusTotal(assets) {
    document.querySelectorAll('.vt-check[data-asset]').forEach((el) => {
      const sha = assets[el.dataset.asset]?.sha256;
      if (sha) {
        el.dataset.href = VT_FILE(sha);
        el.title = `VirusTotal report for ${assets[el.dataset.asset].filename || 'this file'}`;
      }
    });
  }

  function openVirusTotal(e) {
    const el = e.target.closest('.vt-check');
    if (!el) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    window.open(el.dataset.href, '_blank', 'noopener');
  }
  document.addEventListener('click', openVirusTotal, true);
  document.addEventListener('keydown', openVirusTotal, true);

  // ─── "How to check that your download really comes from us" ───
  const VERIFY_LABELS = {
    windows_exe: 'Windows installer (.exe)',
    windows_msi: 'Windows package (.msi)',
    macos_dmg: 'macOS (.dmg)',
    linux_deb: 'Linux, Debian/Ubuntu (.deb)',
    linux_appimage: 'Linux (.AppImage)',
    linux_pacman: 'Arch Linux (.pacman)',
    linux_snap: 'Linux snap (.snap)',
    android_apk: 'Android (.apk)',
    chrome_zip: 'Chrome extension (.zip)',
  };

  function userOs() {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return 'windows';
    if (/Android/i.test(ua)) return 'android';
    if (/Mac/i.test(ua)) return 'macos';
    return 'linux';
  }

  function fillCommands(file, hash) {
    document.querySelectorAll('#verify code[data-tpl]').forEach((code) => {
      const text = code.dataset.tpl.replaceAll('{file}', file).replaceAll('{hash}', hash);
      code.textContent = text;
      const btn = code.parentElement.querySelector('.copy-btn');
      if (btn) btn.dataset.copy = text;
    });
    document.querySelectorAll('#verify .v-file').forEach((el) => {
      el.textContent = file;
    });
  }

  function setupVerify(assets) {
    const select = document.getElementById('verify-file');
    if (!select) return;
    const keys = Object.keys(VERIFY_LABELS).filter((k) => assets[k]?.sha256 && assets[k]?.filename);
    if (!keys.length) return;
    select.innerHTML = '';
    keys.forEach((k) => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = `${VERIFY_LABELS[k]}: ${assets[k].filename}`;
      select.appendChild(opt);
    });
    const os = userOs();
    const preferred = { windows: 'windows_exe', macos: 'macos_dmg', linux: 'linux_deb', android: 'android_apk' }[os];
    if (keys.includes(preferred)) select.value = preferred;

    const update = () => {
      const asset = assets[select.value];
      document.getElementById('verify-hash').textContent = asset.sha256;
      document.getElementById('verify-hash-copy').dataset.copy = asset.sha256;
      document.getElementById('verify-vt').href = VT_FILE(asset.sha256);
      fillCommands(asset.filename, asset.sha256);
    };
    select.addEventListener('change', update);
    update();
  }

  function setupVerifyTabs() {
    const tabs = document.querySelectorAll('.verify-tabs [data-os]');
    if (!tabs.length) return;
    const show = (os) => {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.os === os)));
      document.querySelectorAll('.verify-os').forEach((panel) => {
        panel.hidden = panel.dataset.os !== os;
      });
    };
    tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.os)));
    const os = userOs();
    show(os === 'android' ? 'windows' : os);
    // Without the release list the commands still read sensibly.
    fillCommands('FILE-NAME', 'FINGERPRINT-FROM-STEP-1');
    const hash = document.getElementById('verify-hash');
    if (hash) hash.textContent = 'See the release page on GitHub (sha256: next to each file).';
  }
  setupVerifyTabs();
  if (location.hash === '#verify') document.getElementById('verify')?.setAttribute('open', '');

  // Copy buttons in the guide are written without icons; add the same two icons as the others.
  const COPY_ICONS =
    '<svg class="copy-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>' +
    '<svg class="copy-icon-done" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>';
  document.querySelectorAll('.copy-btn:empty').forEach((btn) => {
    btn.innerHTML = COPY_ICONS;
  });

  fetch('/releases/latest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.version) applyManifest(data);
    })
    .catch(() => {});

  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const label = btn.getAttribute('aria-label') || 'Copy';
      btn.classList.add('copied');
      btn.setAttribute('aria-label', 'Copied');
      window.setTimeout(() => {
        btn.classList.remove('copied');
        btn.setAttribute('aria-label', label);
      }, 2000);
    });
  });
})();
