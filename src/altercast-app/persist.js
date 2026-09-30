/* ═══════════════════════════════════════════════════════════
   AlterCast — localStorage persistence
   Saves a whitelist of store keys + restores on boot.
═══════════════════════════════════════════════════════════ */

import { store } from "./store.js";

const STORAGE_KEY = "altercast.settings.v1";

const PERSIST_KEYS = [
  "lang", "theme", "currentAvatar", "emotion", "angle",
  "lightingPreset", "orbit", "mouseTrack", "particles", "gridBackground",
  "avatarGlow", "depth", "rim", "lightAngle", "breathSpeed", "volume",
  "muted", "isAIActive", "isVoiceOn",
  "aiBrain", "aiModel",
  "ollamaBaseUrl", "obsUrl", "twitchChannel",
];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    for (const k of PERSIST_KEYS) {
      if (k in data) store.set(k, data[k]);
    }
    return true;
  } catch (e) {
    console.warn("[persist] load failed:", e.message);
    return false;
  }
}

let saveTimer = null;
export function startAutosave() {
  /* Subscribe to all changes, debounce save */
  store.subscribeAny(() => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettings, 300);
  });
}

export function saveSettings() {
  try {
    const data = {};
    for (const k of PERSIST_KEYS) data[k] = store.get(k);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[persist] save failed:", e.message);
  }
}

export function clearSettings() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}
