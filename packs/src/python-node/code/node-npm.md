---
title: Node and npm — your own CLI package, installers, running npm from code
aliases: Node, npm, npx, package, CLI, installer, npm pack, npm view, gitignore in package, readline, piped answers, spawn, EINVAL, shell true, backup, npm publish, provenance
---

### Build your own npm package with a command
- когда: own npm package · npm pack · publish a package · npm name is free
- вещь: npm · package.json · CLI
1. Contents — `npm pack --dry-run`: the files you expect, no service files or tests.
2. Keep a template `.gitignore` as `gitignore` and rename it when copying.
3. A name is free if `npm view <name> name` prints nothing (exit code 1 = "not found", not an error).
- ловушка: npm always and silently drops `.gitignore` from a package, `files` does not help
- ловушка: `README.md`, `package.json`, `LICENSE` always get into the package — keep no notes there
- источник: field experience, 2026-11-05

### A program reads answers from a piped stream of lines
- когда: piped answers · printf | node cli.js · readline loses lines · program silently exits
- когда: printf 'a\nb\n' | node cli.js
- вещь: Node · readline
1. Own line queue: `rl.on('line')` pushes, `question()` takes from the queue; on `close` — the default value.
- ловушка: `readline/promises` + `rl.question` loses lines that came before the question, and the process exits with code 0
- источник: field experience, 2026-11-05

### An installer edits other programs' files (agent settings)
- когда: installer edits settings · write a block into someone's file · test an installer
- вещь: installer · backup · markers
1. Test only with a substituted home folder: `--home <temp>`.
2. Before the first edit of someone else's file — a copy next to it: `<file>.<package>-backup`.
3. Your block goes between start and end markers; keep the file's line endings (CRLF/LF).
4. Uninstall is checked by "the file is back byte for byte".
5. "Touch nothing" is a separate flag (`--no-agents`), not an empty string.
- ловушка: `--agents ""` from PowerShell 5.1 arrived without a value and the installer wrote into real agents' settings
- источник: field experience, 2026-11-05

### Run npm or npx from Node code
- когда: spawnSync npm · spawn EINVAL · run npx from node
- вещь: Node 22 · child_process · .cmd
1. `spawn` / `spawnSync` for npm and npx on Windows — with `shell: true`.
- ловушка: `spawnSync('npm', …)` without a shell — EINVAL: Node 22 does not run `.cmd` files by itself
- источник: field experience, 2026-11-05

### Run python -c from Node on Windows
- когда: spawnSync python -c · Python not found from node · python is not visible from script
- вещь: Node · child_process · Python · cmd
1. For `.exe` programs (python, winget) — `spawnSync(cmd, args, { shell: false })`.
2. `shell: true` only for `.cmd` (npm, npx).
- проверка: `python -c "import sys;print(sys.version)"` from Node prints the version
- ловушка: with `shell: true` cmd mangles quotes and `;` inside `-c` code — an installer decided Python was missing and tried to install another one
- источник: field experience, 2026-11-08

### Publish your package to npm (2026 rules)
- когда: publish a package to npm · npm publish · trusted publishing · npm v12
- вещь: npm v12 · trusted publishing · provenance
1. Do not download heavy things in `postinstall`: npm v12 does not run install scripts by default — download inside the program after consent.
2. The first publish of a package — by hand, signed in with 2FA (`npm login`).
3. After that — trusted publishing from GitHub Actions (OIDC) with provenance, no long-lived token.
- ловушка: tokens that bypass 2FA stop publishing from January 2027
- источник: GitHub changelog, 2026-07-08
