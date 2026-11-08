---
title: faster-whisper — transcribe speech with word timestamps
aliases: faster-whisper, whisper, transcription, speech to text, word timestamps, large-v3-turbo, CUDA, cublas64_12.dll, расшифровка, транскрибация
---

### Transcribe a voice recording with word timestamps
- когда: transcribe the voice · speech to text · word timestamps · faster-whisper
- вещь: faster-whisper · base · large-v3-turbo
1. A quiet recording first gets normalised: `ffmpeg -i in.wav -af "highpass=f=80,loudnorm" -ar 16000 -ac 1 norm.wav`.
2. Draft — model `base`; doubtful parts again with `initial_prompt` made of the video's terms and a softer VAD.
3. Accurate — `large-v3-turbo` (~1.6 GB); on a GPU 16 min of speech take about 75 s.
4. `word_timestamps=True` gives the time of every word; print with `PYTHONIOENCODING=utf-8`.
- ловушка: without normalisation `base` produces garbage on a quiet recording
- ловушка: `large-v3-turbo` merges repeated takes — a duplicate vanishes and only a gap in timestamps remains
- источник: field experience, 2026-10-21

### faster-whisper does not see the GPU or crashes
- когда: cublas64_12.dll is not found · faster-whisper metadata_errors · whisper is slow on CPU
- вещь: faster-whisper · CUDA · av
1. CUDA libraries: load them before the model from a folder that has them — `os.add_dll_directory(<folder>)` + `ctypes.WinDLL("cublas64_12.dll")` and `cublasLt64_12.dll` (any installed app with CUDA 12 runtime, or the `nvidia-cublas-cu12` wheel).
2. If decoding through `av` fails — read WAV yourself (`wave` + numpy, 16 kHz mono) and pass the array.
- ловушка: on CPU in 2 threads it is about 15× slower than real time
- источник: field experience, 2026-10-21

### Trim a fragment exactly to one word
- когда: trim exactly to the word · cut to one word · word times in a fragment
- вещь: faster-whisper · ffmpeg · word timestamps
1. Word times of the fragment with faster-whisper (`word_timestamps=True`).
2. Cut with ~0.3 s margin and re-encode: `ffmpeg -ss <start> -to <end> -i in.mp4 -c:v libx264 -crf 16 -c:a aac -b:a 192k out.mp4`.
3. Check: transcribe the result again — only the wanted word is heard; look at a frame.
- ловушка: auto-subtitles give time roughly (±1 s) — take word edges from the transcription
- ловушка: a borrowed piece is often much quieter (−29 LUFS) — level it in the mix to the video's loudness
- источник: field experience, 2026-11-08
