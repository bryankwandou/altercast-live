/* ═══════════════════════════════════════════════════════════
   AlterCast — Engine Bridge
   Pakai KeqingGLBRenderer: full 3D dari semua sisi.
   Model Keqing + foto wajah asli user sebagai face texture.
═══════════════════════════════════════════════════════════ */

import { KeqingGLBRenderer } from "../engine/keqing-glb.js";
import { store, AVATARS, EMOTIONS, ANGLES, LIGHTING_PRESETS } from "./store.js";

const GLB_SRC = "assets/models/keqing.glb";

export class EngineBridge {
  constructor(canvas) {
    this.engine  = new KeqingGLBRenderer(canvas);
    this.canvas  = canvas;
    this.loaded  = false;
    this._unsubs = [];
    this._lastFpsTime  = 0;
    this._frameCount   = 0;
    this._shaking      = false;
    this._shakeMag     = 0;
    this._emoTimeout   = null;
    this._glbReady     = false;
  }

  async boot() {
    /* Init Three.js */
    const ok = await this.engine.init();
    if (!ok) {
      console.error("[EngineBridge] Three.js init gagal — Keqing tidak bisa dimuat");
      return;
    }

    /* Load GLB model satu kali */
    const glbOk = await this.engine.loadModel(GLB_SRC);
    if (!glbOk) console.warn("[EngineBridge] Keqing GLB gagal dimuat");
    this._glbReady = glbOk;

    /* Load semua face textures per avatar */
    for (const [id, av] of Object.entries(AVATARS)) {
      await this.engine.addAvatar(
        id, av.src,
        (msg) => console.log(`[Avatar:${id}] ${msg}`),
        !!av.config?.useAlpha   /* isRealFace — only removix PNGs use face overlay */
      );
    }

    const initId = store.get("currentAvatar");
    this.engine.selectAvatar(initId);
    this.engine.setAvatarLighting(AVATARS[initId]?.glb);
    this.loaded = true;
    this._wireStore();
    this._applyEmotion(store.get("emotion"));
    this._applyAngle(store.get("angle"));

    /* Resize */
    window.addEventListener("resize", () => this.engine.resize());
    this.engine.resize();
  }

  _wireStore() {
    this._unsubs.push(store.subscribe("currentAvatar", id => {
      this.engine.selectAvatar(id);
      this.engine.setAvatarLighting(AVATARS[id]?.glb);
      this._applyEmotion(store.get("emotion"));
    }));
    this._unsubs.push(store.subscribe("emotion",       e  => this._applyEmotion(e)));
    this._unsubs.push(store.subscribe("angle",         a  => this._applyAngle(a)));
    this._unsubs.push(store.subscribe("orbit",         on => this.engine.setOrbit(on)));
    this._unsubs.push(store.subscribe("mouthOpen",     v  => this.engine.setMouthOpen(v)));
    this._unsubs.push(store.subscribe("rim",           () => this._applyEmotion(store.get("emotion"))));
  }

  _applyEmotion(emo) {
    const cfg = EMOTIONS[emo] || EMOTIONS.idle;
    const scale = store.get("rim") / 0.55;
    this.engine.setEmotion({ rimA: cfg.rimA * scale, rimRGB: cfg.rimRGB });
    if (cfg.shake && !this._shaking) {
      this._shaking  = true;
      this._shakeMag = 0.012;
    }
  }

  _applyAngle(name) {
    const a = ANGLES[name];
    if (a) this.engine.setRotation(a.rx, a.ry);
  }

  setRotation(rx, ry) {
    this.engine.setRotation(rx, ry);
    store.set("rotation", { x: rx, y: ry });
  }
  setHeadLook(rx, ry) {
    this.engine.setHeadLook(rx, ry);
    store.set("headLook", { x: rx, y: ry });
  }
  setEyeLook(rx, ry) {
    this.engine.setEyeLook(rx, ry);
    store.set("eyeLook", { x: rx, y: ry });
  }

  triggerEmotionTransient(emo, durMs = 2200) {
    const prev = store.get("emotion");
    store.set("emotion", emo);
    if (this._emoTimeout) clearTimeout(this._emoTimeout);
    this._emoTimeout = setTimeout(() => store.set("emotion", prev), durMs);
  }

  resize() { this.engine.resize(); }

  render(t) {
    this._frameCount++;
    if (t - this._lastFpsTime >= 1) {
      store.set("fps", this._frameCount);
      this._frameCount  = 0;
      this._lastFpsTime = t;
    }
    let sx = 0, sy = 0;
    if (this._shaking) {
      this._shakeMag *= 0.88;
      sx = (Math.random() - 0.5) * this._shakeMag;
      sy = (Math.random() - 0.5) * this._shakeMag * 0.5;
      if (this._shakeMag < 0.001) { this._shaking = false; this._shakeMag = 0; }
    }
    this.engine.render(sx, sy);
  }

  destroy() {
    this._unsubs.forEach(u => u());
    this._unsubs = [];
  }
}
