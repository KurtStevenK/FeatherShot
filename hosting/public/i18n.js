/*
 * FeatherShot website in 44 languages.
 *
 * Texts live in /i18n/<code>.json, keyed like the attributes on the page:
 *   data-i18n="key"             replaces the element's content (may contain <a>, <strong>, <em>, <code>, <span>, <br>)
 *   data-i18n-alt="key"         replaces the alt attribute
 *   data-i18n-label="key"       replaces the aria-label attribute
 *   data-i18n-title="key"       replaces the title attribute
 *   data-i18n-content="key"     replaces the content attribute (meta tags)
 * The English text in the HTML is what shows before the language file has loaded.
 * Scripts use FeatherShotI18n.t(key, englishFallback, vars) for dynamic text.
 * The language choice is remembered in localStorage; otherwise the browser language is used.
 * After every change the document fires "fs:i18n" so scripts can refresh their parts.
 */
(function () {
  'use strict';

  // Same 44 languages as niiii.org: the 24 official EU languages, then regional and widely spoken ones.
  const LANGUAGES = [
    { code: 'en', name: 'English', locale: 'en', group: 'eu' },
    { code: 'de', name: 'Deutsch', locale: 'de-AT', group: 'eu' },
    { code: 'bg', name: 'Български', locale: 'bg-BG', group: 'eu' },
    { code: 'cs', name: 'Čeština', locale: 'cs-CZ', group: 'eu' },
    { code: 'da', name: 'Dansk', locale: 'da-DK', group: 'eu' },
    { code: 'el', name: 'Ελληνικά', locale: 'el-GR', group: 'eu' },
    { code: 'es', name: 'Español', locale: 'es-ES', group: 'eu' },
    { code: 'et', name: 'Eesti', locale: 'et-EE', group: 'eu' },
    { code: 'fi', name: 'Suomi', locale: 'fi-FI', group: 'eu' },
    { code: 'fr', name: 'Français', locale: 'fr-FR', group: 'eu' },
    { code: 'ga', name: 'Gaeilge', locale: 'ga-IE', group: 'eu' },
    { code: 'hr', name: 'Hrvatski', locale: 'hr-HR', group: 'eu' },
    { code: 'hu', name: 'Magyar', locale: 'hu-HU', group: 'eu' },
    { code: 'it', name: 'Italiano', locale: 'it-IT', group: 'eu' },
    { code: 'lt', name: 'Lietuvių', locale: 'lt-LT', group: 'eu' },
    { code: 'lv', name: 'Latviešu', locale: 'lv-LV', group: 'eu' },
    { code: 'mt', name: 'Malti', locale: 'mt-MT', group: 'eu' },
    { code: 'nl', name: 'Nederlands', locale: 'nl-NL', group: 'eu' },
    { code: 'pl', name: 'Polski', locale: 'pl-PL', group: 'eu' },
    { code: 'pt', name: 'Português', locale: 'pt-PT', group: 'eu' },
    { code: 'ro', name: 'Română', locale: 'ro-RO', group: 'eu' },
    { code: 'sk', name: 'Slovenčina', locale: 'sk-SK', group: 'eu' },
    { code: 'sl', name: 'Slovenščina', locale: 'sl-SI', group: 'eu' },
    { code: 'sv', name: 'Svenska', locale: 'sv-SE', group: 'eu' },
    { code: 'ca', name: 'Català', locale: 'ca-ES', group: 'more' },
    { code: 'eu', name: 'Euskara', locale: 'eu-ES', group: 'more' },
    { code: 'gl', name: 'Galego', locale: 'gl-ES', group: 'more' },
    { code: 'cy', name: 'Cymraeg', locale: 'cy-GB', group: 'more' },
    { code: 'fy', name: 'Frysk', locale: 'fy-NL', group: 'more' },
    { code: 'hsb', name: 'Hornjoserbšćina', locale: 'hsb-DE', group: 'more' },
    { code: 'rom', name: 'Romani', locale: 'rom', group: 'more' },
    { code: 'yi', name: 'ייִדיש', locale: 'yi', group: 'more', rtl: true },
    { code: 'uk', name: 'Українська', locale: 'uk-UA', group: 'more' },
    { code: 'ru', name: 'Русский', locale: 'ru-RU', group: 'more' },
    { code: 'tr', name: 'Türkçe', locale: 'tr-TR', group: 'more' },
    { code: 'ar', name: 'العربية', locale: 'ar', group: 'more', rtl: true },
    { code: 'fa', name: 'فارسی / دری', locale: 'fa', group: 'more', rtl: true },
    { code: 'ps', name: 'پښتو', locale: 'ps', group: 'more', rtl: true },
    { code: 'ku', name: 'Kurdî', locale: 'ku', group: 'more' },
    { code: 'so', name: 'Soomaali', locale: 'so-SO', group: 'more' },
    { code: 'ti', name: 'ትግርኛ', locale: 'ti-ER', group: 'more' },
    { code: 'sr', name: 'Srpski', locale: 'sr-Latn-RS', group: 'more' },
    { code: 'bs', name: 'Bosanski', locale: 'bs-BA', group: 'more' },
    { code: 'sq', name: 'Shqip', locale: 'sq-AL', group: 'more' },
  ];

  const CODES = new Set(LANGUAGES.map((l) => l.code));
  // Other language codes that mean one of ours (browsers and older systems use them).
  const ALIAS = { prs: 'fa', kmr: 'ku', ckb: 'ku', sh: 'sr', cnr: 'sr', rmy: 'rom', ydd: 'yi' };
  const STORAGE_KEY = 'feathershot.lang';
  const CLOSE_ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // Flags as in niiii.org (30×20 SVG, simplified). Languages spoken in many countries get a
  // neutral mark instead of a national flag, and Windows does not draw emoji flags.
  const band = (a, b, c) =>
    `<rect width="30" height="20" fill="${b}"/><rect width="30" height="6.67" fill="${a}"/><rect y="13.33" width="30" height="6.67" fill="${c}"/>`;
  const vertical = (a, b, c) =>
    `<rect width="30" height="20" fill="${b}"/><rect width="10" height="20" fill="${a}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
  const nordic = (bg, cross, inner) =>
    `<rect width="30" height="20" fill="${bg}"/><rect x="8" width="5" height="20" fill="${cross}"/><rect y="7.5" width="30" height="5" fill="${cross}"/>` +
    (inner ? `<rect x="9.25" width="2.5" height="20" fill="${inner}"/><rect y="8.75" width="30" height="2.5" fill="${inner}"/>` : '');
  const shield = (x, y, fill, stroke = '#fff') =>
    `<path d="M${x} ${y}h5v4.2c0 2-1.4 3.2-2.5 3.8-1.1-.6-2.5-1.8-2.5-3.8z" fill="${fill}" stroke="${stroke}" stroke-width=".6"/>`;
  const bubble = (bg, dark, letter) =>
    `<rect width="30" height="20" fill="${bg}"/><rect y="15" width="30" height="5" fill="${dark}"/>` +
    `<path d="M8 3.5h14a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-6l-3.5 3v-3H8A2.5 2.5 0 0 1 5.5 12V6A2.5 2.5 0 0 1 8 3.5z" fill="#fff"/>` +
    `<text x="15" y="12.4" text-anchor="middle" font-size="8.5" font-weight="700" fill="${dark}" font-family="'Segoe UI','Noto Sans','Noto Sans Arabic','Noto Sans Hebrew',system-ui,sans-serif">${letter}</text>`;
  const stripes = (color) =>
    [1, 3, 5, 7].map((i) => `<rect y="${(i * 2.22).toFixed(2)}" width="30" height="2.22" fill="${color}"/>`).join('');

  const FLAG_SVG = {
    at: band('#c8102e', '#fff', '#c8102e'),
    de: band('#000', '#dd0000', '#ffce00'),
    gb: '<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.4"/>',
    bg: band('#fff', '#00966e', '#d62612'),
    cz: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0l15 10L0 20z" fill="#11457e"/>',
    dk: nordic('#c8102e', '#fff'),
    gr: '<rect width="30" height="20" fill="#0d5eaf"/>' + stripes('#fff').replace(/<rect y="([\d.]+)" width="30" height="2.22" fill="#fff"\/>/g, '<rect y="$1" width="30" height="2.22" fill="#fff"/>') + '<rect width="11.1" height="11.1" fill="#0d5eaf"/><rect x="4.44" width="2.22" height="11.1" fill="#fff"/><rect y="4.44" width="11.1" height="2.22" fill="#fff"/>',
    es: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect x="7" y="7.5" width="3.5" height="5" rx=".8" fill="#aa151b"/>',
    ee: band('#0072ce', '#000', '#fff'),
    fi: nordic('#fff', '#002f6c'),
    fr: vertical('#002395', '#fff', '#ed2939'),
    ie: vertical('#169b62', '#fff', '#ff883e'),
    hr: band('#ff0000', '#fff', '#171796') + '<rect x="12" y="5" width="6" height="7" fill="#fff" stroke="#ff0000" stroke-width=".5"/><path d="M12 5h2v2.33h-2zM16 5h2v2.33h-2zM14 7.33h2v2.33h-2zM12 9.66h2v2.33h-2zM16 9.66h2v2.33h-2z" fill="#ff0000"/>',
    hu: band('#cd2a3e', '#fff', '#436f4d'),
    it: vertical('#009246', '#fff', '#ce2b37'),
    lt: band('#fdb913', '#006a44', '#c1272d'),
    lv: '<rect width="30" height="20" fill="#9e3039"/><rect y="8" width="30" height="4" fill="#fff"/>',
    mt: '<rect width="30" height="20" fill="#cf142b"/><rect width="15" height="20" fill="#fff"/><path d="M3 2.5h1.4v1.4h1.4v1.4H4.4v1.4H3V5.3H1.6V3.9H3z" fill="#a0a0a0" stroke="#cf142b" stroke-width=".3"/>',
    nl: band('#ae1c28', '#fff', '#21468b'),
    pl: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#dc143c"/>',
    pt: '<rect width="30" height="20" fill="#ff0000"/><rect width="12" height="20" fill="#006600"/><circle cx="12" cy="10" r="3.6" fill="#ffcc00"/><path d="M10.6 8h2.8v3.2c0 .9-.6 1.4-1.4 1.6-.8-.2-1.4-.7-1.4-1.6z" fill="#fff" stroke="#ff0000" stroke-width=".5"/>',
    ro: vertical('#002b7f', '#fcd116', '#ce1126'),
    sk: band('#fff', '#0b4ea2', '#ee1c25') + shield(6.5, 4.5, '#ee1c25') + '<path d="M9 5.6v5M7.6 7.2h2.8M7.2 8.6h3.6" stroke="#fff" stroke-width=".7"/>',
    si: band('#fff', '#0000ff', '#ff0000') + shield(6, 3.2, '#0000ff', '#ff0000') + '<path d="M7 8.3l1.5-2 1.5 2z" fill="#fff"/>',
    se: nordic('#006aa7', '#fecc02'),
    eu: '<rect width="30" height="20" fill="#003399"/>' + Array.from({ length: 12 }, (_, i) => `<circle cx="${(15 + 6 * Math.sin((i * Math.PI) / 6)).toFixed(2)}" cy="${(10 - 6 * Math.cos((i * Math.PI) / 6)).toFixed(2)}" r=".9" fill="#ffcc00"/>`).join(''),
    ua: '<rect width="30" height="10" fill="#0057b7"/><rect y="10" width="30" height="10" fill="#ffd700"/>',
    tr: '<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/><path d="M17.3 10l3.4-1.1-2.1 2.9V8.2l2.1 2.9z" fill="#fff"/>',
    al: '<rect width="30" height="20" fill="#e41e20"/><path d="M15 4l2.2 2.4 3-1-1.3 3 2.4 1.8-3 .6.4 3.2-2.6-1.6L15 16l-1.1-3.6-2.6 1.6.4-3.2-3-.6 2.4-1.8-1.3-3 3 1z" fill="#000"/>',
    rs: band('#c6363c', '#0c4076', '#fff') + shield(7, 4.5, '#c6363c'),
    ba: '<rect width="30" height="20" fill="#002395"/><path d="M8 0h14v20z" fill="#fecb00"/>' + Array.from({ length: 6 }, (_, i) => `<circle cx="${(6.5 + i * 2.6).toFixed(2)}" cy="${(1.5 + i * 3.4).toFixed(2)}" r=".9" fill="#fff"/>`).join(''),
    so: '<rect width="30" height="20" fill="#4189dd"/><path d="M15 5.5l1.2 3.5h3.7l-3 2.2 1.1 3.5-3-2.2-3 2.2 1.1-3.5-3-2.2h3.7z" fill="#fff"/>',
    er: '<rect width="30" height="10" fill="#12ad2b"/><rect y="10" width="30" height="10" fill="#4189dd"/><path d="M0 0l30 10L0 20z" fill="#ea0437"/><circle cx="8" cy="10" r="3" fill="none" stroke="#ffc726" stroke-width="1"/>',
    catalonia: '<rect width="30" height="20" fill="#fcdd09"/>' + stripes('#da121a'),
    basque: '<rect width="30" height="20" fill="#d52b1e"/><path d="M0 0l30 20M30 0L0 20" stroke="#009b48" stroke-width="3"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="3"/>',
    galicia: '<rect width="30" height="20" fill="#fff"/><path d="M0 0l30 20" stroke="#0099cc" stroke-width="4.5"/>',
    wales: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#00b140"/><path d="M8 13c2-4 6-6 10-5l3-2-1 3c2 1 3 3 2 5l-3-1-2 3-2-2-4 2 1-3z" fill="#d30731"/>',
    frisia: '<rect width="30" height="20" fill="#fff"/>' + [0, 1, 2, 3].map((i) => `<path d="M${-6 + i * 10} 0h4l10 20h-4z" fill="#0067b1"/>`).join('') + '<circle cx="9" cy="5" r="1.2" fill="#e2001a"/><circle cx="19" cy="15" r="1.2" fill="#e2001a"/>',
    sorbian: band('#0d4ea0', '#d52b1e', '#fff'),
    romani: '<rect width="30" height="10" fill="#0072ce"/><rect y="10" width="30" height="10" fill="#009a44"/><circle cx="15" cy="10" r="4.5" fill="none" stroke="#e4002b" stroke-width="1.2"/><path d="M15 5.5v9M10.5 10h9M11.8 6.8l6.4 6.4M18.2 6.8l-6.4 6.4" stroke="#e4002b" stroke-width=".7"/>',
    kurdistan: band('#ed2024', '#fff', '#278e43') + '<circle cx="15" cy="10" r="2.8" fill="#febd11"/>',
    'lang-yi': bubble('#1d4ed8', '#1e3a8a', 'א'),
    'lang-ru': bubble('#475569', '#334155', 'Я'),
    'lang-ar': bubble('#047857', '#065f46', 'ع'),
    'lang-fa': bubble('#b45309', '#92400e', 'ف'),
    'lang-ps': bubble('#7c3aed', '#5b21b6', 'پ'),
    globe: '<rect width="30" height="20" fill="#0f766e"/><circle cx="15" cy="10" r="6.5" fill="none" stroke="#fff" stroke-width="1.2"/><ellipse cx="15" cy="10" rx="3" ry="6.5" fill="none" stroke="#fff" stroke-width="1"/><path d="M8.5 10h13M9.5 6.5h11M9.5 13.5h11" stroke="#fff" stroke-width="1"/>',
  };

  // Which flag each language shows (the same choices as niiii.org).
  const FLAG_FOR = {
    en: 'gb', de: 'at', bg: 'bg', cs: 'cz', da: 'dk', el: 'gr', es: 'es', et: 'ee', fi: 'fi', fr: 'fr', ga: 'ie',
    hr: 'hr', hu: 'hu', it: 'it', lt: 'lt', lv: 'lv', mt: 'mt', nl: 'nl', pl: 'pl', pt: 'pt', ro: 'ro', sk: 'sk',
    sl: 'si', sv: 'se', ca: 'catalonia', eu: 'basque', gl: 'galicia', cy: 'wales', fy: 'frisia', hsb: 'sorbian',
    rom: 'romani', yi: 'lang-yi', uk: 'ua', ru: 'lang-ru', tr: 'tr', ar: 'lang-ar', fa: 'lang-fa', ps: 'lang-ps',
    ku: 'kurdistan', so: 'so', ti: 'er', sr: 'rs', bs: 'ba', sq: 'al',
  };

  const dicts = {};
  const pending = {};
  const originalHtml = new Map(); // [data-i18n] element -> English content as written in the HTML
  const originalTags = new Map(); // same element -> its English child elements (for their attributes)
  const originalAttrs = new Map(); // element with data-i18n-* -> English value of each target attribute
  const i18nAttrElements = [];
  const buttons = [];
  let current = 'en';
  let openDialogState = null;

  function info(code) {
    return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
  }

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    for (const name of Object.keys(attrs || {})) node.setAttribute(name, attrs[name]);
    if (text != null) node.textContent = text;
    return node;
  }

  // A flag element; `flag` is a key of FLAG_SVG.
  function flagEl(flag, className) {
    const span = el('span', { class: 'lang-flag ' + className, 'aria-hidden': 'true' });
    span.innerHTML = '<svg viewBox="0 0 30 20" preserveAspectRatio="none">' + (FLAG_SVG[flag] || '<rect width="30" height="20" fill="#ccc"/>') + '</svg>';
    return span;
  }

  function attrTarget(name) {
    const suffix = name.slice('data-i18n-'.length);
    return suffix === 'label' ? 'aria-label' : suffix;
  }

  function load(code) {
    if (dicts[code]) return Promise.resolve(dicts[code]);
    if (!pending[code]) {
      pending[code] = fetch('/i18n/' + code + '.json')
        .then((r) => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then((data) => {
          dicts[code] = data;
          return data;
        })
        .finally(() => {
          delete pending[code];
        });
    }
    return pending[code];
  }

  function detect() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CODES.has(saved)) return saved;
    } catch (e) {
      /* private mode: no storage */
    }
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const pref of prefs) {
      const base = String(pref || '').toLowerCase().split('-')[0];
      if (CODES.has(base)) return base;
      if (ALIAS[base]) return ALIAS[base];
    }
    return 'en';
  }

  // Keep the English as it is written in the HTML, so that it can come back and so that
  // translated attributes can be given the same href, class or id as the English link.
  function snapshot() {
    document.querySelectorAll('img[data-badge]').forEach((img) => {
      img.dataset.defaultSrc = img.getAttribute('src');
    });
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      originalHtml.set(node, node.innerHTML);
      const template = document.createElement('template');
      template.innerHTML = node.innerHTML;
      originalTags.set(node, [...template.content.querySelectorAll('*')]);
    });
    document.querySelectorAll('*').forEach((node) => {
      let found = false;
      for (const attr of [...node.attributes]) {
        if (!attr.name.startsWith('data-i18n-')) continue;
        found = true;
        const target = attrTarget(attr.name);
        const values = originalAttrs.get(node) || {};
        values[target] = node.getAttribute(target);
        originalAttrs.set(node, values);
      }
      if (found) i18nAttrElements.push(node);
    });
  }

  function render(node, text) {
    const template = document.createElement('template');
    template.innerHTML = text;
    const englishTags = originalTags.get(node) || [];
    const seen = {};
    template.content.querySelectorAll('*').forEach((child) => {
      const tag = child.localName;
      seen[tag] = (seen[tag] ?? -1) + 1;
      const source = englishTags.filter((t) => t.localName === tag)[seen[tag]];
      if (source) for (const attr of [...source.attributes]) child.setAttribute(attr.name, attr.value);
    });
    node.replaceChildren(template.content);
  }

  function applyTexts() {
    const dict = dicts[current] || {};
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const text = dict[node.getAttribute('data-i18n')];
      if (typeof text === 'string') render(node, text);
      else node.innerHTML = originalHtml.get(node) ?? node.innerHTML;
    });
    i18nAttrElements.forEach((node) => {
      const original = originalAttrs.get(node) || {};
      for (const attr of [...node.attributes]) {
        if (!attr.name.startsWith('data-i18n-')) continue;
        const target = attrTarget(attr.name);
        const text = dict[attr.value];
        if (typeof text === 'string') node.setAttribute(target, text);
        else if (original[target] === null) node.removeAttribute(target);
        else if (original[target] !== undefined) node.setAttribute(target, original[target]);
      }
    });
  }

  function t(key, fallback, vars) {
    const own = dicts[current];
    let text = (own && typeof own[key] === 'string' ? own[key] : null) ?? (dicts.en && dicts.en[key]) ?? fallback ?? key;
    if (vars) text = text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
    return text;
  }

  function updateButtons() {
    const label = t('lang.title', 'Language');
    buttons.forEach((button) => {
      button.querySelector('.lang-flag-slot').replaceChildren(flagEl(FLAG_FOR[current] || 'globe', 'lang-btn-flag'));
      button.querySelector('.lang-code').textContent = current.toUpperCase();
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
  }

  // Store badges: Apple and Snap publish localized artwork for these languages (badges/<store>/<code>.svg).
  // The Chrome Web Store badge is the same English image in every language, so it stays as it is.
  // Every other language keeps the English badge.
  const BADGE_LANGS = {
    'app-store': ['bg', 'ca', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hr', 'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk'],
    'mac-app-store': ['ca', 'da', 'de', 'es', 'fi', 'fr', 'hr', 'it', 'nl', 'pt', 'ru', 'sv', 'tr', 'uk'],
    'snap-store': ['bg', 'de', 'es', 'fr', 'it', 'pl', 'pt', 'ro', 'ru', 'sk', 'uk'],
  };

  function applyBadges(code) {
    document.querySelectorAll('img[data-badge]').forEach((img) => {
      const store = img.getAttribute('data-badge');
      const localized = (BADGE_LANGS[store] || []).includes(code);
      img.setAttribute('src', localized ? `/badges/${store}/${code}.svg` : img.dataset.defaultSrc);
    });
  }

  function setCurrent(code) {
    current = code;
    const meta = info(code);
    document.documentElement.lang = meta.locale;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
    applyTexts();
    applyBadges(code);
    updateButtons();
    document.dispatchEvent(new CustomEvent('fs:i18n', { detail: { lang: code } }));
  }

  async function setLang(code) {
    if (!CODES.has(code)) return;
    try {
      await load(code);
    } catch (e) {
      return; // keep the current language if the file cannot be loaded
    }
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {
      /* private mode */
    }
    setCurrent(code);
  }

  // ---- Language picker: a button in the navigation and a full-screen list of all languages ----

  function localName(code, own) {
    try {
      const name = new Intl.DisplayNames([info(current).locale], { type: 'language' }).of(code);
      if (!name || name.toLowerCase() === code || name.toLowerCase() === own.toLowerCase()) return '';
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch (e) {
      return '';
    }
  }

  function tile(language) {
    const button = el('button', {
      type: 'button',
      class: 'lang-tile',
      'data-code': language.code,
      'aria-current': language.code === current ? 'true' : 'false',
    });
    button.append(flagEl(FLAG_FOR[language.code] || 'globe', 'lang-tile-flag'));
    const text = el('span', { class: 'lang-tile-text' });
    text.append(el('span', { class: 'lang-tile-name', lang: language.locale, dir: language.rtl ? 'rtl' : 'ltr' }, language.name));
    const sub = localName(language.code, language.name);
    if (sub) text.append(el('span', { class: 'lang-tile-sub' }, sub));
    button.append(text);
    button.addEventListener('click', async () => {
      await setLang(language.code);
      closeDialog();
    });
    return button;
  }

  function openDialog(trigger) {
    if (openDialogState) return;
    const overlay = el('div', { class: 'lang-overlay' });
    const dialog = el('div', { class: 'lang-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lang-title' });

    const head = el('div', { class: 'lang-head' });
    head.append(el('h2', { id: 'lang-title' }, t('lang.title', 'Language')));
    const close = el('button', { type: 'button', class: 'lang-close', 'aria-label': t('lang.close', 'Close'), title: t('lang.close', 'Close') });
    close.innerHTML = CLOSE_ICON;
    close.addEventListener('click', closeDialog);
    head.append(close);

    const body = el('div', { class: 'lang-body' });
    const groups = [
      ['eu', t('lang.eu', 'Official EU languages')],
      ['more', t('lang.more', 'More languages')],
    ];
    for (const [group, title] of groups) {
      const section = el('section', { class: 'lang-group' });
      const heading = el('h3', { class: 'lang-group-title' });
      heading.append(flagEl(group === 'eu' ? 'eu' : 'globe', 'lang-group-flag'), title);
      section.append(heading);
      const grid = el('div', { class: 'lang-grid', role: 'group', 'aria-label': title });
      LANGUAGES.filter((l) => l.group === group).forEach((l) => grid.append(tile(l)));
      section.append(grid);
      body.append(section);
    }

    dialog.append(head, body);
    overlay.append(dialog);
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay) closeDialog();
    });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeDialog();
        return;
      }
      if (e.key !== 'Tab') return;
      // Keep the focus inside the dialog.
      const items = [...dialog.querySelectorAll('button')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    document.body.append(overlay);
    document.body.style.overflow = 'hidden';
    trigger.setAttribute('aria-expanded', 'true');
    openDialogState = { overlay, trigger, onKey };
    (dialog.querySelector('[aria-current="true"]') || close).focus();
  }

  function closeDialog() {
    if (!openDialogState) return;
    const { overlay, trigger, onKey } = openDialogState;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.style.overflow = '';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
    openDialogState = null;
  }

  function mountPickers() {
    document.querySelectorAll('[data-lang-picker]').forEach((host) => {
      const button = el('button', { type: 'button', class: 'lang-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
      button.innerHTML = '<span class="lang-flag-slot"></span><span class="lang-code"></span>';
      button.addEventListener('click', () => openDialog(button));
      host.append(button);
      buttons.push(button);
    });
  }

  // ---- Start: the English text is in the page; the chosen language replaces it once its file has loaded ----

  window.FeatherShotI18n = {
    languages: LANGUAGES,
    t,
    setLang,
    get lang() {
      return current;
    },
  };

  snapshot();
  mountPickers();
  const wanted = detect();
  Promise.allSettled([load('en'), load(wanted)]).then(() => {
    setCurrent(dicts[wanted] ? wanted : 'en');
  });
})();
