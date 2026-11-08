---
title: Chrome extensions — reload, install unpacked, Native Messaging, input via debugger
aliases: extension, chrome://extensions, reload extension, unpacked, __pycache__, Cannot load extension, manifest.json, extension ID, key, Native Messaging, connectNative, chrome.debugger, service worker, MV3, расширение
---

### Reload an extension after editing its files
- когда: reload the extension · update the extension · new extension files · npx maxagent-bridge reload
- вещь: Chrome · unpacked extension · self-reload
1. The agent does it itself — do not ask the owner to press "Reload".
2. The extension has a self-reload command — use it first (`chrome.runtime.reload()` triggered by the extension, e.g. `npx maxagent-bridge reload`).
3. No such command — restart Chrome gracefully.
- проверка: the code version reported by the background script (a `CODE_VERSION` constant), not the manifest version
- ловушка: a restart does not always refresh an MV3 service worker — atom below
- источник: field experience, 2026-11-04

### Extension updated, but the background script runs old code
- когда: service worker is old · manifest version new but code old · CODE_VERSION mismatch
- вещь: Chrome · MV3 · service worker
1. Rename the file in `"background": { "service_worker": "…" }` or call `chrome.runtime.reload()` from the extension itself.
2. Report the code version with a constant in the background script and bump it together with `version` in the manifest.
- ловушка: not `chrome.runtime.getManifest().version` — the manifest re-reads while the old code stays cached
- источник: field experience, 2026-11-05

### Cannot load extension: __pycache__
- когда: Cannot load extension · __pycache__ in extension · .pyc in extension folder
- вещь: unpacked extension · Python cache
1. Before every load, reload and pack — recursively check the folder for `__pycache__`, `.pyc`, `.pyo`, especially after tests.
2. Run Python with `-B` or `PYTHONDONTWRITEBYTECODE=1`; check syntax with `compile(source, filename, "exec")` without writing files.
- ловушка: do not blame the profile or permissions and do not edit Preferences; do not delete `_locales` or `_metadata`
- источник: field experience, repeated agent mistake

### Install an unpacked extension for the first time
- когда: install an extension · load unpacked · install Chrome extension
- вещь: Chrome · developer mode · extension ID
1. A person does it: `chrome://extensions` → Developer mode → Load unpacked → the folder.
2. A stable ID — the `"key"` field in `manifest.json` (RSA public key, SPKI DER in base64): ID = first 32 hex chars of sha256 of the DER with 0–f mapped to a–p; no private key needed.
- ловушка: do not edit policies or Preferences to get around it
- источник: field experience, 2026-11-05

### Connect an extension to a local program without an open port
- когда: Native Messaging · connectNative · extension and local program
- вещь: Native Messaging · stdio · HKCU registry
1. Background: `chrome.runtime.connectNative("<name>")`; framing — 4-byte length (uint32 LE) + UTF-8 JSON.
2. Host manifest: `{name, description, path, type:"stdio", allowed_origins:["chrome-extension://<ID>/"]}`.
3. Windows registration without admin: `reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\<name>" /ve /t REG_SZ /d <manifest path> /f`.
4. macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/<name>.json`; Linux: `~/.config/google-chrome/NativeMessagingHosts/`.
- ловушка: a message to the host is limited to 1 MB — atom below
- источник: field experience, 2026-11-05

### Native Messaging: wrapper, channel to agents, large messages
- когда: native host does not start · screenshot does not reach the host · message bigger than 1 MB
- вещь: Native Messaging · .cmd · named pipe · unix socket
1. On Windows `path` is a `.cmd`: `@echo off` + `"<full path to node.exe>" "<script>" host %*`; Chrome passes the extension origin as an argument.
2. Host ↔ agents without a port: `net.createServer().listen("\\\\.\\pipe\\<name>")` on Windows, a unix socket in a 0700 folder on macOS/Linux.
3. Over 1 MB — chunks `{type:"chunk", id, i, n, data}` of ~200 000 characters, joined in the host.
- ловушка: remove a stale unix socket only if nobody answers on it
- источник: field experience, 2026-11-05

### Click or typing in a background tab does nothing
- когда: click in background tab · typing did not arrive · Input.dispatchMouseEvent hangs
- вещь: chrome.debugger · DOM events
1. Visible tab: `Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`, `Input.insertText`.
2. Hidden tab: `element.click()`; typing — the `value` setter from the prototype (`HTMLInputElement`/`HTMLTextAreaElement`) + `input`/`change` events; contenteditable — `execCommand("insertText")`.
3. Is it visible: `tab.active && (await chrome.windows.get(tab.windowId)).state !== "minimized"`.
- ловушка: mouse and key events in a hidden tab hang ~5 s and finish without error, having done nothing
- ловушка: the "is debugging this browser" bar shrinks the page — account for it in screenshots
- источник: field experience, 2026-11-05
