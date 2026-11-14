# Workspace rules

This file is yours: the package never overwrites it — except the "Core rules" block between the markers, which is built from your settings. Only what is critical for any agent lives here; everything else surfaces as experience atoms matched to the task. The hook shows the core rules and "My rules" at session start and after the context is compacted.

## Core rules — always in view

<!-- maxagent:rules:start -->
<!-- maxagent:rules:end -->

## Package reference

Nothing else needs reading at the start: experience surfaces as atoms matched to the task, and a project is read when the task belongs to it. How maxagent works (experience, projects, sync) is in the reference `{{CORE}}/AGENTS.core.md`: open it only when you need an answer about how things work.

## Settings (change with `npx maxagent setup`)

<!-- maxagent:settings:start -->
{{SETTINGS}}
<!-- maxagent:settings:end -->

## My rules

<!-- Your personal rules for agents go here, including your own "always" items: the hook shows this section together with the core rules. If they conflict with the package reference, yours win.
Example:
- Keep answers short.
- Before any purchase, always show the total and wait for confirmation.
-->
