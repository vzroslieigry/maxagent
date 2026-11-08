---
title: Accepting an agent's work and checks an agent cannot game
aliases: review, acceptance, check the report, 0 ERROR, WARN, ERROR, agent report, all ok, rebuild from source, gaming the check, generator, guard, mass work by an agent, приёмка, проверка
---

### Accept another agent's work or your own stage before "done"
- когда: accept the agent's work · agent reports 0 ERROR · check the agent's report · all ok per the agent
- вещь: acceptance · guards · WARN
1. Repeat the checks yourself: same version, input and parameters; compare numbers with the report. Do not repeat a publish, payment or deletion to check it.
2. Rebuild derived files from the source and compare (`cmp` or field by field).
3. Run all guards, including the earliest stage ones.
4. Every WARN is fixed or its reason written down.
5. Look for repetition across the whole result (a block signature) and fields that exist only for the check.
6. Look at the result itself with your own eyes.
- ловушка: a "0 ERROR" report turned into 52 ERROR on rebuild — the work went in circles
- источник: field experience, 2026-11-04

### Write a check that an agent will not game
- когда: write a check for an agent · agent games the check · guard for a pipeline
- вещь: checks · ERROR · counterexamples
1. A mandatory rule is an ERROR, not a WARN: an agent takes the shortest path to "0 ERROR".
2. Check the shape of the result, not just fields: "one element in N objects in a row", "a repeated sequence".
3. A guard against hardcoding uses several signs: file name, literals with the object number, a header mark — a full-path search misses `ROOT / "items" / "item4"`.
4. Give a short correct path (a shared tool: decisions by a human → mechanics by a machine), otherwise the agent writes a generator.
- проверка: the old "workaround" result fails with ERROR on every sign, the reference — 0 ERROR
- источник: field experience, 2026-11-02

### Mass work by an agent runs for hours and spoils the result
- когда: agent works for hours · bulk processing of files · migration is slow · agent lost spaces in text
- вещь: mass work · specification · linter
1. Before starting: a short specification of the result and a "before → after" reference approved by the owner.
2. A linter of the result in a pre-commit hook.
3. What to do with a file is decided by config by path, not by the agent; batches instead of a "file — report — commit" loop; a file limit per session.
4. Do not mix translation with fact-checking.
- проверка: at the start — pace per hour and report size against edit size
- ловушка: one agent that invents, executes and accepts the process only makes it more complex
- источник: field experience, 2026-11-07 (64 files in 20 hours)

### Do not say "done" before checking the result yourself
- когда: report done · say it is ready · finish the task · task complete
- вещь: verification · final answer · owner
1. Check the result itself: open the file, run the command, look at the frame, listen to the sound.
2. Separate programmatic checks ("tests pass") from what you saw with your own eyes.
3. Not checked — say so plainly: "not verified" and what is left.
- ловушка: "should work" after an edit is not a check — the owner finds the bug instead of you
- источник: owner's rule, 2026-11-05
