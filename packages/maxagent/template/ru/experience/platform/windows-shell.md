---
title: Командная строка Windows — PowerShell 5.1, Git Bash, кодировка, пути
task: Выполнить команду в Windows без ошибок синтаксиса, путей и кодировки
aliases: терминал, консоль, shell, оболочка, команда, PowerShell, powershell.exe, pwsh, Git Bash, bash, MSYS, cmd, кодировка, кракозябры, BOM, UTF-8
---

### Связать команды в PowerShell 5.1
- когда: PowerShell && · PowerShell || · цепочка команд PowerShell
- когда: The token '&&' is not a valid statement separator
- вещь: Windows · PowerShell 5.1 · синтаксис
1. Встроенный в Windows PowerShell — версии 5.1 (`powershell.exe`), не 7: синтаксис 5.1.
2. Вместо `A && B` — `A; if ($?) { B }`; без условия — `A; B`.
3. Нет `?:`, `??`, `?.` — писать `if / else` и проверку `$null -eq`.
- проверка: команда отработала без ошибки разбора
- ловушка: не переносить синтаксис PowerShell 7 на 5.1 — другая версия языка
- источник: опыт maxagent, 2026

### Передать путь программе Windows из Git Bash
- когда: путь /c/Users · файл не найден из Git Bash · No such file /c/
- вещь: Git Bash · пути · python · node
1. Самому Git Bash — `/c/Users/...`.
2. Программам Windows (python, node и другим) — `C:/...` или `C:\...`.
- ловушка: не `/c/...` в аргументах программ — их понимает только Git Bash, файл молча не создаётся
- источник: опыт maxagent, 2026

### Русский текст в выводе стал кракозябрами
- когда: кракозябры · ��� · русский текст сломался · UnicodeEncodeError · cp1251 · cp866
- вещь: кодировка консоли · Python · PowerShell
1. Python: `PYTHONIOENCODING=utf-8` перед командой или `sys.stdout.reconfigure(encoding='utf-8')`.
2. PowerShell, вывод читает другая программа: `[Console]::OutputEncoding=[Text.Encoding]::UTF8; <команда>`.
3. Файлы для других программ писать явно в UTF-8: `Set-Content -Encoding utf8`.
- ловушка: консоль Windows по умолчанию не в UTF-8 — без этого ломаются русские буквы и знаки вроде → ≠
- источник: опыт maxagent, 2026

### Скрипт .ps1 с русскими буквами падает с ParserError
- когда: ParserError ps1 · кириллица в ps1 · ps1 не запускается
- вещь: PowerShell 5.1 · .ps1 · кодировка
1. Сохранять `.ps1` в UTF-8 **с BOM**.
2. Строка по конвейеру PowerShell в программу (`'{"a":1}' | node x.js`) приходит с BOM — снимать перед разбором: `s.replace(/^\uFEFF/, '')`.
- ловушка: без BOM PowerShell 5.1 читает файл как ANSI — ломаются строки с кириллицей
- источник: опыт maxagent, 2026
