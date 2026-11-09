#!/usr/bin/env node
'use strict';
// maxagent — the personal shelf of skills: <experience>/skills/<agent>.md, built from the SKILL.md files of every agent.
//   node experience-skills.js scan      rebuild the shelf (runs once a day from update-check.js)
//   node experience-skills.js missing   skills with no phrases in the owner's language yet
// Skill descriptions are mostly English, so a request in another language finds them poorly: the agent adds phrases
// once to <experience>/skills/_when.json ({"<agent>:<skill>": "фраза · фраза"}); a rescan keeps them.
// The shelf is personal: it is never shared and never stops a command, it only reminds that a skill exists.
const fs = require('fs');
const path = require('path');
const os = require('os');
const eng = require('./experience-engine.js');

const HOME = process.env.MAXAGENT_SKILLS_HOME || os.homedir();
const LOCAL = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
const SOURCES = [
  { agent: 'codex', title: 'Codex', dir: path.join(HOME, '.codex', 'skills') },
  { agent: 'agents', title: 'Agents', dir: path.join(HOME, '.agents', 'skills') },
  { agent: 'claude-code', title: 'Claude Code', dir: path.join(HOME, '.claude', 'skills') },
  { agent: 'claude-plugins', title: 'Claude Code', dir: path.join(HOME, '.claude', 'plugins', 'marketplaces'), plugins: true },
  { agent: 'antigravity', title: 'Antigravity', dir: path.join(HOME, '.gemini', 'antigravity', 'builtin', 'skills') },
  { agent: 'antigravity-user', title: 'Antigravity', dir: path.join(HOME, '.gemini', 'antigravity', 'skills') },
  { agent: 'openclaw', title: 'OpenClaw', dir: process.platform === 'win32' ? 'C:\\openclaw\\skills' : path.join(HOME, 'openclaw', 'skills') },
  { agent: 'hermes', title: 'Hermes', dir: path.join(HOME, '.hermes', 'skills') },
  { agent: 'hermes', title: 'Hermes', dir: path.join(LOCAL, 'hermes', 'skills') },
];
const SKIP = new Set(['node_modules', '.git', '__pycache__', 'scripts', 'references', 'assets']);
const OS_NAME = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform];
const MAX_DESC = 260;

function findSkills(dir, depth = 0, out = []) {
  let list;
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  if (list.some((e) => e.isFile() && e.name === 'SKILL.md')) { out.push(path.join(dir, 'SKILL.md')); return out; }
  if (depth < 7) for (const e of list) if (e.isDirectory() && !SKIP.has(e.name)) findSkills(path.join(dir, e.name), depth + 1, out);
  return out;
}

/** name / description / platforms from the YAML header; folded (>-) and quoted values included. */
function readSkill(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const lines = m ? m[1].split('\n') : [];
  const value = (key) => {
    const i = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (i < 0) return '';
    let v = lines[i].slice(key.length + 1).trim();
    if (/^[>|][+-]?$/.test(v)) {
      v = '';
      for (let j = i + 1; j < lines.length && /^\s+\S|^\s*$/.test(lines[j]); j++) v += ` ${lines[j].trim()}`;
    }
    return v.trim().replace(/^["']|["']$/g, '');
  };
  return { name: value('name') || path.basename(path.dirname(file)), description: value('description').replace(/\s+/g, ' '), platforms: value('platforms').replace(/[[\]\s]/g, '').split(',').filter(Boolean) };
}

const homeRel = (p) => (p.startsWith(HOME) ? `~${p.slice(HOME.length)}` : p).replace(/\\/g, '/');
const clean = (s) => String(s).replace(/[·\r\n]/g, ' ').replace(/`/g, "'").replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);

function enabledPlugins() {
  try { return Object.keys(JSON.parse(fs.readFileSync(path.join(HOME, '.claude', 'settings.json'), 'utf8')).enabledPlugins || {}).map((k) => k.split('@')[0]); } catch { return []; }
}

function collect() {
  const enabled = enabledPlugins();
  const seen = new Set();
  const out = [];
  for (const src of SOURCES) {
    for (const file of findSkills(src.dir)) {
      const s = readSkill(file);
      if (s.platforms.length && OS_NAME && !s.platforms.includes(OS_NAME)) continue; // not for this system
      let plugin = '', off = false;
      if (src.plugins) {
        const m = homeRel(file).match(/\/(?:external_)?plugins\/([^/]+)\/skills\//);
        plugin = m ? m[1] : '';
        off = !enabled.includes(plugin);
      }
      const key = `${src.agent}:${plugin ? `${plugin}/` : ''}${s.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, ...s, plugin, off, title: src.title, agent: src.agent, file: homeRel(file) });
    }
  }
  return out;
}

const T = {
  ru: { skill: 'Скил', plugin: 'Плагин', off: 'не включён', ask: 'Плагин есть в каталоге, но не включён; включается только по слову хозяина.', read: 'Это текст: у скила другого агента его тоже можно прочитать.', src: 'установленные скилы, собрано автоматически', title: 'Скилы', word: 'скил', file: 'Файл' },
  en: { skill: 'Skill', plugin: 'Plugin', off: 'not enabled', ask: 'The plugin is in the catalog but not enabled; it is enabled only on the owner\'s word.', read: "It is plain text: another agent's skill can be read too.", src: 'installed skills, collected automatically', title: 'Skills', word: 'skill', file: 'File' },
};

function atom(s, when, t) {
  const label = s.plugin ? `${s.plugin}/${s.name}` : s.name;
  const head = `${s.plugin ? t.plugin : t.skill} ${label} (${s.title}${s.off ? `, ${t.off}` : ''})`;
  const desc = cut(clean(s.description) || label, MAX_DESC);
  // Own phrases first; the field has a limit, so what does not fit is dropped.
  const triggers = [...when.split(/\s*·\s*/), `${t.word} ${label}`, cut(clean(s.description.split(/(?<=[.!?])\s/)[0] || ''), 100)].filter(Boolean)
    .reduce((acc, p) => ([...acc, p].join(' · ').length <= 195 ? [...acc, p] : acc), []).join(' · ');
  return [`### ${head}`, `- когда: ${triggers}`, `- вещь: ${t.word} · ${s.title} · ${label}`, `1. ${desc}`, `2. ${t.file}: \`${s.file}\`. ${s.off ? t.ask : t.read}`, `- источник: ${t.src}`].join('\n');
}

const whenFile = (root) => path.join(root, 'skills', '_when.json');
const readWhen = (root) => { try { return JSON.parse(fs.readFileSync(whenFile(root), 'utf8')); } catch { return {}; } };

function scan(root = eng.libraryRoot()) {
  if (!root) return 0;
  const t = T[eng.config().lang] || T.en;
  const when = readWhen(root);
  const dir = path.join(root, 'skills');
  fs.mkdirSync(dir, { recursive: true });
  const groups = {};
  for (const s of collect()) (groups[s.agent] = groups[s.agent] || []).push(s);
  let n = 0;
  const ours = new Set(SOURCES.map((s) => `${s.agent}.md`));
  for (const f of fs.readdirSync(dir)) if (ours.has(f) && !groups[f.slice(0, -3)]) fs.unlinkSync(path.join(dir, f)); // only the files this tool generates
  for (const [agent, list] of Object.entries(groups)) {
    list.sort((a, b) => a.key.localeCompare(b.key));
    const atoms = list.map((s) => atom(s, when[s.key] ? clean(when[s.key].replace(/·/g, '\u0001')).replace(/\u0001/g, '·') : '', t));
    n += atoms.length;
    const head = `---\ntitle: ${t.title} — ${list[0].title}\naliases: ${t.word}, skill, SKILL.md, ${list[0].title}\n---\n\n`;
    const body = `${head}${atoms.join('\n\n')}\n`;
    const file = path.join(dir, `${agent}.md`);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) fs.writeFileSync(file, body);
  }
  return n;
}

function missing(root = eng.libraryRoot()) {
  const when = readWhen(root);
  return collect().filter((s) => !s.off && !when[s.key]);
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'scan') console.log(`skills: ${scan()}`);
  else if (cmd === 'missing') for (const s of missing()) console.log(`${s.key}\t${cut(clean(s.description), 200)}`);
  else { console.log('node experience-skills.js scan | missing'); process.exitCode = 2; }
}

module.exports = { scan, missing, collect, readSkill };
