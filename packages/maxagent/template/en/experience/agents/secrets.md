---
title: Passwords, keys and tokens — never into files
task: Don't write a secret into experience, a project, a log or the repository; what to do if a secret already got into a file
aliases: password, key, token, secret, API key, .env, leaked key, credentials
---

### A password, key or token needs to be kept
- когда: save the key · write down the password · token into config · API key into a file · add .env
- вещь: secrets · experience · repository · .gitignore
1. The value itself — never into experience, projects, logs, commits or replies. Write only **where it is**: "the key is in the password manager", "the token is in the environment variable `<NAME>`".
2. A program needs a key — an environment variable or a local file that is in `.gitignore` before the first commit.
3. Before a commit look through `git diff --cached` for anything that looks like a key.
- проверка: `node ~/.maxagent/tools/experience-engine.js lint <file>` does not flag a secret
- ловушка: don't enter passwords or payment details for the owner — the owner signs in and pays
- источник: maxagent experience, 2026

### A secret already got into a file or a commit
- когда: key got into a commit · token in the repository · password in a log · committed a key by accident
- вещь: secrets · git · leak
1. Tell the owner right away: which secret and where it is visible.
2. Remove the value from the file; if the commit is already pushed — treat the secret as exposed: the owner changes it at the service.
3. Rewrite git history — only on the owner's word.
- ловушка: removing it in the next commit does not remove the secret from history
- источник: maxagent experience, 2026
