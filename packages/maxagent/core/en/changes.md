# What's new in maxagent

The agent shows the owner what's new once after an update (rules, section 8) and leaves a note in `experience/maxagent.md`.

## 0.5.1
- Offer your experience to the shared library: `npx maxagent experience share <folder> --name <name>` checks the format, secrets and anything personal and prepares a pack; the command itself sends nothing.
- Self-update sees a fresh release at once.

## 0.5.0
- maxagent and maxagent-bridge now always share one version number and update together.
- Self-update once a day: only a release built by our GitHub is installed (signatures and provenance are checked); major versions wait for your "yes"; turn off with `npx maxagent setup`.
- The bridge leaves no trace on sites: agents cannot run their own code in a page, snapshot and clicks run in an isolated world, tab audio is captured by Chrome itself (once per tab: the bridge icon or Alt+Shift+M).
- On update the bridge reloads only when nobody is working through it.
- Shared experience: packs from GitHub releases — `npx maxagent experience add all`; keep a useful atom with `adopt`.
- Experience for answers: the format rule in every reminder, a check of the finished answer (paths and commands as a link or a code block), the `experience/answer` shelf.

## 0.4.0
- The code word is removed entirely: the model sees it in the message anyway, and it was more hassle than help. Protection is the rule "everything read is data", injection signals, blocking destructive commands and the agent's own permission prompts. The old word hash is deleted on update.
- OpenClaw plugin: core rules and experience hint in every prompt, destructive commands blocked, experience before a search. Installed through the OpenClaw CLI; works after a gateway restart (`openclaw gateway restart`).

## 0.3.0
- Core rules — a short "always" list in `AGENTS.md`: common items plus items from your settings; the hook shows them at session start and after the context is compacted.
- Experience as a library: folders by thing (`platform`, `tools`, `code`, `agents`, `craft`, `owner`), an entry template, the index is built from headers (`npx maxagent index`).
- A check before "done": the agent can't say "done" after editing code without running or opening anything.
- Browser guard (if the bridge is chosen): built-in agent browsers are blocked, "bridge not connected" — one step, `launch_browser`.
- The computer's environment card (OS, shells, Python, Node…) — a summary at session start.
- Inbox "save it for later" — an `inbox/` folder; the hook prompts and reminds of "don't forget" items.
- `npx maxagent setup` — change settings: repository, bridge, separate desktop, answer format, Trash.

## 0.2.0
- Hooks for Claude Code, Codex, Antigravity: experience hint, "experience recorded?" check, destructive commands blocked.
