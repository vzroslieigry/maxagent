# Neu in maxagent

Der Agent zeigt dem Besitzer nach einem Update einmal, was neu ist (Regeln, Abschnitt 8), und hinterlässt eine Notiz in `experience/maxagent.md`.

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
