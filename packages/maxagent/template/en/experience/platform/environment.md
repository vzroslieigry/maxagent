---
title: This computer's environment — OS, shells, programs
task: Which OS and shell, whether Python, Node, git, Chrome are there, administrator rights — before trying commands blindly
aliases: environment, OS, Windows, macOS, Linux, shell, PowerShell, bash, zsh, Git Bash, cmd, Python, Node, npm, git, Chrome, administrator, admin, rights, PATH, env-probe
verified: {{DATE}} — built by the script when maxagent was installed
---

# This computer's environment

The block between the markers is built by a script — don't edit it by hand, it will be overwritten. Your own findings about the environment — as atoms below.

<!-- env:auto:start -->
<!-- env:auto:end -->

## Atoms

### Find out what is on this computer
- когда: which OS · which shell · is Python installed · administrator rights · env-probe
- вещь: env-probe · OS · shells · programs
1. Read the block above: OS, shells, rights, Python, Node, git, Chrome.
2. Something changed (a program installed, the system updated) — rebuild it: `node "{{TOOLS}}/env-probe.js"`.
- ловушка: don't try commands and shells at random — this file first
- источник: maxagent experience, 2026
