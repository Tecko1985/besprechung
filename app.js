// ------------------------------------------------------------------
// Trainerraum — LiveKit-Sprach-/Screenshare-Client.
// Zustandslos: kein Nextcloud-Speicher. Ablauf = anmelden (Gateway) →
// Token holen (db.js/fetchLivekitToken) → LiveKit-Room verbinden → reden
// und optional Bildschirm teilen. Vorbild-Look: die übrigen Gateway-Apps.
// ------------------------------------------------------------------

const LK = window.LivekitClient || null;

let me = null;            // { username, vorname, nachname, ... } vom Gateway
let room = null;          // aktive LivekitClient.Room-Instanz (oder null)
const speaking = new Set(); // Identities, die gerade sprechen
let stageTrack = null;    // aktuell auf der Bühne gezeigter ScreenShare-Track
let stageSid = null;      // dessen trackSid (Doppel-Attach vermeiden)

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
  if (room) { try { await room.disconnect(); } catch (_) {} }
  // UI-Reset passiert im Disconnected-Event (onLeft).
}

function enterRoomUI() {
  lobby.classList.add("hidden");
  roomView.classList.remove("hidden");
  controls.classList.remove("hidden");
  updateControls();
  updateAudioUnlock();
  renderParticipants();
  renderStage();
}

function onLeft() {
  room = null;
  speaking.clear();
  clearStage();
  grid.innerHTML = "";
  audioSink.innerHTML = "";
  lobby.classList.remove("hidden");
  roomView.classList.add("hidden");
  controls.classList.add("hidden");
}

// ------------------------------------------------------------------
// LiveKit-Events
// ------------------------------------------------------------------
function wireRoomEvents(r) {
  const E = LK.RoomEvent;
  r.on(E.ParticipantConnected, renderParticipants)
   .on(E.ParticipantDisconnected, renderParticipants)
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
  return tile;
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
  if (!share) { clearStage(); return; }
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
}

function clearStage() {
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
  } catch (e) {
    // Nutzer hat die Auswahl abgebrochen o. Ä. — kein harter Fehler.
  }
  updateControls();
  renderStage();
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
