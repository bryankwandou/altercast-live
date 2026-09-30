/* ═══════════════════════════════════════════════════════════
   AlterCast — Affiliate Sales Brain (client module)
   ES module. No build step. Used by /affiliate-studio.

   Responsibilities:
     - Persist product catalog + persona in localStorage
     - Talk to /api/ai in affiliate mode (sales host)
     - Classify incoming comments (question / gift / objection / greeting)
     - Provide autonomous pitch directives to fill silence
═══════════════════════════════════════════════════════════ */

const LS_PRODUCTS = "altercast_products";
const LS_PERSONA  = "altercast_persona";

/* ── Persona ── */
const DEFAULT_PERSONA = {
  name: "AlterCast",
  streamerName: "Host",
  hostStyle: "energik, ramah, persuasif tapi jujur, khas host live shopping Indonesia",
};

export function loadPersona() {
  try {
    const raw = localStorage.getItem(LS_PERSONA);
    if (raw) return { ...DEFAULT_PERSONA, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_PERSONA };
}

export function savePersona(persona) {
  try { localStorage.setItem(LS_PERSONA, JSON.stringify(persona)); } catch (e) {}
}

/* ── Product catalog (keranjang kuning) ──
   Each product: { id, slot, name, price, promo, points, link } */
export function loadProducts() {
  try {
    const raw = localStorage.getItem(LS_PRODUCTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveProducts(products) {
  try { localStorage.setItem(LS_PRODUCTS, JSON.stringify(products)); } catch (e) {}
}

export function addProduct(p) {
  const products = loadProducts();
  const slot = p.slot != null ? p.slot : (products.length + 1);
  const product = {
    id: "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    slot,
    name: (p.name || "Produk").trim(),
    price: (p.price || "").toString().trim(),
    promo: (p.promo || "").trim(),
    points: (p.points || "").trim(),
    link: (p.link || "").trim(),
  };
  products.push(product);
  saveProducts(products);
  return product;
}

export function removeProduct(id) {
  const products = loadProducts().filter(p => p.id !== id);
  /* Re-number slots so they stay 1..N */
  products.forEach((p, i) => { p.slot = i + 1; });
  saveProducts(products);
  return products;
}

/* ── Comment classification (cheap, local) ── */
const GIFT_RE      = /\b(gift|kado|mawar|rose|gas pol|tap tap|like|love|follow)\b/i;
const OBJECTION_RE = /\b(mahal|worth ?it|ori|asli|kw|garansi|jelek|murahan|penipu|scam|nipu)\b/i;
const QUESTION_RE  = /\?|\b(berapa|harga|gimana|bagaimana|apakah|stok|ready|warna|ukuran|size|kapan|bisa|po|cod)\b/i;

export function classifyComment(text) {
  const t = (text || "").toLowerCase();
  if (GIFT_RE.test(t))      return "gift";
  if (OBJECTION_RE.test(t)) return "objection";
  if (QUESTION_RE.test(t))  return "question";
  return "chat";
}

/* Priority score so the host answers buyers/questions before idle chatter */
export function commentPriority(text) {
  switch (classifyComment(text)) {
    case "objection": return 9; /* a hesitating buyer — answer fast */
    case "question":  return 8;
    case "gift":      return 6;
    default:          return 3;
  }
}

/* ── Talk to the AI backend in affiliate mode ── */
export async function askSalesBrain({
  prompt,
  username = "",
  persona = loadPersona(),
  products = loadProducts(),
  sessionId = "affiliate-live",
  endpoint = "/api/ai",
} = {}) {
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        username,
        mode: "affiliate",
        persona,
        products,
        sessionId,
      }),
    });
    const data = await r.json();
    return { text: data.text || "", provider: data.provider || "?" };
  } catch (e) {
    return { text: "", provider: "error", error: e.message };
  }
}

/* Autonomous filler: ask the brain to pitch the featured product */
export function autoPitchPrompt() {
  return "[AUTO_PITCH]";
}

/* Convenience: a single high-priority comment from a queue (mutates queue) */
export function dequeueTopComment(queue) {
  if (!queue.length) return null;
  let bestIdx = 0, bestScore = -1;
  queue.forEach((c, i) => {
    const s = commentPriority(c.text);
    if (s > bestScore) { bestScore = s; bestIdx = i; }
  });
  return queue.splice(bestIdx, 1)[0];
}
