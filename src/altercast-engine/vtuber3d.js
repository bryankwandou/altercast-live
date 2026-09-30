/* ═══════════════════════════════════════════════════════════
   AlterCast VTuber 3D Engine v3.5
   Real procedural 3D character
   • Sphere head + curved face patch (photo wraps around head)
   • 3D eye spheres with iris + pupil + highlight
   • Hair strand cards for volume
   • 3-point cinematic lighting (key + fill + rim + hair)
   • Subsurface scattering approximation in shader
   • Hierarchical bone-style animation
═══════════════════════════════════════════════════════════ */

/* ── mat4 ────────────────────────────────────────────────── */
export const mat4 = {
  ident() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
  perspective(fov, aspect, near, far) {
    const f = 1/Math.tan(fov/2), nf = 1/(near-far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
  },
  rotY(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); },
  rotX(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); },
  rotZ(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); },
  translate(x,y,z){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); },
  scale(x,y,z){ return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]); },
  multiply(a,b){
    const r = new Float32Array(16);
    for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
      r[i*4+j] = a[0*4+j]*b[i*4]+a[1*4+j]*b[i*4+1]+a[2*4+j]*b[i*4+2]+a[3*4+j]*b[i*4+3];
    }
    return r;
  },
  chain(arr){ let m = arr[0]; for (let i=1;i<arr.length;i++) m = mat4.multiply(m, arr[i]); return m; },
};

/* ── Primitive generators ───────────────────────────────── */
function makeSphere(r, latSeg, lonSeg) {
  const pos=[], nor=[], uv=[], idx=[];
  for (let lat=0; lat<=latSeg; lat++) {
    const theta = lat * Math.PI / latSeg;
    const sT=Math.sin(theta), cT=Math.cos(theta);
    for (let lon=0; lon<=lonSeg; lon++) {
      const phi = lon * 2*Math.PI / lonSeg;
      const sP=Math.sin(phi), cP=Math.cos(phi);
      const x = sT*cP, y = cT, z = sT*sP;
      pos.push(x*r, y*r, z*r); nor.push(x, y, z);
      let u = (lon/lonSeg) - 0.25; if (u < 0) u += 1;
      uv.push(u, 1 - lat/latSeg);
    }
  }
  for (let lat=0; lat<latSeg; lat++) for (let lon=0; lon<lonSeg; lon++) {
    const a = lat*(lonSeg+1)+lon, b = a+lonSeg+1;
    idx.push(a, b, a+1, a+1, b, b+1);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

function makeCylinder(rTop, rBot, h, seg, cap=true) {
  const pos=[], nor=[], uv=[], idx=[];
  for (let y=0; y<=1; y++) {
    const r = y===0 ? rBot : rTop, py = y===0 ? -h/2 : h/2;
    for (let i=0; i<=seg; i++) {
      const phi = i*2*Math.PI/seg, cP=Math.cos(phi), sP=Math.sin(phi);
      pos.push(cP*r, py, sP*r);
      const ny = (rBot-rTop)/h*.5, len = Math.sqrt(cP*cP + ny*ny + sP*sP);
      nor.push(cP/len, ny/len, sP/len);
      uv.push(i/seg, y);
    }
  }
  for (let i=0; i<seg; i++) { const a=i, b=i+seg+1; idx.push(a,b,a+1,a+1,b,b+1); }
  if (cap) {
    const topS = pos.length/3;
    pos.push(0,h/2,0); nor.push(0,1,0); uv.push(.5,.5);
    for (let i=0; i<=seg; i++) {
      const phi=i*2*Math.PI/seg;
      pos.push(Math.cos(phi)*rTop, h/2, Math.sin(phi)*rTop);
      nor.push(0,1,0); uv.push(.5+Math.cos(phi)*.5, .5+Math.sin(phi)*.5);
    }
    for (let i=0; i<seg; i++) idx.push(topS, topS+1+i, topS+2+i);
    const botS = pos.length/3;
    pos.push(0,-h/2,0); nor.push(0,-1,0); uv.push(.5,.5);
    for (let i=0; i<=seg; i++) {
      const phi=i*2*Math.PI/seg;
      pos.push(Math.cos(phi)*rBot, -h/2, Math.sin(phi)*rBot);
      nor.push(0,-1,0); uv.push(.5+Math.cos(phi)*.5, .5+Math.sin(phi)*.5);
    }
    for (let i=0; i<seg; i++) idx.push(botS, botS+2+i, botS+1+i);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

function makePlane(w, h, sx=1, sy=1) {
  const pos=[], nor=[], uv=[], idx=[];
  for (let y=0; y<=sy; y++) for (let x=0; x<=sx; x++) {
    pos.push((x/sx - .5)*w, (y/sy - .5)*h, 0);
    nor.push(0,0,1); uv.push(x/sx, 1 - y/sy);
  }
  for (let y=0; y<sy; y++) for (let x=0; x<sx; x++) {
    const a = y*(sx+1)+x, b = a+sx+1;
    idx.push(a,b,a+1,a+1,b,b+1);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

// Curved patch — a plane bent to wrap around a sphere of given radius
// Used for the face: photo sits on a curved surface following the head
function makeCurvedPatch(w, h, segments, sphereR, wrapAmount = 0.85) {
  const pos=[], nor=[], uv=[], idx=[];
  for (let y=0; y<=segments; y++) {
    for (let x=0; x<=segments; x++) {
      const u = x/segments, v = y/segments;
      const px = (u - .5) * w;
      const py = (v - .5) * h;
      const d2 = px*px + py*py;
      const r2 = sphereR*sphereR;
      const z = d2 < r2 ? Math.sqrt(r2 - d2) - sphereR * wrapAmount : 0;
      pos.push(px, py, z);
      // Approximate sphere normal at this point
      const cz = sphereR - z + sphereR * (1 - wrapAmount);
      const len = Math.sqrt(px*px + py*py + cz*cz) || 1;
      nor.push(px/len, py/len, cz/len);
      uv.push(u, 1-v);
    }
  }
  for (let y=0; y<segments; y++) for (let x=0; x<segments; x++) {
    const a = y*(segments+1)+x, b = a+segments+1;
    idx.push(a,b,a+1,a+1,b,b+1);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

// Hair card — a curved strip that drapes down from the head
function makeHairCard(width, length, segments, curve = 0.25) {
  const pos=[], nor=[], uv=[], idx=[];
  for (let y=0; y<=segments; y++) {
    const t = y / segments;
    // Bezier-like curve: starts at origin, curves out and down
    const cy = -t * length;
    const cz = Math.sin(t * Math.PI * 0.5) * curve * length;
    for (let x=0; x<=1; x++) {
      const px = (x - .5) * width * (1 - t*.3);
      pos.push(px, cy, cz);
      nor.push(0, 0, 1);
      uv.push(x, 1 - t);
    }
  }
  for (let y=0; y<segments; y++) {
    const a = y*2, b = a+2;
    idx.push(a,b,a+1, a+1,b,b+1);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

/* ── WebGL helpers ──────────────────────────────────────── */
function compile(gl, t, src) {
  const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('GLSL:', gl.getShaderInfoLog(s)); return null; }
  return s;
}
function link(gl, vs, fs) {
  const p = gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('LINK:', gl.getProgramInfoLog(p)); return null; }
  return p;
}
function upload(gl, g) {
  const m = {};
  m.pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
  m.nor = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.bufferData(gl.ARRAY_BUFFER, g.nor, gl.STATIC_DRAW);
  m.uv  = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.uv);  gl.bufferData(gl.ARRAY_BUFFER, g.uv,  gl.STATIC_DRAW);
  m.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
  m.count = g.idx.length;
  return m;
}

/* ── Shaders ────────────────────────────────────────────── */
const VS = `
attribute vec3 a_pos;
attribute vec3 a_nor;
attribute vec2 a_uv;
uniform mat4 u_mvp;
uniform mat4 u_model;
varying vec3 v_wpos;
varying vec3 v_nor;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  v_wpos = (u_model * vec4(a_pos, 1.0)).xyz;
  v_nor  = normalize((u_model * vec4(a_nor, 0.0)).xyz);
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}`;

const FS = `
precision highp float;
varying vec3 v_wpos;
varying vec3 v_nor;
varying vec2 v_uv;

uniform vec3 u_color;
uniform vec3 u_color2;
uniform float u_colorBlend;

uniform sampler2D u_tex;
uniform float     u_useTex;
uniform float     u_alphaCut;
uniform float     u_bgThreshold;

// 3-point lighting
uniform vec3 u_keyDir;     uniform vec3 u_keyColor;     uniform float u_keyAmt;
uniform vec3 u_fillDir;    uniform vec3 u_fillColor;    uniform float u_fillAmt;
uniform vec3 u_rimDir;     uniform vec3 u_rimColor;     uniform float u_rimAmt;
uniform vec3 u_hairDir;    uniform vec3 u_hairColor;    uniform float u_hairAmt;
uniform vec3 u_ambient;

uniform float u_sssAmt;       // subsurface scattering
uniform vec3  u_sssColor;
uniform float u_glossAmt;
uniform vec3  u_camPos;

uniform float u_uvAlphaY0;    // alpha fade boundaries (for hair tips)
uniform float u_uvAlphaY1;

void main() {
  vec3 N = normalize(v_nor);
  vec3 V = normalize(u_camPos - v_wpos);

  // Albedo
  vec3 base;
  if (u_colorBlend > 1.5) {
    float t = smoothstep(0.42, 0.58, v_uv.y);
    base = mix(u_color2, u_color, t);
  } else if (u_colorBlend > 0.5) {
    float t = smoothstep(0.3, 0.7, v_uv.y);
    base = mix(u_color, u_color2, t);
  } else {
    base = u_color;
  }

  float alpha = 1.0;
  vec3 albedo = base;
  if (u_useTex > 0.5) {
    vec4 t = texture2D(u_tex, v_uv);
    // Smart BG removal
    float lum = (t.r + t.g + t.b) / 3.0;
    float mnC = min(t.r, min(t.g, t.b));
    float mxC = max(t.r, max(t.g, t.b));
    float sat = mxC - mnC;
    float bgPure = smoothstep(0.978, 0.998, lum) * (1.0 - smoothstep(0.0, 0.035, sat));
    float bgSoft = smoothstep(0.92, u_bgThreshold, lum) * (1.0 - smoothstep(0.0, 0.10, sat));
    float bg = max(bgPure, bgSoft * 0.7);
    alpha = clamp(1.0 - bg, 0.0, 1.0);
    if (alpha < u_alphaCut) discard;
    albedo = t.rgb;
  }

  // Alpha fade for hair tips (uv.y range)
  if (u_uvAlphaY1 > 0.0) {
    float a = smoothstep(u_uvAlphaY0, u_uvAlphaY1, v_uv.y);
    alpha *= a;
  }

  // 3-point lighting (each direction is FROM light TO surface; we dot with normal)
  vec3 L1 = normalize(u_keyDir);
  vec3 L2 = normalize(u_fillDir);
  vec3 L3 = normalize(u_rimDir);
  vec3 L4 = normalize(u_hairDir);

  // Half-lambert wrap for soft anime skin look
  float keyW  = pow(dot(N, L1) * 0.5 + 0.5, 1.5);
  float fillW = pow(dot(N, L2) * 0.5 + 0.5, 1.7);
  float hairW = pow(dot(N, L4) * 0.5 + 0.5, 2.0);

  // Rim: fresnel against view direction with bias from light
  float fresnel = pow(1.0 - max(0.0, dot(N, V)), 2.6);
  float rimL = max(0.0, dot(N, L3)) * 0.5 + 0.5;
  float rim = fresnel * rimL;

  vec3 light = u_ambient
             + u_keyColor  * keyW  * u_keyAmt
             + u_fillColor * fillW * u_fillAmt
             + u_hairColor * hairW * u_hairAmt;

  vec3 col = albedo * light;

  // Rim accent
  col += u_rimColor * rim * u_rimAmt;

  // SSS approximation: red glow in shadowed thin areas (ears, nose tip)
  float backlight = max(0.0, dot(-N, L1));
  col += albedo * u_sssColor * backlight * u_sssAmt;

  // Blinn-Phong specular
  vec3 H = normalize(L1 + V);
  float spec = pow(max(0.0, dot(N, H)), 24.0) * u_glossAmt;
  col += u_keyColor * spec * 0.5;

  gl_FragColor = vec4(col, alpha);
}`;

/* ── VTuber3D ───────────────────────────────────────────── */
export class VTuber3D {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { alpha:true, antialias:true, premultipliedAlpha:false });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    gl.clearColor(0,0,0,0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);

    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    this.prog = link(gl, vs, fs);
    gl.useProgram(this.prog);

    this.A = {
      pos: gl.getAttribLocation(this.prog, 'a_pos'),
      nor: gl.getAttribLocation(this.prog, 'a_nor'),
      uv:  gl.getAttribLocation(this.prog, 'a_uv'),
    };
    this.U = {};
    ['u_mvp','u_model','u_color','u_color2','u_colorBlend',
     'u_tex','u_useTex','u_alphaCut','u_bgThreshold',
     'u_keyDir','u_keyColor','u_keyAmt',
     'u_fillDir','u_fillColor','u_fillAmt',
     'u_rimDir','u_rimColor','u_rimAmt',
     'u_hairDir','u_hairColor','u_hairAmt',
     'u_ambient','u_sssAmt','u_sssColor','u_glossAmt','u_camPos',
     'u_uvAlphaY0','u_uvAlphaY1'].forEach(k => {
      this.U[k.replace('u_','')] = gl.getUniformLocation(this.prog, k);
    });

    // Geometry library
    this.geo = {
      head:     upload(gl, makeSphere(1, 36, 48)),
      hairCap:  upload(gl, makeSphere(1, 28, 40)),
      neck:     upload(gl, makeCylinder(.55, .65, 1, 24, true)),
      torso:    upload(gl, makeCylinder(.92, 1.12, 1, 32, true)),
      shoulder: upload(gl, makeSphere(1, 16, 16)),
      arm:      upload(gl, makeCylinder(.32, .38, 1, 16, true)),
      face:     upload(gl, makeCurvedPatch(1, 1.1, 24, 0.6, 0.85)),
      eye:      upload(gl, makeSphere(1, 16, 20)),
      iris:     upload(gl, makePlane(1, 1)),
      pupil:    upload(gl, makePlane(1, 1)),
      hilight:  upload(gl, makePlane(1, 1)),
      ear:      upload(gl, makeSphere(1, 10, 10)),
      hairCard: upload(gl, makeHairCard(1, 1, 12, 0.18)),
      mouth:    upload(gl, makePlane(1, 1)),
    };

    this.avatars = {};
    this.current = null;

    // Cinematic 3-point lighting defaults
    this.state = {
      rotX:0, rotY:0, rotXTarget:0, rotYTarget:0,
      orbit:false, orbitT:0,
      headRotX:0, headRotY:0, headRotXTarget:0, headRotYTarget:0,
      eyeX:0, eyeY:0, eyeXTarget:0, eyeYTarget:0,
      breath:1,
      blink:0, blinkT:0,
      mouthOpen:0,
      armSwayL:0, armSwayR:0,
      // Lighting
      keyDir:     [0.7, 1.0, 1.2],   keyColor:  [1.0, 0.96, 0.92], keyAmt:0.85,
      fillDir:    [-1.0, 0.3, 0.8],  fillColor: [0.78, 0.85, 1.0], fillAmt:0.40,
      rimDir:     [-0.3, 0.8, -1.2], rimColor:  [0.0, 0.83, 1.0],  rimAmt:0.65,
      hairDirN:   [0, 1.2, 0.2],     hairColor: [1.0, 0.92, 0.78], hairAmt:0.45,
      ambient:    [0.10, 0.11, 0.16],
      sssAmt:     0.10,
      sssColor:   [1.0, 0.45, 0.30],
    };

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

  loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; });
  }
  makeTexture(img) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return t;
  }

  // Create a cropped texture for face area only.
  // crop = { x, y, w, h } as fractions 0..1 of original image
  makeCroppedTexture(img, crop) {
    const c = document.createElement('canvas');
    const srcW = img.naturalWidth, srcH = img.naturalHeight;
    const cx = Math.max(0, Math.min(srcW, crop.x * srcW));
    const cy = Math.max(0, Math.min(srcH, crop.y * srcH));
    const cw = Math.max(1, Math.min(srcW - cx, crop.w * srcW));
    const ch = Math.max(1, Math.min(srcH - cy, crop.h * srcH));
    // Square aspect for face — pad on shorter side
    const size = Math.max(cw, ch);
    c.width = c.height = Math.round(size);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const offsetX = (size - cw) / 2;
    const offsetY = (size - ch) / 2;
    ctx.drawImage(img, cx, cy, cw, ch, offsetX, offsetY, cw, ch);
    return this.makeTexture(c);
  }

  samplePalette(img, samples) {
    const c = document.createElement('canvas');
    const W = 120;
    c.width = W; c.height = Math.floor(W * img.naturalHeight / img.naturalWidth);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, c.width, c.height);
    const grab = (px, py) => {
      const d = x.getImageData(Math.floor(px*c.width), Math.floor(py*c.height), 1, 1).data;
      return [d[0]/255, d[1]/255, d[2]/255];
    };
    const avg = (pts) => {
      const r = pts.reduce((a,p)=>{ const c=grab(p[0],p[1]); return [a[0]+c[0],a[1]+c[1],a[2]+c[2]]; }, [0,0,0]);
      return [r[0]/pts.length, r[1]/pts.length, r[2]/pts.length];
    };
    return {
      skin: avg(samples.skin || [[.55,.46],[.50,.50],[.60,.45]]),
      hair: avg(samples.hair || [[.55,.24],[.65,.28],[.45,.28]]),
      body: avg(samples.body || [[.50,.82],[.40,.78],[.60,.80]]),
      eye:  avg(samples.eye  || [[.50,.43]]),
    };
  }

  async addAvatar(id, src, config = {}) {
    const img = await this.loadImage(src);
    const palette = this.samplePalette(img, config.samples || {});
    const tex = this.makeTexture(img);
    // If faceCrop provided (fractions of image), build a dedicated face texture
    // focused on the face region. Otherwise face uses the full image (legacy).
    const faceTex = config.faceCrop
      ? this.makeCroppedTexture(img, config.faceCrop)
      : tex;
    // Darken iris color from sampled eye (sampled point likely hits skin around eye)
    const iris = config.irisColor || [0.20, 0.13, 0.10];
    this.avatars[id] = {
      img, tex, faceTex,
      aspect: img.naturalWidth / img.naturalHeight,
      bgThreshold: config.bgThreshold ?? 0.978,
      faceScaleY: config.faceScaleY ?? 1.0,
      faceWrap:   config.faceWrap   ?? 0.85,
      torsoColor: config.torsoColor ?? palette.body,
      iris,
      ...palette,
      config,
    };
    return this.avatars[id];
  }

  selectAvatar(id) {
    if (!this.avatars[id]) return false;
    this.current = id;
    return true;
  }

  setRotation(rx, ry) { this.state.rotXTarget = rx; this.state.rotYTarget = ry; }
  setHeadLook(rx, ry) { this.state.headRotXTarget = rx; this.state.headRotYTarget = ry; }
  setEyeLook(rx, ry)  { this.state.eyeXTarget = rx; this.state.eyeYTarget = ry; }
  setOrbit(on)        { this.state.orbit = on; }
  setMouthOpen(v)     { this.state.mouthOpen = Math.max(0, Math.min(1, v)); }
  setEmotion(cfg) {
    if (cfg.rimRGB) this.state.rimColor = cfg.rimRGB;
    if (cfg.rimA !== undefined) this.state.rimAmt = cfg.rimA;
  }
  setLightDir(){}     // legacy compat
  setDepthStrength(){}// legacy compat
  getRotation() { return { x: this.state.rotX, y: this.state.rotY }; }

  /* ── Draw mesh ──────────────────────────────────────── */
  _draw(mesh, model, opts = {}) {
    const gl = this.gl, s = this.state;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
    gl.enableVertexAttribArray(this.A.pos); gl.vertexAttribPointer(this.A.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nor);
    gl.enableVertexAttribArray(this.A.nor); gl.vertexAttribPointer(this.A.nor, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
    gl.enableVertexAttribArray(this.A.uv);  gl.vertexAttribPointer(this.A.uv,  2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);

    const aspect = this.canvas.width / this.canvas.height;
    const P = mat4.perspective(Math.PI/4.5, aspect, 0.1, 100);
    const camDist = 3.4;
    const V = mat4.chain([
      mat4.translate(0, 0, -camDist),
      mat4.rotX(s.rotX),
      mat4.rotY(s.rotY),
    ]);
    const mvp = mat4.multiply(P, mat4.multiply(V, model));

    gl.uniformMatrix4fv(this.U.mvp, false, mvp);
    gl.uniformMatrix4fv(this.U.model, false, model);

    gl.uniform3fv(this.U.color,    opts.color  || [1,1,1]);
    gl.uniform3fv(this.U.color2,   opts.color2 || opts.color || [1,1,1]);
    gl.uniform1f (this.U.colorBlend, opts.colorBlend || 0);
    gl.uniform1f (this.U.useTex,   opts.useTex ? 1 : 0);
    gl.uniform1f (this.U.alphaCut, opts.alphaCut || 0);
    gl.uniform1f (this.U.bgThreshold, opts.bgThreshold || 0.978);

    gl.uniform3fv(this.U.keyDir,   s.keyDir);
    gl.uniform3fv(this.U.keyColor, s.keyColor);
    gl.uniform1f (this.U.keyAmt,   s.keyAmt);
    gl.uniform3fv(this.U.fillDir,  s.fillDir);
    gl.uniform3fv(this.U.fillColor,s.fillColor);
    gl.uniform1f (this.U.fillAmt,  s.fillAmt);
    gl.uniform3fv(this.U.rimDir,   s.rimDir);
    gl.uniform3fv(this.U.rimColor, opts.rimColor || s.rimColor);
    gl.uniform1f (this.U.rimAmt,   opts.rimAmt !== undefined ? opts.rimAmt : s.rimAmt);
    gl.uniform3fv(this.U.hairDir,  s.hairDirN);
    gl.uniform3fv(this.U.hairColor,s.hairColor);
    gl.uniform1f (this.U.hairAmt,  s.hairAmt);
    gl.uniform3fv(this.U.ambient,  s.ambient);
    gl.uniform1f (this.U.sssAmt,   opts.sss !== undefined ? opts.sss : s.sssAmt);
    gl.uniform3fv(this.U.sssColor, s.sssColor);
    gl.uniform1f (this.U.glossAmt, opts.gloss !== undefined ? opts.gloss : 0.3);
    gl.uniform3fv(this.U.camPos,   [0, 0, camDist]);
    gl.uniform1f (this.U.uvAlphaY0,opts.alphaY0 || 0);
    gl.uniform1f (this.U.uvAlphaY1,opts.alphaY1 || 0);

    if (opts.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, opts.tex);
      gl.uniform1i(this.U.tex, 0);
    }
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  /* ── Frame render ─────────────────────────────────── */
  render(dx = 0, dy = 0) {
    if (!this.current) return;
    const gl = this.gl;
    const s = this.state;
    const av = this.avatars[this.current];
    const t = (performance.now() - this.startTime) / 1000;

    if (s.orbit) {
      s.orbitT += 0.005;
      s.rotYTarget = Math.sin(s.orbitT) * 0.95;
      s.rotXTarget = Math.sin(s.orbitT * 0.4) * 0.07;
    }
    // Lerp
    s.rotX += (s.rotXTarget - s.rotX) * 0.06;
    s.rotY += (s.rotYTarget - s.rotY) * 0.06;
    s.headRotX += (s.headRotXTarget - s.headRotX) * 0.12;
    s.headRotY += (s.headRotYTarget - s.headRotY) * 0.12;
    s.eyeX += (s.eyeXTarget - s.eyeX) * 0.18;
    s.eyeY += (s.eyeYTarget - s.eyeY) * 0.18;

    // Idle micro motion
    const idleHX = Math.sin(t * .55) * 0.025;
    const idleHY = Math.sin(t * .43) * 0.055;
    s.breath = 1 + Math.sin(t * 1.0) * 0.014;

    // Blink (random interval, smooth)
    s.blinkT += 0.014;
    if (s.blinkT > 3.5 + Math.random() * 2) s.blinkT = -0.18;
    s.blink = (s.blinkT > -0.12 && s.blinkT < 0.12) ? 1 - Math.abs(s.blinkT/0.12) : 0;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);

    const ROOT = mat4.translate(dx, dy - 0.12, 0);

    /* ── Torso ── */
    const torsoLocal = mat4.chain([
      mat4.translate(0, -0.85, 0),
      mat4.scale(0.74, 0.66 * s.breath, 0.52),
    ]);
    this._draw(this.geo.torso, mat4.multiply(ROOT, torsoLocal), {
      color: av.torsoColor, gloss: 0.2, sss: 0.04,
    });

    /* ── Neck ── */
    this._draw(this.geo.neck, mat4.multiply(ROOT, mat4.chain([
      mat4.translate(0, -0.15, 0),
      mat4.scale(0.16, 0.18, 0.16),
    ])), { color: av.skin, gloss: 0.4, sss: 0.18 });

    /* ── Shoulders + Arms ── */
    [-1, 1].forEach(side => {
      this._draw(this.geo.shoulder, mat4.multiply(ROOT, mat4.chain([
        mat4.translate(side * 0.56, -0.55, 0),
        mat4.scale(0.20, 0.20, 0.20),
      ])), { color: av.torsoColor, gloss: 0.15 });

      const armSway = Math.sin(t * 0.7 + side) * 0.06;
      this._draw(this.geo.arm, mat4.multiply(ROOT, mat4.chain([
        mat4.translate(side * 0.56, -0.55, 0),
        mat4.rotZ(side * 0.30 + armSway),
        mat4.translate(0, -0.32, 0),
        mat4.scale(0.18, 0.42, 0.18),
      ])), { color: av.torsoColor, gloss: 0.15 });

      this._draw(this.geo.arm, mat4.multiply(ROOT, mat4.chain([
        mat4.translate(side * 0.56, -0.55, 0),
        mat4.rotZ(side * 0.30 + armSway),
        mat4.translate(side * 0.10, -0.7, 0.08),
        mat4.rotZ(side * 0.20),
        mat4.translate(0, -0.28, 0),
        mat4.scale(0.15, 0.38, 0.15),
      ])), { color: av.skin, gloss: 0.3, sss: 0.15 });
    });

    /* ── Head ── */
    const headPos = mat4.translate(0, 0.18, 0);
    const headRot = mat4.multiply(mat4.rotY(s.headRotY + idleHY), mat4.rotX(s.headRotX + idleHX));
    const headXform = mat4.multiply(headPos, headRot);

    // Skull (skin + hair top)
    this._draw(this.geo.head, mat4.multiply(ROOT, mat4.chain([
      headXform, mat4.scale(0.48, 0.55, 0.50),
    ])), {
      color: av.skin, color2: av.hair, colorBlend: 2.0,
      gloss: 0.18, sss: 0.18,
    });

    // Hair cap (larger, hair color, slightly back-shifted)
    this._draw(this.geo.hairCap, mat4.multiply(ROOT, mat4.chain([
      headXform,
      mat4.translate(0, 0.03, -0.03),
      mat4.scale(0.52, 0.55, 0.52),
    ])), { color: av.hair, gloss: 0.7 });

    // Ears
    [-1, 1].forEach(side => {
      this._draw(this.geo.ear, mat4.multiply(ROOT, mat4.chain([
        headXform,
        mat4.translate(side * 0.46, -0.02, 0.02),
        mat4.scale(0.08, 0.13, 0.06),
      ])), { color: av.skin, gloss: 0.3, sss: 0.30 });
    });

    /* ── Face (curved patch with photo, wraps around head front) ── */
    /* Use cropped face texture when available — full-body cosplay photos
       would otherwise show body/clothing on the face area. */
    this._draw(this.geo.face, mat4.multiply(ROOT, mat4.chain([
      headXform,
      mat4.translate(0, 0.02, 0.10),
      mat4.scale(0.90, 1.04 * av.faceScaleY, 1),
    ])), {
      useTex: 1, tex: av.faceTex || av.tex, alphaCut: 0.06,
      bgThreshold: av.bgThreshold,
      gloss: 0.10, sss: 0.05,
    });

    /* ── Eye spheres ── */
    [-1, 1].forEach(side => {
      // Sclera (white)
      const eyeBase = mat4.chain([
        headXform,
        mat4.translate(side * 0.13, 0.04, 0.40),
        mat4.scale(0.075, 0.075 * (1 - s.blink * 0.9), 0.075),
      ]);
      this._draw(this.geo.eye, mat4.multiply(ROOT, eyeBase), {
        color: [0.95, 0.94, 0.91], gloss: 0.7,
      });

      // Iris (in front of sclera, follows eyeLook)
      const irisM = mat4.chain([
        headXform,
        mat4.translate(side * 0.13 + s.eyeX * 0.03, 0.04 + s.eyeY * 0.02, 0.46),
        mat4.scale(0.045, 0.045 * (1 - s.blink * 0.85), 0.01),
      ]);
      this._draw(this.geo.iris, mat4.multiply(ROOT, irisM), {
        color: av.iris, gloss: 0.9,
      });

      // Pupil (smaller, darker, on top of iris)
      const pupilM = mat4.chain([
        headXform,
        mat4.translate(side * 0.13 + s.eyeX * 0.03, 0.04 + s.eyeY * 0.02, 0.466),
        mat4.scale(0.018, 0.018 * (1 - s.blink * 0.85), 0.01),
      ]);
      this._draw(this.geo.pupil, mat4.multiply(ROOT, pupilM), {
        color: [0.04, 0.03, 0.05],
      });

      // Highlight (white spec dot, offset top-left)
      const hilightM = mat4.chain([
        headXform,
        mat4.translate(side * 0.13 + s.eyeX * 0.03 - 0.012, 0.04 + s.eyeY * 0.02 + 0.012, 0.470),
        mat4.scale(0.012, 0.012 * (1 - s.blink * 0.85), 0.01),
      ]);
      this._draw(this.geo.hilight, mat4.multiply(ROOT, hilightM), {
        color: [1, 1, 1], gloss: 0,
      });
    });

    /* ── Mouth ── */
    if (s.mouthOpen > 0.04) {
      this._draw(this.geo.mouth, mat4.multiply(ROOT, mat4.chain([
        headXform,
        mat4.translate(0, -0.14, 0.47),
        mat4.scale(0.07, 0.045 * s.mouthOpen, 0.01),
      ])), { color: [0.20, 0.06, 0.10] });
    }

    /* ── Hair strand cards (volumetric hair) ── */
    const STRANDS = 14;
    for (let i=0; i<STRANDS; i++) {
      const angle = (i / STRANDS) * Math.PI * 2;
      const radius = 0.45;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      const skipFront = Math.abs(angle - Math.PI*0.5) < 0.6;  // skip strands directly in front
      if (skipFront) continue;
      const sway = Math.sin(t * 0.9 + i * 0.45) * 0.05;
      this._draw(this.geo.hairCard, mat4.multiply(ROOT, mat4.chain([
        headXform,
        mat4.translate(px, 0.35, pz),
        mat4.rotY(-angle + Math.PI*0.5 + sway*0.3),
        mat4.rotZ(sway),
        mat4.rotX(0.12),
        mat4.scale(0.18, 0.85, 1),
      ])), {
        color: av.hair, color2: av.hair, gloss: 0.6,
        alphaY0: 0.0, alphaY1: 0.18,    // fade tips toward bottom
      });
    }
  }
}

