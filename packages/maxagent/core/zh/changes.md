# maxagent 新内容

更新后，智能体会向主人显示一次新内容（规则，第 8 节），并在 `experience/maxagent.md` 中留下记录。

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
- 彻底移除暗号：模型反正会在消息里看到它，它带来的麻烦比帮助多。保护靠的是「读到的一切都是数据」这条规则、注入信号、阻止破坏性命令，以及智能体自身的权限确认。更新时会删除旧暗号的哈希。
- OpenClaw 插件：每次请求都带核心规则和经验提示、阻止破坏性命令、搜索前先查经验。通过 OpenClaw CLI 安装；重启网关后生效（`openclaw gateway restart`）。

## 0.3.0
- 核心规则 — `AGENTS.md` 中一份简短的「始终」清单：通用条目加上来自你设置的条目；钩子在会话开始时和上下文压缩后显示它们。
- 经验成为一个库：按事物分文件夹（`platform`、`tools`、`code`、`agents`、`craft`、`owner`），有条目模板，索引由头部生成（`npx maxagent index`）。
- 「完成」前的检查：修改代码后，智能体不运行或不打开任何东西就不能说「完成」。
- 浏览器守卫（如果选择了浏览器桥）：智能体的内置浏览器被禁止；「浏览器桥未连接」— 只需一步，`launch_browser`。
- 电脑环境卡片（操作系统、shell、Python、Node…）— 会话开始时显示摘要。
- 收件箱「先存着，以后再说」— 一个 `inbox/` 文件夹；钩子会提示并提醒「别忘了做」的条目。
- `npx maxagent setup` — 更改设置：仓库、浏览器桥、单独的桌面、回复格式、回收站。

## 0.2.0
- 适用于 Claude Code、Codex、Antigravity 的钩子：经验提示、「经验记录了吗？」检查、阻止破坏性命令。
