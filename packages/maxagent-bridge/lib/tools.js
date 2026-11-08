'use strict';
// The MCP tool set: plain "hands", no logic of their own. The agent decides what to do.

const tab = { tabId: { type: 'integer', description: 'Tab id from tabs_list.' } };
const el = {
  ...tab,
  snapshotId: { type: 'string', description: 'snapshotId from the latest snapshot of this tab.' },
  elementId: { type: 'string', description: 'elementId from that snapshot (e.g. "e12").' },
};

const TOOLS = [
  { name: 'browser_status', description: 'Is the browser connected, which rights this agent has, is the bridge stopped by the owner.', inputSchema: { type: 'object', properties: {} } },
  { name: 'launch_browser', description: 'THE fix when the browser is not connected: starts the owner\'s own Chrome (normal profile) and waits for the bridge. restart=true — the owner\'s Chrome runs but the bridge is silent (hung): graceful restart. Other chrome.exe processes (Playwright, headless, other profiles) are not the owner\'s browser — never use or "repair" them.', inputSchema: { type: 'object', properties: { url: { type: 'string' }, restart: { type: 'boolean' } } } },
  { name: 'tabs_list', description: 'List open tabs: id, windowId, active, title, url.', inputSchema: { type: 'object', properties: {} } },
  { name: 'tab_open', description: 'Open a new tab (in the background unless active=true).', inputSchema: { type: 'object', properties: { url: { type: 'string' }, active: { type: 'boolean' } }, required: ['url'] } },
  { name: 'tab_close', description: 'Close a tab.', inputSchema: { type: 'object', properties: tab, required: ['tabId'] } },
  { name: 'tab_activate', description: 'Bring a tab to the front.', inputSchema: { type: 'object', properties: tab, required: ['tabId'] } },
  { name: 'navigate', description: 'Go to a URL in a tab, or "back" / "forward" / "reload".', inputSchema: { type: 'object', properties: { ...tab, url: { type: 'string' } }, required: ['tabId', 'url'] } },
  { name: 'snapshot', description: 'Page as data: url, title, visible text and interactive elements with elementId (valid ~2 minutes, until the page changes). Password and card fields are never read.', inputSchema: { type: 'object', properties: { ...tab, maxElements: { type: 'integer' }, maxText: { type: 'integer' } }, required: ['tabId'] } },
  { name: 'screenshot', description: 'Screenshot of the visible part of a tab (JPEG).', inputSchema: { type: 'object', properties: tab, required: ['tabId'] } },
  { name: 'read', description: 'Full text of one element from the snapshot (long posts, articles).', inputSchema: { type: 'object', properties: { ...el, offset: { type: 'integer' }, length: { type: 'integer' } }, required: ['tabId', 'snapshotId', 'elementId'] } },
  { name: 'click', description: 'Click an element from the snapshot (real mouse event).', inputSchema: { type: 'object', properties: el, required: ['tabId', 'snapshotId', 'elementId'] } },
  { name: 'type', description: 'Type text into an input / textarea / editable element from the snapshot. clear=true replaces existing text.', inputSchema: { type: 'object', properties: { ...el, text: { type: 'string' }, clear: { type: 'boolean' } }, required: ['tabId', 'snapshotId', 'elementId', 'text'] } },
  { name: 'press_key', description: 'Press a key in the focused element: Enter, Tab, Escape, Backspace, arrows, or Control+A style chords.', inputSchema: { type: 'object', properties: { ...tab, key: { type: 'string' }, snapshotId: { type: 'string' }, elementId: { type: 'string' } }, required: ['tabId', 'key'] } },
  { name: 'scroll', description: 'Scroll the page (or an element from the snapshot) by x/y pixels.', inputSchema: { type: 'object', properties: { ...tab, x: { type: 'integer' }, y: { type: 'integer' }, snapshotId: { type: 'string' }, elementId: { type: 'string' } }, required: ['tabId'] } },
  { name: 'upload', description: 'Click a file-upload element from the snapshot and attach local files (absolute paths). Always asks the owner first.', inputSchema: { type: 'object', properties: { ...el, files: { type: 'array', items: { type: 'string' } } }, required: ['tabId', 'snapshotId', 'elementId', 'files'] } },
  { name: 'record_tab_start', description: 'Start recording audio strictly from this tab (isolated: no other tabs, no system sounds, no microphone).', inputSchema: { type: 'object', properties: { ...tab, mute: { type: 'boolean', description: 'If true, mute tab audio during recording; default false (audible).' } }, required: ['tabId'] } },
  { name: 'record_tab_stop', description: 'Stop recording tab audio and save to disk (.mp3, .wav or .webm).', inputSchema: { type: 'object', properties: { ...tab, outputPath: { type: 'string', description: 'Absolute or relative path to save the output audio file (e.g. .mp3, .wav).' } }, required: ['tabId'] } },
  { name: 'evaluate', description: 'Evaluate JavaScript expression in the tab context and return value.', inputSchema: { type: 'object', properties: { ...tab, expression: { type: 'string' } }, required: ['tabId', 'expression'] } },
];

module.exports = { TOOLS };
