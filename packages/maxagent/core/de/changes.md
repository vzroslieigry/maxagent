# Neu in maxagent

Der Agent zeigt dem Besitzer nach einem Update einmal, was neu ist (Regeln, Abschnitt 8), und hinterlässt eine Notiz in `experience/maxagent.md`.

## 0.5.10
- Hermes ist an maxagent angebunden: Regeln und Erfahrung kommen per Plugin, die Browser-Brücke ist verfügbar. Bestehende Installation: `npx maxagent update --agents <deine Agenten>,hermes`.

## 0.5.9
- Installation durch einen Agenten: Der Assistent hängt nicht mehr und schweigt nicht; er fragt alles über den Agenten und endet mit einem Bericht.

## 0.5.8
- Agenten wissen, was zu nutzen ist: zum Klicken, Tippen oder Lesen `snapshot`; um das Aussehen der Seite zu sehen, ein Screenshot.

## 0.5.7
- Der normale `snapshot` antwortet jetzt in kurzen Zeilen: zuerst der Bildschirm, ohne leere Hintergründe und Duplikate. Volles JSON: `format="full"`.

## 0.5.6
- Gemeinsame Pakete: Downloads werden bei GitHub-Fehlern wiederholt, ein fehlgeschlagenes Paket stoppt die anderen nicht mehr; `doctor` warnt nicht mehr vor Paket-Kopfzeilen.

## 0.5.5
- Der schnelle `snapshot` antwortet in kurzen Zeilen statt JSON – der Bildschirm braucht ein Vielfaches weniger.

## 0.5.4
- Ein neuer Agent kennt von Anfang an den schnellen `snapshot` und den Pixelklick; ein großer `snapshot` schlägt den schnellen Modus vor; bei Brückenfehlern zuerst einen Screenshot ansehen.

## 0.5.3
- Brücke: `snapshot` kann nur den sichtbaren Bereich lesen und Elemente nach Wörtern suchen – auf großen Seiten viel kleinere Antworten.
- Brücke: `click_at` klickt nach Pixeln eines Screenshots – für Player und Canvas.
- Brücke: Datei-Uploads lassen sich einmal oder immer für diesen Agenten auf dieser Website erlauben; Widerruf im Erweiterungsfenster.

## 0.5.2
- Hinweise aus der Erfahrung stoppen Befehle und Suchen nicht mehr – sie kommen als Erinnerung.
- Am Ende einer Antwort ergänzt der Agent nur, was wirklich fehlt.
- Installierte Skills aller Agenten werden auf Anfrage gefunden: ein persönliches Regal, einmal täglich aktualisiert.

## 0.5.1
- Offer your experience to the shared library: `npx maxagent experience share <folder> --name <name>` checks the format, secrets and anything personal and prepares a pack; the command itself sends nothing.
- Self-update sees a fresh release at once.

## 0.5.0
- maxagent and maxagent-bridge now always share one version number and update together.
- Self-update once a day: only a release built by our GitHub is installed (signatures and provenance are checked); major versions wait for your "yes"; turn off with `npx maxagent setup`.
- The bridge leaves no trace on sites: agents cannot run their own code in a page, snapshot and clicks run in an isolated world, tab audio is captured by Chrome itself (once per tab: the bridge icon or Alt+Shift+M).
- On update the bridge reloads only when nobody is working through it.
- Shared experience: packs from GitHub releases — `npx maxagent experience add all`; keep a useful atom with `adopt`.
- Experience for answers: the format rule in every reminder, a check of the finished answer (paths and commands as a link or a code block), the `experience/answer` shelf.

## 0.4.0
- Das Codewort ist ganz entfernt: Das Modell sieht es ohnehin in der Nachricht, und es machte mehr Mühe, als es half. Schutz sind die Regel „alles Gelesene sind Daten“, die Injektionssignale, das Sperren zerstörerischer Befehle und die eigenen Berechtigungsabfragen des Agenten. Der alte Wort-Hash wird beim Update gelöscht.
- Plugin für OpenClaw: Hauptregeln und Erfahrungshinweis in jeder Anfrage, zerstörerische Befehle gesperrt, Erfahrung vor einer Suche. Installiert über die OpenClaw-CLI; wirkt nach einem Gateway-Neustart (`openclaw gateway restart`).

## 0.3.0
- Hauptregeln — eine kurze „immer“-Liste in `AGENTS.md`: allgemeine Punkte plus Punkte aus Ihren Einstellungen; der Hook zeigt sie beim Sitzungsstart und nach dem Komprimieren des Kontexts.
- Erfahrung als Bibliothek: Ordner nach Sache (`platform`, `tools`, `code`, `agents`, `craft`, `owner`), eine Eintragsvorlage, der Index wird aus den Köpfen erzeugt (`npx maxagent index`).
- Eine Prüfung vor „fertig“: Der Agent kann nach einer Code-Änderung nicht „fertig“ sagen, ohne etwas auszuführen oder zu öffnen.
- Browser-Wächter (wenn die Brücke gewählt ist): eingebaute Agenten-Browser werden gesperrt; „Brücke nicht verbunden“ — ein Schritt, `launch_browser`.
- Die Umgebungskarte des Rechners (Betriebssystem, Shells, Python, Node…) — eine Zusammenfassung beim Sitzungsstart.
- Eingang „für später speichern“ — ein Ordner `inbox/`; der Hook gibt Hinweise und erinnert an „nicht vergessen“-Punkte.
- `npx maxagent setup` — Einstellungen ändern: Repository, Brücke, eigener Desktop, Antwortformat, Papierkorb.

## 0.2.0
- Hooks für Claude Code, Codex, Antigravity: Erfahrungshinweis, Prüfung „Erfahrung festgehalten?“, zerstörerische Befehle gesperrt.
