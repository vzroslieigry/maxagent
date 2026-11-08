'use strict';

const fs = require('fs');
const path = require('path');

const PKG_ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));

const START = '<!-- maxagent:start';
const END = '<!-- maxagent:end -->';
const BLOCK_RE = /\r?\n?<!-- maxagent:start[^\n]*-->[\s\S]*?<!-- maxagent:end -->\r?\n?/;

function render(text, vars) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

function eolOf(text) {
  return /\r\n/.test(text) ? '\r\n' : '\n';
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** Text of the file with the maxagent block inserted or replaced. */
function withBlock(existing, blockBody, note) {
  const eol = existing ? eolOf(existing) : (process.platform === 'win32' ? '\r\n' : '\n');
  const block = [`${START} (${note}) -->`, blockBody, END].join(eol);
  if (existing === null || existing === '') return { text: block + eol, action: 'added' };
  if (BLOCK_RE.test(existing)) {
    const replaced = existing.replace(BLOCK_RE, (m) => {
      const lead = /^\r?\n/.test(m) ? eol : '';
      const tail = /\r?\n$/.test(m) ? eol : '';
      return lead + block + tail;
    });
    return { text: replaced, action: replaced === existing ? 'same' : 'updated' };
  }
  const sep = existing.endsWith('\n') ? eol : eol + eol;
  return { text: existing + sep + block + eol, action: 'added' };
}

function withoutBlock(existing) {
  if (existing === null || !BLOCK_RE.test(existing)) return { text: existing, removed: false };
  const eol = eolOf(existing);
  // Block at the end (where init puts it): drop it with the separator init added → original text back.
  // Block in the middle (moved by the owner): keep one line break so neighbours don't glue together.
  let text = existing.replace(BLOCK_RE, (m, offset) => (offset + m.length >= existing.length || offset === 0 ? '' : eol));
  if (text.trim() === '') text = '';
  return { text, removed: true };
}

function blockOf(existing) {
  if (!existing) return null;
  const m = existing.match(BLOCK_RE);
  return m ? m[0] : null;
}

/** Writer that can run for real or only record what it would do. */
class Writer {
  constructor({ dry, log }) {
    this.dry = dry;
    this.log = log;
  }
  write(file, text, label) {
    this.log(`  ${label}: ${file}`);
    if (this.dry) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
  }
  copyOnce(src, dest, label) {
    if (fs.existsSync(dest)) return false;
    this.log(`  ${label}: ${dest}`);
    if (!this.dry) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    return true;
  }
  note(text) {
    this.log(`  ${text}`);
  }
}

module.exports = { PKG_ROOT, PKG, render, walk, readText, withBlock, withoutBlock, blockOf, Writer };
