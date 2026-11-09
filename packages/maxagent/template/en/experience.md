# Experience index

Experience usually surfaces by itself: the maxagent hook shows a matching atom on a message, before a command and after an error. It did not — find it:

```
node ~/.maxagent/tools/experience-engine.js find "<words of the task>"
```

or scan the table below and read the matching files. An entry does not prove that a connection or program works right now: verify anything that can change.

**How it is organised.** One thing — one file `experience/<kind>/<thing>.md`, by thing, not by occasion. Kinds: `platform/` — system and environment; `tools/` — programs and services; `code/` — languages and libraries; `agents/` — the agents themselves and their hooks; `craft/<field>/` — a craft shared by all projects of the field; `owner/` — how the owner likes to work. Project-specific knowledge goes to `projects/<project>/`, not here. Inside a file — `###` atoms: one task, pitfall or rule, up to 900 characters.

**A new entry** — by the spec `experience/_spec.md` and the blank `experience/_template.md`, then the check:

```
node ~/.maxagent/tools/experience-engine.js lint experience/<kind>/<thing>.md
```

Don't edit the table below by hand — it is built from the headers (`title`, `task`, `aliases`):

```
node "{{TOOLS}}/experience-index.js"
```

<!-- index:auto:start -->
<!-- index:auto:end -->
