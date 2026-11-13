---
title: maxagent — the shell itself
task: Questions about the shell: settings, checking the install, update, building the experience index; tell the owner what maxagent can do
aliases: maxagent, shell, settings, setup, introduction, core rules, update, doctor, experience index, experience-index
verified: {{DATE}} — maxagent {{VERSION}} installed
---

# Experience about maxagent itself

## Atoms

### Turn maxagent settings on or off
- когда: maxagent settings · npx maxagent setup · turn on the bridge · turn off the Recycle Bin
- вещь: maxagent · setup · settings
1. `npx maxagent setup` — repository, bridge, separate desktop, answer format, Recycle Bin; Enter — keep as is.
2. Language, workspace and the agent list are changed by running `npx maxagent init` again (experience is left untouched).
- источник: maxagent experience, 2026

### Check that maxagent is installed
- когда: check maxagent · npx maxagent doctor · what maxagent installed
- вещь: maxagent · doctor · agent protection
1. `npx maxagent doctor` — what is installed and each agent's protection level; ERROR — what is broken, WARN — what is out of date.
- источник: maxagent experience, 2026

### Update maxagent
- когда: update maxagent · npx maxagent update · new maxagent version
- вещь: maxagent · update · core rules
1. `npx maxagent update` — rules, injection base, hooks, core rules.
2. The workspace is not touched, except the "Core rules" and "Settings" blocks in `AGENTS.md` and the new template files; in 0.6.0 — once more the line about reading the rules at start (copy — `AGENTS.md.maxagent-backup`).
3. What's new — `{{CORE}}/changes.md`: retell the owner in a sentence or two.
- источник: maxagent experience, 2026

### Tell the owner what maxagent can do
- когда: explain maxagent · what can you do · how do I use this · introduction · show the installation
- вещь: maxagent · experience · projects · inbox
1. Briefly, in your own words: experience accumulates as atoms in `experience/` and surfaces by itself for the task; projects — `projects.md` and `projects/<name>/`; "save for later" — into `inbox/`.
2. What is enabled — the "Settings" section in `AGENTS.md`; change it with `npx maxagent setup`; check the install with `npx maxagent doctor`.
3. Suggest what can be said: "start a project …", "what do you know about …", "save this for later".
- источник: maxagent experience, 2026

### Build the experience.md index
- когда: build the experience index · experience-index · index is stale · npx maxagent index
- вещь: experience-index · experience.md · file headers
1. `node "{{TOOLS}}/experience-index.js"` (or `npx maxagent index`) — the table in `experience.md` from the `title`, `task`, `aliases` headers.
2. `--check` — check only: exit 1 if the index is stale or a file has no header.
- источник: maxagent experience, 2026
