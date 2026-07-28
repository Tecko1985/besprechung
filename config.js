const APP_VERSION = "1.0";

// Fester Hauptraum. Die Besprechung kennt bewusst nur EINEN Raum. Mehrere
// „Kanäle" ließen sich später ergänzen, indem man hier mehrere Räume anbietet
// und den Namen an fetchLivekitToken(room) durchreicht — die Server-Aktion
// nimmt ihn schon entgegen.
const ROOM_NAME = "besprechung";
const ROOM_LABEL = "Besprechung";

const APP_CHANGELOG = [
  {
    version: "1.3",
    groups: [
      {
        title: "Bedienung am Handy",
        items: [
          "Die Tab-Leiste bricht am Handy jetzt um, statt seitlich aus dem Bild zu laufen. Vorher waren die hinteren Tabs auf schmalen Bildschirmen nicht erreichbar.",
          "Eingabefelder sind am Handy mindestens 16 Pixel groß. Dadurch zoomt der iPhone-Browser beim Antippen eines Feldes nicht mehr ungefragt in die Seite hinein und bleibt danach verschoben stehen.",
          "Die Steuerleiste hält am unteren Rand Abstand zum Bedienbalken neuerer iPhones."
        ]
      }
    ]
  },
  {
    version: "1.2",
    groups: [
      {
        title: "Chat",
        items: [
          "Neuer Knopf 💬 in der Steuerleiste: Chat für alle im Raum — gedacht für alle, die gerade kein Mikrofon haben oder sich lieber schriftlich melden.",
          "Der Chat klappt rechts auf; der geteilte Bildschirm rückt dabei zur Seite, statt überdeckt zu werden.",
          "Kommt eine Nachricht, während der Chat zu ist, erscheint eine Vorschau und ein Zähler am Knopf.",
          "Nachrichten sind flüchtig: Sie bleiben nur während der Besprechung sichtbar und werden nirgends gespeichert. Wer später dazukommt, sieht das bisher Geschriebene nicht."
        ]
      },
      {
        title: "Wortmeldung",
        items: [
          "Neuer Knopf ✋ „Hand heben“: alle sehen, dass du etwas sagen möchtest — auf deiner Kachel und in einer Liste über den Teilnehmern.",
          "Die Liste zeigt die Reihenfolge der Meldungen, damit niemand übersehen wird.",
          "Die eigene Meldung nimmst du mit demselben Knopf zurück; Moderatoren können eine erledigte Wortmeldung abhaken."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Geteilter Bildschirm",
        items: [
          "Teilt jemand seinen Bildschirm, wird die Bühne automatisch groß: sie nutzt jetzt die volle Fensterbreite und -höhe statt nur der schmalen Spalte in der Mitte.",
          "Neuer Knopf ⛶ oben rechts auf der Bühne für echtes Vollbild — beenden mit demselben Knopf oder mit Esc.",
          "Während geteilt wird, rücken die Teilnehmer-Kacheln zusammen und werden kleiner, damit der Bildschirm den Platz bekommt. Wer gerade spricht, bleibt weiterhin am grünen Rahmen erkennbar.",
          "Endet die Freigabe, während das Vollbild läuft, schließt sich das Vollbild von selbst."
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
          "Zeigt an, wer im Raum ist und wer gerade spricht; skaliert von wenigen Trainern bis zur ganzen hybriden Versammlung.",
          "Kein „Zurück zum Dashboard“ im Kopfbereich: die Besprechung öffnet sich in einem eigenen Tab, das Dashboard bleibt daneben offen. So kann dich kein Fehlklick mitten aus dem Gespräch oder einer laufenden Aufnahme reißen — zum Beenden gibt es „Verlassen“."
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
