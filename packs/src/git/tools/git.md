---
title: Git when other agents work in the same repository
aliases: git, commit, push, pull --rebase, stash, send to GitHub, sync, someone else's changes, partial commit, worktree, unstaged changes, CRLF, коммит, отправить
---

### Commit and push only your own work
- когда: commit and push · send to GitHub · git commit · git push · git add -A · git add .
- вещь: git · shared working copy · other agents' changes
1. Stage only your own paths: `git add <path>`, never `git add -A`, `git add .` or a whole folder.
2. Send: `git pull --rebase` → `git push`.
3. Verify: `git fetch -q; git log -1 --format=%h origin/main` equals `git log -1 --format=%h`.
- проверка: HEAD and origin/main are the same commit; if not — write it down for the next sync
- ловушка: `git add -A` captures another agent's uncommitted work
- источник: field experience, 2026-10-28 – 2026-11-08

### pull --rebase refuses: You have unstaged changes
- когда: cannot pull with rebase · You have unstaged changes · others' uncommitted edits block pull
- вещь: git stash · other agents' work
1. Full send next to someone else's work (Git Bash):
```
before=$(git status --short | wc -l)
git add <only your paths>
git commit -m "…"
git stash push --include-untracked -m tmp-mine && { git pull --rebase && git push; git stash pop; }
git fetch -q; git rev-parse --short HEAD; git rev-parse --short origin/main
```
2. `;` before `git stash pop` — others' work comes back even if pull or push failed.
3. Compare `git status --short` with `$before`.
- ловушка: no `2>/dev/null` on stash and no `exit` inside `{ … }` — the error hides and `pop` never runs
- ловушка: the stash stack is shared by all worktrees — in a worktree do not touch others' entries
- источник: field experience, 2026-11-03 – 2026-11-05

### Commit only your line in a file someone else also edited
- когда: commit only my line · git add -p unavailable · file has someone else's edit
- вещь: git apply --cached · unidiff-zero · Git Bash
1. See the hunks: `git diff -U0 <file> | grep '^@@'` (say `@@ -17` is theirs, `@@ -19` is yours).
2. Keep the header and your hunk, stage it:
```
git diff -U0 <file> | awk '/^@@ -19/{keep=1} /^@@ -17/{keep=0} /^diff|^index|^---|^\+\+\+/{print; next} keep{print}' > "$TEMP/my.diff" && git apply --cached --unidiff-zero "$TEMP/my.diff"
```
- проверка: `git diff --cached <file>` shows only your line, `git diff <file>` only theirs
- ловушка: `git add <file>` takes their line too, and `git add -p` is interactive — an agent cannot use it
- источник: field experience, 2026-11-04

### Commit reported as pushed, but it is not on GitHub
- когда: push did not go through · commit missing on GitHub · pushed but not there
- вещь: git push · origin/main
1. After every push: `git fetch -q` and compare `git log -1 origin/main` with `git log -1`.
2. Different — push again; do not report "pushed".
- ловушка: a chain with `2>/dev/null` hid that stash failed and `pull --rebase` refused
- ловушка: a hook may block the whole command chain — then nothing ran at all
- источник: field experience, 2026-11-05

### Network failed during pull — others' work stayed in the stash
- когда: Empty reply from server · another agent's files disappeared · stash pop did not run
- вещь: git stash · network
1. `git stash list` — find the fresh `WIP on main` or your own tagged entry → `git stash apply <sha>`, then drop that entry.
2. Compare `git status --short` with the count before.
- ловушка: `stash push && pull --rebase && push && stash pop` never reaches `pop` on an error — use the braces form
- источник: field experience, 2026-11-05

### Branch files vanished — another agent switched the shared working copy
- когда: branch files vanished · folder disappeared mid-work · someone ran git checkout
- вещь: git worktree · shared working copy
1. One working copy per task: `git worktree add <folder> <branch>`; point every command there.
2. Who is where: `git worktree list`.
- ловушка: never switch branches in a shared folder — a neighbour's checkout removes your branch's files mid-work
- источник: field experience, 2026-11-05

### After stash pop someone's file changed only in LF/CRLF
- когда: checksums changed after stash pop · LF will be replaced by CRLF
- вещь: core.autocrlf · SHA-256 · others' files
1. Before stash — save paths and SHA-256 of the raw bytes of others' files.
2. After pop — compare. If the hash of `raw.replace(b'\r\n', b'\n')` matches — restore the original bytes and check again.
- ловушка: neither raw nor normalised hash matches — do not overwrite, it may be someone's real work
- ловушка: do not change git settings for this
- источник: field experience, 2026-11-06
