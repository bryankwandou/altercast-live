/* ═══════════════════════════════════════════════════════════
   AlterCast — REAL FACE engine (2D living photo)
   Shows the user's ACTUAL photo (no cartoon / no anime / no AI-
   generated face) and animates mouth + head in real time so it
   looks like they are talking. Browser-only, no GPU, no backend.

   Pipeline:
     - Load real photo into a <canvas>
     - Detect mouth once via MediaPipe FaceLandmarker (WASM, browser)
       (falls back to a default mouth box if detection unavailable)
     - Each frame: draw photo; while speaking, drop a jaw band by an
       amount driven by live audio amplitude (getAmp); add idle/talk
       head sway. Result: the real face appears to speak.
═══════════════════════════════════════════════════════════ */

const MOUTH_IDX = [61, 291, 0, 17, 13, 14, 78, 308, 40, 270, 87, 317, 84, 314];
const FACE_LEFT = 234, FACE_RIGHT = 454, FACE_TOP = 10, FACE_BOTTOM = 152;

export class RealFace {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.img = null;
    this.mouth = null;          // {cx,cy,w,h} in image pixels
    this.face = null;           // {x,y,w,h}
    this.speaking = false;
    this.getAmp = () => 0;      // host supplies live amplitude 0..1
    this.amp = 0;
    this._running = true;
    this._t0 = performance.now();
    this._raf = null;
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
    this._onResize = () => this._fit();
    window.addEventListener("resize", this._onResize);
  }

  async setPhoto(url) {
    const img = await loadImage(url);
    this.img = img;
    this._fit();
    /* default mouth box (lower-center) in case detection fails */
    this.mouth = { cx: img.width * 0.5, cy: img.height * 0.66, w: img.width * 0.22, h: img.height * 0.07 };
    this.face = { x: img.width * 0.2, y: img.height * 0.08, w: img.width * 0.6, h: img.height * 0.84 };
    try { await this._detect(img); } catch (e) { /* keep defaults */ }
    return true;
  }

  async _detect(img) {
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
    const fileset = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    const fl = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
      runningMode: "IMAGE", numFaces: 1,
    });
    const res = fl.detect(img);
    fl.close();
    const lm = res?.faceLandmarks?.[0];
    if (!lm) return;
    const px = i => lm[i].x * img.width, py = i => lm[i].y * img.height;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const i of MOUTH_IDX) { minX = Math.min(minX, px(i)); maxX = Math.max(maxX, px(i)); minY = Math.min(minY, py(i)); maxY = Math.max(maxY, py(i)); }
    this.mouth = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: (maxX - minX) * 1.15, h: (maxY - minY) * 1.2 };
    const fx1 = px(FACE_LEFT), fx2 = px(FACE_RIGHT), fy1 = py(FACE_TOP), fy2 = py(FACE_BOTTOM);
    this.face = { x: Math.min(fx1, fx2), y: Math.min(fy1, fy2), w: Math.abs(fx2 - fx1), h: Math.abs(fy2 - fy1) };
    this.detected = true;
  }

  _fit() {
    const c = this.canvas;
    const w = c.clientWidth || 480, h = c.clientHeight || 640;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._cssW = w; this._cssH = h;
  }

  _loop() {
    if (!this._running) return;
    const t = (performance.now() - this._t0) / 1000;
    const target = this.speaking ? Math.max(0, Math.min(1, this.getAmp())) : 0;
    this.amp += (target - this.amp) * 0.4;     // smooth
    this._draw(t);
    this._raf = requestAnimationFrame(this._loop);
  }

  _draw(t) {
    const ctx = this.ctx, W = this._cssW, H = this._cssH;
    ctx.clearRect(0, 0, W, H);
    if (!this.img) return;

    /* contain-fit the photo into the canvas */
    const iw = this.img.width, ih = this.img.height;
    const scale = Math.min(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    const ox = (W - dw) / 2, oy = (H - dh) / 2;

    /* subtle head motion: idle sway + a bit more while talking */
    const swayX = Math.sin(t * 0.7) * 3 + Math.sin(t * 2.3) * this.amp * 4;
    const swayY = Math.sin(t * 1.1) * 2 - this.amp * 3;
    const rot = Math.sin(t * 0.5) * 0.01 + Math.sin(t * 3) * this.amp * 0.012;
    const breath = 1 + Math.sin(t * 1.4) * 0.004 + this.amp * 0.006;

    ctx.save();
    ctx.translate(W / 2 + swayX, H / 2 + swayY);
    ctx.rotate(rot);
    ctx.scale(breath, breath);
    ctx.translate(-W / 2, -H / 2);

    const toCanvas = (ix, iy) => ({ x: ox + ix * scale, y: oy + iy * scale });

    /* base photo */
    ctx.drawImage(this.img, ox, oy, dw, dh);

    /* mouth / jaw drop while speaking */
    if (this.mouth && this.amp > 0.02) {
      const m = this.mouth;
      const open = this.amp * m.h * 2.2;            // px of jaw drop (canvas space)
      const mc = toCanvas(m.cx, m.cy);
      const mw = m.w * scale, mh = m.h * scale;
      const openPx = open * scale;

      /* band = from just above mouth to chin/bottom of photo, centered on mouth x */
      const bandTop = mc.y - mh * 0.35;
      const bandH = (oy + dh) - bandTop;
      const bandX = Math.max(ox, mc.x - mw * 1.6);
      const bandW = Math.min(dw - (bandX - ox), mw * 3.2);
      const srcX = (bandX - ox) / scale, srcY = (bandTop - oy) / scale;
      const srcW = bandW / scale, srcH = bandH / scale;

      /* dark mouth interior revealed behind the dropped band */
      const g = ctx.createRadialGradient(mc.x, mc.y + openPx * 0.4, 1, mc.x, mc.y + openPx * 0.4, mw * 0.7);
      g.addColorStop(0, "rgba(40,12,18,0.95)");
      g.addColorStop(1, "rgba(20,6,10,0.0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(mc.x, mc.y + openPx * 0.45, mw * 0.55, Math.max(2, openPx * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();

      /* redraw the jaw band shifted down → mouth appears open */
      if (srcW > 1 && srcH > 1) {
        ctx.drawImage(this.img, srcX, srcY, srcW, srcH, bandX, bandTop + openPx, bandW, bandH);
      }
    }

    ctx.restore();
  }

  dispose() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
