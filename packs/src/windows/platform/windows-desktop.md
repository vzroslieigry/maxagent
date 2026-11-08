---
title: Windows — program windows, virtual desktops, scripts without a window
aliases: virtual desktop, second desktop, pyvda, window, no window, CREATE_NO_WINDOW, pythonw, headless, background task, рабочий стол, окно
---

### Open a program without getting in the owner's way
- когда: open a program window · launch an app for the agent · Start-Process window
- вещь: Windows · virtual desktop · pyvda
1. Agree with the owner on a separate virtual desktop for agent windows (not a second monitor).
2. Move a window there from Python: `from pyvda import AppView, VirtualDesktop; AppView(hwnd).move(VirtualDesktop(2))`.
3. If you switched the visible desktop yourself — switch the owner back when done.
- ловушка: some programs re-show their main window after opening a project — check where it is and move it again
- источник: field experience, 2026-10-25

### Run a script without a console window
- когда: script without a window · background task Windows · console window pops up · subprocess no window
- вещь: CREATE_NO_WINDOW · pythonw · headless
1. From Python: `subprocess.run(..., creationflags=0x08000000)` (CREATE_NO_WINDOW).
2. Background Python tasks — `pythonw.exe`; a browser for your own checks — headless with a temporary profile.
3. Test GUI forms (WinForms) without showing them: render to PNG with `DrawToBitmap`, press buttons programmatically, then Close.
- ловушка: a hidden window via `Start-Process -WindowStyle Hidden` may be blocked by the agent's permission filter
- источник: field experience, 2026-10-25

### Machine is unreachable after a power cut
- когда: PC unreachable after power cut · PC stuck on login screen · remote agent does not start after reboot
- вещь: auto logon · Windows Update · BIOS · VPN service
1. Check (read only): sleep and hibernate on AC = never; VPN client runs as a service with autostart; the agent is in `HKCU\...\Run`.
2. Usual blockers: no auto logon (the PC waits at the login screen), Windows Update reboots outside active hours, Fast Startup on (`HiberbootEnabled=1`).
3. Fixes are the owner's decision: BIOS "Restore on AC Power Loss = Power On", `NoAutoRebootWithLoggedOnUsers=1`, auto logon via Sysinternals Autologon — the owner enters the password, never the agent.
- ловушка: do not read the whole Winlogon key — it holds credentials; read only `AutoAdminLogon`
- источник: field experience, 2026-10-21
