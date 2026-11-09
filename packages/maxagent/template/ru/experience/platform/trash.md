---
title: Удаление — только в Корзину
task: Удалить файл или папку так, чтобы их можно было вернуть; что делать, если Корзина отказывает
aliases: удалить, удаление, Корзина, recycle bin, trash, rm, rm -rf, Remove-Item, del, DeleteDirectory, место на диске
---

### Удалить файл или папку
- когда: удали файл · удали папку · убери в корзину · rm -rf · Remove-Item · del
- вещь: Windows · Корзина · Microsoft.VisualBasic · PowerShell
1. Только после «да» хозяина и только в Корзину. Windows, PowerShell:
```
Add-Type -AssemblyName Microsoft.VisualBasic
[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'OnlyErrorDialogs', 'SendToRecycleBin')
```
2. Файл — `DeleteFile` с теми же параметрами.
3. Ошибка «This function is not supported on this system» — отправить файлы по одному (`DeleteFile`), потом пустые папки.
4. Перед удалением папки — поиск по проекту: кто на неё ссылается.
- проверка: файл исчез с места и лежит в Корзине
- ловушка: не `rm` и не `Remove-Item` — это навсегда
- ловушка: место на диске освобождается только после очистки Корзины — её очищает хозяин
- источник: опыт maxagent, 2026

### Windows спрашивает «удалить безвозвратно»
- когда: удалить безвозвратно · слишком большой для корзины · MaxCapacity
- вещь: Корзина · ёмкость · Windows
1. Объём больше ёмкости Корзины — Windows предлагает стереть навсегда или молча вытесняет старое.
2. Посчитать объём и отправлять частями меньше ёмкости; между частями хозяин очищает Корзину.
3. Ёмкость: свойства Корзины или `HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket\Volume\<GUID>` → `MaxCapacity` (МБ).
- ловушка: не соглашаться на безвозвратное удаление без слова хозяина
- источник: опыт maxagent, 2026
