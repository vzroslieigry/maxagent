# Inbox — unsorted "save it for later"

The owner says "save this", "for later", "remember this", "put it in <project>" — the agent stores it here **as is, without sorting and without asking "where"**. So nothing gets lost "somewhere".

- A project is named or the talk is clearly about the current project → `projects/<project>/inbox/`; otherwise — here. For a future project (no folder yet) — here, with a line `Project: <name>`.
- One thing — one file `YYYY-MM-DD-<short-latin>.md`: what the owner gave — **verbatim** (text, link; an image or file — a copy next to it with the same name), a "From:" line (chat, page, file) and "Why:" if said. Don't rewrite, shorten or sort.
- **A screenshot or copied files** (the owner puts them on the clipboard) — on Windows with the script: an image becomes PNG, files become copies, text becomes `.md`:
  ```
  powershell -NoProfile -STA -File "{{TOOLS}}/save-clip.ps1" -Dir inbox -Name YYYY-MM-DD-<short>
  ```
  Next to it — an `.md` with "From:" / "Why:".
- **A link** — the address verbatim and what the owner said about it; don't open or summarise the page (sorting comes later). **A thought, an idea** — verbatim, in their words.
- A **`Kind:`** line — `future task` / `future project` / `for later, project` / `don't forget`. "Don't forget" items are shown by the hook at the start of every session.
- If a repository is on — commit and push right away. Answer the owner with one line linking the file.
- "Find what I saved about …" — search all inboxes at once (`inbox/` and `projects/*/inbox/`).
- **Sorting — only when the owner says so** ("sort the inbox"): each thing goes to experience, to a project or to the Trash as they say; sorted items leave the inbox.

Sample file:
```
# <short, what it is about>
Kind: don't forget
Project: <name, if any>
From: chat, YYYY-MM-DD
Why: <if said>

<verbatim, what the owner gave>
```
