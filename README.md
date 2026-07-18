# Besprechung (v1.0)

Digitaler Treffpunkt für Trainer: Sprachraum direkt im Browser, inklusive Bildschirm
teilen — Teil der [Tools-Übersicht](https://tecko1985.github.io/ToolsUebersicht/) des
1. SC 1911 Heiligenstadt. Gedacht für spontane Absprachen und die hybride
Trainerversammlung.

**Ein Klick auf „Raum betreten"** — kein Zusatz-Account, keine App-Installation. Wer
Zugriff auf dieses Tool hat, betritt denselben Raum, sieht alle anderen Teilnehmer als
Kachel und hört sie. Wer gerade spricht, wird sichtbar hervorgehoben. Ein Klick teilt
den eigenen Bildschirm — er erscheint bei allen anderen groß auf der Bühne.

## Bedienung

- **Raum betreten** — fragt beim ersten Mal nach Mikrofon-Zugriff. „Stummgeschaltet
  beitreten" lässt sich vorab ankreuzen.
- **Mikro an/stumm**, **Bildschirm teilen/beenden**, **Verlassen** — feste Steuerleiste
  am unteren Bildschirmrand, solange man im Raum ist.
- Wer spricht, bekommt einen grünen Rahmen um die eigene Kachel (automatisch, ohne
  Zutun).

## Bekannte Grenzen

- **Bildschirm teilen funktioniert nicht auf iPhone/iPad im Browser**
  (`getDisplayMedia` fehlt dort systembedingt) — Mikro/Zuhören funktioniert auf allen
  Geräten.
- Bildschirm teilen vom **Handy** aus ist grundsätzlich möglich, aber gerätabhängig
  unzuverlässig (Sperrbildschirm/Tab-Wechsel kann die Freigabe abrupt beenden). Für
  eine hybride Versammlung: wer teilen will, sitzt am Laptop/Desktop.

## Technik

Vanilla-JS-App (kein Build-Step), Medienübertragung läuft über [LiveKit
Cloud](https://livekit.io/) (gemieteter SFU-Medienserver — verteilt Audio/Video, ohne
dass jeder Teilnehmer direkt an jeden anderen senden muss). Anmeldung läuft über das
zentrale ToolsUebersicht-Login-Gateway (`admin-worker.js`), das jedem berechtigten
Trainer ein kurzlebiges LiveKit-Zugangstoken ausstellt. Die Besprechung selbst
speichert **nichts** dauerhaft (kein Nextcloud-Dokument, keine Chatverläufe,
keine Aufzeichnung).

- `index.html`, `app.js`, `db.js`, `config.js`, `style.css` — die App
