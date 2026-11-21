/*
 * FeatherShot for Android: runs before the shared editor's own scripts
 * (WebViewCompat.addDocumentStartJavaScript in MainActivity.kt).
 *
 * The editor was written for Chrome. This file gives it the few browser APIs it needs
 * on Android, without changing chrome-extension/editor.js:
 *   0. assets/android/mobile.css -> phone layout for the toolbar
 *   1. chrome.storage.local  -> the image opened from the app's storage
 *   2. touch -> mouse        -> the editor draws with mouse events only
 *   3. <a download> data URL -> saved to Pictures/FeatherShot via the native bridge
 */
(function () {
  'use strict';

  // 0. Layout: the editor toolbar is one desktop row. On Android, android/mobile.css turns it into
  // a bottom dock for phones (Chrome and Electron never load that file). It must come after
  // editor.css in the cascade, so it is linked now and moved to the end of <head> once parsed.
  var mobileCss = document.createElement('link');
  mobileCss.rel = 'stylesheet';
  mobileCss.href = location.origin + '/assets/android/mobile.css';
  (document.head || document.documentElement).appendChild(mobileCss);
  document.addEventListener('DOMContentLoaded', function () {
    if (document.head && document.head.lastElementChild !== mobileCss) document.head.appendChild(mobileCss);
  });

  // 1. Initial screenshot: MainActivity opens editor.html?img=<file name in app storage>.
  var imageName = new URLSearchParams(location.search).get('img');
  var initialImage = imageName ? location.origin + '/incoming/' + encodeURIComponent(imageName) : null;

  window.chrome = {
    storage: {
      local: {
        get: function (keys, callback) {
          var data = {};
          if (initialImage) data.screenshotData = initialImage;
          if (typeof callback === 'function') callback(data);
        },
        remove: function (keys, callback) {
          if (typeof callback === 'function') callback();
        }
      }
    }
  };

  // 2. Touch input: forward single-finger touches on the canvas as the mouse events the editor listens for.
  function isCanvas(target) {
    return !!target && target.id === 'canvas';
  }

  function forward(type, touch, buttons) {
    var canvas = document.getElementById('canvas');
    if (!canvas) return;
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
      buttons: buttons
    }));
  }

  var touchOptions = { capture: true, passive: false };

  document.addEventListener('touchstart', function (e) {
    if (!isCanvas(e.target) || e.touches.length !== 1) return;
    e.preventDefault();
    forward('mousedown', e.touches[0], 1);
  }, touchOptions);

  document.addEventListener('touchmove', function (e) {
    if (!isCanvas(e.target) || e.touches.length !== 1) return;
    e.preventDefault();
    forward('mousemove', e.touches[0], 1);
  }, touchOptions);

  function endTouch(e) {
    if (!isCanvas(e.target)) return;
    e.preventDefault();
    var touch = e.changedTouches[0];
    if (touch) forward('mouseup', touch, 0);
  }

  document.addEventListener('touchend', endTouch, touchOptions);
  document.addEventListener('touchcancel', endTouch, touchOptions);

  // 3. Save: the editor creates <a download href="data:image/png;base64,..."> and clicks it.
  var PNG_PREFIX = 'data:image/png;base64,';
  var nativeClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function () {
    var href = this.getAttribute('href') || '';
    if (this.hasAttribute('download') && href.indexOf(PNG_PREFIX) === 0 && window.FeatherShotNative) {
      window.FeatherShotNative.saveImage(href.slice(PNG_PREFIX.length), this.getAttribute('download'));
      return;
    }
    return nativeClick.call(this);
  };
})();
