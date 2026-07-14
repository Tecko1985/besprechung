const APP_VERSION = "1.2";

// Fester Hauptraum. Die Besprechung kennt bewusst nur EINEN Raum. Mehrere
// „Kanäle" ließen sich später ergänzen, indem man hier mehrere Räume anbietet
// und den Namen an fetchLivekitToken(room) durchreicht — die Server-Aktion
// nimmt ihn schon entgegen.
const ROOM_NAME = "besprechung";
const ROOM_LABEL = "Besprechung";

const APP_CHANGELOG = [
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
