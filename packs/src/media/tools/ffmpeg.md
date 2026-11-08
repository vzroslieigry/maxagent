---
title: ffmpeg — metadata, chapters, subtitles, voice cleanup, loudness, background limiter
aliases: ffmpeg, ffprobe, FFMETADATA, metadata, description inside MP4, comment, chapters, subtitles, mov_text, srt, shortest, loudnorm, LUFS, ebur128, alimiter, acompressor, zoompan, звук, громкость
---

### Embed a description and chapters into an MP4
- когда: embed description into mp4 · chapters in video · mp4 metadata · FFMETADATA
- вещь: ffmpeg · FFMETADATA · ffprobe
1. A `;FFMETADATA1` file with tags and chapters; attach it: `-i meta.txt -map_metadata N -map_chapters N`, video `-c:v copy`.
2. Multi-line values (`comment`, `synopsis`): a line break inside is `\` + newline; escape `= ; # \` with `\`.
3. On Windows write the file with LF only: `write_text(..., newline="\n")`.
- проверка: `ffprobe -v error -show_entries format_tags -of json <file>` — the `comment` length equals the text length
- ловушка: `open(..., "w")` on Windows writes `\r\n` — `\` escapes `\r`, only the first line survives, no error
- источник: field experience, 2026-11-03

### Add a subtitle track to an MP4
- когда: subtitles into video · add srt to mp4 · subtitle track · mov_text · ffmpeg -shortest
- вещь: ffmpeg · srt · mov_text
1. `-sub_charenc UTF-8 -i <file>.srt -map N:s:0 -c:s mov_text -metadata:s:s:0 language=eng` — works with `-c:v copy`, an srt with BOM is read fine.
2. Set the output length explicitly: `-t <audio length>`.
- ловушка: not `-shortest` — it cuts the video at the last subtitle (test: 2 s → 0.6 s)
- источник: field experience, 2026-11-04

### Clean up a voice recording before editing
- когда: clean up the voice · voice loudness · loudnorm voice · voice to -14 LUFS
- вещь: ffmpeg · loudnorm · LUFS
1. On a copy, keep the original: `-af "highpass=f=80,afftdn=nf=-30:tn=1,acompressor=threshold=-24dB:ratio=3,loudnorm=I=-14:TP=-1"`.
2. Noise reduction gently — 20–30 % strength, not to an "underwater" sound.
- проверка: `ffmpeg -i out.wav -af ebur128 -f null -` — about −14 LUFS integrated, true peak ≤ −1 dBTP
- источник: field experience, 2026-10-21

### Prepare a background track with a limiter
- когда: prepare background sound ffmpeg · ffmpeg alimiter · ffmpeg acompressor background
- когда: Result too large · alimiter limit
- вещь: ffmpeg · alimiter · loudnorm
1. Pick thresholds from `astats` of this background. Example chain:
```
loudnorm=I=-24:TP=-9,acompressor=threshold=-30dB:ratio=8:attack=0.5:release=150,alimiter=limit=0.09:attack=1:release=150:level=disabled,volume=-21dB
```
2. The limiter works on the raised signal; the final level is the last `volume`.
- ловушка: `alimiter limit` not below 0.0625 (−24 dBFS) and `loudnorm TP` not below −9, otherwise "Result too large"
- источник: field experience, 2026-10-28

### Zoom or pan in a video jitters
- когда: zoom jitters · jerky motion · ffmpeg zoompan · ffmpeg crop motion
- вещь: ffmpeg · zoompan · editor keyframes
1. Smooth motion is sub-pixel: do it in the editor (keyframes only at start and end, ease in/out) or in CSS/compositing.
2. In ffmpeg only by upscaling 4×, moving, then scaling back down.
- ловушка: `zoompan`/`crop` move by whole pixels — the picture jitters; a keyframe every second gives steps
- источник: field experience, 2026-10-23

### Cut a fragment precisely
- когда: cut a fragment of video · trim video by time · ffmpeg -ss -to
- вещь: ffmpeg · re-encode · keyframes
1. Exact cut with re-encode: `ffmpeg -ss 2.6 -to 3.9 -i in.mp4 -c:v libx264 -crf 16 -preset slow -c:a aac -b:a 192k out.mp4`.
2. Check a frame: `ffmpeg -ss <sec> -i out.mp4 -frames:v 1 frame.png` and look at it.
- ловушка: `-c copy` cuts only on keyframes — the start shifts by up to a GOP
- источник: field experience, 2026-11-08
