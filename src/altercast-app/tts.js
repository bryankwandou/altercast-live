/* ═══════════════════════════════════════════════════════════
   AlterCast — TTS Engine (Web Speech API)
   • Indonesian voice prioritized
   • Mouth-pump animation envelope sync
   • Cancel + queue handling
═══════════════════════════════════════════════════════════ */

import { store } from "./store.js";

let voices = [];
let preferredVoice = null;
let audioReady = false;
let activeUtterance = null;

export async function initTTS() {
  if (typeof window === "undefined" || typeof speechSynthesis === "undefined") {
    audioReady = false;
    return false;
  }
  return new Promise((resolve) => {
    const load = () => {
      voices = speechSynthesis.getVoices();
      preferredVoice =
        voices.find(v => v.lang === "id-ID" || v.lang === "id_ID" || v.lang.startsWith("id")) ||
        voices.find(v => v.lang.startsWith("ms")) ||
        voices.find(v => v.default) ||
        voices[0] || null;
      audioReady = true;
      store.set("ttsVoice", preferredVoice ? { name: preferredVoice.name, lang: preferredVoice.lang } : null);
      resolve(true);
    };
    const v = speechSynthesis.getVoices();
    if (v && v.length) load();
    else {
      speechSynthesis.onvoiceschanged = load;
      setTimeout(() => { if (!audioReady) { audioReady = true; resolve(false); } }, 700);
    }
  });
}

export function getVoices() { return voices; }
export function getPreferredVoice() { return preferredVoice; }

export function setVoice(name) {
  const v = voices.find(x => x.name === name);
  if (v) {
    preferredVoice = v;
    store.set("ttsVoice", { name: v.name, lang: v.lang });
    return true;
  }
  return false;
}

export function cancel() {
  try { speechSynthesis.cancel(); } catch (e) {}
  if (activeUtterance) activeUtterance = null;
  store.set("speaking", false);
}

export function speak(text, opts = {}) {
  if (!text) return Promise.resolve();
  if (store.get("muted")) {
    return simulateMouth(text);
  }

  cancel();
  store.set("speaking", true);

  if (typeof speechSynthesis === "undefined") {
    return simulateMouth(text);
  }

  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (preferredVoice) u.voice = preferredVoice;
    u.lang = preferredVoice?.lang || "id-ID";
    u.rate = opts.rate ?? store.get("ttsRate");
    u.pitch = opts.pitch ?? store.get("ttsPitch");
    u.volume = opts.volume ?? (store.get("volume") / 100);

    let raf;
    u.onstart = () => {
      const start = performance.now();
      const tick = () => {
        if (!store.get("speaking")) return;
        const e = performance.now() - start;
        const open = .35 + .30 * Math.sin(e * .022) + .25 * Math.sin(e * .045);
        store.set("mouthOpen", Math.max(.15, Math.min(1, open)));
        raf = requestAnimationFrame(tick);
      };
      tick();
    };
    u.onboundary = () => store.set("mouthOpen", 1);
    u.onend = () => {
      if (raf) cancelAnimationFrame(raf);
      finish();
      resolve();
    };
    u.onerror = () => {
      if (raf) cancelAnimationFrame(raf);
      finish();
      resolve();
    };

    activeUtterance = u;
    try {
      speechSynthesis.speak(u);
    } catch (e) {
      simulateMouth(text).then(resolve);
    }
  });
}

function finish() {
  store.set("speaking", false);
  store.set("mouthOpen", 0);
  activeUtterance = null;
}

function simulateMouth(text) {
  return new Promise((resolve) => {
    const dur = Math.max(1200, text.length * 75);
    const start = performance.now();
    const tick = () => {
      const e = performance.now() - start;
      if (e < dur && store.get("speaking")) {
        const open = .35 + .30 * Math.sin(e * .022) + .25 * Math.sin(e * .045);
        store.set("mouthOpen", Math.max(.15, Math.min(1, open)));
        requestAnimationFrame(tick);
      } else {
        finish();
        resolve();
      }
    };
    tick();
  });
}
