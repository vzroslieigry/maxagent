---
title: Git — когда рядом работают другие агенты или люди
task: Закоммитить только своё, отправить через pull --rebase, проверить, что push дошёл; не потерять чужие правки
aliases: git, коммит, commit, push, pull --rebase, stash, отправить на GitHub, синхронизация, чужая правка, unstaged changes, worktree
---

### Закоммитить и отправить своё
- когда: закоммить · отправь на GitHub · git commit · git push · git add -A · git add . · сохрани в репозиторий
- вещь: git · свои файлы · чужие правки
1. Перед правкой и перед отправкой — `git pull --rebase`.
2. В коммит — только свои пути: `git add <путь>`, не `git add -A`, не `git add .` и не целую папку.
3. Отправка: `git pull --rebase`, затем `git push`.
4. Сверить: `git fetch -q`, затем `git rev-parse --short HEAD` и `git rev-parse --short @{u}` — должны совпасть.
- проверка: HEAD и ветка на сервере совпали; не вышло — строка в `sync.md`
- ловушка: `git add -A` захватывает чужую незакоммиченную работу
- источник: опыт maxagent, 2026

### pull --rebase отказывает: You have unstaged changes
- когда: cannot pull with rebase · You have unstaged changes · чужие незакоммиченные правки мешают pull
- вещь: git stash · чужая работа · Git Bash
1. Свои файлы уже в коммите; чужие правки на время убрать и вернуть (Git Bash):
```
git stash push --include-untracked -m tmp && { git pull --rebase && git push; git stash pop; }
```
2. `;` перед `git stash pop` — чтобы чужая работа вернулась, даже если `pull` или `push` упали.
3. До и после сравнить `git status --short`.
- ловушка: не `2>/dev/null` у stash — ошибка спрячется, а `pop` не выполнится
- ловушка: stash общий для всех worktree одного репозитория — чужие записи в нём не трогать
- источник: опыт maxagent, 2026

### Коммит «отправлен», а на сервере его нет
- когда: push не ушёл · коммита нет на GitHub · отправлено а нет
- вещь: git push · origin · проверка
1. После push всегда `git fetch -q` и сравнить `git log -1 --format=%h @{u}` с `git log -1 --format=%h`.
2. Не совпали — найти ошибку в выводе, повторить отправку; не докладывать «отправлено».
- ловушка: команду со всей цепочкой мог остановить хук — тогда не выполнилось ничего из неё
- источник: опыт maxagent, 2026
