// Checks the website translations in hosting/public/i18n against en.json.
// - every language file has exactly the keys of en.json, none empty
// - {placeholders} match, and the tags (<a>, <strong>, <span> …) appear in the same order
// - every language in hosting/public/i18n.js has a file, and every file is a language
// - every data-i18n key in the pages and every t("…") key in the scripts exists in en.json
// Run: node scripts/check-website-i18n.mjs   (exit code 1 on errors)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../hosting/public");
const i18nDir = path.join(root, "i18n");
const errors = [];
const warnings = [];

const en = JSON.parse(fs.readFileSync(path.join(i18nDir, "en.json"), "utf8"));
const enKeys = Object.keys(en);

const placeholders = (s) => [...s.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort().join(" ");
const tagSequence = (s) =>
  [...s.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g)].map((m) => `${m[1]}${m[2].toLowerCase()}`).join(" ");

// Languages declared in i18n.js
const script = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
const declared = [...script.matchAll(/\{\s*code:\s*["']([a-z]{2,3})["']/g)].map((m) => m[1]);
if (declared.length !== 44) errors.push(`i18n.js declares ${declared.length} languages, expected 44`);

const files = fs
  .readdirSync(i18nDir)
  .filter((f) => f.endsWith(".json") && f !== "en.json")
  .map((f) => f.slice(0, -5));
const expected = declared.filter((c) => c !== "en");
for (const code of expected) if (!files.includes(code)) errors.push(`${code}: file i18n/${code}.json is missing`);
for (const code of files) if (!declared.includes(code)) errors.push(`${code}: i18n/${code}.json exists but i18n.js does not list it`);

for (const code of expected.filter((c) => files.includes(c))) {
  let tr;
  try {
    tr = JSON.parse(fs.readFileSync(path.join(i18nDir, `${code}.json`), "utf8"));
  } catch (e) {
    errors.push(`${code}: invalid JSON (${e.message})`);
    continue;
  }
  let missing = 0;
  for (const key of enKeys) {
    const v = tr[key];
    if (typeof v !== "string" || !v.trim()) {
      missing++;
      continue;
    }
    if (placeholders(v) !== placeholders(en[key])) errors.push(`${code} ${key}: placeholders differ ("${v}")`);
    if (tagSequence(v) !== tagSequence(en[key])) errors.push(`${code} ${key}: tags differ ("${v}")`);
  }
  if (missing) errors.push(`${code}: ${missing} missing or empty keys`);
  for (const key of Object.keys(tr)) if (!(key in en)) errors.push(`${code} ${key}: not in en.json`);
}

// Keys used by the pages and scripts
const used = new Set();
const pageFiles = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (p !== i18nDir) walk(p);
    } else if (/\.(html|js)$/.test(f.name)) pageFiles.push(p);
  }
};
walk(root);
for (const file of pageFiles) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  // i18n.js only describes the attributes in a comment, so it is not scanned for data-i18n uses.
  if (rel !== "i18n.js") {
    for (const m of text.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) {
      used.add(m[1]);
      if (!(m[1] in en)) errors.push(`${rel}: key "${m[1]}" is not in en.json`);
    }
  }
  for (const m of text.matchAll(/\bt\(\s*["']([a-zA-Z][\w.]*)["']/g)) {
    used.add(m[1]);
    if (!(m[1] in en)) errors.push(`${rel}: key "${m[1]}" is not in en.json`);
  }
}
// A key written in full as a quoted string (for example in a label table) counts as used.
const sources = pageFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
for (const key of enKeys) {
  if (!used.has(key) && !sources.includes(`"${key}"`) && !sources.includes(`'${key}'`)) {
    warnings.push(`en.json key "${key}" is not used by any page or script`);
  }
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
console.log(`${enKeys.length} keys, ${expected.length} translations, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
