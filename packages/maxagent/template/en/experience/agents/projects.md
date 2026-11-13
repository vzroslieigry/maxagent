---
title: Working with projects — continue, log a task, close
task: Continue a project from the stopping point, open a task or incident card, record the end of a task
aliases: project, continue project, where we stopped, active task, task card, incident, stage status, record, close task, projects.md, project, task card
---

### Continue the project: where we stopped
- когда: continue the project · where did we stop · project task · active task
- вещь: projects.md · project card
1. The repository is enabled — first `git pull --rebase`, then read.
2. `projects.md` → the project row → `projects/<name>/README.md` → the active task. Don't start from zero if a stopping point is recorded.
- ловушка: read the project without a pull — took an outdated version and asked again what the owner had already answered
- источник: maxagent experience, 2026

### Log a project task or incident
- когда: open a project task · log an incident · task card · five blocks
- вещь: projects/<name>/tasks · statuses
1. File `projects/<name>/tasks/<date>-<title>.md` (incident — `projects/<name>/incidents/…`); template — `projects/_example/tasks/_TEMPLATE.md`.
2. Five blocks: symptom; diagnosis; root cause; what was done; how to check quickly on a repeat (command and expected result).
3. Statuses belong to stages and tasks, not to the project: `[▶]` in progress, `[⏸]` paused or blocked, `[✓]` done, `[ ]` planned. The project's `README.md` is only a map: goal, stage tree, link to the active task.
- источник: maxagent experience, 2026

### Close a project task
- когда: close the task · record the result · update the project status · double record
- вещь: projects.md · experience · git
1. Stage or task status in `projects/<name>/…`, project row in `projects.md`.
2. New knowledge (researched something, something didn't work, owner's rule, a repeatable way) — an atom in `experience/` per `_spec.md`, check with `lint`.
3. Repository enabled — `git add <own paths>` → commit → `git pull --rebase` → push; if that fails — a line in `sync.md`.
- источник: maxagent experience, 2026
