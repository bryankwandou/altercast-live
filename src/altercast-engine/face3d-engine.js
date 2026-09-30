/* ═══════════════════════════════════════════════════════════
   AlterCast Face3D Engine
   Real 3D from real photo, powered by MediaPipe FaceLandmarker.

   Flow:
   1. Load MediaPipe FaceLandmarker (CDN, browser-native).
   2. Detect 478 face landmarks from photo (each with x/y/z normalized).
   3. Auto-crop photo to face bounding box (head + shoulders).
   4. Generate depth map from REAL landmark z-coords (not hardcoded blobs).
   5. Render cropped face with depth-displacement WebGL shader.

   Fallback: if MediaPipe fails (no internet / WebGL only), use a
   center-weighted depth map heuristic.
═══════════════════════════════════════════════════════════ */

import { mat4 } from "./avatar-engine.js";

const MP_TASKS_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";
const MP_WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MP_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const VS_SRC = `
attribute vec2 a_uv;
uniform sampler2D u_depth;
uniform mat4  u_mvp;
uniform float u_depthStrength;
uniform float u_aspect;
uniform float u_time;
uniform float u_floatAmp;
uniform float u_breathe;
varying vec2  v_uv;
varying float v_depth;
void main() {
  v_uv = a_uv;
  float d = texture2D(u_depth, a_uv).r;
  v_depth = d;
  float x = (a_uv.x - 0.5) * u_aspect;
  float y = -(a_uv.y - 0.5);
  float z = (d - 0.5) * u_depthStrength;
  y += sin(u_time * 0.7) * u_floatAmp;
  float s = 1.0 + sin(u_time * 1.2) * u_breathe;
  x *= s; y *= s;
  gl_Position = u_mvp * vec4(x, y, z, 1.0);
}`;

const FS_SRC = `
precision highp float;
varying vec2  v_uv;
varying float v_depth;
uniform sampler2D u_tex;
uniform sampler2D u_depth;
uniform vec3  u_rimColor;
uniform float u_rimStrength;
uniform float u_glow;
uniform vec3  u_lightDir;
uniform float u_keyLight;
uniform float u_bgThreshold;
uniform float u_useAlpha;  /* 1.0 = pakai alpha channel (transparent PNG), 0.0 = luminance removal */

void main() {
  vec4 col = texture2D(u_tex, v_uv);
  float lum = (col.r + col.g + col.b) / 3.0;
  float minC = min(col.r, min(col.g, col.b));
  float maxC = max(col.r, max(col.g, col.b));
  float sat = maxC - minC;

  /* Transparent PNG: pakai alpha channel langsung */
  /* Opaque PNG: hapus background putih via luminance */
  float bgPure = smoothstep(0.975, 0.998, lum) * (1.0 - smoothstep(0.0, 0.04, sat));
  float bgSoft = smoothstep(0.910, u_bgThreshold, lum) * (1.0 - smoothstep(0.0, 0.10, sat));
  float bg = max(bgPure, bgSoft * 0.75);
  float alphaLum = clamp(1.0 - bg, 0.0, 1.0);
  float alpha = mix(alphaLum, col.a, u_useAlpha);
  alpha = clamp(alpha, 0.0, 1.0);
  if (alpha < 0.04) discard;

  /* Surface normal from depth gradient */
  float epx = 0.005;
  float dL = texture2D(u_depth, v_uv - vec2(epx, 0.0)).r;
  float dR = texture2D(u_depth, v_uv + vec2(epx, 0.0)).r;
  float dU = texture2D(u_depth, v_uv - vec2(0.0, epx)).r;
  float dD = texture2D(u_depth, v_uv + vec2(0.0, epx)).r;
  vec3 normal = normalize(vec3((dL - dR) * 2.2, (dU - dD) * 2.2, 0.55));

  /* Lambert + ambient */
  vec3 L = normalize(u_lightDir);
  float lambert = max(0.0, dot(normal, L));
  float lit = 0.60 + lambert * u_keyLight;
  col.rgb *= lit;

  /* Rim fresnel */
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.6);
  col.rgb += u_rimColor * fresnel * u_rimStrength;

  /* Specular pop */
  vec3 halfV = normalize(L + viewDir);
  float spec = pow(max(0.0, dot(normal, halfV)), 32.0) * u_glow;
  col.rgb += vec3(spec) * 0.5;

  gl_FragColor = vec4(col.rgb, alpha);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader:", gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}
function link(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("Program:", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}
function makeGrid(N) {
  const uvs = [], idx = [];
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) uvs.push(x/N, y/N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = y*(N+1)+x, b = a+1, c = a+(N+1), d = c+1;
    idx.push(a,b,c, c,b,d);
  }
  return { uvs: new Float32Array(uvs), idx: new Uint16Array(idx) };
}
function makeTexture(gl, source) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  return t;
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/* MediaPipe singleton — load once, reuse */
let mpLandmarker = null;
let mpLoadAttempted = false;
async function getLandmarker() {
  if (mpLandmarker) return mpLandmarker;
  if (mpLoadAttempted) return null;
  mpLoadAttempted = true;
  try {
    const { FilesetResolver, FaceLandmarker } = await import(MP_TASKS_URL);
    const filesetResolver = await FilesetResolver.forVisionTasks(MP_WASM_URL);
    mpLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: MP_MODEL_URL, delegate: "GPU" },
      outputFaceBlendshapes: false,
      runningMode: "IMAGE",
      numFaces: 1,
    });
    return mpLandmarker;
  } catch (e) {
    console.warn("[Face3D] MediaPipe load failed:", e.message);
    return null;
  }
}

/* Detect face on an image, return { landmarks, bbox } or null */
async function detectFace(img) {
  const lm = await getLandmarker();
  if (!lm) return null;
  try {
    const res = lm.detect(img);
    if (!res.faceLandmarks?.length) return null;
    const points = res.faceLandmarks[0]; // 478 {x,y,z} normalized 0..1 in image space
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    let minZ = 1e9, maxZ = -1e9;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    return { points, bbox: { minX, maxX, minY, maxY }, zRange: { minZ, maxZ } };
  } catch (e) {
    console.warn("[Face3D] detect failed:", e.message);
    return null;
  }
}

/* Crop image to face bbox with expand factor (head + shoulders) */
function cropImageToFace(img, bbox, padX = 0.6, padTop = 0.5, padBottom = 1.4) {
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const bw = (bbox.maxX - bbox.minX) * sw;
  const bh = (bbox.maxY - bbox.minY) * sh;
  const cx = (bbox.minX + bbox.maxX) * 0.5 * sw;
  const cy = (bbox.minY + bbox.maxY) * 0.5 * sh;
  const ow = bw * (1 + padX * 2);
  let oTop = bh * (1 + padTop);
  let oBot = bh * (1 + padBottom);
  let cropX = Math.max(0, cx - ow / 2);
  let cropY = Math.max(0, cy - oTop * 0.6);
  let cropW = Math.min(sw - cropX, ow);
  let cropH = Math.min(sh - cropY, oTop * 0.6 + oBot * 0.6);
  /* Square-ish */
  const target = Math.max(cropW, cropH * 0.85);
  cropW = target;
  cropH = target * 1.18; // slight portrait

  const c = document.createElement("canvas");
  c.width = Math.round(cropW);
  c.height = Math.round(cropH);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return {
    canvas: c,
    crop: { x: cropX / sw, y: cropY / sh, w: cropW / sw, h: cropH / sh },
  };
}

/* Generate depth map from landmarks. Landmark.z values are relative depth
   from MediaPipe (lower = closer to camera in MediaPipe's convention).
   We splat each landmark as a gaussian on a canvas, where bright = closer. */
function generateDepthFromLandmarks(points, crop, zRange, W = 256, H = 320) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  /* Base: mid-grey background */
  ctx.fillStyle = "rgb(70, 70, 70)";
  ctx.fillRect(0, 0, W, H);

  /* Re-map landmark coords from full image space to crop space */
  const zSpan = (zRange.maxZ - zRange.minZ) || 1;

  /* Splat depth: closer landmarks = brighter, farther = darker */
  ctx.globalCompositeOperation = "lighter";
  for (const p of points) {
    /* Re-project from image space → crop space */
    const cx = ((p.x - crop.x) / crop.w) * W;
    const cy = ((p.y - crop.y) / crop.h) * H;
    if (cx < -20 || cx > W + 20 || cy < -20 || cy > H + 20) continue;
    /* Invert: MediaPipe z negative = closer to camera. Map to 0..1. */
    const zNorm = 1 - ((p.z - zRange.minZ) / zSpan); // 1 = closest
    const intensity = Math.max(0, Math.min(1, zNorm));
    const radius = 14 + 6 * intensity;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const alpha = 0.5 + intensity * 0.4;
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
  ctx.globalCompositeOperation = "source-over";

  /* Blur pass via re-draw on smaller canvas then back */
  const tmp = document.createElement("canvas");
  const sf = 4;
  tmp.width = W / sf; tmp.height = H / sf;
  tmp.getContext("2d").drawImage(c, 0, 0, tmp.width, tmp.height);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgb(70, 70, 70)";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(tmp, 0, 0, W, H);
  return c;
}

/* Fallback depth map: center-weighted bright blob with portrait gradient */
function generateFallbackDepth(W = 256, H = 320) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  /* Top-down gradient */
  const lin = ctx.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, "#666");
  lin.addColorStop(0.45, "#a0a0a0");
  lin.addColorStop(0.85, "#606060");
  lin.addColorStop(1, "#404040");
  ctx.fillStyle = lin;
  ctx.fillRect(0, 0, W, H);
  /* Face dome */
  const rad = ctx.createRadialGradient(W*.5, H*.32, 0, W*.5, H*.32, W*.4);
  rad.addColorStop(0, "rgba(255,255,255,.9)");
  rad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, W, H);
  /* Chin */
  const r2 = ctx.createRadialGradient(W*.5, H*.55, 0, W*.5, H*.55, W*.22);
  r2.addColorStop(0, "rgba(220,220,220,.5)");
  r2.addColorStop(1, "rgba(220,220,220,0)");
  ctx.fillStyle = r2;
  ctx.fillRect(0, 0, W, H);
  return c;
}

/* ── Face3D Engine ────────────────────────────────────── */
export class Face3DEngine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const vs = compile(gl, gl.VERTEX_SHADER, VS_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS_SRC);
    this.prog = link(gl, vs, fs);
    gl.useProgram(this.prog);

    this.attr = { uv: gl.getAttribLocation(this.prog, "a_uv") };
    this.uni = {};
    ["mvp","tex","depth","depthStrength","aspect","time","floatAmp","breathe",
     "rimColor","rimStrength","glow","lightDir","keyLight","bgThreshold","useAlpha"].forEach(k => {
      this.uni[k] = gl.getUniformLocation(this.prog, "u_" + k);
    });

    const grid = makeGrid(128);
    this.idxCount = grid.idx.length;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, grid.uvs, gl.STATIC_DRAW);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.idx, gl.STATIC_DRAW);

    this.state = {
      texAspect: 0.83,
      depthStrength: 0.55,
      floatAmp: 0.018,
      breathe: 0.004,
      rimColor: [0, 0.83, 1.0],
      rimStrength: 0.70,
      glow: 1.0,
      lightDir: [0.4, 0.7, 0.7],
      keyLight: 0.55,
      bgThreshold: 0.985,
      useAlpha: 0.0,
      rotX: 0, rotY: 0, rotXTarget: 0, rotYTarget: 0,
      orbit: false, orbitT: 0,
    };

    this.avatars = {};
    this.currentId = null;
    this.start = performance.now();

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(r.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(r.height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Add avatar: detect face → crop → generate depth from landmarks → upload textures */
  async addAvatar(id, imgSrc, onProgress = () => {}) {
    onProgress("loading image…");
    const img = await loadImage(imgSrc);

    onProgress("detecting face landmarks…");
    const detection = await detectFace(img);

    let croppedCanvas, depthCanvas, aspect, method;
    if (detection) {
      onProgress("cropping to face…");
      const { canvas, crop } = cropImageToFace(img, detection.bbox);
      croppedCanvas = canvas;
      aspect = canvas.width / canvas.height;
      onProgress("generating depth from landmarks…");
      depthCanvas = generateDepthFromLandmarks(detection.points, crop, detection.zRange,
                                                 256, Math.round(256 / aspect));
      method = "mediapipe";
    } else {
      onProgress("fallback depth (no face detected)…");
      /* Crop to center-top portion */
      const sw = img.naturalWidth, sh = img.naturalHeight;
      const cropW = sw * 0.6;
      const cropH = cropW * 1.18;
      const cropX = (sw - cropW) / 2;
      const cropY = sh * 0.02;
      const c = document.createElement("canvas");
      c.width = cropW; c.height = cropH;
      c.getContext("2d").drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      croppedCanvas = c;
      aspect = cropW / cropH;
      depthCanvas = generateFallbackDepth(256, Math.round(256 / aspect));
      method = "fallback";
    }

    onProgress("uploading textures…");
    const tex = makeTexture(this.gl, croppedCanvas);
    const depthTex = makeTexture(this.gl, depthCanvas);
    /* Detect if image has real transparency (background-removed PNG) */
    const testCtx = document.createElement("canvas");
    testCtx.width = 8; testCtx.height = 8;
    const tCtx = testCtx.getContext("2d");
    tCtx.drawImage(img, 0, 0, 8, 8);
    const pix = tCtx.getImageData(0, 0, 8, 8).data;
    let hasTransparency = false;
    for (let i = 3; i < pix.length; i += 4) if (pix[i] < 200) { hasTransparency = true; break; }

    this.avatars[id] = { tex, depthTex, aspect, method, useAlpha: hasTransparency };
    onProgress(`done (${method}${hasTransparency ? " · transparent" : ""})`);
    return this.avatars[id];
  }

  selectAvatar(id) {
    if (!this.avatars[id]) return false;
    this.currentId = id;
    this.state.texAspect = this.avatars[id].aspect;
    this.state.useAlpha = this.avatars[id].useAlpha ? 1.0 : 0.0;
    return true;
  }

  setRotation(rx, ry) { this.state.rotXTarget = rx; this.state.rotYTarget = ry; }
  setHeadLook(rx, ry) { this.state.rotXTarget += rx * 0.3; this.state.rotYTarget += ry * 0.3; }
  setEyeLook() {}     /* stub — depth-displaced face tidak punya eye mesh terpisah */
  setMouthOpen() {}   /* stub — ekspresi dikontrol via rimColor saja */
  setOrbit(on) { this.state.orbit = on; }
  setDepthStrength(v) { this.state.depthStrength = v; }
  setLightDir(x, y, z) { this.state.lightDir = [x, y, z]; }
  /* Emotion: update rim glow color + intensity */
  setEmotion(cfg) {
    if (cfg.rimRGB) this.state.rimColor = cfg.rimRGB;
    if (cfg.rimA !== undefined) this.state.rimStrength = cfg.rimA * 0.85;
  }
  getRotation() { return { x: this.state.rotX, y: this.state.rotY }; }
  getMethod(id) { return this.avatars[id]?.method; }

  render(extraX = 0, extraY = 0) {
    if (!this.currentId) return;
    const gl = this.gl;
    const t = (performance.now() - this.start) / 1000;
    const s = this.state;

    if (s.orbit) {
      s.orbitT += 0.005;
      s.rotYTarget = Math.sin(s.orbitT) * 0.55;
      s.rotXTarget = Math.sin(s.orbitT * 0.4) * 0.10;
    }
    s.rotX += (s.rotXTarget - s.rotX) * 0.06;
    s.rotY += (s.rotYTarget - s.rotY) * 0.06;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.attr.uv);
    gl.vertexAttribPointer(this.attr.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

    const av = this.avatars[this.currentId];
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, av.tex);
    gl.uniform1i(this.uni.tex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, av.depthTex);
    gl.uniform1i(this.uni.depth, 1);

    const aspect = this.canvas.width / this.canvas.height;
    const P = mat4.perspective(Math.PI / 4.5, aspect, 0.1, 50);
    const V = mat4.translate(extraX, extraY - 0.05, -2.0);
    const RX = mat4.rotX(s.rotX);
    const RY = mat4.rotY(s.rotY);
    let M = mat4.multiply(RY, RX);
    M = mat4.multiply(V, M);
    M = mat4.multiply(P, M);
    gl.uniformMatrix4fv(this.uni.mvp, false, M);

    gl.uniform1f(this.uni.depthStrength, s.depthStrength);
    gl.uniform1f(this.uni.aspect, s.texAspect);
    gl.uniform1f(this.uni.time, t);
    gl.uniform1f(this.uni.floatAmp, s.floatAmp);
    gl.uniform1f(this.uni.breathe, s.breathe);
    gl.uniform3fv(this.uni.rimColor, s.rimColor);
    gl.uniform1f(this.uni.rimStrength, s.rimStrength);
    gl.uniform1f(this.uni.glow, s.glow);
    gl.uniform3fv(this.uni.lightDir, s.lightDir);
    gl.uniform1f(this.uni.keyLight, s.keyLight);
    gl.uniform1f(this.uni.bgThreshold, s.bgThreshold);
    gl.uniform1f(this.uni.useAlpha, s.useAlpha);

    gl.drawElements(gl.TRIANGLES, this.idxCount, gl.UNSIGNED_SHORT, 0);
  }
}
