/* Access policy: pure functions, shared by the extension and the Node tests. */
(function (root) {
  // Sites where the bridge never works by default: banks, payments, sign-in and account recovery.
  // The owner edits this list in the extension popup.
  const DEFAULT_BLOCKLIST = [
    "*bank*", "*banking*", "paypal.com", "*.paypal.com", "*.stripe.com", "checkout.*", "pay.*", "payments.*",
    "accounts.google.com", "myaccount.google.com", "passwords.google.com", "login.*", "signin.*", "auth.*",
    "account.live.com", "login.live.com", "appleid.apple.com", "id.apple.com",
    "*.gosuslugi.ru", "gosuslugi.ru", "*sberbank*", "online.sberbank.ru", "*.tinkoff.ru", "*.tbank.ru", "*.privatbank.ua", "*.monobank.ua",
  ];

  const READ_TOOLS = new Set(["browser_status", "tabs_list", "snapshot", "screenshot", "read", "scroll"]);
  const ACT_TOOLS = new Set(["tab_open", "tab_close", "tab_activate", "navigate", "click", "type", "press_key", "upload", "click_at", "record_tab_start", "record_tab_stop"]);
  const ALWAYS_CONFIRM = new Set(["upload"]);
  // Tools that touch the page content of a given tab (blocklist is checked against the tab URL).
  const TAB_CONTENT_TOOLS = new Set(["snapshot", "screenshot", "read", "click", "type", "press_key", "scroll", "upload", "click_at", "navigate", "record_tab_start", "record_tab_stop"]);

  const globToRe = (glob) => new RegExp("^" + String(glob).trim().toLowerCase().replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");

  function hostOf(url) {
    try {
      const u = new URL(String(url));
      return ["http:", "https:"].includes(u.protocol) ? u.hostname.toLowerCase() : null;
    } catch {
      return null;
    }
  }

  /** null = allowed; otherwise a reason string. */
  function urlDenied(url, blocklist) {
    if (url === "about:blank" || url === "chrome://newtab/") return null;
    const host = hostOf(url);
    if (!host) return "only_http_https_pages";
    for (const g of blocklist || DEFAULT_BLOCKLIST) {
      if (g && globToRe(g).test(host)) return `site_blocked_by_owner: ${host}`;
    }
    return null;
  }

  /**
   * rights: "read" | "act" | "confirm"
   * returns { allow: bool, confirm: bool, reason? }
   */
  function decide(tool, rights) {
    if (READ_TOOLS.has(tool)) return { allow: true, confirm: false };
    if (!ACT_TOOLS.has(tool)) return { allow: false, reason: `unknown_tool: ${tool}` };
    if (rights === "read") return { allow: false, reason: "read_only_agent: the owner allowed this agent only to read pages" };
    if (rights !== "act" && rights !== "confirm") return { allow: false, reason: "agent_not_approved" };
    return { allow: true, confirm: rights === "confirm" || ALWAYS_CONFIRM.has(tool) };
  }

  /** A remembered upload permission belongs to one agent on one site. */
  function uploadGrantKey(agent, site) { return `${agent}\n${site}`; }

  /** Project chunk size: Native Messaging allows 64 MiB Chrome→host and 1 MiB host→Chrome. */
  function chunks(id, obj, size = 200000) {
    const s = JSON.stringify(obj);
    if (s.length <= size) return [obj];
    const n = Math.ceil(s.length / size);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ type: "chunk", id, i, n, data: s.slice(i * size, (i + 1) * size) });
    return out;
  }

  const api = { DEFAULT_BLOCKLIST, READ_TOOLS, ACT_TOOLS, TAB_CONTENT_TOOLS, urlDenied, decide, uploadGrantKey, chunks, hostOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.maxagentPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
