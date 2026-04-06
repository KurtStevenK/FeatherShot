/* FeatherShot — Area Selection Content Script */
(function () {
  // Prevent double-injection
  if (document.getElementById('feathershot-overlay')) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'feathershot-overlay';

  // Selection rectangle
  const sel = document.createElement('div');
  sel.id = 'feathershot-selection';
  sel.style.display = 'none';

  // Dimension label
  const dim = document.createElement('div');
  dim.id = 'feathershot-dim';

  // Instructions hint
  const hint = document.createElement('div');
  hint.id = 'feathershot-hint';
  hint.textContent = 'Drag to select an area · Press Esc to cancel';

  overlay.appendChild(sel);
  document.body.appendChild(overlay);
  document.body.appendChild(dim);
  document.body.appendChild(hint);

  let startX = 0, startY = 0, selecting = false;

  overlay.addEventListener('mousedown', (e) => {
    selecting = true;
    startX = e.clientX;
    startY = e.clientY;
    sel.style.display = 'block';
    sel.style.left = startX + 'px';
    sel.style.top = startY + 'px';
    sel.style.width = '0px';
    sel.style.height = '0px';
    hint.style.display = 'none';
    overlay.style.background = 'transparent'; // Let box-shadow handle dimming
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!selecting) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    sel.style.left = x + 'px';
    sel.style.top = y + 'px';
    sel.style.width = w + 'px';
    sel.style.height = h + 'px';

    dim.textContent = `${w} × ${h}`;
    dim.style.display = 'block';
    dim.style.left = (e.clientX + 12) + 'px';
    dim.style.top = (e.clientY + 12) + 'px';
  });

  overlay.addEventListener('mouseup', (e) => {
    if (!selecting) return;
    selecting = false;
    dim.style.display = 'none';

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    cleanup();

    if (w < 5 || h < 5) return;

    // Send crop region to background script
    // Coordinates are in CSS pixels relative to the viewport
    chrome.runtime.sendMessage({
      action: 'area-selected',
      crop: {
        x: x,
        y: y,
        width: w,
        height: h,
        vpWidth: window.innerWidth,
        vpHeight: window.innerHeight,
        dpr: window.devicePixelRatio
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  });

  function cleanup() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (dim.parentNode) dim.parentNode.removeChild(dim);
    if (hint.parentNode) hint.parentNode.removeChild(hint);
  }
})();
