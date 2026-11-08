---
title: Windows command line — PowerShell 5.1, Git Bash, encoding, paths
task: Run a command on Windows without mistakes in syntax, paths and encoding
aliases: terminal, console, shell, command, PowerShell, powershell.exe, pwsh, Git Bash, bash, MSYS, cmd, encoding, garbled text, mojibake, BOM, UTF-8
---

### Chain commands in PowerShell 5.1
- когда: PowerShell && · PowerShell || · chain commands PowerShell
- когда: The token '&&' is not a valid statement separator
- вещь: Windows · PowerShell 5.1 · syntax
1. The PowerShell built into Windows is 5.1 (`powershell.exe`), not 7: use 5.1 syntax.
2. Instead of `A && B` — `A; if ($?) { B }`; without a condition — `A; B`.
3. No `?:`, `??`, `?.` — write `if / else` and a `$null -eq` check.
- проверка: the command ran without a parse error
- ловушка: don't carry PowerShell 7 syntax over to 5.1 — a different version of the language
- источник: maxagent experience, 2026

### Pass a path to a Windows program from Git Bash
- когда: path /c/Users · file not found from Git Bash · No such file /c/
- вещь: Git Bash · paths · python · node
1. For Git Bash itself — `/c/Users/...`.
2. For Windows programs (python, node and others) — `C:/...` or `C:\...`.
- ловушка: no `/c/...` in program arguments — only Git Bash understands them, the file is silently not created
- источник: maxagent experience, 2026

### Non-English text in the output became garbage
- когда: garbled text · mojibake · ��� · UnicodeEncodeError · cp1252 · cp1251
- вещь: console encoding · Python · PowerShell
1. Python: `PYTHONIOENCODING=utf-8` before the command or `sys.stdout.reconfigure(encoding='utf-8')`.
2. PowerShell, output read by another program: `[Console]::OutputEncoding=[Text.Encoding]::UTF8; <command>`.
3. Write files for other programs explicitly in UTF-8: `Set-Content -Encoding utf8`.
- ловушка: the Windows console is not UTF-8 by default — without this non-Latin letters and signs like → ≠ break
- источник: maxagent experience, 2026

### A .ps1 script with non-Latin letters fails with ParserError
- когда: ParserError ps1 · non-Latin text in ps1 · ps1 does not run
- вещь: PowerShell 5.1 · .ps1 · encoding
1. Save `.ps1` as UTF-8 **with BOM**.
2. A string piped from PowerShell into a program (`'{"a":1}' | node x.js`) arrives with a BOM — strip it before parsing: `s.replace(/^\uFEFF/, '')`.
- ловушка: without a BOM PowerShell 5.1 reads the file as ANSI — strings with non-Latin letters break
- источник: maxagent experience, 2026
