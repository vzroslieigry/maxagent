'use strict';

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { execFileSync } = require('child_process');
const paths = require('./paths');

const EXT_ID = 'ealhofpddpiflgfjklhccoihlokddgei'; // pinned by "key" in extension/manifest.json
const PKG_ROOT = path.resolve(__dirname, '..');
const REG_KEY = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${paths.HOST_NAME}`;
const RU = (process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || '').toLowerCase().startsWith('ru');
const say = (ru, en) => (RU ? ru : en);

function copyDir(src, dest, w) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d, w);
    else w.write(d, fs.readFileSync(s));
  }
}

class Writer {
  constructor(dry, out) { this.dry = dry; this.out = out; }
  write(file, data, label) {
    if (label) this.out(`  ${label}: ${file}`);
    if (this.dry) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  }
}

/* ---------- MCP registration per agent ---------- */

function mcpCommand(baseDir, agent) {
  return { command: process.execPath, args: [path.join(baseDir, 'app', 'bin', 'maxagent-bridge.js'), 'mcp', '--agent', agent] };
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

const AGENTS = {
  'claude-code': {
    title: 'Claude Code',
    detect: (home) => fs.existsSync(path.join(home, '.claude')),
    file: (home) => path.join(home, '.claude.json'),
    add(home, baseDir, w) {
      const f = this.file(home);
      const j = readJson(f);
      j.mcpServers = { ...(j.mcpServers || {}), 'maxagent-bridge': { type: 'stdio', ...mcpCommand(baseDir, 'claude-code'), env: {} } };
      w.write(f, JSON.stringify(j, null, 2) + '\n', 'Claude Code MCP');
    },
    remove(home, w) {
      const f = this.file(home);
      if (!fs.existsSync(f)) return;
      const j = readJson(f);
      if (!j.mcpServers || !j.mcpServers['maxagent-bridge']) return;
      delete j.mcpServers['maxagent-bridge'];
      w.write(f, JSON.stringify(j, null, 2) + '\n', 'Claude Code MCP −');
    },
    has: (home) => { try { return !!readJson(path.join(home, '.claude.json')).mcpServers['maxagent-bridge']; } catch { return false; } },
  },
  codex: {
    title: 'Codex',
    detect: (home) => fs.existsSync(path.join(home, '.codex')),
    file: (home) => path.join(home, '.codex', 'config.toml'),
    block(baseDir) {
      const { command, args } = mcpCommand(baseDir, 'codex');
      const q = (s) => JSON.stringify(s); // TOML basic strings accept JSON escapes
      return ['# maxagent-bridge:start (npx maxagent-bridge uninstall removes this)', '[mcp_servers.maxagent-bridge]', `command = ${q(command)}`,
        `args = [${args.map(q).join(', ')}]`, 'startup_timeout_sec = 15', 'tool_timeout_sec = 200', '# maxagent-bridge:end'].join('\n');
    },
    strip: (text) => text.replace(/\n?# maxagent-bridge:start[\s\S]*?# maxagent-bridge:end\n?/g, '\n').replace(/\n{3,}$/, '\n'),
    add(home, baseDir, w) {
      const f = this.file(home);
      const old = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      const base = this.strip(old).replace(/\s*$/, '');
      w.write(f, (base ? base + '\n\n' : '') + this.block(baseDir) + '\n', 'Codex MCP');
    },
    remove(home, w) {
      const f = this.file(home);
      if (!fs.existsSync(f)) return;
      const old = fs.readFileSync(f, 'utf8');
      if (!old.includes('# maxagent-bridge:start')) return;
      w.write(f, this.strip(old).replace(/^\n+/, ''), 'Codex MCP −');
    },
    has: (home) => { try { return fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8').includes('[mcp_servers.maxagent-bridge]'); } catch { return false; } },
  },
  antigravity: {
    title: 'Antigravity',
    detect: (home) => fs.existsSync(path.join(home, '.gemini')),
    file: (home) => path.join(home, '.gemini', 'config', 'mcp_config.json'),
    add(home, baseDir, w) {
      const f = this.file(home);
      const j = readJson(f);
      j.mcpServers = { ...(j.mcpServers || {}), 'maxagent-bridge': mcpCommand(baseDir, 'antigravity') };
      w.write(f, JSON.stringify(j, null, 2) + '\n', 'Antigravity MCP');
    },
    remove(home, w) {
      const f = this.file(home);
      if (!fs.existsSync(f)) return;
      const j = readJson(f);
      if (!j.mcpServers || !j.mcpServers['maxagent-bridge']) return;
      delete j.mcpServers['maxagent-bridge'];
      w.write(f, JSON.stringify(j, null, 2) + '\n', 'Antigravity MCP −');
    },
    has: (home) => { try { return !!readJson(path.join(home, '.gemini', 'config', 'mcp_config.json')).mcpServers['maxagent-bridge']; } catch { return false; } },
  },
};

/* ---------- native host registration ---------- */

function hostManifestPath(baseDir) {
  return path.join(baseDir, `${paths.HOST_NAME}.json`);
}

function chromeHostDir(home) {
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
  return path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts');
}

function registerHost(baseDir, home, w, registry) {
  const launcher = path.join(baseDir, process.platform === 'win32' ? 'host.cmd' : 'host.sh');
  const app = path.join(baseDir, 'app', 'bin', 'maxagent-bridge.js');
  if (process.platform === 'win32') w.write(launcher, `@echo off\r\n"${process.execPath}" "${app}" host %*\r\n`, say('запуск посредника', 'host launcher'));
  else {
    w.write(launcher, `#!/bin/sh\nexec "${process.execPath}" "${app}" host "$@"\n`, say('запуск посредника', 'host launcher'));
    if (!w.dry) fs.chmodSync(launcher, 0o755);
  }
  const manifest = { name: paths.HOST_NAME, description: 'maxagent bridge native host', path: launcher, type: 'stdio', allowed_origins: [`chrome-extension://${EXT_ID}/`] };
  const file = hostManifestPath(baseDir);
  w.write(file, JSON.stringify(manifest, null, 2) + '\n', say('манифест посредника для Chrome', 'Chrome host manifest'));
  if (!registry) return;
  if (process.platform === 'win32') {
    w.out(`  ${say('реестр (текущий пользователь)', 'registry (current user)')}: ${REG_KEY}`);
    if (!w.dry) execFileSync('reg', ['add', REG_KEY, '/ve', '/t', 'REG_SZ', '/d', file, '/f'], { stdio: 'ignore' });
  } else {
    w.write(path.join(chromeHostDir(home), `${paths.HOST_NAME}.json`), JSON.stringify(manifest, null, 2) + '\n', 'Chrome NativeMessagingHosts');
  }
}

function registeredHostManifest(home) {
  if (process.platform !== 'win32') {
    const f = path.join(chromeHostDir(home), `${paths.HOST_NAME}.json`);
    return fs.existsSync(f) ? f : null;
  }
  try {
    const out = execFileSync('reg', ['query', REG_KEY, '/ve'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/REG_SZ\s+(.+)\s*$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

/* ---------- extension self-reload ---------- */

function control(baseDir, action) {
  return new Promise((resolve) => {
    const sock = net.connect(paths.channel(baseDir));
    let buf = '';
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setEncoding('utf8');
    sock.on('connect', () => sock.write(JSON.stringify({ type: 'control', action }) + '\n'));
    sock.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) { try { done(JSON.parse(buf.slice(0, i))); } catch { done(null); } } });
    sock.on('error', () => done(null));
    setTimeout(() => done(null), 3000);
  });
}

/**
 * After new files are copied: ask the running extension to re-read them and wait until Chrome runs the new version.
 * An unpacked extension never picks up new files by itself while Chrome runs (only on the next Chrome start).
 */
async function refreshExtension(baseDir, out) {
  const want = JSON.parse(fs.readFileSync(path.join(baseDir, 'extension', 'manifest.json'), 'utf8')).version;
  const st = await control(baseDir, 'status');
  if (!st) {
    out(say(`  расширение: браузер сейчас не на связи — Chrome возьмёт версию ${want} при следующем запуске`, `  extension: browser not connected now — Chrome picks up ${want} on its next start`));
    return 'offline';
  }
  if (st.extVersion === want) {
    out(say(`  расширение: уже работает версия ${want}`, `  extension: version ${want} is already running`));
    return 'current';
  }
  if (!st.extVersion) {
    out(say('  расширение: работающая версия не умеет перезагружаться сама — один раз нажмите «Обновить» у maxagent bridge в chrome://extensions',
      '  extension: the running version cannot reload itself — press "Reload" on maxagent bridge in chrome://extensions once'));
    return 'manual';
  }
  await control(baseDir, 'reload');
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const now = await control(baseDir, 'status');
    if (now && now.extVersion === want) {
      out(say(`  расширение: перезагружено, ${st.extVersion} → ${want}`, `  extension: reloaded, ${st.extVersion} → ${want}`));
      return 'reloaded';
    }
  }
  out(say(`  [ERROR] расширение не вернулось с версией ${want} за 20 с — проверьте chrome://extensions`, `  [ERROR] extension did not come back as ${want} within 20 s — check chrome://extensions`));
  return 'failed';
}

/* ---------- commands ---------- */

async function reload(opts, out) {
  const home = opts.home || os.homedir();
  const baseDir = opts.home ? path.join(home, '.maxagent-bridge') : paths.base(home);
  const r = await refreshExtension(baseDir, out);
  return r === 'failed' || r === 'manual' ? 1 : 0;
}

async function install(opts, out) {
  const home = opts.home || os.homedir();
  const baseDir = opts.home ? path.join(home, '.maxagent-bridge') : paths.base(home);
  const w = new Writer(opts.dryRun, out);
  if (opts.dryRun) out(say('Пробный прогон: ничего не записывается.', 'Dry run: nothing is written.'));
  out(say('Что будет сделано:', 'What will be done:'));
  // Our own copy: the npx cache is temporary, Chrome and agents need stable paths.
  copyDir(path.join(PKG_ROOT, 'lib'), path.join(baseDir, 'app', 'lib'), w);
  copyDir(path.join(PKG_ROOT, 'bin'), path.join(baseDir, 'app', 'bin'), w);
  w.write(path.join(baseDir, 'app', 'package.json'), fs.readFileSync(path.join(PKG_ROOT, 'package.json')));
  out(`  ${say('программа', 'program')}: ${path.join(baseDir, 'app')}`);
  copyDir(path.join(PKG_ROOT, 'extension'), path.join(baseDir, 'extension'), w);
  out(`  ${say('расширение', 'extension')}: ${path.join(baseDir, 'extension')}`);
  registerHost(baseDir, home, w, opts.registry !== false);
  const found = Object.keys(AGENTS).filter((id) => AGENTS[id].detect(home));
  const agents = opts.agents !== undefined ? String(opts.agents).split(',').map((s) => s.trim()).filter((a) => AGENTS[a]) : found;
  for (const id of agents) {
    const f = AGENTS[id].file(home);
    // A copy of the agent's own settings before our first change.
    if (fs.existsSync(f) && !fs.existsSync(f + '.maxagent-bridge-backup')) w.write(f + '.maxagent-bridge-backup', fs.readFileSync(f), `${AGENTS[id].title}: backup`);
    AGENTS[id].add(home, baseDir, w);
  }
  w.write(path.join(baseDir, 'config.json'), JSON.stringify({ version: require('../package.json').version, agents, extensionId: EXT_ID }, null, 2) + '\n');
  const state = opts.dryRun ? null : await refreshExtension(baseDir, out);
  if (state === 'reloaded' || state === 'current') return 0; // extension already loaded in Chrome — no manual steps
  if (!opts.dryRun) {
    out('');
    out(say('Осталось одно действие в Chrome (браузер не даёт программам ставить расширения молча):', 'One step left in Chrome (Chrome does not let programs install extensions silently):'));
    out(say('  1. Откройте chrome://extensions и включите «Режим разработчика» (справа вверху).', '  1. Open chrome://extensions and turn on "Developer mode" (top right).'));
    out(say(`  2. «Загрузить распакованное» → папка ${path.join(baseDir, 'extension')}`, `  2. "Load unpacked" → folder ${path.join(baseDir, 'extension')}`));
    out(say(`  3. ID расширения должен быть ${EXT_ID}. Перезапустите агентов — у них появится MCP maxagent-bridge.`, `  3. The extension ID must be ${EXT_ID}. Restart your agents — they get the maxagent-bridge MCP.`));
    out(say('При первом подключении каждого агента браузер спросит вас, разрешить ли ему доступ.', 'The first time each agent connects, the browser asks you whether to allow it.'));
    if (agents.includes('codex')) out(say('Codex: MCP-серверы он запускает сам, одобрять ничего не нужно.', 'Codex: it starts MCP servers itself, nothing to approve.'));
  }
  return 0;
}

function uninstall(opts, out) {
  const home = opts.home || os.homedir();
  const baseDir = opts.home ? path.join(home, '.maxagent-bridge') : paths.base(home);
  const w = new Writer(opts.dryRun, out);
  for (const a of Object.values(AGENTS)) a.remove(home, w);
  if (opts.registry !== false) {
    if (process.platform === 'win32') {
      out(`  ${say('реестр', 'registry')} −: ${REG_KEY}`);
      if (!opts.dryRun) { try { execFileSync('reg', ['delete', REG_KEY, '/f'], { stdio: 'ignore' }); } catch { /* not there */ } }
    } else {
      const f = path.join(chromeHostDir(home), `${paths.HOST_NAME}.json`);
      if (fs.existsSync(f) && !opts.dryRun) fs.rmSync(f); // our own manifest file
    }
  }
  out(say(`Готово. Расширение уберите сами в chrome://extensions. Папка ${baseDir} (ключи агентов, копия программы) осталась — удалите вручную, если не нужна.`,
    `Done. Remove the extension yourself in chrome://extensions. Folder ${baseDir} (agent keys, program copy) is kept — delete it manually if not needed.`));
  return 0;
}

function doctor(opts, out) {
  const home = opts.home || os.homedir();
  const baseDir = opts.home ? path.join(home, '.maxagent-bridge') : paths.base(home);
  let errors = 0;
  const line = (ok, text, level = 'ERROR') => { if (!ok && level === 'ERROR') errors++; out(`[${ok ? 'OK' : level}] ${text}`); };
  const manifestFile = hostManifestPath(baseDir);
  line(fs.existsSync(path.join(baseDir, 'app', 'bin', 'maxagent-bridge.js')), say('программа: ', 'program: ') + path.join(baseDir, 'app'));
  line(fs.existsSync(path.join(baseDir, 'extension', 'manifest.json')), say('расширение: ', 'extension: ') + path.join(baseDir, 'extension'));
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch { /* missing */ }
  line(!!manifest && fs.existsSync(manifest.path), say('манифест посредника: ', 'host manifest: ') + manifestFile);
  line(!!manifest && (manifest.allowed_origins || []).includes(`chrome-extension://${EXT_ID}/`), say('посредник пускает только наше расширение', 'host allows only our extension'));
  if (opts.registry !== false) {
    const reg = registeredHostManifest(home);
    line(reg && path.resolve(reg) === path.resolve(process.platform === 'win32' ? manifestFile : reg), say('посредник зарегистрирован в Chrome: ', 'host registered with Chrome: ') + (reg || '—'));
  }
  for (const [id, a] of Object.entries(AGENTS)) if (a.detect(home)) line(a.has(home), `${a.title}: MCP maxagent-bridge`, 'WARN');
  const live = net.connect(paths.channel(baseDir));
  return new Promise((resolve) => {
    const done = (up) => {
      live.destroy();
      out(`[${up ? 'OK' : 'INFO'}] ${up ? say('браузер на связи (Chrome с расширением запущен)', 'browser is connected (Chrome with the extension is running)') : say('браузер сейчас не на связи: Chrome не запущен или расширение не загружено', 'browser not connected now: Chrome is not running or the extension is not loaded')}`);
      out(say(`Итог: ошибок ${errors}.`, `Result: ${errors} errors.`));
      resolve(errors ? 1 : 0);
    };
    live.on('connect', () => done(true));
    live.on('error', () => done(false));
    setTimeout(() => done(false), 1500);
  });
}

module.exports = { install, uninstall, doctor, reload, refreshExtension, AGENTS, EXT_ID };
