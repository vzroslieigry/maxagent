---
title: Git — when other agents or people work next to you
task: Commit only your own files, push via pull --rebase, check that the push arrived; don't lose other people's changes
aliases: git, commit, push, pull --rebase, stash, push to GitHub, sync, someone else's change, unstaged changes, worktree
---

### Commit and push your own work
- когда: commit the changes · push to GitHub · git commit · git push · git add -A · git add . · save to the repository
- вещь: git · own files · other people's changes
1. Before editing and before pushing — `git pull --rebase`.
2. Only your own paths into the commit: `git add <path>`, not `git add -A`, not `git add .` and not a whole folder.
3. Push: `git pull --rebase`, then `git push`.
4. Verify: `git fetch -q`, then `git rev-parse --short HEAD` and `git rev-parse --short @{u}` — they must match.
- проверка: HEAD and the remote branch match; if not — a line in `sync.md`
- ловушка: `git add -A` grabs someone else's uncommitted work
- источник: maxagent experience, 2026

### pull --rebase refuses: You have unstaged changes
- когда: cannot pull with rebase · You have unstaged changes · other uncommitted changes block pull
- вещь: git stash · other people's work · Git Bash
1. Your files are already committed; put other changes aside and bring them back (Git Bash):
```
git stash push --include-untracked -m tmp && { git pull --rebase && git push; git stash pop; }
```
2. `;` before `git stash pop` — so the other work comes back even if `pull` or `push` failed.
3. Compare `git status --short` before and after.
- ловушка: no `2>/dev/null` on stash — the error hides and `pop` does not run
- ловушка: the stash is shared by all worktrees of one repository — don't touch other entries in it
- источник: maxagent experience, 2026

### Commit "pushed", but it is not on the server
- когда: push did not go · commit missing on GitHub · pushed but not there
- вещь: git push · origin · check
1. After a push always `git fetch -q` and compare `git log -1 --format=%h @{u}` with `git log -1 --format=%h`.
2. They differ — find the error in the output, push again; don't report "pushed".
- ловушка: a hook may have stopped the whole command chain — then none of it ran
- источник: maxagent experience, 2026
