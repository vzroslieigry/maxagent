---
title: MCP — your own server and where agents connect it
aliases: MCP, MCP server, Model Context Protocol, JSON-RPC, stdio, tools/list, tools/call, isError, mcpServers, mcp_servers, mcp_config.json, .claude.json, config.toml, tool_timeout_sec, claude mcp add, codex mcp add
---

### Write your own MCP server without an SDK
- когда: own MCP server · write an MCP server · MCP without SDK
- вещь: MCP · stdio · JSON-RPC 2.0
1. stdio, JSON-RPC 2.0, one JSON object per line.
2. Answer `initialize` (`protocolVersion`, `capabilities:{tools:{}}`, `serverInfo`), `tools/list`, `tools/call`, `ping`; skip notifications (no `id`).
3. A tool error is `result: {content:[{type:"text",text}], isError:true}`, not a JSON-RPC error; an image — `{type:"image", data:<base64>, mimeType}`.
4. Example: `packages/maxagent-bridge/lib/mcp.js` in the maxagent repository.
- источник: field experience, 2026-11-05

### Connect an MCP server to an agent
- когда: connect MCP to an agent · add MCP to agent · claude mcp add · codex mcp add · mcp_config.json
- вещь: Claude Code · Codex · Antigravity · settings
1. Claude Code: `claude mcp add --scope user <name> -- <command> <args>` (or `~/.claude.json` → `mcpServers`).
2. Codex: `codex mcp add <name> -- <command>` or `~/.codex/config.toml` `[mcp_servers.<name>]`: `command`, `args`, `env`, `startup_timeout_sec`, `tool_timeout_sec`.
3. Antigravity: `~/.gemini/config/mcp_config.json` → `mcpServers`; per project — `.agents/mcp_config.json`.
4. Before the first edit of a settings file — a backup next to it.
- ловушка: Claude Code rewrites `~/.claude.json` while running — a manual edit may be lost; use `claude mcp add`
- ловушка: Codex `tool_timeout_sec` defaults to 60 s — too little if a tool waits for a human
- источник: documentation, 2026-11-05
