#!/usr/bin/env node
'use strict';
// Copy the package sources into the open repository layout:
//   <src>/package → packages/maxagent,  <src>/bridge → packages/maxagent-bridge
// and make their package.json publishable (public, repository, MIT, provenance).
// Usage: node scripts/sync-packages.js [--src <folder with package/ and bridge/>]
// Default source: the folder next to this repository copy (../package, ../bridge), so it works
// both inside the private workspace (projects/maxagent/public) and from a checkout with --src.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const SRC = path.resolve(argv.includes('--src') ? argv[argv.indexOf('--src') + 1] : path.join(ROOT, '..'));
const REPO = 'https://github.com/vzroslieigry/maxagent';

const PACKAGES = [
  { from: 'package', to: 'maxagent' },
  { from: 'bridge', to: 'maxagent-bridge' },
  { from: 'library', to: 'maxagent-library' },
];

// Never copied: dependencies, runtime state, caches, temp and backup files.
const SKIP_DIRS = new Set(['node_modules', 'state', '.git', '__pycache__', 'tmp', '.tmp', 'coverage']);
// recall-eval / recall-cases: the author's own measurement against his private library — not part of the package.
const SKIP_FILE = /(\.pyc|\.pyo|\.log|\.tmp|\.part|\.bak|-backup|\.orig|\.rej|~)$|^(\.DS_Store|Thumbs\.db|npm-debug\.log.*|.*\.tgz|recall-eval\.js|recall-cases\.json)$/i;

function copyDir(from, to, stats) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || /^maxagent(-bridge)?-test-/.test(e.name)) { stats.skipped.push(path.relative(SRC, s)); continue; }
      copyDir(s, d, stats);
    } else if (e.isFile()) {
      if (SKIP_FILE.test(e.name)) { stats.skipped.push(path.relative(SRC, s)); continue; }
      fs.copyFileSync(s, d);
      stats.files++;
    }
  }
}

function rmrf(dir) {
  // The target is a generated copy inside this repository; it is rebuilt from the sources every time.
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function publishable(pkgFile, dir) {
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  const next = {};
  // Keep a stable, conventional key order.
  for (const k of ['name', 'version', 'description', 'keywords', 'license', 'author', 'homepage', 'bugs', 'repository', 'private']) next[k] = undefined;
  Object.assign(next, pkg);
  next.private = false;
  next.license = 'MIT';
  next.homepage = `${REPO}/tree/main/packages/${dir}#readme`;
  next.bugs = { url: `${REPO}/issues` };
  next.repository = { type: 'git', url: `git+${REPO}.git`, directory: `packages/${dir}` };
  next.publishConfig = process.env.GITHUB_ACTIONS ? { access: 'public', provenance: true } : { access: 'public' };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  fs.writeFileSync(pkgFile, JSON.stringify(next, null, 2) + '\n');
  return next;
}

let bad = 0;
for (const p of PACKAGES) {
  const from = path.join(SRC, p.from);
  const to = path.join(ROOT, 'packages', p.to);
  if (!fs.existsSync(path.join(from, 'package.json'))) { console.log(`нет исходника: ${from}`); bad++; continue; }
  rmrf(to);
  const stats = { files: 0, skipped: [] };
  copyDir(from, to, stats);
  // Every published package carries the license.
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(to, 'LICENSE'));
  const pkg = publishable(path.join(to, 'package.json'), p.to);
  console.log(`${p.from} → packages/${p.to}: ${stats.files} files, ${pkg.name}@${pkg.version}${stats.skipped.length ? `, skipped: ${stats.skipped.join(', ')}` : ''}`);
}
process.exitCode = bad ? 1 : 0;
