---
title: Agent hooks and global rules — Claude Code, Codex, Antigravity, OpenClaw
aliases: hook, hooks, CLAUDE.md, AGENTS.md, GEMINI.md, AGENTS.override.md, SOUL.md, global agent rules, settings.json, hooks.json, config.toml, SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, PreInvocation, before_tool_call, before_prompt_build, permissionDecision, additionalContext, injectSteps, stop_hook_active, transcript, jsonl, хук, правила агента
---

### Where Claude Code and Codex read global rules
- когда: where are global agent rules · CLAUDE.md for all projects · AGENTS.override.md
- вещь: Claude Code · Codex · CLAUDE.md · AGENTS.md
1. Claude Code — `~/.claude/CLAUDE.md` (applies to every project, also runs outside your workspace).
2. Codex — `~/.codex/AGENTS.md`; an `AGENTS.override.md` next to it is read instead. Project `AGENTS.md` up to 32 KB.
- ловушка: a separate folder is not a clean environment — the global file still applies
- источник: agent documentation, 2026-11-06

### Where Antigravity and OpenClaw read global rules
- когда: antigravity rules · GEMINI.md · rules always_on · openclaw rules SOUL.md
- вещь: Antigravity · OpenClaw · GEMINI.md · SOUL.md
1. Antigravity — always active `~/.gemini/AGENTS.md`, `~/.gemini/GEMINI.md` (and the same in `~/.gemini/config/`); limit 24 000 bytes per file.
2. Files `~/.gemini/config/rules/*.md` load only with a header `trigger: always_on`.
3. OpenClaw — no global file: `AGENTS.md`, `SOUL.md`, `USER.md` in each agent's workspace; 20 000 characters per file, 60 000 total.
- ловушка: not `alwaysOn` in camelCase — silently dropped
- ловушка: OpenClaw does not load `TOOLS.md`
- источник: agent documentation, 2026-11-05

### Add a hook to Claude Code
- когда: add a claude code hook · hook in settings.json · UserPromptSubmit hook · PreToolUse deny
- вещь: Claude Code · `~/.claude/settings.json` · Node
1. Events: SessionStart, UserPromptSubmit (add text / block; cannot change the message), PreToolUse (deny), PostToolUse, Stop.
2. Run without a shell: `"command": "node", "args": ["C:/.../script.js"]` — forward slashes, no quoting; a dependency-free Node script costs ~0.2 s per call.
3. UserPromptSubmit and SessionStart: plain stdout goes into the model's context.
- источник: documentation and field experience, 2026-11-06

### Claude Code hook: deny a tool or keep the turn going
- когда: permissionDecision deny · decision block · stop_hook_active · Stop hook loops
- вещь: Claude Code · PreToolUse · Stop
1. Deny — `hookSpecificOutput.permissionDecision` (`deny` / `ask`); matcher `"*"` — all tools.
2. Stop: `{"decision":"block","reason":"…"}` prevents ending the turn, the reason goes to the model.
- ловушка: Stop input has `stop_hook_active` — when `true` let it pass, otherwise it loops
- источник: documentation and field experience, 2026-11-06

### Hint to the agent after a tool (PostToolUse)
- когда: PostToolUse additionalContext · hint after a command · hook after a tool
- вещь: Claude Code · PostToolUse · hookSpecificOutput
1. Input: `tool_name`, `tool_input`, `tool_response`.
2. Text for the model: `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"…"}}` — arrives right after the tool result.
3. One script can serve several events — branch on `hook_event_name`.
- источник: field experience, 2026-11-06

### A new hook — does it work in the open session
- когда: hook did not fire · hook in an open session · new claude code hook
- вещь: Claude Code · settings.json · session
1. Hooks from `settings.json` surely load in a new session; in an open one — not always.
2. Do not guess — test with a harmless command the hook should stop or annotate.
- источник: field experience, 2026-11-06

### Add a hook to Codex
- когда: codex hook · hooks.json codex · config.toml hooks
- вещь: Codex · `~/.codex/hooks.json` · `/hooks`
1. File `~/.codex/hooks.json` or `[hooks]` in `config.toml`: `{"hooks":{"<Event>":[{"matcher"?:"regex","hooks":[{"type":"command","command":"shell string","timeout":sec}]}]}}`.
2. Same events as Claude Code. Input on stdin, snake_case: `session_id`, `transcript_path`, `cwd`, `prompt`, `tool_name` + `tool_input.command`.
3. Text for the model — plain stdout on UserPromptSubmit; deny — `permissionDecision: "deny"` with `permissionDecisionReason`, or exit code 2 + reason in stderr.
- ловушка: a new or changed hook does nothing until a person approves it in `/hooks` — trust is bound to its hash
- источник: Codex documentation, 2026-11-05

### Codex hook: Failed, the model got nothing
- когда: hook: SessionStart Failed · hook: UserPromptSubmit Failed · codex hook does not fire
- вещь: Codex · hooks · hook stdout
1. A start/message hook answer must not begin with `[` or `{`: Codex reads it as JSON, fails to parse and reports Failed. Start with a plain word.
2. Live check: `codex exec --skip-git-repo-check -C <folder> "<request>" < /dev/null` — lines `hook: <event> Completed/Failed`; what the model got — in the latest `~/.codex/sessions/<date>/rollout-*.jsonl` (`developer` message).
- ловушка: it fails only for some answers — the ones that happened to start with a bracket
- источник: field experience, 2026-11-08

### Add a hook to Antigravity
- когда: antigravity hook · .gemini hooks.json · PreInvocation
- вещь: Antigravity · `~/.gemini/config/hooks.json`
1. Top level: `{"<name>":{"enabled":true,"PreInvocation":[handler],"PreToolUse":[{"matcher":"regex","hooks":[handler]}]}}`, handler `{"type":"command","command":"…","timeout":sec}`.
2. Events: SessionStart, PreInvocation (before each model call), PreToolUse, PostToolUse, Stop. Input camelCase: `conversationId`, `transcriptPath`, `toolCall.name` (shell is `run_command`), `toolCall.args.CommandLine`.
3. Text for the model — `{"injectSteps":[{"ephemeralMessage":"…"}]}`; PreToolUse **must** return `decision`: `allow` / `deny` / `ask`.
- ловушка: there is no "user message" event — the message text is in no event, read it from the transcript
- источник: Antigravity documentation, 2026-11-05

### Antigravity hook: Cannot find module and every tool is blocked
- когда: Cannot find module .gemini\config · antigravity hook does not start · failed PreToolUse blocks tools
- вещь: Antigravity · hooks.json · node
1. Antigravity runs the hook command without a shell: quotes become part of the file name, relative paths start from `.gemini\config`.
2. Write the path unquoted, absolute, with forward slashes; a path with spaces — use its 8.3 short name.
- проверка: split the command by spaces and run it without a shell from `.gemini\config` → `{"decision":"allow"}`
- ловушка: a crashed PreToolUse hook blocks all tools of the agent
- источник: field experience, 2026-11-05

### OpenClaw hook — a plugin and its events
- когда: openclaw hook · openclaw plugin · before_tool_call · before_prompt_build
- вещь: OpenClaw · plugin · definePluginEntry
1. `package.json` (`"openclaw":{"extensions":["./index.js"]}`), `openclaw.plugin.json` (`id`, `name`, `activation`), entry `{id, name, description, configSchema, register(api){ api.on(...) }}` — plain JS works.
2. Events: `before_channel_ingress`, `before_agent_run`, `before_prompt_build` (return `prependContext` / `appendContext`), `before_tool_call` (`{block:true, blockReason}` or `{requireApproval:{…}}`).
3. Conversation access — `plugins.entries.<id>.hooks.allowConversationAccess`.
4. Docs ship inside the npm package: `node_modules/openclaw/docs/plugins/hooks.md`, types in `dist/*.d.ts`.
- ловушка: hook timeout 15 s; a crashed `before_tool_call` blocks the call
- источник: OpenClaw package documentation, 2026-11-05

### Install and check an OpenClaw plugin
- когда: openclaw plugins install · Plugin requires capability consent · openclaw plugins inspect
- вещь: OpenClaw CLI · plugin · gateway
```
openclaw plugins install --link <folder> --force --accept-capabilities
openclaw plugins enable <id> --accept-capabilities
openclaw config set plugins.entries.<id>.hooks.allowConversationAccess true
openclaw plugins inspect <id> --runtime --json
```
1. `inspect` → `"status": "loaded"` and `typedHooks`; the running gateway picks it up after `openclaw gateway restart` (interrupts agents).
- ловушка: do not edit `openclaw.json` by hand — it holds keys; use `config set`
- ловушка: the CLI writes "slow SQLite transaction hold" to stderr — not an error, check the exit code
- источник: field experience, 2026-11-05

### Read a Claude Code session transcript
- когда: claude code session transcript · transcript jsonl · .claude/projects jsonl
- вещь: Claude Code · JSONL · transcript_path
1. Path: `~/.claude/projects/<folder>/<session>.jsonl`.
2. Human message — `type:"user"` with a string `message.content`; tool calls — `type:"assistant"` items `tool_use` (`name`, `input`); results — `type:"user"` with `tool_result`.
- ловушка: big transcripts — read as a stream, line by line
- источник: field experience, 2026-11-06

### Tune a hook threshold
- когда: tune hook threshold · hook fires for nothing · hook misses real cases
- вещь: threshold · session transcripts · manual labels
1. Run the hook over every turn of real sessions and label a sample "relevant / partly / off".
2. A turn ends at the **first** next string `type:user` record of any kind, including hook feedback.
- ловушка: not on invented examples: a made-up set showed 1/16 noise, real messages showed the hook firing on 66 % and mostly off-topic
- источник: owner's rule and field experience, 2026-11-06

### A hook on the agent's text catches quotes
- когда: hook catches quotes · false Stop hook trigger · request in quotes
- вещь: Stop hook · final message · quotes
1. Look for marker words in the final message **outside quotes and code**.
2. Facts of action (experience written, code checked) — by tool calls and git, not by words.
- ловушка: a write by a shell command is invisible to a hook that looks at file tools — write with the file tools
- источник: field experience, 2026-11-05

### A rule "in situation Y always do X" — make it a hook
- когда: rule always do · agent forgets the rule · turn a rule into a hook
- вещь: hooks · owner's rules · experience
1. Write it not only as text in experience: make situation Y a trigger of a hook — text is forgotten, a hook is not.
2. Fire on the agent's own actions (a call, the end of a turn), not only on the owner's words.
- ловушка: a general reminder in every message becomes background noise
- источник: owner's rule, 2026-11-05

### Hint from a command's error text — what to drop
- когда: hint after an error · irrelevant hint after error · hook on command output
- вещь: PostToolUse · stderr · stack trace
1. Drop stack trace lines (`at …`, `node:internal`) from error output — they pull in unrelated hints.
2. Take the error from stderr when there is one: the word "error" in normal output is not an error.
3. Threshold for commands — stricter than for messages: commands have many words.
- источник: field experience, 2026-11-06
