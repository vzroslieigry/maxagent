'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { t, LANG_NAMES, LANGS } = require('./i18n');
const { ADAPTERS, detectAgents } = require('./agents');
const { PKG_ROOT, PKG, render, walk, readText, withBlock, withoutBlock, blockOf, Writer } = require('./util');
const hooks = require('./hooks');
const rules = require('./rules');
const extras = require('./extras');
const expIndex = require('../tools/experience-index');

const hookMsg = (lang) => (key) => t(lang, key);
const TOOL_FILE = 'experience-index.js';
const envProbe = require('../tools/env-probe');

/* ---------- paths and settings ---------- */

function paths(home) {
  const root = path.join(home, '.maxagent');
  return { root, config: path.join(root, 'config.json'), coreBase: path.join(root, 'core'), tools: path.join(root, 'tools') };
}

function loadConfig(home) {
  const f = paths(home).config;
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

/** Settings added after 0.2.0 get their defaults (setup questions for them come with `setup`). */
function withDefaults(cfg, home) {
  if (cfg.answerFormat === undefined) cfg.answerFormat = true;
  if (cfg.trash === undefined) cfg.trash = true;
  if (cfg.desktop === undefined) cfg.desktop = null;
  if (cfg.bridge === undefined) cfg.bridge = fs.existsSync(path.join(home, '.maxagent-bridge'));
  return cfg;
}

function vars(cfg, home) {
  const lang = cfg.lang;
  return {
    WORKSPACE: cfg.workspace,
    CORE: path.join(paths(home).coreBase, lang),
    TOOLS: paths(home).tools.replace(/\\/g, '/'),
    LANGUAGE: LANG_NAMES[lang] || lang,
    REPO: cfg.repo || t(lang, 'off'),
    DESKTOP: cfg.desktop ? t(lang, 'desktopOn', { n: cfg.desktop }) : t(lang, 'off'),
    BRIDGE: cfg.bridge ? t(lang, 'on') : t(lang, 'offBridge'),
    SETTINGS: settingsLines(cfg).join('\n'),
    DATE: new Date().toISOString().slice(0, 10),
    VERSION: PKG.version,
  };
}

/** Tools the agent runs offline: experience index builder, environment card, clipboard → inbox (Windows). */
function installTools(cfg, home, w) {
  const src = path.join(PKG_ROOT, 'tools');
  for (const f of fs.readdirSync(src)) w.write(path.join(paths(home).tools, f), fs.readFileSync(path.join(src, f), 'utf8'), t(cfg.lang, 'toolsInstalled'));
}

/** Environment card (MAXAGENT_SKIP_PROBE=1 skips it — the tests use that to stay fast). */
function probeEnv(cfg, w) {
  if (w.dry || process.env.MAXAGENT_SKIP_PROBE || !fs.existsSync(cfg.workspace)) return;
  try { w.note(envProbe.write(cfg.workspace, cfg.lang).line); } catch (e) { w.note(`env-probe: ${e.message}`); }
}

/** Refresh the core rules block in the workspace AGENTS.md (the only part of the workspace the package rewrites). */
function applyRules(cfg, w) {
  const file = path.join(cfg.workspace, 'AGENTS.md');
  const text = readText(file);
  if (text === null) return; // dry run before the template exists
  const withR = rules.withRules(text, cfg, LANG_NAMES[cfg.lang] || cfg.lang);
  const next = rules.withSettings(withR, settingsLines(cfg));
  if (withR !== text) w.write(file, next, t(cfg.lang, 'rulesUpdated'));
  else if (next !== text) w.write(file, next, t(cfg.lang, 'settingsUpdated'));
}

function buildIndex(cfg, w) {
  if (w.dry || !fs.existsSync(cfg.workspace)) return;
  const r = expIndex.run(cfg.workspace, { lang: cfg.lang });
  for (const l of r.lines) w.note(`${t(cfg.lang, 'indexLabel')}: ${l}`);
}

function blockBody(cfg) {
  return t(cfg.lang, 'blockText', { ws: path.join(cfg.workspace, 'AGENTS.md') });
}

/* ---------- shared steps ---------- */

/** Package rules: always overwritten from the package (core belongs to the package). */
function installCore(cfg, home, w) {
  const src = path.join(PKG_ROOT, 'core', cfg.lang);
  const dest = path.join(paths(home).coreBase, cfg.lang);
  const v = vars(cfg, home);
  for (const rel of walk(src)) {
    w.write(path.join(dest, rel), render(fs.readFileSync(path.join(src, rel), 'utf8'), v), t(cfg.lang, 'coreInstalled'));
  }
}

/** Workspace skeleton: copied once; an existing file is never touched. */
function installTemplate(cfg, home, w, quiet = false) {
  // A language without its own template yet (package languages grow faster than templates) uses the English one.
  let src = path.join(PKG_ROOT, 'template', cfg.lang);
  if (!fs.existsSync(src)) src = path.join(PKG_ROOT, 'template', 'en');
  const v = vars(cfg, home);
  for (const rel of walk(src)) {
    // npm never ships files named .gitignore, so the template keeps it as "gitignore".
    const dest = path.join(cfg.workspace, rel === 'gitignore' ? '.gitignore' : rel);
    if (fs.existsSync(dest)) {
      if (!quiet) w.note(`${t(cfg.lang, 'skippedExists')}: ${dest}`);
      continue;
    }
    w.write(dest, render(fs.readFileSync(path.join(src, rel), 'utf8'), v), t(cfg.lang, 'created'));
  }
}

function rulesFilesOf(cfg, home) {
  const out = [];
  for (const id of cfg.agents) {
    const a = ADAPTERS[id];
    if (!a) continue;
    for (const file of a.rulesFiles(home)) out.push({ id, title: a.title, file });
  }
  return out;
}

/** Insert or refresh the short maxagent block in every connected agent's rules file. */
function connectAgents(cfg, home, w) {
  const note = t(cfg.lang, 'blockNote');
  for (const { title, file } of rulesFilesOf(cfg, home)) {
    const existing = readText(file);
    const { text, action } = withBlock(existing, blockBody(cfg), note);
    if (action === 'same') {
      w.note(`${title}: ${t(cfg.lang, 'blockUpdated')} (=): ${file}`);
      continue;
    }
    if (existing !== null && existing !== '' && !blockOf(existing)) {
      w.copyOnce(file, file + '.maxagent-backup', `${title}: ${t(cfg.lang, 'backup')}`);
    }
    w.write(file, text, `${title}: ${t(cfg.lang, action === 'added' ? 'blockAdded' : 'blockUpdated')}`);
  }
}

function saveConfig(cfg, home, w) {
  w.write(paths(home).config, JSON.stringify(cfg, null, 2) + '\n', 'config');
}

/* ---------- questions ---------- */

async function ask(rl, question, def) {
  if (!rl) return def;
  const a = (await rl.question(`${question}${def ? ` [${def}]` : ''}: `)).trim();
  return a || def;
}

// yes/no in every package language: ru, en, es, zh, pt, de, fr, ja, ko, hi
const YES = /^(y|yes|д|да|sí|si|是|是的|sim|ja|j|oui|はい|예|네|हाँ|हां)$/i;
const NO = /^(n|no|н|нет|否|不|não|nao|nein|non|いいえ|아니요|아니오|नहीं|नही)$/i;

/** A yes/no question: Enter keeps the current value. */
async function askYesNo(rl, lang, key, cur) {
  const a = await ask(rl, t(lang, key), cur ? t(lang, 'yes') : t(lang, 'no'));
  if (YES.test(a)) return true;
  if (NO.test(a)) return false;
  return !!cur;
}

/**
 * The settings questions, in order of importance (decided 05.11.2026): repository, browser bridge,
 * separate desktop, answer format, delete to Trash (the code word was removed in 0.4.0). Used by init (after language / workspace / agents) and setup.
 * Command-line flags win over questions; without a terminal (--yes) the current values or defaults stay.
 */
async function askSettings(rl, lang, cur, opts, io, home) {
  const out = {};
  out.repo = opts.repo !== undefined ? opts.repo : (await ask(rl, t(lang, 'askRepo'), cur.repo || '')) || '';
  if (out.repo === '-') out.repo = '';

  out.bridge = opts.bridge !== undefined ? opts.bridge : await askYesNo(rl, lang, 'askBridge', cur.bridge);

  let desk = opts.desktop !== undefined ? opts.desktop : await ask(rl, t(lang, 'askDesktop'), cur.desktop ? String(cur.desktop) : '');
  desk = parseInt(desk, 10);
  out.desktop = desk >= 2 && desk <= 20 ? desk : null;

  out.answerFormat = opts.answerFormat !== undefined ? opts.answerFormat : await askYesNo(rl, lang, 'askFormat', cur.answerFormat !== false);
  out.trash = opts.trash !== undefined ? opts.trash : await askYesNo(rl, lang, 'askTrash', cur.trash !== false);
  return out;
}

/** Lines of the "Settings" section of the workspace AGENTS.md. */
function settingsLines(cfg, home) {
  const L = (k) => t(cfg.lang, k);
  const yn = (v) => (v ? L('on') : L('off'));
  return [
    `- ${L('sWorkspace')}: \`${cfg.workspace}\``,
    `- ${L('sLang')}: ${LANG_NAMES[cfg.lang] || cfg.lang}`,
    `- ${L('sRepo')}: ${cfg.repo || L('off')}`,
    `- ${L('sBridge')}: ${cfg.bridge ? L('on') : L('offBridge')}`,
    `- ${L('sDesktop')}: ${cfg.desktop ? t(cfg.lang, 'desktopOn', { n: cfg.desktop }) : L('off')}`,
    `- ${L('sFormat')}: ${yn(cfg.answerFormat !== false)}`,
    `- ${L('sTrash')}: ${yn(cfg.trash !== false)}`,
  ];
}

/* ---------- commands ---------- */

async function init(opts, io) {
  const home = opts.home;
  const prev = loadConfig(home);
  const rl = opts.yes ? null : io.rl();
  try {
    let lang = opts.lang || (prev && prev.lang) || 'ru';
    if (!opts.lang) lang = (await ask(rl, 'Язык / Language [ru/en/es/zh/pt/de/fr/ja/ko/hi]', lang)).toLowerCase();
    if (!LANGS.includes(lang)) lang = 'en';

    const workspace = path.resolve(opts.workspace || (await ask(rl, t(lang, 'askWorkspace'), (prev && prev.workspace) || path.join(home, 'maxagent'))));

    const found = detectAgents(home);
    let agents;
    if (opts.agents) agents = opts.agents.split(',').map((s) => s.trim()).filter((s) => ADAPTERS[s]);
    else if (!found.length) {
      io.out(t(lang, 'noAgents'));
      agents = [];
    } else {
      const list = found.map((id) => `${id} (${ADAPTERS[id].title})`).join(', ');
      const a = await ask(rl, t(lang, 'askAgents', { list }), '');
      agents = a ? a.split(',').map((s) => s.trim()).filter((s) => found.includes(s)) : found;
    }

    const s = await askSettings(rl, lang, withDefaults({ ...(prev || {}), lang }, home), opts, io, home);

    const cfg = withDefaults({
      version: PKG.version,
      lang,
      workspace,
      agents,
      hooks: !opts.noHooks,
      repo: s.repo,
      bridge: s.bridge,
      desktop: s.desktop,
      answerFormat: s.answerFormat,
      trash: s.trash,
      installedAt: (prev && prev.installedAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, home);
    const repo = cfg.repo;

    if (opts.dryRun) io.out(t(lang, 'dryRun'));
    io.out(t(lang, 'planTitle'));
    const w = new Writer({ dry: opts.dryRun, log: io.out });
    installCore(cfg, home, w);
    installTools(cfg, home, w);
    installTemplate(cfg, home, w);
    applyRules(cfg, w);
    probeEnv(cfg, w);
    buildIndex(cfg, w);
    connectAgents(cfg, home, w);
    if (cfg.hooks) hooks.applyHooks(cfg, home, w, true, hookMsg(lang));
    if (!opts.dryRun) dropCodeword(home);
    if (cfg.bridge && !fs.existsSync(path.join(home, '.maxagent-bridge'))) io.out('  ' + t(lang, 'bridgeInstall'));
    if (cfg.repo && !fs.existsSync(path.join(workspace, '.git'))) {
      w.note(`${t(lang, 'gitInit')}: ${cfg.repo}`);
      if (!opts.dryRun) {
        execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: workspace });
        execFileSync('git', ['remote', 'add', 'origin', cfg.repo], { cwd: workspace });
      }
    }
    saveConfig(cfg, home, w);
    if (!opts.dryRun) {
      io.out('');
      await runExtras(cfg, home, opts, io, rl);
      io.out('');
      io.out(t(lang, 'initDone'));
      if (agents.includes('codex')) io.out(t(lang, 'codexHooksNote'));
    }
    return 0;
  } finally {
    if (rl) rl.close();
  }
}

function requireConfig(home, io) {
  const cfg = loadConfig(home);
  if (!cfg) io.out(t('ru', 'notInstalled', { path: paths(home).config }) + '\n' + t('en', 'notInstalled', { path: paths(home).config }));
  return cfg;
}

/** Sections of core/<lang>/changes.md for versions newer than `from`. */
function whatsNew(lang, from) {
  const newer = (v) => {
    const a = String(v).split('.').map(Number);
    const b = String(from || '0').split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    return false;
  };
  let text = '';
  try { text = fs.readFileSync(path.join(PKG_ROOT, 'core', lang, 'changes.md'), 'utf8'); } catch { return []; }
  const out = [];
  for (const sec of text.split(/^## /m).slice(1)) {
    const [head, ...body] = sec.split(/\r?\n/);
    if (!newer(head.trim())) continue;
    out.push('', t(lang, 'whatsNew', { v: head.trim() }), ...body.filter((l) => l.trim()));
  }
  return out;
}

/**
 * The code word was removed in 0.4.0 (decision 05.11.2026): remove what older versions left — the hash and the
 * per-session confirmation state. Both are the package's own files in ~/.maxagent, not owner data.
 */
function dropCodeword(home) {
  const root = path.join(home, '.maxagent');
  fs.rmSync(path.join(root, 'codeword.hash'), { force: true });
  let names = [];
  try { names = fs.readdirSync(path.join(root, 'state')); } catch { return; }
  for (const n of names) {
    const f = path.join(root, 'state', n);
    try { if ('confirmed' in JSON.parse(fs.readFileSync(f, 'utf8'))) fs.rmSync(f, { force: true }); } catch { /* not ours */ }
  }
}

async function update(opts, io) {
  const home = opts.home;
  const cfg = requireConfig(home, io);
  if (!cfg) return 1;
  const from = cfg.version;
  if (opts.agents) cfg.agents = opts.agents.split(',').map((s) => s.trim()).filter((s) => ADAPTERS[s]);
  cfg.version = PKG.version;
  cfg.updatedAt = new Date().toISOString();
  if (opts.dryRun) io.out(t(cfg.lang, 'dryRun'));
  const w = new Writer({ dry: opts.dryRun, log: io.out });
  if (cfg.hooks === undefined) cfg.hooks = true;
  if (!opts.dryRun) dropCodeword(home);
  delete cfg.codeword;
  withDefaults(cfg, home);
  installCore(cfg, home, w);
  installTools(cfg, home, w);
  installTemplate(cfg, home, w, true); // adds only files that are new in this version; existing ones are never touched
  applyRules(cfg, w);
  probeEnv(cfg, w);
  buildIndex(cfg, w);
  connectAgents(cfg, home, w);
  if (cfg.hooks) hooks.applyHooks(cfg, home, w, true, hookMsg(cfg.lang));
  saveConfig(cfg, home, w);
  io.out(t(cfg.lang, 'updateDone', { from, to: PKG.version }));
  for (const l of whatsNew(cfg.lang, from)) io.out(l);
  return 0;
}

async function uninstall(opts, io) {
  const home = opts.home;
  const cfg = requireConfig(home, io);
  if (!cfg) return 1;
  if (opts.dryRun) io.out(t(cfg.lang, 'dryRun'));
  const w = new Writer({ dry: opts.dryRun, log: io.out });
  for (const { title, file } of rulesFilesOf(cfg, home)) {
    const { text, removed } = withoutBlock(readText(file));
    if (!removed) {
      w.note(`${title}: ${t(cfg.lang, 'blockAbsent')}: ${file}`);
      continue;
    }
    w.write(file, text, `${title}: ${t(cfg.lang, 'blockRemoved')}`);
  }
  hooks.applyHooks(cfg, home, w, false, hookMsg(cfg.lang));
  cfg.agents = [];
  cfg.uninstalledAt = new Date().toISOString();
  saveConfig(cfg, home, w);
  io.out(t(cfg.lang, 'uninstallDone', { ws: cfg.workspace, home: paths(home).root }));
  return 0;
}

async function doctor(opts, io) {
  const home = opts.home;
  const p = paths(home);
  const cfg = loadConfig(home);
  let e = 0;
  let wn = 0;
  const lang = (cfg && cfg.lang) || 'ru';
  const line = (lvl, text) => {
    if (lvl === 'err') e++;
    if (lvl === 'warn') wn++;
    io.out(`[${t(lang, lvl)}] ${text}`);
  };
  io.out(`${t(lang, 'doctorTitle')} ${PKG.version}`);
  if (!cfg) {
    line('err', t(lang, 'dMissingConfig', { path: p.config }));
    io.out(t(lang, 'dSummary', { e, w: wn }));
    return 1;
  }
  line('ok', `config: ${p.config}`);

  if (cfg.version !== PKG.version) line('warn', t(lang, 'dCoreOld', { have: cfg.version, want: PKG.version }));
  const coreSrc = path.join(PKG_ROOT, 'core', cfg.lang);
  for (const rel of walk(coreSrc)) {
    const f = path.join(p.coreBase, cfg.lang, rel);
    if (!fs.existsSync(f)) line('err', t(lang, 'dCoreMissing', { path: f }));
  }

  for (const rel of ['AGENTS.md', 'experience.md', 'projects.md', 'sync.md', path.join('experience', 'maxagent.md')]) {
    const f = path.join(cfg.workspace, rel);
    if (fs.existsSync(f)) line('ok', f);
    else line('err', t(lang, 'dWsMissing', { path: f }));
  }

  const toolFile = path.join(p.tools, TOOL_FILE);
  if (!fs.existsSync(toolFile)) line('err', t(lang, 'dTool', { path: toolFile }));
  const wsRules = readText(path.join(cfg.workspace, 'AGENTS.md'));
  if (wsRules !== null && !rules.RE.test(wsRules)) line('err', t(lang, 'dRulesMissing', { path: path.join(cfg.workspace, 'AGENTS.md') }));
  else if (wsRules !== null && rules.withRules(wsRules, withDefaults({ ...cfg }, home), LANG_NAMES[cfg.lang] || cfg.lang) !== wsRules) line('warn', t(lang, 'dRulesOld'));
  else if (wsRules !== null) line('ok', t(lang, 'dRulesOk'));
  if (fs.existsSync(path.join(cfg.workspace, 'experience.md'))) {
    const ix = expIndex.run(cfg.workspace, { check: true, lang: cfg.lang });
    if (ix.code) line('warn', `${t(lang, 'indexLabel')}: ${ix.lines.filter((l) => l.startsWith('ERROR')).map((l) => l.slice(7)).join('; ')} — npx maxagent index`);
    else line('ok', `${t(lang, 'indexLabel')}: ${ix.lines[ix.lines.length - 1]}`);
  }

  const expected = blockBody(cfg);
  for (const { title, file } of rulesFilesOf(cfg, home)) {
    const b = blockOf(readText(file));
    if (!b) line('err', `${title}: ${t(lang, 'dBlockMissing', { path: file })}`);
    else if (!b.includes(expected)) line('err', `${title}: ${t(lang, 'dBlockWrongWs', { path: file })}`);
    else line('ok', `${title}: ${t(lang, 'dBlockOk', { path: file })}`);
  }
  if (cfg.hooks) {
    const hookFile = path.join(p.root, 'hooks', 'maxagent-hook.js');
    if (!fs.existsSync(hookFile)) line('err', t(lang, 'dHookFile', { path: hookFile }));
  }
  for (const id of cfg.agents) {
    if (!ADAPTERS[id]) continue;
    let level = t(lang, 'soft');
    const reg = cfg.hooks ? hooks.registeredEvents(id, home) : null;
    if (id === 'openclaw' && reg && reg.events.length < reg.want.length) line('warn', t(lang, 'dOcNotWired'));
    else if (reg && reg.bad) line('err', t(lang, 'dHooksBad', { agent: ADAPTERS[id].title, path: hooks.HOOK_TARGETS[id].file(home) }));
    else if (reg && reg.events.length < reg.want.length) line('err', t(lang, 'dHooksMissing', { agent: ADAPTERS[id].title, have: reg.events.length, want: reg.want.length }));
    else if (reg) {
      const lv = hooks.HOOK_TARGETS[id].level;
      level = t(lang, { hard: 'levelHard', approve: 'levelApprove', openclaw: 'levelOpenclaw' }[lv] || 'levelPartial');
    }
    io.out(`  ${ADAPTERS[id].title} — ${t(lang, 'level')}: ${level}`);
  }
  io.out(t(lang, 'dSummary', { e, w: wn }));
  return e ? 1 : 0;
}

/** npx maxagent setup — change settings later (same questions as init, current values as defaults). */
async function setup(opts, io) {
  const home = opts.home;
  const cfg = requireConfig(home, io);
  if (!cfg) return 1;
  withDefaults(cfg, home);
  const rl = opts.yes ? null : io.rl();
  let s;
  try {
    io.out(t(cfg.lang, 'setupTitle'));
    s = await askSettings(rl, cfg.lang, cfg, opts, io, home);
  } finally {
    if (rl) rl.close();
  }
  if (opts.dryRun) io.out(t(cfg.lang, 'dryRun'));
  const w = new Writer({ dry: opts.dryRun, log: io.out });
  Object.assign(cfg, { repo: s.repo, bridge: s.bridge, desktop: s.desktop, answerFormat: s.answerFormat, trash: s.trash, updatedAt: new Date().toISOString() });
  delete cfg.codeword;
  applyRules(cfg, w);
  if (cfg.repo && !fs.existsSync(path.join(cfg.workspace, '.git'))) {
    w.note(`${t(cfg.lang, 'gitInit')}: ${cfg.repo}`);
    if (!opts.dryRun) {
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: cfg.workspace });
      execFileSync('git', ['remote', 'add', 'origin', cfg.repo], { cwd: cfg.workspace });
    }
  }
  saveConfig(cfg, home, w);
  if (cfg.bridge && !fs.existsSync(path.join(home, '.maxagent-bridge'))) io.out('  ' + t(cfg.lang, 'bridgeInstall'));
  io.out(t(cfg.lang, 'setupDone'));
  io.out(t(cfg.lang, 'setupLangNote'));
  return 0;
}

/** npx maxagent index — rebuild the experience index from the entry headers (--check: only check). */
async function index(opts, io) {
  const cfg = requireConfig(opts.home, io);
  if (!cfg) return 1;
  const r = expIndex.run(cfg.workspace, { check: !!opts.check, lang: cfg.lang });
  for (const l of r.lines) io.out(l);
  return r.code;
}

/* ---------- extras: bridge + extension, meaning search, shared experience ---------- */

function extrasSay(lang) {
  const s = (k, v) => t(lang, k, v);
  return {
    pyMissing: s('pyMissing'), pyAsk: s('pyAsk'), pyManual: s('pyManual'), pyWinget: s('pyWinget'), pyFailed: s('pyFailed'),
    vectorsPip: (v) => s('vectorsPip', { v }), vectorsFile: (f, mb) => s('vectorsFile', { f, mb }), vectorsFailed: (e) => s('vectorsFailed', { e }),
    vectorsOk: s('vectorsOk'), vectorsSkipped: s('vectorsSkipped'),
    bridgeRun: s('bridgeRun'), bridgeFailed: s('bridgeFailed'), packsFailed: s('packsFailed'),
  };
}

/**
 * After the core is installed: one question "install all extras?" (all / choose / none). --all and --no-extras
 * answer it from the command line; --yes without --all installs nothing extra (an agent running init does not
 * download 270 MB on its own).
 */
async function runExtras(cfg, home, opts, io, rl) {
  const lang = cfg.lang;
  let mode = opts.all ? 'all' : opts.noExtras || !rl ? 'none' : '';
  if (!mode) {
    const a = String(await ask(rl, t(lang, 'askExtras', { mb: extras.VECTOR_MB }), t(lang, 'extrasAll'))).trim().toLowerCase();
    mode = new RegExp(t(lang, 'extrasAllRe'), 'i').test(a) ? 'all' : new RegExp(t(lang, 'extrasChooseRe'), 'i').test(a) ? 'choose' : 'none';
  }
  if (mode === 'none') { io.out(t(lang, 'extrasLater')); return; }
  const want = async (key) => mode === 'all' || (await askYesNo(rl, lang, key, true));
  const confirm = async (q) => mode === 'all' && opts.all ? true : askYesNo(rl, lang, q, true);
  const say = extrasSay(lang);
  const done = [];
  if (cfg.bridge !== false && (await want('askExtraBridge'))) done.push(['bridge', extras.installBridge(cfg, { out: io.out, say })]);
  if (await want('askExtraVectors')) done.push(['vectors', await extras.installVectors(home, { out: io.out, say, confirm: async (q) => (rl ? askYesNo(rl, lang, 'pyAskYesNo', true) : !!opts.all) })]);
  if (await want('askExtraPacks')) done.push(['packs', extras.installPacks(home, { out: io.out, say })]);
  io.out('');
  io.out(t(lang, 'extrasSummary'));
  for (const [k, ok] of done) io.out(`  ${ok ? '✓' : '✗'} ${t(lang, `extra_${k}`)}${ok ? '' : ` — ${t(lang, `extraLater_${k}`)}`}`);
}

async function bridge(opts, io) {
  const cfg = requireConfig(opts.home, io);
  if (!cfg) return 1;
  return extras.installBridge(cfg, { out: io.out, say: extrasSay(cfg.lang) }) ? 0 : 1;
}

async function vectors(opts, io) {
  const cfg = requireConfig(opts.home, io);
  if (!cfg) return 1;
  const rl = opts.yes ? null : io.rl();
  try {
    const ok = await extras.installVectors(opts.home, { out: io.out, say: extrasSay(cfg.lang), confirm: async () => (rl ? askYesNo(rl, cfg.lang, 'pyAskYesNo', true) : !!opts.yes) });
    return ok ? 0 : 1;
  } finally { if (rl) rl.close(); }
}

async function experience(opts, io) {
  const tool = path.join(opts.home, '.maxagent', 'tools', 'experience-packs.js');
  if (!fs.existsSync(tool)) { requireConfig(opts.home, io); return 1; }
  const r = require('child_process').spawnSync(process.execPath, [tool, ...(opts.rest || [])], { stdio: 'inherit' });
  return r.status || 0;
}

module.exports = { init, setup, update, uninstall, doctor, index, bridge, vectors, experience };
