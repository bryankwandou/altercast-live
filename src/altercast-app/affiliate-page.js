/* ═══════════════════════════════════════════════════════════
   AlterCast Affiliate Page Controller
   TikTok-style 9:16 live layout + auto-pitch + chat + alerts
═══════════════════════════════════════════════════════════ */

import { EngineBridge } from "./engine-bridge.js";
import { Atmosphere } from "./atmosphere.js";
import { initTTS, speak, cancel as cancelTTS } from "./tts.js";
import { store, AVATARS } from "./store.js";
import { pickRandom, STRINGS } from "./i18n.js";
import { loadSettings, startAutosave } from "./persist.js";
import { initAIBrain, respond as aiRespond } from "./ai-brain.js";
import {
  loadProducts, getProducts, getCurrentProduct, getCurrentIndex, setCurrentIndex,
  addProduct, removeProduct, updateProduct,
  startSession, stopSession, isActive,
  reactToFollow, reactToGift, reactToShare, answerQuestion,
  getStats, DEFAULT_PRODUCTS,
} from "./affiliate.js";

const $ = id => document.getElementById(id);

let bridge = null;
let atmosphere = null;
let speakQueue = [];
let isSpeaking = false;

async function boot() {
  loadSettings();
  loadProducts();

  /* If empty, seed defaults */
  if (!getProducts().length) {
    DEFAULT_PRODUCTS.forEach(p => addProduct(p));
  }

  bridge = new EngineBridge($("aff-canvas"));
  atmosphere = new Atmosphere($("aff-bg"), $("aff-particles"));
  await bridge.boot();
  await initTTS();
  await initAIBrain();

  /* Default to hologram lighting for that "broadcast" feel */
  store.set("lightingPreset", "cinematic");
  startAutosave();

  renderProductList();
  renderPinnedProduct();
  renderProductStrip();
  renderSessionControls();
  renderChatSeed();
  bindUI();

  /* Mouse follow */
  const M = { tx: 0, ty: 0 };
  window.addEventListener("mousemove", e => { M.tx = e.clientX; M.ty = e.clientY; });

  /* Initial greeting */
  setTimeout(() => {
    const av = AVATARS[store.get("currentAvatar")];
    enqueueSpeak(`Halo guys! Aku ${av.name}, host AI dari AlterCast. Hari ini kita bakal ngeliat produk-produk keren ya!`);
  }, 600);

  function loop(ts) {
    requestAnimationFrame(loop);
    const t = ts / 1000;
    const nx = (M.tx / window.innerWidth - 0.5) * 2;
    const ny = (M.ty / window.innerHeight - 0.5) * 2;
    bridge.engine.setHeadLook(ny * 0.15, nx * 0.25);
    bridge.engine.setEyeLook(nx * 0.7, ny * 0.5);
    atmosphere.render(t);
    bridge.render(t);

    /* Update FPS pill */
    const fpsEl = $("stat-fps");
    if (fpsEl) fpsEl.textContent = store.get("fps");
  }
  requestAnimationFrame(loop);

  /* Stats refresh every 2s */
  setInterval(() => {
    const s = getStats();
    if ($("stat-pitches")) $("stat-pitches").textContent = s.pitchesSpoken;
    if ($("stat-gifts")) $("stat-gifts").textContent = s.giftsReceived;
    if ($("stat-followers")) $("stat-followers").textContent = s.followersWelcomed;
    if ($("stat-duration")) {
      const m = Math.floor(s.durationMs / 60000);
      const sec = Math.floor((s.durationMs % 60000) / 1000);
      $("stat-duration").textContent = `${m}:${String(sec).padStart(2, "0")}`;
    }
  }, 1000);
}

/* ──────────────── UI Builders ──────────────── */

function renderProductList() {
  const list = $("product-list");
  list.innerHTML = "";
  const products = getProducts();
  const curIdx = getCurrentIndex();
  products.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "product-list-item" + (i === curIdx ? " active" : "");
    div.innerHTML = `
      <img src="${p.image}" alt="">
      <div class="pli-info">
        <div class="pli-name">${p.name}</div>
        <div class="pli-price">Rp ${p.price.toLocaleString("id-ID")}</div>
        <div class="pli-stock">Stok: ${p.stock}</div>
      </div>
      <div class="pli-remove" data-remove="${p.id}">×</div>
    `;
    div.addEventListener("click", (e) => {
      if (e.target.dataset.remove) return;
      setCurrentIndex(i);
      renderProductList();
      renderPinnedProduct();
      renderProductStrip();
    });
    div.querySelector("[data-remove]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(`Hapus "${p.name}"?`)) return;
      removeProduct(p.id);
      renderProductList();
      renderPinnedProduct();
      renderProductStrip();
    });
    list.appendChild(div);
  });
}

function renderPinnedProduct() {
  const wrap = $("pinned-product");
  const p = getCurrentProduct();
  if (!p) { wrap.style.display = "none"; return; }
  wrap.style.display = "flex";
  wrap.innerHTML = `
    ${p.voucher ? `<div class="pp-voucher">${p.voucher}</div>` : ""}
    <img src="${p.image}" alt="">
    <div class="pp-info">
      <div class="pp-name">${p.name}</div>
      <div class="pp-price">
        <span class="now">Rp ${p.price.toLocaleString("id-ID")}</span>
        ${p.originalPrice && p.originalPrice > p.price ? `<span class="was">Rp ${p.originalPrice.toLocaleString("id-ID")}</span>` : ""}
      </div>
    </div>
    <a class="pp-cta" href="${p.link}" target="_blank">[SHOP] CHECKOUT</a>
  `;
}

function renderProductStrip() {
  const strip = $("product-strip");
  strip.innerHTML = "";
  const products = getProducts();
  const curIdx = getCurrentIndex();
  products.forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "ps-item" + (i === curIdx ? " active" : "");
    item.innerHTML = `
      <img src="${p.image}" alt="">
      <div class="ps-text">
        <div class="ps-name">${p.name}</div>
        <div class="ps-price">Rp ${p.price.toLocaleString("id-ID")}</div>
      </div>
    `;
    item.addEventListener("click", () => {
      setCurrentIndex(i);
      renderProductList();
      renderPinnedProduct();
      renderProductStrip();
    });
    strip.appendChild(item);
  });
}

function renderSessionControls() {
  const panel = $("session-controls");
  panel.innerHTML = `
    <h4>Sesi Live</h4>
    <div class="field">
      <label><span>Rotasi produk tiap</span><span class="val" id="rot-val">${store.get("affiliateRotationMinutes")} menit</span></label>
      <input type="range" min="1" max="10" value="${store.get("affiliateRotationMinutes")}" id="rot-slider">
    </div>
    <div class="field">
      <label><span>Speak pitch tiap</span><span class="val" id="pit-val">${store.get("affiliatePitchSeconds")} detik</span></label>
      <input type="range" min="15" max="120" value="${store.get("affiliatePitchSeconds")}" id="pit-slider">
    </div>
    <button class="btn-session-start" id="btn-session">[LIVE] MULAI LIVE AFFILIATE</button>
  `;

  $("rot-slider").addEventListener("input", (e) => {
    const v = +e.target.value;
    store.set("affiliateRotationMinutes", v);
    $("rot-val").textContent = `${v} menit`;
  });
  $("pit-slider").addEventListener("input", (e) => {
    const v = +e.target.value;
    store.set("affiliatePitchSeconds", v);
    $("pit-val").textContent = `${v} detik`;
  });
  $("btn-session").addEventListener("click", () => {
    if (isActive()) {
      stopSession();
      $("btn-session").classList.remove("active");
      $("btn-session").textContent = "[LIVE] MULAI LIVE AFFILIATE";
      $("aff-live-badge").classList.remove("on");
    } else {
      startSession({
        rotationMinutes: store.get("affiliateRotationMinutes"),
        pitchEverySeconds: store.get("affiliatePitchSeconds"),
        onPitch: (script, product) => {
          enqueueSpeak(script);
          renderPinnedProduct();
          renderProductStrip();
          renderProductList();
        },
        onProductChange: () => {
          renderPinnedProduct();
          renderProductStrip();
          renderProductList();
        },
      });
      $("btn-session").classList.add("active");
      $("btn-session").textContent = "⏹ STOP LIVE";
      $("aff-live-badge").classList.add("on");
      pushAlert("[LIVE] LIVE DIMULAI!");
    }
  });
}

function renderChatSeed() {
  const list = $("aff-chat-list");
  list.innerHTML = "";
  appendChat({ user: "system", color: "#00FF88", text: "Live affiliate AlterCast siap. Klik MULAI LIVE." });
}

function bindUI() {
  $("add-product").addEventListener("click", () => {
    const name = prompt("Nama produk:");
    if (!name) return;
    const price = parseInt(prompt("Harga (Rp):", "50000"), 10);
    if (!price) return;
    const originalPrice = parseInt(prompt("Harga asli (Rp, kosongkan kalau sama):", price) || price, 10);
    const stock = parseInt(prompt("Stok:", "50"), 10) || 50;
    const image = prompt("URL gambar (atau kosongkan untuk placeholder):", "") || `https://placehold.co/600x600/00D4FF/001220?text=${encodeURIComponent(name.slice(0, 12))}`;
    const link = prompt("Link keranjang (#kosong = placeholder):", "#keranjang") || "#";
    const highlights = (prompt("Highlights (pisahkan koma):", "Berkualitas, Harga miring, Pengiriman cepat") || "").split(",").map(s => s.trim()).filter(Boolean);
    addProduct({ id: "p_" + Date.now(), name, price, originalPrice, stock, image, link, highlights, voucher: "PROMO", category: "lainnya" });
    renderProductList();
    renderProductStrip();
    renderPinnedProduct();
  });

  /* Simulate events */
  $("sim-follow").addEventListener("click", () => {
    const u = "user_" + Math.floor(Math.random() * 9999);
    appendChat({ user: u, color: "#00FF88", text: "baru follow!", isFollow: true });
    enqueueSpeak(reactToFollow(u));
    pushAlert(`[OK] ${u} follow!`);
  });
  $("sim-gift").addEventListener("click", () => {
    const u = "user_" + Math.floor(Math.random() * 9999);
    const gifts = ["Rose ", "TikTok [MUS]", "Heart Me [HEART]", "Galaxy ", "Lion "];
    const g = pickRandom(gifts);
    appendChat({ user: u, color: "#FFB800", text: `mengirim ${g}`, isGift: true, giftIcon: g.match(/(\S+)$/)?.[1] });
    enqueueSpeak(reactToGift(u, g));
    pushAlert(`[GIFT] ${u} kirim ${g}!`);
  });
  $("sim-question").addEventListener("click", () => {
    const qs = ["berapa harganya kak?", "ready ga sis?", "ongkir kemana aja?", "warnanya apa aja?", "BPOM ga?", "asli ga ini?", "size m ada?", "bisa COD?"];
    const q = pickRandom(qs);
    const u = "buyer_" + Math.floor(Math.random() * 9999);
    appendChat({ user: u, color: "#00D4FF", text: q });
    const reply = answerQuestion(q, getCurrentProduct());
    setTimeout(() => {
      appendChat({ user: AVATARS[store.get("currentAvatar")].name, color: "#00D4FF", text: reply, isAI: true });
      enqueueSpeak(reply);
    }, 600);
  });
  $("sim-share").addEventListener("click", () => {
    const u = "user_" + Math.floor(Math.random() * 9999);
    appendChat({ user: u, color: "#7C3AFF", text: "share live ini!" });
    enqueueSpeak(reactToShare(u));
    pushAlert(` ${u} share live!`);
  });

  /* Manual chat input → AI answer */
  $("aff-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("aff-send").click();
  });
  $("aff-send").addEventListener("click", async () => {
    const text = $("aff-input").value.trim();
    if (!text) return;
    $("aff-input").value = "";
    appendChat({ user: "kamu", color: "#00D4FF", text });
    /* Try affiliate FAQ first */
    const local = answerQuestion(text, getCurrentProduct());
    /* If question seems generic, also try AI */
    let reply = local;
    try {
      reply = await aiRespond(`${text} (konteks: lagi live affiliate produk ${getCurrentProduct()?.name})`);
    } catch (e) {}
    appendChat({ user: AVATARS[store.get("currentAvatar")].name, color: "#00D4FF", text: reply, isAI: true });
    enqueueSpeak(reply);
  });
}

/* ──────────────── Chat + Speak Queue ──────────────── */
function appendChat({ user, color, text, isAI, isFollow, isGift, giftIcon }) {
  const list = $("aff-chat-list");
  const row = document.createElement("div");
  let cls = "aff-chat-row";
  if (isAI) cls += " ai";
  if (isFollow) cls += " follow";
  if (isGift) cls += " gift";
  row.className = cls;
  row.innerHTML = `
    <div class="av" style="background:${color}22;border:1px solid ${color}55;color:${color}">${user.charAt(0).toUpperCase()}</div>
    <div class="body">
      <div class="user" style="color:${color}">${user}</div>
      <div class="msg">${escapeHtml(text)}</div>
    </div>
    ${giftIcon ? `<div class="gift-icon">${giftIcon}</div>` : ""}
  `;
  list.appendChild(row);
  while (list.children.length > 80) list.removeChild(list.firstChild);
  list.scrollTop = list.scrollHeight;
  /* Update viewer count fluctuation */
  const vc = $("viewer-count");
  if (vc) vc.textContent = (parseInt(vc.textContent.replace(/[^\d]/g, ""), 10) + Math.floor(Math.random() * 3)).toString();
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function enqueueSpeak(text) {
  speakQueue.push(text);
  processQueue();
}
async function processQueue() {
  if (isSpeaking || !speakQueue.length) return;
  const text = speakQueue.shift();
  isSpeaking = true;
  showBubble(text);
  try { await speak(text); } catch (e) {}
  hideBubble();
  isSpeaking = false;
  processQueue();
}
function showBubble(text) {
  $("aff-bubble-text").textContent = text;
  $("aff-bubble").classList.add("show");
}
function hideBubble() {
  $("aff-bubble").classList.remove("show");
}

function pushAlert(text) {
  const a = $("aff-alert");
  a.textContent = text;
  a.classList.remove("show");
  void a.offsetWidth;
  a.classList.add("show");
}

document.addEventListener("DOMContentLoaded", boot);
