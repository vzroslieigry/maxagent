#!/usr/bin/env node
'use strict';
// Guard for the open repository: fails when anything personal leaks into it —
// the owner's names and logins, home folders, private server names, personal e-mails, private IPs.
// Usage: node scripts/check-personal.js [folder ...]   (default: the whole repository)
// Exit code 1 = something found; every hit is printed as path:line: why — text.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SELF = path.resolve(__filename);

// The only allowed appearances of the GitHub owner name: this open repository (a link or the bare owner/name).
const REPO_URL = /((https?:\/\/)?(github\.com|raw\.githubusercontent\.com|api\.github\.com\/repos)\/)?vzroslieigry\/maxagent\b/gi;
const ALLOWED_MAIL = /@(example\.(com|org|net)|users\.noreply\.github\.com|noreply\.anthropic\.com)$|^(noreply|no-reply)@/i;

const RULES = [
  [/\bjeka\b|жек[аиеуой]\b/i, 'имя хозяина'],
  [/newla/i, 'имя пользователя Windows'],
  [/vzroslieigry/i, 'логин GitHub не в ссылке на репозиторий'],
  [/engivo|энгиво/i, 'название частного сервера'],
  // A real folder name after Users\ (placeholders like <you>, %USERNAME%, $USER, ... and Public/Default are fine).
  [/[A-Za-z]:[\\/]+Users[\\/]+(?!\.\.\.|(you|name|user|username|Public|Default|All Users)\b)[A-Za-z0-9_.-]/i, 'личная папка пользователя'],
  [/\/c\/Users\/(?!\.\.\.|(you|name|user|username|Public|Default)\b)[A-Za-z0-9_.-]/i, 'личная папка пользователя (Git Bash)'],
  [/\b100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/, 'адрес Tailscale'],
  [/administer@/i, 'учётная запись сервера'],
];
const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const SKIP_DIRS = new Set(['node_modules', '.git']);
const TEXT = /\.(js|mjs|cjs|json|md|txt|yml|yaml|html|css|ps1|py|sh|toml|cmd)$|^(LICENSE|gitignore|\.gitignore|\.npmignore)$/i;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(f, out); } else if (e.isFile() && TEXT.test(e.name) && path.resolve(f) !== SELF) out.push(f);
  }
  return out;
}

function scanText(text, where, hits) {
  text.split(/\r?\n/).forEach((line, i) => {
    const clean = line.replace(REPO_URL, '<repo>');
    for (const [rx, why] of RULES) if (rx.test(clean)) hits.push({ where: `${where}:${i + 1}`, why, text: line.trim().slice(0, 160) });
    for (const m of clean.match(MAIL) || []) if (!ALLOWED_MAIL.test(m) && !/\.(png|jpg|svg|js|json)$/i.test(m)) hits.push({ where: `${where}:${i + 1}`, why: 'адрес почты', text: m });
  });
}

const dirs = process.argv.slice(2).length ? process.argv.slice(2).map((d) => path.resolve(d)) : [ROOT];
const hits = [];
for (const d of dirs) {
  for (const f of fs.statSync(d).isDirectory() ? walk(d) : [d]) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const text = fs.readFileSync(f, 'utf8');
    // A pack bundle: check the atom texts, not the base64 vectors.
    if (/packs\/dist\/.+\.json$/.test(rel)) {
      try { for (const [name, body] of Object.entries(JSON.parse(text).files || {})) scanText(body, `${rel}#${name}`, hits); continue; } catch { /* not a bundle — scan as text */ }
    }
    scanText(text, rel, hits);
  }
}

for (const h of hits) console.log(`${h.where}: ${h.why} — ${h.text}`);
if (hits.length) {
  const byTop = {};
  for (const h of hits) { const k = h.where.split('/').slice(0, 2).join('/'); byTop[k] = (byTop[k] || 0) + 1; }
  console.log(`\nнайдено личного: ${hits.length} (${Object.entries(byTop).map(([k, n]) => `${k}: ${n}`).join(', ')})`);
  process.exitCode = 1;
} else {
  console.log('личного не найдено');
}
