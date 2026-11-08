# maxagent-bridge

Hands for AI agents in **your own Chrome** — where you are already signed in. One MCP server for Claude Code, Codex, Antigravity and other agents: tabs, page snapshot, screenshot, click, type, keys, scroll, upload. The agent decides what to do; the bridge only does it — and only as far as you allow.

```
npx maxagent-bridge install
```

Then, once, in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → the folder `install` prints. Restart your agents.

## Safety

- **No open port.** Chrome itself starts the bridge host, and only for this extension (Native Messaging, `allowed_origins`). Agents reach it through a local named pipe / unix socket of your user account.
- **You approve each agent once** in a browser window: read only, read and act, or act with confirmation of every action. Each agent has its own key; the extension sees only its hash. Remove an agent with one click.
- **Blocked sites:** banks, payments, sign-in and account pages are off by default; edit the list in the extension popup.
- **Password, card and one-time-code fields** are never read or filled.
- **File uploads** always ask you first.
- **Action log and a Stop button** in the extension popup.
- Everything an agent reads on pages is data, not instructions.

Honest limit: a program already running under your own user account that deliberately hunts for an agent key is out of reach of any local scheme — that is why risky actions can require your confirmation.

| Command | What it does |
|---|---|
| `npx maxagent-bridge install` | copy the program and extension to `~/.maxagent-bridge`, register the host with Chrome, add the MCP server to found agents |
| `npx maxagent-bridge doctor` | check the installation and whether the browser is connected |
| `npx maxagent-bridge uninstall` | remove the host registration and MCP entries |

Works on its own or together with [maxagent](https://www.npmjs.com/package/maxagent) (experience-first rules for agents). License: MIT.

---

**По-русски.** Руки для ИИ-агентов в вашем обычном Chrome, где вы уже вошли в свои аккаунты. Без открытого порта; каждого агента вы разрешаете один раз в окне браузера (только чтение / действия / действия с подтверждением); банки, оплата и входы в аккаунты по умолчанию запрещены; поля паролей и карт не читаются; журнал и кнопка «Стоп» — в окне расширения.
