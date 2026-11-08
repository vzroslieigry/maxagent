#!/usr/bin/env node
'use strict';
// CI for packs/src: each pack.json is valid; in a pull request (BASE = base commit), a pack whose files changed
// must raise its version, otherwise the merge would ship nothing.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = path.join(__dirname, '..', 'packs', 'src');
const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
let bad = 0;
const fail = (m) => { console.log(m); bad++; };
for (const name of fs.readdirSync(SRC)) {
  const f = path.join(SRC, name, 'pack.json');
  if (!fs.existsSync(f)) { fail(`${name}: no pack.json`); continue; }
  let p;
  try { p = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { fail(`${name}: pack.json is not JSON`); continue; }
  if (p.name !== name || !/^[a-z0-9-]+$/.test(name)) fail(`${name}: "name" must equal the folder (lowercase, digits, dashes)`);
  if (!/^\d+\.\d+\.\d+$/.test(p.version || '')) fail(`${name}: "version" must look like 1.0.0`);
  if (!p.title || !p.title.en) fail(`${name}: "title.en" is required`);
}
const base = process.env.BASE;
if (base) {
  const changed = new Set(sh(`git diff --name-only ${base} HEAD -- packs/src`).split('\n').filter(Boolean).map((x) => x.split('/')[2]));
  for (const name of changed) {
    if (!fs.existsSync(path.join(SRC, name, 'pack.json'))) continue;
    let was = null;
    try { was = JSON.parse(sh(`git show ${base}:packs/src/${name}/pack.json`)).version; } catch { /* a new pack */ }
    const now = JSON.parse(fs.readFileSync(path.join(SRC, name, 'pack.json'), 'utf8')).version;
    if (was && was === now) fail(`${name}: files changed — raise "version" in pack.json (still ${now})`);
  }
}
console.log(bad ? `\n${bad} problem(s)` : 'packs: ok');
process.exit(bad ? 1 : 0);
