---
title: YouTube description and the publishing package
aliases: description, video description, text under the video, first lines, show more, chapters, timestamps, disclaimers, publishing package, описание ролика
---

### Write a video description
- когда: write a description · video description · text under the video
- вещь: YouTube description · chapters · disclaimers
1. The first 1–2 lines (visible before "more") — the story in miniature: an exact date + a contrast of numbers + an unexpected detail; do not repeat the title.
2. The second paragraph — the promise and keywords: what is inside, with names; in a multi-story video — intriguing questions about 4–6 stories.
3. Chapters as hooks (a number, a quote, a question), the first at `0:00`.
4. Disclaimers about the video's substance right after the chapters; "not financial advice" — one line.
5. About 1000 characters, no credits, tags or calls to action; facts only from the recorded facts of the stories.
- ловушка: do not add source links on your own — only links the owner named
- источник: owner's approval, 2026-11-04

### Hand the owner a publishing package
- когда: video is ready · publishing package · give title and description
- вещь: publishing · answer to the owner
1. Each item as its own copyable block: title, thumbnail path, the whole description, tags, `.srt` path, video path.
- источник: owner's rule, 2026-11-05

### Choose takes in a voiceover and make an edit plan
- когда: remove duplicate takes · repeats in voiceover · choose a take · voice edit plan
- вещь: takes · edit plan · ffmpeg
1. Of repeated takes keep the last one.
2. Plan: phrases by topic (start and end of the last take) + the picture source; cut points at the quietest 30 ms near the word; pauses 0.35 s between phrases, 0.6 s between topics.
3. Join the voice in ffmpeg with a filter script file (`-/filter_complex file`), transcribe again and look for repeated 4-word chains within 25 s.
- ловушка: `-filter_complex_script` was removed in ffmpeg 9 — use `-/filter_complex <file>`
- источник: field experience, 2026-10-21
