#!/usr/bin/env node
'use strict';
// maxagent experience engine — one file for every agent: atoms, lint, index, search, recall.
//   Library: <experience>/<kind>/<thing>.md, every `###` outside code = one atom (see experience/_spec.md).
//   Index: built from the files themselves, cached in ~/.maxagent/state, rebuilt when any file changes.
//   Search: BM25 over word stems (trigger and title weigh most). A vector score plugs into `score()` later
//   without touching the library: atoms stay plain text, vectors are derived from it.
// CLI (any agent, any shell):
//   node experience-engine.js find "<words>"       — best atoms for a task, full text of the top one
//   node experience-engine.js lint <file…> | --all | --staged [--root <dir>]
//   node experience-engine.js stats
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const HOME_ROOT = path.resolve(__dirname, '..'); // ~/.maxagent when installed
const VERSION = 2; // 2: Latin words whole, words index without the body
const MAX_ATOM = 900; // characters of one atom: it must be shown whole
const MAX_FIELD = 200;
// Meaning gate (calibrated 08.11.2026 on the library and real owner messages): how far the best atom stands out.
// Recalibrated 08.11.2026 on 74 atoms: requests found by meaning 0.863–0.923, unrelated messages up to 0.847
// (a short, vague atom is a "magnet" for any generic phrase). z does not separate (unrelated up to 4.8), kept soft.
// Re-measure when the library grows: node experience-engine.js explain "<фраза>".
const Z_GATE = 1.5;
const SIM_GATE = 0.855;
// Words-only match must still be this close in meaning (08.11.2026, 628 atoms: chance word hits 0.80–0.82).
const WORDS_SIM_FLOOR = Number(process.env.MAXAGENT_WORDS_FLOOR || 0.83);
// Atoms embedded per build: a hook has ~15 s. Warm background process — 20 atoms ≈ 1 s; one-off process ≈ 6 s for 20.
const EMBED_BATCH = 48;
const EMBED_COLD = 16;
const FIELDS = ['когда', 'вещь', 'проверка', 'ловушка', 'источник'];
const REQUIRED = ['когда', 'вещь', 'источник'];
const FIELD_RE = /^- (когда|вещь|проверка|ловушка|источник):\s?(.*)$/;
const FILLER_RE = /не\s+подтвержд(?!ает|ают|ать)|нет\s+(отдельной\s+)?подтвержд|не\s+найдено\s+в\s+просмотренных|дословная\s+просьба|рецептурный\s+шаг|не\s+наблюдал|нет\s+данных|(?<!\p{L})неизвестно(?!\p{L})|\bTODO\b|\bTBD\b/iu;
const GLUED = [/[а-яё][A-Za-z]|[A-Za-z][а-яё]/, /[а-яё]\d/, /\d[а-яё]{3,}/, /[а-яё][,;][а-яёА-ЯЁ]/];
// Secrets never go into experience: values after password/token/key, private keys, typical token shapes.
const SECRET_RE = /(парол[ья]|password|passwd|token|токен|api[_-]?key|secret)\s*[:=]\s*\S{6,}|-----BEGIN [A-Z ]*PRIVATE KEY|\b(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[bp]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/i;

/* ---------- settings ---------- */

function readJson(f, def) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } }
function config() { return readJson(path.join(HOME_ROOT, 'config.json'), {}); }
/** Library folder: config "experience", else <workspace>/experience. */
function libraryRoot(cfg = config()) {
  if (process.env.MAXAGENT_EXPERIENCE) return path.resolve(process.env.MAXAGENT_EXPERIENCE);
  if (cfg.experience) return path.resolve(cfg.experience);
  return cfg.workspace ? path.join(cfg.workspace, 'experience') : '';
}
const stateDir = () => process.env.MAXAGENT_STATE || path.join(HOME_ROOT, 'state');

/* ---------- vectors: multilingual-e5-small via tools/experience-embed.py (model in ~/.maxagent/vector) ---------- */

const VEC_DIR = () => process.env.MAXAGENT_VECTOR || path.join(HOME_ROOT, 'vector');
const EMBED_PY = path.join(__dirname, 'experience-embed.py');
const PORT = 47311;
const hasVectors = () => fs.existsSync(path.join(VEC_DIR(), 'model', 'model_quantized.onnx')) && fs.existsSync(EMBED_PY);
function python(cfg = config(), windowless = false) {
  const py = cfg.python || 'python';
  if (!windowless || process.platform !== 'win32') return py;
  const w = path.join(path.dirname(py), 'pythonw.exe');
  return path.isAbsolute(py) && fs.existsSync(w) ? w : 'pythonw';
}
const embedEnv = () => ({ ...process.env, MAXAGENT_VECTOR: VEC_DIR(), PYTHONIOENCODING: 'utf-8' });

// Synchronous client of the background process (build() is synchronous): a tiny Node child does the HTTP call.
const CLIENT = `let b='';process.stdin.on('data',d=>b+=d).on('end',()=>{const r=require('http').request({host:'127.0.0.1',port:${PORT},method:'POST',path:'/embed',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)},timeout:20000},s=>{let o='';s.setEncoding('utf8');s.on('data',d=>o+=d).on('end',()=>process.stdout.write(o))});r.on('error',()=>process.exit(3));r.on('timeout',()=>{r.destroy();process.exit(4)});r.end(b)})`;

/** Atom texts → vectors: the warm background process first (20 atoms ≈ 1 s), else a one-off process (≈ 6 s). */
function embedPassages(texts) {
  if (!texts.length || !hasVectors()) return null;
  try {
    const r = require('child_process').spawnSync(process.execPath, ['-e', CLIENT], { input: JSON.stringify({ passage: texts }), encoding: 'utf8', timeout: 25000, windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
    const v = r.status === 0 && JSON.parse(r.stdout || '{}').vectors;
    if (Array.isArray(v) && v.length === texts.length) return v;
    if (r.status === 3) startServer();
  } catch { /* fall back to a one-off process */ }
  texts = texts.slice(0, EMBED_COLD);
  try {
    const r = require('child_process').spawnSync(python(), ['-B', EMBED_PY], { input: JSON.stringify({ passage: texts }), encoding: 'utf8', timeout: 300000, windowsHide: true, env: embedEnv(), maxBuffer: 256 * 1024 * 1024 });
    const v = JSON.parse(r.stdout || '{}').vectors;
    return Array.isArray(v) && v.length === texts.length ? v : null;
  } catch { return null; }
}

/** Start the background model process (no window), once; it exits by itself after an hour without requests. */
function startServer() {
  const mark = path.join(stateDir(), 'embed-start.json');
  const last = readJson(mark, {}).at || 0;
  if (Date.now() - last < 60000) return; // already starting
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(mark, JSON.stringify({ at: Date.now() }));
    const p = require('child_process').spawn(python(config(), true), ['-B', EMBED_PY, '--serve', String(PORT)], { detached: true, stdio: 'ignore', windowsHide: true, env: embedEnv() });
    p.unref();
  } catch { /* no python — words only */ }
}

/** Query vector from the background process; not running → start it and answer null (this time words only). */
function queryVector(text, timeout = 1500) {
  if (!hasVectors() || !String(text).trim()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const body = Buffer.from(JSON.stringify({ query: [String(text).slice(0, 2000)] }));
    const req = require('http').request({ host: '127.0.0.1', port: PORT, method: 'POST', path: '/embed', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }, timeout }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { buf += d; });
      res.on('end', () => { try { resolve(JSON.parse(buf).vectors[0] || null); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', (e) => { if (e.code === 'ECONNREFUSED') startServer(); resolve(null); });
    req.end(body);
  });
}
// What the meaning search compares: heading, triggers, things and the first words of the recipe. Short on purpose —
// cost grows with length (62 atoms with 300 characters of body: 17 s; meaning lives in heading and `когда`).
const passageOf = (a, title) => `${a.head}. ${a.triggers.join('. ')}. ${a.fields['вещь'] || ''}. ${title.split(' — ')[0]}. ${a.body.join(' ').slice(0, 80)}`;
const hashOf = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

/* ---------- words ---------- */

const STOP = new Set(('давай давайте этот этого эта эти тоже чтобы когда только если нужно надо можно будет было были есть сейчас потом ' +
  'сделать сделай ещё еще очень просто какой какие который которые там тут здесь почему зачем свой свои всех всем всё весь вообще ' +
  'нажмите откройте выберите сделайте ваш ваша ваши после перед затем делат делаю сдела нача пытат пробо друго недав хочу хотел ' +
  'смотр понял думаю говор сказа сраз снова опять with that this from have will what when your just there their about would could should please https http www ' +
  'in is of to on at or an as by if it be do no so up we me my the and for not').split(' '));
function stems(text) {
  const out = [];
  // Shell operators are triggers too: `&&` in PowerShell 5.1 is an error.
  for (const op of String(text).match(/&&|\|\||<</g) || []) out.push(op);
  // Command flags keep their case: `grep -P` is not `grep -p` and not every `grep`.
  for (const m of String(text).matchAll(/(?:^|\s)(--?[A-Za-z][\w-]*)/g)) out.push(m[1]);
  for (const raw of String(text).match(/[\p{L}\p{N}]+/gu) || []) {
    const w = raw.toLowerCase();
    // Short tokens that still mean something: Latin commands and tools (ls, rm, cd, git), anything with a digit
    // (4K, 3D, 14), abbreviations in capitals (ПК, X, QR). Other 1–2 letter words are prepositions and particles.
    const short = /^[a-z][a-z0-9]$/.test(w) || /\d/.test(w) || (raw.length <= 3 && raw === raw.toUpperCase() && /\p{Lu}/u.test(raw));
    if (STOP.has(w) || (w.length < 3 && !short)) continue;
    // Latin words are names of commands, programs and errors — exact (Remotion ≠ remote); Russian words — a stem.
    const s = /^[a-z0-9_]+$/.test(w) ? w : w.length > 5 ? w.slice(0, 5) : w.length > 3 ? w.slice(0, Math.max(3, w.length - 1)) : w;
    if (!STOP.has(s)) out.push(s);
  }
  return out;
}

/* ---------- files and atoms ---------- */

function walk(dir, out = [], skip = null) {
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of list) {
    if (e.name.startsWith('.') || e.name.startsWith('_') || (skip && skip.has(e.name))) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md') && e.name !== 'README.md') out.push(p);
  }
  return out;
}

function frontmatter(lines) {
  if ((lines[0] || '').trim() !== '---') return { h: null, start: 0 };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return { h: null, start: 0 };
  const h = {};
  for (const l of lines.slice(1, end)) { const kv = l.match(/^(\w+):\s*(.*)$/); if (kv) h[kv[1]] = kv[2].trim(); }
  return { h, start: end + 1 };
}

/** Atoms of one file: { head, line, fields, body, text } — `text` is the atom exactly as written. */
function parse(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const { h, start } = frontmatter(lines);
  const atoms = [];
  let cur = null;
  let fence = '';
  const close = () => {
    if (!cur) return;
    while (cur.lines.length && !cur.lines[cur.lines.length - 1].trim()) cur.lines.pop();
    cur.text = `### ${cur.head}\n${cur.lines.join('\n')}`.trim();
    atoms.push(cur);
    cur = null;
  };
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1][0]; else if (fence === f[1][0]) fence = ''; }
    if (!fence && !f) {
      const m3 = line.match(/^###\s+(.+)$/);
      if (m3) { close(); cur = { head: m3[1].trim(), line: i + 1, fields: {}, traps: [], triggers: [], body: [], lines: [], fieldLines: [] }; continue; }
      if (/^#{1,2}\s/.test(line)) { close(); continue; }
    }
    if (!cur) continue;
    cur.lines.push(line);
    const fm = !fence && line.match(FIELD_RE);
    if (fm) {
      cur.fieldLines.push({ name: fm[1], value: fm[2].trim(), n: i + 1 });
      const v = fm[2].trim();
      if (fm[1] === 'ловушка') cur.traps.push(v);
      else if (fm[1] === 'когда') { cur.triggers.push(v); cur.fields['когда'] = cur.fields['когда'] ? `${cur.fields['когда']} · ${v}` : v; }
      else if (!(fm[1] in cur.fields)) cur.fields[fm[1]] = v;
    } else if (line.trim()) cur.body.push(line);
  }
  close();
  return { h, atoms };
}

/* ---------- lint: what any agent's entry must satisfy ---------- */

function maskInline(line) {
  return line.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S*[\\/]\S*/g, ' ').replace(/\S+\.(md|py|js|json|ps1|txt|wav|mp4|png|jsonl|exe)\b/g, ' ');
}

/** [{ code, line, msg }]. Codes: E001 header, E010 field missing, E011 placeholder, E012 order, E013 too long,
 *  E014 empty atom, E020 glued words, E040 secret, E050 duplicate heading. */
function lint(text, rel = '') {
  const errs = [];
  const add = (code, line, msg) => errs.push({ code, line, msg });
  const raw = String(text).replace(/\r\n/g, '\n');
  const lines = raw.split('\n');
  const { h, atoms } = parse(raw);
  if (!h) add('E001', 1, 'нет шапки --- title / aliases ---');
  else for (const k of ['title', 'aliases']) if (!h[k]) add('E001', 1, `в шапке нет «${k}»`);
  if (!atoms.length) add('E014', 1, 'нет ни одного атома ###');
  const heads = new Map();
  for (const a of atoms) {
    const where = `«${a.head}»`;
    if (heads.has(a.head.toLowerCase())) add('E050', a.line, `заголовок ${where} уже есть (строка ${heads.get(a.head.toLowerCase())})`);
    heads.set(a.head.toLowerCase(), a.line);
    for (const k of REQUIRED) if (!a.fields[k]) add('E010', a.line, `${where}: нет поля «${k}»`);
    if (!a.body.length) add('E014', a.line, `${where}: нет самого способа — шагов или команды`);
    // A phrase of several words that leaves one significant stem ("сделать MCP" → "mcp") fires on ANY action
    // mentioning that word. A single word on purpose (`Bash`, `ls`) is fine.
    for (const part of a.triggers.join(' · ').split(/\s+·\s+|;\s*/)) {
      const words = part.trim().split(/\s+/).filter(Boolean);
      if (words.length > 1 && new Set(stems(part)).size === 1) add('E016', a.line, `${where}: триггер «${part.trim()}» сводится к одному слову «${stems(part)[0]}» — сработает на любое его упоминание; добавить второе значимое слово`);
    }
    if (a.text.length > MAX_ATOM) add('E013', a.line, `${where}: ${a.text.length} знаков, предел ${MAX_ATOM} — разделить на два атома или убрать воду`);
    let last = -1;
    for (const f of a.fieldLines) {
      const pos = FIELDS.indexOf(f.name);
      if (f.name !== 'ловушка' && pos < last) add('E012', f.n, `${where}: поле «${f.name}» не на своём месте (порядок: ${FIELDS.join(' → ')})`);
      last = Math.max(last, f.name === 'ловушка' ? last : pos);
      if (!f.value) add('E011', f.n, `${where}: «${f.name}» пустое — нет данных, нет строки`);
      else if (FILLER_RE.test(f.value)) add('E011', f.n, `${where}: «${f.name}» — заглушка («не подтверждено», TODO…): нет данных — нет строки`);
      if (f.value.length > MAX_FIELD) add('E013', f.n, `${where}: «${f.name}» длиннее ${MAX_FIELD} знаков`);
    }
  }
  let fence = '';
  lines.forEach((line, i) => {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1][0]; else if (fence === f[1][0]) fence = ''; }
    if (SECRET_RE.test(line)) add('E040', i + 1, 'похоже на пароль, ключ или токен — в опыт только где лежит, не само значение');
    if (fence || f || i === 0) return;
    const m = maskInline(line);
    for (const rx of GLUED) {
      const g = m.match(rx);
      if (g) {
        let s = g.index, e = g.index + g[0].length;
        while (s > 0 && !/\s/.test(m[s - 1])) s--;
        while (e < m.length && !/\s/.test(m[e])) e++;
        add('E020', i + 1, `слиплось: «${m.slice(s, e)}» — нужен пробел`);
        break;
      }
    }
  });
  if (rel && !/^[\x20-\x7e]+$/.test(rel)) add('E001', 1, `имя файла не латиницей: ${rel}`);
  return errs.sort((a, b) => a.line - b.line);
}

/* ---------- index ---------- */

function signature(files) {
  const h = crypto.createHash('sha1');
  for (const f of files) { try { const s = fs.statSync(f); h.update(`${f}:${s.mtimeMs}:${s.size};`); } catch { /* gone */ } }
  return h.digest('hex');
}

/** Own library: <experience>/**, without `shared/` (the second shelf). */
function build(root = libraryRoot()) {
  // shared/ — second shelf (reference); answer/ — atoms checked against the agent's outgoing answer, not the request.
  const files = root ? walk(root, [], new Set(['shared', 'answer'])).sort() : [];
  return indexFiles(files, root, `experience-index-${crypto.createHash('sha1').update(root || '-').digest('hex').slice(0, 10)}.json`);
}

/**
 * Answer shelf: <experience>/answer/** — how to hand things to the owner (links, copy blocks, honesty). Searched with
 * the text of the agent's finished answer at the end of a turn, so it never competes with task atoms
 * (decision 08.11.2026: «file for the voice-over» answered without a link — the format rule lost to task atoms).
 */
function buildAnswer(root = libraryRoot()) {
  const dir = root ? path.join(root, 'answer') : '';
  const files = dir ? walk(dir).sort() : [];
  return indexFiles(files, root, `experience-answer-${crypto.createHash('sha1').update(root || '-').digest('hex').slice(0, 10)}.json`);
}

/** Atoms of the answer shelf for a draft answer; each shown once per session. Words of `когда` or meaning. */
function answerRecall(text, session, { qvec = null, k = 2 } = {}) {
  const idx = buildAnswer();
  if (!idx.atoms.length || !String(text).trim()) return [];
  const file = path.join(stateDir(), `answer-shown-${String(session || 'default').replace(/[^\w.-]/g, '_')}.json`);
  const shown = new Set(readJson(file, []));
  const found = search(String(text).slice(0, 6000), { k: 6, idx, qvec, cover: 0.34, minSim: 0.86 }).filter((a) => !shown.has(`${a.file}#${a.head}`)).slice(0, k);
  if (found.length) {
    try { fs.mkdirSync(stateDir(), { recursive: true }); fs.writeFileSync(file, JSON.stringify([...shown, ...found.map((a) => `${a.file}#${a.head}`)].slice(-200))); } catch { /* convenience */ }
  }
  return found;
}

/** Packs in <experience>/shared/<pack>/ (pack.json next to the atoms), muted ones (config sharedMuted) skipped. */
function sharedPacks(root = libraryRoot(), cfg = config()) {
  const base = root ? path.join(root, 'shared') : '';
  const muted = new Set(cfg.sharedMuted || []);
  let names = [];
  try { names = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && /^[a-z0-9-]+$/.test(d.name)).map((d) => d.name); } catch { return []; }
  // Only real pack names: "<name>.old-…" / "<name>.new-…" leftovers of an update are not packs.
  return names.map((name) => ({ name, dir: path.join(base, name), meta: readJson(path.join(base, name, 'pack.json'), null), muted: muted.has(name) }))
    .filter((p) => p.meta);
}

/** Shared shelf: its own index; vectors come ready from the pack (vectors.json, int8 base64) — not computed here. */
function buildShared(root = libraryRoot(), cfg = config()) {
  const packs = sharedPacks(root, cfg).filter((p) => !p.muted);
  const files = packs.flatMap((p) => walk(p.dir)).sort();
  const ready = {};
  for (const p of packs) {
    const v = readJson(path.join(p.dir, 'vectors.json'), null);
    if (!v || !v.vec) continue;
    for (const [h, b64] of Object.entries(v.vec)) {
      const bytes = Buffer.from(b64, 'base64');
      ready[h] = Array.from(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length), (x) => x / 127);
    }
  }
  return indexFiles(files, root, `experience-shared-${crypto.createHash('sha1').update(root || '-').digest('hex').slice(0, 10)}.json`, ready);
}

function indexFiles(files, root, cacheName, ready = null) {
  const sig = signature(files);
  const cache = path.join(stateDir(), cacheName);
  const old = readJson(cache, null);
  // Same files and every atom has a vector (or vectors are not installed) → the cache is current.
  if (old && old.sig === sig && old.version === VERSION && (!hasVectors() || Date.now() - (old.vecFail || 0) < 3600000 || old.atoms.every((a) => old.vec && old.vec[a.h]))) return old;
  const atoms = [];
  for (const f of files) {
    let parsed;
    try { parsed = parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    const rel = path.relative(path.dirname(root), f).replace(/\\/g, '/');
    const pack = (rel.match(/^[^/]+\/shared\/([^/]+)\//) || [])[1] || '';
    const title = (parsed.h && parsed.h.title) || path.basename(f, '.md');
    const aliases = (parsed.h && parsed.h.aliases) || '';
    for (const a of parsed.atoms) {
      const tf = {};
      const put = (text, w) => { for (const s of stems(text)) tf[s] = (tf[s] || 0) + w; };
      put(a.head, 3);
      put(a.fields['когда'] || '', 3);
      put(a.fields['вещь'] || '', 2);
      put(`${title} ${aliases}`, 1);
      // Body and traps are found by meaning (vectors); words index only what names the task — small and fast
      // even for big shared packs (decision 08.11.2026). WORDS_BODY=1 — the old full-text index, for comparison.
      if (process.env.WORDS_BODY) { put(a.body.join(' '), 1); put(a.traps.join(' '), 1); }
      const passage = passageOf(a, title);
      // id: stable name of a shared atom — `<pack>:<file inside the pack>#<heading>`; adopt marks it in the own copy.
      const id = pack ? `${pack}:${rel.split('/').slice(3).join('/')}#${a.head}` : '';
      atoms.push({ file: rel, title, head: a.head, text: a.text, trigger: a.triggers.join(' · '), source: a.fields['источник'] || '', tf, len: Object.values(tf).reduce((x, y) => x + y, 0), h: hashOf(passage), passage, pack, id });
    }
  }
  const df = {};
  for (const a of atoms) for (const s of Object.keys(a.tf)) df[s] = (df[s] || 0) + 1;
  // Vectors: reuse unchanged atoms' vectors, embed only new or edited ones.
  const vec = {};
  const oldVec = (old && old.vec) || {};
  const todo = [];
  for (const a of atoms) { if (oldVec[a.h]) vec[a.h] = oldVec[a.h]; else if (ready && ready[a.h]) vec[a.h] = ready[a.h]; else todo.push(a); }
  const batch = todo.slice(0, EMBED_BATCH);
  const fresh = embedPassages(batch.map((a) => a.passage));
  if (fresh) batch.forEach((a, i) => { if (fresh[i]) vec[a.h] = fresh[i]; }); // a cold process may do only the first part
  for (const a of atoms) delete a.passage;
  // Embedding failed (no python, broken model) → don't retry on every message: words only for an hour.
  const vecFail = todo.length && !fresh && hasVectors() ? Date.now() : 0;
  const idx = { version: VERSION, sig, root, files: files.length, atoms, df, vec, vecFail, avgLen: atoms.length ? atoms.reduce((x, a) => x + a.len, 0) / atoms.length : 1 };
  try { fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.writeFileSync(cache, JSON.stringify(idx)); } catch { /* cache is a convenience */ }
  return idx;
}

/* ---------- search ---------- */

/**
 * Best atoms for a text. Gate (measured on 397 real owner messages, 06.11.2026): hits ≥ 2 and
 * (score ≥ strong OR share of query stems matched ≥ cover with score ≥ minScore).
 */
function search(text, { k = 4, minScore = 7, strong = 15, cover = 0.5, idx = build(), qvec = null, z = Z_GATE, minSim = SIM_GATE } = {}) {
  const want = [...new Set(stems(text))];
  if ((!want.length && !qvec) || !idx.atoms.length) return [];
  const N = idx.atoms.length, k1 = 1.2, b = 0.75;
  // Meaning: cosine of the query to every atom; e5 scores sit close together, so an atom passes by how far it
  // stands out from the rest (z) and a floor (minSim), not by the raw number.
  const sims = new Map();
  if (qvec && idx.vec) {
    for (const a of idx.atoms) { const v = idx.vec[a.h]; if (v) { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * qvec[i]; sims.set(a, s); } }
  }
  let mean = 0, sd = 1;
  if (sims.size > 2) {
    const vals = [...sims.values()];
    mean = vals.reduce((x, y) => x + y, 0) / vals.length;
    sd = Math.sqrt(vals.reduce((x, y) => x + (y - mean) ** 2, 0) / vals.length) || 1;
  }
  const res = [];
  for (const a of idx.atoms) {
    const sim = sims.get(a);
    const zs = sim === undefined ? -9 : (sim - mean) / sd;
    const byMeaning = sim !== undefined && sims.size > 2 && zs >= z && sim >= minSim;
    let score = 0, hits = 0;
    for (const s of want) {
      const f = a.tf[s];
      if (!f) continue;
      hits++;
      const idf = Math.log(1 + (N - idx.df[s] + 0.5) / (idx.df[s] + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (a.len / idx.avgLen))));
    }
    const share = hits / want.length;
    // A short exact request matches by share (works in a library of 5 atoms and of 5000);
    // a long message matches by score. minScore only filters chance overlaps of long messages.
    // A `когда` phrase contained whole in the request is the strongest sign: the author named this very request.
    const have = new Set(want);
    let phrase = 0;
    for (const part of String(a.trigger || '').split(/\s+·\s+|;\s*/)) {
      const t = [...new Set(stems(part))];
      if (t.length >= 2 && t.every((s) => have.has(s))) phrase = Math.max(phrase, t.length);
    }
    // Loose word overlap («бюджет», «название канала») without any likeness in meaning is chance: with vectors
    // available it needs a meaning floor too. A whole `когда` phrase passes without it (commands, errors).
    const wordsFloor = sim === undefined || sims.size <= 2 || sim >= WORDS_SIM_FLOOR;
    const byWords = phrase >= 2 || (hits >= 2 && wordsFloor && (share >= cover || (score >= strong && score >= minScore)));
    if (!byWords && !byMeaning) continue;
    // Rank: meaning first when there is a vector (synonyms, other word forms), words and a whole trigger phrase on top.
    const rank = (sim !== undefined && sims.size > 2 ? zs + (byWords ? 1 : 0) + Math.min(share, 1) : score) + (phrase ? 2 + phrase / 2 : 0);
    res.push({ ...a, score: Math.round(score * 10) / 10, hits, cover: Math.round(share * 100) / 100, sim: sim === undefined ? null : Math.round(sim * 1000) / 1000, z: Math.round(zs * 100) / 100, byWords, byMeaning, rank });
  }
  return res.sort((x, y) => y.rank - x.rank).slice(0, k);
}

/* ---------- recall for hooks: memory, not an order; nothing repeated within a session ---------- */

/* ---------- shared shelf: reference only, never stops an action ---------- */

// Shown only when the own library has nothing, at most one, compact (decision 08.11.2026).
// Measured on the 7 released packs (149 atoms, 08.11.2026): unrelated requests top out at 0.811, real ones
// 0.807–0.903 (Russian request vs English pack text ≈ 0.81–0.86). 0.88 let through 2 of 12 real ones;
// 0.84 lets 8 of 12 and 0 of 10 unrelated (margin 0.03).
const SHARED_SIM_GATE = 0.84;
const SHARED_MAX_SHOWS = 8; // shown this many times and never adopted → no longer shown
const statsFile = () => path.join(stateDir(), 'shared-stats.json');

/** ids of shared atoms already adopted: the own copy says «(общий: <id>)» in `источник`. */
function adoptedIds(ownIdx) {
  const out = new Set();
  for (const a of ownIdx.atoms) for (const m of String(a.source || '').matchAll(/общий:\s*([^)]+)\)/g)) out.add(m[1].trim());
  return out;
}

function sharedRecall(text, session, { qvec = null, ownIdx = build(), heads = {} } = {}) {
  const idx = buildShared();
  if (!idx.atoms.length) return '';
  const adopted = adoptedIds(ownIdx);
  const stats = readJson(statsFile(), {});
  const file = path.join(stateDir(), `recall-shown-${String(session || 'default').replace(/[^\w.-]/g, '_')}.json`);
  const shown = new Set(readJson(file, []));
  const top = search(text, { k: 5, idx, qvec, minSim: SHARED_SIM_GATE, cover: 2, strong: 1e9, minScore: 1e9 })
    .find((a) => !adopted.has(a.id) && !shown.has(`s:${a.id}`) && ((stats[a.id] || {}).shown || 0) < SHARED_MAX_SHOWS);
  if (!top) return '';
  const first = (top.text.split('\n').find((l) => /^\s*(1\.|```|[^-#\s])/.test(l) && !/^###/.test(l)) || '').trim().slice(0, 200);
  stats[top.id] = { shown: ((stats[top.id] || {}).shown || 0) + 1, at: Date.now() };
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(statsFile(), JSON.stringify(stats));
    fs.writeFileSync(file, JSON.stringify([...shown, `s:${top.id}`].slice(-400)));
    const pend = path.join(stateDir(), `shared-pending-${String(session || 'default').replace(/[^\w.-]/g, '_')}.json`);
    fs.writeFileSync(pend, JSON.stringify({ id: top.id, head: top.head, at: Date.now() }));
  } catch { /* convenience */ }
  const meta = (sharedPacks().find((p) => p.name === top.pack) || {}).meta || {};
  const head = (heads.shared || ((p, v) => `[чужой опыт — у нас не проверен; набор «${p}»${v ? `, v${v}` : ''}]`))(top.pack, meta.version);
  return [head, `### ${top.head}`, first, (heads.adopt || ((id) => `Пригодится — сохрани своим: node ~/.maxagent/tools/experience-packs.js adopt "${id}"`))(top.id)].filter(Boolean).join('\n');
}

function recall(text, session, { more = 3, heads = {}, ...opts } = {}) {
  const found = search(text, { k: 1 + more, ...opts });
  if (!found.length) return sharedRecall(text, session, { qvec: opts.qvec || null, ownIdx: opts.idx || build(), heads });
  const file = path.join(stateDir(), `recall-shown-${String(session || 'default').replace(/[^\w.-]/g, '_')}.json`);
  const shown = new Set(readJson(file, []));
  const key = (a) => `${a.file}#${a.head}`;
  const lines = [];
  const keys = [];
  const [top, ...rest] = found;
  if (!shown.has(key(top))) {
    const sure = top.score >= 25 || top.cover >= 0.6 || (top.sim || 0) >= 0.87;
    lines.push(sure ? (heads.sure || '[опыт — похоже, я так уже делал; сверь, подходит ли]') : (heads.maybe || '[опыт — возможно, похожее; сверь, подходит ли]'));
    lines.push(`(${top.file})`, top.text);
    keys.push(key(top));
  }
  const more2 = rest.filter((a) => !shown.has(key(a)) && !shown.has(`h:${key(a)}`));
  if (more2.length) {
    lines.push(lines.length ? (heads.also || 'Ещё похоже:') : (heads.only || '[опыт — похожие случаи]'));
    for (const a of more2) { lines.push(`- ${a.head} (${a.file})`); keys.push(`h:${key(a)}`); }
  }
  if (!keys.length) return '';
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify([...shown, ...keys].slice(-400))); } catch { /* convenience */ }
  return lines.join('\n');
}

/**
 * Trigger from the agent's own action (a tool call or its error): only atoms whose `когда` itself matches,
 * so a command does not pull a recipe that merely mentions the same word in its body. Once per atom per session.
 */
function actionRecall(text, session, { minHits = 1, idx = build() } = {}) {
  const want = [...new Set(stems(text))];
  if (!want.length) return null;
  // `когда: Bash · ls · команда в терминале` — each part is a phrase; it fires when ALL its words are in the action.
  const have = new Set(want);
  const trig = [];
  for (const a of idx.atoms) {
    let best = 0;
    for (const part of String(a.trigger || '').split(/\s+·\s+|;\s*/)) {
      const t = [...new Set(stems(part))];
      if (t.length >= minHits && t.every((s) => have.has(s))) best = Math.max(best, t.length);
    }
    if (best) trig.push({ a, best });
  }
  trig.sort((x, y) => y.best - x.best);
  if (!trig.length) return null;
  const file = path.join(stateDir(), `action-shown-${String(session || 'default').replace(/[^\w.-]/g, '_')}.json`);
  const shown = new Set(readJson(file, []));
  const hit = trig.find((x) => !shown.has(`${x.a.file}#${x.a.head}`));
  if (!hit) return null;
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify([...shown, `${hit.a.file}#${hit.a.head}`].slice(-400))); } catch { /* convenience */ }
  return hit.a;
}

/** Short rows for "experience before a web search / before asking": `- head (file)`. */
function rows(text, opts) { return search(text, opts).map((a) => `- ${a.head} (${a.file})`).join('\n'); }

/** Is this path inside the library? */
function inLibrary(p, root = libraryRoot()) {
  if (!root || !p) return false;
  const r = path.resolve(String(p)).toLowerCase();
  const base = path.resolve(root).toLowerCase();
  return r.startsWith(base + path.sep) && r.endsWith('.md') && !path.basename(r).startsWith('_') && path.basename(r) !== 'readme.md';
}

/* ---------- CLI ---------- */

/**
 * E060: an atom outside experience/projects/<project>/ must not name a private project (owner's rule 09.11.2026).
 * Projects = folders of experience/projects; other spellings = lines of projects/<project>/_names.txt.
 */
function projectNames(root) {
  const base = path.join(root, 'projects');
  let dirs = [];
  try { dirs = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  return dirs.map((d) => {
    let extra = [];
    try { extra = fs.readFileSync(path.join(base, d, '_names.txt'), 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean); } catch { /* optional */ }
    return { project: d, names: [d, d.replace(/-/g, ' '), ...extra] };
  });
}

function lintProjects(text, file, root = libraryRoot()) {
  if (!root) return [];
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel.startsWith('..') || /^(projects|shared)\//.test(rel)) return [];
  const escape = (w) => w.split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`)).join('[\\s-]*');
  const errs = [];
  for (const { project, names } of projectNames(root)) {
    const rx = new RegExp(`(^|[^\\p{L}\\d])(${names.map(escape).join('|')})($|[^\\p{L}\\d])`, 'iu');
    String(text).split(/\r?\n/).forEach((line, i) => {
      if (rx.test(line)) errs.push({ code: 'E060', line: i + 1, msg: `упомянут проект ${project}: перенести атом в experience/projects/${project}/ или убрать название` });
    });
  }
  return errs;
}

function lintFiles(files, root, out) {
  let bad = 0;
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const rel = path.relative(path.dirname(root || path.dirname(f)), f).replace(/\\/g, '/');
    const errs = [...lint(text, path.basename(f)), ...lintProjects(text, f, root || libraryRoot())];
    for (const e of errs) out(`${rel}:${e.line}: ${e.code} ${e.msg}`);
    bad += errs.length;
  }
  return bad;
}

/** For the CLI: query vector without the background process (loads the model, ~2 s). */
function queryVectorSync(text) {
  if (!hasVectors()) return null;
  try {
    const r = require('child_process').spawnSync(python(), ['-B', EMBED_PY], { input: JSON.stringify({ query: [text] }), encoding: 'utf8', timeout: 60000, windowsHide: true, env: embedEnv() });
    return JSON.parse(r.stdout).vectors[0] || null;
  } catch { return null; }
}

async function main(argv) {
  const out = (s) => process.stdout.write(s + '\n');
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? path.resolve(argv.splice(ri, 2)[1]) : libraryRoot();
  const [cmd, ...rest] = argv;
  if (cmd === 'find' || cmd === 'explain') {
    const text = rest.join(' ');
    const idx = build(root);
    const qvec = await queryVector(text, 3000) || queryVectorSync(text);
    if (cmd === 'explain') {
      for (const a of search(text, { k: 8, idx, qvec, z: -9, minSim: 0, cover: 0 })) out(`${a.sim ?? '-'}\tz=${a.z}\tслова=${a.byWords ? 'да' : 'нет'}\t${a.head} (${a.file})`);
      return 0;
    }
    const found = search(text, { k: 5, minScore: 3, strong: 8, cover: 0.3, idx, qvec, z: 1.5 });
    if (!found.length) { out('В опыте ничего похожего.'); return 0; }
    out(`(${found[0].file})\n${found[0].text}`);
    if (found.length > 1) { out('\nЕщё похоже:'); for (const a of found.slice(1)) out(`- ${a.head} (${a.file}) [${a.score}]`); }
    return 0;
  }
  if (cmd === 'lint') {
    let files;
    if (rest[0] === '--all') files = walk(root);
    else if (rest[0] === '--staged') {
      let names = '';
      try { names = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: path.dirname(root), encoding: 'utf8' }); } catch { return 0; }
      files = names.split('\n').filter(Boolean).map((n) => path.join(path.dirname(root), n)).filter((f) => inLibrary(f, root));
    } else files = rest.map((f) => path.resolve(f));
    const bad = lintFiles(files, root, out);
    out(bad ? `ошибок: ${bad} — исправь и проверь снова` : `ошибок нет (${files.length} файл.)`);
    return bad ? 1 : 0;
  }
  if (cmd === 'stats') {
    const t0 = Date.now();
    const idx = build(root);
    out(`библиотека: ${root}\nфайлов: ${idx.files}, атомов: ${idx.atoms.length}, ${Date.now() - t0} мс`);
    return 0;
  }
  out('node experience-engine.js find "<слова>" | lint <файл…>|--all|--staged | stats   [--root <папка опыта>]');
  return 2;
}

module.exports = { parse, lint, lintProjects, projectNames, build, buildAnswer, answerRecall, buildShared, sharedPacks, sharedRecall, adoptedIds, config, stateDir, embedPassages, hashOf, passageOf, walk, search, recall, actionRecall, rows, queryVector, hasVectors, inLibrary, libraryRoot, stems, MAX_ATOM };

if (require.main === module) main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exitCode = 1; });
