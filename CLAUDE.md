# Besprechung

Vanilla-JS-App (kein Build-Step), 20. Gateway-App der ToolsUebersicht-Familie.
Sprach-/Screenshare-Treffpunkt für Trainer — direkter Anlass war der Wunsch nach einer
Teams/Discord-artigen Funktion für die hybride Trainerversammlung (Start: 8 Personen,
soll aber ohne Redesign auf eine größere Versammlung skalieren). Port 8788
(`E:\.claude\launch.json`). **Hieß bis kurz nach dem Launch „Trainerraum"** —
umbenannt, bevor die App für irgendjemanden außer Admin sichtbar war (siehe
Rename-Hinweis ganz unten); Ordner, Repo, App-Id und alle Referenzen sind
durchgängig auf „Besprechung" aktualisiert.

## Architektur-Entscheidung: SFU statt Mesh

Bei 8+ Teilnehmern mit Bildschirmfreigabe ist ein reines Peer-to-Peer-Mesh (jeder
sendet direkt an jeden) keine Option — wer den Bildschirm teilt, müsste dessen Stream
an alle anderen einzeln hochladen (bei 7 Empfängern ≈ 10 Mbit/s Upload), das sprengt
normale Leitungen und lässt schwache Geräte einbrechen. Deshalb läuft die
Medienverteilung über einen **gemieteten SFU-Server (LiveKit Cloud)**: jeder
Teilnehmer sendet nur einmal, der SFU verteilt an alle. Kein eigener Medienserver
nötig (bewusst, passt zum sonst serverlosen Setup der ganzen Tool-Flotte) — nur ein
kostenloses LiveKit-Cloud-Projekt.

**Bewusst NICHT gewählt:**
- Jitsi-Einbettung (fertiger Video-Server, in Stunden startklar, aber nicht „eigenes
  UI" — Nutzer wollte den eigenen Look/eigene Kontrolle).
- Cloudflare Realtime (bliebe komplett im Cloudflare-Stack, aber deutlich mehr
  Eigenbau-Aufwand für Raum-/Teilnehmerverwaltung und WebRTC-Verdrahtung).

## Zustandslosigkeit

Anders als jede andere Gateway-App speichert die Besprechung **nichts** dauerhaft —
kein `dav-load`/`dav-save`, kein Nextcloud-Dokument, keine Chatverläufe, keine
Aufzeichnung. Die einzige Server-Berührung ist die Worker-Aktion `livekit-token`
(`admin-worker.js`, `handleLivekitToken`): eingeloggter, berechtigter Trainer rein →
kurzlebiges (6h) LiveKit-JWT raus. Der Client (`db.js`, `fetchLivekitToken(room)`)
verbindet sich damit direkt zu LiveKit Cloud — der Worker sieht danach keinen
Medienstrom, nur den initialen Token-Request.

**LiveKit-Secrets sind bewusst NICHT Teil des globalen `requiredSecrets`-Arrays** in
`admin-worker.js` (das würde bei fehlendem Secret die GESAMTE Gateway für alle ~20
Apps mit HTTP 500 blockieren). Die Prüfung auf `LIVEKIT_URL`/`LIVEKIT_API_KEY`/
`LIVEKIT_API_SECRET` sitzt lokal in `handleLivekitToken` — ein fehlendes Secret
bricht nur diese eine Aktion.

## LiveKit-JWT von Hand gebaut

`buildLivekitToken()` (`admin-worker.js`, neben `signToken`/`verifyToken`) signiert
ein **echtes, dreiteiliges JWT** (`header.payload.sig`) über Web-Crypto HMAC-SHA256 —
bewusst NICHT im bestehenden `signToken()`-Format dieses Workers (das ist ein
absichtlich vereinfachtes Zweiteil-Eigenformat nur für die eigenen Session-Tokens).
LiveKit Cloud selbst verifiziert das Token und erwartet Standard-JWT-Struktur mit
einem `video`-Grant-Claim (`{room, roomJoin, canPublish, canSubscribe,
canPublishData}`) — daher der eigene vollständige Header+Payload-Aufbau, der aber
den vorhandenen `bytesToBase64Url()`-Helper mitbenutzt. Identity = Gateway-Username
(eindeutig, stabil), `name` = Vorname+Nachname-Snapshot (Fallback: Username).

## Rechte

**Sehen/Betreten:** `userMayAccessTool("besprechung", ...)` — identische
Sichtbarkeitslogik wie jede andere App (Admin-Panel-Gruppen-Sichtbarkeit in
`sichtbarkeit.json`). Jede berechtigte Person bekommt über `livekit-token` ein
Teilnehmer-Token (reden/zuhören/Bildschirm teilen).

**Moderieren (seit 1.2):** zusätzlich `editGroupIds` (dieselbe „Bearbeiter"-Logik
wie bei den anderen Apps, serverseitig über `resolveEditPermission("besprechung", …)`).
Nur Bearbeiter dürfen andere stummschalten/aus dem Raum entfernen (Worker-Aktionen
`livekit-kick`/`livekit-mute`, laufen über ein kurzlebiges `roomAdmin`-Token, das
den API-Secret nie an den Client gibt) und die Besprechung lokal aufnehmen (1.4).
Der Client berechnet die UI-Sichtbarkeit dieser Buttons aus `me.canEdit`
(`fetchMe()` schickt `app:"besprechung"` mit), der Worker prüft die Berechtigung
bei jeder Aktion erneut — die Buttons sind reine UI.

## Raum-Modell

Nur EIN fester Raum (`config.js`: `ROOM_NAME = "besprechung"`, `ROOM_LABEL` steuert
den in der Lobby angezeigten Titel — wird in `app.js`/`showAppShell()` dynamisch
gesetzt, nicht im HTML hartkodiert). Mehrere Kanäle ließen sich später ergänzen,
indem die Lobby mehrere Räume anbietet und den Namen an `fetchLivekitToken(room)`
durchreicht — die Server-Aktion nimmt den Raumnamen schon entgegen (validiert per
Regex `^[a-zA-Z0-9_-]{1,100}$`, nicht hart auf den einen Namen verdrahtet), braucht
für eine Erweiterung also keinen Worker-Redeploy.

## Akzeptierte Limitierungen (nicht erneut melden/fixen)

- **Kein Bildschirm-Teilen auf iOS-Safari** (`getDisplayMedia` fehlt dort
  systembedingt) — der Button ist dort clientseitig deaktiviert
  (`screenSupported`-Check in `app.js`). Mikro/Zuhören funktioniert überall.
- **Bildschirm-Teilen vom Handy aus ist geräteabhängig unzuverlässig** (siehe
  robustheits-Fix unten) — auf Android technisch möglich, aber nicht garantiert
  stabil; praktische Empfehlung bleibt Laptop/Desktop für die teilende Person.
- **Kein Chat, keine Warteraum-Funktion** — bewusst schlanker Scope (reiner
  Sprach-/Screenshare-Treffpunkt). Moderation (kicken/stummschalten) und lokale
  Aufnahme gibt es seit 1.2/1.4, aber nur für Bearbeiter (siehe „## Rechte").
- **Aufnahme ist rein lokal (MediaRecorder), kein LiveKit-Egress** — sie läuft nur,
  solange der aufnehmende Tab offen ist, und die Datei landet auf dessen Gerät. Wer
  während einer laufenden Aufnahme den Raum verlässt/den Tab schließt, beendet sie.
- **Transkription (1.6): keine Sprecher-Trennung, Qualität modellbedingt** — Whisper
  liefert durchlaufenden Text ohne „wer hat was gesagt" (Diarisierung wäre deutlich mehr
  Aufwand). `whisper-base`/q8 ist ein Kompromiss aus Download-Größe und Güte; für ein
  gegenzulesendes Protokoll gedacht, nicht als wörtliches Amtsprotokoll. Erst-Download
  ~80 MB + spürbare Rechenlast (auf schwachen Geräten/iOS-Safari ggf. zu wenig Speicher);
  darum bewusst **nachträglich** statt live.
- **Token-TTL 6h ohne Refresh-Logik** — für eine einzelne Versammlung/Absprache
  reichlich; eine Sitzung, die länger als 6h ohne Neuladen der Seite läuft, würde neu
  verbinden müssen (kein bekannter Anwendungsfall bisher).

## Robustheit: Screenshare-Selbstheilung (seit 1.1)

Beim ersten echten Zwei-Personen-Test (ein Teilnehmer per Handy) blieb die Bühne bei
den anderen auf einem eingefrorenen/schwarzen Bild stehen, obwohl die Freigabe längst
beendet war — mobile Browser feuern beim Sperren des Displays/Wegwischen des Tabs oft
kein sauberes LiveKit-Unpublish-Event. Fix in zwei Teilen (`app.js`):
`attachNativeStopWatcher()` hört auf der teilenden Seite zusätzlich auf das native
`ended`-Event des rohen `MediaStreamTrack` und erzwingt ein sauberes
`setScreenShareEnabled(false)`; `startStageWatchdog()`/`isTrackAlive()` prüft auf der
zuschauenden Seite alle 3s den `readyState` des gezeigten Tracks und räumt selbst auf,
falls das Unpublish-Event trotzdem ausbleibt.

## Transkription (lokal, nachträglich — seit 1.6)

Eine Aufnahme lässt sich zusätzlich in ein Text-Transkript umwandeln. Wie die Aufnahme
läuft das **komplett clientseitig, ohne Server/Egress und ohne Worker-Redeploy** —
`admin-worker.js` ist unberührt.

- **Auslösung:** Moderator-Toggle `btn-transcribe` (Zustand `wantTranscript`, nur sichtbar
  für Bearbeiter + wenn `transcribeSupported`). Ist er beim Stoppen aktiv, transkribiert
  `finishRecordingDownload` die gerade fertige Aufnahme automatisch. Der Blob wird in
  `lastRecordingBlob` gehalten, sodass der Toggle auch **nach** dem Stoppen noch die letzte
  Aufnahme transkribieren kann (`toggleTranscribeWish`).
- **Warum der Aufnahme-Blob der richtige Input ist:** Er enthält bereits den Web-Audio-Mix
  **aller** Teilnehmerstimmen (`recDest`, siehe Aufnahme) — anders als die Browser-eigene
  Web Speech API, die nur das lokale Mikrofon hört. Deshalb wird bewusst der fertige Blob
  transkribiert, nicht ein Live-Mikrofonstrom.
- **Pipeline:** `decodeTo16kMono` dekodiert den Blob und rendert ihn per
  `OfflineAudioContext` auf 16 kHz Mono (robust, auch wenn `decodeAudioData` die
  Ziel-Samplerate ignoriert). Dann Whisper via **transformers.js** (`@huggingface/transformers@3`,
  Modell `Xenova/whisper-base`, `dtype:"q8"` ⇒ ~80 MB statt ~290 MB fp32, Sprache Deutsch,
  `return_timestamps`). Ergebnis: `.txt` (mit `[mm:ss]`-Zeitmarken, `buildTranscriptTxt`) +
  `.vtt` (Untertitel, `buildTranscriptVtt`), beide per `downloadBlob` heruntergeladen.
- **Externe Herkunft:** Die Lib kommt von **jsDelivr** (dieselbe CDN wie `livekit-client`
  in `index.html` — Muster etabliert), die Modellgewichte einmalig von **huggingface.co**
  (`env.remoteHost`-Default), danach Browser-Cache. Kein CSP-Riegel auf GitHub Pages. Nur
  die Gewichte werden geladen — es wird **kein Audio hochgeladen**.
- **Fortschritt:** persistentes `#transcribe-status`-Banner (fixed über der Steuerleiste),
  weil `flashStatus` nach 4 s verschwindet und der Modell-Download/die Inferenz länger dauern.

## Deploy / Registrierung

- `E:\.claude\launch.json` — `besprechung`, Port 8788.
- `E:\ToolsUebersicht\config.js` — `TOOLS`-Eintrag (Icon 🎙️, `id: "besprechung"`) +
  `APP_CHANGELOG`.
- `E:\ToolsUebersicht\admin-worker.js` — `ALLOWED_ORIGINS` `http://localhost:8788`,
  Aktion `livekit-token` (`handleLivekitToken` + `buildLivekitToken`-Helper), Check
  `userMayAccessTool("besprechung", ...)`. **Worker-Redeploy nötig** (Cloudflare
  Dashboard) — wie bei jeder Worker-Änderung. Drei Worker-Secrets:
  `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (LiveKit-Cloud-Projekt, von
  Michel angelegt) — **bereits gesetzt und deployed** (Stand 2026-07-14).
- Sichtbarkeit (welche Gruppen dürfen das Tool sehen/nutzen) wird wie bei jeder
  anderen App nach dem Launch im Admin-Panel der Tools-Übersicht gesetzt — kein Code
  nötig. Bis dahin ist die App für Nicht-Admins unsichtbar (Standardverhalten von
  `userMayAccessTool` bei fehlendem `sichtbarkeit.json`-Eintrag). **Stand 2026-07-14:
  noch nicht gesetzt** — nur Admin (Michel) kann testen, bis das im Admin-Panel
  passiert.

## Rename-Hinweis (2026-07-14)

App hieß beim allerersten Launch (gleicher Tag) kurz „Trainerraum" mit Ordner
`E:\trainerraum`, GitHub-Repo `Tecko1985/trainerraum`, App-Id `"trainerraum"` und
Raumname `"trainerversammlung"`. Umbenannt auf Nutzerwunsch, BEVOR die App für
irgendjemanden außer Admin sichtbar war (Sichtbarkeit stand zu dem Zeitpunkt noch
nicht im Admin-Panel) — daher volle Umbenennung über alle Ebenen ohne Rücksicht auf
bestehende Bookmarks/Links: Ordner, GitHub-Repo (`gh repo rename`, alte Pages-URL
`tecko1985.github.io/trainerraum/` liefert seither 404, kein automatischer
Redirect), App-Id (`GATEWAY_APP_ID`/`userMayAccessTool`-Aufruf/TOOLS-Eintrag),
Raumname. Kein eigener Cloudflare-Worker (nutzt den gemeinsamen `landingpage`-Worker)
und keine Nextcloud-Daten (zustandslos) — dadurch deutlich einfacher als ein
typischer Fleet-Rename mit dediziertem Worker/Datenpfad.
