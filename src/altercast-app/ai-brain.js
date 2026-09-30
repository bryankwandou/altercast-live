/* ═══════════════════════════════════════════════════════════
   AlterCast — AI Brain
   Local Ollama detection + Indonesian mock fallback.
   NO third-party cloud endpoints. NO API keys. NO proxy.
   Only talks to user-configured Ollama URL (default: localhost:11434).
═══════════════════════════════════════════════════════════ */

import { store } from "./store.js";
import { pickRandom } from "./i18n.js";

const SYSTEM_PROMPT_ID = `Kamu adalah host AI streaming avatar di platform AlterCast.
Karakter kamu: ramah, ceria, pakai bahasa Indonesia sehari-hari, kadang slang ringan.
Tugas kamu menemani streamer dan ngobrol dengan viewer.
Balasan singkat (maksimal 2 kalimat, total < 200 karakter).
Tidak pakai emoji berlebihan. Tidak formal.`;

let provider = null; // 'ollama' | 'mock'
let ollamaUrl = "http://localhost:11434";
let ollamaModel = "qwen2.5:7b";

export async function initAIBrain() {
  ollamaUrl = store.get("ollamaBaseUrl") || "http://localhost:11434";
  ollamaModel = store.get("aiModel") || "qwen2.5:7b";

  /* Hanya boleh URL localhost / 127.0.0.1 / LAN — block external endpoints */
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(ollamaUrl)) {
    console.warn("[AI] Ollama URL bukan localhost/LAN — diabaikan demi keamanan.");
    ollamaUrl = "http://localhost:11434";
    store.set("ollamaBaseUrl", ollamaUrl);
  }

  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(`${ollamaUrl}/api/tags`, { signal: ctl.signal });
    if (r.ok) {
      const data = await r.json();
      const models = (data.models || []).map(m => m.name);
      if (models.length) {
        if (!models.find(m => m.startsWith(ollamaModel.split(":")[0]))) {
          ollamaModel = models[0];
        }
        provider = "ollama";
        store.set("aiBrain", "local");
        store.set("aiModel", ollamaModel);
        store.set("aiLatency", 0);
        console.log(`[AI] Ollama active: ${ollamaModel}`);
        return { provider: "ollama", model: ollamaModel, models };
      }
    }
  } catch (e) {
    /* Ollama tidak jalan — fallback ke mock */
  }

  provider = "mock";
  store.set("aiBrain", "mock");
  store.set("aiLatency", 50);
  console.log("[AI] No local LLM detected → mock Indonesian responses");
  return { provider: "mock", model: null };
}

export async function respond(userText, opts = {}) {
  const startTs = performance.now();
  let reply = "";
  try {
    if (provider === "ollama") {
      reply = await respondViaOllama(userText, opts);
    } else {
      reply = mockReply(userText);
      await new Promise(r => setTimeout(r, 400 + Math.random() * 800));
    }
  } catch (e) {
    console.warn("[AI] respond failed, falling back to mock:", e.message);
    reply = mockReply(userText);
  }
  const latency = Math.round(performance.now() - startTs);
  store.set("aiLatency", latency);
  return reply || mockReply(userText);
}

async function respondViaOllama(text, opts) {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), opts.timeoutMs || 10000);
  try {
    const r = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        options: { temperature: 0.7, num_predict: 80 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT_ID },
          { role: "user", content: text },
        ],
      }),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return (data.message?.content || "").trim().slice(0, 280);
  } finally {
    clearTimeout(timeout);
  }
}

function mockReply(text) {
  const lower = text.toLowerCase();
  if (/halo|hai|hi\b|hello/.test(lower)) return pickRandom([
    "Halo juga! Apa kabar?",
    "Hai, senang ngobrol bareng kamu.",
    "Yo! Lagi ngapain nih?",
  ]);
  if (/nama|siapa kamu/.test(lower)) return pickRandom([
    "Aku host AI dari AlterCast.",
    "Panggil aja sesuai nama avatar yang lagi aktif ya.",
  ]);
  if (/donasi|donate|gift/.test(lower)) return pickRandom([
    "Wah makasih banget!",
    "Aaa makasih ya, terbaik!",
  ]);
  if (/harga|berapa/.test(lower)) return pickRandom([
    "Cek di keranjang kuning ya kak, lengkap ada di sana.",
    "Tinggal tap link keranjang kuning untuk lihat harga.",
  ]);
  if (/ready|stok/.test(lower)) return pickRandom([
    "Masih ready kak, buruan checkout.",
    "Stok tinggal dikit, langsung tap aja!",
  ]);
  if (/ongkir/.test(lower)) return pickRandom([
    "Ada gratis ongkir kak, claim voucher dulu ya.",
    "Bisa free ongkir, cek vouchernya di keranjang.",
  ]);
  if (/sehat|sakit/.test(lower)) return pickRandom([
    "Semoga sehat-sehat ya!",
    "Jangan lupa istirahat lho.",
  ]);
  return pickRandom([
    `Hmm, kamu bilang "${text.slice(0, 30)}". Menarik!`,
    "Oke aku ngerti maksudmu.",
    "Coba ceritakan lebih lengkap dong.",
    "Aku setuju sih.",
    "Wah, itu seru!",
  ]);
}

export function getProvider() { return provider; }
export function getModel()    { return ollamaModel; }
export function getOllamaUrl(){ return ollamaUrl; }

export function setOllamaUrl(url) {
  /* Same allowlist enforcement at runtime */
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(url)) {
    console.warn("[AI] URL ditolak (bukan localhost/LAN):", url);
    return false;
  }
  ollamaUrl = url;
  store.set("ollamaBaseUrl", url);
  return true;
}
