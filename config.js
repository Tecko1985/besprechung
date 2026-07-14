const APP_VERSION = "1.0";

// Fester Hauptraum. Der Trainerraum kennt bewusst nur EINEN Raum (die
// Trainerversammlung / der Sprach-Treffpunkt). Mehrere „Kanäle" ließen sich
// später ergänzen, indem man hier mehrere Räume anbietet und den Namen an
// fetchLivekitToken(room) durchreicht — die Server-Aktion nimmt ihn schon entgegen.
const ROOM_NAME = "trainerversammlung";
const ROOM_LABEL = "Trainerversammlung";

const APP_CHANGELOG = [
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
