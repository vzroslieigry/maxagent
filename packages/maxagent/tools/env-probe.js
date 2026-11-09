#!/usr/bin/env node
'use strict';
// Environment card: facts about this computer → experience/platform/environment.md between the env:auto markers
// (anything written around them by hand is kept). So the agent does not guess every time which shell it has,
// whether Python exists or whether it is an administrator.
//   node env-probe.js [workspace] [--print] [--lang ru|en]
// Without a workspace argument it reads ~/.maxagent/config.json (this file lives in ~/.maxagent/tools/).
// The first bullet "Summary" is what the maxagent hook shows at session start.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const START = '<!-- env:auto:start -->';
const END = '<!-- env:auto:end -->';
const WIN = process.platform === 'win32';

const TXT = {
  ru: {
    summary: 'Кратко', os: 'ОС', admin: 'Права администратора у агента', yesAdmin: 'да', noAdmin: 'нет — команды, требующие администратора, не пройдут: не ломиться, сказать хозяину',
    shells: 'Оболочки', none: 'нет', notFound: 'не найден', built: (d) => `Собрано \`node ~/.maxagent/tools/env-probe.js\` ${d}. Что-то поменялось на компьютере — запустить снова.`,
    psNote: 'Windows PowerShell 5.1: нет `&&` и `||` (цепочка — `A; if ($?) { B }`), пустой аргумент `""` программе не передаётся, конвейер добавляет BOM в начало строки',
    written: (n, f) => `окружение записано: ${n} строк → ${f}`, admin1: 'админ',
  },
  en: {
    summary: 'Summary', os: 'OS', admin: 'Agent has administrator rights', yesAdmin: 'yes', noAdmin: 'no — commands that need an administrator will fail: don\'t force it, tell the owner',
    shells: 'Shells', none: 'none', notFound: 'not found', built: (d) => `Built by \`node ~/.maxagent/tools/env-probe.js\` on ${d}. Something changed on the computer — run it again.`,
    psNote: 'Windows PowerShell 5.1: no `&&` or `||` (chain with `A; if ($?) { B }`), an empty argument `""` is not passed to programs, a pipe adds a BOM at the start of a string',
    written: (n, f) => `environment written: ${n} lines → ${f}`, admin1: 'admin',
  },
};

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 8000, windowsHide: true, ...opts });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || r.stderr || '').trim();
}
const first = (s) => (s ? s.split(/\r?\n/)[0].trim() : null);
const which = (exe) => {
  const r = WIN ? run('where.exe', [exe]) : run('sh', ['-c', `command -v ${exe}`]);
  return r ? r.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
};
// PowerShell output is not UTF-8 by default — switch it explicitly.
const ps = (expr) => first(run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${expr}`]));
// Node refuses to start .cmd files without a shell (EINVAL) — npm and similar go through the shell.
const viaShell = (line) => first(run(line, [], { shell: true }));
const version = (exe, args = ['--version']) => (which(exe).length ? first(run(exe, args)) || first(viaShell(`${exe} ${args.join(' ')}`)) : null);

function probe(lang) {
  const L = TXT[lang] || TXT.en;
  const f = [];
  const add = (k, v) => f.push(`- **${k}:** ${v}`);

  const osName = WIN ? ps('(Get-CimInstance Win32_OperatingSystem).Caption') || 'Windows'
    : process.platform === 'darwin' ? `macOS ${first(run('sw_vers', ['-productVersion'])) || ''}`.trim()
      : first(run('sh', ['-c', '. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"'])) || 'Linux';
  const admin = WIN ? run('net.exe', ['session']) !== null : (process.getuid && process.getuid() === 0);

  const shells = [];
  let winPs = null;
  if (WIN) {
    winPs = ps('$PSVersionTable.PSVersion.ToString()');
    if (winPs) shells.push(`Windows PowerShell ${winPs}`);
    const pwsh = which('pwsh');
    if (pwsh.length) shells.push(`PowerShell 7 (${first(run('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'])) || '?'})`);
    const gitBash = ['C:\\Program Files\\Git\\bin\\bash.exe'].find((p) => fs.existsSync(p));
    if (gitBash) shells.push('Git Bash');
    shells.push('cmd');
  } else {
    for (const s of ['bash', 'zsh', 'fish']) if (which(s).length) shells.push(s);
  }
  const python = version(WIN ? 'python' : 'python3') || (WIN ? first(run('py', ['--version'])) : null);
  const node = first(run('node', ['--version']));
  const npm = viaShell('npm --version');
  const git = version('git');

  add(L.summary, [
    `${osName} (${os.arch()})`,
    `${L.shells.toLowerCase()}: ${shells.join(', ') || L.none}`,
    `${L.admin1}: ${admin ? L.yesAdmin : L.none}`,
    `Python ${python ? python.replace(/^Python\s*/i, '') : L.none}`,
    `Node ${node || L.none}`,
  ].join('; '));
  add(L.os, `${osName} (${os.release()}), ${os.arch()}, ${os.userInfo().username}`);
  add(L.admin, admin ? L.yesAdmin : L.noAdmin);
  add(L.shells, shells.join(', ') || L.none);
  if (winPs && winPs.startsWith('5.')) f.push(`  - ${L.psNote}`);
  add('git', git || L.none);
  add('Python', python || L.none);
  add('Node / npm', `${node || L.none} / ${npm || L.none}`);
  for (const [name, exe] of [['GitHub CLI (gh)', 'gh'], ['ffmpeg', 'ffmpeg'], ['Docker', 'docker'], [WIN ? 'winget' : 'brew', WIN ? 'winget' : 'brew'], ['ssh', 'ssh']]) {
    const w = which(exe);
    add(name, w.length ? w[0] : L.none);
  }
  const chrome = (WIN
    ? [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean).map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']).find((p) => fs.existsSync(p));
  add('Chrome', chrome || L.notFound);
  return f;
}

/** Write the card. Returns { code, line }. */
function write(workspace, lang = 'en') {
  const L = TXT[lang] || TXT.en;
  const card = path.join(workspace, 'experience', 'platform', 'environment.md');
  const lines = probe(lang);
  const block = [L.built(new Date().toLocaleDateString('sv-SE')), '', ...lines].join('\n');
  let text = '';
  try { text = fs.readFileSync(card, 'utf8'); } catch { /* created below */ }
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  const body = `${START}\n${block}\n${END}`;
  const next = a >= 0 && b > a ? text.slice(0, a) + body + text.slice(b + END.length) : text + (text ? '\n\n' : '') + body + '\n';
  fs.mkdirSync(path.dirname(card), { recursive: true });
  fs.writeFileSync(card, next, 'utf8');
  return { code: 0, line: L.written(lines.length, card) };
}

module.exports = { probe, write, START, END };

if (require.main === module) {
  const args = process.argv.slice(2);
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')); } catch { /* not installed */ }
  const li = args.indexOf('--lang');
  const lang = li >= 0 ? args[li + 1] : cfg.lang || 'en';
  if (args.includes('--print')) {
    console.log(probe(lang).join('\n'));
    process.exit(0);
  }
  const ws = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--lang') || cfg.workspace;
  if (!ws) { console.log('ERROR: no workspace'); process.exit(1); }
  console.log(write(path.resolve(ws), lang).line);
}
