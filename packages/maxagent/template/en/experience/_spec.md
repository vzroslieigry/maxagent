# How experience is written

One rule for all agents (Claude Code, Codex, Antigravity, OpenClaw and others). Experience is **a repeatable action without searching and mistakes**: last time you searched, tried, failed — now you go straight to the working way. Not a story, not reasoning, not a retelling of the conversation.

## How experience surfaces

The maxagent hook finds atoms by itself and shows the agent the best one in full — in three places:
1. on the owner's message;
2. before a tool call (a command, a web search) — by the `когда` lines;
3. after a command error — by its text.

Nothing has to be "loaded into memory" separately: you wrote an atom into a file — from the next step any agent finds it. The index rebuilds itself, only for changed files.

Search is twofold: by words (exact names: ffmpeg, SSH, `grep -P`) and by meaning — multilingual-e5-small vectors, offline, when the model is installed ("is the server even alive?" finds "Check whether the server is alive"). Before a tool call — only by the `когда` lines, so a command does not pull in something random.

## When to write

Write if in this task:
- you had to search (web, documentation, someone else's code, trying commands);
- something did not work and you did it differently;
- the owner gave a rule or a correction;
- you got a way that will clearly repeat.

Ordinary steps along a known path are not experience. There is already an atom about it — **fix that atom**, don't write a second one.

## Where

`experience/<kind>/<thing>.md`, file name in Latin letters. Kind: `platform` (computer, OS, shells), `tools` (programs and services), `code` (languages, libraries), `agents` (agents and their hooks), `craft` (a craft: video, writing, design), `owner` (how the owner works). Knowledge for one project only — in `projects/<project>/`. One thing — one file: what the knowledge is about (ffmpeg, SSH to the server), not where you learned it.

The `experience/shared/` folder holds shared packs of other people's experience: don't edit them. A shared atom proved useful — `adopt` it (see `agents/shared-experience.md`).

## File

```
---
title: Windows command line — PowerShell 5.1, Git Bash
task: Run a command without mistakes in syntax, paths and encoding
aliases: terminal, shell, PowerShell, bash, cmd, command
---

### <atom>
...
```

- `title` — the thing, one line.
- `task` — which tasks the file solves, one line: this is the "When to read" column in the `experience.md` index.
- `aliases` — words people will search with: in your language and in English, command names.

## Atom

A `###` section — one task, one pitfall or one rule. At most **900 characters** in total: it is shown to the agent whole.

**Field names stay in Russian** — the engine reads exactly these words, in any language of the library: `когда` (when), `вещь` (thing), `проверка` (check), `ловушка` (pitfall), `источник` (source). Everything after the colon is in your language.

```
### Chain commands in PowerShell 5.1
- когда: PowerShell && · chain commands PowerShell
- когда: The token '&&' is not a valid statement separator
- вещь: Windows · PowerShell 5.1
1. Instead of `A && B` — `A; if ($?) { B }`; without a condition — `A; B`.
- проверка: the command ran without a parse error
- ловушка: not `A && B` in PowerShell 5.1 — a parse error
- источник: own experience, 2026-11-05
```

| Line | Required | What to write |
|---|---|---|
| `- когда:` (when) | yes, may repeat | triggers: the words of the request, the agent's intent, tool and command names, error text. Parts separated by ` · `; a part fires before a call when **all** its words are in the command |
| `- вещь:` (thing) | yes | 2–6 items separated by ` · ` |
| steps | yes | what to do: numbered steps, commands in `` ` `` or in a code block |
| `- проверка:` (check) | if there is one | what should come out |
| `- ловушка:` (pitfall) | as many as there are | "not X — because Y", one line |
| `- источник:` (source) | yes | own experience / documentation / owner + date |

Line order: `когда` → `вещь` → steps → `проверка` → `ловушка` → `источник`.

- Triggers — the way people will say them: "log in to the server", "check the users".
- A command trigger must keep at least two significant parts: `python <<`, `grep -P`, `git add -A`. One word (`python`, `grep`) would fire on every call. Words, flags (`-P`) and `&&`, `||`, `<<` are significant; paths and quotes don't count.
- A tool trigger includes its name: `PowerShell &&`, not `&&` (in Bash `&&` is legal, the atom would fire for nothing).
- **No data — no line.** No placeholders, no TODO.
- Passwords, keys, tokens — never. Only **where they are**: "the password is in the password manager".
- A line is at most 200 characters; anything longer — as steps.

## Check — one command for any agent

```
node ~/.maxagent/tools/experience-engine.js lint experience/<kind>/<thing>.md
node ~/.maxagent/tools/experience-engine.js find "<words of the task>"
```

`lint` → "ошибок нет" (no errors). `find` with the words of a future request → the new atom on top. After a write to `experience/` the hook runs `lint` itself and shows the errors; the pre-commit hook won't let a file with errors through.

The `experience.md` index is built from the file headers, don't edit it by hand:

```
node ~/.maxagent/tools/experience-index.js
```

The meaning-search threshold (`SIM_GATE` in the engine) depends on the library size: once there are many more atoms, run the requests you need and unrelated phrases through `node ~/.maxagent/tools/experience-engine.js explain "<phrase>"`. Unrelated ones must be below the threshold, the needed ones above.

An atom about a private project lives in `experience/projects/<project>/`; outside it the project name is not written (check E060). Other spellings — lines of `experience/projects/<project>/_names.txt`.
