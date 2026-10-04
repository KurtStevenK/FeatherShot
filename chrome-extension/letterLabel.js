'use strict';

/**
 * Convert a 1-based index into a letter label: 1→a, 2→b, …, 26→z, 27→aa, 28→ab, …
 * Shared by macOS (Swift), Electron, and the Chrome extension — keep in sync via shared/letterLabel.cases.json.
 */
function letterLabel(n) {
  let num = n - 1;
  let result = '';
  do {
    result = String.fromCharCode(97 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);
  return result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { letterLabel };
}
if (typeof globalThis !== 'undefined') {
  globalThis.letterLabel = letterLabel;
}
