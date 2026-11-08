---
title: YouTube thumbnails — type, hook text, layout, checks, fonts
aliases: thumbnail, cover, preview image, CTR, hook text, open loop, one micro-story, face thumbnail, several topics, false trail, 480×270, 320 px, timer corner, font, glyphs, independent review, превью, обложка
---

### Choose a thumbnail type — "one micro-story"
- когда: make a thumbnail for the video · which thumbnail type · one micro-story thumbnail
- вещь: thumbnail · micro-story · composition
1. One familiar object and an unexpected consequence: at one glance a question about one strong story with personal stakes (privacy, control, money, safety). Other stories go to the title, description and chapters.
2. One whole image: a recognisable object or character + one detail that changes the meaning. Several objects are fine if they share one action and one plot — a situation, not a collage.
3. A 2–4 word phrase: a big question or an unfinished conclusion. The image is the clash, the text is surprise or stakes.
- источник: owner's rule, 2026-11-02 (not A/B measured)

### Lay out a "one micro-story" thumbnail
- когда: thumbnail layout · where to put text on the thumbnail · thumbnail background
- вещь: thumbnail · text · scene · palette
1. Two blocks: ≈40–50 % width — text on a free field, 50–60 % — the object scene (shares follow word length and object shape). Text in 1–2 lines, a bold font, big margins. The question and object read first, then the detail.
2. Simple background, empty space, strong separation of the object. Palette: dark base, white/yellow text, 1–2 light accents. A face is optional — the situation gives the emotion.
- источник: owner's rule, 2026-11-02

### Title for a "one micro-story" thumbnail
- когда: title for the thumbnail · title and thumbnail together · title repeats the thumbnail
- вещь: title · thumbnail · promise
1. The title widens the promise: names the topic or the participant, or links the lead story to the general question of the video.
2. It does not copy the thumbnail question word for word and does not list all topics.
3. Do not replace the real cause of an event with intrigue.
- источник: owner's rule, 2026-11-02

### "One story with a face" thumbnail
- когда: thumbnail with a face · face looks at the text · tilted ribbons with text
- вещь: thumbnail · face · ribbons
1. A large face on one side; on the other up to three tilted ribbons of text, each with its own role and colour (shout, essence, twist), size decreasing top to bottom; the channel mark in a corner.
2. **The face looks at the text**, not into emptiness — otherwise mirror it (and then check mirrored letters and logos).
- источник: owner's rule, 2026-11-04

### Write hook text for a thumbnail
- когда: text on the thumbnail · hook for the thumbnail · open loop on thumbnail
- вещь: thumbnail · hook · open loop
1. **An open loop, not a result:** a question, a threat to the viewer personally, an unfinished line. The answer is only in the video and only from the story's facts.
2. Before finishing — check the hook against the script: a question must not become a false claim about the cause.
- ловушка: not a result ("it's over", "closed") — it answers the question itself, no reason to click
- ловушка: no false urgency — it lets the viewer postpone and feels like a lie later
- источник: owner's rule, 2026-11-04

### False trail in the thumbnail and title
- когда: false trail · intrigue in title · viewer guesses wrong · twist in the video
- вещь: thumbnail · title · description · surprise
1. Thumbnail and title together lead the viewer to their own wrong guess with true words; the video gives the twist — surprise or relief.
2. Do not give the answer in the title, the visible start of the description or the first hashtags.
- ловушка: not a lie — every word on its own must be true, otherwise the viewer feels cheated
- источник: owner's rule, 2026-11-05

### Check a thumbnail
- когда: check the thumbnail · thumbnail on a phone · thumbnail at 480×270 · thumbnail too small
- вещь: thumbnail · 480×270 · 320 px · timer
1. Full size, then **480×270 and 320 px wide**, with a temporary duration badge in the bottom right corner; remove it before the final export.
2. Check the face, outlines of props, reading order, margins, line breaks, every word.
3. The physical chain of an action in the image must make sense — layout does not fix broken image logic.
4. Open the exported JPG itself: a good render in the editor does not replace checking the file.
- источник: field experience, 2026-10-31

### Independent review after each thumbnail build
- когда: rate the thumbnail · thumbnail is built · second opinion on thumbnail
- вещь: subagent · thumbnail · review
1. After every build — a separate subagent that views the images at 1280/480/320 px and lists fixes by importance.
2. Do not give it your own opinion of the thumbnail.
- ловушка: your own eye gets used to it — obvious colour clashes were noticed by the owner, not the agent
- источник: owner's rule, 2026-11-06

### Check that a font has the needed letters
- когда: font for the thumbnail · font with Cyrillic · does the font have the glyphs · GlyphTypeface
- вещь: Windows fonts · GlyphTypeface · glyphs
1. Fonts live in `C:\Windows\Fonts` and in the per-user `%LOCALAPPDATA%\Microsoft\Windows\Fonts`.
2. Check glyphs with WPF `System.Windows.Media.GlyphTypeface` and `CharacterToGlyphMap` (PowerShell, `Add-Type -AssemblyName PresentationCore`); `AdvanceWidths` gives widths. fontTools is not needed.
3. The file name says nothing: some "Bold" display fonts lack non-Latin letters.
4. Fit the text box by real glyphs, including descenders.
- источник: field experience, 2026-11-04
