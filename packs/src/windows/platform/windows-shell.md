---
title: Windows command line for agents — PowerShell 5.1, Git Bash, encodings
aliases: terminal, console, shell, PowerShell, powershell.exe, pwsh, Git Bash, bash, MSYS, cmd, encoding, mojibake, BOM, cp1251, cp1252, терминал, командная строка, кодировка
---

### Run a command on a Windows machine
- когда: run a command on Windows · run in terminal · Bash tool Windows · PowerShell tool Windows
- когда: ls · cat · grep · sed · awk · which · chmod
- вещь: Windows 10/11 · PowerShell 5.1 · Git Bash
1. Linux commands work only in Git Bash (MSYS); in PowerShell use cmdlets.
2. A "PowerShell" tool is usually Windows PowerShell 5.1 (`powershell.exe`), not PowerShell 7 — write 5.1 syntax.
3. Git Bash paths look like `/c/Users/...`; Windows programs need `C:/...` or `C:\...`.
4. No admin rights is the common case: services, HKLM and policies will fail — tell the owner what is needed and why.
5. Probe once and write it down: OS, shells, Python, Node, ffmpeg, git, winget versions — do not rediscover each session.
- ловушка: do not try shells and syntaxes at random — check which shell the tool really is
- источник: field experience, 2026-11-05

### Chain commands in PowerShell 5.1
- когда: PowerShell && · PowerShell || · chain commands PowerShell
- когда: The token '&&' is not a valid statement separator
- вещь: PowerShell 5.1 · syntax
1. Instead of `A && B` — `A; if ($?) { B }`; unconditional — `A; B`.
2. No `?:`, `??`, `?.` — use `if / else` and `$null -eq $x`.
- ловушка: PowerShell 7 syntax does not parse in 5.1 — it is a different language version
- источник: field experience, 2026-11-05

### Pass a path from Git Bash to a Windows program
- когда: path /c/Users · file not found from Git Bash · No such file /c/
- вещь: Git Bash · paths · python · node
1. Git Bash itself understands `/c/Users/...`.
2. Windows programs (python, node, any `.exe`) need `C:/Users/...` or `C:\Users\...` in their arguments.
- ловушка: a `/c/...` argument is understood only by Git Bash — the program silently writes nowhere or fails
- источник: field experience, 2026-10-28

### Non-English text in console output turned into garbage
- когда: mojibake in output · broken characters in console · UnicodeEncodeError console · cp1251 console
- вещь: console encoding · Python · PowerShell
1. Python: `PYTHONIOENCODING=utf-8` before the command or `sys.stdout.reconfigure(encoding='utf-8')`.
2. PowerShell whose output another program reads: `[Console]::OutputEncoding=[Text.Encoding]::UTF8; <command>`.
- ловушка: the Windows console defaults to a legacy code page — arrows, `≠`, emoji and non-Latin letters break
- источник: field experience, 2026-11-05

### A .ps1 script with non-ASCII letters fails with ParserError
- когда: ParserError ps1 · non-ASCII in ps1 · ps1 script does not run
- вещь: PowerShell 5.1 · .ps1 · encoding
1. Save `.ps1` files as UTF-8 **with BOM**.
- ловушка: without BOM PowerShell 5.1 reads the file as ANSI — strings with non-ASCII letters break (comments survive)
- источник: field experience, 2026-11-05

### JSON piped from PowerShell into a program does not parse
- когда: JSON.parse Unexpected token · PowerShell pipe into node · pipe stdin BOM
- вещь: PowerShell 5.1 · pipeline · stdin · node
1. A string piped in 5.1 (`'{"a":1}' | node x.js`) arrives with a BOM — strip it before parsing: `s.replace(/^\uFEFF/, '')`.
2. Test hooks and CLIs by hand from Bash: `echo '{…}' | node …`.
- ловушка: a program that "answers neutrally on error" then prints nothing and the bug stays hidden
- источник: field experience, 2026-11-05

### Empty argument from PowerShell to a program disappears
- когда: empty argument "" · argument disappeared · flag without value
- вещь: PowerShell 5.1 · command line arguments
1. For "nothing" use a separate flag (`--no-agents`), not `--agents ""`.
- ловушка: PowerShell 5.1 drops `""`: `node cli.js --agents ""` → the program gets `--agents` with no value and may take the next argument
- источник: field experience, 2026-11-05

### Search for non-ASCII letters in files from Git Bash
- когда: grep -P · find non-ASCII letters in files · find Cyrillic in files
- когда: grep: -P supports only unibyte and UTF-8 locales
- вещь: Git Bash · grep · Python
1. Python instead of `grep -P`:
```
PYTHONIOENCODING=utf-8 python -I -c "import pathlib,re; print([str(p) for p in pathlib.Path('DIR').rglob('*') if p.is_file() and re.search('[^\x00-\x7f]', p.read_text(encoding='utf-8', errors='ignore'))] or 'none')"
```
- ловушка: `grep -P` fails in Git Bash, and `| wc -l` after it gives a false "0"
- источник: field experience, 2026-11-05

### Measure command time in Git Bash
- когда: bc command not found · measure command time Git Bash
- вещь: Git Bash · date
1. `s=$(date +%s); <command>; e=$(date +%s); echo $((e-s))`.
- ловушка: there is no `bc` in Git Bash
- источник: field experience, 2026-11-05

### Read the clipboard from PowerShell
- когда: read the clipboard · image from clipboard · Clipboard GetImage · save screenshot from clipboard
- вещь: PowerShell 5.1 · STA · System.Windows.Forms
1. The clipboard (image, files, text) is readable only in STA mode:
```
powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetImage()"
```
- ловушка: without `-STA` the clipboard reads as empty
- источник: field experience, 2026-11-05

### bash is not found in an agent whose shell is PowerShell
- когда: bash is not recognized · run_command bash · bash not found in agent
- вещь: Antigravity · run_command · PowerShell · Git Bash
1. Some agents (Antigravity `run_command`) run PowerShell, and `bash` is not on PATH.
2. Use PowerShell cmdlets (`Get-ChildItem`) or Git Bash by full path: `& "C:\Program Files\Git\bin\bash.exe" -c "…"`.
- источник: field experience, 2026-11-08
