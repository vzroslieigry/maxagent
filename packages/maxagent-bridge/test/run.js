'use strict';
// Whole chain without Chrome: agent (JSON-RPC) → MCP server → local channel → host → fake extension.
// The fake extension speaks Chrome's native messaging framing and applies the real policy.js.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { nativeReader, nativeWrite, lineReader } = require('../lib/wire');
const P = require('../extension/policy');

const BIN = path.resolve(__dirname, '..', 'bin', 'maxagent-bridge.js');
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-bridge-test-'));
const ENV = { ...process.env, MAXAGENT_BRIDGE_HOME: BASE };
let failed = 0;
const check = (cond, name, extra) => {
  console.log(`${cond ? 'OK   ' : 'FAIL '} ${name}`);
  if (!cond) { failed++; if (extra !== undefined) console.log('      ', String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300)); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- policy (pure) ---------- */
check(P.decide('snapshot', 'read').allow, 'policy: read agent may snapshot');
check(!P.decide('click', 'read').allow, 'policy: read agent may not click');
check(P.decide('click', 'act').allow && !P.decide('click', 'act').confirm, 'policy: act agent clicks without confirmation');
check(P.decide('click', 'confirm').confirm, 'policy: confirm agent → confirmation');
check(P.decide('upload', 'act').confirm, 'policy: upload asks unless the owner remembered it for this agent and site');
check(P.uploadGrantKey('a', 'x.com') !== P.uploadGrantKey('b', 'x.com') && P.uploadGrantKey('a', 'x.com') !== P.uploadGrantKey('a', 'y.com'), 'policy: an upload permission is per agent and per site');
check(P.decide('click_at', 'act').allow && !P.decide('click_at', 'act').confirm && !P.decide('click_at', 'read').allow && P.decide('click_at', 'confirm').confirm, 'policy: click_at is an action like click');
check(P.TAB_CONTENT_TOOLS.has('click_at'), 'policy: click_at respects blocked sites');
check(!P.decide('evaluate_js', 'act').allow, 'policy: unknown tool refused');
check(!P.decide('evaluate', 'act').allow && !require('../lib/tools').TOOLS.some((t) => t.name === 'evaluate'), "no tool runs the agent's own code in a page (owner's rule 08.11.2026)");
{
  const drv = fs.readFileSync(path.join(__dirname, '..', 'extension', 'driver.js'), 'utf8');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'extension', 'sw.js'), 'utf8');
  check(!/globalThis\[|window\.__|__maxagent/.test(drv) && /createIsolatedWorld/.test(drv) && /contextId: executionContextId/.test(drv), 'page operations: isolated world, no variables left in the page');
  check(!/AudioNode\.prototype|captureStream|userGesture/.test(sw), 'tab audio: no hooks inside the page, only Chrome tab capture');
}
{
  const { bridgeBusy } = require('../lib/activity');
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-bridge-test-busy-'));
  const now = Date.now();
  check(!bridgeBusy(dirB, now).busy, 'quiet: no activity file → not busy');
  fs.writeFileSync(path.join(dirB, 'activity.json'), JSON.stringify({ lastCall: now - 2 * 60000, recording: [] }));
  check(bridgeBusy(dirB, now).busy && bridgeBusy(dirB, now).why === 'recent', 'busy: an agent called 2 min ago');
  fs.writeFileSync(path.join(dirB, 'activity.json'), JSON.stringify({ lastCall: now - 30 * 60000, recording: [] }));
  check(!bridgeBusy(dirB, now).busy, 'quiet: last call 30 min ago');
  fs.writeFileSync(path.join(dirB, 'activity.json'), JSON.stringify({ lastCall: now - 30 * 60000, recording: [5] }));
  check(bridgeBusy(dirB, now).why === 'recording', 'busy: a tab recording is running (even with no calls for 30 min)');
}
check(P.decide('record_tab_start', 'act').allow && !P.decide('record_tab_start', 'read').allow, 'policy: recording tab audio needs an act agent');
{
  const { saveRecording } = require('../lib/mcp');
  const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-bridge-test-audio-'));
  const rec = { base64: Buffer.from('webm-bytes').toString('base64'), size: 10, mimeType: 'audio/webm' };
  let r = saveRecording(rec, path.join(tmpA, 'a.webm'));
  check(r.ok && fs.readFileSync(path.join(tmpA, 'a.webm'), 'utf8') === 'webm-bytes' && !('base64' in r), 'record: .webm saved as is, no base64 back to the agent');
  r = saveRecording(rec, path.join(tmpA, 'b.mp3'), { ffmpeg: path.join(tmpA, 'no-such-ffmpeg') });
  check(!r.ok && /ffmpeg not found/.test(r.error) && fs.existsSync(path.join(tmpA, 'b.webm')) && !fs.existsSync(path.join(tmpA, 'b.mp3')), 'record: no ffmpeg → clear error, WebM kept (not a 0-byte mp3)', JSON.stringify(r));
  r = saveRecording(rec);
  check(r.ok && fs.existsSync(r.savedTo) && /maxagent-tab-audio-/.test(r.savedTo), 'record: no outputPath → a temp file, path returned');
  try { fs.unlinkSync(r.savedTo); } catch { /* temp */ }
}
check(P.urlDenied('https://online.sberbank.ru/x') && P.urlDenied('https://accounts.google.com/') && P.urlDenied('https://www.paypal.com/'), 'policy: banks / sign-in / payments blocked by default');
check(P.urlDenied('file:///C:/x') && P.urlDenied('chrome://settings'), 'policy: non-web pages refused');
check(!P.urlDenied('https://github.com/') && !P.urlDenied('https://web.telegram.org/k/'), 'policy: ordinary sites allowed');
check(!P.urlDenied('https://bank.example/', ['other.com']), 'policy: owner\'s own list replaces the default');

(async () => {
  /* ---------- fake extension + real host ---------- */
  const host = spawn(process.execPath, [BIN, 'host'], { env: ENV, stdio: ['pipe', 'pipe', 'inherit'] });
  const seen = { hellos: [], ready: false };
  const agents = {}; // agent → { keyHash, rights }
  const sessions = new Map();
  const OWNER = { worker: 'act', reader: 'read', stranger: null };
  const TABS = [
    { id: 1, windowId: 1, active: true, title: 'GitHub', url: 'https://github.com/' },
    { id: 2, windowId: 1, active: false, title: 'Bank', url: 'https://online.sberbank.ru/' },
  ];
  const BIG = 'A'.repeat(1500000); // bigger than Chrome's 1 MB extension→host limit
  const toHost = (msg) => { for (const part of P.chunks(`${msg.conn}:${msg.id}`, msg)) nativeWrite(host.stdin, part); };
  nativeReader(host.stdout, (msg) => {
    if (msg.type === 'host_ready') seen.ready = true;
    if (msg.type === 'reload') { seen.reloads = (seen.reloads || 0) + 1; setTimeout(() => nativeWrite(host.stdin, { type: 'ext_hello', version: '9.9.9' }), 300); }
    if (msg.type === 'hello') {
      seen.hellos.push(msg);
      const known = agents[msg.agent];
      if (known && known.keyHash !== msg.keyHash) return toHost({ type: 'hello_result', conn: msg.conn, ok: false, error: 'wrong_key' });
      if (!known) {
        const rights = OWNER[msg.agent];
        if (!rights) return toHost({ type: 'hello_result', conn: msg.conn, ok: false, error: 'owner_denied' });
        agents[msg.agent] = { keyHash: msg.keyHash, rights };
      }
      sessions.set(msg.conn, agents[msg.agent]);
      return toHost({ type: 'hello_result', conn: msg.conn, ok: true, rights: agents[msg.agent].rights });
    }
    if (msg.type === 'call') {
      const s = sessions.get(msg.conn);
      const reply = (ok, v) => toHost({ type: 'result', conn: msg.conn, id: msg.id, ok, ...(ok ? { result: v } : { error: v }) });
      const d = P.decide(msg.tool, s.rights);
      if (!d.allow) return reply(false, d.reason);
      const tab = TABS.find((t) => t.id === msg.args.tabId);
      if (tab && P.TAB_CONTENT_TOOLS.has(msg.tool)) { const why = P.urlDenied(tab.url); if (why) return reply(false, why); }
      if (msg.tool === 'tabs_list') return reply(true, TABS.map((t) => ({ tabId: t.id, url: P.urlDenied(t.url) ? '[blocked]' : t.url })));
      if (msg.tool === 'screenshot') return reply(true, { tabId: tab.id, mimeType: 'image/jpeg', data: BIG });
      if (msg.tool === 'tab_open') return reply(true, { tabId: 3, opened: true });
      return reply(true, { ok: true });
    }
  });
  for (let i = 0; i < 50 && !seen.ready; i++) await sleep(100);
  check(seen.ready, 'host started and opened the local channel');

  /* ---------- extension self-reload ---------- */
  const { refreshExtension } = require('../lib/install');
  fs.mkdirSync(path.join(BASE, 'extension'), { recursive: true });
  fs.writeFileSync(path.join(BASE, 'extension', 'manifest.json'), JSON.stringify({ version: '9.9.9' }));
  const quiet = () => {};
  check(await refreshExtension(BASE, quiet) === 'manual', 'reload: an old extension that never reported its version → manual step');
  nativeWrite(host.stdin, { type: 'ext_hello', version: '0.0.9' });
  await sleep(200);
  check(await refreshExtension(BASE, quiet) === 'reloaded' && seen.reloads === 1, 'reload: running 0.0.9, files 9.9.9 → extension told to reload and came back as 9.9.9');
  check(await refreshExtension(BASE, quiet) === 'current' && seen.reloads === 1, 'reload: already current → no reload');

  /* ---------- MCP client helper ---------- */
  function mcp(agent) {
    const p = spawn(process.execPath, [BIN, 'mcp', '--agent', agent], { env: ENV, stdio: ['pipe', 'pipe', 'inherit'] });
    const waiting = new Map();
    let next = 1;
    lineReader(p.stdout, (m) => { if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
    const rpc = (method, params) => new Promise((res) => { const id = next++; waiting.set(id, res); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
    return { rpc, call: (name, args = {}) => rpc('tools/call', { name, arguments: args }), close: () => p.stdin.end() };
  }
  const text = (r) => (r.result && r.result.content || []).map((c) => c.text || '').join('');

  const w = mcp('worker');
  let r = await w.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  check(r.result && r.result.serverInfo.name === 'maxagent-bridge' && r.result.capabilities.tools, 'MCP initialize');
  r = await w.rpc('tools/list', {});
  const names = r.result.tools.map((t) => t.name);
  check(['tabs_list', 'tab_open', 'tab_close', 'tab_activate', 'navigate', 'snapshot', 'screenshot', 'click', 'type', 'press_key', 'scroll', 'upload', 'launch_browser'].every((n) => names.includes(n)), `MCP tools/list: ${names.length} tools`);

  r = await w.call('tabs_list');
  check(!r.result.isError && /github\.com/.test(text(r)) && /\[blocked\]/.test(text(r)), 'tabs_list through the whole chain; bank tab hidden', text(r));
  const keyFile = path.join(BASE, 'keys', 'worker.key');
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  check(/^[0-9a-f]{64}$/.test(key), 'agent key created (32 random bytes)');
  check(seen.hellos.length === 1 && seen.hellos[0].keyHash && !JSON.stringify(seen.hellos).includes(key), 'extension sees only the key hash, never the key');

  r = await w.call('snapshot', { tabId: 2 });
  check(r.result.isError && /site_blocked_by_owner/.test(text(r)), 'snapshot of a bank tab refused', text(r));
  r = await w.call('screenshot', { tabId: 1 });
  const img = r.result.content.find((c) => c.type === 'image');
  check(img && img.data.length === BIG.length && img.mimeType === 'image/jpeg', '1.5 MB screenshot arrives whole (chunks glued)');
  r = await w.call('tab_open', { url: 'https://example.com' });
  check(!r.result.isError && /"opened": true/.test(text(r)), 'act agent opens a tab');
  w.close();

  const w2 = mcp('worker');
  await w2.rpc('initialize', {});
  r = await w2.call('tabs_list');
  check(!r.result.isError && seen.hellos.length === 2 && seen.hellos[1].keyHash === seen.hellos[0].keyHash, 'same agent reconnects with the same key, no new approval');
  w2.close();

  const rd = mcp('reader');
  await rd.rpc('initialize', {});
  r = await rd.call('tab_open', { url: 'https://example.com' });
  check(r.result.isError && /read_only_agent/.test(text(r)), 'read-only agent cannot open tabs', text(r));
  r = await rd.call('snapshot', { tabId: 1 });
  check(!r.result.isError, 'read-only agent can take a snapshot');
  rd.close();

  const st = mcp('stranger');
  await st.rpc('initialize', {});
  r = await st.call('tabs_list');
  check(r.result.isError && /owner_denied/.test(text(r)), 'agent the owner refused gets nothing', text(r));
  st.close();

  // Someone else claims to be "worker" with a different key.
  fs.writeFileSync(keyFile, 'f'.repeat(64) + '\n');
  const fake = mcp('worker');
  await fake.rpc('initialize', {});
  r = await fake.call('tabs_list');
  check(r.result.isError && /wrong_key/.test(text(r)), 'same agent name with another key refused', text(r));
  fake.close();

  host.stdin.end(); // Chrome closes the port
  await sleep(500);
  const off = mcp('worker');
  await off.rpc('initialize', {});
  r = await off.call('browser_status');
  check(/browser_not_connected/.test(text(r)) && /"connected": false/.test(text(r)), 'no browser → browser_status explains, no crash', text(r));
  r = await off.call('tabs_list');
  check(r.result.isError && /launch_browser/.test(text(r)) && /NOT the owner/.test(text(r)), 'no browser → tool error: one fix launch_browser, other chrome.exe are not the owner\'s');
  // Owner's own launcher from launch.json; restart=true adds its restart flag.
  fs.writeFileSync(path.join(BASE, 'launch.json'), JSON.stringify({ launch: [process.execPath, '-e', 'console.log("up " + process.argv.slice(1).join(" "))', '--'] }));
  r = await off.call('launch_browser', { restart: true });
  check(/up --restart/.test(text(r)) && /"exitCode": 0/.test(text(r)), 'launch_browser runs the owner launcher from launch.json (+ --restart)', text(r));
  fs.unlinkSync(path.join(BASE, 'launch.json'));
  off.close();

  /* ---------- installer in a fake home ---------- */
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-bridge-home-'));
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ numStartups: 5, mcpServers: { other: { command: 'x' } } }));
  fs.mkdirSync(path.join(home, '.codex'));
  const codexOwn = 'model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "y"\n';
  fs.writeFileSync(path.join(home, '.codex', 'config.toml'), codexOwn);
  fs.mkdirSync(path.join(home, '.gemini'));
  const run = (...a) => spawnSync(process.execPath, [BIN, ...a, '--home', home], { encoding: 'utf8' });
  let x = run('install', '--no-agents');
  check(x.status === 0 && !JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8')).mcpServers['maxagent-bridge'] && !fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8').includes('maxagent-bridge'), '--no-agents: MCP not added to any agent');
  fs.rmSync(path.join(home, '.maxagent-bridge'), { recursive: true, force: true }); // created by the line above
  x = run('install', '--dry-run');
  check(x.status === 0 && !fs.existsSync(path.join(home, '.maxagent-bridge')), 'install --dry-run writes nothing');
  x = run('install');
  check(x.status === 0, 'install exit 0', x.stderr);
  const b = path.join(home, '.maxagent-bridge');
  const man = JSON.parse(fs.readFileSync(path.join(b, 'com.maxagent.bridge.json'), 'utf8'));
  check(man.type === 'stdio' && man.allowed_origins.length === 1 && man.allowed_origins[0] === 'chrome-extension://ealhofpddpiflgfjklhccoihlokddgei/' && fs.existsSync(man.path), 'host manifest: only our extension, launcher exists');
  check(fs.existsSync(path.join(b, 'extension', 'manifest.json')) && fs.existsSync(path.join(b, 'app', 'lib', 'host.js')), 'extension and program copied to a stable folder');
  const cj = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'));
  check(cj.numStartups === 5 && cj.mcpServers.other && cj.mcpServers['maxagent-bridge'].args.includes('claude-code'), 'Claude Code: MCP added, other settings kept');
  check(JSON.parse(fs.readFileSync(path.join(home, '.claude.json.maxagent-bridge-backup'), 'utf8')).mcpServers.other && fs.readFileSync(path.join(home, '.codex', 'config.toml.maxagent-bridge-backup'), 'utf8') === codexOwn, 'backup of agent settings before the first change');
  const toml = fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8');
  check(toml.startsWith(codexOwn.trimEnd()) && /\[mcp_servers\.maxagent-bridge\]/.test(toml) && /tool_timeout_sec = 200/.test(toml), 'Codex: MCP block added after own config');
  const ag = JSON.parse(fs.readFileSync(path.join(home, '.gemini', 'config', 'mcp_config.json'), 'utf8'));
  check(ag.mcpServers['maxagent-bridge'].args.includes('antigravity'), 'Antigravity: MCP added');
  x = run('install');
  check((fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8').match(/maxagent-bridge:start/g) || []).length === 1, 'second install: no duplicate Codex block');
  fs.writeFileSync(path.join(b, 'activity.json'), JSON.stringify({ lastCall: Date.now() - 60000, recording: [] }));
  x = run('install');
  check(x.status === 3 && /отложена|postponed/.test(x.stdout) && fs.existsSync(path.join(b, 'extension', 'manifest.json')), 'install while an agent works: files copied, extension reload postponed (exit 3)', x.stdout);
  x = run('reload');
  check(x.status === 3, 'reload while busy: postponed');
  fs.unlinkSync(path.join(b, 'activity.json'));
  x = run('doctor');
  check(x.status === 0 && /INFO/.test(x.stdout), 'doctor: 0 errors, browser not connected reported as info', x.stdout);
  x = run('uninstall');
  check(x.status === 0, 'uninstall exit 0');
  check(fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8').trimEnd() === codexOwn.trimEnd(), 'Codex config back to the owner\'s own');
  const cj2 = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'));
  check(cj2.mcpServers.other && !cj2.mcpServers['maxagent-bridge'] && cj2.numStartups === 5, 'Claude Code: only our MCP removed');

  fs.rmSync(home, { recursive: true, force: true }); // throwaway folders created above
  fs.rmSync(BASE, { recursive: true, force: true });
  console.log(failed ? `\n${failed} FAILED` : '\nALL OK');
  process.exit(failed ? 1 : 0);
})();
