#!/usr/bin/env node
'use strict';
// Write packs/catalog.json from packs/src/<pack>/pack.json (name, version, title) and the built
// bundles packs/dist/<pack>-<version>.json (real sha256 and size). A pack without a built bundle fails.
// Usage: node scripts/make-catalog.js [--check]   (--check: only compare with the committed catalog)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'packs', 'src');
const DIST = path.join(ROOT, 'packs', 'dist');
const OUT = path.join(ROOT, 'packs', 'catalog.json');
const RELEASES = 'https://github.com/vzroslieigry/maxagent/releases/download';

// CI builds one pack per release tag: the other packs keep their published entry from the current catalog.
const published = new Map();
try { for (const p of JSON.parse(fs.readFileSync(OUT, 'utf8')).packs || []) published.set(`${p.name}@${p.version}`, p); } catch { /* first catalog */ }

const packs = [];
let bad = 0;
for (const name of fs.readdirSync(SRC).sort()) {
  const metaFile = path.join(SRC, name, 'pack.json');
  if (!fs.existsSync(metaFile)) continue;
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  if (meta.name !== name) { console.log(`${name}: pack.json name «${meta.name}» не совпадает с папкой`); bad++; continue; }
  const file = path.join(DIST, `${name}-${meta.version}.json`);
  if (!fs.existsSync(file)) {
    const old = published.get(`${name}@${meta.version}`);
    if (old) { packs.push(old); continue; }
    console.log(`${name}: нет собранного ${path.relative(ROOT, file)} и нет записи ${name}@${meta.version} в каталоге — пропущен`);
    continue;
  }
  const buf = fs.readFileSync(file);
  const b = JSON.parse(buf.toString('utf8'));
  if (b.name !== name || b.version !== meta.version) { console.log(`${name}: в наборе ${b.name}@${b.version}, ожидалось ${name}@${meta.version}`); bad++; continue; }
  packs.push({
    name,
    version: meta.version,
    title: meta.title,
    url: `${RELEASES}/packs-${name}-${meta.version}/${name}-${meta.version}.json`,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    size: buf.length,
    atoms: Object.keys(b.vectors || {}).length,
  });
}
const json = JSON.stringify({ packs }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== json) { console.log('packs/catalog.json не совпадает с собранными наборами'); bad++; } else console.log('каталог совпадает');
} else if (!bad) {
  fs.writeFileSync(OUT, json);
  for (const p of packs) console.log(`${p.name} ${p.version}: ${p.size} байт, атомов ${p.atoms}, sha256 ${p.sha256}`);
}
process.exitCode = bad ? 1 : 0;
