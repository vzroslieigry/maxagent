'use strict';
// Native messaging host. Chrome starts it only for our extension (allowed_origins in the host manifest)
// and keeps it alive while the extension holds the port. It relays between the extension (stdio) and
// local MCP servers (named pipe / unix socket). All decisions — who may connect, what is allowed,
// confirmations, log, stop — are made in the extension, where the owner sees them.

const fs = require('fs');
const net = require('net');
const crypto = require('crypto');
const { nativeReader, nativeWrite, lineReader, lineWrite, chunkCollector } = require('./wire');
const paths = require('./paths');

function runHost({ input = process.stdin, output = process.stdout } = {}) {
  const baseDir = paths.base();
  fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  const where = paths.channel(baseDir);
  const clients = new Map(); // conn id → socket
  let nextConn = 1;
  let extVersion = null; // reported by the extension when it connects
  const toExt = (obj) => nativeWrite(output, obj);
  const collect = chunkCollector();

  const server = net.createServer((sock) => {
    const conn = nextConn++;
    clients.set(conn, sock);
    lineReader(sock, (msg) => {
      if (msg.type === 'hello') {
        // The raw key never leaves the host: the extension only sees its hash.
        const keyHash = crypto.createHash('sha256').update(String(msg.key || '')).digest('hex');
        toExt({ type: 'hello', conn, agent: String(msg.agent || '').slice(0, 64), keyHash });
      } else if (msg.type === 'call') {
        toExt({ type: 'call', conn, id: msg.id, tool: String(msg.tool || ''), args: msg.args || {} });
      } else if (msg.type === 'control') {
        // Installer: which extension version is running, and "reload yourself from disk" after an update.
        // Harmless by design: it reveals only the version and can only make the extension re-read its own files.
        if (msg.action === 'reload') toExt({ type: 'reload' });
        lineWrite(sock, { type: 'control_result', extVersion, reloading: msg.action === 'reload' });
        sock.end();
      }
    });
    sock.on('close', () => {
      clients.delete(conn);
      toExt({ type: 'bye', conn });
    });
    sock.on('error', () => {});
  });

  const listen = () => server.listen(where, () => {
    if (process.platform !== 'win32') { try { fs.chmodSync(where, 0o600); } catch { /* best effort */ } }
    toExt({ type: 'host_ready', channel: process.platform === 'win32' ? 'pipe' : 'socket', pid: process.pid });
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && process.platform !== 'win32') {
      // A stale socket file from a crashed host: remove it only if nobody answers on it.
      const probe = net.connect(where);
      probe.on('connect', () => { probe.destroy(); toExt({ type: 'host_error', error: 'channel_busy' }); });
      probe.on('error', () => { try { fs.unlinkSync(where); } catch { /* gone */ } listen(); });
      return;
    }
    toExt({ type: 'host_error', error: err.code === 'EADDRINUSE' ? 'channel_busy' : String(err.message || err) });
  });
  listen();

  nativeReader(input, (raw) => {
    const msg = collect(raw);
    if (!msg) return;
    if (msg.type === 'ext_hello') { extVersion = String(msg.version || ''); return; }
    const sock = clients.get(msg.conn);
    if (sock && !sock.destroyed) {
      const { conn, ...rest } = msg; // eslint-disable-line no-unused-vars
      lineWrite(sock, rest);
      if (msg.type === 'hello_result' && !msg.ok) sock.end();
    }
  });
  input.on('end', () => {
    // Chrome closed the port (browser or extension stopped): stop serving.
    for (const s of clients.values()) s.destroy();
    server.close();
    process.exit(0);
  });
  return server;
}

module.exports = { runHost };
