/* ═══════════════════════════════════════════════════════════
   AlterCast — Central Reactive Store
   Pub/sub state management for ALL avatar + UI + stream params
   Every UI control reads/writes through this single store.
═══════════════════════════════════════════════════════════ */

/* ── Avatar configs (extend by adding to AVATARS) ── */
export const AVATARS = {
  /* ── HOST LIVE: wajah asli, studio look natural ── */
  user: {
    id: "user",
    src: "assets/avatars/host-real.png",
    name: "Host Live",
    tag: "muka asli · wajah nyata",
    statusKey: "HOST UTAMA · LIVE READY",
    irisColor: [0.22, 0.58, 0.80],
    glb: {
      keyColor: 0xfff4e0, keyIntensity: 3.2,
      fillColor: 0xc8dcff, fillIntensity: 1.1,
      rimColor:  0x00d4ff, rimIntensity:  1.6,
      ambColor:  0x18202e, ambIntensity:  2.0,
      exposure: 1.35,
    },
    config: {
      bgThreshold: 0.10, useAlpha: true, faceScaleY: 1.0,
      irisColor: [0.22, 0.58, 0.80],
      samples: { skin:[[.50,.35],[.46,.38],[.54,.38]], hair:[[.50,.08],[.30,.12],[.70,.12]], body:[[.50,.70],[.40,.75],[.60,.75]] },
    },
  },
  /* ── HOST PREMIUM: wajah asli 2, golden-hour premium ── */
  user2: {
    id: "user2",
    src: "assets/avatars/host-real2.png",
    name: "Host Premium",
    tag: "muka asli · foto real 2",
    statusKey: "HOST PREMIUM · LIVE READY",
    irisColor: [0.55, 0.50, 0.65],
    glb: {
      keyColor: 0xffcc80, keyIntensity: 2.8,
      fillColor: 0xd0a0ff, fillIntensity: 0.9,
      rimColor:  0xffaa00, rimIntensity:  1.8,
      ambColor:  0x1e1428, ambIntensity:  1.8,
      exposure: 1.45,
    },
    config: {
      bgThreshold: 0.10, useAlpha: true, faceScaleY: 1.0,
      irisColor: [0.55, 0.50, 0.65],
      samples: { skin:[[.50,.35],[.46,.38],[.54,.38]], hair:[[.50,.08],[.30,.12],[.70,.12]], body:[[.50,.70],[.40,.75],[.60,.75]] },
    },
  },
  /* ── YUNA: karakter anime, soft sakura look ── */
  yuna: {
    id: "yuna",
    src: "assets/avatars/yuna.png",
    name: "Yuna",
    tag: "karakter anime · sakura",
    statusKey: "ACTIVE · CASUAL",
    irisColor: [0.18, 0.12, 0.09],
    glb: {
      keyColor: 0xffe8f0, keyIntensity: 2.6,
      fillColor: 0xffc0d8, fillIntensity: 0.8,
      rimColor:  0x80ffc0, rimIntensity:  1.4,
      ambColor:  0x1a1020, ambIntensity:  1.6,
      exposure: 1.20,
    },
    config: {
      bgThreshold: 0.978, faceScaleY: 1.0,
      irisColor: [0.18, 0.12, 0.09],
      samples: { skin:[[.52,.43],[.58,.46],[.54,.50]], hair:[[.55,.22],[.65,.30],[.45,.28]], body:[[.45,.80],[.55,.85],[.65,.78]] },
    },
  },
  /* ── AETHERIA: karakter cyberpunk, hologram electric ── */
  aetheria: {
    id: "aetheria",
    src: "assets/avatars/aetheria.png",
    name: "Aetheria",
    tag: "cyberpunk · hologram electric",
    statusKey: "ACTIVE · CHARACTER",
    irisColor: [0.55, 0.25, 0.15],
    glb: {
      keyColor: 0xf0f8ff, keyIntensity: 2.5,
      fillColor: 0x6080ff, fillIntensity: 1.2,
      rimColor:  0x00ffee, rimIntensity:  2.2,
      ambColor:  0x0a1428, ambIntensity:  2.4,
      exposure: 1.25,
    },
    config: {
      bgThreshold: 0.976, faceScaleY: 1.1,
      irisColor: [0.55, 0.25, 0.15],
      samples: { skin:[[.50,.20],[.52,.25],[.48,.22]], hair:[[.50,.08],[.42,.15],[.58,.15]], body:[[.50,.45],[.45,.50],[.55,.48]] },
    },
  },
};

/* ── Emotion configurations — drive rim color, animation, particles ── */
export const EMOTIONS = {
  idle:      { emoji: "[NEUTRAL]", float: .022, breath: .003, rimA: .55, rimRGB: [0,.83,1],     glow: .9,  partA: 1.0 },
  happy:     { emoji: "*", float: .030, breath: .005, rimA: .70, rimRGB: [1,.82,0],     glow: 1.2, partA: 1.3 },
  excited:   { emoji: "[PWR]", float: .055, breath: .008, rimA: .95, rimRGB: [1,.35,.35],   glow: 1.5, partA: 1.9, shake: true },
  wave:      { emoji: "[HI]", float: .034, breath: .004, rimA: .65, rimRGB: [0,.83,1],     glow: 1.0, partA: 1.2 },
  sad:       { emoji: "[DROP]", float: .013, breath: .002, rimA: .25, rimRGB: [.4,.45,1],    glow: .6,  partA: .6 },
  surprised: { emoji: "", float: .042, breath: .007, rimA: .80, rimRGB: [1,.65,0],     glow: 1.3, partA: 1.5 },
  laughing:  { emoji: "[LOL]", float: .048, breath: .009, rimA: .80, rimRGB: [1,.78,.4],    glow: 1.4, partA: 1.7 },
  thinking:  { emoji: "", float: .018, breath: .003, rimA: .40, rimRGB: [.6,.7,1],     glow: .8,  partA: .9 },
};

/* ── Camera angle presets ── */
export const ANGLES = {
  front:    { rx: 0,      ry: 0,      labelKey: "angle_front" },
  "34l":    { rx: 0,      ry: -0.45,  labelKey: "angle_34l" },
  "34r":    { rx: 0,      ry:  0.45,  labelKey: "angle_34r" },
  profilel: { rx: 0,      ry: -0.85,  labelKey: "angle_profile_l" },
  profiler: { rx: 0,      ry:  0.85,  labelKey: "angle_profile_r" },
  hero:     { rx: 0.20,   ry: 0,      labelKey: "angle_hero" },
  top:      { rx: -0.28,  ry: 0,      labelKey: "angle_top" },
};

/* ── Lighting presets — every preset drives 4-point light + ambient + SSS ── */
export const LIGHTING_PRESETS = {
  cinematic: {
    nameKey: "light_cinematic",
    key:  [0.7, 1.0, 1.2],  keyC:  [1.0, .96, .92], keyA:  .85,
    fill: [-1.0, .3, .8],   fillC: [.78, .85, 1.0], fillA: .40,
    rim:  [-0.3, .8, -1.2], rimC:  [0, .83, 1.0],   rimA:  .65,
    hair: [0, 1.2, .2],     hairC: [1, .92, .78],   hairA: .45,
    amb:  [.10, .11, .16],
  },
  sunset: {
    nameKey: "light_sunset",
    key:  [0.5, 0.7, 1.0],  keyC:  [1.0, .78, .55], keyA:  .95,
    fill: [-0.8, .4, .6],   fillC: [1.0, .65, .55], fillA: .45,
    rim:  [-0.4, .5, -1.0], rimC:  [1.0, .55, .30], rimA:  .70,
    hair: [0, 1.0, .3],     hairC: [1.0, .70, .50], hairA: .40,
    amb:  [.13, .09, .07],
  },
  studio: {
    nameKey: "light_studio",
    key:  [0.5, 1.0, 1.0],  keyC:  [1.0, 1.0, 1.0], keyA:  .95,
    fill: [-1.0, .5, .7],   fillC: [.9, .92, 1.0],  fillA: .55,
    rim:  [0, .8, -1.0],    rimC:  [1.0, 1.0, 1.0], rimA:  .45,
    hair: [0, 1.2, .1],     hairC: [1, 1, 1],       hairA: .40,
    amb:  [.14, .14, .16],
  },
  neon: {
    nameKey: "light_neon",
    key:  [0.7, 0.9, 1.0],  keyC:  [1.0, .85, .95], keyA:  .75,
    fill: [-1.0, .4, .7],   fillC: [.75, .50, 1.0], fillA: .55,
    rim:  [0, .8, -1.2],    rimC:  [.78, .30, 1.0], rimA:  .85,
    hair: [0, 1.2, .2],     hairC: [1.0, .78, 1.0], hairA: .50,
    amb:  [.10, .08, .16],
  },
  hologram: {
    nameKey: "light_hologram",
    key:  [0.4, 0.8, 1.4],  keyC:  [.40, .85, 1.0], keyA:  .70,
    fill: [-1.0, .3, .8],   fillC: [.20, .60, 1.0], fillA: .60,
    rim:  [-0.2, .6, -1.4], rimC:  [.0, 1.0, 1.0],  rimA:  1.10,
    hair: [0, 1.4, .3],     hairC: [.50, .95, 1.0], hairA: .55,
    amb:  [.05, .12, .20],
  },
};

/* ── Initial state — every UI control reads from here ── */
const initialState = {
  /* Meta */
  lang: "id",
  theme: "dark",
  currentPage: "studio",

  /* Avatar (default: muka asli host) */
  currentAvatar: "user",
  emotion: "idle",
  angle: "front",
  rotation: { x: 0, y: 0 },
  headLook: { x: 0, y: 0 },
  eyeLook: { x: 0, y: 0 },
  mouthOpen: 0,
  blink: 0,

  /* Render toggles (each maps to engine behavior) */
  orbit: false,
  mouseTrack: true,
  showLandmarks: false,
  particles: true,
  gridBackground: true,
  avatarGlow: true,
  speaking: false,

  /* Sliders */
  depth: 0.40,
  rim: 0.55,
  lightAngle: 45,
  breathSpeed: 1.0,
  eyeSpeed: 0.18,
  volume: 80,

  /* Lighting */
  lightingPreset: "cinematic",

  /* Stream / mode */
  isLive: false,
  isAFKMode: false,
  isOBSConnected: false,
  streamMode: "active", // active | afk | idle

  /* Controls */
  isMicOn: false,
  isVoiceOn: true,
  isCameraOn: false,
  isAIActive: true,

  /* Voice / TTS */
  ttsVoice: null,
  ttsRate: 1.0,
  ttsPitch: 1.1,
  muted: false,

  /* AI */
  aiBrain: "local", // local | cloud | mock
  aiModel: "qwen2.5:7b",
  aiLatency: 320,
  ollamaBaseUrl: "http://localhost:11434",

  /* External integrations */
  obsUrl: "ws://localhost:4455",
  twitchChannel: "",

  /* Affiliate live (TikTok Affiliate substitute) */
  affiliateActive: false,
  affiliateProductIdx: 0,
  affiliateRotationMinutes: 3,
  affiliatePitchSeconds: 45,

  /* Chat */
  chatMessages: [],
  chatQueue: [],
  viewerCount: 0,

  /* Stats */
  fps: 0,

  /* UI */
  fullscreen: false,
  sidebarCollapsed: false,
  tweaksOpen: false,
};

/* ── Keys that survive page refresh (user preferences only) ── */
const PERSIST_KEYS = new Set([
  "lang", "theme", "currentAvatar", "emotion", "angle",
  "orbit", "mouseTrack", "showLandmarks", "particles",
  "gridBackground", "avatarGlow",
  "depth", "faceScale", "faceOffsetY",
  "lightingPreset", "bgThreshold",
  "volume", "ttsSpeed", "ttsPitch", "voiceId",
  "afkMode", "afkInterval",
  "obsEnabled", "obsPort", "obsPassword",
  "sidebarCollapsed",
]);

const LS_KEY = "altercast_v1";

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function persistState(state) {
  try {
    const data = {};
    for (const k of PERSIST_KEYS) if (k in state) data[k] = state[k];
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch { /* storage quota exceeded — no-op */ }
}

/* ── Reactive store with localStorage persistence ── */
class Store {
  constructor(state) {
    // Merge saved preferences over defaults — no registration required
    this.state = { ...state, ...loadPersistedState() };
    this.subscribers = new Map();
    this.anySubscribers = new Set();
  }

  get(key) { return this.state[key]; }
  getAll() { return { ...this.state }; }

  set(key, value) {
    if (typeof key === "object") {
      Object.entries(key).forEach(([k, v]) => this._setOne(k, v));
      return;
    }
    this._setOne(key, value);
  }

  _setOne(key, value) {
    const prev = this.state[key];
    if (prev === value) return;
    this.state[key] = value;
    if (PERSIST_KEYS.has(key)) persistState(this.state);
    (this.subscribers.get(key) || new Set()).forEach(cb => {
      try { cb(value, prev); } catch (e) { console.error("Store sub error:", e); }
    });
    this.anySubscribers.forEach(cb => {
      try { cb(key, value, prev); } catch (e) { console.error("Store any-sub error:", e); }
    });
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
    this.subscribers.get(key).add(callback);
    return () => this.subscribers.get(key)?.delete(callback);
  }

  subscribeAny(callback) {
    this.anySubscribers.add(callback);
    return () => this.anySubscribers.delete(callback);
  }

  reset() {
    try { localStorage.removeItem(LS_KEY); } catch {}
    Object.entries(initialState).forEach(([k, v]) => this._setOne(k, v));
  }
}

export const store = new Store(initialState);

/* ── Convenience helpers ── */
export function setEmotion(emo) { store.set("emotion", emo); }
export function setAngle(ang)   { store.set("angle", ang); }
export function setLighting(p)  { store.set("lightingPreset", p); }
export function setAvatar(id)   { store.set("currentAvatar", id); }
export function setLang(l)      { store.set("lang", l); }
export function toggleOrbit()   { store.set("orbit", !store.get("orbit")); }

/* ── Mock chat data (Indonesian) ── */
export const MOCK_CHAT_INITIAL = [
  { id: 1, user: "andiPro", color: "#00D4FF", text: "halo bro!", time: "now" },
  { id: 2, user: "MeyMey88", color: "#FF6BB5", text: "wah avatarnya hidup banget", time: "now" },
  { id: 3, user: "ggDanu", color: "#7C3AFF", text: "ini WebGL ya?", time: "1m" },
  { id: 4, user: "Risma_K", color: "#00FF88", text: "[HOT][HOT][HOT]", time: "2m" },
];

export const MOCK_CHAT_LIVE = [
  { user: "creativeJoe", color: "#FFB800", text: "kerennn!" },
  { user: "ayy_lmao", color: "#FF6BB5", text: "lipsync mantap" },
  { user: "RYNDX", color: "#00D4FF", text: "kapan bisa download?" },
  { user: "Nadia_S", color: "#7C3AFF", text: "halo Yuna, kabar?" },
  { user: "Drak1", color: "#00FF88", text: "test test 123" },
  { user: "ZendiK", color: "#00D4FF", text: "AFK mode jalan?" },
  { user: "miawmiaw", color: "#FF6BB5", text: "lucuu" },
  { user: "BangPipa", color: "#FFB800", text: "donasi 10rb buat Yuna" },
  { user: "kucingTerbang", color: "#7C3AFF", text: "ganti Aetheria dong" },
  { user: "yopiL", color: "#00D4FF", text: "real-time keren" },
  { user: "RinaQ", color: "#00FF88", text: "mantap btw" },
  { user: "DimasS", color: "#FF6BB5", text: "ini Indonesia ya kerennn" },
];
