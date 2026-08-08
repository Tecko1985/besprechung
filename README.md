# 🎙️ Besprechung

Digitaler Treffpunkt für Trainer: Sprachraum direkt im Browser, inklusive Bildschirm teilen — z. B. für die hybride Trainerversammlung.

**➡️ [Besprechung öffnen](https://sc1911heiligenstadt.github.io/besprechung/)**

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen.

Die Rechte gelten in drei Stufen: **Sehen** (nur ansehen), **Bearbeiten** (Einträge pflegen) und **Administrieren** (Einstellungen und Verwaltung). Wer welche Stufe hat, legt die Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `besprechung` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8788/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages.

**Dieses Werkzeug speichert nichts.** Es gibt kein Dokument in der Nextcloud, keine Chatverläufe und keine Aufzeichnung auf einem Server. Die einzige Server-Berührung ist ein kurzlebiger Zugangsschlüssel für den Sprachraum; Ton und Bild laufen danach direkt über den Medien-Dienst. Der Chat ist flüchtig — wer später dazukommt, sieht das bisher Geschriebene nicht.

Eine Aufnahme und das daraus erzeugte Transkript entstehen **auf dem Gerät der aufnehmenden Person** und landen als Datei dort. Es wird kein Ton hochgeladen. Die Aufnahme läuft nur, solange dieser Tab offen bleibt.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
