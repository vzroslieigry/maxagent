# Workspace rules

This file is yours: the package never overwrites it — except the "Core rules" block between the markers, which is built from your settings. The agent reads this file at the start of every task together with the package rules; the hook shows it the core rules and the "My rules" section at session start and after the context is compacted.

## Core rules — always in view

<!-- maxagent:rules:start -->
<!-- maxagent:rules:end -->

## Package rules

Before any task, read `{{CORE}}/AGENTS.core.md` and follow the "Start of every task" section.

## Settings (change with `npx maxagent setup`)

<!-- maxagent:settings:start -->
{{SETTINGS}}
<!-- maxagent:settings:end -->

## My rules

<!-- Your personal rules for agents go here, including your own "always" items: the hook shows this section together with the core rules. If they conflict with the package rules, yours win.
Example:
- Keep answers short.
- Before any purchase, always show the total and wait for confirmation.
-->
