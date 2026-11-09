/* Universal page driver: one fixed page operation for any site, run through chrome.debugger.
   A universal driver: no site-specific code.
   Leaves nothing the site can see (owner's rule 08.11.2026): it runs in an isolated world (the page's scripts
   cannot reach its variables) and keeps no state in the page — an element id is its ordinal in a fixed walk of
   the DOM; the extension keeps each element's signature and checks it before acting. */

function maxagentPageOperation(request) {
  // One per document: a new page (navigation, reload) gets a new time origin.
  const documentId = String(performance.timeOrigin);
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
  const signature = (node) => JSON.stringify([node.tagName, node.id, node.getAttribute("role"), label(node)]);
  const selector = 'a[href],button,input,textarea,select,summary,[contenteditable="true"],[contenteditable=""],[role="button"],[role="textbox"],[role="link"],[role="checkbox"],[role="switch"],[role="tab"],[role="menuitem"],[role="option"],[tabindex],h1,h2,h3,main,article,[role="main"],[role="dialog"]';
  // The fixed walk: every node matching the selector and every iframe gets the next ordinal ("e1", "e2", …);
  // open shadow roots and same-origin frames of rendered hosts are walked in place. body is "e0".
  let truncatedWalk = false;
  const walk = (onNode) => {
    let counter = 0, visited = 0, stop = false;
    const visit = (root, path) => {
      for (const node of root.querySelectorAll("*")) {
        if (stop) return;
        if (++visited > 50000) { truncatedWalk = true; stop = true; return; }
        const isFrame = node.tagName === "IFRAME";
        const id = node.matches(selector) || isFrame ? `e${++counter}` : null;
        if (id && onNode(node, id, path) === false) { stop = true; return; }
        if (node.shadowRoot && rendered(node)) visit(node.shadowRoot, path);
        if (isFrame && rendered(node)) {
          let doc = null;
          try { doc = node.contentDocument?.documentElement ? node.contentDocument : null; } catch { doc = null; }
          if (doc) visit(doc, [...path, id]);
        }
      }
    };
    visit(document, []);
  };
  const resolve = (elementId) => {
    if (elementId === "e0") return document.body;
    let found = null;
    walk((node, id) => { if (id === elementId) { found = node; return false; } return true; });
    return found;
  };
  const describe = (node, elementId, framePath = []) => {
    const rect = node.getBoundingClientRect();
    return {
      elementId, tag: node.tagName.toLowerCase(), role: node.getAttribute("role"),
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
    const elements = [], frames = [], textParts = [];
    // Signatures go to the extension (it checks them before acting), never into the page.
    const signatures = {};
    const maximum = limit(request.maxElements, 400, 2000);
    const maxText = limit(request.maxText, 20000, 200000);
    // Fast reading: only what is on the screen and/or only what matches the words the agent looks for.
    const onlyVisible = request.viewport === true;
    const query = String(request.query || "").toLowerCase().trim();
    const light = onlyVisible || Boolean(query);
    const slim = (d) => ({ elementId: d.elementId, tag: d.tag, role: d.role || undefined, name: compact(d.name, 120) || undefined,
      text: compact(d.text, 120) || undefined, type: d.type || undefined, href: d.href || undefined, value: d.value || undefined,
      editable: d.editable || undefined, disabled: d.disabled || undefined,
      rect: { x: Math.round(d.rect.x), y: Math.round(d.rect.y), width: Math.round(d.rect.width), height: Math.round(d.rect.height) } });
    const matches = (d) => (!onlyVisible || d.inViewport) && (!query || [d.name, d.text, d.domId, d.href].some((v) => String(v || "").toLowerCase().includes(query)));
    const screenText = () => {
      if (!document.body) return "";
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const parts = [];
      while (walker.nextNode()) {
        const t = walker.currentNode;
        const value = (t.nodeValue || "").trim();
        const parent = t.parentElement;
        if (!value || !parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
        range.selectNodeContents(t);
        const b = range.getBoundingClientRect();
        if (b.width && b.height && b.bottom > 0 && b.right > 0 && b.top < innerHeight && b.left < innerWidth && getComputedStyle(parent).visibility !== "hidden") parts.push(value);
      }
      return parts.join(" ");
    };
    let truncated = false;
    const rootElementId = document.body ? "e0" : null;
    if (rootElementId) signatures.e0 = signature(document.body);
    if (document.body && !light) textParts.push(document.body.innerText || document.body.textContent || "");
    if (onlyVisible && !query) textParts.push(screenText());
    walk((node, id, path) => {
      if (node.tagName === "IFRAME" && rendered(node)) {
        let url = null;
        try { url = node.contentDocument?.documentElement ? node.contentWindow.location.href : null; } catch { url = null; }
        if (url) {
          frames.push({ elementId: id, url, readable: true });
          if (!light) textParts.push(node.contentDocument.body?.innerText || "");
        } else frames.push({ elementId: id, url: node.getAttribute("src"), readable: false, reason: "cross_origin_or_unavailable" });
        signatures[id] = signature(node);
      }
      if (node.matches(selector) && rendered(node)) {
        const d = describe(node, id, path);
        if (matches(d)) {
          if (elements.length < maximum) { elements.push(light ? slim(d) : d); signatures[id] = signature(node); } else truncated = true;
        }
      }
      return true;
    });
    const fullText = textParts.join("\n\n");
    return {
      documentId, url: location.href, title: document.title, rootElementId,
      text: fullText.slice(0, maxText), textLength: fullText.length, textTruncated: fullText.length > maxText,
      elements, elementsTruncated: truncated || truncatedWalk, frames, signatures,
      limitations: ["Closed shadow roots, canvas contents and cross-origin frames are not represented as DOM; use screenshot."],
    };
  }
  if (request.action === "viewport") return { width: innerWidth, height: innerHeight };
  if (request.action === "page_scroll") {
    window.scrollBy({ left: Number(request.x) || 0, top: Number(request.y) || 0, behavior: "instant" });
    return { scrolled: true };
  }
  if (request.documentId !== documentId) throw new Error("stale_snapshot_take_a_new_one");
  const node = resolve(request.elementId);
  if (!node?.isConnected) throw new Error("element_missing_or_detached");
  if (signature(node) !== request.signature) throw new Error("element_changed_take_a_new_snapshot");
  if (request.action === "read") {
    if (secret(node)) throw new Error("sensitive_element_denied");
    const text = nodeText(node);
    const offset = Math.max(0, Number(request.offset) || 0);
    const length = limit(request.length, 30000, 200000);
    return { element: describe(node, request.elementId), text: text.slice(offset, offset + length), offset, textLength: text.length, truncated: offset + length < text.length };
  }
  if (!rendered(node)) throw new Error("element_not_visible");
  if (node.disabled || node.getAttribute("aria-disabled") === "true") throw new Error("element_disabled");
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
    return { focused: true, element: describe(node, request.elementId) };
  }
  // Background tabs: Chrome does not deliver input events to a tab nobody sees (dispatchMouseEvent hangs),
  // so click and typing go through the page's own DOM there (events are untrusted, which most sites accept).
  if (request.action === "dom_click") {
    if (secret(node)) throw new Error("sensitive_element_denied");
    node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    node.focus?.();
    node.click();
    return { method: "dom", element: describe(node, request.elementId) };
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
    return { method: "dom", element: describe(node, request.elementId) };
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
    return { x, y, element: describe(node, request.elementId) };
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
    // An isolated world: same DOM, separate JavaScript — the page's scripts cannot see anything we run or keep.
    const { frameTree } = await chrome.debugger.sendCommand(target, "Page.getFrameTree");
    const { executionContextId } = await chrome.debugger.sendCommand(target, "Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "maxagent-bridge" });
    const result = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      expression: `(${maxagentPageOperation.toString()})(${JSON.stringify(request)})`,
      contextId: executionContextId, returnByValue: true, awaitPromise: true,
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
  /** Shrink a screenshot to what models see without further scaling; pixels of this image are what click_at takes. */
  async fitImage(data, maxSide = 1568) {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * ratio), height = Math.round(bitmap.height * ratio);
    if (ratio === 1) { bitmap.close(); return { data, width, height }; }
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const out = new Uint8Array(await (await canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 })).arrayBuffer());
    let text = "";
    for (let i = 0; i < out.length; i += 0x8000) text += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
    return { data: btoa(text), width, height };
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
