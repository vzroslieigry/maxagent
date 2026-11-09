#!/usr/bin/env node
'use strict';
// maxagent — shared experience packs (the second shelf): download, mute, adopt, build.
//   node experience-packs.js list                 — installed packs and the catalog
//   node experience-packs.js add <pack>|all       — download, check sha256 and content, put into <experience>/shared/<pack>/
//   node experience-packs.js update               — newer versions of installed packs
//   node experience-packs.js mute|unmute <pack>   — stop / resume showing a pack
//   node experience-packs.js adopt "<id>"         — a shared atom proved useful → copy into own experience
//   node experience-packs.js build <dir> --name <pack> --version <v> [--out <file>] — make a pack bundle (for maintainers / CI)
// A pack bundle is one JSON file: {name, version, model, revision, files:{rel: text}, vectors:{h: int8 base64}}.
// Vectors are computed by the maintainer with the same model and revision, so users never compute them.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const eng = require('./experience-engine.js');

const HOME_ROOT = path.resolve(__dirname, '..');
const CATALOG = process.env.MAXAGENT_PACKS_CATALOG || eng.config().packsCatalog || 'https://raw.githubusercontent.com/vzroslieigry/maxagent/main/packs/catalog.json';
const MODEL = 'Xenova/multilingual-e5-small';
const MAX_BYTES = 300 * 1024 * 1024;
const out = (s) => process.stdout.write(s + '\n');

/* ---------- content check: text that would steer an agent somewhere it should not go ---------- */

const RISKS = [
  [/(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n|]*\|\s*(sh|bash|iex|Invoke-Expression|python|node|pwsh|powershell)\b/i, 'скачать и сразу выполнить'],
  [/ignore (all |any )?(previous|prior|above) (instructions|rules)|игнорируй (все )?(прежние|предыдущие|эти) (указания|правила|инструкции)|you are now |ты теперь /i, 'попытка переписать правила агента'],
  [/(отправ|перешл|загрузи)\S*[^\n]{0,60}(ключ|токен|парол|cookie|\.ssh|историю переписки)|(send|upload|post)[^\n]{0,60}(token|api key|password|cookie|\.ssh)/i, 'отправить секреты или переписку'],
  [/\brm\s+-rf\s+(\/|~|\$HOME)(\s|$)|Remove-Item[^\n]*-Recurse[^\n]*\s[A-Za-z]:\\?(\s|$)|\bformat\s+[a-z]:/i, 'уничтожающая команда'],
  [/[​-‏‪-‮⁠﻿]/, 'скрытые символы'],
];
function scan(text) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => { for (const [rx, why] of RISKS) if (rx.test(line)) hits.push({ line: i + 1, why, text: line.trim().slice(0, 120) }); });
  return hits;
}

/* ---------- net ---------- */

function get(url, { max = MAX_BYTES, redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'maxagent' }, timeout: 30000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), { max, redirects: redirects - 1 }));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}: ${url}`)); }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => { size += c.length; if (size > max) { req.destroy(); reject(new Error('слишком большой файл')); } else chunks.push(c); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error('тайм-аут')));
    req.on('error', reject);
  });
}

/* ---------- install ---------- */

function sharedDir(root = eng.libraryRoot()) { return path.join(root, 'shared'); }

function installBundle(buf, entry, root = eng.libraryRoot()) {
  if (entry.sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== entry.sha256) throw new Error(`контрольная сумма не сошлась: ${entry.name}`);
  const b = JSON.parse(buf.toString('utf8'));
  if (!b.name || !/^[a-z0-9-]+$/.test(b.name) || !b.files) throw new Error('это не набор опыта');
  const risky = [];
  for (const [rel, text] of Object.entries(b.files)) {
    if (!/^[\w./-]+\.md$/.test(rel) || rel.includes('..')) throw new Error(`недопустимое имя файла в наборе: ${rel}`);
    for (const h of scan(text)) risky.push(`${rel}:${h.line} — ${h.why}: ${h.text}`);
  }
  if (risky.length) throw new Error(`набор не принят — в нём опасный текст:\n${risky.slice(0, 10).join('\n')}`);
  const dir = path.join(sharedDir(root), b.name);
  const tmp = `${dir}.new-${process.pid}`;
  fs.mkdirSync(tmp, { recursive: true });
  for (const [rel, text] of Object.entries(b.files)) {
    const f = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  fs.writeFileSync(path.join(tmp, 'pack.json'), JSON.stringify({ name: b.name, version: b.version, model: b.model, revision: b.revision, title: b.title || entry.title || null, installedAt: new Date().toISOString() }, null, 2));
  if (b.vectors) fs.writeFileSync(path.join(tmp, 'vectors.json'), JSON.stringify({ model: b.model, revision: b.revision, vec: b.vectors }));
  // Replace the old version only when the new one is fully written; the old goes aside (not deleted), out of
  // experience/shared — a copy left there was searched as a second pack (08.11.2026).
  if (fs.existsSync(dir)) {
    const aside = path.join(eng.stateDir(), 'packs-old', `${b.name}-${Date.now()}`);
    fs.mkdirSync(path.dirname(aside), { recursive: true });
    try { fs.renameSync(dir, aside); } catch { fs.cpSync(dir, aside, { recursive: true }); fs.rmSync(dir, { recursive: true, force: true }); }
  }
  fs.renameSync(tmp, dir);
  return { name: b.name, version: b.version, files: Object.keys(b.files).length, vectors: Object.keys(b.vectors || {}).length };
}

async function catalog() { return JSON.parse((await get(CATALOG, { max: 5 * 1024 * 1024 })).toString('utf8')); }

async function add(names) {
  const cat = await catalog();
  const want = names.includes('all') ? cat.packs : cat.packs.filter((p) => names.includes(p.name));
  if (!want.length) { out(`нет таких наборов. Есть: ${cat.packs.map((p) => p.name).join(', ')}`); return 1; }
  for (const p of want) {
    out(`${p.name} v${p.version} (${Math.round((p.size || 0) / 1024)} КБ) — скачиваю…`);
    const r = installBundle(await get(p.url), p);
    out(`  установлен: ${r.files} файлов, готовых векторов ${r.vectors}`);
  }
  return 0;
}

async function update() {
  const cat = await catalog();
  const have = eng.sharedPacks();
  let n = 0;
  for (const h of have) {
    const p = cat.packs.find((x) => x.name === h.name);
    if (!p || p.version === h.meta.version) continue;
    out(`${p.name}: ${h.meta.version} → ${p.version}`);
    installBundle(await get(p.url), p);
    n++;
  }
  out(n ? `обновлено наборов: ${n}` : 'все наборы свежие');
  return 0;
}

function list() {
  const have = eng.sharedPacks();
  if (!have.length) out('общих наборов нет. Поставить: node ~/.maxagent/tools/experience-packs.js add all');
  for (const p of have) out(`${p.name} v${p.meta.version}${p.muted ? ' (приглушён)' : ''}`);
  return 0;
}

function mute(name, on) {
  const file = path.join(HOME_ROOT, 'config.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const set = new Set(cfg.sharedMuted || []);
  if (on) set.add(name); else set.delete(name);
  cfg.sharedMuted = [...set];
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  out(on ? `набор «${name}» приглушён` : `набор «${name}» снова показывается`);
  return 0;
}

/* ---------- adopt: a shared atom proved useful → own copy, the shared one is hidden from then on ---------- */

function adopt(id, root = eng.libraryRoot()) {
  const idx = eng.buildShared(root);
  const a = idx.atoms.find((x) => x.id === id);
  if (!a) { out(`нет такого общего атома: ${id}`); return 1; }
  const meta = (eng.sharedPacks(root).find((p) => p.name === a.pack) || {}).meta || {};
  const relInPack = a.file.split('/').slice(3).join('/');
  const target = path.join(root, relInPack);
  const date = new Date().toLocaleDateString('ru-RU');
  const note = `из общего набора ${a.pack} v${meta.version || '?'}, проверено у нас ${date} (общий: ${id})`;
  const text = a.text.split('\n').map((l) => (/^- источник:/.test(l) ? `- источник: ${note}` : l)).join('\n');
  const withSource = /^- источник:/m.test(text) ? text : `${text}\n- источник: ${note}`;
  if (fs.existsSync(target)) {
    fs.appendFileSync(target, `\n\n${withSource}\n`);
  } else {
    const src = fs.readFileSync(path.join(root, ...a.file.split('/').slice(1)), 'utf8');
    const head = (src.match(/^---\r?\n[\s\S]*?\r?\n---/) || [`---\ntitle: ${a.title}\naliases: ${a.title}\n---`])[0];
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${head}\n\n${withSource}\n`);
  }
  const errs = eng.lint(fs.readFileSync(target, 'utf8'), path.basename(target));
  out(`сохранено своим: ${path.relative(path.dirname(root), target).replace(/\\/g, '/')} — «${a.head}»`);
  if (errs.length) out(`проверь формат: ${errs.slice(0, 5).map((e) => `строка ${e.line}: ${e.code} ${e.msg}`).join('; ')}`);
  return 0;
}

/* ---------- build: a pack bundle with ready vectors (maintainers, CI) ---------- */

async function build(dir, name, version, outFile) {
  // The warm background model process does all atoms; a one-off process would do only a first part.
  for (let i = 0; i < 40 && !(await eng.queryVector('проверка', 3000)); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!/^[a-z0-9-]+$/.test(name || '')) { out('--name: латиница, цифры, дефис'); return 2; }
  const files = eng.walk(path.resolve(dir)).sort();
  const bundle = { name, version, model: MODEL, revision: '761b726dd34fb83930e26aab4e9ac3899aa1fa78', files: {}, vectors: {} };
  let bad = 0;
  const passages = [];
  for (const f of files) {
    const rel = path.relative(path.resolve(dir), f).replace(/\\/g, '/');
    const text = fs.readFileSync(f, 'utf8');
    for (const e of eng.lint(text, path.basename(f))) { out(`${rel}:${e.line}: ${e.code} ${e.msg}`); bad++; }
    for (const h of scan(text)) { out(`${rel}:${h.line}: ОПАСНО — ${h.why}: ${h.text}`); bad++; }
    bundle.files[rel] = text;
    const parsed = eng.parse(text);
    const title = (parsed.h && parsed.h.title) || path.basename(f, '.md');
    for (const a of parsed.atoms) passages.push(eng.passageOf(a, title));
  }
  if (bad) { out(`набор не собран: замечаний ${bad}`); return 1; }
  for (let i = 0; i < passages.length; i += 200) {
    const part = passages.slice(i, i + 200);
    const v = eng.embedPassages(part);
    if (!v || v.length !== part.length || v.some((x) => !x)) { out('векторы не посчитались целиком — нужна модель (~/.maxagent/vector) и её фоновый процесс; набор без векторов не выпускается'); return 1; }
    part.forEach((p, j) => { bundle.vectors[eng.hashOf(p)] = Buffer.from(Int8Array.from(v[j], (x) => Math.max(-127, Math.min(127, Math.round(x * 127)))).buffer).toString('base64'); });
  }
  const json = JSON.stringify(bundle);
  const file = outFile || `${name}-${version}.json`;
  fs.writeFileSync(file, json);
  out(`собран ${file}: файлов ${files.length}, атомов ${passages.length}, ${Math.round(json.length / 1024)} КБ, sha256 ${crypto.createHash('sha256').update(json).digest('hex')}`);
  return 0;
}

/* ---------- share: prepare own experience for the shared library (nothing is sent anywhere) ---------- */

/** Things that identify the person or their machine. On top of the lint's secrets check. */
function personalHits(text) {
  const os = require('os');
  const me = [];
  try { me.push(os.userInfo().username); } catch { /* unknown */ }
  me.push(os.hostname());
  const words = me.filter((w) => w && w.length >= 3 && !/^(user|admin|root|home|runner)$/i.test(w));
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = [
    [/[A-Za-z]:[\\/]+Users[\\/]+(?!\.\.\.|<|%|(you|name|user|username|Public|Default|All Users)\b)[\w.-]/i, 'личная папка'],
    [/(^|[\s`"'(])\/(home|Users)\/(?!\.\.\.|<|\$|(you|name|user|username|Shared)\b)[\w.-]/, 'личная папка'],
    [/[\w.%+-]+@(?!example\.|users\.noreply\.github\.com)[\w-]+\.[A-Za-z]{2,}/, 'адрес почты'],
    [/\b(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})\b/, 'адрес внутренней сети'],
    ...words.map((w) => [new RegExp(`(^|[^\\p{L}\\d])${esc(w)}($|[^\\p{L}\\d])`, 'iu'), 'имя пользователя или компьютера']),
  ];
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => { for (const [rx, why] of rules) if (rx.test(line)) hits.push({ line: i + 1, why, text: line.trim().slice(0, 120) }); });
  return hits;
}

// Never shared: habits of the owner, specific projects, how answers are handed to the owner, other people's packs.
const SHARE_SKIP = new Set(['owner', 'projects', 'answer', 'shared']);
// What belongs to this person's work rather than to the tool: the agent rewrites such an atom or leaves it out.
const SITUATIONAL = [
  [/(^|[\s`"'(])projects[\\/][\w.-]+/i, 'файл личного проекта'],
  [/правил\S* хозяина|owner's rule|выпуск\S*\s+\d+|episode\s+\d+/i, 'привязка к своей работе'],
];

function atomHits(text, words) {
  const out = [...personalHits(text)];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const [rx, why] of SITUATIONAL) if (rx.test(line)) out.push({ line: i + 1, why, text: line.trim().slice(0, 120) });
    for (const w of words) if (line.toLowerCase().includes(w)) out.push({ line: i + 1, why: 'слово из privateWords', text: line.trim().slice(0, 120) });
  });
  return out;
}

/** "источник" can carry anything from one's own work: keep only that it is experience and the year. */
function neutralSource(atomText) {
  return atomText.replace(/^- источник:.*$/m, (line) => {
    const y = line.match(/\b20\d{2}\b/);
    return `- источник: опыт пользователя maxagent, ${y ? y[0] : new Date().getFullYear()}`;
  });
}

const header = (h) => ['---', ...Object.entries(h).map(([k, v]) => `${k}: ${v}`), '---', ''].join('\n');

/**
 * share <folder> --name <pack> [--version 1.0.0] [--title "…"] [--out <folder>]
 * Sorts atoms one by one: fit as they are / need rewriting by the agent / never shared. Writes a draft of the first
 * two groups and SHARE-REPORT.md; nothing is sent anywhere. Then the agent rewrites and runs share --check.
 */
function share(dir, { name, version = '1.0.0', title, outDir } = {}) {
  if (!dir || !fs.existsSync(dir)) { out('укажите папку с атомами опыта'); return 2; }
  if (!/^[a-z0-9-]+$/.test(name || '')) { out('--name: латиница в нижнем регистре, цифры, дефис'); return 2; }
  if (!/^\d+\.\d+\.\d+$/.test(version)) { out('--version: вида 1.0.0'); return 2; }
  const root = path.resolve(dir);
  const words = (eng.config().privateWords || []).map((w) => String(w).toLowerCase()).filter(Boolean);
  const res = { ok: [], rewrite: [], no: [] };
  const draft = {};
  for (const f of eng.walk(root, [], SHARE_SKIP).sort()) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (rel.split('/').some((p) => SHARE_SKIP.has(p))) continue;
    const parsed = eng.parse(fs.readFileSync(f, 'utf8'));
    if (/^(no|нет|false)$/i.test(String(parsed.h.share || ''))) { res.no.push({ rel, head: '(весь файл)', why: 'share: no' }); continue; }
    for (const a of parsed.atoms) {
      const text = neutralSource(a.text);
      const danger = scan(text);
      const secret = eng.lint(header({ title: 'x' }) + '\n' + text, path.basename(f)).filter((e) => e.code === 'E040');
      if (danger.length || secret.length) { res.no.push({ rel, head: a.head, why: danger.length ? danger[0].why : 'похоже на секрет' }); continue; }
      const hits = atomHits(text, words);
      (hits.length ? res.rewrite : res.ok).push({ rel, head: a.head, hits });
      (draft[rel] = draft[rel] || { h: parsed.h, atoms: [] }).atoms.push(text);
    }
  }
  if (!res.ok.length && !res.rewrite.length) { out('подходящих атомов нет'); return 1; }
  const base = path.resolve(outDir || `maxagent-pack-${name}`);
  const target = path.join(base, 'packs', 'src', name);
  if (fs.existsSync(target)) { out(`папка уже есть: ${target}`); return 2; }
  for (const [rel, d] of Object.entries(draft)) {
    const p = path.join(target, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const { share: _skip, ...h } = d.h;
    fs.writeFileSync(p, `${header(h)}\n${d.atoms.join('\n\n')}\n`);
  }
  const label = title || name;
  fs.writeFileSync(path.join(target, 'pack.json'), JSON.stringify({ name, version, title: { en: label, ru: label } }, null, 2) + '\n');
  const lines = [`# Набор ${name}: черновик`, '', `Подходят как есть: ${res.ok.length}. Переписать или убрать: ${res.rewrite.length}. Не берутся: ${res.no.length}.`, ''];
  lines.push('## Переписать или убрать', '');
  for (const r of res.rewrite) { lines.push(`- ${r.rel} — ${r.head}`); for (const h of r.hits) lines.push(`  - ${h.why}: ${h.text}`); }
  lines.push('', '## Не берутся', '');
  for (const r of res.no) lines.push(`- ${r.rel} — ${r.head}: ${r.why}`);
  lines.push('', '## Совет для любого: атом остаётся, только если на всё «да»', '', '- Назван общедоступный инструмент, ошибка или приём.', '- Незнакомый человек повторит шаги, ничего не зная об авторе и его компьютере.', '- Это знание об инструменте, а не о чьих-то настройках и договорённостях.', '- Сказано, что проверено.', '', 'Личное заменить на заполнитель (<папка проекта>); если без него совет теряет смысл — удалить атом.');
  fs.writeFileSync(path.join(base, 'SHARE-REPORT.md'), lines.join('\n') + '\n');
  out(`подходят как есть: ${res.ok.length}; переписать или убрать: ${res.rewrite.length}; не берутся: ${res.no.length}`);
  out(`черновик: ${target}\nотчёт: ${path.join(base, 'SHARE-REPORT.md')}`);
  out(`Ничего не отправлено. Перепишите атомы по отчёту, затем: experience share --check "${target}"`);
  return 0;
}

/** Final strict gate: any finding blocks the pack. Also used on what is about to leave the machine. */
function shareCheck(dir) {
  if (!dir || !fs.existsSync(path.join(dir, 'pack.json'))) { out('укажите папку набора с pack.json'); return 2; }
  const root = path.resolve(dir);
  const words = (eng.config().privateWords || []).map((w) => String(w).toLowerCase()).filter(Boolean);
  let bad = 0, atoms = 0;
  for (const f of eng.walk(root).sort()) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    const text = fs.readFileSync(f, 'utf8');
    for (const e of eng.lint(text, path.basename(f))) { out(`${rel}:${e.line}: ${e.code} ${e.msg}`); bad++; }
    for (const h of scan(text)) { out(`${rel}:${h.line}: ОПАСНО — ${h.why}: ${h.text}`); bad++; }
    for (const h of atomHits(text, words)) { out(`${rel}:${h.line}: ЛИЧНОЕ — ${h.why}: ${h.text}`); bad++; }
    atoms += eng.parse(text).atoms.length;
  }
  if (!atoms) { out('в наборе нет атомов'); return 1; }
  out(bad ? `не прошло: замечаний ${bad}` : `проверка пройдена: атомов ${atoms}`);
  return bad ? 1 : 0;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (k) => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : undefined);
  try {
    if (cmd === 'list') return list();
    if (cmd === 'add') return await add(rest);
    if (cmd === 'update') return await update();
    if (cmd === 'mute' || cmd === 'unmute') return mute(rest[0], cmd === 'mute');
    if (cmd === 'adopt') return adopt(rest.join(' '));
    if (cmd === 'share' && rest[0] === '--check') return shareCheck(rest[1]);
    if (cmd === 'share') return share(rest[0], { name: opt('--name'), version: opt('--version'), title: opt('--title'), outDir: opt('--out') });
    if (cmd === 'build') return await build(rest[0], opt('--name'), opt('--version'), opt('--out'));
  } catch (e) { out(`ошибка: ${e.message}`); return 1; }
  out('node experience-packs.js list | add <набор>|all | update | mute|unmute <набор> | adopt "<id>" | build <папка> --name <n> --version <v>');
  return 2;
}

module.exports = { scan, installBundle, adopt, build, share, shareCheck, personalHits };
if (require.main === module) main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
