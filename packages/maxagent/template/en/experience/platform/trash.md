---
title: Deleting — only to the Recycle Bin
task: Delete a file or folder so it can be restored; what to do if the Recycle Bin refuses
aliases: delete, remove, Recycle Bin, trash, rm, rm -rf, Remove-Item, del, DeleteDirectory, disk space
---

### Delete a file or folder
- когда: delete the file · delete the folder · move to trash · rm -rf · Remove-Item · del
- вещь: Windows · Recycle Bin · Microsoft.VisualBasic · PowerShell
1. Only after the owner's "yes" and only to the Recycle Bin. Windows, PowerShell:
```
Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'OnlyErrorDialogs', 'SendToRecycleBin')
```
2. A file — `DeleteFile` with the same parameters.
3. Error "This function is not supported on this system" — send the files one by one (`DeleteFile`), then the empty folders.
4. Before deleting a folder — check what refers to it.
- проверка: the file is gone and lies in the Recycle Bin
- ловушка: not `rm` and not `Remove-Item` — that is forever
- ловушка: disk space frees up only after the Recycle Bin is emptied — the owner empties it
- источник: maxagent experience, 2026

### Windows asks "delete permanently"
- когда: delete permanently · too big for the Recycle Bin · MaxCapacity
- вещь: Recycle Bin · capacity · Windows
1. More than the Recycle Bin capacity — Windows offers to erase for good or silently pushes out older items.
2. Count the size and send in parts smaller than the capacity; the owner empties the Recycle Bin between parts.
3. Capacity: Recycle Bin properties or `HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume\<GUID>` → `MaxCapacity` (MB).
- ловушка: don't agree to permanent deletion without the owner's word
- источник: maxagent experience, 2026
