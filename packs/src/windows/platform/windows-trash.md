---
title: Windows — delete to the Recycle Bin, disk space
aliases: delete, remove, Recycle Bin, trash, disk space, No space left on device, DeleteDirectory, pagefile, hard links, rm, Remove-Item, удалить, корзина
---

### Delete a file or folder safely
- когда: delete a file · delete a folder · move to recycle bin · rm -rf · Remove-Item
- вещь: Windows · Recycle Bin · Microsoft.VisualBasic
1. Only after the owner's yes, and only to the Recycle Bin:
```
Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'OnlyErrorDialogs', 'SendToRecycleBin')
```
2. A file — `DeleteFile` with the same arguments.
3. Before sending a folder — search the project for references to it; move what is still needed.
- ловушка: not `rm` and not `Remove-Item` — they delete forever
- ловушка: space is freed only when the Recycle Bin is emptied; the owner empties it
- источник: field experience, 2026-11-03

### Sent to the Recycle Bin, but Windows asks to delete permanently
- когда: delete permanently prompt · too big for the recycle bin · Recycle Bin MaxCapacity
- вещь: Recycle Bin · capacity · registry
1. Capacity per drive: `HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume\<GUID>` → `MaxCapacity` (MB).
2. Measure the size first (`du -sb`) and send in batches below the capacity; the owner empties the bin between batches.
- ловушка: above capacity Windows silently drops older items from the Recycle Bin
- источник: field experience, 2026-11-03

### Deleted files, but free space did not grow
- когда: free space did not grow after delete · deleted but no space · st_nlink hard link
- вещь: hard links · NTFS · Python
1. Check `os.stat(f).st_nlink` > 1 — the file is a hard link to data that still lives elsewhere.
2. If the goal is space, do not send such files.
- ловушка: a hard link in the Recycle Bin counts with full size but frees nothing
- источник: field experience, 2026-11-03

### Recycle Bin emptied, but drive C is still full
- когда: No space left on device · drive C is full · pagefile.sys grew · not enough disk space
- вещь: page file · memory · drive C
1. Large files written on C in the last hour: `Get-ChildItem C:\ -Recurse -Force -ErrorAction SilentlyContinue | ? LastWriteTime -gt (Get-Date).AddHours(-1)` — often `C:\pagefile.sys` grew because memory ran out.
2. Close memory-hungry programs (video editors, browsers with many tabs) while heavy scripts run.
- ловушка: page file size is a system setting — the owner decides
- источник: field experience, 2026-11-06

### DeleteDirectory: This function is not supported on this system
- когда: This function is not supported on this system · DeleteDirectory fails
- вещь: Microsoft.VisualBasic · Recycle Bin
1. Send the files one by one with `DeleteFile`, then the empty folders.
- источник: field experience, 2026-11-03
