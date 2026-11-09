#!/usr/bin/env node
'use strict';
// Experience index builder: headers of experience/**/*.md → table in experience.md between the index:auto markers.
//   node experience-index.js [workspace] [--check] [--lang ru|en]
// Without a workspace argument it reads ~/.maxagent/config.json (this file lives in ~/.maxagent/tools/).
// --check: write nothing; exit 1 if the index is stale or a file has no header.
// Row format: | title: aliases | task | [name](experience/<path>.md) | verified | — the maxagent hook reads it.
// Skipped: files whose name starts with "_" (templates) and README.md (folder descriptions).

const fs = require('fs');
const path = require('path');

const START = '<!-- index:auto:start -->';
const END = '<!-- index:auto:end -->';
const TXT = {
  ru: {
    head: '| Вещь: синонимы | Когда читать | Файл | Проверено |',
    noHeader: (f) => `нет шапки (title, task, aliases): ${f}`,
    stale: 'индекс устарел — соберите его заново',
    built: (n, bad) => `индекс собран, файлов в нём: ${n}${bad ? `; без шапки: ${bad}` : ''}`,
    checked: (n) => `файлов в индексе: ${n}`,
    noWs: 'не задана рабочая папка (аргумент или ~/.maxagent/config.json)',
  },
  en: {
    head: '| Thing: synonyms | When to read | File | Verified |',
    noHeader: (f) => `no header (title, task, aliases): ${f}`,
    stale: 'the index is stale — rebuild it',
    built: (n, bad) => `index built: ${n} files${bad ? `, without a header: ${bad}` : ''}`,
    checked: (n) => `files in the index: ${n}`,
    noWs: 'no workspace (argument or ~/.maxagent/config.json)',
  },
};

function walk(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.md') && !e.name.startsWith('_') && e.name !== 'README.md') out.push(p);
  }
  return out;
}

function header(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const h = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) h[kv[1]] = kv[2].trim();
  }
  return h;
}

const cell = (s) => String(s || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

/** Build the table for a workspace. Returns { table, rows, problems }. */
function build(workspace, lang = 'en') {
  const L = TXT[lang] || TXT.en;
  const rows = [];
  const problems = [];
  const files = walk(path.join(workspace, 'experience')).map((f) => path.relative(workspace, f).replace(/\\/g, '/')).sort();
  for (const rel of files) {
    const h = header(fs.readFileSync(path.join(workspace, rel), 'utf8'));
    if (!h || !h.title || !h.task || !h.aliases) { problems.push(L.noHeader(rel)); continue; }
    const name = rel.replace(/^experience\//, '').replace(/\.md$/, '');
    rows.push(`| ${cell(h.title)}: ${cell(h.aliases)} | ${cell(h.task)} | [${name}](${rel}) | ${cell(h.verified)} |`);
  }
  return { table: [L.head, '|---|---|---|---|', ...rows].join('\n'), rows, problems };
}

/** Text of experience.md with the auto section replaced (or appended when the markers are missing). */
function withIndex(text, table) {
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  const body = START + eol + table.replace(/\n/g, eol) + eol + END;
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a >= 0 && b > a) return text.slice(0, a) + body + text.slice(b + END.length);
  return text + (text.endsWith('\n') || !text ? '' : eol) + eol + body + eol;
}

/** Build and write (or check). Returns { code, lines }. */
function run(workspace, { check = false, lang = 'en' } = {}) {
  const L = TXT[lang] || TXT.en;
  const index = path.join(workspace, 'experience.md');
  const { table, rows, problems } = build(workspace, lang);
  const text = fs.existsSync(index) ? fs.readFileSync(index, 'utf8') : '';
  const next = withIndex(text, table);
  const lines = problems.map((p) => `ERROR: ${p}`);
  if (check) {
    if (next !== text) lines.push(`ERROR: ${L.stale}`);
    lines.push(L.checked(rows.length));
    return { code: next !== text || problems.length ? 1 : 0, lines };
  }
  if (next !== text) fs.writeFileSync(index, next, 'utf8');
  lines.push(L.built(rows.length, problems.length));
  return { code: problems.length ? 1 : 0, lines };
}

module.exports = { build, withIndex, run, START, END };

if (require.main === module) {
  const args = process.argv.slice(2);
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')); } catch { /* not installed */ }
  const li = args.indexOf('--lang');
  const lang = li >= 0 ? args[li + 1] : cfg.lang || 'en';
  const ws = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--lang') || cfg.workspace;
  if (!ws) {
    console.log(`ERROR: ${(TXT[lang] || TXT.en).noWs}`);
    process.exit(1);
  }
  const r = run(path.resolve(ws), { check: args.includes('--check'), lang });
  for (const l of r.lines) console.log(l);
  process.exit(r.code);
}
