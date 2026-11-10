# Changelog

maxagent and maxagent-bridge always share one version number and are released together.

## 0.5.12

- The "experience not recorded" check now works for every agent: Antigravity, Codex, OpenClaw and Hermes — the hook keeps its own ledger of the turn (search, runs, code fixes). In Hermes the reminder comes with the owner’s next message.

## 0.5.11

- OpenClaw and Hermes on a par with the others: experience reaches the model before and after commands, written experience is checked, the built-in browser is off when the bridge is chosen; new agents join on update.

## 0.5.10

- Hermes joins maxagent: rules and experience come through a plugin, the browser bridge is available. For an existing install: `npx maxagent update --agents <your agents>,hermes`.

## 0.5.9

- Install by an agent: the wizard no longer hangs or stays silent — it asks the owner everything through the agent and ends with a report of what is installed.

## 0.5.8

- Agents know which to use: to press, type or read — `snapshot`; to see how a page looks — a screenshot.

## 0.5.7

- A normal `snapshot` now answers in short lines: the screen first, no empty backdrops or duplicates. The full JSON — `format="full"`.

## 0.5.6

- Shared packs: downloads are retried on GitHub failures and one failed pack no longer stops the others; `doctor` no longer warns about pack headers.

## 0.5.5

- The fast `snapshot` answers in short lines instead of JSON — the screen takes several times less.

## 0.5.4

- A new agent knows the fast snapshot and pixel click from the start; a big `snapshot` suggests the fast mode itself; on a bridge error look at a screenshot first.

## 0.5.3

- Bridge: `snapshot` can read only what is on the screen and search elements by words — many times smaller answers on big pages.
- Bridge: `click_at` clicks by pixels of a screenshot — for players and canvas.
- Bridge: a file upload can be allowed once or always for this agent on this site; revoke it in the extension popup.

## 0.5.2

- Experience hints no longer stop commands or searches — they arrive as a memory.
- At the end of an answer the agent adds only what is really missing.
- Every agent's installed skills are found on request: a personal shelf, refreshed once a day.
- OpenClaw: a memory comes with the tool result; one more pass at the end of a turn only if something is missing.

## 0.5.1

- `npx maxagent experience share`: check and prepare a pack for the shared library (format, secrets, planted commands, personal data); sends nothing.
- CONTRIBUTING, pack submission form, automatic pack release after a merge.
- Self-update uses `--prefer-online`.
- CI: clean install from the packed tarballs on Windows, Linux and macOS, all required.

## 0.5.0

### maxagent
- **Two shelves of experience.** Own experience (`experience/`) surfaces and may stop commands; shared packs (`experience/shared/<pack>/`) are reference only: shown when the own shelf has nothing, at most one atom per message, compact, never stop a command, usage counter on the machine. Meaning threshold for shared packs measured on the released packs (0.84).
- **Shared packs**: `npx maxagent experience list | add | update | mute | unmute | adopt`. Packs come from GitHub releases with ready int8 vectors; checksum, file names and content are checked before install. `adopt` copies a useful shared atom into own experience and hides the shared copy by id; the end-of-turn hook suggests it.
- **Setup wizard**: one question "Install everything / Choose / Nothing" for the extras — browser bridge with the Chrome extension, meaning search (pinned model revision and sha256, `pip --target`, self-test; without Python — `winget` after a yes), shared experience. New commands `bridge`, `vectors`, `experience`.
- **Self-update** once a day in the background: only a release built by this repository's workflow is installed (npm registry signatures and provenance attestations are verified, the provenance must name this repository); a new major version waits for the owner's "yes"; maxagent and the bridge update together; `--no-auto-update` / `npx maxagent setup` turns it off. News once per id.
- **Experience for answers**: the format rule in every reminder, a check of the finished answer (paths and commands as a link or a code block — the agent adds only what is missing, never repeats the answer), the `experience/answer` shelf searched by the text of the answer. End-of-turn checks for Antigravity (Stop hook).
- **Search quality**: word search only on title, triggers and things (exact names, errors, commands); the body is matched by vectors. Latin words match whole (Remotion ≠ remote); a word match also needs meaning similarity ≥ 0.83. Recall set: 57/68 → 65/68 requests, 10/11 → 11/11 actions.
- Windows, Linux and macOS in CI, with meaning search.

### maxagent-bridge
- First public release: MCP server + Chrome extension over Native Messaging, per-agent approval, site blocklist, action log, stop button, `launch_browser`, `doctor`, `reload`.
- **Leaves no trace on sites**: no tool runs an agent's own code in a page; snapshot, clicks and typing run in an isolated world and keep no state in the page.
- **Tab audio**: `record_tab_start` / `record_tab_stop` — captured by Chrome itself (the page sees nothing); Chrome allows it after the owner clicks the bridge icon on the tab once or presses Alt+Shift+M. Saved as `.mp3`/`.wav` (ffmpeg) or `.webm`; never handed back to the agent as data.
- **Reload only when quiet**: install/update copy the files but reload the extension only when no agent has used the bridge for 10 minutes and no recording is running (`--force` to override).
- Extension icon.
