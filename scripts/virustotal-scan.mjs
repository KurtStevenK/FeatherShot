#!/usr/bin/env node
// Upload release files to VirusTotal, wait for the analyses, and write a Markdown report.
// Ported from cursor-auto-runner's scripts/virustotal-scan.js. Needs VIRUSTOTAL_API_KEY
// (environment, .env.local or .env).
//
// All files are uploaded first and then polled together, because free-API analyses can sit in
// VirusTotal's queue for many minutes. Files still queued at the deadline are reported as pending,
// with a link where the result appears once VirusTotal gets to them.
//
// Usage: node scripts/virustotal-scan.mjs [--artifacts-dir DIR]... [--report FILE] [FILE]...
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const VT_BASE = 'https://www.virustotal.com/api/v3';
// Files above this go through /files/upload_url (VT accepts up to 650 MB there).
const SMALL_FILE_MAX = 32 * 1024 * 1024;
// The free API allows 4 requests a minute and 500 a day; every request waits for its slot.
const REQUEST_SPACING_MS = 16_000;
const POLL_ROUND_MIN_MS = 60_000;
const POLL_DEADLINE_MS = Number(process.env.VIRUSTOTAL_WAIT_MINUTES || 45) * 60_000;
const QUOTA_RETRIES = 5;
const QUOTA_WAIT_MS = 65_000;

// Installers and the Chrome extension zip; latest.yml, blockmaps and the .nupkg are not executables.
const PATTERNS = [/\.dmg$/i, /\.exe$/i, /\.deb$/i, /\.AppImage$/i, /\.pacman$/i, /\.zip$/i];

function parseEnvFile(envPath) {
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[trimmed.slice(0, eq).trim()] = val;
  }
  return vars;
}

function loadDotEnv() {
  const merged = {
    ...parseEnvFile(path.join(process.cwd(), '.env')),
    ...parseEnvFile(path.join(process.cwd(), '.env.local')),
  };
  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const inputs = [];
  let reportPath = '';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--artifacts-dir' && argv[i + 1]) {
      inputs.push(argv[++i]);
    } else if (argv[i] === '--report' && argv[i + 1]) {
      reportPath = argv[++i];
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node scripts/virustotal-scan.mjs [--artifacts-dir DIR]... [--report FILE] [FILE]...');
      process.exit(0);
    } else {
      inputs.push(argv[i]);
    }
  }
  return { inputs: inputs.length ? inputs : ['release-artifacts'], reportPath };
}

function collectArtifacts(inputs) {
  const out = new Set();
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        // electron-builder's unpacked app folders hold the app's own .exe and helper binaries.
        if (!name.endsWith('-unpacked') && !name.endsWith('.app')) walk(full);
      } else if (PATTERNS.some((re) => re.test(name))) {
        out.add(full);
      }
    }
  }
  for (const input of inputs) {
    const abs = path.resolve(input);
    if (!fs.existsSync(abs)) throw new Error(`Not found: ${abs}`);
    if (fs.statSync(abs).isDirectory()) walk(abs);
    else out.add(abs);
  }
  return [...out].sort();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha256Of(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

let nextRequestAt = 0;
async function nextRequestSlot() {
  const wait = nextRequestAt - Date.now();
  if (wait > 0) await sleep(wait);
  nextRequestAt = Date.now() + REQUEST_SPACING_MS;
}

// Returns the JSON body, or null for a 404 when allowMissing is set. Waits out HTTP 429.
async function vtFetch(url, init, context, { allowMissing = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    await nextRequestSlot();
    const res = await fetch(url, init());
    const text = await res.text();
    if (res.status === 404 && allowMissing) return null;
    if (res.status === 429 && attempt < QUOTA_RETRIES) {
      console.log(`[virustotal] ${context}: quota exceeded, retrying in ${QUOTA_WAIT_MS / 1000}s`);
      await sleep(QUOTA_WAIT_MS);
      continue;
    }
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${context}: invalid JSON (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(`${context}: HTTP ${res.status} — ${body?.error?.message || text.slice(0, 300)}`);
    }
    return body;
  }
}

async function uploadFile(filePath, apiKey) {
  const name = path.basename(filePath);
  const headers = { 'x-apikey': apiKey };
  let uploadUrl = `${VT_BASE}/files`;
  if (fs.statSync(filePath).size > SMALL_FILE_MAX) {
    const urlBody = await vtFetch(`${VT_BASE}/files/upload_url`, () => ({ headers }), `upload_url for ${name}`);
    uploadUrl = typeof urlBody?.data === 'string' ? urlBody.data : urlBody?.data?.upload_url;
    if (!uploadUrl) {
      throw new Error(`No upload_url for ${name} (response: ${JSON.stringify(urlBody).slice(0, 200)})`);
    }
  }
  const blob = await fs.openAsBlob(filePath);
  const body = await vtFetch(
    uploadUrl,
    () => {
      const form = new FormData();
      form.append('file', blob, name);
      return { method: 'POST', headers, body: form };
    },
    `upload ${name}`
  );
  const analysisId = body?.data?.id;
  if (!analysisId) throw new Error(`No analysis id after upload for ${name}`);
  return analysisId;
}

const guiLink = (sha256) => `https://www.virustotal.com/gui/file/${sha256}`;

function setStats(row, stats) {
  row.status = 'done';
  row.malicious = stats.malicious ?? 0;
  row.suspicious = stats.suspicious ?? 0;
  row.undetected = stats.undetected ?? 0;
  console.log(
    `[virustotal] ${row.file}: malicious=${row.malicious} suspicious=${row.suspicious} undetected=${row.undetected}`
  );
}

async function main() {
  const { inputs, reportPath } = parseArgs(process.argv);
  loadDotEnv();
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    console.error('VIRUSTOTAL_API_KEY is not set (environment, .env.local or .env).');
    process.exit(1);
  }

  const files = collectArtifacts(inputs);
  if (files.length === 0) {
    console.error(`No release artifacts found in ${inputs.join(', ')}`);
    process.exit(1);
  }

  const headers = { 'x-apikey': apiKey };
  const rows = [];
  console.log(`[virustotal] Scanning ${files.length} file(s)`);

  for (const [i, filePath] of files.entries()) {
    const row = { file: path.basename(filePath), sha256: await sha256Of(filePath), status: 'pending' };
    rows.push(row);
    console.log(`[virustotal] (${i + 1}/${files.length}) ${row.file} ${guiLink(row.sha256)}`);

    // A file VirusTotal has already analysed (for example on a re-run) is not uploaded again.
    const known = await vtFetch(`${VT_BASE}/files/${row.sha256}`, () => ({ headers }), `lookup ${row.file}`, {
      allowMissing: true,
    });
    if (known?.data?.attributes?.last_analysis_date) {
      setStats(row, known.data.attributes.last_analysis_stats || {});
      continue;
    }
    console.log(`[virustotal] Uploading ${row.file}…`);
    row.analysisId = await uploadFile(filePath, apiKey);
  }

  const deadline = Date.now() + POLL_DEADLINE_MS;
  while (rows.some((r) => r.status === 'pending') && Date.now() < deadline) {
    const roundStart = Date.now();
    for (const row of rows.filter((r) => r.status === 'pending')) {
      const body = await vtFetch(`${VT_BASE}/analyses/${row.analysisId}`, () => ({ headers }), `analysis ${row.file}`);
      const status = body?.data?.attributes?.status;
      if (status === 'failed') throw new Error(`VirusTotal analysis failed for ${row.file}`);
      if (status !== 'completed') continue;
      // The analysis has no sha256 attribute; the analysed file's hash is under meta.file_info.
      const reported = body.meta?.file_info?.sha256;
      if (reported && reported !== row.sha256) {
        throw new Error(`${row.file}: VirusTotal analysed ${reported}, the file is ${row.sha256}`);
      }
      setStats(row, body.data.attributes.stats || {});
    }
    const pending = rows.filter((r) => r.status === 'pending').length;
    if (pending) {
      console.log(`[virustotal] ${pending} analysis/analyses still queued on VirusTotal`);
      await sleep(Math.max(0, POLL_ROUND_MIN_MS - (Date.now() - roundStart)));
    }
  }

  const lines = [
    '## VirusTotal',
    '',
    'Release files were submitted to VirusTotal for multi-engine scanning. Results may change on VirusTotal after publishing.',
    '',
    '| File | Malicious | Suspicious | Undetected | Report |',
    '|---|---:|---:|---:|---|',
  ];
  for (const r of rows) {
    const link = `[\`${r.sha256.slice(0, 12)}…\`](${guiLink(r.sha256)})`;
    const counts = r.status === 'done' ? [r.malicious, r.suspicious, r.undetected] : ['pending', '—', '—'];
    lines.push(`| \`${r.file}\` | ${counts.join(' | ')} | ${link} |`);
  }
  if (rows.some((r) => r.status === 'pending')) {
    lines.push('', 'Pending files were still queued on VirusTotal when the scan ended; their report links show the result.');
  }
  lines.push('');

  const markdown = lines.join('\n');
  console.log('\n' + markdown);

  if (reportPath) {
    fs.writeFileSync(reportPath, markdown);
    console.log(`[virustotal] Wrote ${reportPath}`);
  }

  if (rows.some((r) => r.malicious > 0)) {
    if (process.env.VIRUSTOTAL_FAIL_ON_DETECTION === '1') {
      console.error('[virustotal] VIRUSTOTAL_FAIL_ON_DETECTION=1 and malicious > 0 — failing.');
      process.exit(1);
    }
    console.warn('[virustotal] Warning: at least one file has malicious detections (not failing).');
  }
}

main().catch((err) => {
  console.error('[virustotal]', err.message || err);
  process.exit(1);
});
