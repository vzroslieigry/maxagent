---
title: Python scripts for agents — arguments, encodings, heredoc, line endings
aliases: Python, script, hardcoded paths, argument, script archive, import graph, heredoc, unicodeescape, cp1251, UnicodeEncodeError, UnicodeDecodeError, PYTHONIOENCODING, subprocess, CRLF, питон, скрипт
---

### The object of work (episode, project) is an argument, not a constant
- когда: hardcoded path in script · script made for one project · copies _v2 _v3 of a script
- вещь: Python · arguments · helper module
1. One helper module in the scripts folder: the name comes from `--name X` or an environment variable, no default; functions for its folders.
2. Take the argument out of `sys.argv` so positional arguments do not shift.
3. Put the name into `os.environ` — child scripts get the same.
4. `--help` prints the docstring or the header comment.
5. Data of the object produced by a shared script goes into the object's own file.
- ловушка: a default of "the previous object" is a silent error
- источник: field experience, 2026-11-02 (121 scripts → 35 on an argument, 85 archived)

### Clean up a pile of old scripts
- когда: clean up old scripts · remove unneeded scripts · archive of scripts
- вещь: Python · import graph · git mv
1. Candidates — by a guard regex for object paths.
2. For each: where it is mentioned and the exact import graph (`import X`, `from X`, `X.py`).
3. Needed by a stage → move onto the helper; one-off → `git mv` into `archive_v1/` + a README "group → replaced by".
4. Check: `--help` of changed scripts; run on a previous object and compare byte by byte with `git show HEAD:<path>`.
- ловушка: substring search gives false links (`cells` inside `scene_cells`)
- ловушка: do not touch tools of an object another session works on
- источник: field experience, 2026-11-02

### UnicodeEncodeError or UnicodeDecodeError in Python on Windows
- когда: script fails printing non-ASCII · can't encode character
- когда: UnicodeEncodeError: 'charmap' codec can't encode character
- когда: UnicodeDecodeError: 'utf-8' codec can't decode byte
- вещь: Python · Windows console · subprocess
1. At the start of a CLI script:
```python
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
```
2. Text files — always `encoding='utf-8'`.
3. `subprocess.run` of a UTF-8 script — `encoding='utf-8', errors='replace'`.
4. One-off run — `PYTHONIOENCODING=utf-8 python …`.
- ловушка: arrows, `≠`, emoji and a non-breaking space crash a script in a legacy-code-page console
- ловушка: with `capture_output=True` the child may write in the console code page while the parent reads UTF-8
- источник: field experience, 2026-11-04

### Python code through a heredoc in Bash breaks
- когда: python heredoc · unicodeescape error · unterminated character set · python <<
- когда: SyntaxError: (unicode error) 'unicodeescape'
- вещь: Python · Git Bash · heredoc
1. Write the script to a file with the file tool; use raw strings `r'''…'''`.
2. Run `python <file>`; check replaced fragments with `assert old in text`.
- ловушка: backslashes collapse in `python - <<'EOF'`: Windows paths become escapes, `'\n'` becomes a real newline, `[\\/]` breaks
- источник: field experience, repeated 2026-11-08

### Python on Windows turned LF into CRLF
- когда: LF became CRLF · write_text CRLF · tests failed after file edits
- вещь: Python · line endings
1. Write bytes (`write_bytes`) or `write_text(..., newline="\n")`; or edit with the file tool.
2. After bulk edits compare line endings.
- источник: field experience
