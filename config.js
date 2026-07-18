const APP_VERSION = "1.0";

// Fester Hauptraum. Die Besprechung kennt bewusst nur EINEN Raum. Mehrere
// „Kanäle" ließen sich später ergänzen, indem man hier mehrere Räume anbietet
// und den Namen an fetchLivekitToken(room) durchreicht — die Server-Aktion
// nimmt ihn schon entgegen.
const ROOM_NAME = "besprechung";
const ROOM_LABEL = "Besprechung";

const APP_CHANGELOG = [
  {
    version: "1.0",
    groups: [
      {
        title: "Besprechung",
        items: [
          "Sprach-Treffpunkt für Trainer: eintreten, reden, zuhören — direkt im Browser, ohne Zusatz-App.",
          "Bildschirm teilen: ein Klick, und dein Monitor erscheint bei allen anderen groß auf der Bühne.",
          "Zeigt an, wer im Raum ist und wer gerade spricht; skaliert von wenigen Trainern bis zur ganzen hybriden Versammlung."
        ]
      },
      {
        title: "Beitreten",
        items: [
          "„Stummgeschaltet beitreten“ ist in der Lobby standardmäßig angehakt — du kommst leiser in den Raum und schaltest dein Mikrofon per Klick frei, wenn du sprechen möchtest."
        ]
      },
      {
        title: "Moderation",
        items: [
          "Bearbeiter-Gruppen können Teilnehmer stummschalten oder aus dem Raum entfernen — die Buttons erscheinen direkt auf der jeweiligen Teilnehmer-Kachel.",
          "Die Besprechung öffnet sich beim Anklicken in der Tools-Übersicht in einem neuen Tab."
        ]
      },
      {
        title: "Aufnahme & Transkript",
        items: [
          "Bearbeiter-Gruppen können die Besprechung direkt im Browser aufnehmen — Ton aller Teilnehmer plus der geteilte Bildschirm. Die Datei wird am Ende auf dem eigenen Gerät gespeichert.",
          "Während einer Aufnahme sehen alle Teilnehmer einen deutlichen Hinweis „Aufnahme läuft“.",
          "Aus einer Aufnahme lässt sich ein Text-Transkript erstellen — vor dem Stoppen „Transkript“ einschalten, danach entstehen automatisch eine .txt-Datei (mit Zeitmarken) und eine .vtt-Untertiteldatei.",
          "Die Transkription läuft komplett lokal im Browser (ein Sprachmodell wird beim ersten Mal einmalig geladen) — der Ton verlässt dein Gerät nicht.",
          "Aufnahme und Transkript-Schalter sind nur für Bearbeiter-Gruppen sichtbar."
        ]
      }
    ]
  }
];
