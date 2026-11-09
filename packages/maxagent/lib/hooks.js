'use strict';

const fs = require('fs');
const path = require('path');
const { PKG_ROOT, readText } = require('./util');
const { hermesHome } = require('./agents');

const HOOK_FILE = 'maxagent-hook.js';
const MARK = HOOK_FILE; // our registrations are recognised by this file name in the command

/** Where each agent keeps hooks and which of our events it gets (formats: projects/maxagent/paket.md). */
const HOOK_TARGETS = {
  'claude-code': {
    file: (home) => path.join(home, '.claude', 'settings.json'),
    events: { SessionStart: 'start', UserPromptSubmit: 'prompt', Stop: 'stop', PreToolUse: 'pretool', PostToolUse: 'posttool' },
    level: 'hard',
  },
  codex: {
    file: (home) => path.join(home, '.codex', 'hooks.json'),
    events: { SessionStart: 'start', UserPromptSubmit: 'prompt', PreToolUse: 'pretool', Stop: 'stop' },
    level: 'approve',
  },
  antigravity: {
    file: (home) => path.join(home, '.gemini', 'config', 'hooks.json'),
    events: { PreInvocation: 'invocation', PreToolUse: 'pretool', Stop: 'stop' },
    level: 'partial',
  },
  // Hermes: a plugin too (hermes/), copied into its plugins folder and enabled through its CLI.
  hermes: {
    file: (home) => path.join(hermesHome(home), 'config.yaml'),
    events: { plugin: 'plugin' },
    level: 'openclaw',
  },
  // OpenClaw: not a hooks file but a plugin (openclaw/), linked and enabled through the OpenClaw CLI.
  openclaw: {
    file: (home) => path.join(home, '.openclaw', 'openclaw.json'),
    events: { plugin: 'plugin' },
    level: 'openclaw',
  },
};

/* ---------- OpenClaw plugin ---------- */

const OC_FILES = ['package.json', 'openclaw.plugin.json', 'index.js'];
const ocDir = (home) => path.join(home, '.maxagent', 'openclaw');

/**
 * How to call the OpenClaw CLI. MAXAGENT_OPENCLAW_BIN (a node script) stands in for it in tests; with a fake --home
 * and no stand-in we never touch the real OpenClaw.
 */
function ocCli(home) {
  if (process.env.MAXAGENT_OPENCLAW_BIN) return { cmd: process.execPath, pre: [process.env.MAXAGENT_OPENCLAW_BIN], shell: false };
  if (path.resolve(home) !== path.resolve(require('os').homedir())) return null;
  return { cmd: 'openclaw', pre: [], shell: true };
}
function ocRun(home, args) {
  const c = ocCli(home);
  if (!c) return { skipped: true };
  const q = (a) => (c.shell && /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
  const r = require('child_process').spawnSync(c.cmd, [...c.pre, ...args].map(q), { encoding: 'utf8', shell: c.shell, timeout: 240000, windowsHide: true });
  const out = `${r.stdout || ''}${r.stderr || ''}`.split(/\r?\n/).filter((l) => l.trim() && !/sqlite|At C:|CategoryInfo|FullyQualifiedErrorId|^\s*[+~]/.test(l));
  return { ok: r.status === 0, out: out.slice(-3).join(' ') };
}
/** openclaw.json says our plugin is enabled with conversation access (then the CLI steps are not repeated). */
function ocWired(home) {
  const { ok, data } = readJsonFile(HOOK_TARGETS.openclaw.file(home));
  const e = ok && data && data.plugins && data.plugins.entries && data.plugins.entries.maxagent;
  return !!(e && e.enabled !== false && e.hooks && e.hooks.allowConversationAccess === true);
}

function applyOpenclaw(home, w, add, msg) {
  const dir = ocDir(home);
  if (!add) {
    if (w.dry || !fs.existsSync(dir)) return;
    const r = ocRun(home, ['plugins', 'uninstall', 'maxagent', '--force', '--keep-files']);
    if (!r.skipped) w.note(`openclaw plugins uninstall maxagent: ${r.ok ? 'OK' : `ERROR ${r.out}`}`);
    return;
  }
  for (const f of OC_FILES) w.write(path.join(dir, f), fs.readFileSync(path.join(PKG_ROOT, 'openclaw', f), 'utf8'), `openclaw: ${msg('ocPlugin')}`);
  if (w.dry) return;
  if (ocWired(home)) { w.note(`openclaw: ${msg('ocWired')}`); return; }
  // OpenClaw 2026.8 refuses a plugin with hooks without explicit capability consent ("requires capability consent.
  // Use … --accept-capabilities"): consenting to exactly what this plugin does is the point of installing it.
  const steps = [
    ['plugins', 'install', '--link', dir, '--force', '--accept-capabilities'],
    ['plugins', 'enable', 'maxagent', '--accept-capabilities'],
    ['config', 'set', 'plugins.entries.maxagent.hooks.allowConversationAccess', 'true'],
  ];
  for (const s of steps) {
    const r = ocRun(home, s);
    if (r.skipped) { w.note(`openclaw: ${msg('ocSkipped')}`); return; }
    w.note(`openclaw ${s.slice(0, 2).join(' ')}: ${r.ok ? 'OK' : `ERROR ${r.out}`}`);
    if (!r.ok) return;
  }
  w.note(`openclaw: ${msg('ocRestart')}`);
}

const HM_FILES = ['plugin.yaml', '__init__.py'];
const hmDir = (home) => path.join(hermesHome(home), 'plugins', 'maxagent');
function hmRun(home, verb) {
  if (path.resolve(home) !== path.resolve(require('os').homedir())) return { skipped: true };
  const own = path.join(hermesHome(home), 'bin', process.platform === 'win32' ? 'hermes.exe' : 'hermes');
  const r = require('child_process').spawnSync(fs.existsSync(own) ? own : 'hermes', ['plugins', verb, 'maxagent'], { encoding: 'utf8', timeout: 240000, windowsHide: true, shell: !fs.existsSync(own) });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim().split(/\r?\n/).slice(-1)[0] };
}
function applyHermes(home, w, add) {
  if (!add) {
    if (!w.dry && fs.existsSync(hmDir(home))) { const r = hmRun(home, 'disable'); if (!r.skipped) w.note(`hermes plugins disable maxagent: ${r.ok ? 'OK' : `ERROR ${r.out}`}`); }
    return;
  }
  for (const f of HM_FILES) w.write(path.join(hmDir(home), f), fs.readFileSync(path.join(PKG_ROOT, 'hermes', f), 'utf8'), 'hermes: plugin');
  if (w.dry) return;
  const r = hmRun(home, 'enable');
  if (r.skipped) return;
  w.note(r.ok ? 'hermes plugins enable maxagent: OK (restart Hermes)' : `hermes: enable it by hand: hermes plugins enable maxagent (${r.out})`);
}

const hookPath = (home) => path.join(home, '.maxagent', 'hooks', HOOK_FILE).replace(/\\/g, '/');
const cmdString = (home, agent, ev) => `node "${hookPath(home)}" ${agent} ${ev}`;
// Antigravity runs the hook command WITHOUT a shell: quotes reach node as part of the file name
// ("Cannot find module '…\.gemini\config\"C:\…\maxagent-hook.js"'") and a failing PreToolUse hook blocks every tool
// (seen live 05.11.2026). So no quotes there; a path with spaces gets the short 8.3 form on Windows.
function agCmd(home, ev) {
  let p = hookPath(home);
  if (/\s/.test(p) && process.platform === 'win32') {
    try {
      const r = require('child_process').spawnSync('cmd', ['/c', 'for', '%I', 'in', `("${p.replace(/\//g, '\\')}")`, 'do', '@echo', '%~sI'], { encoding: 'utf8', windowsHide: true });
      const short = (r.stdout || '').trim().split(/\r?\n/).pop();
      if (short && !/\s/.test(short)) p = short.replace(/\\/g, '/');
    } catch { /* keep the long path */ }
  }
  return `node ${p} antigravity ${ev}`;
}
const isOurs = (h) => JSON.stringify(h || {}).includes(MARK);

function readJsonFile(file) {
  const text = readText(file);
  if (text === null || text.trim() === '') return { ok: true, data: {} };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/* Claude Code / Codex: { hooks: { Event: [ { matcher?, hooks: [handler] } ] } } */
function stripGroups(groups) {
  return (groups || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((g) => g.hooks.length);
}
function withClaudeLike(data, agent, home, events, add) {
  const out = { ...data, hooks: { ...(data.hooks || {}) } };
  for (const ev of Object.keys(out.hooks)) {
    out.hooks[ev] = stripGroups(out.hooks[ev]);
    if (!out.hooks[ev].length) delete out.hooks[ev];
  }
  if (add) {
    for (const [ev, ours] of Object.entries(events)) {
      const handler = agent === 'claude-code'
        ? { type: 'command', command: 'node', args: [hookPath(home), agent, ours], timeout: 15 }
        : { type: 'command', command: cmdString(home, agent, ours), timeout: 15, statusMessage: 'maxagent' };
      const matcher = { PreToolUse: '*', PostToolUse: 'mcp__maxagent-bridge__.*|Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell' }[ev];
      const group = matcher ? { matcher, hooks: [handler] } : { hooks: [handler] };
      out.hooks[ev] = [...(out.hooks[ev] || []), group];
    }
  }
  if (!Object.keys(out.hooks).length) delete out.hooks;
  return out;
}

/* Antigravity: { "<name>": { PreInvocation: [handler], PreToolUse: [ { matcher, hooks: [handler] } ] } } */
function withAntigravity(data, home, add) {
  const out = { ...data };
  delete out.maxagent;
  if (add) {
    out.maxagent = {
      enabled: true,
      PreInvocation: [{ type: 'command', command: agCmd(home, 'invocation'), timeout: 10 }],
      PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: agCmd(home, 'pretool'), timeout: 10 }] }],
      Stop: [{ type: 'command', command: agCmd(home, 'stop'), timeout: 15 }],
    };
  }
  return out;
}

function transform(agent, data, home, add) {
  if (agent === 'antigravity') return withAntigravity(data, home, add);
  return withClaudeLike(data, agent, home, HOOK_TARGETS[agent].events, add);
}

/** Register (add=true) or remove (add=false) our hooks for every connected agent that has a hook target. */
function applyHooks(cfg, home, w, add, msg) {
  if (add) {
    w.write(path.join(home, '.maxagent', 'hooks', HOOK_FILE), fs.readFileSync(path.join(PKG_ROOT, 'hooks', HOOK_FILE), 'utf8'), msg('hookScript'));
  }
  for (const agent of cfg.agents) {
    if (agent === 'openclaw') { applyOpenclaw(home, w, add, msg); continue; }
    if (agent === 'hermes') { applyHermes(home, w, add); continue; }
    const target = HOOK_TARGETS[agent];
    if (!target) {
      w.note(`${agent}: ${msg('hooksNotYet')}`);
      continue;
    }
    const file = target.file(home);
    const { ok, data } = readJsonFile(file);
    if (!ok) {
      w.note(`${agent}: ${msg('hooksBadJson')}: ${file}`);
      continue;
    }
    const existed = readText(file);
    const next = transform(agent, data, home, add);
    const text = JSON.stringify(next, null, 2) + '\n';
    if (existed !== null && existed.trim() && JSON.stringify(JSON.parse(existed)) === JSON.stringify(next)) continue;
    if (existed !== null && existed.trim() && !isOurs(data)) w.copyOnce(file, file + '.maxagent-backup', `${agent}: ${msg('backup')}`);
    if (!add && existed === null) continue;
    w.write(file, text, `${agent}: ${msg(add ? 'hooksAdded' : 'hooksRemoved')}`);
  }
}

/** For doctor: which of our events are registered for an agent. */
function registeredEvents(agent, home) {
  const target = HOOK_TARGETS[agent];
  if (!target) return null;
  if (agent === 'openclaw') {
    const files = OC_FILES.every((f) => fs.existsSync(path.join(ocDir(home), f)));
    return { bad: false, events: files && ocWired(home) ? ['plugin'] : [], want: ['plugin'] };
  }
  if (agent === 'hermes') return { bad: false, events: HM_FILES.every((f) => fs.existsSync(path.join(hmDir(home), f))) ? ['plugin'] : [], want: ['plugin'] };
  const { ok, data } = readJsonFile(target.file(home));
  if (!ok) return { bad: true, events: [] };
  const events = [];
  if (agent === 'antigravity') {
    const m = data.maxagent || {};
    for (const ev of Object.keys(target.events)) if (isOurs(m[ev])) events.push(ev);
  } else {
    for (const ev of Object.keys(target.events)) if (isOurs((data.hooks || {})[ev])) events.push(ev);
  }
  return { bad: false, events, want: Object.keys(target.events) };
}

module.exports = { HOOK_TARGETS, applyHooks, registeredEvents };
