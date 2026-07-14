const APP_VERSION = "1.1";

// Fester Hauptraum. Der Trainerraum kennt bewusst nur EINEN Raum (die
// Trainerversammlung / der Sprach-Treffpunkt). Mehrere „Kanäle" ließen sich
// später ergänzen, indem man hier mehrere Räume anbietet und den Namen an
// fetchLivekitToken(room) durchreicht — die Server-Aktion nimmt ihn schon entgegen.
const ROOM_NAME = "trainerversammlung";
const ROOM_LABEL = "Trainerversammlung";

const APP_CHANGELOG = [
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
        title: "Trainerraum",
        items: [
          "Sprach-Treffpunkt für Trainer: eintreten, reden, zuhören — direkt im Browser, ohne Zusatz-App.",
          "Bildschirm teilen: ein Klick, und dein Monitor erscheint bei allen anderen groß auf der Bühne.",
          "Zeigt an, wer im Raum ist und wer gerade spricht; skaliert von wenigen Trainern bis zur ganzen hybriden Versammlung."
        ]
      }
    ]
  }
];
