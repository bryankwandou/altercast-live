/* ═══════════════════════════════════════════════════════════
   AlterCast Studio — Main Controller
   Builds the full Studio UI and wires EVERY control to the store.
   This is where the design meets the engine — every parameter
   here connects to a real engine parameter (no static images).
═══════════════════════════════════════════════════════════ */

import { store, AVATARS, EMOTIONS, ANGLES, LIGHTING_PRESETS, MOCK_CHAT_INITIAL } from "./store.js";
import { EngineBridge } from "./engine-bridge.js";
import { Atmosphere } from "./atmosphere.js";
import { initTTS, speak, cancel as cancelTTS } from "./tts.js";
import { initChat, appendChat, startLiveChat, stopLiveChat } from "./chat.js";
import { t, pickRandom, STRINGS } from "./i18n.js";
import { icons, injectIcon } from "./icons.js";
import { initFaceTracker, startCamera, stopCamera, isAvailable as faceAvailable } from "./face-tracking.js";
import { loadSettings, startAutosave } from "./persist.js";
import { initAIBrain, respond as aiRespond, getProvider as aiProvider, getModel as aiModel } from "./ai-brain.js";
import { connectOBS, disconnectOBS, obs as obsApi } from "./obs-ws.js";
import { connectTwitch, disconnectTwitch, isConnected as twitchConnected } from "./twitch-chat.js";

const $ = (id) => document.getElementById(id);

let bridge = null;
let atmosphere = null;
const drag = { active: false, sx: 0, sy: 0, rx: 0, ry: 0 };
const M = { tx: 0, ty: 0, x: 0, y: 0 };
let lastUserInteract = Date.now();

/* ── Boot ── */
export async function bootStudio() {
  /* Restore saved settings BEFORE rendering shell so toggles render correct state */
  loadSettings();

  const root = document.getElementById("studio-root");
  root.innerHTML = renderShell();
  injectAllIcons();

  const stage = $("stage");
  const canvas = $("webgl-canvas");
  bridge = new EngineBridge(canvas);
  atmosphere = new Atmosphere($("atmosphere-bg"), $("atmosphere-particles"));

  setLoadingStep("memuat avatar…");
  await bridge.boot();

  setLoadingStep("inisialisasi TTS Indonesia…");
  await initTTS();

  setLoadingStep("mendeteksi AI brain (Ollama)…");
  const aiInfo = await initAIBrain();
  updateAIStatusUI(aiInfo);

  setLoadingStep("memulai chat panel…");
  initChat($("chat-list"), $("chat-input"), $("chat-send"), handleAIRespond);

  /* autosave settings on any store change */
  startAutosave();

  bindNavigation();
  bindEmotionGrid();
  bindModeRadios();
  bindToggles();
  bindSliders();
  bindAvatarLibrary();
  bindAngleBar();
  bindLightingPresets();
  bindBottomBar();
  bindKeyboard();
  bindStageInteractions(stage, canvas);
  bindLangToggle();
  bindRightTabs();
  bindTwitchConnect();

  /* hide loader */
  $("studio-loading")?.classList.add("done");

  /* greet */
  setTimeout(() => {
    const avId = store.get("currentAvatar");
    const lang = store.get("lang");
    const lines = STRINGS[lang]?.[`greeting_${avId}`] || STRINGS.id[`greeting_${avId}`] || [];
    if (lines.length) doSpeak(pickRandom(lines));
  }, 700);

  /* start render loop */
  requestAnimationFrame(loop);

  /* subscribe to live state */
  store.subscribe("isLive", on => {
    if (on) startLiveChat();
    else stopLiveChat();
    const btn = $("btn-stream");
    btn?.classList.toggle("is-live", on);
    if (btn) btn.innerHTML = on
      ? `${icons.stop(14)}<span>${t("stop_stream", store.get("lang"))}</span>`
      : `${icons.play(14)}<span>${t("start_stream", store.get("lang"))}</span>`;
    pushToast(on ? t("toast_live", store.get("lang")) : t("toast_stopped", store.get("lang")), on ? "success" : "default");
  });

  store.subscribe("isAFKMode", on => {
    pushToast(on ? t("toast_afk_on", store.get("lang")) : t("toast_afk_off", store.get("lang")), "info");
  });

  /* fullscreen toggle reflect */
  document.addEventListener("fullscreenchange", () => {
    store.set("fullscreen", !!document.fullscreenElement);
  });

  /* AFK auto-speak — when AFK on + live, avatar randomly says random_lines every 15-30s */
  let afkTimer = null;
  function scheduleAFKSpeak() {
    clearTimeout(afkTimer);
    afkTimer = setTimeout(() => {
      if (store.get("isAFKMode") && store.get("isAIActive") && !store.get("speaking")) {
        const lines = STRINGS[store.get("lang")]?.random_lines || [];
        if (lines.length) doSpeak(pickRandom(lines));
      }
      if (store.get("isAFKMode")) scheduleAFKSpeak();
    }, 15000 + Math.random() * 15000);
  }
  store.subscribe("isAFKMode", on => { if (on) scheduleAFKSpeak(); else clearTimeout(afkTimer); });

  /* Viewer count auto-grow while live */
  setInterval(() => {
    if (store.get("isLive")) {
      const cur = store.get("viewerCount");
      store.set("viewerCount", cur + Math.floor(Math.random() * 3));
    }
  }, 3000);
}

/* ── HTML shell ── */
function renderShell() {
  const lang = store.get("lang");
  return `
    <canvas id="atmosphere-bg" class="atmosphere-bg"></canvas>
    <canvas id="atmosphere-particles" class="atmosphere-particles"></canvas>

    <!-- NAVBAR -->
    <nav class="navbar">
      <div class="brand" id="brand">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style="flex-shrink:0"><rect width="32" height="32" rx="8" fill="rgba(0,212,255,0.12)" stroke="rgba(0,212,255,0.3)" stroke-width="1"/><circle cx="16" cy="12" r="5" fill="none" stroke="#00D4FF" stroke-width="1.5"/><circle cx="21" cy="10" r="2" fill="none" stroke="#7C3AFF" stroke-width="1.2"/><path d="M9 24c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#00D4FF" stroke-width="1.5" stroke-linecap="round"/><path d="M23 20c0-1.66 1.34-3 3-3" stroke="#7C3AFF" stroke-width="1.2" stroke-linecap="round"/><circle cx="16" cy="12" r="2" fill="#00D4FF" opacity="0.8"/></svg>
        <span>Alter<b>Cast</b></span>
      </div>
      <div class="nav-divider"></div>
      <div class="nav-links" id="nav-links">
        <a class="nav-link" data-nav="home"><span data-i18n="nav_home">${t("nav_home", lang)}</span></a>
        <a class="nav-link active" data-nav="studio"><span data-i18n="nav_studio">${t("nav_studio", lang)}</span></a>
        <a class="nav-link" data-nav="avatar"><span data-i18n="nav_avatar">${t("nav_avatar", lang)}</span></a>
        <a class="nav-link" data-nav="live"><span data-i18n="nav_live">${t("nav_live", lang)}</span></a>
        <a class="nav-link" data-nav="overlay"><span data-i18n="nav_overlay">${t("nav_overlay", lang)}</span></a>
        <a class="nav-link" data-nav="dashboard"><span data-i18n="nav_dashboard">${t("nav_dashboard", lang)}</span></a>
      </div>
      <div class="navbar-right">
        <div class="lang-toggle" id="lang-toggle">
          <button data-lang="id" class="${lang === "id" ? "active" : ""}">[I][D] ID</button>
          <button data-lang="en" class="${lang === "en" ? "active" : ""}">[U][S] EN</button>
        </div>
        <span class="fps" id="fps-counter">— fps</span>
        <span class="online-badge"><span class="online-dot"></span>WEBGL</span>
        <span class="live-badge offline" id="live-badge"><span class="live-dot"></span>${t("status_offline", lang)}</span>
      </div>
    </nav>

    <!-- MAIN STUDIO GRID -->
    <div class="studio-grid">

      <!-- SIDEBAR LEFT -->
      <aside class="sidebar" id="sidebar">

        <div class="sidebar-section">
          <div class="section-title">${t("section_mode", lang)}</div>
          <div class="mode-list" id="mode-list">
            <div class="mode-item active" data-mode="active"><span class="dot"></span><span data-i18n="mode_active">${t("mode_active", lang)}</span></div>
            <div class="mode-item" data-mode="afk"><span class="dot"></span><span data-i18n="mode_afk">${t("mode_afk", lang)}</span></div>
            <div class="mode-item" data-mode="idle"><span class="dot"></span><span data-i18n="mode_idle">${t("mode_idle", lang)}</span></div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="section-title">${t("section_emotion", lang)}</div>
          <div class="emo-grid" id="emo-grid">
            ${Object.entries(EMOTIONS).map(([k, cfg]) => `
              <button class="emo-btn ${k === "idle" ? "active" : ""}" data-emo="${k}">
                <span class="emo-em">${cfg.emoji}</span>
                <span data-i18n="emo_${k}">${t(`emo_${k}`, lang)}</span>
              </button>
            `).join("")}
          </div>
        </div>

        <div class="sidebar-section">
          <div class="section-title">${t("section_avatar_library", lang)}</div>
          <div class="av-library" id="av-library">
            ${Object.entries(AVATARS).map(([id, av]) => `
              <div class="av-card ${id === "yuna" ? "active" : ""}" data-avatar="${id}">
                <div class="av-thumb"><img src="${av.src}" alt="${av.name}"></div>
                <div class="av-meta">
                  <div class="av-name">${av.name}</div>
                  <div class="av-tag">${av.tag}</div>
                </div>
              </div>
            `).join("")}
            <div class="av-card add" id="av-upload">
              <div class="add-plus">+</div>
              <div class="add-label">Generate dari foto<br>(upload .png/.jpg)</div>
              <input type="file" id="av-upload-file" accept="image/*" style="display:none">
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="section-title">${t("section_controls", lang)}</div>
          <div class="tog-row" id="ctrl-toggles">
            <div class="tog-item"><span>[MIC] ${t("ctrl_mic", lang)}</span><div class="tog" data-tog="isMicOn"></div></div>
            <div class="tog-item"><span>[VOL] ${t("ctrl_voice", lang)}</span><div class="tog on" data-tog="isVoiceOn"></div></div>
            <div class="tog-item"><span> ${t("ctrl_camera", lang)}</span><div class="tog" data-tog="isCameraOn"></div></div>
            <div class="tog-item"><span> ${t("ctrl_ai", lang)}</span><div class="tog on" data-tog="isAIActive"></div></div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="section-title">${t("section_ai", lang)}</div>
          <div class="ai-status">
            <div class="ai-row">
              <span class="k">${t("ai_model", lang)}</span>
              <span class="v" id="ai-model">qwen2.5:7b</span>
            </div>
            <div class="ai-row">
              <span class="k">${t("ai_latency", lang)}</span>
              <span class="v" id="ai-latency">~320ms</span>
            </div>
            <div class="ai-row">
              <span class="k">Status</span>
              <span class="ai-pill"><span class="d"></span>READY</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- CENTER STAGE -->
      <main class="stage" id="stage">
        <div class="stage-inner">
          <canvas id="webgl-canvas"></canvas>
          <div class="landmarks" id="landmarks"></div>
          <div class="ground-glow"></div>
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>
          <div class="viewmeta" id="view-name">CAM: FRONT · 0°/0°</div>
          <div class="viewmeta-bottom" data-i18n="drag_hint">${t("drag_hint", lang)}</div>
          <div class="bubble" id="bubble">
            <div class="bubble-text">
              <div class="bubble-tag" id="bubble-tag">YUNA</div>
              <div id="bubble-text">Halo!</div>
            </div>
          </div>
        </div>
        <div class="angle-bar" id="angle-bar">
          ${Object.entries(ANGLES).map(([k, a]) => `
            <button class="ang-btn ${k === "front" ? "active" : ""}" data-angle="${k}">${t(a.labelKey, lang)}</button>
          `).join("")}
        </div>
      </main>

      <!-- RIGHT PANEL -->
      <aside class="right-panel" id="right-panel">
        <div class="right-tabs">
          <div class="right-tab active" data-tab="chat">[MSG] ${t("chat_title", lang)}</div>
          <div class="right-tab" data-tab="controls"> ${t("section_controls", lang)}</div>
        </div>

        <!-- Chat pane -->
        <div class="right-pane chat-pane active" id="pane-chat">
          <div class="chat-header">
            <h3 data-i18n="chat_title">${t("chat_title", lang)}</h3>
            <div class="chat-counter">
              <b id="viewer-count">0</b> ${t("viewer_count", lang)}
            </div>
          </div>
          <div style="padding:8px 12px;border-bottom:1px solid var(--border-subtle);display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);letter-spacing:.08em;">TWITCH</span>
            <input type="text" id="twitch-channel" placeholder="channel..." value="${store.get("twitchChannel") || ""}"
                   style="flex:1;background:var(--bg-overlay);border:1px solid var(--border-subtle);border-radius:var(--r-sm);padding:5px 8px;font-size:11px;color:var(--text-primary);outline:none;font-family:var(--font-mono);">
            <button id="twitch-connect"
                    style="background:var(--accent-secondary-glow);border:1px solid var(--accent-secondary);color:var(--accent-secondary);padding:5px 10px;border-radius:var(--r-sm);font-size:11px;cursor:pointer;font-weight:600;">Connect</button>
          </div>
          <div class="chat-list" id="chat-list"></div>
          <div class="chat-typing" id="chat-typing" style="display:none">
            <span>${t("chat_typing", lang)}</span>
            <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
          </div>
          <div class="chat-input-wrap">
            <input type="text" class="chat-input" id="chat-input" placeholder="${t("chat_placeholder", lang)}">
            <button class="chat-send" id="chat-send">${t("chat_send", lang)}</button>
          </div>
        </div>

        <!-- Controls pane -->
        <div class="right-pane controls-pane" id="pane-controls">

          <div class="control-card">
            <div class="section-title">${t("section_render", lang)}</div>
            <div class="tog-row">
              <div class="tog-item"><span>${t("ctrl_orbit", lang)}</span><div class="tog" data-tog="orbit"></div></div>
              <div class="tog-item"><span>${t("ctrl_track", lang)}</span><div class="tog on" data-tog="mouseTrack"></div></div>
              <div class="tog-item"><span>${t("ctrl_landmarks", lang)}</span><div class="tog" data-tog="showLandmarks"></div></div>
              <div class="tog-item"><span>${t("ctrl_particles", lang)}</span><div class="tog on" data-tog="particles"></div></div>
              <div class="tog-item"><span>${t("ctrl_grid", lang)}</span><div class="tog on" data-tog="gridBackground"></div></div>
              <div class="tog-item"><span>${t("ctrl_glow", lang)}</span><div class="tog on" data-tog="avatarGlow"></div></div>
            </div>
          </div>

          <div class="control-card">
            <div class="section-title">${t("section_depth", lang)}</div>
            <div class="slider-item">
              <div class="slider-label"><span>${t("slider_depth", lang)}</span><span class="val" id="v-depth">0.40</span></div>
              <input type="range" min="0" max="100" value="40" data-slider="depth">
            </div>
            <div class="slider-item">
              <div class="slider-label"><span>${t("slider_rim", lang)}</span><span class="val" id="v-rim">0.55</span></div>
              <input type="range" min="0" max="100" value="55" data-slider="rim">
            </div>
            <div class="slider-item">
              <div class="slider-label"><span>${t("slider_light_angle", lang)}</span><span class="val" id="v-light">+45°</span></div>
              <input type="range" min="-90" max="90" value="45" data-slider="lightAngle">
            </div>
            <div class="slider-item">
              <div class="slider-label"><span>${t("slider_breath", lang)}</span><span class="val" id="v-breath">1.00x</span></div>
              <input type="range" min="50" max="200" value="100" data-slider="breathSpeed">
            </div>
          </div>

          <div class="control-card">
            <div class="section-title">${t("section_lighting", lang)}</div>
            <div class="lighting-presets" id="lighting-presets">
              ${Object.entries(LIGHTING_PRESETS).map(([k, p]) => `
                <button class="light-btn ${k === "cinematic" ? "active" : ""}" data-lp="${k}">
                  <span class="light-swatch" style="--c1:rgb(${p.rimC.map(c=>c*255|0).join(",")});--c2:rgb(${p.keyC.map(c=>c*255|0).join(",")})"></span>
                  <span>${t(p.nameKey, lang)}</span>
                </button>
              `).join("")}
            </div>
          </div>

        </div>
      </aside>
    </div>

    <!-- BOTTOM BAR -->
    <footer class="bottombar">
      <button class="btn primary" id="btn-stream">${icons.play(14)}<span>${t("start_stream", lang)}</span></button>
      <button class="btn" id="btn-record">${icons.record(14)}<span>${t("record", lang)}</span></button>
      <button class="btn cyan" id="btn-obs">${icons.monitor(14)}<span>${t("connect_obs", lang)}</span></button>
      <button class="btn violet" id="btn-afk">[MOON] <span>${t("enable_afk", lang)}</span></button>
      <button class="btn" id="btn-speak-now">${icons.message(14)}<span>${t("speak", lang)}</span></button>
      <div class="volume-control">
        <button class="icon-btn" id="btn-mute">${icons.vol(14)}</button>
        <input type="range" min="0" max="100" value="80" id="vol-slider">
        <button class="icon-btn" id="btn-fullscreen">${icons.fullscreen(14)}</button>
      </div>
    </footer>

    <!-- Loading -->
    <div id="studio-loading" class="toast-container" style="bottom:50%;right:50%;transform:translate(50%,50%);">
      <div class="toast" style="text-align:center;min-width:240px;">
        <div style="display:flex;align-items:center;gap:10px;justify-content:center;">
          <div style="width:18px;height:18px;border:2px solid rgba(0,212,255,.2);border-top-color:var(--accent-primary);border-radius:50%;animation:spin .8s linear infinite"></div>
          <span id="loading-step">memuat…</span>
        </div>
      </div>
    </div>

    <!-- Toasts -->
    <div class="toast-container" id="toast-container"></div>

    <!-- Hint -->
    <div class="hint-pill" id="hint-pill">${t("keyboard_hint", lang)}</div>
  `;
}

function injectAllIcons() { /* Icons are inlined via template strings */ }

function setLoadingStep(s) { const el = $("loading-step"); if (el) el.textContent = s; }

/* ──────────────────────────────────────
   BINDINGS — every UI control → store
   ────────────────────────────────────── */

function bindNavigation() {
  $("nav-links")?.addEventListener("click", (e) => {
    const link = e.target.closest("[data-nav]");
    if (!link) return;
    const nav = link.dataset.nav;
    const map = {
      home: "index.html",
      studio: "studio.html",
      avatar: "avatar.html",
      live: "live.html",
      overlay: "overlay.html",
      dashboard: "dashboard.html",
    };
    if (map[nav] && nav !== "studio") window.location.href = map[nav];
  });
  $("brand")?.addEventListener("click", () => window.location.href = "index.html");
}

function bindEmotionGrid() {
  $("emo-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-emo]");
    if (!btn) return;
    const emo = btn.dataset.emo;
    store.set("emotion", emo);
    document.querySelectorAll("[data-emo]").forEach(b => b.classList.toggle("active", b === btn));
    /* React speech */
    const reactionKey = `reactions_${emo}`;
    const lines = STRINGS[store.get("lang")]?.[reactionKey];
    if (lines && lines.length && !store.get("speaking")) {
      doSpeak(pickRandom(lines));
    }
  });
}

function bindModeRadios() {
  $("mode-list")?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-mode]");
    if (!item) return;
    const mode = item.dataset.mode;
    store.set("streamMode", mode);
    if (mode === "afk") store.set("isAFKMode", true);
    else store.set("isAFKMode", false);
    document.querySelectorAll("[data-mode]").forEach(i => i.classList.toggle("active", i === item));
  });
}

function bindToggles() {
  document.querySelectorAll("[data-tog]").forEach(el => {
    el.addEventListener("click", async () => {
      const key = el.dataset.tog;
      const newVal = !store.get(key);
      store.set(key, newVal);
      el.classList.toggle("on", newVal);
      if (key === "showLandmarks") $("landmarks")?.classList.toggle("on", newVal);
      if (key === "isAIActive") pushToast(newVal ? t("toast_ai_on", store.get("lang")) : t("toast_ai_off", store.get("lang")), "info");
      if (key === "isMicOn") pushToast(newVal ? t("toast_mic_on", store.get("lang")) : t("toast_mic_off", store.get("lang")), "info");
      if (key === "isCameraOn") {
        if (newVal) {
          pushToast("Mengaktifkan webcam + face tracking...", "info");
          const okMP = await initFaceTracker();
          if (!okMP) {
            pushToast("MediaPipe gagal dimuat (perlu internet). Pakai mouse track saja.", "warning");
            store.set("isCameraOn", false);
            el.classList.remove("on");
            return;
          }
          const okCam = await startCamera();
          if (!okCam) {
            pushToast("Akses webcam ditolak. Cek izin browser.", "error");
            store.set("isCameraOn", false);
            el.classList.remove("on");
            return;
          }
          pushToast("Face tracking aktif. Avatar mengikuti wajah kamu!", "success");
          /* Disable mouse track so face takes over */
          store.set("mouseTrack", false);
          document.querySelector('[data-tog="mouseTrack"]')?.classList.remove("on");
        } else {
          stopCamera();
          pushToast("Webcam dimatikan.", "info");
        }
      }
    });
  });
}

function bindSliders() {
  document.querySelectorAll("[data-slider]").forEach(input => {
    input.addEventListener("input", () => {
      const key = input.dataset.slider;
      const raw = +input.value;
      let v = raw;
      if (key === "depth" || key === "rim") v = raw / 100;
      else if (key === "breathSpeed") v = raw / 100;
      store.set(key, v);

      const idMap = { depth: "v-depth", rim: "v-rim", lightAngle: "v-light", breathSpeed: "v-breath" };
      const el = $(idMap[key]);
      if (el) {
        if (key === "depth" || key === "rim") el.textContent = v.toFixed(2);
        else if (key === "lightAngle") el.textContent = (raw >= 0 ? "+" : "") + raw + "°";
        else if (key === "breathSpeed") el.textContent = v.toFixed(2) + "x";
      }
      if (key === "lightAngle") {
        const rad = raw * Math.PI / 180;
        if (bridge?.engine) {
          bridge.engine.state.keyDir = [Math.sin(rad), 0.9, Math.cos(rad) * 1.2];
        }
      }
    });
  });
}

function bindAvatarLibrary() {
  document.querySelectorAll("[data-avatar]").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.avatar;
      store.set("currentAvatar", id);
      document.querySelectorAll("[data-avatar]").forEach(c => c.classList.toggle("active", c === card));
      pushToast(t("toast_avatar_changed", store.get("lang")), "info");
      const lang = store.get("lang");
      const lines = STRINGS[lang]?.[`greeting_${id}`] || [];
      if (lines.length) setTimeout(() => doSpeak(pickRandom(lines)), 200);
    });
  });
  $("av-upload")?.addEventListener("click", () => $("av-upload-file")?.click());
  $("av-upload-file")?.addEventListener("change", handleAvatarUpload);
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const id = "custom_" + Date.now();
  try {
    pushToast("Memproses foto…", "info");
    await bridge.engine.addAvatar(id, url, {
      bgThreshold: 0.96,
      faceScaleY: 1.0,
      samples: { skin: [[.5,.4],[.5,.5]], hair: [[.5,.2]], body: [[.5,.85]] },
    });
    /* add card */
    const lib = $("av-library");
    const card = document.createElement("div");
    card.className = "av-card";
    card.dataset.avatar = id;
    card.innerHTML = `
      <div class="av-thumb"><img src="${url}" alt=""></div>
      <div class="av-meta"><div class="av-name">Custom</div><div class="av-tag">user upload</div></div>
    `;
    card.addEventListener("click", () => {
      store.set("currentAvatar", id);
      document.querySelectorAll("[data-avatar]").forEach(c => c.classList.toggle("active", c === card));
    });
    lib?.insertBefore(card, $("av-upload"));
    store.set("currentAvatar", id);
    document.querySelectorAll("[data-avatar]").forEach(c => c.classList.toggle("active", c === card));
    pushToast("Avatar custom siap!", "success");
  } catch (err) {
    console.error(err);
    pushToast("Gagal memproses foto: " + err.message, "error");
  }
}

function bindAngleBar() {
  $("angle-bar")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-angle]");
    if (!btn) return;
    const a = btn.dataset.angle;
    store.set("angle", a);
    document.querySelectorAll("[data-angle]").forEach(b => b.classList.toggle("active", b === btn));
    const cfg = ANGLES[a];
    if (cfg) {
      $("view-name").textContent = `CAM: ${t(cfg.labelKey, store.get("lang")).toUpperCase()} · ${(cfg.rx * 180 / Math.PI).toFixed(0)}°/${(cfg.ry * 180 / Math.PI).toFixed(0)}°`;
    }
    if (store.get("orbit")) {
      store.set("orbit", false);
      document.querySelector('[data-tog="orbit"]')?.classList.remove("on");
    }
  });
}

function bindLightingPresets() {
  $("lighting-presets")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lp]");
    if (!btn) return;
    const p = btn.dataset.lp;
    store.set("lightingPreset", p);
    document.querySelectorAll("[data-lp]").forEach(b => b.classList.toggle("active", b === btn));
  });
}

function bindBottomBar() {
  $("btn-stream")?.addEventListener("click", () => {
    const live = !store.get("isLive");
    store.set("isLive", live);
    /* update live badge */
    const badge = $("live-badge");
    if (badge) {
      badge.classList.toggle("offline", !live);
      /* Replace text after the dot, keeping the dot span intact */
      const dot = badge.querySelector(".live-dot");
      badge.textContent = "";
      if (dot) badge.appendChild(dot);
      badge.appendChild(document.createTextNode(live ? t("status_live", store.get("lang")) : t("status_offline", store.get("lang"))));
    }
  });
  $("btn-record")?.addEventListener("click", () => {
    pushToast("Rekaman dimulai (mock)", "info");
  });
  $("btn-obs")?.addEventListener("click", async () => {
    const wasOn = store.get("isOBSConnected");
    if (wasOn) {
      disconnectOBS();
      pushToast(t("toast_obs_disconnected", store.get("lang")), "default");
      return;
    }
    const url = prompt("OBS WebSocket URL:", store.get("obsUrl") || "ws://localhost:4455");
    if (!url) return;
    const pw = prompt("OBS WebSocket password (kosongkan kalau tidak ada):", "");
    store.set("obsUrl", url);
    pushToast("Connecting ke OBS...", "info");
    try {
      await connectOBS({ url, password: pw || "" });
      pushToast(t("toast_obs_connected", store.get("lang")), "success");
      /* Optional: fetch scene list */
      try {
        const scenes = await obsApi.getSceneList();
        console.log("[OBS] Scenes:", scenes.scenes?.map(s => s.sceneName).join(", "));
      } catch (e) {}
    } catch (err) {
      pushToast("Gagal konek OBS: " + err.message + " (pastikan OBS jalan + WebSocket aktif)", "error");
    }
  });
  $("btn-afk")?.addEventListener("click", () => {
    const on = !store.get("isAFKMode");
    store.set("isAFKMode", on);
    document.querySelector('[data-mode="afk"]')?.click();
  });
  $("btn-speak-now")?.addEventListener("click", () => {
    if (store.get("speaking")) { cancelTTS(); return; }
    const lines = STRINGS[store.get("lang")]?.random_lines || [];
    if (lines.length) doSpeak(pickRandom(lines));
  });
  $("btn-mute")?.addEventListener("click", () => {
    const m = !store.get("muted");
    store.set("muted", m);
    $("btn-mute").innerHTML = m ? icons.volX(14) : icons.vol(14);
    $("btn-mute").classList.toggle("active", m);
    if (m) cancelTTS();
  });
  $("vol-slider")?.addEventListener("input", (e) => {
    store.set("volume", +e.target.value);
  });
  $("btn-fullscreen")?.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
}

function bindKeyboard() {
  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    switch (e.key) {
      case " ":
        e.preventDefault();
        if (store.get("speaking")) cancelTTS();
        else {
          const lines = STRINGS[store.get("lang")]?.random_lines || [];
          if (lines.length) doSpeak(pickRandom(lines));
        }
        break;
      case "w": case "W":
        store.set("emotion", "wave");
        document.querySelector('[data-emo="wave"]')?.click();
        break;
      case "o": case "O":
        store.set("orbit", !store.get("orbit"));
        document.querySelector('[data-tog="orbit"]')?.classList.toggle("on", store.get("orbit"));
        break;
      case "1":
        document.querySelector('[data-avatar="yuna"]')?.click();
        break;
      case "2":
        document.querySelector('[data-avatar="aetheria"]')?.click();
        break;
      case "f": case "F":
        $("btn-fullscreen")?.click();
        break;
      case "Escape":
        if (store.get("speaking")) cancelTTS();
        hideBubble();
        break;
    }
  });
}

function bindStageInteractions(stage, canvas) {
  /* Drag rotate */
  canvas.addEventListener("mousedown", (e) => {
    drag.active = true;
    drag.sx = e.clientX;
    drag.sy = e.clientY;
    drag.rx = bridge.engine.state.rotXTarget;
    drag.ry = bridge.engine.state.rotYTarget;
    stage.classList.add("dragging");
    if (store.get("orbit")) {
      store.set("orbit", false);
      document.querySelector('[data-tog="orbit"]')?.classList.remove("on");
    }
  });
  window.addEventListener("mousemove", (e) => {
    M.tx = e.clientX;
    M.ty = e.clientY;
    if (drag.active) {
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      bridge.setRotation(
        Math.max(-0.8, Math.min(0.8, drag.rx + dy * 0.005)),
        Math.max(-1.4, Math.min(1.4, drag.ry + dx * 0.006))
      );
    }
    lastUserInteract = Date.now();
  });
  window.addEventListener("mouseup", () => {
    drag.active = false;
    stage.classList.remove("dragging");
  });

  /* Click react */
  canvas.addEventListener("click", (e) => {
    if (Math.abs(e.clientX - drag.sx) > 5 || Math.abs(e.clientY - drag.sy) > 5) return;
    spawnRipple(e.clientX, e.clientY);
    if (!store.get("speaking")) {
      const kind = pickRandom(["wave", "excited", "surprised", "happy"]);
      document.querySelector(`[data-emo="${kind}"]`)?.click();
    }
  });

  /* Wheel zoom (camera distance via FOV) */
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    /* simple zoom via head scale */
    const cur = bridge.engine.state;
    /* no-op for now — we have orbit/angle controls */
  }, { passive: false });
}

function bindLangToggle() {
  $("lang-toggle")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    const newLang = b.dataset.lang;
    store.set("lang", newLang);
    /* re-render */
    bootStudio();
  });
}

function bindTwitchConnect() {
  const btn = $("twitch-connect");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (twitchConnected()) {
      disconnectTwitch();
      btn.textContent = "Connect";
      btn.style.background = "var(--accent-secondary-glow)";
      pushToast("Twitch chat terputus.", "default");
      return;
    }
    const ch = $("twitch-channel").value.trim().replace(/^#/, "").toLowerCase();
    if (!ch) { pushToast("Masukkan nama channel Twitch dulu.", "warning"); return; }
    pushToast(`Menyambung ke twitch.tv/${ch}...`, "info");
    try {
      await connectTwitch(ch, (msg) => {
        appendChat({
          id: Date.now() + Math.random(),
          user: msg.user,
          color: msg.color,
          text: msg.text,
        });
        /* if AFK + AI active, auto respond */
        if (store.get("isAFKMode") && store.get("isAIActive") && Math.random() < 0.25) {
          setTimeout(() => handleAIRespond(msg.text), 800);
        }
      });
      btn.textContent = "Disconnect";
      btn.style.background = "var(--status-live)";
      btn.style.borderColor = "var(--status-live)";
      btn.style.color = "white";
      pushToast(`Connected: twitch.tv/${ch}`, "success");
      appendChat({ id: Date.now(), user: "system", color: "#00FF88", text: `Connected to twitch.tv/${ch}`, isAI: true });
    } catch (err) {
      pushToast("Gagal konek Twitch: " + err.message, "error");
    }
  });
}

function bindRightTabs() {
  document.querySelectorAll(".right-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".right-tab").forEach(t => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".right-pane").forEach(p => p.classList.toggle("active", p.id === "pane-" + target));
    });
  });
}

/* ──────────────────────────────────────
   SPEAK + BUBBLE
   ────────────────────────────────────── */
async function doSpeak(text) {
  const id = store.get("currentAvatar");
  const av = AVATARS[id];
  showBubble(av?.name || "AlterCast", text);
  await speak(text);
  hideBubble();
}

function showBubble(tag, text) {
  $("bubble-tag").textContent = String(tag).toUpperCase();
  $("bubble-text").textContent = text;
  $("bubble")?.classList.add("show");
}
function hideBubble() {
  $("bubble")?.classList.remove("show");
}

async function handleAIRespond(userText) {
  const typingEl = $("chat-typing");
  if (typingEl) typingEl.style.display = "flex";
  try {
    const reply = await aiRespond(userText);
    if (typingEl) typingEl.style.display = "none";
    appendChat({
      id: Date.now(),
      user: AVATARS[store.get("currentAvatar")].name,
      color: "#00D4FF",
      text: reply,
      isAI: true,
    });
    doSpeak(reply);
    /* Update AI latency pill */
    updateAILatency();
  } catch (e) {
    if (typingEl) typingEl.style.display = "none";
    console.error("[AI] handleAIRespond error:", e);
  }
}

function updateAIStatusUI(info) {
  const modelEl = $("ai-model");
  const latencyEl = $("ai-latency");
  if (modelEl) modelEl.textContent = info?.model || (info?.provider === "mock" ? "mock (Ollama not running)" : "—");
  if (latencyEl) latencyEl.textContent = info?.provider === "ollama" ? "real LLM" : "~80ms (mock)";
}

function updateAILatency() {
  const latencyEl = $("ai-latency");
  if (latencyEl) latencyEl.textContent = `~${store.get("aiLatency")}ms`;
}

/* ──────────────────────────────────────
   TOAST + RIPPLE
   ────────────────────────────────────── */
function pushToast(message, type = "default") {
  const c = $("toast-container");
  if (!c) return;
  const id = Date.now() + Math.random();
  const div = document.createElement("div");
  div.className = "toast " + type;
  div.textContent = message;
  c.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function spawnRipple(x, y) {
  const r = document.createElement("div");
  r.className = "ripple";
  r.style.left = x + "px";
  r.style.top = y + "px";
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 800);
}

/* ──────────────────────────────────────
   RENDER LOOP — drives engine + atmosphere + reactive UI
   ────────────────────────────────────── */
function loop(ts) {
  requestAnimationFrame(loop);
  const t = ts / 1000;

  /* Smooth mouse */
  M.x += (M.tx - M.x) * 0.06;
  M.y += (M.ty - M.y) * 0.06;

  /* Mouse-follow head + eye when track is on AND face tracking is OFF.
     Face tracking writes directly to store.headLook/eyeLook — engine reads from there. */
  const cameraOn = store.get("isCameraOn");
  if (cameraOn) {
    /* Sync engine to store values written by face tracker */
    const hl = store.get("headLook");
    const el = store.get("eyeLook");
    bridge.engine.setHeadLook(hl.x, hl.y);
    bridge.engine.setEyeLook(el.x, el.y);
  } else if (store.get("mouseTrack") && !drag.active && !store.get("orbit")) {
    const ang = ANGLES[store.get("angle")] || ANGLES.front;
    const nx = (M.tx / window.innerWidth - 0.5) * 2;
    const ny = (M.ty / window.innerHeight - 0.5) * 2;
    bridge.setRotation(
      ang.rx + ny * 0.07,
      ang.ry + nx * 0.18
    );
    bridge.engine.setHeadLook(ny * 0.20, nx * 0.35);
    bridge.engine.setEyeLook(nx * 0.8, ny * 0.6);
  }

  atmosphere.render(t);
  bridge.render(t);

  /* FPS update */
  const fpsEl = $("fps-counter");
  if (fpsEl) fpsEl.textContent = store.get("fps") + " fps";

  /* Viewer count */
  const vc = $("viewer-count");
  if (vc) vc.textContent = store.get("viewerCount").toLocaleString("id-ID");

  /* Update angle viewfinder if rotation changed via drag */
  if (drag.active) {
    const r = bridge.engine.getRotation();
    $("view-name").textContent = `CAM: FREE · ${(r.x * 180 / Math.PI).toFixed(0)}°/${(r.y * 180 / Math.PI).toFixed(0)}°`;
  }
}

/* ── Auto-boot when DOM ready ── */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootStudio);
} else {
  bootStudio();
}
