# Trainerraum

Vanilla-JS-App (kein Build-Step), 20. Gateway-App der ToolsUebersicht-Familie.
Sprach-/Screenshare-Treffpunkt für Trainer — direkter Anlass war der Wunsch nach einer
Teams/Discord-artigen Funktion für die hybride Trainerversammlung (Start: 8 Personen,
soll aber ohne Redesign auf eine größere Versammlung skalieren). Port 8788
(`E:\.claude\launch.json`).

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

Anders als jede andere Gateway-App speichert der Trainerraum **nichts** dauerhaft —
kein `dav-load`/`dav-save`, kein Nextcloud-Dokument, keine Chatverläufe, keine
Aufzeichnung. Die einzige Server-Berührung ist die neue Worker-Aktion
`livekit-token` (`admin-worker.js`, `handleLivekitToken`): eingeloggter, berechtigter
Trainer rein → kurzlebiges (6h) LiveKit-JWT raus. Der Client (`db.js`,
`fetchLivekitToken(room)`) verbindet sich damit direkt zu LiveKit Cloud — der Worker
sieht danach keinen Medienstrom, nur den initialen Token-Request.

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

`userMayAccessTool("trainerraum", ...)` — identische Sichtbarkeitslogik wie jede
andere App (Admin-Panel-Gruppen-Sichtbarkeit in `sichtbarkeit.json`). Kein
gesondertes Bearbeiten-Konzept (`editGroupIds`) — im Raum sind alle gleichberechtigt,
es gibt keine Rolle „Moderator", die z. B. andere stummschalten könnte (bewusst
schlanker Scope für den Start).

## Raum-Modell

Nur EIN fester Raum (`config.js`: `ROOM_NAME = "trainerversammlung"`). Mehrere Kanäle
ließen sich später ergänzen, indem die Lobby mehrere Räume anbietet und den Namen an
`fetchLivekitToken(room)` durchreicht — die Server-Aktion nimmt den Raumnamen schon
entgegen (validiert per Regex `^[a-zA-Z0-9_-]{1,100}$`, nicht hart auf den einen
Namen verdrahtet), braucht für eine Erweiterung also keinen Worker-Redeploy.

## Akzeptierte Limitierungen (nicht erneut melden/fixen)

- **Kein Bildschirm-Teilen auf iOS-Safari** (`getDisplayMedia` fehlt dort
  systembedingt) — der Button ist dort clientseitig deaktiviert
  (`screenSupported`-Check in `app.js`). Mikro/Zuhören funktioniert überall.
- **Kein Moderator-/Mute-fremder-Teilnehmer-Recht** — jede:r verwaltet nur das eigene
  Mikro/den eigenen Screenshare.
- **Kein Chat, keine Aufzeichnung, keine Warteraum-Funktion** — bewusst schlanker
  Scope (reiner Sprach-/Screenshare-Treffpunkt).
- **Token-TTL 6h ohne Refresh-Logik** — für eine einzelne Versammlung/Absprache
  reichlich; eine Sitzung, die länger als 6h ohne Neuladen der Seite läuft, würde neu
  verbinden müssen (kein bekannter Anwendungsfall bisher).

## Deploy / Registrierung

- `E:\.claude\launch.json` — `trainerraum`, Port 8788.
- `E:\ToolsUebersicht\config.js` — `TOOLS`-Eintrag (Icon 🎙️) + `APP_CHANGELOG` (1.14).
- `E:\ToolsUebersicht\admin-worker.js` — `ALLOWED_ORIGINS` `http://localhost:8788`,
  neue Aktion `livekit-token` (`handleLivekitToken` + `buildLivekitToken`-Helper).
  **Worker-Redeploy nötig** (Cloudflare Dashboard) — wie bei jeder Worker-Änderung.
  Zusätzlich drei neue Worker-Secrets: `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
  `LIVEKIT_API_SECRET` (LiveKit-Cloud-Projekt, von Michel angelegt).
- Sichtbarkeit (welche Gruppen dürfen das Tool sehen/nutzen) wird wie bei jeder
  anderen App nach dem Launch im Admin-Panel der Tools-Übersicht gesetzt — kein Code
  nötig. Bis dahin ist die App für Nicht-Admins unsichtbar (Standardverhalten von
  `userMayAccessTool` bei fehlendem `sichtbarkeit.json`-Eintrag).
