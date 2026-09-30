/* ═══════════════════════════════════════════════════════════
   AlterCast — Atmosphere Layer
   • Background canvas: radial gradient, grid, mouse parallax
   • Particles canvas: rising sparkles, color reactive to emotion
═══════════════════════════════════════════════════════════ */

import { store, EMOTIONS } from "./store.js";

export class Atmosphere {
  constructor(bgCanvas, partCanvas) {
    this.bgCanvas = bgCanvas;
    this.bgCtx = bgCanvas.getContext("2d");
    this.partCanvas = partCanvas;
    this.partCtx = partCanvas.getContext("2d");
    this.parts = [];
    this.mouse = { tx: 0, ty: 0, x: 0, y: 0 };

    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("mousemove", (e) => {
      this.mouse.tx = e.clientX;
      this.mouse.ty = e.clientY;
    });

    this._initParticles();
  }

  resize() {
    [this.bgCanvas, this.partCanvas].forEach(c => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    });
  }

  _initParticles() {
    this.parts.length = 0;
    const w = this.partCanvas.width || window.innerWidth;
    const h = this.partCanvas.height || window.innerHeight;
    for (let i = 0; i < 100; i++) {
      this.parts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -Math.random() * 0.35 - 0.08,
        r: Math.random() * 2.2 + 0.4,
        op: Math.random() * 0.55 + 0.2,
        life: Math.random() * 180,
        maxLife: Math.random() * 200 + 120,
      });
    }
  }

  render(t) {
    this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.06;
    this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.06;
    if (store.get("gridBackground")) this._drawBG(t);
    else this.bgCtx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
    if (store.get("particles")) this._drawParts(t);
    else this.partCtx.clearRect(0, 0, this.partCanvas.width, this.partCanvas.height);
  }

  _drawBG(t) {
    const c = this.bgCanvas, x = this.bgCtx;
    const w = c.width, h = c.height;

    /* ── Base fill — deep studio navy ── */
    x.fillStyle = "#07080E";
    x.fillRect(0, 0, w, h);

    /* ── Back wall — warm cream/beige centre panel (like real affiliate studios) ── */
    const wallPanel = x.createLinearGradient(w * 0.18, 0, w * 0.82, 0);
    wallPanel.addColorStop(0,   "rgba(0,0,0,0)");
    wallPanel.addColorStop(0.1, "rgba(32,28,24,.92)");
    wallPanel.addColorStop(0.5, "rgba(40,34,28,.97)");
    wallPanel.addColorStop(0.9, "rgba(32,28,24,.92)");
    wallPanel.addColorStop(1,   "rgba(0,0,0,0)");
    x.fillStyle = wallPanel;
    x.fillRect(0, 0, w, h * 0.74);

    /* ── Broadcast key spotlight from top-centre ── */
    const spot = x.createRadialGradient(w * 0.5, -h * 0.1, 0, w * 0.5, h * 0.25, w * 0.52);
    spot.addColorStop(0,   "rgba(255,220,160,.28)");
    spot.addColorStop(0.4, "rgba(200,160,80,.12)");
    spot.addColorStop(1,   "rgba(0,0,0,0)");
    x.fillStyle = spot;
    x.fillRect(0, 0, w, h * 0.74);

    /* ── LED accent bar top-centre ── */
    const ledBar = x.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
    ledBar.addColorStop(0,   "rgba(0,200,255,0)");
    ledBar.addColorStop(0.3, "rgba(0,200,255,.55)");
    ledBar.addColorStop(0.7, "rgba(0,200,255,.55)");
    ledBar.addColorStop(1,   "rgba(0,200,255,0)");
    x.fillStyle = ledBar;
    x.fillRect(w * 0.2, 0, w * 0.6, 3);

    /* ── Rak produk kiri & kanan ── */
    this._drawShelf(x, w * 0.02, h * 0.08, w * 0.16, h, t, "left");
    this._drawShelf(x, w * 0.82, h * 0.08, w * 0.16, h, t, "right");

    /* ── Lantai studio ── */
    const floor = x.createLinearGradient(0, h * 0.72, 0, h);
    floor.addColorStop(0,   "#0b0c12");
    floor.addColorStop(0.5, "#0e1018");
    floor.addColorStop(1,   "#060608");
    x.fillStyle = floor;
    x.fillRect(0, h * 0.72, w, h * 0.28);

    /* Garis perspektif lantai */
    x.strokeStyle = "rgba(0,180,255,.055)";
    x.lineWidth = 1;
    const vp = { x: w * 0.5, y: h * 0.72 };
    const lanes = 10;
    for (let i = 0; i <= lanes; i++) {
      const bx = (i / lanes) * w;
      x.beginPath();
      x.moveTo(vp.x, vp.y);
      x.lineTo(bx, h);
      x.stroke();
    }
    /* Horizontal grid lines on floor */
    for (let row = 1; row <= 5; row++) {
      const fy = vp.y + (h - vp.y) * (row / 5);
      const blend = row / 5;
      x.strokeStyle = `rgba(0,180,255,${0.04 * (1 - blend)})`;
      x.beginPath();
      x.moveTo(0, fy);
      x.lineTo(w, fy);
      x.stroke();
    }

    /* ── Glow lantai bawah avatar ── */
    const floorGlow = x.createRadialGradient(w * 0.5, h * 0.78, 0, w * 0.5, h * 0.78, w * 0.2);
    floorGlow.addColorStop(0, "rgba(0,200,255,.14)");
    floorGlow.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = floorGlow;
    x.fillRect(w * 0.2, h * 0.65, w * 0.6, h * 0.35);

    /* ── Accent light kiri-kanan ── */
    const lR = x.createRadialGradient(0, h * 0.5, 0, 0, h * 0.5, w * 0.35);
    lR.addColorStop(0, "rgba(100,60,255,.10)");
    lR.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = lR;
    x.fillRect(0, 0, w * 0.4, h);

    const rR = x.createRadialGradient(w, h * 0.5, 0, w, h * 0.5, w * 0.35);
    rR.addColorStop(0, "rgba(0,180,255,.10)");
    rR.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = rR;
    x.fillRect(w * 0.6, 0, w * 0.4, h);

    /* ── Horizon line separator dinding/lantai ── */
    const hl = x.createLinearGradient(w * 0.15, 0, w * 0.85, 0);
    hl.addColorStop(0, "rgba(0,200,255,0)");
    hl.addColorStop(0.2, "rgba(0,200,255,.25)");
    hl.addColorStop(0.8, "rgba(0,200,255,.25)");
    hl.addColorStop(1, "rgba(0,200,255,0)");
    x.strokeStyle = hl;
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(w * 0.15, h * 0.72);
    x.lineTo(w * 0.85, h * 0.72);
    x.stroke();
  }

  _drawShelf(x, sx, sy, sw, h, t, side) {
    const shelfH = h * 0.62;
    const shelves = 5;
    const rowH = shelfH / shelves;

    /* ── Back panel ── */
    const panelGrad = x.createLinearGradient(sx, 0, sx + sw, 0);
    if (side === "left") {
      panelGrad.addColorStop(0, "rgba(18,24,38,.98)");
      panelGrad.addColorStop(1, "rgba(14,18,30,.60)");
    } else {
      panelGrad.addColorStop(0, "rgba(14,18,30,.60)");
      panelGrad.addColorStop(1, "rgba(18,24,38,.98)");
    }
    x.fillStyle = panelGrad;
    x.fillRect(sx, sy, sw, shelfH);

    /* ── Shelf boards ── */
    for (let i = 1; i <= shelves; i++) {
      const ly = sy + rowH * i;
      /* Board thickness */
      x.fillStyle = "rgba(30,40,60,.95)";
      x.fillRect(sx, ly - 5, sw, 6);
      /* LED under-shelf strip */
      const led = x.createLinearGradient(sx, 0, sx + sw, 0);
      led.addColorStop(0, side === "left" ? "rgba(0,200,255,.55)" : "rgba(0,200,255,.0)");
      led.addColorStop(1, side === "left" ? "rgba(0,200,255,.0)" : "rgba(0,200,255,.55)");
      x.fillStyle = led;
      x.fillRect(sx, ly + 1, sw, 2);
    }

    /* ── Products on each shelf ── */
    const productPalette = [
      ["#e83e8c","#c41a72"], ["#fd7e14","#d05e00"], ["#28a745","#1a7a2e"],
      ["#007bff","#0056b3"], ["#6f42c1","#52309b"], ["#dc3545","#a71d2a"],
      ["#17a2b8","#117a8b"], ["#ffc107","#d39e00"],
    ];

    for (let row = 0; row < shelves; row++) {
      const top = sy + rowH * row + 6;
      const bottom = sy + rowH * (row + 1) - 5;
      const bh = bottom - top - 4;
      const numBoxes = row % 2 === 0 ? 2 : 3;
      const boxW = (sw - 8) / numBoxes - 3;

      for (let b = 0; b < numBoxes; b++) {
        const bx = sx + 4 + b * (boxW + 3);
        const [col1, col2] = productPalette[(row * 3 + b) % productPalette.length];
        /* Product box body */
        const boxGrad = x.createLinearGradient(bx, top, bx, top + bh);
        boxGrad.addColorStop(0, col1 + "cc");
        boxGrad.addColorStop(1, col2 + "99");
        const pulse = 0.88 + Math.sin(t * 0.6 + row + b * 1.3) * 0.09;
        x.globalAlpha = pulse;
        x.fillStyle = boxGrad;
        x.fillRect(bx, top, boxW, bh);
        /* Highlight stripe */
        x.fillStyle = "rgba(255,255,255,.18)";
        x.fillRect(bx + 2, top + 2, boxW * 0.35, bh - 4);
        /* Price label */
        x.fillStyle = "rgba(255,255,255,.80)";
        x.fillRect(bx + 2, top + bh - 9, boxW - 4, 7);
        x.globalAlpha = 1;
      }
    }

    /* ── Vertical edge accent ── */
    const edgeX = side === "left" ? sx + sw : sx;
    const edgeGrad = x.createLinearGradient(0, sy, 0, sy + shelfH);
    edgeGrad.addColorStop(0, "rgba(0,200,255,.0)");
    edgeGrad.addColorStop(0.3, "rgba(0,200,255,.5)");
    edgeGrad.addColorStop(0.7, "rgba(0,200,255,.5)");
    edgeGrad.addColorStop(1, "rgba(0,200,255,.0)");
    x.strokeStyle = edgeGrad;
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(edgeX, sy);
    x.lineTo(edgeX, sy + shelfH);
    x.stroke();
  }

  _drawParts(t) {
    const x = this.partCtx;
    x.clearRect(0, 0, this.partCanvas.width, this.partCanvas.height);

    const emoCfg = EMOTIONS[store.get("emotion")] || EMOTIONS.idle;
    const c = emoCfg.rimRGB;
    const colStr = `${Math.floor(c[0] * 255)},${Math.floor(c[1] * 255)},${Math.floor(c[2] * 255)}`;

    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      if (p.y < -8 || p.life > p.maxLife) {
        p.x = Math.random() * this.partCanvas.width;
        p.y = this.partCanvas.height + 8;
        p.life = 0;
        p.maxLife = Math.random() * 200 + 120;
        p.vy = -Math.random() * 0.35 - 0.08;
      }
      const a = Math.sin(p.life / p.maxLife * Math.PI) * p.op * emoCfg.partA;
      x.beginPath();
      x.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      x.fillStyle = `rgba(${colStr},${Math.min(1, a)})`;
      x.fill();
      if (p.r > 1.5) {
        x.beginPath();
        x.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2);
        x.fillStyle = `rgba(${colStr},${Math.min(1, a) * 0.12})`;
        x.fill();
      }
    }
  }
}
