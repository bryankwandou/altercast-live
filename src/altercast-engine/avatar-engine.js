/* ═══════════════════════════════════════════════════════════
   AlterCast Avatar Engine v2.0 (ES module port)
   WebGL depth-displacement renderer: real 3D from a real photo
   • Photo as color texture
   • Generated depth map (lighter = closer)
   • Grid vertex displacement → real parallax when rotating
   • Lambert + rim + spec lighting (normals from depth gradient)
   • Smart background removal via luminance + saturation thresholds
═══════════════════════════════════════════════════════════ */

export const mat4 = {
  ident() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
  perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov/2), nf = 1 / (near - far);
    return new Float32Array([
      f/aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far+near)*nf, -1,
      0, 0, 2*far*near*nf, 0
    ]);
  },
  rotY(a) { const c=Math.cos(a), s=Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); },
  rotX(a) { const c=Math.cos(a), s=Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); },
  rotZ(a) { const c=Math.cos(a), s=Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); },
  translate(x,y,z) { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); },
  multiply(a, b) {
    const r = new Float32Array(16);
    for (let i=0; i<4; i++) for (let j=0; j<4; j++) {
      r[i*4+j] = a[0*4+j]*b[i*4]+a[1*4+j]*b[i*4+1]+a[2*4+j]*b[i*4+2]+a[3*4+j]*b[i*4+3];
    }
    return r;
  },
};

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
varying vec3  v_pos;
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
  v_pos = vec3(x, y, z);
  gl_Position = u_mvp * vec4(x, y, z, 1.0);
}`;

const FS_SRC = `
precision highp float;
varying vec2  v_uv;
varying float v_depth;
varying vec3  v_pos;
uniform sampler2D u_tex;
uniform sampler2D u_depth;
uniform float u_time;
uniform vec3  u_rimColor;
uniform float u_rimStrength;
uniform float u_glow;
uniform vec3  u_lightDir;
uniform float u_keyLight;
uniform float u_bgThreshold;

void main() {
  vec4 col = texture2D(u_tex, v_uv);
  float lum = (col.r + col.g + col.b) / 3.0;
  float minC = min(col.r, min(col.g, col.b));
  float maxC = max(col.r, max(col.g, col.b));
  float sat = maxC - minC;

  float bgPure = smoothstep(0.975, 0.998, lum) * (1.0 - smoothstep(0.0, 0.04, sat));
  float bgSoft = smoothstep(0.910, u_bgThreshold, lum) * (1.0 - smoothstep(0.0, 0.10, sat));
  float bg = max(bgPure, bgSoft * 0.75);
  float alpha = clamp(1.0 - bg, 0.0, 1.0);
  if (alpha < 0.04) discard;

  float epx = 0.004;
  float dL = texture2D(u_depth, v_uv - vec2(epx, 0.0)).r;
  float dR = texture2D(u_depth, v_uv + vec2(epx, 0.0)).r;
  float dU = texture2D(u_depth, v_uv - vec2(0.0, epx)).r;
  float dD = texture2D(u_depth, v_uv + vec2(0.0, epx)).r;
  vec3 normal = normalize(vec3((dL - dR) * 1.8, (dU - dD) * 1.8, 0.55));

  vec3 L = normalize(u_lightDir);
  float lambert = max(0.0, dot(normal, L));
  float ambient = 0.62;
  float lit = ambient + lambert * u_keyLight;
  col.rgb *= lit;

  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.8);
  col.rgb += u_rimColor * fresnel * u_rimStrength;

  vec3  halfV = normalize(L + viewDir);
  float spec = pow(max(0.0, dot(normal, halfV)), 28.0) * u_glow;
  col.rgb += vec3(spec) * 0.45;

  float hi = pow(maxC, 14.0) * u_glow;
  col.rgb += vec3(hi*0.4, hi*0.75, hi*1.0) * 0.32;

  gl_FragColor = vec4(col.rgb, alpha);
}`;

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function linkProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function makeGrid(N) {
  const uvs = [], indices = [];
  for (let y=0; y<=N; y++) for (let x=0; x<=N; x++) uvs.push(x/N, y/N);
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const a = y*(N+1)+x, b = a+1, c = a+(N+1), d = c+1;
    indices.push(a,b,c, c,b,d);
  }
  return { uvs: new Float32Array(uvs), idx: new Uint16Array(indices) };
}

/* ── Depth map generators ─── */
function blob(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.fillRect(cx-r, cy-r, r*2, r*2);
}

/* user.png — cosplay biru, full body, dua tangan ke atas, wajah jelas */
function depthMap_userBlue() {
  const W = 512, H = 642; // ~ 1080/1354 aspect
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0,    '#5a5a5a');
  g.addColorStop(0.15, '#8a8a8a');
  g.addColorStop(0.30, '#a8a8a8'); // chest forward
  g.addColorStop(0.55, '#909090');
  g.addColorStop(0.85, '#606060');
  g.addColorStop(1,    '#3a3a3a');
  x.fillStyle = g; x.fillRect(0,0,W,H);

  // Wajah — paling bright
  blob(x, W*.50, H*.12, W*.18, 'rgba(255,255,255,.95)');
  blob(x, W*.50, H*.10, W*.10, 'rgba(255,255,255,.85)'); // dahi
  // Rambut top + sisi (mid)
  blob(x, W*.50, H*.05, W*.20, 'rgba(180,180,180,.55)');
  blob(x, W*.30, H*.10, W*.14, 'rgba(170,170,170,.40)');
  blob(x, W*.70, H*.10, W*.14, 'rgba(170,170,170,.40)');
  // Dua tangan terangkat ke atas
  blob(x, W*.20, H*.18, W*.12, 'rgba(230,230,230,.65)');
  blob(x, W*.80, H*.18, W*.12, 'rgba(230,230,230,.65)');
  // Dada/leher
  blob(x, W*.50, H*.32, W*.20, 'rgba(220,220,220,.55)');
  // Pinggang
  blob(x, W*.50, H*.50, W*.16, 'rgba(180,180,180,.40)');
  // Kaki (recede)
  blob(x, W*.45, H*.78, W*.14, 'rgba(130,130,130,.30)');
  blob(x, W*.55, H*.82, W*.12, 'rgba(120,120,120,.28)');

  return c;
}

/* user2.png — cosplay putih elegan, kneeling, kepala+mahkota top */
function depthMap_userWhite() {
  const W = 512, H = 682;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0,    '#7a7a7a');
  g.addColorStop(0.18, '#a0a0a0');
  g.addColorStop(0.45, '#909090');
  g.addColorStop(0.75, '#606060');
  g.addColorStop(1,    '#3a3a3a');
  x.fillStyle = g; x.fillRect(0,0,W,H);

  // Mahkota
  blob(x, W*.50, H*.04, W*.18, 'rgba(255,255,255,.90)');
  // Wajah (tertutup HP, treat as forward anyway)
  blob(x, W*.50, H*.16, W*.22, 'rgba(255,255,255,.75)');
  // Tangan HP (depan wajah)
  blob(x, W*.55, H*.15, W*.10, 'rgba(255,255,255,.85)');
  // Lengan + tangan kiri menjulur
  blob(x, W*.25, H*.40, W*.16, 'rgba(220,220,220,.65)');
  blob(x, W*.18, H*.45, W*.10, 'rgba(230,230,230,.55)');
  // Lengan kanan
  blob(x, W*.62, H*.30, W*.12, 'rgba(200,200,200,.55)');
  // Dada
  blob(x, W*.50, H*.40, W*.22, 'rgba(190,190,190,.45)');
  // Lutut (depan)
  blob(x, W*.40, H*.74, W*.14, 'rgba(160,160,160,.45)');
  blob(x, W*.62, H*.78, W*.14, 'rgba(160,160,160,.42)');

  return c;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function makeGLTexture(gl, source) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  return tex;
}

export const DEPTH_GENERATORS = {
  userBlue:   depthMap_userBlue,
  userWhite:  depthMap_userWhite,
};

export class AvatarEngine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL not available');
    this.gl = gl;

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const vs = compileShader(gl, gl.VERTEX_SHADER,   VS_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_SRC);
    this.program = linkProgram(gl, vs, fs);
    gl.useProgram(this.program);

    this.attrs = { uv: gl.getAttribLocation(this.program, 'a_uv') };
    this.uni = {};
    ['mvp','depth','tex','depthStrength','aspect','time','floatAmp','breathe',
     'rimColor','rimStrength','glow','lightDir','keyLight','bgThreshold'].forEach(k => {
      this.uni[k] = gl.getUniformLocation(this.program, 'u_' + k);
    });

    const grid = makeGrid(96);
    this.idxCount = grid.idx.length;
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, grid.uvs, gl.STATIC_DRAW);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.idx, gl.STATIC_DRAW);

    this.state = {
      texAspect: 0.75,
      depthStrength: 0.40,
      floatAmp: 0.022,
      breathe: 0.003,
      rimColor: [0, 0.83, 1.0],
      rimStrength: 0.65,
      glow: 1.0,
      lightDir: [0.4, 0.7, 0.7],
      keyLight: 0.50,
      bgThreshold: 0.978,
      rotX: 0, rotY: 0, rotXTarget: 0, rotYTarget: 0,
      orbit: false, orbitT: 0,
    };

    this.textures = {};
    this.currentId = null;
    this.startTime = performance.now();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width  = Math.max(1, Math.floor(r.width  * dpr));
    this.canvas.height = Math.max(1, Math.floor(r.height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  async addAvatar(id, imgSrc, depthGenName = "userBlue", bgThreshold = 0.985) {
    const img = await loadImage(imgSrc);
    const dGen = DEPTH_GENERATORS[depthGenName] || DEPTH_GENERATORS.userBlue;
    const depthCanvas = dGen();
    const tex      = makeGLTexture(this.gl, img);
    const depthTex = makeGLTexture(this.gl, depthCanvas);
    this.textures[id] = {
      tex, depthTex,
      aspect: img.naturalWidth / img.naturalHeight,
      bgThresh: bgThreshold,
      kind: depthGenName,
    };
    return this.textures[id];
  }

  selectAvatar(id) {
    if (!this.textures[id]) return false;
    this.currentId = id;
    const t = this.textures[id];
    this.state.texAspect   = t.aspect;
    this.state.bgThreshold = t.bgThresh;
    return true;
  }

  setRotation(rx, ry) { this.state.rotXTarget = rx; this.state.rotYTarget = ry; }
  setEmotion(cfg) {
    if (cfg.float  !== undefined) this.state.floatAmp    = cfg.float;
    if (cfg.breath !== undefined) this.state.breathe     = cfg.breath;
    if (cfg.rimA   !== undefined) this.state.rimStrength = cfg.rimA;
    if (cfg.rimRGB !== undefined) this.state.rimColor    = cfg.rimRGB;
    if (cfg.glow   !== undefined) this.state.glow        = cfg.glow;
  }
  setOrbit(on) { this.state.orbit = on; }
  setDepthStrength(v) { this.state.depthStrength = v; }
  setLightDir(x, y, z) { this.state.lightDir = [x, y, z]; }
  getRotation() { return { x: this.state.rotX, y: this.state.rotY }; }

  render(extraShakeX = 0, extraShakeY = 0) {
    if (!this.currentId) return;
    const gl = this.gl;
    const t = (performance.now() - this.startTime) / 1000;
    const s = this.state;

    if (s.orbit) {
      s.orbitT += 0.005;
      s.rotYTarget = Math.sin(s.orbitT) * 0.55;
      s.rotXTarget = Math.sin(s.orbitT * 0.4) * 0.10;
    }
    s.rotX += (s.rotXTarget - s.rotX) * 0.06;
    s.rotY += (s.rotYTarget - s.rotY) * 0.06;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.enableVertexAttribArray(this.attrs.uv);
    gl.vertexAttribPointer(this.attrs.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

    const T = this.textures[this.currentId];
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.tex);
    gl.uniform1i(this.uni.tex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.depthTex);
    gl.uniform1i(this.uni.depth, 1);

    const aspect = this.canvas.width / this.canvas.height;
    const P = mat4.perspective(Math.PI / 4.5, aspect, 0.1, 50);
    const V = mat4.translate(extraShakeX, extraShakeY - 0.05, -2.1);
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

    gl.drawElements(gl.TRIANGLES, this.idxCount, gl.UNSIGNED_SHORT, 0);
  }
}
