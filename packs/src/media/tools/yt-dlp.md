---
title: yt-dlp — find a moment in a YouTube video and cut a fragment
aliases: yt-dlp, yt_dlp, youtube-dl, download from YouTube, cut a fragment, video segment, timestamp, download-sections, find a moment in a video, phrase in a video, subtitles, скачать с ютуба, кусок видео
---

### Find a phrase in a known YouTube video
- когда: find the moment in a video · at what minute is the phrase · timestamp of a phrase in a video
- вещь: yt-dlp · YouTube subtitles · json3
1. Search and take subtitles without the video: `python -m yt_dlp "ytsearch8:<title>" --skip-download --write-auto-subs --write-subs --sub-langs "en.*,orig" --sub-format json3 -o "%(id)s.%(ext)s"`.
2. Look for the word in the json3 events (`tStartMs` + segment offsets); skip compilations longer than ~30 min.
3. No subtitles — download the audio and get word times with faster-whisper.
- ловушка: each re-upload has its own timing — take the time from the subtitles of the chosen video
- источник: field experience, 2026-11-08

### Identify a video from a vague description
- когда: meme where someone says · do not remember the cartoon title · what is the video where · timestamp from AI answer
- вещь: AI search · video title · subtitles
1. Ask an AI with web search which video and scene it is; take the title and `watch?v=` links.
2. Then find the exact time by subtitles (atom above).
- ловушка: do not trust a timestamp from an AI answer: it said 0:41, the subtitles said 1:22
- источник: field experience, 2026-11-08

### yt-dlp: This video is not available or No supported JavaScript runtime
- когда: This video is not available · No supported JavaScript runtime could be found · n challenge solving failed
- когда: yt-dlp does not download from YouTube
- вещь: yt-dlp · yt-dlp-ejs · node
1. The YouTube JS challenge solver: `python -m pip install --upgrade "yt-dlp[default]"` (installs `yt-dlp-ejs`).
2. Point to node with a full path: `--js-runtimes "node:C:\Program Files\nodejs\node.exe"` (or `node:/usr/bin/node`).
- проверка: `ytsearch8:…` returns videos without "not available" for videos that exist
- ловушка: plain `--js-runtimes node` may not find node; without ejs half of the videos are "not available"
- источник: field experience, 2026-11-08 (yt-dlp 2026.10.26)

### Cut a fragment of a YouTube video by timestamp
- когда: cut a piece of a video · download a video segment · from 1:23 to 1:45 · yt_dlp --download-sections
- вещь: yt-dlp · ffmpeg · --download-sections
1. With ±3 s margin:
```
python -m yt_dlp --download-sections "*79-88" --force-keyframes-at-cuts -f "bv*[height<=1080]+ba/b" --merge-output-format mp4 -o "<name>_margin.%(ext)s" "https://www.youtube.com/watch?v=<ID>"
```
2. Several pieces — several `--download-sections`.
- проверка: `ffprobe` — duration matches the range, video and audio present
- ловушка: without ffmpeg the whole video downloads; without `--force-keyframes-at-cuts` the edges drift
- источник: field experience, 2026-11-08

### Install yt-dlp
- когда: install yt-dlp · yt-dlp not found · No module named yt_dlp
- вещь: yt-dlp · pip · yt-dlp.exe
1. With Python: `pip install --upgrade "yt-dlp[default]"`; run as `python -m yt_dlp`.
2. Without Python: `yt-dlp.exe` from the yt-dlp GitHub releases into a folder on PATH.
3. ffmpeg must be next to it or on PATH.
- ловушка: the pip module installs no `yt-dlp` command on PATH — call `python -m yt_dlp`
- источник: field experience, 2026-11-08
