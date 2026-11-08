---
title: GitHub without gh — API through Git Credential Manager
aliases: GitHub, gh, API, create repository, private repository, GitHub token, git credential fill, Git Credential Manager, default_branch, nested repository, репозиторий
---

### Call the GitHub API without gh
- когда: gh command not found · call GitHub API · no gh CLI · GitHub token from git
- когда: gh repo · gh api · gh pr · gh auth
- вещь: GitHub API · Git Credential Manager · Git Bash
1. If `gh` is missing, the sign-in usually lives in Git Credential Manager.
2. Get the token in Git Bash, into a variable of one command only:
```
printf 'protocol=https\nhost=github.com\n\n' | GCM_INTERACTIVE=never git credential fill
```
3. The `password=` line is the token: never print it, never write it to files or logs.
- ловушка: not from PowerShell — the pipe breaks newlines, the answer is empty or "credential missing protocol field"
- источник: field experience, 2026-11-03

### Create a private repository on GitHub
- когда: create a repository · new private repo · create GitHub repo by API
- вещь: GitHub API · repository
1. Name is free: `GET https://api.github.com/repos/<owner>/<name>` → 404.
2. `POST https://api.github.com/user/repos` with `{"name":"…","private":true,"description":"…"}`.
3. After the first push: `PATCH /repos/<owner>/<name>` with `{"default_branch":"main"}`.
- ловушка: keep the description ASCII — non-ASCII in `curl -d` from Git Bash may not go out as UTF-8
- источник: field experience, 2026-11-03

### Keep a project's code as its own repository inside a workspace
- когда: project code as separate repository · nested git repository · code repo inside workspace
- вещь: git · nested repository · .gitignore
1. Nested repository in `projects/<project>/code`; its path goes into the outer `.gitignore`.
2. A previous version — a separate branch and tag, not a folder in `main`.
- источник: field experience, 2026-11-03

### Publish an npm package from GitHub Actions without a token
- когда: npm publish from GitHub Actions · trusted publishing npm · npm provenance
- вещь: npm · trusted publishing · OIDC · provenance
1. The very first publish of a package — by hand, signed in with 2FA (`npm login`, `npm publish --access public`).
2. On npmjs.com → package → Settings → Trusted publisher: GitHub repository and workflow file name.
3. Workflow: permission `id-token` set to `write`, Node 22+, `npm publish --provenance --access public` — no `NPM_TOKEN`.
- ловушка: long-lived tokens that bypass 2FA stop publishing in 2027 — do not build on them
- источник: npm and GitHub documentation, 2026-11-08
