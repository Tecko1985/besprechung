// ------------------------------------------------------------------
// Besprechung — LiveKit-Sprach-/Screenshare-Client.
// Zustandslos: kein Nextcloud-Speicher. Ablauf = anmelden (Gateway) →
// Token holen (db.js/fetchLivekitToken) → LiveKit-Room verbinden → reden
// und optional Bildschirm teilen. Vorbild-Look: die übrigen Gateway-Apps.
// ------------------------------------------------------------------

const LK = window.LivekitClient || null;

let me = null;            // { username, vorname, nachname, canEdit, ... } vom Gateway
let isModerator = false;  // = me.canEdit (Bearbeiter-Gruppen der Besprechung) → darf kicken/stummschalten
let room = null;          // aktive LivekitClient.Room-Instanz (oder null)
const speaking = new Set(); // Identities, die gerade sprechen
let stageTrack = null;    // aktuell auf der Bühne gezeigter ScreenShare-Track
let stageSid = null;      // dessen trackSid (Doppel-Attach vermeiden)
let stageWatchdog = null; // siehe startStageWatchdog() -- Selbstheilung bei unsauber beendetem Screenshare
// Aufnahme (lokal im Browser via MediaRecorder — kein Server/Egress)
let recorder = null;       // MediaRecorder oder null
let recChunks = [];
let recMimeType = "";
let recAudioCtx = null;    // AudioContext zum Mischen aller Stimmen
let recDest = null;        // MediaStreamAudioDestinationNode (Ergebnis des Mix)
let recSources = new Map(); // key -> MediaStreamAudioSourceNode (Dedupe/Cleanup)
let remoteRecordingBy = null; // Anzeigename, falls ein ANDERER gerade aufnimmt
let remoteRecordingId = null; // dessen identity (Banner sauber entfernen bei Disconnect)

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const connectScreen = $("connect-screen");
const appShell = $("app-shell");
const lobby = $("lobby");
const roomView = $("room");
const controls = $("controls");
const grid = $("participant-grid");
const stageEl = $("stage");
const stageLabel = $("stage-label");
const audioSink = $("audio-sink");
const btnJoin = $("btn-join");
const btnMic = $("btn-mic");
const btnScreen = $("btn-screen");
const btnLeave = $("btn-leave");
const btnAudioUnlock = $("btn-audio-unlock");
const joinMutedCb = $("join-muted");
const roomCount = $("room-count");
const saveStatus = $("save-status");
const btnRecord = $("btn-record");
const recBanner = $("rec-banner");
const recBannerText = $("rec-banner-text");

const screenSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

// ------------------------------------------------------------------
// Init / Auth
// ------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupVersionBadge();
  setupStaticButtons();
  if (!screenSupported) {
    btnScreen.disabled = true;
    btnScreen.title = "Bildschirm teilen wird auf diesem Gerät/Browser nicht unterstützt (z. B. iPhone/iPad).";
  }
  if (!getSessionToken()) { showConnect(); return; }
  try {
    me = await fetchMe();
    isModerator = !!me.canEdit;
    showAppShell();
  } catch (e) {
    if (e instanceof NotLoggedInError) showConnect();
    else showConnect(e.message || String(e));
  }
}

function showConnect(errMsg) {
  connectScreen.style.display = "";
  appShell.style.display = "none";
  if (errMsg) $("cloud-error").textContent = errMsg;
}

function showAppShell() {
  connectScreen.style.display = "none";
  appShell.style.display = "";
  $("header-user").textContent = displayName(me);
  $("lobby-title").textContent = ROOM_LABEL;
  lobby.classList.remove("hidden");
  roomView.classList.add("hidden");
  controls.classList.add("hidden");
}

// ------------------------------------------------------------------
// Statische Buttons / Version-Badge / Changelog
// ------------------------------------------------------------------
function setupStaticButtons() {
  btnJoin.addEventListener("click", joinRoom);
  btnMic.addEventListener("click", toggleMic);
  btnScreen.addEventListener("click", toggleScreen);
  btnLeave.addEventListener("click", leaveRoom);
  btnRecord.addEventListener("click", toggleRecording);
  btnAudioUnlock.addEventListener("click", unlockAudio);
  window.addEventListener("beforeunload", () => { if (room) { try { room.disconnect(); } catch (_) {} } });
}

function setupVersionBadge() {
  const badge = $("version-badge");
  badge.textContent = "v" + APP_VERSION;
  const modal = $("changelog-modal");
  const open = () => { renderChangelog(); modal.classList.remove("hidden"); };
  const close = () => modal.classList.add("hidden");
  badge.addEventListener("click", open);
  badge.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  $("changelog-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
}

function renderChangelog() {
  const box = $("changelog-list");
  box.innerHTML = "";
  APP_CHANGELOG.forEach((entry) => {
    const wrap = document.createElement("div");
    wrap.className = "changelog-entry";
    const v = document.createElement("div");
    v.className = "cv";
    v.textContent = "Version " + entry.version;
    wrap.appendChild(v);
    entry.groups.forEach((g) => {
      const gEl = document.createElement("div");
      gEl.className = "changelog-group";
      const t = document.createElement("div");
      t.className = "cg-title";
      t.textContent = g.title;
      gEl.appendChild(t);
      const ul = document.createElement("ul");
      ul.className = "cg-items";
      g.items.forEach((it) => {
        const li = document.createElement("li");
        li.textContent = it;
        ul.appendChild(li);
      });
      gEl.appendChild(ul);
      wrap.appendChild(gEl);
    });
    box.appendChild(wrap);
  });
}

// ------------------------------------------------------------------
// Raum betreten / verlassen
// ------------------------------------------------------------------
async function joinRoom() {
  setLobbyError("");
  if (!LK) { setLobbyError("Video-Bibliothek konnte nicht geladen werden — Internetverbindung prüfen und neu laden."); return; }
  btnJoin.disabled = true;
  btnJoin.textContent = "Verbinde…";
  try {
    const info = await fetchLivekitToken(ROOM_NAME);
    if (!info || !info.token || !info.url) throw new Error("Ungültige Token-Antwort vom Server.");
    room = new LK.Room({ adaptiveStream: true, dynacast: true });
    wireRoomEvents(room);
    await room.connect(info.url, info.token);

    // Mikro standardmäßig an (außer „stumm beitreten"). Im Kontext des
    // Button-Klicks — hier fragt der Browser nach Mikrofon-Erlaubnis.
    if (!joinMutedCb.checked) {
      try { await room.localParticipant.setMicrophoneEnabled(true); }
      catch (micErr) { flashStatus("Mikrofon nicht freigegeben — du hörst nur zu.", "is-error"); }
    }
    try { await room.startAudio(); } catch (_) {}

    enterRoomUI();
  } catch (e) {
    setLobbyError(e.message || String(e));
    if (room) { try { await room.disconnect(); } catch (_) {} }
    room = null;
  } finally {
    btnJoin.disabled = false;
    btnJoin.textContent = "🎙️ Raum betreten";
  }
}

async function leaveRoom() {
  // Läuft eine Aufnahme, sauber stoppen (informiert die anderen + lädt die
  // Datei runter), bevor die Verbindung getrennt wird.
  if (recorder) stopRecording();
  if (room) { try { await room.disconnect(); } catch (_) {} }
  // UI-Reset passiert im Disconnected-Event (onLeft).
}

function enterRoomUI() {
  lobby.classList.add("hidden");
  roomView.classList.remove("hidden");
  controls.classList.remove("hidden");
  updateControls();
  updateAudioUnlock();
  updateRecordingUI();
  renderParticipants();
  renderStage();
}

function onLeft() {
  // Lief noch eine Aufnahme (z.B. Verbindung hart abgerissen), sichern:
  // recorder.stop() -> onstop lädt die bisherige Aufnahme runter + räumt den Mix auf.
  if (recorder && recorder.state !== "inactive") { try { recorder.stop(); } catch (_) {} }
  recorder = null;
  remoteRecordingBy = null;
  remoteRecordingId = null;
  room = null;
  speaking.clear();
  clearStage();
  grid.innerHTML = "";
  audioSink.innerHTML = "";
  lobby.classList.remove("hidden");
  roomView.classList.add("hidden");
  controls.classList.add("hidden");
  updateRecordingUI();
}

// ------------------------------------------------------------------
// LiveKit-Events
// ------------------------------------------------------------------
function wireRoomEvents(r) {
  const E = LK.RoomEvent;
  r.on(E.ParticipantConnected, onParticipantConnected)
   .on(E.ParticipantDisconnected, onParticipantDisconnected)
   .on(E.DataReceived, onDataReceived)
   .on(E.TrackSubscribed, onTrackSubscribed)
   .on(E.TrackUnsubscribed, onTrackUnsubscribed)
   .on(E.LocalTrackPublished, () => { renderStage(); renderParticipants(); updateControls(); })
   .on(E.LocalTrackUnpublished, () => { renderStage(); renderParticipants(); updateControls(); })
   .on(E.TrackMuted, renderParticipants)
   .on(E.TrackUnmuted, renderParticipants)
   .on(E.ActiveSpeakersChanged, onActiveSpeakers)
   .on(E.AudioPlaybackStatusChanged, updateAudioUnlock)
   .on(E.Disconnected, onLeft);
}

function onTrackSubscribed(track, publication, participant) {
  if (track.kind === LK.Track.Kind.Audio) {
    const el = track.attach();
    el.autoplay = true;
    audioSink.appendChild(el);
  } else if (publication.source === LK.Track.Source.ScreenShare) {
    renderStage();
  }
  renderParticipants();
}

function onTrackUnsubscribed(track, publication) {
  track.detach().forEach((el) => el.remove());
  if (publication.source === LK.Track.Source.ScreenShare) renderStage();
  renderParticipants();
}

function onActiveSpeakers(speakers) {
  speaking.clear();
  speakers.forEach((p) => speaking.add(p.identity));
  document.querySelectorAll(".tile").forEach((t) => {
    t.classList.toggle("speaking", speaking.has(t.dataset.identity));
  });
}

// ------------------------------------------------------------------
// Rendern: Teilnehmer-Kacheln
// ------------------------------------------------------------------
function participants() {
  if (!room) return [];
  return [room.localParticipant, ...room.remoteParticipants.values()];
}

function renderParticipants() {
  if (!room) return;
  const list = participants();
  roomCount.textContent = list.length === 1 ? "Nur du im Raum" : list.length + " im Raum";
  grid.innerHTML = "";
  list.forEach((p) => grid.appendChild(tileFor(p)));
}

function tileFor(p) {
  const isLocal = room && p === room.localParticipant;
  const name = displayNameOf(p);
  const micOn = p.isMicrophoneEnabled;
  const sharing = p.isScreenShareEnabled;

  const tile = document.createElement("div");
  tile.className = "tile" + (speaking.has(p.identity) ? " speaking" : "");
  tile.dataset.identity = p.identity;

  const mic = document.createElement("div");
  mic.className = "tile-mic";
  mic.textContent = micOn ? "🎙️" : "🔇";
  mic.title = micOn ? "Mikrofon an" : "Stummgeschaltet";
  tile.appendChild(mic);

  const avatar = document.createElement("div");
  avatar.className = "tile-avatar";
  avatar.style.background = avatarColor(p.identity);
  avatar.textContent = initials(name);
  tile.appendChild(avatar);

  const nm = document.createElement("div");
  nm.className = "tile-name";
  nm.appendChild(document.createTextNode(name));
  if (isLocal) {
    const you = document.createElement("span");
    you.className = "tile-you";
    you.textContent = "Du";
    nm.appendChild(you);
  }
  tile.appendChild(nm);

  if (sharing) {
    const sh = document.createElement("div");
    sh.className = "tile-sharing";
    sh.textContent = "🖥️ teilt Bildschirm";
    tile.appendChild(sh);
  }

  // Moderations-Aktionen: nur für Bearbeiter (me.canEdit) und nur auf fremden
  // Kacheln. Die eigentliche Berechtigung wird serverseitig nochmal geprüft
  // (admin-worker.js resolveEditPermission) — diese Buttons sind reine UI.
  if (isModerator && !isLocal) {
    const modBar = document.createElement("div");
    modBar.className = "tile-mod";

    const muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "tile-mod-btn";
    muteBtn.textContent = "🔇 Stumm";
    muteBtn.title = micOn ? "Diesen Teilnehmer stummschalten" : "Bereits stummgeschaltet";
    muteBtn.disabled = !micOn;
    muteBtn.addEventListener("click", () => moderatorMute(p));
    modBar.appendChild(muteBtn);

    const kickBtn = document.createElement("button");
    kickBtn.type = "button";
    kickBtn.className = "tile-mod-btn danger";
    kickBtn.textContent = "🚪 Entfernen";
    kickBtn.title = "Diesen Teilnehmer aus dem Raum entfernen";
    kickBtn.addEventListener("click", () => moderatorKick(p));
    modBar.appendChild(kickBtn);

    tile.appendChild(modBar);
  }
  return tile;
}

// ------------------------------------------------------------------
// Moderation (nur Bearbeiter) — kicken / stummschalten. Beides läuft über den
// Worker (LiveKit-Server-API), NIE direkt vom Client: der Worker prüft die
// Berechtigung erneut und hält als Einziger den API-Secret. Das Ergebnis
// (Teilnehmer weg / Track stumm) kommt als normales LiveKit-Event zurück und
// aktualisiert die Kacheln von selbst — kein manuelles Neu-Rendern nötig.
// ------------------------------------------------------------------
async function moderatorMute(p) {
  const pub = p.getTrackPublication(LK.Track.Source.Microphone);
  const sid = pub && pub.trackSid;
  if (!sid) { flashStatus(displayNameOf(p) + " ist bereits stumm.", "is-ok"); return; }
  try {
    await livekitMute(ROOM_NAME, p.identity, sid);
    flashStatus(displayNameOf(p) + " stummgeschaltet.", "is-ok");
  } catch (e) {
    flashStatus("Stummschalten fehlgeschlagen" + (e && e.message ? ": " + e.message : ""), "is-error");
  }
}

async function moderatorKick(p) {
  if (!confirm(displayNameOf(p) + " aus dem Raum entfernen?")) return;
  try {
    await livekitKick(ROOM_NAME, p.identity);
    flashStatus(displayNameOf(p) + " entfernt.", "is-ok");
  } catch (e) {
    flashStatus("Entfernen fehlgeschlagen" + (e && e.message ? ": " + e.message : ""), "is-error");
  }
}

// ------------------------------------------------------------------
// Rendern: Screenshare-Bühne
// ------------------------------------------------------------------
function findScreenShare() {
  for (const p of participants()) {
    const pub = p.getTrackPublication ? p.getTrackPublication(LK.Track.Source.ScreenShare) : null;
    if (pub && pub.track) return { pub, track: pub.track, name: displayNameOf(p) };
  }
  return null;
}

function renderStage() {
  const share = findScreenShare();
  if (!share || !isTrackAlive(share.track)) { clearStage(); return; }
  if (share.pub.trackSid === stageSid) return; // schon angezeigt
  clearStage();
  const video = share.track.attach();
  video.muted = true;
  video.playsInline = true;
  stageEl.insertBefore(video, stageLabel);
  stageLabel.textContent = "🖥️ Bildschirm von " + share.name;
  stageEl.classList.remove("hidden");
  stageTrack = share.track;
  stageSid = share.pub.trackSid;
  startStageWatchdog();
}

// Erkennt ein Track-Objekt, dessen zugrundeliegender MediaStreamTrack bereits
// (still, ohne LiveKit-Event) beendet ist -- der Fall auf manchen Mobil-
// Browsern, siehe attachNativeStopWatcher().
function isTrackAlive(track) {
  const mst = track && track.mediaStreamTrack;
  return !!mst && mst.readyState === "live";
}

// Sicherheitsnetz gegen genau den Fall, den attachNativeStopWatcher() beim
// TEILENDEN abfängt, aber aus Sicht der ZUSCHAUENDEN: prüft alle paar
// Sekunden, ob der aktuell auf der Bühne gezeigte Track noch lebt, und räumt
// sonst selbst auf, statt dauerhaft ein eingefrorenes/schwarzes Bild zu zeigen.
function startStageWatchdog() {
  stopStageWatchdog();
  stageWatchdog = setInterval(() => {
    if (stageTrack && !isTrackAlive(stageTrack)) renderStage();
  }, 3000);
}

function stopStageWatchdog() {
  if (stageWatchdog) { clearInterval(stageWatchdog); stageWatchdog = null; }
}

function clearStage() {
  stopStageWatchdog();
  if (stageTrack) { try { stageTrack.detach().forEach((el) => el.remove()); } catch (_) {} }
  stageEl.querySelectorAll("video").forEach((v) => v.remove());
  stageEl.classList.add("hidden");
  stageLabel.textContent = "";
  stageTrack = null;
  stageSid = null;
}

// ------------------------------------------------------------------
// Steuerung
// ------------------------------------------------------------------
async function toggleMic() {
  if (!room) return;
  const on = room.localParticipant.isMicrophoneEnabled;
  try {
    await room.localParticipant.setMicrophoneEnabled(!on);
  } catch (e) {
    flashStatus("Mikrofon-Zugriff nötig, um zu sprechen.", "is-error");
  }
  updateControls();
  renderParticipants();
}

async function toggleScreen() {
  if (!room || !screenSupported) return;
  const on = room.localParticipant.isScreenShareEnabled;
  try {
    await room.localParticipant.setScreenShareEnabled(!on, { audio: true });
    if (!on) attachNativeStopWatcher();
  } catch (e) {
    // Nutzer hat die Auswahl abgebrochen o. Ä. — kein harter Fehler.
  }
  updateControls();
  renderStage();
}

// Manche mobilen Browser feuern beim Sperren des Displays oder Wegwischen des
// geteilten Tabs kein sauberes LiveKit-Unpublish aus (bekannte Schwachstelle
// von getDisplayMedia auf Mobilgeräten) -- das native "ended"-Event des
// Browser-eigenen Freigabe-Streams fängt genau diesen Fall zusätzlich ab und
// beendet das Teilen sauber, statt dass es bei anderen als Leiche stehen bleibt.
function attachNativeStopWatcher() {
  const pub = room.localParticipant.getTrackPublication(LK.Track.Source.ScreenShare);
  const mst = pub && pub.track && pub.track.mediaStreamTrack;
  if (!mst) return;
  mst.addEventListener("ended", () => {
    if (room && room.localParticipant.isScreenShareEnabled) {
      room.localParticipant.setScreenShareEnabled(false).catch(() => {});
    }
    updateControls();
    renderStage();
  }, { once: true });
}

function updateControls() {
  if (!room) return;
  const micOn = room.localParticipant.isMicrophoneEnabled;
  $("mic-icon").textContent = micOn ? "🎙️" : "🔇";
  $("mic-label").textContent = micOn ? "Mikro an" : "Stumm";
  btnMic.classList.toggle("is-muted", !micOn);

  const sharing = room.localParticipant.isScreenShareEnabled;
  $("screen-label").textContent = sharing ? "Teilen beenden" : "Bildschirm teilen";
  btnScreen.classList.toggle("active", sharing);
}

function updateAudioUnlock() {
  const locked = room && room.canPlaybackAudio === false;
  btnAudioUnlock.classList.toggle("hidden", !locked);
}

async function unlockAudio() {
  if (room) { try { await room.startAudio(); } catch (_) {} }
  updateAudioUnlock();
}

// ------------------------------------------------------------------
// Aufnahme — lokal im Browser (MediaRecorder), rein clientseitig: kein
// Server, kein LiveKit-Egress. Mischt alle Stimmen (Web Audio) und nimmt,
// falls beim Start jemand teilt, den geteilten Bildschirm mit auf. Nur für
// Bearbeiter (isModerator). Alle im Raum werden per Data-Message sichtbar
// informiert, dass aufgenommen wird (Transparenz/Einwilligung).
// ------------------------------------------------------------------
const recordingSupported = typeof window.MediaRecorder !== "undefined" &&
  !!(window.AudioContext || window.webkitAudioContext);

function pickRecMime(hasVideo) {
  const cands = hasVideo
    ? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const c of cands) { try { if (MediaRecorder.isTypeSupported(c)) return c; } catch (_) {} }
  return "";
}

async function toggleRecording() {
  if (recorder) stopRecording();
  else await startRecording();
}

async function startRecording() {
  if (!room || recorder || !recordingSupported) return;
  if (!confirm("Alle Teilnehmer werden sichtbar darüber informiert, dass aufgenommen wird. Die Aufnahme wird auf deinem Gerät gespeichert. Jetzt starten?")) return;
  try {
    recAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    recDest = recAudioCtx.createMediaStreamDestination();
    recSources = new Map();
    if (recAudioCtx.state === "suspended") { try { await recAudioCtx.resume(); } catch (_) {} }
    participants().forEach(addParticipantAudioToMix);

    const videoTrack = currentScreenShareVideoTrack();
    const mimeType = pickRecMime(!!videoTrack);
    if (!mimeType) { flashStatus("Aufnahme-Format wird von diesem Browser nicht unterstützt.", "is-error"); stopAudioMix(); return; }
    const tracks = recDest.stream.getAudioTracks().slice();
    if (videoTrack) tracks.push(videoTrack);

    recChunks = [];
    recMimeType = mimeType;
    recorder = new MediaRecorder(new MediaStream(tracks), { mimeType });
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
    recorder.onstop = finishRecordingDownload;
    recorder.start(1000);
    broadcastRecording(true);
    updateRecordingUI();
    flashStatus(videoTrack ? "Aufnahme gestartet (Ton + Bildschirm)." : "Aufnahme gestartet (Ton).", "is-ok");
  } catch (e) {
    flashStatus("Aufnahme konnte nicht gestartet werden" + (e && e.message ? ": " + e.message : ""), "is-error");
    stopAudioMix();
    recorder = null;
    updateRecordingUI();
  }
}

function stopRecording() {
  if (recorder && recorder.state !== "inactive") { try { recorder.stop(); } catch (_) {} } // onstop -> Download
  recorder = null;
  broadcastRecording(false);
  updateRecordingUI();
  flashStatus("Aufnahme beendet — Datei wird heruntergeladen.", "is-ok");
}

function finishRecordingDownload() {
  const chunks = recChunks; recChunks = [];
  stopAudioMix();
  if (!chunks.length) return;
  const blob = new Blob(chunks, { type: recMimeType || "application/octet-stream" });
  const ext = recMimeType.indexOf("mp4") >= 0 ? "mp4" : recMimeType.indexOf("ogg") >= 0 ? "ogg" : "webm";
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "-");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Besprechung_" + stamp + "." + ext;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (_) {} }, 15000);
}

function addTrackToMix(mst, key) {
  if (!recAudioCtx || !mst || recSources.has(key)) return;
  try {
    const src = recAudioCtx.createMediaStreamSource(new MediaStream([mst]));
    src.connect(recDest);
    recSources.set(key, src);
  } catch (_) {}
}

function addParticipantAudioToMix(p) {
  const mic = p.getTrackPublication(LK.Track.Source.Microphone);
  if (mic && mic.track && mic.track.mediaStreamTrack) addTrackToMix(mic.track.mediaStreamTrack, "mic:" + p.identity);
  const sha = p.getTrackPublication(LK.Track.Source.ScreenShareAudio);
  if (sha && sha.track && sha.track.mediaStreamTrack) addTrackToMix(sha.track.mediaStreamTrack, "sha:" + p.identity);
}

function currentScreenShareVideoTrack() {
  const share = findScreenShare();
  const mst = share && share.track && share.track.mediaStreamTrack;
  return mst && mst.readyState === "live" ? mst : null;
}

function stopAudioMix() {
  if (recSources) { recSources.forEach((s) => { try { s.disconnect(); } catch (_) {} }); recSources = new Map(); }
  if (recAudioCtx) { try { recAudioCtx.close(); } catch (_) {} recAudioCtx = null; }
  recDest = null;
}

// Data-Message an alle: "ich nehme (nicht mehr) auf" — treibt das Banner bei
// den anderen. Braucht canPublishData (im Token gesetzt).
function broadcastRecording(active) {
  if (!room) return;
  try {
    const data = new TextEncoder().encode(JSON.stringify({ t: "rec", active: !!active, by: displayName(me) }));
    room.localParticipant.publishData(data, { reliable: true });
  } catch (_) {}
}

function onDataReceived(payload, participant) {
  try {
    const msg = JSON.parse(new TextDecoder().decode(payload));
    if (msg && msg.t === "rec") {
      remoteRecordingBy = msg.active ? (msg.by || "Jemand") : null;
      remoteRecordingId = msg.active && participant ? participant.identity : null;
      updateRecordingUI();
    }
  } catch (_) {}
}

function onParticipantConnected() {
  renderParticipants();
  if (recorder) broadcastRecording(true); // neu Hinzugekommene über die laufende Aufnahme informieren
}

function onParticipantDisconnected(p) {
  // Verlässt der Aufnehmende hart (ohne "stop"-Nachricht), Banner trotzdem entfernen.
  if (p && remoteRecordingId && p.identity === remoteRecordingId) {
    remoteRecordingBy = null;
    remoteRecordingId = null;
  }
  renderParticipants();
  updateRecordingUI();
}

function updateRecordingUI() {
  const amRecording = !!recorder;
  btnRecord.classList.toggle("hidden", !(isModerator && recordingSupported));
  btnRecord.classList.toggle("recording", amRecording);
  $("rec-icon").textContent = amRecording ? "⏹" : "⏺";
  $("rec-label").textContent = amRecording ? "Stoppen" : "Aufnehmen";
  const activeBy = amRecording ? "dir" : remoteRecordingBy;
  if (activeBy) {
    recBannerText.textContent = "Aufnahme läuft" + (activeBy === "dir" ? "" : " (durch " + activeBy + ")");
    recBanner.classList.remove("hidden");
  } else {
    recBanner.classList.add("hidden");
  }
}

// ------------------------------------------------------------------
// Helfer
// ------------------------------------------------------------------
function displayName(u) {
  if (!u) return "";
  const n = [u.vorname, u.nachname].filter(Boolean).join(" ").trim();
  return n || prettify(u.username || "");
}
function displayNameOf(p) {
  return p.name || prettify(p.identity || "");
}
function prettify(id) {
  return String(id).replace(/[._]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}
function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
const AVATAR_COLORS = ["#1a56a0", "#2d8c4e", "#c9941f", "#8e44ad", "#c0392b", "#16a085", "#d35400", "#2c3e50"];
function avatarColor(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function setLobbyError(msg) { $("lobby-error").textContent = msg || ""; }
let statusTimer = null;
function flashStatus(msg, cls) {
  saveStatus.textContent = msg;
  saveStatus.className = "header-status " + (cls || "");
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { saveStatus.textContent = ""; saveStatus.className = "header-status"; }, 4000);
}
