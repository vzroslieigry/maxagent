# Changelog

## maxagent 0.5.0 — unreleased

- **Two shelves of experience.** Own experience (`experience/`) surfaces and may stop commands; shared packs (`experience/shared/<pack>/`) are reference only: shown when the own shelf has nothing, higher threshold, at most one atom per message, compact, never stop a command, usage counter on the machine.
- **Shared packs**: `npx maxagent experience list | add | update | mute | unmute | adopt`. Packs come with ready int8 vectors; checksum, file names and content are checked before install. `adopt` copies a useful shared atom into own experience and hides the shared copy by id; the end-of-turn hook suggests it.
- **Setup wizard**: one question "Install everything / Choose / Nothing" for the extras — browser bridge with the Chrome extension, meaning search (pinned model revision and sha256, `pip --target`, self-test; without Python — `winget` after a yes), shared experience. New commands `bridge`, `vectors`, `experience`.
- **Updates**: a background check once a day (npm registry and `news.json`), a hint at session start once a day, news once per id, `autoUpdate: "patch"` for bug-fix releases only.
- **Search quality**: word search only on title, triggers and things (exact names, errors, commands); the body is matched by vectors. Latin words match whole (Remotion ≠ remote); a word match also needs meaning similarity ≥ 0.83. Recall set: 57/68 → 65/68 requests, 10/11 → 11/11 actions.

## maxagent-bridge 0.2.0 — unreleased

- First public release: MCP server + Chrome extension over Native Messaging, per-agent approval, site blocklist, action log, stop button, `launch_browser`, `doctor`, `reload`.
