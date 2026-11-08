---
title: Chrome for agents — which browser, restart, sleeping tabs, mobile check
aliases: Chrome, browser, main browser, profile, profile-directory, browser closed, browser hangs, Playwright, built-in browser, mobile view, headless, cookie banner, браузер, хром
---

### Which browser an agent should use
- когда: open a website · look at the page in the browser · use the browser for the owner · Playwright browser
- вещь: owner's Chrome · profile · browser bridge
1. The owner's own Chrome, the profile they sign in with, through a bridge (e.g. maxagent-bridge): `tabs_list` → `snapshot` → action.
2. Work in the already open signed-in tab of the site; before acting check the URL and the account.
3. A built-in agent browser or Playwright has no sign-ins and different cookies — use it only when the owner asks for it for this task.
- ловушка: Chrome processes with `--user-data-dir`, `--remote-debugging-port` or `--headless` are someone else's automation — do not take them for the owner's browser and do not close them
- источник: field experience, 2026-10-18 – 2026-11-05

### Restart the owner's Chrome gracefully
- когда: restart Chrome · restart the browser · Chrome hangs restart
- вещь: Chrome · taskkill · extension
1. First `tabs_list`: is there unfinished work of the owner in the tabs.
2. To update an extension prefer its own reload (for maxagent-bridge — `npx maxagent-bridge reload`), no restart needed.
3. Otherwise close only the main process of that profile without force: `taskkill /pid <PID>` (no `/f`); the main one has no `--type=` and no foreign `--user-data-dir`. Start again with `--profile-directory=<profile>`.
4. After restart tabs get new ids — list them again.
- ловушка: not `taskkill /im chrome.exe` — it also closes other profiles and other agents' browsers
- ловушка: `chrome.exe` without `--profile-directory` may open the profile picker — no extensions, the bridge stays silent
- источник: field experience, 2026-11-04

### Tab "sleeps": preloader at 0 %, animations stopped, empty text
- когда: preloader hangs · tab is asleep · visibilityState hidden · snapshot is empty
- вещь: Chrome · background tabs · occluded windows
1. Start Chrome with:
```
--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion
```
- ловушка: a window on a hidden virtual desktop has `visibilityState: hidden` and `requestAnimationFrame` stops; some sites stop rendering lists and button text
- источник: field experience, 2026-11-03

### Check your own page "as on a phone"
- когда: check as on a phone · mobile version check · width 390 · iPhone viewport
- вещь: headless Chrome · DevTools Emulation
1. A separate headless Chrome with a temporary profile + `Emulation.setDeviceMetricsOverride` 390×844, `mobile: true`, iPhone user agent.
2. `Runtime.evaluate`: document width and elements with `right > clientWidth`, plus a screenshot.
- ловушка: a real Chrome window cannot get narrower than ≈500 px, and `--headless --window-size=390,…` + `--screenshot` crops — use emulation only
- ловушка: not for sites behind a sign-in — no session; then a separate window of the owner's Chrome (atom below)
- источник: field experience, 2026-11-03

### Check a signed-in site "as on a phone" in the owner's Chrome
- когда: mobile check in owner's Chrome · signed-in site as on a phone · chrome.exe --new-window
- вещь: Chrome · own window · MoveWindow · WM_CLOSE
1. Only in your own window: `chrome.exe --new-window <url>` → find the new window by comparing `EnumWindows` before and after.
2. Narrow it with `MoveWindow`; the bridge sees the tab in a new `windowId`.
3. After the check — `WM_CLOSE` to that window only.
- ловушка: never narrow a shared window — the owner or another agent may be working in it
- источник: field experience, 2026-11-03

### Cookie banner with an "Accept" button on someone's site
- когда: cookie banner · accept cookies · consent popup on site
- вещь: cookie · consent
1. There is "Reject" or "Only necessary" — choose it.
2. Only "Accept" — do not press it (it is consent on the owner's behalf); work or take screenshots as is.
- ловушка: do not repeat a publish, send or any irreversible action just to check it
- источник: owner's rule, 2026-10-18
