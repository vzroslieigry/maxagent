#!/usr/bin/env node
'use strict';
// maxagent — background check for updates and news, at most once a day. Started by the hook detached, no window;
// writes ~/.maxagent/state/update.json and exits. Sends nothing about the person: plain GETs of public files.
//   npm registry: https://registry.npmjs.org/<pkg>/latest      news: news.json of the open repository
//
// Self-update (decided with the owner 08.11.2026):
//   • config.updates === false → never runs; config.autoUpdate === false → only tells the agent (no install).
//   • maxagent and maxagent-bridge always share one version number: both are updated together, never one alone.
//   • a new MAJOR version (1.x → 2.x) waits for the owner's "yes"; everything else installs itself.
//   • only a release built by our own GitHub workflow is installed: npm registry signatures and provenance
//     attestations are verified (`npm audit signatures`), and the provenance must name our repository.
//   • the bridge's extension is reloaded only when nobody works through it (maxagent-bridge defers it itself,
//     exit 3); then `--pending` retries the reload later.
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, 'state');
const STATE = path.join(STATE_DIR, 'update.json');
const LOCK = path.join(STATE_DIR, 'update.lock');
const NEWS = process.env.MAXAGENT_NEWS_URL || 'https://raw.githubusercontent.com/vzroslieigry/maxagent/main/news.json';
const REGISTRY = process.env.MAXAGENT_REGISTRY || 'https://registry.npmjs.org';
const REPO = 'https://github.com/vzroslieigry/maxagent';
const PACKAGES = ['maxagent', 'maxagent-bridge'];

function getJson(url, timeout = 5000) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'maxagent', Accept: 'application/json' }, timeout }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { b += d; if (b.length > 8 << 20) req.destroy(); });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

const parts = (v) => String(v || '0').split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
function newer(a, b) { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; }

/**
 * What to do with what the registry says. latest = { maxagent, bridge }.
 * → { action: 'none' } | { action: 'install', version } | { action: 'ask', version } (a major version: owner's "yes").
 */
function plan(cfg, latest) {
  const v = latest && latest.maxagent;
  if (!v || !newer(v, cfg.version)) return { action: 'none' };
  if (latest.bridge !== v) return { action: 'none', why: 'versions_differ' }; // one number for both: wait until both are out
  if (parts(v)[0] > parts(cfg.version)[0]) return { action: 'ask', version: v };
  if (cfg.autoUpdate === false) return { action: 'ask', version: v };
  return { action: 'install', version: v };
}

/** The provenance attestation of a package version names our repository (the release was built by our workflow). */
function provenanceRepo(attestations) {
  for (const a of (attestations && attestations.attestations) || []) {
    if (!/slsa\.dev\/provenance/.test(String(a.predicateType || ''))) continue;
    try {
      const env = a.bundle && a.bundle.dsseEnvelope;
      const stmt = JSON.parse(Buffer.from(env.payload, 'base64').toString('utf8'));
      const wf = stmt.predicate && stmt.predicate.buildDefinition && stmt.predicate.buildDefinition.externalParameters && stmt.predicate.buildDefinition.externalParameters.workflow;
      if (wf && wf.repository) return String(wf.repository).replace(/\.git$/, '');
    } catch { /* not this one */ }
  }
  return null;
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, timeout: 600000, shell: process.platform === 'win32' && /\.cmd$/.test(cmd), ...opts });
const bridgeBase = () => process.env.MAXAGENT_BRIDGE_HOME || path.join(os.homedir(), '.maxagent-bridge');

/** Download both packages into a private folder, verify signatures and provenance, then install them. */
async function selfUpdate(version, state, cfg) {
  const dir = path.join(STATE_DIR, 'update', version);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ private: true }));
  let r = run(npmCmd, ['install', '--prefer-online', '--ignore-scripts', '--no-audit', '--no-fund', '--registry', REGISTRY, ...PACKAGES.map((p) => `${p}@${version}`)], { cwd: dir });
  if (r.status !== 0) return (state.error = `npm install: ${String(r.stderr || '').slice(-300)}`), false;
  r = run(npmCmd, ['audit', 'signatures', '--registry', REGISTRY], { cwd: dir });
  if (r.status !== 0 || !/verified attestation/i.test(r.stdout)) return (state.error = 'signatures or provenance not verified — not installed'), false;
  for (const p of PACKAGES) {
    const meta = await getJson(`${REGISTRY}/${p}/${version}`);
    const url = meta && meta.dist && meta.dist.attestations && meta.dist.attestations.url;
    const repo = url ? provenanceRepo(await getJson(url, 10000)) : null;
    if (repo !== REPO) return (state.error = `${p}@${version}: provenance ${repo || 'missing'} is not ${REPO} — not installed`), false;
  }
  r = run(process.execPath, [path.join(dir, 'node_modules', 'maxagent', 'bin', 'maxagent.js'), 'update', '--yes']);
  if (r.status !== 0) return (state.error = `maxagent update: ${String(r.stderr || r.stdout || '').slice(-300)}`), false;
  state.autoUpdated = version;
  // The bridge only where it is installed. Exit 3: files are in place, the extension reload waits for quiet.
  // Never over a newer bridge (a local build ahead of the registry).
  const installedBridge = readJson(path.join(bridgeBase(), 'app', 'package.json'), {}).version;
  if (fs.existsSync(path.join(bridgeBase(), 'config.json')) && !newer(installedBridge, version)) {
    r = run(process.execPath, [path.join(dir, 'node_modules', 'maxagent-bridge', 'bin', 'maxagent-bridge.js'), 'install']);
    if (r.status === 3) state.bridgePending = version;
    else if (r.status !== 0) state.error = `maxagent-bridge install: ${String(r.stdout || '').slice(-300)}`;
  }
  return true;
}

/** Retry the postponed extension reload (files are already copied). */
function retryBridgeReload(state) {
  const bin = path.join(bridgeBase(), 'app', 'bin', 'maxagent-bridge.js');
  const r = run(process.execPath, [bin, 'reload']);
  state.pendingTry = Date.now();
  if (r.status !== 3) delete state.bridgePending; // reloaded (or nothing to reload): done
}

function readJson(f, def) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } }

if (require.main === module) (async () => {
  const cfg = readJson(path.join(ROOT, 'config.json'), null);
  // The personal shelf of skills does not depend on the network or on update settings.
  if (cfg && !process.argv.includes('--pending')) { try { require('./experience-skills.js').scan(); } catch { /* a convenience */ } }
  if (!cfg || cfg.updates === false) return;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  // One updater at a time (several agent sessions start the hook); a lock older than an hour is stale.
  try { if (Date.now() - fs.statSync(LOCK).mtimeMs < 3600e3) return; } catch { /* no lock */ }
  fs.writeFileSync(LOCK, String(process.pid));
  try {
    if (process.argv.includes('--pending')) {
      const state = readJson(STATE, {});
      if (state.bridgePending) retryBridgeReload(state);
      fs.writeFileSync(STATE, JSON.stringify(state));
      return;
    }
    const [mx, br, news] = await Promise.all([getJson(`${REGISTRY}/maxagent/latest`), getJson(`${REGISTRY}/maxagent-bridge/latest`), getJson(NEWS)]);
    const prev = readJson(STATE, {});
    const state = { at: Date.now(), latest: { maxagent: mx && mx.version, bridge: br && br.version }, news: Array.isArray(news && news.items) ? news.items.slice(0, 50) : [] };
    if (prev.bridgePending) state.bridgePending = prev.bridgePending;
    const p = plan(cfg, state.latest);
    if (p.action === 'install') await selfUpdate(p.version, state, cfg);
    if (p.action === 'ask') state.ask = p.version;
    fs.writeFileSync(STATE, JSON.stringify(state));
  } catch { /* the check is a convenience; never breaks anything */ } finally {
    try { fs.unlinkSync(LOCK); } catch { /* gone */ }
  }
})();

module.exports = { newer, plan, provenanceRepo };
