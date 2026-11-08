'use strict';
// Extras of the first run (and `npx maxagent bridge|vectors|experience`): the browser bridge with its Chrome
// extension, meaning search (vector model), shared experience packs. Nothing heavy happens without a "yes":
// npm v12 runs no install scripts, so downloads live here, after the person agreed (decision 08.11.2026).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawnSync } = require('child_process');

// Vector model: pinned revision and checksums — a changed file is refused, not silently used.
const MODEL = {
  repo: 'Xenova/multilingual-e5-small',
  revision: '761b726dd34fb83930e26aab4e9ac3899aa1fa78',
  files: [
    { src: 'onnx/model_quantized.onnx', name: 'model_quantized.onnx', size: 118308185, sha256: 'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193' },
    { src: 'tokenizer.json', name: 'tokenizer.json', size: 17082730, sha256: '0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39' },
    { src: 'config.json', name: 'config.json', size: 658, sha256: 'cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1' },
  ],
};
// Python packages for the model: versions at least two weeks old when pinned (08.11.2026).
const PY_PACKAGES = ['onnxruntime==1.31.0', 'tokenizers==0.23.3'];
const VECTOR_MB = 270;

// No shell by default: cmd mangles quotes and `;` in `python -c "…"` (live check 08.11.2026 — Python 3.14 «not found»).
// Only npx (a .cmd on Windows) needs the shell — `runCmd`.
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, shell: false, ...opts });
const runCmd = (cmd, args, opts = {}) => run(cmd, args, { shell: process.platform === 'win32', ...opts });

/* ---------- python ---------- */

function findPython() {
  for (const py of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    const r = run(py, ['-c', 'import sys;print("%d.%d"%sys.version_info[:2]);print(sys.executable)']);
    if (r.status === 0) {
      const [ver, exe] = String(r.stdout).trim().split(/\r?\n/);
      const [maj, min] = ver.split('.').map(Number);
      if (maj === 3 && min >= 9) return { cmd: py, version: ver, exe: (exe || '').trim() };
    }
  }
  return null;
}

/** Windows without Python: winget can install it — only after a separate "yes" (a system program). */
function installPython(say, out) {
  if (process.platform !== 'win32') { out(say.pyManual); return null; }
  out(say.pyWinget);
  const r = run('winget', ['install', '-e', '--id', 'Python.Python.3.12', '--accept-package-agreements', '--accept-source-agreements'], { stdio: 'inherit' });
  if (r.status !== 0) { out(say.pyFailed); return null; }
  return findPython();
}

/* ---------- download with a checksum ---------- */

function download(url, file, { size, sha256 }, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'maxagent' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).toString(), file, { size, sha256 }, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const hash = crypto.createHash('sha256');
      const tmp = `${file}.part`;
      const w = fs.createWriteStream(tmp);
      res.on('data', (c) => hash.update(c));
      res.pipe(w);
      w.on('finish', () => {
        const got = hash.digest('hex');
        if (sha256 && got !== sha256) { fs.unlinkSync(tmp); return reject(new Error(`контрольная сумма не сошлась: ${path.basename(file)}`)); }
        if (size && fs.statSync(tmp).size !== size) { fs.unlinkSync(tmp); return reject(new Error(`размер не сошёлся: ${path.basename(file)}`)); }
        fs.renameSync(tmp, file);
        resolve();
      });
      w.on('error', reject);
    }).on('error', reject);
  });
}

/* ---------- extras ---------- */

/** Meaning search: Python packages into ~/.maxagent/vector/py, the model into ~/.maxagent/vector/model, then a self-test. */
async function installVectors(home, { out, confirm, say }) {
  const base = path.join(home, '.maxagent', 'vector');
  let py = findPython();
  if (!py) {
    out(say.pyMissing);
    if (!(await confirm(say.pyAsk))) { out(say.vectorsSkipped); return false; }
    py = installPython(say, out);
    if (!py) { out(say.vectorsSkipped); return false; }
  }
  out(say.vectorsPip(py.version));
  const pip = run(py.cmd, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', '--target', path.join(base, 'py'), ...PY_PACKAGES]);
  if (pip.status !== 0) { out(say.vectorsFailed(String(pip.stderr || pip.stdout).split('\n').slice(-3).join(' '))); return false; }
  fs.mkdirSync(path.join(base, 'model'), { recursive: true });
  for (const f of MODEL.files) {
    const dest = path.join(base, 'model', f.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size === f.size) continue;
    out(say.vectorsFile(f.name, Math.round(f.size / 1048576)));
    try { await download(`https://huggingface.co/${MODEL.repo}/resolve/${MODEL.revision}/${f.src}`, dest, f); } catch (e) { out(say.vectorsFailed(e.message)); return false; }
  }
  fs.writeFileSync(path.join(base, 'model', 'REVISION'), MODEL.revision);
  const cfgFile = path.join(home, '.maxagent', 'config.json');
  try { const c = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); if (py.exe) { c.python = py.exe; fs.writeFileSync(cfgFile, JSON.stringify(c, null, 2)); } } catch { /* config is written by init */ }
  const test = run(py.exe || py.cmd, ['-B', path.join(home, '.maxagent', 'tools', 'experience-embed.py'), '--self-test'], { env: { ...process.env, MAXAGENT_VECTOR: base, PYTHONIOENCODING: 'utf-8' } });
  if (test.status !== 0) { out(say.vectorsFailed(String(test.stderr).split('\n').slice(-3).join(' '))); return false; }
  out(say.vectorsOk);
  return true;
}

/** Browser bridge: the separate package installs the host, extension files and MCP; the extension load is the person's 3 clicks. */
function installBridge(cfg, { out, say }) {
  const pkg = process.env.MAXAGENT_BRIDGE_PKG || 'maxagent-bridge@latest';
  const args = ['--yes', pkg, 'install', ...(cfg.agents && cfg.agents.length ? ['--agents', cfg.agents.join(',')] : ['--no-agents'])];
  out(say.bridgeRun);
  const r = runCmd('npx', args, { stdio: 'inherit' });
  if (r.status !== 0) { out(say.bridgeFailed); return false; }
  return true;
}

/** Shared experience packs from the catalog of the open repository. */
function installPacks(home, { out, say }) {
  const tool = path.join(home, '.maxagent', 'tools', 'experience-packs.js');
  const r = run(process.execPath, [tool, 'add', 'all'], { stdio: 'inherit', shell: false });
  if (r.status !== 0) { out(say.packsFailed); return false; }
  return true;
}

module.exports = { installVectors, installBridge, installPacks, findPython, MODEL, VECTOR_MB, PY_PACKAGES };
