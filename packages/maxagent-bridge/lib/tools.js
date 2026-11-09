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
  { name: 'snapshot', description: 'Page as compact lines: elementId, role, "name", #domId for each element (what is on the screen first), then the page text (valid ~2 minutes, until the page changes). viewport=true — only the screen; query — only elements matching these words; format="full" — the long JSON with coordinates. Password and card fields are never read.', inputSchema: { type: 'object', properties: { ...tab, maxElements: { type: 'integer' }, maxText: { type: 'integer' }, viewport: { type: 'boolean', description: 'Only what is on the screen now.' }, query: { type: 'string', description: 'Only elements whose name, text, id or link contains these words.' }, format: { type: 'string', enum: ['compact', 'full'], description: 'full — the long JSON; rarely needed.' } }, required: ['tabId'] } },
  { name: 'screenshot', description: 'Screenshot of the visible part of a tab (JPEG, long side at most 1568 px; width and height are in the answer).', inputSchema: { type: 'object', properties: tab, required: ['tabId'] } },
  { name: 'read', description: 'Full text of one element from the snapshot (long posts, articles).', inputSchema: { type: 'object', properties: { ...el, offset: { type: 'integer' }, length: { type: 'integer' } }, required: ['tabId', 'snapshotId', 'elementId'] } },
  { name: 'click_at', description: 'Click by pixels of the latest screenshot of this tab (real mouse event). For what the snapshot does not show: players, canvas. The tab must be visible; take a new screenshot before each click_at.', inputSchema: { type: 'object', properties: { ...tab, x: { type: 'number', description: 'Pixels from the left of the screenshot.' }, y: { type: 'number', description: 'Pixels from the top of the screenshot.' } }, required: ['tabId', 'x', 'y'] } },
  { name: 'click', description: 'Click an element from the snapshot (real mouse event).', inputSchema: { type: 'object', properties: el, required: ['tabId', 'snapshotId', 'elementId'] } },
  { name: 'type', description: 'Type text into an input / textarea / editable element from the snapshot. clear=true replaces existing text.', inputSchema: { type: 'object', properties: { ...el, text: { type: 'string' }, clear: { type: 'boolean' } }, required: ['tabId', 'snapshotId', 'elementId', 'text'] } },
  { name: 'press_key', description: 'Press a key in the focused element: Enter, Tab, Escape, Backspace, arrows, or Control+A style chords.', inputSchema: { type: 'object', properties: { ...tab, key: { type: 'string' }, snapshotId: { type: 'string' }, elementId: { type: 'string' } }, required: ['tabId', 'key'] } },
  { name: 'scroll', description: 'Scroll the page (or an element from the snapshot) by x/y pixels.', inputSchema: { type: 'object', properties: { ...tab, x: { type: 'integer' }, y: { type: 'integer' }, snapshotId: { type: 'string' }, elementId: { type: 'string' } }, required: ['tabId'] } },
  { name: 'upload', description: 'Click a file-upload element from the snapshot and attach local files (absolute paths). Asks the owner unless allowed for this agent on this site.', inputSchema: { type: 'object', properties: { ...el, files: { type: 'array', items: { type: 'string' } } }, required: ['tabId', 'snapshotId', 'elementId', 'files'] } },
  { name: 'record_tab_start', description: 'Start recording the audio of this tab only (no other tabs, no system sounds, no microphone). Chrome records it itself — the page sees nothing. Chrome allows it only after the owner clicked the maxagent bridge icon on this tab once (lasts until the tab closes or leaves the site); otherwise the error says so — ask the owner, then call again.', inputSchema: { type: 'object', properties: { ...tab, mute: { type: 'boolean', description: 'If true, mute tab audio during recording; default false (audible).' } }, required: ['tabId'] } },
  { name: 'record_tab_stop', description: 'Stop recording and save the file (.mp3/.wav need ffmpeg; otherwise or without outputPath — .webm). Returns the saved path and size, never the audio itself.', inputSchema: { type: 'object', properties: { ...tab, outputPath: { type: 'string', description: 'Absolute or relative path to save the output audio file (e.g. .mp3, .wav).' } }, required: ['tabId'] } },
];

module.exports = { TOOLS };
