# maxagent

[Русский](README.ru.md)

Experience-first operating rules for every AI agent on your machine — Claude Code, Codex, Antigravity, OpenClaw.

Agents keep solving the same problem from scratch: they search, try, fail and find the way again, every session. maxagent gives all of them **one workspace**: an **experience** base of short, checked recipes ("atoms"), projects that remember where work stopped, and the same rules before every task. Hooks surface the right atom by themselves — on your message, before a command, after an error — so an agent does it the known way instead of guessing.

| Package | What it is |
|---|---|
| [`maxagent`](packages/maxagent) | rules, workspace, experience engine, hooks for each agent, setup wizard |
| [`maxagent-bridge`](packages/maxagent-bridge) | "hands" for agents: an MCP server that drives **your own** Chrome (your profile, your sign-ins) through a small extension — no open port, per-agent approval, site blocklist, action log, stop button |

## Install

Say it to your agent in one phrase:

> Install maxagent: run `npx maxagent init` and follow the wizard.

Or run it yourself:

```
npx maxagent init
```

Node.js 18+ is the only requirement. Nothing runs at `npm install` time (npm v12 does not run install scripts, and we do not need them): everything heavy is downloaded by the wizard, and only after you say yes.

## What the wizard sets up

1. **Workspace** (`~/maxagent` by default): `AGENTS.md`, `experience/`, `projects/`, `sync.md`, `inbox/`. These files are yours — updates never overwrite them. Optionally a private Git repository for sync.
2. **Rules and hooks** for every agent it finds (Claude Code, Codex, Antigravity, OpenClaw): a short marked block in each agent's global rules file and hooks that surface experience on every turn. Your own rules and hooks stay untouched; every edited file gets a backup first.
3. One question — **"Install everything / Choose / Nothing"** — for the extras:
   - **Browser bridge and Chrome extension** (`npx maxagent bridge`). The extension is loaded unpacked for now: three clicks in `chrome://extensions` (Developer mode → Load unpacked → the folder). The wizard waits until the bridge connects.
   - **Meaning search** (`npx maxagent vectors`, ~270 MB): the `multilingual-e5-small` model (pinned revision, checked by sha256) and its Python libraries in `~/.maxagent/vector`. Without Python the wizard offers to install it (on Windows via `winget`, after a separate yes); without it search works by words only.
   - **Shared experience packs** (`npx maxagent experience add all`).
4. A summary: what is on, what was skipped and the command to turn it on later.

| Command | What it does |
|---|---|
| `npx maxagent init` | first-time setup |
| `npx maxagent setup` | change settings |
| `npx maxagent doctor` | what is installed and whether it is healthy |
| `npx maxagent update` | update rules, hooks and agent blocks; your workspace is untouched |
| `npx maxagent bridge` · `vectors` | install an extra later |
| `npx maxagent experience list \| add <pack>\|all \| update \| mute <pack> \| adopt "<id>"` | shared experience |
| `npx maxagent uninstall` | remove blocks and hooks from agents; your workspace stays |

## Two shelves of experience

- **Your own** — `experience/` in your workspace. Written by your agents as they work, in the format of `experience/_spec.md`. Your atoms surface first and may stop a command that is known to fail.
- **Shared** — `experience/shared/<pack>/`, downloaded from this repository. Reference only: shown only when your own shelf has nothing, with a higher threshold, at most one atom per message, compactly (title and first step), and **never** stops a command. A shared atom that helped can be adopted — `npx maxagent experience adopt "<id>"` copies it into your own shelf and hides the shared copy. A pack that is noise for you — `mute`.

Packs are built by the maintainers with ready int8 vectors (same model and revision as yours), so your machine never recomputes them. Each pack is a single JSON file attached to a GitHub Release; `packs/catalog.json` lists them with sha256 and size. Before installing, the client checks the checksum, file names and the text itself (download-and-run commands, attempts to rewrite agent rules, sending secrets, destructive commands, hidden characters) and refuses the whole pack on any hit. CI runs the same checks on every pack source in `packs/src/`.

## Privacy: what goes to the network

maxagent sends nothing about you. All requests are plain GETs of public files:

| When | Where | What for |
|---|---|---|
| `npx` itself | `registry.npmjs.org` | download the package |
| once a day, in the background (if `updates` is on) | `registry.npmjs.org/maxagent/latest`, `…/maxagent-bridge/latest` | is there a newer version |
| same check | `raw.githubusercontent.com/vzroslieigry/maxagent/main/news.json` | one-time notes ("an extension is in the store", …) |
| only after your yes | `raw.githubusercontent.com/…/packs/catalog.json`, GitHub Releases | shared experience packs |
| only after your yes | `huggingface.co/Xenova/multilingual-e5-small` (pinned revision), PyPI | meaning search model and libraries |

`updates: false` in `npx maxagent setup` → no requests at all. The browser bridge has no network side of its own: the extension talks to a local program over Chrome Native Messaging, agents talk to it over a local pipe/socket.

## Updates

- Once a day, in the background, with a short timeout; a network error is silent.
- A newer version is announced once (at session start): `npx maxagent@latest update` plus 1–3 lines of what is new. The agent updates after your yes.
- `autoUpdate: "patch"` — bug-fix releases of the same minor line are installed by themselves; anything bigger still waits for your yes.
- News from `news.json` are shown once per id (`~/.maxagent/state/update-shown.json`).

## Repository layout

```
packages/maxagent          the main package
packages/maxagent-bridge   the browser bridge
packs/src/<pack>/          shared experience sources (Markdown atoms)
packs/catalog.json         published packs: version, url, sha256, size
news.json                  one-time notes for installed copies
scripts/                   sync and checks used by CI
```

Translations of the rules are made by an agent and not yet checked by native speakers.

License: [MIT](LICENSE).
