# maxagent

Experience-first operating rules for any AI agent on your machine — Claude Code, Codex, Antigravity, OpenClaw.

Your agents stop solving the same problem from scratch: whatever they figure out goes into one shared **experience** base, projects keep track of where work stopped, and every agent reads the same rules before each task.

```
npx maxagent init
```

`init` asks a few questions (language, workspace folder, which agents to connect, optional private GitHub repo), then:

- creates your workspace (`~/maxagent` by default): `AGENTS.md`, `experience.md` + `experience/`, `projects.md` + `projects/`, `sync.md` — these files are yours: an update touches in them only the marked blocks in `AGENTS.md` and adds new template files;
- installs the package rules to `~/.maxagent/core/`;
- adds a short marked block to each agent's global rules file pointing to your workspace.

| Command | What it does |
|---|---|
| `npx maxagent init` | first-time setup |
| `npx maxagent doctor` | what is installed and whether it is healthy |
| `npx maxagent update` | update package rules and agent blocks; in the workspace only the marked blocks in `AGENTS.md` and new template files |
| `npx maxagent uninstall` | remove the blocks from agents; your workspace stays |

Options: `--lang ru|en`, `--workspace <path>`, `--agents claude-code,codex,antigravity,openclaw`, `--repo <url>`, `--yes`, `--dry-run`.

Rules are available in Russian and English. Planned next: hooks that remind agents to use experience on every turn and a separate `maxagent-bridge` package for full browser control.

License: MIT.

---

# maxagent (по-русски)

Регламент работы для любого ИИ-агента на вашем компьютере — Claude Code, Codex, Antigravity, OpenClaw. Главное — **опыт**: всё, что агент выяснил, записывается в общую базу, и ни один агент больше не решает одну задачу дважды с нуля.

```
npx maxagent init
```

Рабочая папка (`~/maxagent`) принадлежит вам — обновление трогает в ней только блоки с метками в `AGENTS.md` и новые файлы шаблона. `doctor` — проверка, `update` — обновление регламента, `uninstall` — убрать блоки у агентов (рабочая папка остаётся).
