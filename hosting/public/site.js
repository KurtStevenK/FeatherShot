(function () {
  const FALLBACK = 'https://github.com/KurtStevenK/FeatherShot/releases/latest';

  const cardMap = {
    macos_dmg: 0,
    windows_exe: 1,
    linux_deb: 2,
    chrome_zip: 3,
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
