#!/usr/bin/env node
'use strict';
// maxagent — background check for updates and news, at most once a day. Started by the hook detached, no window;
// writes ~/.maxagent/state/update.json and exits. Sends nothing about the person: plain GETs of public files.
//   npm registry: https://registry.npmjs.org/<pkg>/latest      news: news.json of the open repository
// config.updates === false → never runs. config.autoUpdate === 'patch' → a newer patch of the same minor is
// installed right here (`npx maxagent@<v> update --yes`); anything bigger waits for the owner's "yes".
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STATE = path.join(ROOT, 'state', 'update.json');
const NEWS = process.env.MAXAGENT_NEWS_URL || 'https://raw.githubusercontent.com/vzroslieigry/maxagent/main/news.json';
const REGISTRY = process.env.MAXAGENT_REGISTRY || 'https://registry.npmjs.org';

function getJson(url, timeout = 5000) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'maxagent', Accept: 'application/json' }, timeout }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { b += d; if (b.length > 1 << 20) req.destroy(); });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

const parts = (v) => String(v || '0').split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
function newer(a, b) { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; }
const samePatchLine = (a, b) => { const x = parts(a), y = parts(b); return x[0] === y[0] && x[1] === y[1]; };

if (require.main === module) (async () => {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch { return; }
  if (cfg.updates === false) return;
  const [mx, br, news] = await Promise.all([getJson(`${REGISTRY}/maxagent/latest`), getJson(`${REGISTRY}/maxagent-bridge/latest`), getJson(NEWS)]);
  const state = { at: Date.now(), latest: { maxagent: mx && mx.version, bridge: br && br.version }, news: Array.isArray(news && news.items) ? news.items.slice(0, 50) : [] };
  if (cfg.autoUpdate === 'patch' && state.latest.maxagent && newer(state.latest.maxagent, cfg.version) && samePatchLine(state.latest.maxagent, cfg.version)) {
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', `maxagent@${state.latest.maxagent}`, 'update', '--yes'], { encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32', timeout: 300000 });
    state.autoUpdated = r.status === 0 ? state.latest.maxagent : null;
  }
  try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(state)); } catch { /* state is a convenience */ }
})();

module.exports = { newer };
