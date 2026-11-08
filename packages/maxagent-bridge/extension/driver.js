/* Universal page driver: one fixed page operation for any site, run through chrome.debugger.
   A universal driver: no site-specific code. */

function maxagentPageOperation(request) {
  const stateKey = "__maxagentBridgeV1";
  const state = globalThis[stateKey] ||= {
    documentId: crypto.randomUUID(), counter: 0, ids: new WeakMap(), nodes: new Map(),
    snapshotId: null, capturedAt: null, signatures: new Map(),
  };
  const limit = (value, fallback, maximum) => Math.min(maximum, Math.max(0, Number(value) || fallback));
  const compact = (value, maximum = 400) => String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
  const rendered = (node) => {
    const style = node.ownerDocument.defaultView.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && style.display !== "none"
      && style.visibility !== "hidden" && style.visibility !== "collapse";
  };
  // Password, hidden, one-time-code and card fields are never read or filled.
  const secret = (node) => node.matches('input[type="password"], input[type="hidden"], input[autocomplete*="password"], input[autocomplete^="cc-"], input[autocomplete="one-time-code"], input[name*="cvv" i], input[name*="cvc" i], input[name*="cardnumber" i]');
  const nodeText = (node) => secret(node) ? "[redacted]" : node.innerText || node.textContent || "";
  const label = (node) => compact(node.getAttribute("aria-label")
    || node.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => node.ownerDocument.getElementById(id)?.textContent || "").join(" ")
    || Array.from(node.labels || []).map((item) => item.innerText).join(" ")
    || node.getAttribute("alt") || node.getAttribute("title") || node.getAttribute("placeholder") || nodeText(node));
  const register = (node) => {
    if (!state.ids.has(node)) state.ids.set(node, `e${++state.counter}`);
    const id = state.ids.get(node);
    state.nodes.set(id, node);
    return id;
  };
  const signature = (node) => JSON.stringify([node.tagName, node.id, node.getAttribute("role"), label(node)]);
  const describe = (node, framePath = []) => {
    const rect = node.getBoundingClientRect();
    return {
      elementId: register(node), tag: node.tagName.toLowerCase(), role: node.getAttribute("role"),
      name: label(node), text: compact(nodeText(node), 600), domId: node.id || null,
      type: node.getAttribute("type"), href: node.getAttribute("href"),
      value: secret(node) ? "[redacted]" : typeof node.value === "string" ? node.value.slice(0, 500) : null,
      editable: !secret(node) && (node.isContentEditable || node.matches("input,textarea")),
      disabled: Boolean(node.disabled || node.getAttribute("aria-disabled") === "true"),
      framePath, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      inViewport: rect.bottom > 0 && rect.right > 0 && rect.top < node.ownerDocument.defaultView.innerHeight
        && rect.left < node.ownerDocument.defaultView.innerWidth,
    };
  };
  if (request.action === "inspect") {
    state.snapshotId = crypto.randomUUID();
    state.capturedAt = new Date().toISOString();
    state.nodes.clear();
    state.signatures.clear();
    const elements = [], frames = [], textParts = [];
    const maximum = limit(request.maxElements, 400, 2000);
    const maxText = limit(request.maxText, 20000, 200000);
    let visited = 0, truncated = false;
    const selector = 'a[href],button,input,textarea,select,summary,[contenteditable="true"],[contenteditable=""],[role="button"],[role="textbox"],[role="link"],[role="checkbox"],[role="switch"],[role="tab"],[role="menuitem"],[role="option"],[tabindex],h1,h2,h3,main,article,[role="main"],[role="dialog"]';
    const rootElementId = document.body ? register(document.body) : null;
    if (rootElementId) state.signatures.set(rootElementId, signature(document.body));
    const visit = (root, path = []) => {
      const body = root.nodeType === 9 ? root.body : root;
      if (body) textParts.push(body.innerText || body.textContent || "");
      for (const node of root.querySelectorAll("*")) {
        if (++visited > 50000) { truncated = true; break; }
        if (node.matches(selector) && rendered(node)) {
          if (elements.length < maximum) {
            const item = describe(node, path);
            elements.push(item);
            state.signatures.set(item.elementId, signature(node));
          } else truncated = true;
        }
        if (node.shadowRoot && rendered(node)) visit(node.shadowRoot, path);
        if (node.tagName === "IFRAME" && rendered(node)) {
          const id = register(node);
          try {
            if (!node.contentDocument?.documentElement) throw new Error("frame_access_denied");
            frames.push({ elementId: id, url: node.contentWindow.location.href, readable: true });
            visit(node.contentDocument, [...path, id]);
          } catch {
            frames.push({ elementId: id, url: node.getAttribute("src"), readable: false, reason: "cross_origin_or_unavailable" });
          }
        }
      }
    };
    visit(document);
    const fullText = textParts.join("\n\n");
    return {
      documentId: state.documentId, snapshotId: state.snapshotId,
      capturedAt: state.capturedAt, url: location.href, title: document.title, rootElementId,
      text: fullText.slice(0, maxText), textLength: fullText.length, textTruncated: fullText.length > maxText,
      elements, elementsTruncated: truncated, frames,
      limitations: ["Closed shadow roots, canvas contents and cross-origin frames are not represented as DOM; use screenshot."],
    };
  }
  if (request.documentId !== state.documentId || request.snapshotId !== state.snapshotId) throw new Error("stale_snapshot_take_a_new_one");
  if (Date.now() - Date.parse(state.capturedAt) > 120000) throw new Error("snapshot_expired_take_a_new_one");
  const node = state.nodes.get(request.elementId);
  if (!node?.isConnected) throw new Error("element_missing_or_detached");
  if (request.action === "read") {
    if (secret(node)) throw new Error("sensitive_element_denied");
    const text = nodeText(node);
    const offset = Math.max(0, Number(request.offset) || 0);
    const length = limit(request.length, 30000, 200000);
    return { element: describe(node), text: text.slice(offset, offset + length), offset, textLength: text.length, truncated: offset + length < text.length };
  }
  if (!rendered(node)) throw new Error("element_not_visible");
  if (node.disabled || node.getAttribute("aria-disabled") === "true") throw new Error("element_disabled");
  if (state.signatures.get(request.elementId) !== signature(node)) throw new Error("element_changed_take_a_new_snapshot");
  if (request.action === "scroll") {
    const target = node === node.ownerDocument.body || node === node.ownerDocument.documentElement ? node.ownerDocument.defaultView : node;
    target.scrollBy({ left: Number(request.x) || 0, top: Number(request.y) || 0, behavior: "instant" });
    return { scrolled: true };
  }
  if (request.action === "prepare_fill" || request.action === "prepare_key") {
    if (secret(node)) throw new Error("sensitive_element_denied");
    if (request.action === "prepare_fill" && (!node.matches('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]),textarea') && !node.isContentEditable)) throw new Error("element_not_text_editable");
    if (node.readOnly) throw new Error("element_read_only");
    node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    node.focus();
    let active = node.ownerDocument.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (active !== node && !node.contains(active)) throw new Error("element_focus_failed");
    return { focused: true, element: describe(node) };
  }
  // Background tabs: Chrome does not deliver input events to a tab nobody sees (dispatchMouseEvent hangs),
  // so click and typing go through the page's own DOM there (events are untrusted, which most sites accept).
  if (request.action === "dom_click") {
    if (secret(node)) throw new Error("sensitive_element_denied");
    node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    node.focus?.();
    node.click();
    return { method: "dom", element: describe(node) };
  }
  if (request.action === "dom_fill") {
    if (secret(node)) throw new Error("sensitive_element_denied");
    const text = String(request.text ?? "");
    node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    node.focus();
    if (node.isContentEditable) {
      if (request.clear) node.ownerDocument.execCommand("selectAll", false);
      node.ownerDocument.execCommand("insertText", false, text);
    } else {
      if (!node.matches('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]),textarea')) throw new Error("element_not_text_editable");
      if (node.readOnly) throw new Error("element_read_only");
      const proto = node.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(node, (request.clear ? "" : node.value) + text);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return { method: "dom", element: describe(node) };
  }
  if (request.action === "prepare_click") {
    if (secret(node)) throw new Error("sensitive_element_denied");
    node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    const rect = node.getBoundingClientRect();
    let x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const root = node.getRootNode();
    const hit = root.elementFromPoint?.(x, y) || node.ownerDocument.elementFromPoint(x, y);
    if (hit !== node && !node.contains(hit)) throw new Error("element_covered_or_outside_viewport");
    let win = node.ownerDocument.defaultView;
    while (win !== window) {
      const frame = win.frameElement;
      frame.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      const bounds = frame.getBoundingClientRect();
      x += bounds.left + frame.clientLeft;
      y += bounds.top + frame.clientTop;
      if (frame.ownerDocument.elementFromPoint(x, y) !== frame) throw new Error("frame_covered_or_outside_viewport");
      win = frame.ownerDocument.defaultView;
    }
    return { x, y, element: describe(node) };
  }
  throw new Error("unsupported_page_operation");
}

const DEBUGGER_VERSION = "1.3";

globalThis.maxagentDriver = {
  async withDebugger(tabId, callback) {
    const target = { tabId };
    await chrome.debugger.attach(target, DEBUGGER_VERSION);
    try {
      return await callback(target);
    } finally {
      await chrome.debugger.detach(target).catch(() => {});
    }
  },
  async evaluate(target, request) {
    const result = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      expression: `(${maxagentPageOperation.toString()})(${JSON.stringify(request)})`,
      returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "page_operation_failed");
    if (!result.result || !("value" in result.result)) throw new Error("page_operation_empty_result");
    return result.result.value;
  },
  async click(target, x, y) {
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" });
    for (const type of ["mousePressed", "mouseReleased"]) {
      await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mousePressed" ? 1 : 0, pointerType: "mouse", clickCount: 1 });
    }
  },
  async key(target, raw) {
    const parts = String(raw).split("+");
    const key = parts.pop();
    const mods = { Alt: 1, Control: 2, Meta: 4, Shift: 8 };
    if (parts.some((part) => !(part in mods))) throw new Error("unsupported_key_modifier");
    const names = { Enter: 13, Tab: 9, Escape: 27, Backspace: 8, Delete: 46, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35, PageUp: 33, PageDown: 34, Space: 32 };
    if (!(key in names) && !/^[a-zA-Z0-9]$/.test(key)) throw new Error("unsupported_key");
    const modifiers = parts.reduce((value, part) => value | mods[part], 0);
    const keyCode = names[key] || key.toUpperCase().charCodeAt(0);
    const code = key in names ? key : /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`;
    const k = key === "Space" ? " " : key;
    await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, modifiers, windowsVirtualKeyCode: keyCode });
    if (key === "Enter" && !(modifiers & 7)) await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", { type: "char", key, code, modifiers, text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13 });
    await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers, windowsVirtualKeyCode: keyCode });
  },
  async screenshot(target) {
    const capture = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", { format: "jpeg", quality: 70, fromSurface: true, captureBeyondViewport: false });
    if (!capture?.data) throw new Error("screenshot_empty");
    return capture.data;
  },
  validateFiles(files) {
    if (!Array.isArray(files) || !files.length || files.length > 8) throw new Error("upload_file_count_invalid");
    if (files.some((p) => typeof p !== "string" || p.length > 4096 || /[\r\n\0]/.test(p)
      || !/^(?:[a-z]:[\\/]|\/)/i.test(p) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(p))) throw new Error("upload_requires_absolute_paths");
    return [...new Set(files)];
  },
  async upload(target, files, click, timeoutMs = 15000) {
    let listener, timer;
    const chooser = new Promise((resolve, reject) => {
      listener = (source, method, event) => {
        if (source.tabId !== target.tabId || method !== "Page.fileChooserOpened") return;
        if (!event.backendNodeId) reject(new Error("upload_file_chooser_not_supported"));
        else if (event.mode === "selectSingle" && files.length > 1) reject(new Error("upload_chooser_requires_single_file"));
        else resolve(event);
      };
      timer = setTimeout(() => reject(new Error("upload_chooser_did_not_open")), timeoutMs);
    });
    chooser.catch(() => {});
    chrome.debugger.onEvent.addListener(listener);
    try {
      await chrome.debugger.sendCommand(target, "Page.enable", {});
      await chrome.debugger.sendCommand(target, "Page.setInterceptFileChooserDialog", { enabled: true });
      await click();
      const event = await chooser;
      await chrome.debugger.sendCommand(target, "DOM.setFileInputFiles", { backendNodeId: event.backendNodeId, files });
      return { uploadedFiles: files.map((p) => p.split(/[\\/]/).pop()) };
    } finally {
      clearTimeout(timer);
      chrome.debugger.onEvent.removeListener(listener);
      await chrome.debugger.sendCommand(target, "Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {});
    }
  },
};
