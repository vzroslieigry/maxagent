// maxagent plugin for OpenClaw. Installed by `npx maxagent init/update` into ~/.maxagent/openclaw/ and linked with
// `openclaw plugins install --link`. All the logic lives in the shared hook ~/.maxagent/hooks/maxagent-hook.js —
// this file only translates OpenClaw events (docs: <openclaw>/docs/plugins/hooks.md) to it:
//   before_prompt_build → core rules into the cached system part (appendSystemContext) +
//                          experience hint for this message (prependContext). Needs hooks.allowConversationAccess.
//   before_tool_call    → exec / web_search / web_fetch through the hook's pretool: destructive commands,
//                          fiddling with Chrome processes → { block, blockReason }; experience is only a memory:
//   tool-result middleware → that memory, experience after an error, a lint of written experience reach the model with the result.
//   before_agent_finalize → one more pass only if something is really missing ({ action: 'revise' }, stopHookActive guards it).
// A failing hook never breaks the agent: no output → no decision (before_tool_call fails closed only on a throw).

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(DIR, '..', 'hooks', 'maxagent-hook.js');
// Inside the Gateway process.execPath is node; if OpenClaw ever ships as its own binary, fall back to "node".
const NODE = /node(\.exe)?$/i.test(path.basename(process.execPath)) ? process.execPath : 'node';

export function runHook(event, input) {
  try {
    const r = spawnSync(NODE, [HOOK, 'openclaw', event], { input: JSON.stringify(input), encoding: 'utf8', timeout: 10000, windowsHide: true });
    return r.status === 0 ? String(r.stdout || '').trim() : '';
  } catch {
    return '';
  }
}

export function promptContext(event, ctx) {
  const rules = runHook('start', { source: 'startup' });
  const hint = runHook('prompt', { session_id: (ctx && ctx.sessionKey) || 'openclaw', prompt: String((event && event.prompt) || '') });
  const out = {};
  if (rules) out.appendSystemContext = rules;
  if (hint) out.prependContext = hint;
  return out;
}

const memories = new Map();

const resultText = (result) => (Array.isArray(result && result.content) ? result.content.filter((c) => c && c.type === 'text').map((c) => c.text).join('\n') : '');

/** Runs before the result goes back to the model: the memory from before the call, experience after an error, a lint of written experience. */
export function resultGate(event, ctx) {
  const notes = [];
  if (event.toolCallId && memories.has(event.toolCallId)) { notes.push(memories.get(event.toolCallId)); memories.delete(event.toolCallId); }
  try {
    const out = runHook('posttool', { session_id: (ctx && ctx.sessionKey) || 'openclaw', tool_name: String(event.toolName || ''), tool_input: event.args || {}, tool_response: resultText(event.result) });
    const o = out ? JSON.parse(out) : null;
    if (o && o.decision === 'block' && o.reason) notes.push(o.reason);
    else if (o && o.hookSpecificOutput && o.hookSpecificOutput.additionalContext) notes.push(o.hookSpecificOutput.additionalContext);
  } catch { /* not a decision */ }
  if (!notes.length) return undefined;
  const r = event.result || {};
  return { result: { ...r, content: [...(Array.isArray(r.content) ? r.content : []), { type: 'text', text: notes.join('\n\n') }] } };
}

export function finalizeGate(event, ctx) {
  const out = runHook('stop', {
    session_id: (event && event.sessionKey) || (ctx && ctx.sessionKey) || 'openclaw',
    stop_hook_active: Boolean(event && event.stopHookActive),
    last_assistant_message: String((event && event.lastAssistantMessage) || ''),
  });
  try {
    const o = out ? JSON.parse(out) : null;
    if (o && o.decision === 'block' && o.reason) return { action: 'revise', reason: o.reason, retry: { instruction: o.reason, maxAttempts: 1 } };
  } catch { /* not a decision */ }
  return undefined;
}

export function toolGate(event, ctx) {
  const out = runHook('pretool', {
    session_id: (ctx && ctx.sessionKey) || 'openclaw',
    turn_id: (ctx && ctx.runId) || (event && event.runId) || undefined,
    tool_name: String((event && event.toolName) || ''),
    tool_input: (event && event.params) || {},
  });
  if (!out) return undefined;
  try {
    const o = JSON.parse(out);
    const h = o && o.hookSpecificOutput;
    if (h && h.permissionDecision === 'deny') return { block: true, blockReason: h.permissionDecisionReason || 'maxagent' };
    if (h && h.additionalContext && event && event.toolCallId) memories.set(event.toolCallId, h.additionalContext);
  } catch { /* not a decision */ }
  return undefined;
}

// Same shape as the SDK's definePluginEntry() returns (it is a plain object + configSchema), without importing the SDK:
// a linked plugin in ~/.maxagent cannot resolve "openclaw/plugin-sdk/…" (checked against OpenClaw 2026.8.1).
const emptyConfigSchema = {
  safeParse(value) {
    if (value === undefined) return { success: true, data: undefined };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { success: false, error: { issues: [{ path: [], message: 'expected config object' }] } };
    if (Object.keys(value).length > 0) return { success: false, error: { issues: [{ path: [], message: 'config must be empty' }] } };
    return { success: true, data: value };
  },
  jsonSchema: { type: 'object', additionalProperties: false, properties: {} },
};

export default {
  id: 'maxagent',
  name: 'maxagent',
  description: 'Core rules and experience hints in every prompt; destructive commands blocked.',
  configSchema: emptyConfigSchema,
  register(api) {
    api.on('before_prompt_build', (event, ctx) => promptContext(event, ctx));
    api.on('before_tool_call', (event, ctx) => toolGate(event, ctx), { matcher: ['exec', 'web_search', 'web_fetch', 'browser'] });
    if (api.registerAgentToolResultMiddleware) api.registerAgentToolResultMiddleware((event, ctx) => resultGate(event, ctx), { runtimes: ['openclaw', 'codex'], matcher: ['exec', 'web_search', 'web_fetch', 'write', 'edit', 'apply_patch'] });
    api.on('before_agent_finalize', (event, ctx) => finalizeGate(event, ctx));
  },
};
