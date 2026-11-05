const https = require('https');

const REPO = 'KurtStevenK/FeatherShot';

function compareVersions(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: 'api.github.com',
        path: `/repos/${REPO}/releases/latest`,
        headers: { 'User-Agent': 'FeatherShot' },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        let totalSize = 0;
        const MAX_BODY_SIZE = 1024 * 1024; // 1MB payload limit to prevent unbounded memory usage

        res.on('data', (chunk) => {
          totalSize += chunk.length;
          if (totalSize > MAX_BODY_SIZE) {
            req.destroy(new Error('Response payload exceeded 1MB limit'));
            return;
          }
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('GitHub API request timed out'));
    });
    req.on('error', reject);
  });
}

module.exports = { compareVersions, fetchLatestRelease, REPO };
