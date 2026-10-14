// Checks the runtime dependencies that electron-builder packs into the Windows and Linux builds:
// every one must be required by a packaged file, and none may ship Windows script or executable
// helpers. screenshot-desktop was never required but shipped a batch/C# screen-capture helper
// that VirusTotal engines flagged in v1.3.36.
//   node test/check-dependencies.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const HELPER_FILE = /\.(bat|cmd|ps1|vbs|exe)$/i;
const problems = [];

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Nested packages are listed by npm ls on their own.
      if (entry.name !== 'node_modules') walk(full, visit);
    } else {
      visit(full);
    }
  }
}

// Packages required by the JavaScript that build.files packs.
const required = new Set();
for (const pattern of pkg.build.files) {
  const target = path.join(root, pattern.replace(/\/\*\*\/\*$/, ''));
  if (!fs.existsSync(target)) continue;
  const files = [];
  if (fs.statSync(target).isDirectory()) walk(target, (f) => files.push(f));
  else files.push(target);
  for (const file of files.filter((f) => f.endsWith('.js'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const parts = spec.split('/');
      required.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
    }
  }
}
for (const name of Object.keys(pkg.dependencies || {})) {
  if (!required.has(name)) problems.push(`${name} is a dependency but no packaged file requires it`);
}

// Every file of the production dependency tree is packed into app.asar. Resolve it the way Node
// does: node_modules/<name> next to the requiring package, then in each parent directory.
function packageDir(name, from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (dir === path.dirname(dir)) return null;
  }
}
const packages = new Set();
const queue = Object.keys(pkg.dependencies || {}).map((name) => [name, root]);
while (queue.length) {
  const [name, from] = queue.shift();
  const dir = packageDir(name, from);
  if (!dir || packages.has(dir)) continue;
  packages.add(dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const deps = { ...manifest.dependencies, ...manifest.optionalDependencies };
  for (const dep of Object.keys(deps)) queue.push([dep, dir]);
}
for (const dir of packages) {
  walk(dir, (file) => {
    if (HELPER_FILE.test(file)) problems.push(`${path.relative(root, file)} would be packaged`);
  });
}

if (problems.length) {
  console.log(`Dependency check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Dependency check passed: ${packages.size} runtime packages, no Windows helpers.`);
