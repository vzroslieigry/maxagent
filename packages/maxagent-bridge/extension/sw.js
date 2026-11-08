/* maxagent bridge — background service worker.
   All decisions live here, where the owner sees them: which agent may connect (asked once),
   rights per agent, blocked sites, confirmations, the action log and the stop switch. */
importScripts("policy.js", "driver.js");

const HOST = "com.maxagent.bridge";
// Версия КОДА (не манифеста): по ней установщик видит, что Chrome действительно загрузил новый скрипт.
// Chrome после перезапуска перечитывает манифест, но может держать старый код фонового скрипта из кэша (05.11.2026).
// Поднимать вместе с "version" в manifest.json.
const CODE_VERSION = "0.1.5";
const P = globalThis.maxagentPolicy;
const D = globalThis.maxagentDriver;
const LOG_MAX = 300;

let port = null;
let hostState = { connected: false, error: null };
const sessions = new Map();   // conn → { agent, rights }
const snapshots = new Map();  // `${tabId}:${snapshotId}` → documentId
const decisions = new Map();  // request id → resolve (approval windows)

/* ---------- storage ---------- */

const store = {
  async get(key, def) { const o = await chrome.storage.local.get(key); return o[key] === undefined ? def : o[key]; },
  set: (key, value) => chrome.storage.local.set({ [key]: value }),
};
async function log(entry) {
  const list = await store.get("log", []);
  list.unshift({ at: new Date().toISOString(), ...entry });
  await store.set("log", list.slice(0, LOG_MAX));
}
const blocklist = () => store.get("blocklist", P.DEFAULT_BLOCKLIST);

/* ---------- native host ---------- */

function send(msg) {
  if (!port) return;
  // Keep the project's ~200k-character chunks; Chrome→host allows 64 MiB, host→Chrome allows 1 MiB.
  for (const part of P.chunks(`${msg.conn}:${msg.id}`, msg)) port.postMessage(part);
}

function connectHost() {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(HOST);
  } catch (e) {
    hostState = { connected: false, error: String(e.message || e) };
    return;
  }
  port.onMessage.addListener(onHostMessage);
  port.postMessage({ type: "ext_hello", version: CODE_VERSION, manifestVersion: chrome.runtime.getManifest().version });
  port.onDisconnect.addListener(() => {
    hostState = { connected: false, error: chrome.runtime.lastError?.message || "host_disconnected" };
    port = null;
    sessions.clear();
    setTimeout(connectHost, 5000);
  });
}

async function onHostMessage(msg) {
  if (msg.type === "host_ready") { hostState = { connected: true, error: null }; return; }
  if (msg.type === "host_error") { hostState = { connected: false, error: msg.error }; return; }
  if (msg.type === "bye") { sessions.delete(msg.conn); return; }
  if (msg.type === "reload") {
    // The installer copied new files: re-read them from disk (an unpacked extension cannot update itself otherwise).
    await log({ agent: "installer", tool: "reload", ok: true, note: `from ${chrome.runtime.getManifest().version}` });
    setTimeout(() => chrome.runtime.reload(), 200);
    return;
  }
  if (msg.type === "hello") return onHello(msg);
  if (msg.type === "call") return onCall(msg);
}

/* ---------- approval windows ---------- */

async function askOwner(request, timeoutMs = 170000) {
  const id = crypto.randomUUID();
  await store.set(`req:${id}`, request);
  const win = await chrome.windows.create({ url: `approve.html?id=${id}`, type: "popup", width: 480, height: 420, focused: true });
  return new Promise((resolve) => {
    const finish = (answer) => {
      decisions.delete(id);
      clearTimeout(timer);
      chrome.windows.onRemoved.removeListener(onClosed);
      chrome.storage.local.remove(`req:${id}`);
      chrome.windows.remove(win.id).catch(() => {});
      resolve(answer);
    };
    const onClosed = (wid) => { if (wid === win.id) finish({ allow: false, reason: "window_closed" }); };
    const timer = setTimeout(() => finish({ allow: false, reason: "no_answer" }), timeoutMs);
    chrome.windows.onRemoved.addListener(onClosed);
    decisions.set(id, finish);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "decision" && decisions.has(msg.id)) decisions.get(msg.id)(msg.answer);
  if (msg.type === "status") {
    sendResponse({ host: hostState, agents: [...sessions.values()].map((s) => s.agent) });
    return true;
  }
  if (msg.type === "revoke") {
    for (const [conn, s] of sessions) if (s.agent === msg.agent) sessions.delete(conn);
  }
  return false;
});

/* ---------- agents ---------- */

async function onHello({ conn, agent, keyHash }) {
  const agents = await store.get("agents", {});
  const known = agents[agent];
  if (known && known.keyHash === keyHash) {
    sessions.set(conn, { agent, rights: known.rights });
    await log({ agent, tool: "connect", ok: true });
    return send({ type: "hello_result", conn, ok: true, rights: known.rights });
  }
  if (known && known.keyHash !== keyHash) {
    await log({ agent, tool: "connect", ok: false, error: "wrong_key" });
    return send({ type: "hello_result", conn, ok: false, error: "wrong_key: this agent name is already paired with a different key; the owner can remove it in the extension popup" });
  }
  const answer = await askOwner({ kind: "pair", agent });
  if (!answer.allow) {
    await log({ agent, tool: "connect", ok: false, error: "owner_denied" });
    return send({ type: "hello_result", conn, ok: false, error: "owner_denied: the owner did not allow this agent to use the browser" });
  }
  agents[agent] = { keyHash, rights: answer.rights, pairedAt: new Date().toISOString() };
  await store.set("agents", agents);
  sessions.set(conn, { agent, rights: answer.rights });
  await log({ agent, tool: "connect", ok: true, note: `paired: ${answer.rights}` });
  send({ type: "hello_result", conn, ok: true, rights: answer.rights });
}

/* ---------- calls ---------- */

const tabMeta = async (t, bl) => {
  const denied = P.urlDenied(t.url || "", bl);
  return { tabId: t.id, windowId: t.windowId, active: t.active, title: denied ? "[blocked]" : t.title, url: denied ? `[${denied}]` : t.url };
};

async function onCall({ conn, id, tool, args }) {
  const s = sessions.get(conn);
  const reply = (ok, payload) => send({ type: "result", conn, id, ok, ...(ok ? { result: payload } : { error: payload }) });
  if (!s) return reply(false, "not_paired");
  const entry = { agent: s.agent, tool, tabId: args.tabId };
  try {
    if (tool === "browser_status") {
      return reply(true, { connected: true, rights: s.rights, stopped: await store.get("stopped", false), extensionVersion: chrome.runtime.getManifest().version });
    }
    if (await store.get("stopped", false)) throw new Error("bridge_stopped_by_owner");
    const d = P.decide(tool, s.rights);
    if (!d.allow) throw new Error(d.reason);
    const bl = await blocklist();
    let tab = null;
    if (typeof args.tabId === "number" || P.TAB_CONTENT_TOOLS.has(tool) || ["tab_close", "tab_activate"].includes(tool)) {
      tab = await chrome.tabs.get(Number(args.tabId));
      entry.site = P.hostOf(tab.url);
      if (P.TAB_CONTENT_TOOLS.has(tool)) { const why = P.urlDenied(tab.url, bl); if (why) throw new Error(why); }
    }
    if ((tool === "navigate" && !["back", "forward", "reload"].includes(args.url)) || tool === "tab_open") {
      const why = P.urlDenied(args.url, bl);
      if (why) throw new Error(why);
      entry.to = P.hostOf(args.url);
    }
    if (d.confirm) {
      const answer = await askOwner({ kind: "action", agent: s.agent, tool, site: entry.site || entry.to || "", detail: describeAction(tool, args) });
      if (!answer.allow) throw new Error("owner_denied_this_action");
    }
    const result = await run(tool, args, tab, bl);
    await log({ ...entry, ok: true });
    reply(true, result);
  } catch (e) {
    await log({ ...entry, ok: false, error: String(e.message || e).slice(0, 200) });
    reply(false, String(e.message || e));
  }
}

function describeAction(tool, args) {
  if (tool === "type") return `text, ${String(args.text || "").length} characters`;
  if (tool === "upload") return `files: ${(args.files || []).map((f) => String(f).split(/[\\/]/).pop()).join(", ")}`;
  if (tool === "navigate" || tool === "tab_open") return String(args.url || "");
  return args.elementId ? `element ${args.elementId}` : "";
}

const docFor = (tabId, snapshotId) => {
  const doc = snapshots.get(`${tabId}:${snapshotId}`);
  if (!doc) throw new Error("unknown_snapshot_take_a_new_one");
  return doc;
};

async function snapshot(tab, args) {
  return D.withDebugger(tab.id, async (target) => {
    const page = await D.evaluate(target, { action: "inspect", maxElements: args.maxElements, maxText: args.maxText });
    snapshots.set(`${tab.id}:${page.snapshotId}`, page.documentId);
    if (snapshots.size > 200) snapshots.delete(snapshots.keys().next().value);
    const { documentId, ...rest } = page;
    return { tabId: tab.id, ...rest };
  });
}

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts && contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Recording tab audio"
  });
}

async function closeOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts && contexts.length > 0) {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}

async function run(tool, args, tab, bl) {
  switch (tool) {
    case "record_tab_start": {
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      await ensureOffscreen();
      const resp = await chrome.runtime.sendMessage({
        target: "offscreen",
        type: "START_RECORDING",
        streamId,
        mute: Boolean(args.mute)
      });
      if (!resp || !resp.ok) throw new Error(resp?.error || "failed_to_start_recording");
      return { recording: true, tabId: tab.id, ...resp.res };
    }
    case "record_tab_stop": {
      const resp = await chrome.runtime.sendMessage({
        target: "offscreen",
        type: "STOP_RECORDING"
      });
      await closeOffscreen();
      if (!resp || !resp.ok) throw new Error(resp?.error || "failed_to_stop_recording");
      return { tabId: tab.id, ...resp.data };
    }
    case "evaluate":
      return D.withDebugger(tab.id, async (target) => {
        const r = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
          expression: String(args.expression),
          returnByValue: true,
          awaitPromise: true
        });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || r.exceptionDetails.exception?.description || "eval_failed");
        return r.result?.value;
      });
    case "tabs_list":
      return Promise.all((await chrome.tabs.query({})).map((t) => tabMeta(t, bl)));
    case "tab_open": {
      const t = await chrome.tabs.create({ url: String(args.url), active: Boolean(args.active) });
      return { tabId: t.id, opened: true };
    }
    case "tab_close":
      await chrome.tabs.remove(tab.id);
      return { closed: true };
    case "tab_activate":
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      return { activated: true };
    case "navigate":
      if (args.url === "back") await chrome.tabs.goBack(tab.id);
      else if (args.url === "forward") await chrome.tabs.goForward(tab.id);
      else if (args.url === "reload") await chrome.tabs.reload(tab.id);
      else await chrome.tabs.update(tab.id, { url: String(args.url) });
      return { navigated: true, takeSnapshot: true };
    case "snapshot":
      return snapshot(tab, args);
    case "screenshot":
      return D.withDebugger(tab.id, async (target) => ({ tabId: tab.id, url: tab.url, mimeType: "image/jpeg", data: await D.screenshot(target) }));
    case "read":
    case "scroll":
    case "click":
    case "type":
    case "press_key":
    case "upload":
      return pageAction(tool, args, tab);
    default:
      throw new Error(`unknown_tool: ${tool}`);
  }
}

async function pageAction(tool, args, tab) {
  // A tab nobody sees gets no real input events from Chrome: click/type go through the DOM there,
  // keys and file uploads need the tab in front.
  const win = await chrome.windows.get(tab.windowId);
  const background = !tab.active || win.state === "minimized";
  if (background && (tool === "press_key" || tool === "upload")) throw new Error(`${tool}_needs_a_visible_tab: call tab_activate first (this brings the tab to the owner's screen)`);
  if (background && (tool === "click" || tool === "type")) {
    const base = { documentId: docFor(tab.id, args.snapshotId), snapshotId: args.snapshotId, elementId: args.elementId };
    const prepared = await D.withDebugger(tab.id, (target) => D.evaluate(target, { ...base, action: tool === "click" ? "dom_click" : "dom_fill", text: args.text, clear: args.clear }));
    await new Promise((r) => setTimeout(r, 300));
    const after = await chrome.tabs.get(tab.id);
    return { done: true, method: "dom (background tab)", navigated: after.url !== tab.url || after.status === "loading", url: after.url, takeSnapshot: true, element: prepared.element };
  }
  if (tool === "press_key" && !args.elementId) {
    await D.withDebugger(tab.id, (target) => D.key(target, args.key));
    return { pressed: true };
  }
  if (tool === "scroll" && !args.elementId) {
    await D.withDebugger(tab.id, (target) => chrome.debugger.sendCommand(target, "Runtime.evaluate", { expression: `scrollBy(${Number(args.x) || 0}, ${Number(args.y) || 0})` }));
    return { scrolled: true };
  }
  const base = { documentId: docFor(tab.id, args.snapshotId), snapshotId: args.snapshotId, elementId: args.elementId };
  const op = { read: "read", scroll: "scroll", click: "prepare_click", upload: "prepare_click", type: "prepare_fill", press_key: "prepare_key" }[tool];
  const result = await D.withDebugger(tab.id, async (target) => {
    const prepared = await D.evaluate(target, { ...base, action: op, offset: args.offset, length: args.length, x: args.x, y: args.y });
    if (tool === "click") await D.click(target, prepared.x, prepared.y);
    if (tool === "upload") Object.assign(prepared, await D.upload(target, D.validateFiles(args.files), () => D.click(target, prepared.x, prepared.y)));
    if (tool === "type") {
      if (args.clear) { await D.key(target, "Control+A"); await D.key(target, "Backspace"); }
      await chrome.debugger.sendCommand(target, "Input.insertText", { text: String(args.text ?? "") });
    }
    if (tool === "press_key") await D.key(target, args.key);
    return prepared;
  });
  if (tool === "read" || tool === "scroll") return result;
  const after = await chrome.tabs.get(tab.id);
  return { done: true, navigated: after.url !== tab.url, url: after.url, takeSnapshot: true, ...(result.uploadedFiles ? { uploadedFiles: result.uploadedFiles } : {}) };
}

/* ---------- start ---------- */

chrome.runtime.onStartup.addListener(connectHost);
chrome.runtime.onInstalled.addListener(connectHost);
connectHost();
