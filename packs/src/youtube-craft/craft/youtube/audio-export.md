---
title: YouTube sound and export — −14 LUFS, background, music, render settings, checks
aliases: loudness, LUFS, true peak, limiter, master bus, background noise, music bed, SFX, mix, export, render, bitrate, 4K, 1440p, banding, safe area, black frame, громкость, экспорт, рендер
---

### Set the video loudness to −14 LUFS
- когда: video loudness · -14 LUFS · true peak · limiter on master bus
- вещь: LUFS · limiter · loudnorm
1. Result: −14 LUFS integrated (−15…−13 is fine), true peak ≤ −1 dBTP.
2. Always a limiter on the master bus with a −1.0 dBTP ceiling.
3. Watch a loudness meter (YouTube standard) while playing a couple of blocks; check the final file with `ffmpeg -af ebur128`.
4. Voice: highpass 80 Hz, gentle noise reduction, compression, then loudnorm I=−14:TP=−1.
- ловушка: "−14 LUFS is too quiet" mixes up track peaks (voice around −6 dBFS) with integrated loudness; YouTube never turns a quiet video up
- источник: measurements, 2026-10-23

### A bark, a shout, a gust of wind in the background
- когда: sharp sound in background · dog barking in background · background noise spikes
- вещь: compressor · limiter · background tracks
1. Background, ambience, stock sound and Foley are not only turned down but limited by peak: compressor at the normal background level, ratio 6–10:1, attack 0.5–1 ms, release 100–200 ms; then a limiter at the normal background peak +3 dB.
2. Still audible — cut that piece and cover it with a neighbouring one with a 0.5–1 s crossfade: nothing distracting in voice pauses.
- проверка: listen to every voice pause and topic gap
- источник: owner's rule, 2026-10-23

### Music, SFX and listening to the mix
- когда: music under voice · music bed level · SFX on graphics · listen to the mix
- вещь: music · SFX · mix
1. Music works best in pauses, inserts and transitions; under speech only if it does not compete. Bed 18–25 dB below the voice (−32…−38 LUFS short-term under voice); in pauses +6–8 dB.
2. Music changes or pauses on a change of topic block.
3. SFX on graphics and zooms 10–15 dB below the voice, no clipping.
4. Listen to the start, joins and end — also through a phone speaker.
- источник: creators' practice, 2026-10-23

### Check the timeline before rendering
- когда: check before render · black flash in the final file · gaps on the timeline · safe area
- вещь: timeline · render in place · safe area
1. Gaps: zoom to the whole timeline and inspect the base track — no 1–2 frame gaps after moving inserts (a black flash).
2. Heavy parts (stacks of blur, transforms, glow, compositing) — render in place to an intermediate codec so fonts and animation do not stutter.
3. Safe area 90 % action / 80 % titles: important things inside 80 %, bottom right corner free (timestamp, end screen).
4. Loudness meter and the master limiter.
- источник: owner's checklist, 2026-10-24

### Export a video for YouTube
- когда: what resolution to render · export for YouTube · bitrate for YouTube · banding in shadows
- вещь: export · 4K · H.264 · VP9
1. Timeline 1920×1080, render 3840×2160 if possible, at least 2560×1440: YouTube gives 1440p/4K uploads VP9/AV1 with a higher bitrate even when watched at 1080p; 1080p uploads often get blurry H.264.
2. MP4, H.264 High (or H.265), SDR Rec.709: 1440p30 — 24–40 Mbit/s, 4K30 — ~60 Mbit/s H.264 / ~40 H.265. Frame rate = source.
3. Audio AAC-LC 48 kHz stereo, 320 kbit/s.
4. Banding in dark gradients — minimal dither noise on export only.
- ловушка: above 100 Mbit/s is useless — YouTube re-encodes to 8 bit anyway
- источник: YouTube help and creators, 2026-10-23

### An empty frame though the timeline has no gaps
- когда: empty frame in video · not enough material on screen · contact sheet of the whole video
- вещь: empty frame · automated check · contact sheet
1. Measure emptiness by events inside an insert and the share of frames with material, not by track gaps: it is born in the script.
2. A check for empty frames is an ERROR, not a WARN: agents skip warnings.
3. Check with a contact sheet of the whole length (a frame every 10 s), not frames the agent picked.
- источник: field experience, 2026-11-01

### After the video is published
- когда: video is out · after 48 hours · retention analysis · stats for nerds
- вещь: YouTube Studio · retention · codec
1. After 48 h and 7 days: Studio → Key moments for audience retention — retention at 30 s (target ≥ 70 %), dips and spikes; write the causes into experience.
2. Do not trim a growing video in Studio and do not change title/thumbnail outside Test & Compare.
3. Keep sources, script and a project screenshot: "reused content" appeals are won by showing the process.
4. Stats for nerds: codec vp09/av01, content loudness near 0 dB (−1…0 means −14 was hit).
- источник: YouTube help and creators, 2026-10-23
