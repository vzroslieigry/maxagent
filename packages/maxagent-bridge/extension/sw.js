/* maxagent bridge — background service worker.
   All decisions live here, where the owner sees them: which agent may connect (asked once),
   rights per agent, blocked sites, confirmations, the action log and the stop switch. */
importScripts("policy.js", "driver.js");

const HOST = "com.maxagent.bridge";
// Версия КОДА (не манифеста): по ней установщик видит, что Chrome действительно загрузил новый скрипт.
// Chrome после перезапуска перечитывает манифест, но может держать старый код фонового скрипта из кэша (05.11.2026).
// Поднимать вместе с "version" в manifest.json.
const CODE_VERSION = "0.6.0";
const P = globalThis.maxagentPolicy;
const D = globalThis.maxagentDriver;
const LOG_MAX = 300;

let port = null;
let hostState = { connected: false, error: null };
const sessions = new Map();   // conn → { agent, rights }
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
      const site = entry.site || entry.to || "";
      // Upload: the owner may allow it once or for this agent on this site. A "confirm every action" agent is always asked.
      const canRemember = tool === "upload" && s.rights === "act" && Boolean(site);
      if (!(canRemember && await uploadGranted(s.agent, site))) {
        const answer = await askOwner({ kind: "action", agent: s.agent, tool, site, detail: describeAction(tool, args), canRemember });
        if (!answer.allow) throw new Error("owner_denied_this_action");
        if (canRemember && answer.remember) await grantUpload(s.agent, site);
      }
    }
    const result = await run(tool, args, tab, bl);
    await log({ ...entry, ok: true });
    reply(true, result);
  } catch (e) {
    await log({ ...entry, ok: false, error: String(e.message || e).slice(0, 200) });
    reply(false, String(e.message || e));
  }
}

async function uploadGranted(agent, site) {
  const { uploadGrants = {} } = await chrome.storage.local.get("uploadGrants");
  return Boolean(uploadGrants[P.uploadGrantKey(agent, site)]);
}
async function grantUpload(agent, site) {
  const { uploadGrants = {} } = await chrome.storage.local.get("uploadGrants");
  uploadGrants[P.uploadGrantKey(agent, site)] = new Date().toISOString();
  await chrome.storage.local.set({ uploadGrants });
}

function describeAction(tool, args) {
  if (tool === "click_at") return `x ${args.x}, y ${args.y}`;
  if (tool === "type") return `text, ${String(args.text || "").length} characters`;
  if (tool === "upload") return `files: ${(args.files || []).map((f) => String(f).split(/[\\/]/).pop()).join(", ")}`;
  if (tool === "navigate" || tool === "tab_open") return String(args.url || "");
  return args.elementId ? `element ${args.elementId}` : "";
}

// Snapshots live in the extension, not in the page: documentId, capture time and each element's signature.
// chrome.storage.session — the service worker sleeps after ~30 s idle and would forget a Map.
const SNAP_TTL = 120000;
async function snapRecord(tabId, snapshotId) {
  const key = `snap:${tabId}:${snapshotId}`;
  const rec = (await chrome.storage.session.get(key))[key];
  if (!rec) throw new Error("unknown_snapshot_take_a_new_one");
  if (Date.now() - rec.at > SNAP_TTL) throw new Error("snapshot_expired_take_a_new_one");
  return rec;
}
async function elementRef(tabId, args) {
  const rec = await snapRecord(tabId, args.snapshotId);
  const signature = rec.sigs[args.elementId];
  if (!signature) throw new Error("unknown_element_take_a_new_snapshot");
  return { documentId: rec.doc, elementId: args.elementId, signature };
}

async function snapshot(tab, args) {
  return D.withDebugger(tab.id, async (target) => {
    const { documentId, signatures, ...page } = await D.evaluate(target, { action: "inspect", maxElements: args.maxElements, maxText: args.maxText, viewport: args.viewport, query: args.query, full: args.format === "full" });
    const snapshotId = crypto.randomUUID();
    const at = Date.now();
    const all = await chrome.storage.session.get(null);
    const old = Object.keys(all).filter((k) => k.startsWith("snap:") && at - all[k].at > SNAP_TTL);
    if (old.length) await chrome.storage.session.remove(old);
    await chrome.storage.session.set({ [`snap:${tab.id}:${snapshotId}`]: { doc: documentId, at, sigs: signatures } });
    if (args.format !== "full") return P.compactSnapshot({ tabId: tab.id, snapshotId }, page);
    return { tabId: tab.id, snapshotId, capturedAt: new Date(at).toISOString(), ...page };
  });
}

/* ---------- tab audio: Chrome's own tab capture only ---------- */

// tabId → true while recording. In chrome.storage.session: the service worker sleeps after ~30 s idle.
const recordings = {
  async get(id) { return (await chrome.storage.session.get("rec"))?.rec?.[id]; },
  async set(id) { const o = (await chrome.storage.session.get("rec")).rec || {}; o[id] = true; await chrome.storage.session.set({ rec: o }); },
  async delete(id) { const o = (await chrome.storage.session.get("rec")).rec || {}; delete o[id]; await chrome.storage.session.set({ rec: o }); },
};

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
      if (await recordings.get(tab.id)) throw new Error("already_recording_this_tab");
      // Recorded by the browser, the page sees nothing. Chrome allows it only after the owner clicked the
      // extension icon on this tab (once; it lasts until the tab closes or leaves the site).
      let streamId;
      try {
        streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      } catch (e) {
        if (/activeTab|invoked|cannot be captured|gesture/i.test(String(e.message || e))) throw new Error("owner_click_needed: ask the owner to click the maxagent bridge icon on this tab once (Chrome allows tab audio only after that), then call record_tab_start again");
        throw e;
      }
      await ensureOffscreen();
      const resp = await chrome.runtime.sendMessage({ target: "offscreen", type: "START_RECORDING", streamId, mute: Boolean(args.mute) });
      if (!resp || !resp.ok) throw new Error(resp?.error || "failed_to_start_recording");
      await recordings.set(tab.id);
      return { recording: true, tabId: tab.id, ...resp.res };
    }
    case "record_tab_stop": {
      if (!(await recordings.get(tab.id))) throw new Error("not_recording_this_tab");
      await recordings.delete(tab.id);
      const resp = await chrome.runtime.sendMessage({ target: "offscreen", type: "STOP_RECORDING" });
      await closeOffscreen();
      if (!resp || !resp.ok) throw new Error(resp?.error || "failed_to_stop_recording");
      return { tabId: tab.id, ...resp.data };
    }
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
      return D.withDebugger(tab.id, async (target) => {
        const view = await D.evaluate(target, { action: "viewport" });
        const image = await D.fitImage(await D.screenshot(target));
        await chrome.storage.session.set({ [`shot:${tab.id}`]: { at: Date.now(), url: tab.url, view, width: image.width, height: image.height } });
        return { tabId: tab.id, url: tab.url, mimeType: "image/jpeg", data: image.data, width: image.width, height: image.height, cssWidth: view.width, cssHeight: view.height };
      });
    case "click_at":
      return clickAt(tab, args);
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

/** Click by pixels of the latest screenshot of this tab: for what is not in the snapshot (players, canvas). */
async function clickAt(tab, args) {
  const win = await chrome.windows.get(tab.windowId);
  if (!tab.active || win.state === "minimized") throw new Error("click_at_needs_a_visible_tab: call tab_activate first (this brings the tab to the owner's screen)");
  const key = `shot:${tab.id}`;
  const shot = (await chrome.storage.session.get(key))[key];
  if (!shot || Date.now() - shot.at > SNAP_TTL || shot.url !== tab.url) throw new Error("take_a_new_screenshot_first");
  const x = typeof args.x === "number" ? args.x : NaN, y = typeof args.y === "number" ? args.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= shot.width || y >= shot.height) throw new Error(`click_at_outside_the_screenshot: it is ${shot.width}x${shot.height}`);
  await D.withDebugger(tab.id, async (target) => {
    const view = await D.evaluate(target, { action: "viewport" });
    if (view.width !== shot.view.width || view.height !== shot.view.height) throw new Error("take_a_new_screenshot_first");
    await D.click(target, (x + 0.5) * view.width / shot.width, (y + 0.5) * view.height / shot.height);
  });
  await chrome.storage.session.remove(key);
  await new Promise((r) => setTimeout(r, 300));
  const after = await chrome.tabs.get(tab.id);
  return { done: true, navigated: after.url !== tab.url || after.status === "loading", url: after.url };
}

async function pageAction(tool, args, tab) {
  // A tab nobody sees gets no real input events from Chrome: click/type go through the DOM there,
  // keys and file uploads need the tab in front.
  const win = await chrome.windows.get(tab.windowId);
  const background = !tab.active || win.state === "minimized";
  if (background && (tool === "press_key" || tool === "upload")) throw new Error(`${tool}_needs_a_visible_tab: call tab_activate first (this brings the tab to the owner's screen)`);
  if (background && (tool === "click" || tool === "type")) {
    const base = await elementRef(tab.id, args);
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
    await D.withDebugger(tab.id, (target) => D.evaluate(target, { action: "page_scroll", x: args.x, y: args.y }));
    return { scrolled: true };
  }
  const base = await elementRef(tab.id, args);
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

