---
title: Agent experience — when and how to write it, how to find it
task: Decide whether to write experience, write an atom by the spec, find experience when it did not surface by itself
aliases: experience, atom, write to experience, save the method, knowledge base, agent memory, experience-engine, lint, find, RAG
---

### Should this go into experience
- когда: write to experience · save this to experience · worth writing down · task finished what to record
- вещь: experience · writing threshold · atom
1. Write if you had to search (web, docs, someone else's code, trying commands), something failed and you did it differently, the owner gave a rule or correction, or the way will clearly repeat.
2. Ordinary steps along a known path are not experience, however many there are.
3. There is an atom about this thing — fix it, don't write a second one.
- ловушка: not at the end of the session — by then the commands and the exact error text are forgotten
- источник: maxagent experience, 2026

### Write an atom and check it
- когда: write an atom · new experience file · experience format · experience-engine lint
- вещь: experience · atom · lint · find
1. File `experience/<kind>/<thing>.md`, name in Latin letters; format — `experience/_spec.md`, blank — `experience/_template.md`.
2. One `###` — one task: `- когда:`, `- вещь:`, steps, `- проверка:`, `- ловушка:`, `- источник:` (field names stay in Russian).
3. Check: `node ~/.maxagent/tools/experience-engine.js lint experience/<kind>/<thing>.md` → "ошибок нет".
4. Find it with the words of a future request: `node ~/.maxagent/tools/experience-engine.js find "<words>"` → the new atom on top.
- проверка: lint has no errors, find shows the new atom
- ловушка: no passwords or keys — only where they are; lint flags anything that looks like a secret
- источник: maxagent experience, 2026

### Experience did not surface — find it by hand
- когда: find in experience · what do you know about · any experience about this · experience did not surface
- вещь: experience-engine · find · experience.md
1. `node ~/.maxagent/tools/experience-engine.js find "<words of the task>"` — the best atom in full and similar ones.
2. Also the `experience.md` index: a table of things with synonyms.
3. Found — do it that way; not found — the task is new: keep in mind what from it goes into experience.
- ловушка: don't rediscover what is already written: find first, web search second
- источник: maxagent experience, 2026
