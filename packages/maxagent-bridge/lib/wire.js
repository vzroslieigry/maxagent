'use strict';
// Message framing.
//  - Chrome Native Messaging: uint32 little-endian length + UTF-8 JSON (host ↔ extension, over stdio).
//  - Local channel and MCP: one JSON object per line (host ↔ MCP server, MCP server ↔ agent).

/** Reader for native messaging frames; calls onMessage(obj) for each complete frame. */
function nativeReader(stream, onMessage) {
  let buf = Buffer.alloc(0);
  stream.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 4) {
      const len = buf.readUInt32LE(0);
      if (buf.length < 4 + len) break;
      const body = buf.subarray(4, 4 + len).toString('utf8');
      buf = buf.subarray(4 + len);
      let msg;
      try { msg = JSON.parse(body); } catch { continue; }
      onMessage(msg);
    }
  });
}

function nativeWrite(stream, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length, 0);
  stream.write(Buffer.concat([head, body]));
}

/** Reader for newline-delimited JSON. */
function lineReader(stream, onMessage) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      onMessage(msg);
    }
  });
}

const lineWrite = (stream, obj) => stream.write(JSON.stringify(obj) + '\n');

/**
 * Chrome limits one message from the extension to the host to 1 MB, so the extension splits big
 * answers into {type:"chunk", id, i, n, data} pieces. Collector glues them back.
 */
function chunkCollector() {
  const parts = new Map();
  return (msg) => {
    if (msg.type !== 'chunk') return msg;
    const key = String(msg.id);
    const p = parts.get(key) || { n: msg.n, got: 0, data: new Array(msg.n) };
    if (p.data[msg.i] === undefined) p.got++;
    p.data[msg.i] = msg.data;
    parts.set(key, p);
    if (p.got < p.n) return null;
    parts.delete(key);
    return JSON.parse(p.data.join(''));
  };
}

module.exports = { nativeReader, nativeWrite, lineReader, lineWrite, chunkCollector };
