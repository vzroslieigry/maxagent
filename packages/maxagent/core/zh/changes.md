# maxagent 新内容

更新后，智能体会向主人显示一次新内容（规则，第 8 节），并在 `experience/maxagent.md` 中留下记录。

## 0.5.10
- Hermes 已接入 maxagent：规则和经验通过插件提供，可使用浏览器桥接。现有安装：`npx maxagent update --agents <你的智能体>,hermes`。

## 0.5.9
- 由智能体安装：向导不再卡住或沉默，会通过智能体询问主人所有问题，并在最后给出安装报告。

## 0.5.8
- 智能体知道该用什么：点击、输入或阅读用 `snapshot`；查看页面外观用截图。

## 0.5.7
- 普通 `snapshot` 现在以短行返回：先显示屏幕内容，去掉空背景和重复项。完整 JSON：`format="full"`。

## 0.5.6
- 共享经验包：GitHub 故障时自动重试下载，单个失败不再影响其他包；`doctor` 不再对包的文件头发出警告。

## 0.5.5
- 快速 `snapshot` 用短行代替 JSON 返回，屏幕内容占用小很多。

## 0.5.4
- 新智能体一开始就了解快速 `snapshot` 和像素点击；大的 `snapshot` 会提示快速模式；桥接出错时先看截图。

## 0.5.3
- 桥接：`snapshot` 可只读取屏幕可见部分并按词搜索元素，大页面的返回内容小很多。
- 桥接：`click_at` 按截图像素点击，用于播放器和画布。
- 桥接：文件上传可允许一次，或对此智能体在此网站始终允许；可在扩展窗口撤销。

## 0.5.2
- 经验提示不再中断命令和搜索，而是作为记忆送达。
- 回答结束时，智能体只补充确实缺少的内容。
- 所有智能体已安装的技能都可按需找到：个人技能架，每天更新一次。

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
