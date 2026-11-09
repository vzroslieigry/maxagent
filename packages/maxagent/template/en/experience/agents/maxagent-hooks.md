---
title: maxagent hooks — experience before an action, before a search, format check
task: What to do when a maxagent hook stopped a command or a web search, or showed experience format errors
aliases: hook, maxagent, experience before action, experience before search, PreToolUse, PostToolUse, stopped the command, deny, hook error
---

### The "experience before action" hook stopped a command
- когда: experience before action · PreToolUse hook error · hook stopped the command
- вещь: maxagent hook · PreToolUse · deny
1. Read the atom shown and decide whether it fits this command.
2. It fits — rewrite the command by it; it doesn't — repeat the same command: this atom won't stop it a second time.
3. After the repeat check the result (`git log -1`, the file, the output): the first time **nothing** in the chain ran.
- ловушка: don't assume the commit or the copy went through — the whole command was stopped, including a chain with `&&`
- источник: maxagent experience, 2026

### The "experience before search" hook stopped a web request
- когда: experience before search · hook error WebFetch · hook error WebSearch · subagent could not load the page
- вещь: maxagent hook · WebFetch · WebSearch · subagent
1. Read the experience entries shown: the answer is there — do it that way.
2. No answer there — repeat the same request: the hook lets it through the second time in this turn.
3. A subagent reported "could not load" — it is not the site refusing: tell it to retry the same address once.
4. What you found on the web — write it into experience afterwards.
- источник: maxagent experience, 2026

### The hook showed format errors after writing experience
- когда: does not follow the atom format · E010 field missing · E013 characters limit · E016 trigger reduces
- вещь: maxagent hook · lint · atom
1. Fix it right away, by the lines in the message; format — `experience/_spec.md`.
2. Check: `node ~/.maxagent/tools/experience-engine.js lint <file>` → "ошибок нет".
- ловушка: don't postpone — the pre-commit hook won't let an experience file with errors through
- источник: maxagent experience, 2026
