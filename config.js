const APP_VERSION = "1.5";

// Fester Hauptraum. Die Besprechung kennt bewusst nur EINEN Raum. Mehrere
// „Kanäle" ließen sich später ergänzen, indem man hier mehrere Räume anbietet
// und den Namen an fetchLivekitToken(room) durchreicht — die Server-Aktion
// nimmt ihn schon entgegen.
const ROOM_NAME = "besprechung";
const ROOM_LABEL = "Besprechung";

const APP_CHANGELOG = [
  {
    version: "1.5",
    groups: [
      {
        title: "Aufnahme",
        items: [
          "Die Aufnahme erfasst jetzt auch Teilnehmer, die erst nach dem Start dazukommen oder ihr Mikrofon erst später einschalten — vorher fehlte deren Ton in der Aufzeichnung."
        ]
      }
    ]
  },
  {
    version: "1.4",
    groups: [
      {
        title: "Aufnahme",
        items: [
          "Bearbeiter-Gruppen können die Besprechung direkt im Browser aufnehmen — Ton aller Teilnehmer plus der geteilte Bildschirm (auch wenn erst während der laufenden Aufnahme mit dem Teilen begonnen wird). Die Datei wird am Ende auf dem eigenen Gerät gespeichert.",
          "Während einer Aufnahme sehen alle Teilnehmer einen deutlichen Hinweis „Aufnahme läuft“."
        ]
      }
    ]
  },
  {
    version: "1.2",
    groups: [
      {
        title: "Moderation",
        items: [
          "Bearbeiter-Gruppen können Teilnehmer jetzt stummschalten oder aus dem Raum entfernen — die Buttons erscheinen direkt auf der jeweiligen Teilnehmer-Kachel.",
          "Die Besprechung öffnet sich beim Anklicken in der Tools-Übersicht in einem neuen Tab."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Bildschirm teilen",
        items: [
          "Robuster gegen abrupt beendete Freigaben (z. B. Sperrbildschirm oder Wegwischen des Tabs am Handy): die Bühne räumt sich jetzt zuverlässig selbst auf, statt ein eingefrorenes Bild stehen zu lassen."
        ]
      }
    ]
  },
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
      }
    ]
  }
];
