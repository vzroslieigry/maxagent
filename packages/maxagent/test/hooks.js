'use strict';
// Hooks: installation next to the owner's own hooks, code word, and the hook answers in each agent's format.
// Throwaway home folder only (--home), never the real one.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
// The background update check must not reach the internet from tests.
process.env.MAXAGENT_REGISTRY = 'https://127.0.0.1:9';
process.env.MAXAGENT_NEWS_URL = 'https://127.0.0.1:9/news.json';

const BIN = path.resolve(__dirname, '..', 'bin', 'maxagent.js');
process.env.MAXAGENT_SKIP_PROBE = '1'; // environment card is tested in run.js
let failed = 0;
const check = (cond, name, extra) => {
  console.log(`${cond ? 'OK   ' : 'FAIL '} ${name}`);
  if (!cond) {
    failed++;
    if (extra !== undefined) console.log('      ', String(extra).slice(0, 400));
  }
};
const cli = (args, input = '') => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', input });
const read = (f) => fs.readFileSync(f, 'utf8');
const json = (f) => JSON.parse(read(f));

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-hooks-'));
console.log(`== ${home}`);
fs.mkdirSync(path.join(home, '.claude'));
fs.mkdirSync(path.join(home, '.codex'));
fs.mkdirSync(path.join(home, '.gemini', 'config'), { recursive: true });

// The owner already has hooks of their own — they must survive install and uninstall.
const ownClaude = { model: 'x', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo own-stop' }] }] } };
fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify(ownClaude, null, 2) + '\n');
const ownCodex = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'own-policy' }] }] } };
fs.writeFileSync(path.join(home, '.codex', 'hooks.json'), JSON.stringify(ownCodex, null, 2) + '\n');
const ownAg = { 'my-lint': { PostToolUse: [{ matcher: '*', hooks: [{ command: 'lint' }] }] } };
fs.writeFileSync(path.join(home, '.gemini', 'config', 'hooks.json'), JSON.stringify(ownAg, null, 2) + '\n');

let r = cli(['init', '--yes', '--lang', 'ru', '--home', home]);
check(r.status === 0, 'init exit 0', r.stderr);
const hookJs = path.join(home, '.maxagent', 'hooks', 'maxagent-hook.js');
check(fs.existsSync(hookJs), 'hook script installed');

const cs = json(path.join(home, '.claude', 'settings.json'));
check(cs.model === 'x' && JSON.stringify(cs.hooks.Stop).includes('own-stop'), 'Claude: own settings and hooks kept');
check(['SessionStart', 'UserPromptSubmit', 'Stop', 'PreToolUse'].every((e) => JSON.stringify(cs.hooks[e] || '').includes('maxagent-hook.js')), 'Claude: 4 maxagent hooks registered (incl. SessionStart)');
const cx = json(path.join(home, '.codex', 'hooks.json'));
check(JSON.stringify(cx).includes('own-policy') && ['UserPromptSubmit', 'PreToolUse'].every((e) => JSON.stringify(cx.hooks[e]).includes('maxagent-hook.js')), 'Codex: own hook kept, 2 maxagent hooks registered');
const ag = json(path.join(home, '.gemini', 'config', 'hooks.json'));
check(ag['my-lint'] && ag.maxagent && ag.maxagent.PreInvocation && ag.maxagent.PreToolUse, 'Antigravity: own hook kept, maxagent registered');
const agCommand = ag.maxagent.PreToolUse[0].hooks[0].command;
check(!/"/.test(agCommand) && !/\s/.test(agCommand.split(' ')[1]), 'Antigravity: command without quotes (it runs hooks without a shell)', agCommand);
{
  const [exe, ...rest] = agCommand.split(' ');
  const p = spawnSync(exe === 'node' ? process.execPath : exe, rest, { encoding: 'utf8', input: '{"toolCall":{"name":"run_command","args":{"CommandLine":"dir"}}}', cwd: os.tmpdir() });
  check(/"decision":"allow"/.test(p.stdout), 'Antigravity: command split by spaces, no shell → hook answers', p.stdout + p.stderr);
}

r = cli(['init', '--yes', '--lang', 'ru', '--home', home]);
const cs2 = json(path.join(home, '.claude', 'settings.json'));
check(JSON.stringify(cs2.hooks.PreToolUse).split('maxagent-hook.js').length - 1 === 1, 'second init: no duplicate hooks');

r = cli(['doctor', '--home', home]);
check(r.status === 0 && /жёсткий/.test(r.stdout) && /одобрите хуки maxagent в \/hooks/.test(r.stdout) && /частичный/.test(r.stdout), 'doctor: 0 errors, levels shown', r.stdout);

// No code word any more (0.4.0): the command is gone; a hash left by an older version is deleted on update.
r = cli(['codeword', '--home', home]);
check(r.status !== 0, 'codeword command is gone');
fs.writeFileSync(path.join(home, '.maxagent', 'codeword.hash'), '{"salt":"x","hash":"y"}');
fs.mkdirSync(path.join(home, '.maxagent', 'state'), { recursive: true });
fs.writeFileSync(path.join(home, '.maxagent', 'state', 'old.json'), '{"confirmed":true}');
r = cli(['update', '--home', home]);
check(r.status === 0 && !fs.existsSync(path.join(home, '.maxagent', 'codeword.hash')) && !fs.existsSync(path.join(home, '.maxagent', 'state', 'old.json')), 'update: old code word hash and confirmation state removed');

const hook = (agent, event, input) => {
  const p = spawnSync(process.execPath, [hookJs, agent, event], { encoding: 'utf8', input: JSON.stringify(input) });
  return p.stdout;
};
const parsed = (s) => { try { return JSON.parse(s); } catch { return null; } };

// Session start / after compaction: core rules and the owner's own rules.
const ws = path.join(home, 'maxagent');
fs.appendFileSync(path.join(ws, 'AGENTS.md'), '- Никогда не покупай без суммы.\n');
let out = hook('claude-code', 'start', { source: 'startup' });
check(/Главные правила/.test(out) && /Не говорю «готово»/.test(out) && /Никогда не покупай без суммы/.test(out) && !/<!--/.test(out), 'start: core rules + owner rules, no markers', out);
check(!/кодов/i.test(out), 'start: no code word anywhere');
check(!/личные правила для агентов/.test(out), 'start: template explanation is not shown as an owner rule');
check(/Память сжата/.test(hook('claude-code', 'start', { source: 'compact' })), 'start after compaction: says memory was compacted');
const bom = spawnSync(process.execPath, [hookJs, 'claude-code', 'start'], { encoding: 'utf8', input: '﻿{"source":"startup"}' });
check(/Главные правила/.test(bom.stdout), 'start: input with a BOM (PowerShell 5.1 pipe) still works');
check(/Главные правила/.test(hook('codex', 'start', { source: 'startup' })), 'Codex start: core rules');
check(/Не говорю/.test(JSON.stringify(parsed(hook('antigravity', 'invocation', { invocationNum: 0 })))), 'Antigravity first call: core rules');

// The template's starter atoms (git commit, rm -rf, PowerShell &&…) would answer the checks below before the test's own
// atoms; the hook is tested on a library of its own. Throwaway workspace created by init above.
(function dropStarter(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) dropStarter(p);
    else if (e.name.endsWith('.md') && !e.name.startsWith('_') && e.name !== 'README.md') fs.unlinkSync(p);
  }
})(path.join(ws, 'experience'));

// Experience hint.
const atomFile =(name, title, aliases, atom) => {
  fs.mkdirSync(path.join(ws, 'experience'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'experience', name), `---\ntitle: ${title}\naliases: ${aliases}\n---\n\n${atom}\n`);
};
atomFile('npm.md', 'npm — свой пакет', 'npm, пакет, публикация', '### Опубликовать свой пакет в npm\n- когда: опубликуй пакет в npm · npm publish\n- вещь: npm · пакет\n1. `npm publish` из папки пакета.\n- источник: свой опыт, 05.11.2026');
fs.appendFileSync(path.join(ws, 'projects.md'), '| Сайт-магазин | [projects/shop](projects/shop/README.md) | вёрстка каталога | 2026-11-05 |\n');
out = hook('claude-code', 'prompt', { session_id: 's1', prompt: 'опубликуй пакет в npm' });
check(out.includes('experience/npm.md') && !/подтвержд|кодов/.test(out), 'prompt: hint found, nothing about confirmation', out);
check(out.includes('Брифинг:') && out.includes('больше 3 шагов'), 'prompt: briefing questions in every reminder');
out = hook('claude-code', 'prompt', { session_id: 's1', prompt: 'поправь вёрстку на сайте-магазине' });
check(out.includes('projects/shop/README.md'), 'prompt: project from the registry suggested', out);
check(!hook('claude-code', 'prompt', { session_id: 's1', prompt: 'привет' }).includes('[проект]'), 'prompt: no project for small talk');

// PreToolUse.
const bash = (cmd, session) => ({ session_id: session, tool_name: 'Bash', tool_input: { command: cmd } });
const decision = (s) => { const o = parsed(s); return (o && o.hookSpecificOutput ? o.hookSpecificOutput.permissionDecision : o && o.decision) || 'allow'; };
const memory = (s) => { const o = parsed(s); return (o && o.hookSpecificOutput && o.hookSpecificOutput.additionalContext) || ''; };
check(decision(hook('claude-code', 'pretool', bash('ls -la', 's1'))) === 'allow', 'pretool: harmless command allowed');
check(decision(hook('claude-code', 'pretool', bash('rm -rf ./build', 's1'))) === 'allow', 'pretool: dangerous but legit (rm -rf ./build) → left to the agent\x27s own permission prompts');
check(decision(hook('codex', 'pretool', bash('pip install requests', 's9'))) === 'allow', 'Codex pretool: install → left to the agent');
check(decision(hook('claude-code', 'pretool', bash('Remove-Item -Recurse -Force C:\\', 's1'))) === 'deny', 'pretool: drive root wipe → always denied');
check(decision(hook('claude-code', 'pretool', bash('rm -rf ~', 's1'))) === 'deny', 'pretool: home wipe → always denied');
const br = (name, session) => ({ session_id: session, tool_name: `mcp__maxagent-bridge__${name}`, tool_input: { tabId: 1, snapshotId: 's', elementId: 'e1', text: 'hi' } });
check(decision(hook('claude-code', 'pretool', br('click', 's1'))) === 'allow' && decision(hook('claude-code', 'pretool', br('snapshot', 's1'))) === 'allow', 'bridge click / snapshot → not blocked by the hook (the extension asks the owner itself)');

// Antigravity.
const agTool = (cmd) => ({ conversationId: 'g1', toolCall: { name: 'run_command', args: { CommandLine: cmd, Cwd: ws } } });
check(parsed(hook('antigravity', 'pretool', agTool('dir'))).decision === 'allow', 'Antigravity: harmless → allow');
check(parsed(hook('antigravity', 'pretool', agTool('npm install -g something'))).decision === 'allow', 'Antigravity: install → left to the agent');
check(parsed(hook('antigravity', 'pretool', agTool('format D:'))).decision === 'deny', 'Antigravity: format → deny');
check(JSON.stringify(parsed(hook('antigravity', 'invocation', { invocationNum: 0 }))).includes('ephemeralMessage'), 'Antigravity: reminder on first model call');
check(JSON.stringify(parsed(hook('antigravity', 'invocation', { invocationNum: 3 }))) === '{}', 'Antigravity: silent on later calls');

// Stop (Claude Code transcript).
const tr = path.join(home, 'transcript.jsonl');
// The library was just created by init: on fast machines (CI Linux/macOS) its files look "written this turn".
// Age them by an hour so only files written by the turn itself count.
(function age(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) age(p); else fs.utimesSync(p, new Date(Date.now() - 3600e3), new Date(Date.now() - 3600e3));
  }
})(path.join(ws, 'experience'));
const t0 = new Date(Date.now() - 1000).toISOString();
const tu = (name, input) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });
fs.writeFileSync(tr, [JSON.stringify({ type: 'user', timestamp: t0, message: { content: 'сделай' } }), tu('Bash', { command: 'a' }), tu('Bash', { command: 'b' }), tu('Bash', { command: 'c' }), tu('Edit', { file_path: path.join(ws, 'README.md') })].join('\n') + '\n');
check(hook('claude-code', 'stop', { transcript_path: tr }) === '', 'stop: many ordinary steps (commands, doc edit) → no experience nagging');
fs.appendFileSync(tr, tu('Edit', { file_path: path.join(home, 'app', 'src', 'main.js') }) + '\n');
out = parsed(hook('claude-code', 'stop', { transcript_path: tr }));
check(out && out.decision === 'block' && /после проверки/.test(out.reason), 'stop: code fixed after running it → experience?', out && out.reason);
check(hook('claude-code', 'stop', { transcript_path: tr, stop_hook_active: true }) === '', 'stop: second time → let go');
const trM = path.join(home, 'transcript-m.jsonl');
fs.writeFileSync(trM, fs.readFileSync(tr, 'utf8'));
fs.mkdirSync(path.join(ws, 'experience', 'code'), { recursive: true });
fs.writeFileSync(path.join(ws, 'experience', 'code', 'node.md'), '---\ntitle: Node\ntask: x\naliases: node\nverified: t\n---\n');
check(hook('claude-code', 'stop', { transcript_path: trM }) === '', 'stop: entry in a kind subfolder written (any way) → let go');
fs.appendFileSync(tr, tu('Edit', { file_path: path.join(ws, 'experience', 'npm.md') }) + '\n');
check(hook('claude-code', 'stop', { transcript_path: tr }) === '', 'stop: experience edited → let go');

// Experience before a web search and before asking the owner.
atomFile('chrome.md', 'Chrome', 'Chrome, расширение', '### Перезагрузить расширение Chrome — агент сам\n- когда: chrome reload extension · перезагрузить расширение chrome · обновить расширение · chrome://extensions\n- вещь: Chrome · расширение\n1. Самоперезагрузка расширения через мост: `reload`.\n- источник: свой опыт, 05.11.2026');
const trS = path.join(home, 'tr-search.jsonl');
fs.writeFileSync(trS, JSON.stringify({ type: 'user', timestamp: '2026-11-05T10:00:00Z', message: { content: 'обнови' } }) + '\n');
const web = (q, extra = {}) => decision(hook('claude-code', 'pretool', { session_id: 'w1', transcript_path: trS, tool_name: 'WebSearch', tool_input: { query: q }, ...extra }));
const firstSearch = hook('claude-code', 'pretool', { session_id: 'w1', transcript_path: trS, tool_name: 'WebSearch', tool_input: { query: 'chrome reload extension after update' } });
check(decision(firstSearch) === 'allow' && /chrome/i.test(memory(firstSearch)), 'web search matching experience → a memory, the search goes on', firstSearch);
check(web('chrome reload extension after update') === 'allow', 'same turn, repeated search → allowed');
check(web('weather tomorrow') === 'allow', 'search with no experience match → allowed at once');
const cxSearch = hook('codex', 'pretool', { session_id: 'cx', turn_id: 't1', tool_name: 'web_search', tool_input: { query: 'перезагрузить расширение chrome' } });
check(decision(cxSearch) === 'allow' && /chrome/i.test(memory(cxSearch)), 'Codex web search (turn_id) → a memory, the search goes on', cxSearch);
const askMsg = 'Ваш шаг: откройте\n```\nchrome://extensions\n```\nи нажмите «Обновить» у расширения.';
out = parsed(hook('claude-code', 'stop', { last_assistant_message: askMsg }));
check(out && out.decision === 'block' && /experience\/chrome\.md/.test(out.reason), 'stop: asking the owner for something experience covers → stop once', out && out.reason);
check(hook('codex', 'stop', { last_assistant_message: askMsg, stop_hook_active: true }) === '', 'stop: second time → let go');
check(hook('codex', 'stop', { last_assistant_message: 'Если бы я написал «откройте chrome://extensions», хук бы остановил.' }) === '', 'stop: request in quotes is a quotation, not a request');
check(parsed(hook('codex', 'stop', { last_assistant_message: askMsg })).decision === 'block', 'Codex stop: request check works from last_assistant_message');

// Stop: "done" without a check.
const trD = path.join(home, 'tr-done.jsonl');
const said = (text) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const codeFile = path.join(home, 'app', 'src', 'x.js');
fs.writeFileSync(trD, [JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: 'почини' } }), tu('Edit', { file_path: codeFile }), said('Готово, исправил.')].join('\n') + '\n');
out = parsed(hook('claude-code', 'stop', { transcript_path: trD }));
check(out && out.decision === 'block' && /не запускал/.test(out.reason), 'stop: "done" right after a code edit, nothing run → stop once', out && out.reason);
fs.writeFileSync(trD, [JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: 'почини' } }), tu('Edit', { file_path: codeFile }), said('Исправил, но не проверено: нет доступа.')].join('\n') + '\n');
check(hook('claude-code', 'stop', { transcript_path: trD }) === '', 'stop: honest "not verified" → let go');
fs.writeFileSync(trD, [JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: 'почини' } }), tu('Edit', { file_path: codeFile }), tu('Bash', { command: 'node x.js' }), said('Готово, работает.')].join('\n') + '\n');
check(hook('claude-code', 'stop', { transcript_path: trD }) === '', 'stop: ran it after the edit → let go');

// Browser guard — only when the owner chose the bridge.
const cfgPath = path.join(home, '.maxagent', 'config.json');
check(decision(hook('claude-code', 'pretool', { session_id: 'b', tool_name: 'mcp__Claude_Browser__navigate', tool_input: {} })) === 'allow', 'browser: no bridge chosen → built-in browser not blocked');
fs.writeFileSync(cfgPath, JSON.stringify({ ...json(cfgPath), bridge: true }));
check(decision(hook('claude-code', 'pretool', { session_id: 'b', tool_name: 'mcp__claude-in-chrome__computer', tool_input: {} })) === 'deny', 'browser: bridge chosen → built-in browser denied');
check(decision(hook('claude-code', 'pretool', bash('Get-Process chrome', 'b'))) === 'deny', 'browser: looking for chrome processes → deny with the recipe');
check(decision(hook('claude-code', 'pretool', bash('& "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" https://x', 'b'))) === 'deny', 'browser: starting chrome.exe directly → deny');
check(decision(hook('claude-code', 'pretool', bash('chrome --headless --user-data-dir=tmp --screenshot x', 'b'))) === 'allow', 'browser: own headless → allowed');
check(decision(hook('claude-code', 'pretool', bash('git commit -m "chrome extension fix"', 'b'))) === 'allow', 'browser: the word chrome in a commit → allowed');

// Experience before an action: the agent's intent shows in the tool call; `когда` of the atom names it. Once per session.
atomFile('shell.md', 'Командная строка', 'терминал, bash', '### Выполнить команду на этом ПК\n- когда: Bash · ls · grep\n- когда: The token && is not a valid statement separator\n- вещь: Windows · PowerShell 5.1\n1. Инструмент PowerShell — 5.1: `A; if ($?) { B }`.\n- источник: свой опыт, 05.11.2026');
out = parsed(hook('claude-code', 'pretool', bash('ls -la', 'act')));
check(decision(JSON.stringify(out)) === 'allow' && /Выполнить команду на этом ПК/.test(JSON.stringify(out)) && !/повтори|repeat/i.test(JSON.stringify(out)), 'action: first Bash call of a session → a memory about this PC, the call goes on', JSON.stringify(out));
check(decision(hook('claude-code', 'pretool', bash('ls -la', 'act'))) === 'allow', 'action: same atom a second time → allowed');
check(decision(hook('claude-code', 'pretool', { session_id: 'act2', tool_name: 'Read', tool_input: { file_path: 'x.md' } })) === 'allow', 'action: quiet tools (Read) never stop');
out = parsed(hook('claude-code', 'posttool', { session_id: 'act3', tool_name: 'PowerShell', tool_input: { command: 'a && b' }, tool_response: "ParserError: The token '&&' is not a valid statement separator in this version." }));
check(out && /Выполнить команду/.test(out.hookSpecificOutput.additionalContext), 'action: a failed command → the atom whose trigger is that error', JSON.stringify(out));
// Antigravity has no field for text before a tool: the memory comes with its next model call, once.
const agMem = parsed(hook('antigravity', 'pretool', { conversationId: 'agm', toolCall: { name: 'run_command', args: { CommandLine: 'ls -la', Cwd: ws } } }));
check(agMem && agMem.decision === 'allow', 'Antigravity: experience before an action never stops it', JSON.stringify(agMem));
out = parsed(hook('antigravity', 'invocation', { invocationNum: 3, conversationId: 'agm' }));
check(out && out.injectSteps && /Выполнить команду на этом ПК/.test(out.injectSteps[0].ephemeralMessage), 'Antigravity: the memory arrives with the next model call', JSON.stringify(out));
check(hook('antigravity', 'invocation', { invocationNum: 4, conversationId: 'agm' }) === '{}', 'Antigravity: the memory is not repeated');
// OpenClaw and Hermes: the same checks under their own tool names.
out = parsed(hook('openclaw', 'posttool', { session_id: 'oc1', tool_name: 'exec', tool_input: { command: 'a && b' }, tool_response: "ParserError: The token '&&' is not a valid statement separator in this version." }));
check(out && /Выполнить команду/.test(out.hookSpecificOutput.additionalContext), 'OpenClaw: experience after a failed exec', JSON.stringify(out));
out = parsed(hook('hermes', 'posttool', { session_id: 'hm1', tool_name: 'terminal', tool_input: { command: 'a && b' }, tool_response: "ParserError: The token '&&' is not a valid statement separator in this version." }));
check(out && /Выполнить команду/.test(out.hookSpecificOutput.additionalContext), 'Hermes: experience after a failed terminal call', JSON.stringify(out));
// An experience file written in the wrong format → lint errors go back to the agent at once.
fs.writeFileSync(path.join(ws, 'experience', 'bad.md'), '---\ntitle: x\naliases: y\n---\n\n### Плохой атом\n- просят: не подтверждено\n- источник: разметка07.11\n');
out = parsed(hook('claude-code', 'posttool', { session_id: 'act4', tool_name: 'Write', tool_input: { file_path: path.join(ws, 'experience', 'bad.md') }, tool_response: 'ok' }));
check(out && out.decision === 'block' && /E010/.test(out.reason) && /E020/.test(out.reason), 'posttool: experience written badly → lint errors back to the agent', out && out.reason);
out = hook('claude-code', 'posttool', { session_id: 'act4', tool_name: 'Write', tool_input: { file_path: path.join(ws, 'experience', 'npm.md') }, tool_response: 'ok' });
check(out === '', 'posttool: a good atom → silent', out);
fs.unlinkSync(path.join(ws, 'experience', 'bad.md'));

// Antigravity: no message text in its events — the owner's message comes from the transcript, once per message.
const agTr = path.join(home, 'ag-transcript.jsonl');
fs.writeFileSync(agTr, JSON.stringify({ step_index: 0, type: 'USER_INPUT', content: '<USER_REQUEST>\nопубликуй пакет в npm\n</USER_REQUEST>' }) + '\n');
out = parsed(hook('antigravity', 'invocation', { invocationNum: 0, conversationId: 'ag1', transcriptPath: agTr }));
const agMsg = out && out.injectSteps && out.injectSteps[0].ephemeralMessage;
check(agMsg && /Главные правила/.test(agMsg) && /Опубликовать свой пакет в npm/.test(agMsg), 'Antigravity: first call — rules + experience for the message from the transcript', agMsg && agMsg.slice(-700));
check(hook('antigravity', 'invocation', { invocationNum: 1, conversationId: 'ag1', transcriptPath: agTr }) === '{}', 'Antigravity: same message, next call — nothing');
fs.appendFileSync(agTr, JSON.stringify({ step_index: 5, type: 'USER_INPUT', content: '<USER_REQUEST>перезагрузить расширение chrome</USER_REQUEST>' }) + '\n');
out = parsed(hook('antigravity', 'invocation', { invocationNum: 2, conversationId: 'ag1', transcriptPath: agTr }));
check(out && /Перезагрузить расширение Chrome/.test(out.injectSteps[0].ephemeralMessage) && !/Главные правила/.test(out.injectSteps[0].ephemeralMessage), 'Antigravity: a new message later — its experience, without repeating the rules', JSON.stringify(out).slice(0, 300));

// Antigravity Stop: the answer text comes from the transcript; {"decision":"continue"} once per owner message.
const agStop = path.join(home, 'ag-stop.jsonl');
const agLine = (o) => fs.appendFileSync(agStop, JSON.stringify(o) + '\n');
agLine({ step_index: 0, type: 'USER_INPUT', content: 'сделай озвучку' });
agLine({ step_index: 1, type: 'PLANNER_RESPONSE', content: 'Сейчас запишу', tool_calls: [{ name: 'run_command', args: {} }] });
agLine({ step_index: 3, type: 'PLANNER_RESPONSE', content: 'Файл озвучки готов: D:\\clips\\voice.txt' });
const agIn = { conversationId: 'agS', transcriptPath: agStop, terminationReason: 'NO_TOOL_CALL' };
out = parsed(hook('antigravity', 'stop', agIn));
check(out && out.decision === 'continue' && /простым текстом/i.test(out.reason) && /voice\.txt/.test(out.reason), 'Antigravity Stop: plain path in the last answer → continue with the reason', JSON.stringify(out).slice(0, 300));
check(hook('antigravity', 'stop', agIn) === '{}', 'Antigravity Stop: same owner message — no second continue (no loop)');
check(hook('antigravity', 'stop', { ...agIn, conversationId: 'agS2', terminationReason: 'USER_CANCELED' }) === '{}', 'Antigravity Stop: canceled by the owner — silent');
agLine({ step_index: 9, type: 'USER_INPUT', content: 'а теперь превью' });
agLine({ step_index: 10, type: 'PLANNER_RESPONSE', content: 'Превью: [thumb.png](D:/clips/thumb.png)' });
check(hook('antigravity', 'stop', agIn) === '{}', 'Antigravity Stop: a well-formatted answer — allowed to stop');

// The answer: format rule every time; plain paths/commands in the finished answer → one stop; the answer shelf
// (experience/answer/) is searched with the text of the answer, not the request (decision 08.11.2026).
out = hook('claude-code', 'prompt', { session_id: 'fmt', prompt: 'подготовь выпуск' });
check(/Ответ хозяину: что глянуть/.test(out), 'prompt: the answer-format rule is in every reminder', out.slice(-400));
out = parsed(hook('codex', 'stop', { session_id: 'fmt1', last_assistant_message: 'Файл озвучки готов: D:\\clips\\voice.txt — запустите npx maxagent update' }));
check(out && out.decision === 'block' && /простым текстом/i.test(out.reason) && /voice\.txt/.test(out.reason), 'stop: a plain path in the finished answer → asked to format', out && out.reason);
check(out && /не повторяй/.test(out.reason) && !/Перепиши/.test(out.reason), 'stop: asks to add the missing part, not to rewrite the whole answer (no duplicate answer)', out && out.reason);
check(out && !/^- (когда|вещь|источник):/m.test(out.reason), 'stop: answer atoms without search and source lines (only what to do)', out && out.reason);
out = hook('codex', 'stop', { session_id: 'fmt2', last_assistant_message: 'Файл: [voice.txt](D:/clips/voice.txt)\n```\nnpx maxagent update\n```' });
check(!/простым текстом/i.test(out), 'stop: link and code block → no format complaint', out);
fs.mkdirSync(path.join(ws, 'experience', 'answer'), { recursive: true });
fs.writeFileSync(path.join(ws, 'experience', 'answer', 'handover.md'), '---\ntitle: Ответ\naliases: ответ\n---\n\n### Отдать пакет публикации ролика\n- когда: название ролика · описание ролика · теги ролика\n- вещь: пакет публикации\n1. Каждое поле — отдельным блоком кода.\n- источник: тест, 08.11.2026\n');
out = parsed(hook('codex', 'stop', { session_id: 'fmt3', last_assistant_message: 'Готово. Название ролика и описание ролика ниже, теги ролика тоже.' }));
check(out && /опыт ответа/.test(out.reason) && /пакет публикации/.test(out.reason), 'stop: the answer shelf matched by the answer text', out && out.reason);
check(!/Отдать пакет публикации/.test(hook('claude-code', 'prompt', { session_id: 'fmt4', prompt: 'название ролика описание ролика теги ролика' })), 'prompt: the answer shelf is not searched by the request');

// Updates and one-time news: the background check left state/update.json; the session start shows them once.
const stDir = path.join(home, '.maxagent', 'state');
fs.mkdirSync(stDir, { recursive: true });
fs.writeFileSync(path.join(stDir, 'update.json'), JSON.stringify({ at: Date.now(), latest: { maxagent: '99.0.0' }, news: [
  { id: 'n1', text: { ru: 'Расширение моста теперь в Chrome Web Store.', en: 'The bridge extension is in the Chrome Web Store now.' } },
  { id: 'n2', minVersion: '98.0.0', text: { en: 'Only for 98+.' } },
] }));
try { fs.unlinkSync(path.join(stDir, 'update-shown.json')); } catch { /* first time */ }
out = hook('claude-code', 'start', { source: 'startup' });
check(/Вышла версия 99\.0\.0/.test(out) && /npx --yes maxagent@latest update/.test(out) && /Chrome Web Store/.test(out) && !/Only for 98/.test(out), 'start: a newer version and a fitting news item are shown', out.slice(-600));
out = hook('claude-code', 'start', { source: 'startup' });
check(!/Вышла версия/.test(out) && !/Chrome Web Store/.test(out), 'start again: the same version and news are not repeated', out.slice(-400));
out = parsed(hook('claude-code', 'posttool', { tool_name: 'mcp__maxagent-bridge__tabs_list', tool_response: [{ type: 'text', text: 'browser_not_connected: …' }] }));
check(out && /launch_browser/.test(out.hookSpecificOutput.additionalContext), 'posttool: bridge not connected → one recipe');
check(hook('claude-code', 'posttool', { tool_name: 'mcp__maxagent-bridge__tabs_list', tool_response: [{ type: 'text', text: '[]' }] }) === '', 'posttool: normal answer → silent');
check(JSON.stringify(json(path.join(home, '.claude', 'settings.json')).hooks.PostToolUse).includes('mcp__maxagent-bridge__'), 'Claude: PostToolUse registered only for bridge tools');

// Inbox and environment line.
out = hook('claude-code', 'prompt', { session_id: 'i', prompt: 'сохрани эту ссылку на потом https://example.com' });
check(/\[входящие\]/.test(out) && /inbox\//.test(out), 'prompt: "save for later" → inbox instruction', out);
fs.writeFileSync(path.join(ws, 'inbox', '2026-11-05-x.md'), '# Купить домен\nВид: не забыть сделать\nОткуда: чат\n\nкупить домен\n');
fs.writeFileSync(path.join(ws, 'experience', 'platform', 'environment.md'), '<!-- env:auto:start -->\n- **Кратко:** Windows 10 (x64); оболочки: PowerShell 5.1; админ: нет\n<!-- env:auto:end -->\n');
out = hook('claude-code', 'start', { source: 'startup' });
check(/Несортированного: 1/.test(out) && /Купить домен/.test(out), 'start: inbox count and "don\'t forget" items', out);
check(/\[окружение\] Windows 10/.test(out), 'start: environment summary line');

// Broken hook input must never break the agent.
const raw = spawnSync(process.execPath, [hookJs, 'antigravity', 'pretool'], { encoding: 'utf8', input: '{not json' });
check(parsed(raw.stdout) && parsed(raw.stdout).decision === 'allow' && raw.status === 0, 'broken input → neutral answer, exit 0');

// doctor catches a removed hook.
const sFile = path.join(home, '.claude', 'settings.json');
const saved = read(sFile);
const broken = json(sFile);
delete broken.hooks.PreToolUse;
fs.writeFileSync(sFile, JSON.stringify(broken));
r = cli(['doctor', '--home', home]);
check(r.status === 1 && /не все хуки/.test(r.stdout), 'doctor: missing hook → ERROR');
fs.writeFileSync(sFile, saved);

// uninstall: only our hooks go.
r = cli(['uninstall', '--home', home]);
check(r.status === 0, 'uninstall exit 0');
check(JSON.stringify(json(sFile)) === JSON.stringify(ownClaude), 'Claude settings back to the owner\'s own');
check(JSON.stringify(json(path.join(home, '.codex', 'hooks.json'))) === JSON.stringify(ownCodex), 'Codex hooks back to the owner\'s own');
check(JSON.stringify(json(path.join(home, '.gemini', 'config', 'hooks.json'))) === JSON.stringify(ownAg), 'Antigravity hooks back to the owner\'s own');

fs.rmSync(home, { recursive: true, force: true }); // throwaway test folder created above

/* ---------- OpenClaw plugin: install through a stand-in CLI, then the real plugin file with a fake api ---------- */
(async () => {
  const oh = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-openclaw-'));
  fs.mkdirSync(path.join(oh, '.openclaw'));
  fs.writeFileSync(path.join(oh, '.openclaw', 'openclaw.json'), JSON.stringify({ secretToken: 'keep-me', plugins: { entries: {} } }, null, 2));
  // Stand-in for the OpenClaw CLI: logs its arguments; "config set" writes the entry the way the real CLI would.
  const fake = path.join(oh, 'fake-openclaw.js');
  const log = path.join(oh, 'calls.log');
  fs.writeFileSync(fake, `const fs=require('fs');const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},a.join(' ')+'\\n');
if(a[0]==='config'&&a[1]==='set'){const f=${JSON.stringify(path.join(oh, '.openclaw', 'openclaw.json'))};const j=JSON.parse(fs.readFileSync(f,'utf8'));j.plugins.entries.maxagent={enabled:true,hooks:{allowConversationAccess:true}};fs.writeFileSync(f,JSON.stringify(j,null,2));}`);
  const env = { ...process.env, MAXAGENT_OPENCLAW_BIN: fake };
  const ocli = (args) => spawnSync(process.execPath, [BIN, ...args, '--home', oh], { encoding: 'utf8', env });
  let rr = ocli(['init', '--yes', '--lang', 'ru', '--agents', 'openclaw']);
  const calls = fs.existsSync(log) ? read(log) : '';
  const pdir = path.join(oh, '.maxagent', 'openclaw');
  check(rr.status === 0 && ['package.json', 'openclaw.plugin.json', 'index.js'].every((f) => fs.existsSync(path.join(pdir, f))), 'OpenClaw: plugin files installed');
  check(calls.includes(`plugins install --link ${pdir} --force --accept-capabilities`) && calls.includes('plugins enable maxagent --accept-capabilities') && calls.includes('config set plugins.entries.maxagent.hooks.allowConversationAccess true'), 'OpenClaw: linked, enabled, conversation access through the CLI', calls);
  check(json(path.join(oh, '.openclaw', 'openclaw.json')).secretToken === 'keep-me', 'OpenClaw: its own settings untouched by maxagent');
  check(/перезапустите шлюз/.test(rr.stdout), 'OpenClaw: tells to restart the gateway (does not restart it itself)');
  rr = ocli(['doctor']);
  check(/OpenClaw — уровень защиты: плагин/.test(rr.stdout) && !/WARN/.test(rr.stdout), 'OpenClaw doctor: plugin level, no warning', rr.stdout);
  fs.writeFileSync(log, '');
  ocli(['update']);
  check(read(log) === '', 'OpenClaw: update does not call the CLI again when already wired');

  // The real plugin file, loaded the way OpenClaw loads it (ESM default export), against a fake api.
  const mod = await import(require('url').pathToFileURL(path.join(pdir, 'index.js')).href);
  const plugin = mod.default;
  const handlers = {};
  plugin.register({ on: (name, fn, opts) => { handlers[name] = { fn, opts }; } });
  check(plugin.id === 'maxagent' && plugin.configSchema.safeParse(undefined).success && !plugin.configSchema.safeParse({ x: 1 }).success, 'OpenClaw plugin: entry shape like definePluginEntry (id, empty config schema)');
  check(handlers.before_prompt_build && handlers.before_tool_call && JSON.stringify(handlers.before_tool_call.opts.matcher) === JSON.stringify(['exec', 'web_search', 'web_fetch', 'browser']), 'OpenClaw plugin: registers before_prompt_build and before_tool_call (exec, web_search, web_fetch, browser)');
  const pb = handlers.before_prompt_build.fn({ prompt: 'привет', messages: [] }, { sessionKey: 'k' });
  check(/Главные правила/.test(pb.appendSystemContext || '') && /Брифинг/.test(pb.prependContext || ''), 'OpenClaw plugin: core rules → system context, briefing → prompt context', JSON.stringify(pb).slice(0, 300));
  const blocked = handlers.before_tool_call.fn({ toolName: 'exec', params: { command: 'rm -rf ~' } }, { sessionKey: 'k', runId: 'r1' });
  check(blocked && blocked.block === true && /уничтожить/.test(blocked.blockReason), 'OpenClaw plugin: home wipe via exec → blocked', JSON.stringify(blocked));
  check(handlers.before_tool_call.fn({ toolName: 'exec', params: { command: 'ls -la' } }, { sessionKey: 'k', runId: 'r1' }) === undefined, 'OpenClaw plugin: harmless exec → no decision');

  rr = ocli(['uninstall']);
  check(rr.status === 0 && /plugins uninstall maxagent/.test(read(log)), 'OpenClaw: uninstall removes the plugin through the CLI');
  fs.rmSync(oh, { recursive: true, force: true }); // throwaway test folder created above
})().catch((e) => { failed++; console.log('FAIL  OpenClaw block crashed:', e && e.stack); }).finally(() => {
  console.log(failed ? `\n${failed} FAILED` : '\nALL OK');
  process.exit(failed ? 1 : 0);
});
