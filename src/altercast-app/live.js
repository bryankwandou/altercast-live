/* ═══════════════════════════════════════════════════════════
   AlterCast Live — Hologram Mode Controller
   Fullscreen avatar, no studio UI, floating rails.
   Like a Gatebox capsule running on your screen.
═══════════════════════════════════════════════════════════ */

import { store, AVATARS } from "./store.js";
import { EngineBridge } from "./engine-bridge.js";
import { Atmosphere } from "./atmosphere.js";
import { initTTS, speak, cancel as cancelTTS } from "./tts.js";
import { t, pickRandom, STRINGS } from "./i18n.js";

const $ = (id) => document.getElementById(id);

let bridge = null;
let atmosphere = null;
const drag = { active: false, sx: 0, sy: 0, rx: 0, ry: 0 };
const M = { tx: 0, ty: 0, x: 0, y: 0 };
let idleTimer = null;

async function boot() {
  /* Render rails (avatar swap buttons) */
  const rail = $("rail");
  Object.entries(AVATARS).forEach(([id, av], i) => {
    const div = document.createElement("div");
    div.className = "rail-av" + (i === 0 ? " active" : "");
    div.dataset.avatar = id;
    div.title = av.name;
    div.innerHTML = `<img src="${av.src}" alt="${av.name}">`;
    div.addEventListener("click", () => selectAvatar(id, div));
    rail.appendChild(div);
  });
  /* Upload custom */
  const addDiv = document.createElement("div");
  addDiv.className = "rail-av add";
  addDiv.innerHTML = "+";
  addDiv.title = "Upload foto";
  addDiv.addEventListener("click", () => $("upload-file").click());
  rail.appendChild(addDiv);

  /* Start screen */
  $("start-go").addEventListener("click", start);

  /* Dock buttons */
  $("btn-orbit").addEventListener("click", () => {
    store.set("orbit", !store.get("orbit"));
    $("btn-orbit").classList.toggle("active", store.get("orbit"));
  });
  $("btn-speak").addEventListener("click", () => {
    if (store.get("speaking")) cancelTTS();
    else {
      const lines = STRINGS[store.get("lang")]?.random_lines || [];
      if (lines.length) doSpeak(pickRandom(lines));
    }
  });
  $("btn-wave").addEventListener("click", () => {
    bridge.triggerEmotionTransient("wave", 2200);
    const lines = STRINGS[store.get("lang")]?.reactions_wave || [];
    if (lines.length && !store.get("speaking")) doSpeak(pickRandom(lines));
  });
  $("btn-excited").addEventListener("click", () => {
    bridge.triggerEmotionTransient("excited", 1800);
    const lines = STRINGS[store.get("lang")]?.reactions_excited || [];
    if (lines.length && !store.get("speaking")) doSpeak(pickRandom(lines));
  });
  $("btn-mute").addEventListener("click", () => {
    const m = !store.get("muted");
    store.set("muted", m);
    $("btn-mute").textContent = m ? "[MUTE]" : "[VOL]";
    $("btn-mute").classList.toggle("active", m);
    if (m) cancelTTS();
  });
  $("btn-light").addEventListener("click", () => {
    const presets = ["cinematic", "sunset", "studio", "neon", "hologram"];
    const cur = store.get("lightingPreset");
    const next = presets[(presets.indexOf(cur) + 1) % presets.length];
    store.set("lightingPreset", next);
    $("btn-light").classList.add("active");
    setTimeout(() => $("btn-light").classList.remove("active"), 400);
    pushHintFlash(`Pencahayaan: ${t(`light_${next === "cinematic" ? "cinematic" : next}`, store.get("lang"))}`);
  });
  $("btn-fs").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
  $("btn-studio").addEventListener("click", () => { window.location.href = "studio.html"; });

  /* Upload */
  $("upload-file").addEventListener("change", handleUpload);

  /* Auto-hide UI on idle */
  showUI();
  ["mousemove", "keydown", "touchstart", "click"].forEach(ev =>
    window.addEventListener(ev, showUI, { passive: true })
  );
}

async function start() {
  $("start-loading").style.display = "flex";
  setLoad("inisialisasi engine WebGL…");

  bridge = new EngineBridge($("webgl-canvas"));
  atmosphere = new Atmosphere($("bg-canvas"), $("particles-canvas"));

  setLoad("memuat avatar Keqing 3D + wajah asli…");
  await bridge.boot();

  setLoad("memulai TTS Bahasa Indonesia…");
  await initTTS();

  /* Set hologram preset by default for that authentic capsule look */
  store.set("lightingPreset", "hologram");

  setLoad("priming render loop…");
  await new Promise(r => setTimeout(r, 200));

  $("start").classList.add("hidden");

  bindDrag();
  bindClickReact();
  bindKeys();

  requestAnimationFrame(loop);

  setTimeout(() => {
    const lang = store.get("lang");
    const id = store.get("currentAvatar");
    const lines = STRINGS[lang]?.[`greeting_${id}`] || [];
    if (lines.length) doSpeak(pickRandom(lines));
  }, 800);
}

function setLoad(s) { $("load-step").textContent = s; }

function selectAvatar(id, btn) {
  store.set("currentAvatar", id);
  document.querySelectorAll(".rail-av[data-avatar]").forEach(c => c.classList.toggle("active", c === btn));
  $("name-text").textContent = AVATARS[id].name;
  $("name-meta").textContent = AVATARS[id].statusKey;
  if (!store.get("speaking")) {
    const lang = store.get("lang");
    const lines = STRINGS[lang]?.[`greeting_${id}`] || [];
    if (lines.length) setTimeout(() => doSpeak(pickRandom(lines)), 200);
  }
}

async function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const id = "custom_" + Date.now();
  try {
    await bridge.engine.addAvatar(id, url, (msg) => console.log("[Upload]", msg));
    const rail = $("rail");
    const div = document.createElement("div");
    div.className = "rail-av";
    div.dataset.avatar = id;
    div.innerHTML = `<img src="${url}" alt="">`;
    div.addEventListener("click", () => selectAvatar(id, div));
    rail.insertBefore(div, rail.querySelector(".rail-av.add"));
    selectAvatar(id, div);
    AVATARS[id] = { id, src: url, name: "Custom", statusKey: "CUSTOM AVATAR" };
  } catch (err) {
    console.error(err);
  }
}

function bindDrag() {
  const canvas = $("webgl-canvas");
  canvas.addEventListener("mousedown", (e) => {
    drag.active = true;
    drag.sx = e.clientX;
    drag.sy = e.clientY;
    drag.rx = bridge.engine.state.rotXTarget;
    drag.ry = bridge.engine.state.rotYTarget;
    if (store.get("orbit")) {
      store.set("orbit", false);
      $("btn-orbit").classList.remove("active");
    }
  });
  window.addEventListener("mousemove", (e) => {
    M.tx = e.clientX;
    M.ty = e.clientY;
    if (drag.active) {
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      bridge.setRotation(
        Math.max(-0.6, Math.min(0.6, drag.rx + dy * 0.005)),
        Math.max(-1.5, Math.min(1.5, drag.ry + dx * 0.006))
      );
    }
  });
  window.addEventListener("mouseup", () => drag.active = false);
}

function bindClickReact() {
  $("webgl-canvas").addEventListener("click", (e) => {
    if (Math.abs(e.clientX - drag.sx) > 5 || Math.abs(e.clientY - drag.sy) > 5) return;
    spawnRipple(e.clientX, e.clientY);
    if (!store.get("speaking")) {
      const kinds = ["wave", "excited", "surprised", "happy"];
      const k = pickRandom(kinds);
      bridge.triggerEmotionTransient(k, 1800);
      const lines = STRINGS[store.get("lang")]?.[`reactions_${k}`] || [];
      if (lines.length) doSpeak(pickRandom(lines));
    }
  });
}

function bindKeys() {
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    switch (e.key) {
      case " ":
        e.preventDefault();
        $("btn-speak").click();
        break;
      case "w": case "W": $("btn-wave").click(); break;
      case "o": case "O": $("btn-orbit").click(); break;
      case "e": case "E": $("btn-excited").click(); break;
      case "f": case "F": $("btn-fs").click(); break;
      case "l": case "L": $("btn-light").click(); break;
      case "Escape":
        if (store.get("speaking")) cancelTTS();
        break;
      case "1":
        document.querySelector('[data-avatar="yuna"]')?.click();
        break;
      case "2":
        document.querySelector('[data-avatar="aetheria"]')?.click();
        break;
    }
  });
}

function showUI() {
  document.body.classList.remove("idle");
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add("idle"), 4500);
}

function spawnRipple(x, y) {
  const r = document.createElement("div");
  r.className = "ripple";
  r.style.left = x + "px";
  r.style.top = y + "px";
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 800);
}

function pushHintFlash(text) {
  $("hint-flash").textContent = text;
  $("hint-flash").style.opacity = "1";
  clearTimeout(pushHintFlash._t);
  pushHintFlash._t = setTimeout(() => $("hint-flash").style.opacity = "0", 1800);
}

async function doSpeak(text) {
  const id = store.get("currentAvatar");
  $("bubble-tag").textContent = (AVATARS[id]?.name || "AlterCast").toUpperCase();
  $("bubble-text").textContent = text;
  $("bubble").classList.add("show");
  await speak(text);
  $("bubble").classList.remove("show");
}

function loop(ts) {
  requestAnimationFrame(loop);
  const t = ts / 1000;

  M.x += (M.tx - M.x) * 0.06;
  M.y += (M.ty - M.y) * 0.06;

  if (!drag.active && !store.get("orbit")) {
    const nx = (M.tx / window.innerWidth - 0.5) * 2;
    const ny = (M.ty / window.innerHeight - 0.5) * 2;
    bridge.engine.setHeadLook(ny * 0.20, nx * 0.35);
    bridge.engine.setEyeLook(nx * 0.8, ny * 0.6);
    bridge.setRotation(0, nx * 0.06);
  }

  atmosphere.render(t);
  bridge.render(t);

  /* Update FPS */
  $("fps").textContent = store.get("fps") + " fps";
  $("stat-fps").textContent = store.get("fps");
  $("stat-emo").textContent = store.get("emotion");
  $("stat-light").textContent = store.get("lightingPreset");
  $("stat-av").textContent = store.get("currentAvatar");
}

document.addEventListener("DOMContentLoaded", boot);
