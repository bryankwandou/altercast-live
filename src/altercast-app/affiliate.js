/* ═══════════════════════════════════════════════════════════
   AlterCast — TikTok Affiliate Live Streamer Module
   • Product catalog with rotation
   • Indonesian pitch script library (auto-rotated)
   • Gift / follower reactions
   • Chat Q&A handler with product context
   • Auto-pin product, auto-cycle every N minutes
═══════════════════════════════════════════════════════════ */

import { store } from "./store.js";
import { pickRandom } from "./i18n.js";

/* ── Default sample products (user dapat tambah/edit) ── */
export const DEFAULT_PRODUCTS = [
  {
    id: "p1",
    name: "Serum Wajah Glow Bright 30ml",
    price: 89000,
    originalPrice: 159000,
    image: "https://placehold.co/600x600/00D4FF/001220?text=Serum",
    stock: 48,
    highlights: ["Brightening dalam 7 hari", "Niacinamide 5%", "Cocok kulit sensitif"],
    link: "#keranjang-1",
    voucher: "DISKON 44%",
    category: "skincare",
  },
  {
    id: "p2",
    name: "Earphone Bluetooth TWS Pro",
    price: 125000,
    originalPrice: 299000,
    image: "https://placehold.co/600x600/7C3AFF/F0F4FF?text=TWS",
    stock: 23,
    highlights: ["Battery 24 jam", "Active Noise Cancelling", "IPX5 waterproof"],
    link: "#keranjang-2",
    voucher: "FLASH SALE",
    category: "elektronik",
  },
  {
    id: "p3",
    name: "Tas Selempang Wanita Premium",
    price: 79000,
    originalPrice: 199000,
    image: "https://placehold.co/600x600/FF6BB5/F0F4FF?text=Tas",
    stock: 67,
    highlights: ["Bahan kulit PU", "Banyak kompartemen", "Tali bisa diatur"],
    link: "#keranjang-3",
    voucher: "GRATIS ONGKIR",
    category: "fashion",
  },
];

/* ── Indonesian affiliate pitch scripts ── */
export const PITCH_OPENERS = [
  "Halo guys, masih di sini sama aku ya!",
  "Welcome semua yang baru masuk!",
  "Hai kakak-kakak, makasih udah join live!",
  "Yang baru gabung, jangan lupa di-follow ya guys.",
  "Halo halo, semoga sehat-sehat semuanya!",
];

export const PITCH_LINES = {
  intro: [
    "Yang ini lagi promo banget guys, sini liat.",
    "Ini produk favoritku, wajib kalian punya nih kak.",
    "Yang ini stoknya tipis banget, buruan checkout!",
    "Cek di keranjang kuning ya guys, link-nya udah aku pin.",
    "Produk ini lagi diskon gede banget, sayang banget kalau ke-skip.",
  ],
  highlight: [
    "Kelebihannya tuh ini guys:",
    "Yang bikin spesial dari produk ini:",
    "Coba dengerin nih kak, fitur-fiturnya:",
    "Pointnya ada di sini:",
  ],
  price: [
    "Harganya cuma {price} aja guys, biasanya {original}!",
    "Modal {price} doang kak, untungnya bisa berkali-kali lipat.",
    "Tinggal {price}, hemat {discount} dari harga normal {original}.",
    "Murah banget kan, cuma {price}!",
  ],
  cta: [
    "Klik keranjang kuning sekarang ya guys!",
    "Yang minat langsung checkout di keranjang kuning kak.",
    "Buruan tap link di pojok kanan bawah!",
    "Jangan ditunda guys, stoknya tinggal dikit banget.",
    "Checkout sekarang biar nggak kehabisan!",
  ],
  scarcity: [
    "Tinggal {stock} pcs lagi ya guys, buruan!",
    "Stok lagi tipis nih kak, sisa {stock} aja!",
    "{stock} pcs terakhir, siapa cepat dia dapat!",
  ],
  closing: [
    "Oke guys, ada pertanyaan? Tulis di chat ya!",
    "Yang udah checkout, makasih banyak ya kak!",
    "Aku tungguin pertanyaan kalian di chat.",
    "Lanjut ke produk berikutnya yuk!",
  ],
};

export const FOLLOW_REACTIONS = [
  "Makasih ya {user} udah follow!",
  "Wih {user} follow, makasih kak!",
  "{user} baru follow nih, welcome!",
  "Halo {user}, senang ketemu kamu!",
];

export const GIFT_REACTIONS = [
  "Makasih banyak {user} buat gift-nya!",
  "Wahhh {user} kirim gift, terbaik!",
  "Thank you so much {user}, sayang banget!",
  "Aaa {user} kasih gift, makasih ya!",
  "Big thanks ke {user} buat support-nya!",
];

export const SHARE_REACTIONS = [
  "Makasih {user} udah share live-nya!",
  "Thank you {user} udah bantu share!",
];

export const FAQ_REPLIES = {
  harga:    ["Harganya {price} guys, ada di deskripsi produk ya.", "Tinggal {price} kak, diskon banget!"],
  ready:    ["Ready kak, langsung checkout aja!", "Masih ada stoknya, buruan ya!"],
  ongkir:   ["Pakai gratis ongkir kak, asal claim voucher dulu.", "Bisa gratis ongkir guys, cek voucher di keranjang."],
  size:     ["Sizenya ada di deskripsi produk ya kak.", "Cek size chart di gambar produk ya guys."],
  warna:    ["Warna tersedia ada di pilihan variant ya kak.", "Tinggal pilih warna pas checkout ya guys."],
  bpom:     ["Udah BPOM kak, jangan khawatir.", "BPOM official ya guys, aman."],
  cod:      ["Bisa COD kak!", "COD available, tinggal pilih COD pas checkout."],
  asli:     ["100% original kak, garansi toko.", "Asli kak, langsung dari distributor resmi."],
  bagus:    ["Bagus banget kak, aku sendiri pake!", "Recommended banget guys."],
  default:  ["Pertanyaan bagus kak! Cek deskripsi produk ya.", "Coba liat di link keranjang kuning ya kak.", "Bisa langsung tanya admin lewat chat toko."],
};

export const KEYWORD_MAP = {
  "harga|berapa|brp|price": "harga",
  "ready|stok|stock|tersedia": "ready",
  "ongkir|ongkos|free|gratis": "ongkir",
  "size|ukuran|sz": "size",
  "warna|color|kelir": "warna",
  "bpom|aman|halal": "bpom",
  "cod|bayar di tempat": "cod",
  "asli|ori|original|kw|palsu": "asli",
  "bagus|enak|ampuh|works|recommended|rekomen": "bagus",
};

/* ── State ── */
let products = [...DEFAULT_PRODUCTS];
let currentIdx = 0;
let rotationTimer = null;
let pitchTimer = null;
let onPitchCb = null;
let onProductChangeCb = null;
let stats = {
  productsShown: 0,
  pitchesSpoken: 0,
  giftsReceived: 0,
  followersWelcomed: 0,
  questionsAnswered: 0,
  startedAt: null,
};

/* ── Product CRUD ── */
export function getProducts() { return products; }
export function setProducts(list) {
  products = list.filter(p => p && p.id);
  if (currentIdx >= products.length) currentIdx = 0;
}
export function addProduct(p) {
  products.push({ ...p, id: p.id || ("p_" + Date.now()) });
  saveProducts();
}
export function removeProduct(id) {
  products = products.filter(p => p.id !== id);
  if (currentIdx >= products.length) currentIdx = Math.max(0, products.length - 1);
  saveProducts();
}
export function updateProduct(id, patch) {
  const i = products.findIndex(p => p.id === id);
  if (i >= 0) {
    products[i] = { ...products[i], ...patch };
    saveProducts();
  }
}

export function saveProducts() {
  try { localStorage.setItem("altercast.products.v1", JSON.stringify(products)); } catch (e) {}
}
export function loadProducts() {
  try {
    const raw = localStorage.getItem("altercast.products.v1");
    if (raw) products = JSON.parse(raw);
  } catch (e) {}
}

export function getCurrentProduct() { return products[currentIdx] || null; }
export function getCurrentIndex() { return currentIdx; }
export function setCurrentIndex(i) {
  if (i < 0 || i >= products.length) return;
  currentIdx = i;
  store.set("affiliateProductIdx", i);
  if (onProductChangeCb) onProductChangeCb(getCurrentProduct(), i);
}
export function nextProduct() { setCurrentIndex((currentIdx + 1) % products.length); }
export function prevProduct() { setCurrentIndex((currentIdx - 1 + products.length) % products.length); }

/* ── Pitch generator ── */
export function generatePitchScript(product) {
  if (!product) return "";
  const intro = pickRandom(PITCH_LINES.intro);
  const highlight = pickRandom(PITCH_LINES.highlight);
  const features = product.highlights.slice(0, 3).join(", ");
  const priceTemplate = pickRandom(PITCH_LINES.price);
  const original = product.originalPrice || product.price;
  const discount = original - product.price;
  const priceLine = priceTemplate
    .replace("{price}", "Rp " + product.price.toLocaleString("id-ID"))
    .replace("{original}", "Rp " + original.toLocaleString("id-ID"))
    .replace("{discount}", "Rp " + discount.toLocaleString("id-ID"));
  const scarcityTemplate = pickRandom(PITCH_LINES.scarcity);
  const scarcity = product.stock <= 30
    ? scarcityTemplate.replace("{stock}", product.stock)
    : "";
  const cta = pickRandom(PITCH_LINES.cta);
  return [intro, highlight, features + ".", priceLine, scarcity, cta]
    .filter(Boolean).join(" ");
}

/** Pick a short single-line pitch for quick speak (not full script). */
export function quickPitch(product) {
  if (!product) return pickRandom(PITCH_OPENERS);
  const choices = [
    `${product.name} cuma Rp ${product.price.toLocaleString("id-ID")} guys, buruan checkout!`,
    `Ini nih favoritku, ${product.name}, ada diskon banget.`,
    `Yang minat ${product.name}, klik keranjang kuning ya kak!`,
    `Stok ${product.name} tinggal ${product.stock}, jangan sampe kehabisan.`,
    pickRandom(PITCH_OPENERS),
  ];
  return pickRandom(choices);
}

/* ── Chat Q&A handler ── */
export function answerQuestion(text, product) {
  const lower = text.toLowerCase();
  let matchedKey = null;
  for (const [pattern, key] of Object.entries(KEYWORD_MAP)) {
    if (new RegExp(`\\b(${pattern})\\b`, "i").test(lower)) {
      matchedKey = key;
      break;
    }
  }
  const replies = FAQ_REPLIES[matchedKey] || FAQ_REPLIES.default;
  const r = pickRandom(replies);
  return r
    .replace("{price}", product ? "Rp " + product.price.toLocaleString("id-ID") : "harganya")
    .replace("{name}", product?.name || "produk ini");
}

/* ── Event reactions ── */
export function reactToFollow(username) {
  stats.followersWelcomed++;
  return pickRandom(FOLLOW_REACTIONS).replace("{user}", username);
}
export function reactToGift(username, giftName = "") {
  stats.giftsReceived++;
  const base = pickRandom(GIFT_REACTIONS).replace("{user}", username);
  return giftName ? base + ` ${giftName}-nya keren!` : base;
}
export function reactToShare(username) {
  return pickRandom(SHARE_REACTIONS).replace("{user}", username);
}

/* ── Session manager ── */
export function startSession({ onPitch, onProductChange, rotationMinutes = 3, pitchEverySeconds = 45 } = {}) {
  loadProducts();
  onPitchCb = onPitch;
  onProductChangeCb = onProductChange;
  stats.startedAt = Date.now();
  store.set("affiliateActive", true);
  store.set("affiliateProductIdx", currentIdx);

  /* Speak pitch every pitchEverySeconds */
  pitchTimer = setInterval(() => {
    const p = getCurrentProduct();
    if (!p) return;
    const script = Math.random() < 0.6 ? generatePitchScript(p) : quickPitch(p);
    stats.pitchesSpoken++;
    if (onPitchCb) onPitchCb(script, p);
  }, pitchEverySeconds * 1000);

  /* Rotate product every rotationMinutes */
  rotationTimer = setInterval(() => {
    nextProduct();
    stats.productsShown++;
    /* Speak intro line for new product immediately */
    const p = getCurrentProduct();
    if (p && onPitchCb) {
      const intro = `Lanjut ke produk berikutnya ya guys. ${p.name}!`;
      onPitchCb(intro, p);
    }
  }, rotationMinutes * 60 * 1000);

  /* Immediate opening */
  setTimeout(() => {
    if (onPitchCb) onPitchCb(pickRandom(PITCH_OPENERS) + " " + quickPitch(getCurrentProduct()), getCurrentProduct());
  }, 800);
}

export function stopSession() {
  if (pitchTimer) clearInterval(pitchTimer);
  if (rotationTimer) clearInterval(rotationTimer);
  pitchTimer = rotationTimer = null;
  store.set("affiliateActive", false);
}

export function isActive() { return store.get("affiliateActive"); }
export function getStats() {
  return {
    ...stats,
    durationMs: stats.startedAt ? Date.now() - stats.startedAt : 0,
    currentProduct: getCurrentProduct(),
  };
}
