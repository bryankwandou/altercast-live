/* ═══════════════════════════════════════════════════════════
   AlterCast — Keqing GLB Engine (Main Avatar Renderer)
   Static import Three.js via importmap di live.html.
   Full 3D dari semua sisi — model Keqing + wajah asli user.
═══════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class KeqingGLBRenderer {
  constructor(canvas) {
    this.canvas = canvas;

    this.state = {
      rotX: 0, rotY: 0,
      rotXTarget: 0, rotYTarget: 0,
      orbit: false, orbitT: 0,
    };

    this.renderer    = null;
    this.scene       = null;
    this.camera      = null;
    this._model      = null;
    this._mixer      = null;
    this._clock      = new THREE.Clock();
    this._loader     = new GLTFLoader();
    this._loaded     = false;
    this._avatars    = {};
    this._currentId  = null;
    this._faceOverlay = null;
    this._headAnchor  = null;
    this._modelHeadY  = 0.85;
    this._lights      = { key: null, fill: null, rim: null, amb: null };
  }

  /* ── Init renderer ──────────────────────────────────── */
  async init() {
    try { this._setupRenderer(); return true; }
    catch (e) { console.error("[KeqingGLB] init error:", e.message); return false; }
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace  = THREE.SRGBColorSpace;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();

    /* Camera — full-body portrait, slight low angle */
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    this.camera.position.set(0, 0.55, 3.8);
    this.camera.lookAt(0, 0.45, 0);

    /* 3-point cinematic lighting — refs stored for per-avatar override */
    const key  = new THREE.DirectionalLight(0xfff4e0, 3.0);
    key.position.set(2, 5, 3);
    this.scene.add(key);
    this._lights.key = key;

    const fill = new THREE.DirectionalLight(0xb0c8ff, 1.1);
    fill.position.set(-2, 2, 1);
    this.scene.add(fill);
    this._lights.fill = fill;

    const rim  = new THREE.DirectionalLight(0x00d4ff, 1.6);
    rim.position.set(-0.5, 3, -2.5);
    this.scene.add(rim);
    this._lights.rim = rim;

    const amb  = new THREE.AmbientLight(0x18202e, 2.0);
    this.scene.add(amb);
    this._lights.amb = amb;
    this.resize();
  }

  /* ── Load GLB ──────────────────────────────────────── */
  async loadModel(glbSrc) {
    return new Promise((resolve) => {
      this._loader.load(
        glbSrc,
        (gltf) => {
          const model = gltf.scene;

          /* Auto-scale & center */
          const box    = new THREE.Box3().setFromObject(model);
          const size   = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const s      = 2.0 / Math.max(size.x, size.y, size.z);
          model.scale.setScalar(s);
          model.position.sub(center.multiplyScalar(s));

          /* Feet at y=0, then drop so waist is near origin */
          const b2 = new THREE.Box3().setFromObject(model);
          model.position.y -= b2.min.y;
          model.position.y -= size.y * s * 0.52;

          /* ── Estimate head Y in model-local space ── */
          this._modelHeadY = size.y * s * 0.36; /* ~top 28% of scaled height */

          model.traverse(c => {
            if (!c.isMesh) return;
            const matArr = Array.isArray(c.material) ? c.material : [c.material];
            console.log("[KeqingGLB] mesh:", c.name,
              "| mat:", matArr.map(m => m?.name));
            matArr.forEach(m => {
              if (!m) return;
              m.side = THREE.FrontSide;
              if (m.map) { m.map.anisotropy = 8; m.map.needsUpdate = true; }
            });
          });

          this.scene.add(model);
          this._model = model;

          /* ── Find head bone for face anchor ── */
          this._headAnchor = null;
          model.traverse(b => {
            if (this._headAnchor) return;
            const n = (b.name || "").toLowerCase();
            if ((b.isBone || b.type === "Bone") &&
                (n.includes("head") || n === "j_hed" || n === "bone_head")) {
              this._headAnchor = b;
            }
          });
          if (!this._headAnchor) {
            /* Fallback: create a virtual group at estimated head position */
            const g = new THREE.Group();
            g.position.set(0, this._modelHeadY, 0);
            model.add(g);
            this._headAnchor = g;
          }
          console.log("[KeqingGLB] head anchor:", this._headAnchor.name || "virtual-group");

          /* ── Animation ── */
          if (gltf.animations?.length) {
            this._mixer = new THREE.AnimationMixer(model);
            const idle = gltf.animations.find(a =>
              /idle|stand|rest|wait|loop/i.test(a.name)
            ) || gltf.animations[0];
            this._mixer.clipAction(idle).play();
            console.log("[KeqingGLB] animation:", idle.name);
          } else {
            this._relaxArmBones(model);
          }

          this._loaded = true;
          console.log("[KeqingGLB] loaded v", gltf.animations?.length, "anim(s)");
          resolve(true);
        },
        (xhr) => { if (xhr.total) console.log(`[KeqingGLB] ${Math.round(xhr.loaded/xhr.total*100)}%`); },
        (err)  => { console.warn("[KeqingGLB] load error:", err.message ?? err); resolve(false); }
      );
    });
  }

  _relaxArmBones(model) {
    model.traverse(b => {
      if (!(b.isBone || b.type === "Bone")) return;
      const n = b.name.toLowerCase();
      if (n.includes("upperarm") || n.includes("arm_l") || n.includes("arm_r") ||
          n.includes("shoulder") || n.includes("clavicle")) {
        if (n.includes("_l") || n.includes("left"))  b.rotation.z =  0.55;
        if (n.includes("_r") || n.includes("right")) b.rotation.z = -0.55;
      }
    });
  }

  /* ── Load face texture per avatar ──────────────────── */
  async addAvatar(id, imgSrc, onProgress = () => {}, isRealFace = false) {
    onProgress("loading face texture…");
    let faceTex = null;
    try {
      const loader = new THREE.TextureLoader();
      faceTex = await loader.loadAsync(imgSrc);
      faceTex.colorSpace = THREE.SRGBColorSpace;
    } catch (e) {
      console.warn(`[KeqingGLB] face texture ${id} failed:`, e.message);
    }
    this._avatars[id] = { faceTex, isRealFace };
    onProgress("done");
    return this._avatars[id];
  }

  /* ── Select avatar → face overlay 3D ───────────────── */
  selectAvatar(id) {
    if (!this._avatars[id] || !this._model) return false;
    this._currentId = id;
    const { faceTex, isRealFace } = this._avatars[id];

    /* Replace face mesh texture only if name clearly matches */
    if (faceTex) {
      const FACE_KW    = ["face", "fac", "head", "skin"];
      const EXCLUDE_KW = ["cloth", "dress", "skirt", "coat", "hair",
                          "weapon", "wing", "eye", "brow", "lash", "lip", "tooth"];
      this._model.traverse(child => {
        if (!child.isMesh) return;
        const n = (child.name + " " +
          (Array.isArray(child.material) ? child.material[0]?.name : child.material?.name) + "")
          .toLowerCase();
        if (EXCLUDE_KW.some(k => n.includes(k))) return;
        if (!FACE_KW.some(k => n.includes(k))) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => { if (m?.map) { m.map = faceTex; m.needsUpdate = true; } });
        console.log("[KeqingGLB] face-mesh texture applied:", child.name);
      });
    }

    /* ── Face Overlay 3D: only for real-face transparent PNGs ── */
    this._setFaceOverlay(isRealFace ? faceTex : null);
    return true;
  }

  _setFaceOverlay(faceTex) {
    /* Remove previous overlay */
    if (this._faceOverlay) {
      if (this._faceOverlay.parent) this._faceOverlay.parent.remove(this._faceOverlay);
      this._faceOverlay.geometry.dispose();
      this._faceOverlay.material.dispose();
      this._faceOverlay = null;
    }
    if (!faceTex || !this._headAnchor) return;

    /*
     * Face plane: transparent PNG parented to head bone/anchor.
     * Positioned slightly in front of the model's face.
     * Size roughly 0.55w × 0.65h (head-sized proportion).
     */
    const geo = new THREE.PlaneGeometry(0.55, 0.65);
    const mat = new THREE.MeshBasicMaterial({
      map: faceTex,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    /* Offset forward (positive Z = toward viewer in local model space) */
    mesh.position.set(0, 0.05, 0.16);
    this._headAnchor.add(mesh);
    this._faceOverlay = mesh;
    console.log("[KeqingGLB] face overlay created on head anchor");
  }

  /* ── Engine API ─────────────────────────────────────── */
  setRotation(rx, ry)   { this.state.rotXTarget = rx; this.state.rotYTarget = ry; }
  setHeadLook(rx, ry)   { this.state.rotXTarget += rx * 0.12; this.state.rotYTarget += ry * 0.12; }
  setEyeLook()          {}
  setMouthOpen()        {}
  setOrbit(on)          { this.state.orbit = on; if (!on) this.state.orbitT = 0; }

  /* Apply per-avatar 3-point lighting from store.AVATARS[id].glb */
  setAvatarLighting(glbCfg) {
    if (!glbCfg) return;
    const L = this._lights;
    if (L.key)  { L.key.color.set(glbCfg.keyColor);   L.key.intensity  = glbCfg.keyIntensity; }
    if (L.fill) { L.fill.color.set(glbCfg.fillColor);  L.fill.intensity = glbCfg.fillIntensity; }
    if (L.rim)  { L.rim.color.set(glbCfg.rimColor);    L.rim.intensity  = glbCfg.rimIntensity; }
    if (L.amb)  { L.amb.color.set(glbCfg.ambColor);    L.amb.intensity  = glbCfg.ambIntensity; }
    if (this.renderer && glbCfg.exposure)
      this.renderer.toneMappingExposure = glbCfg.exposure;
  }

  setEmotion(cfg) {
    if (!this.scene || !this._lights.rim) return;
    if (cfg.rimRGB) this._lights.rim.color.setRGB(cfg.rimRGB[0], cfg.rimRGB[1], cfg.rimRGB[2]);
    if (cfg.rimA !== undefined) this._lights.rim.intensity = 0.5 + cfg.rimA * 0.9;
  }

  /* ── Render (per-frame) ─────────────────────────────── */
  render(extraX = 0, extraY = 0) {
    if (!this.renderer || !this.scene || !this.camera) return;

    const dt = this._clock.getDelta();
    if (this._mixer) this._mixer.update(dt);

    const s = this.state;
    if (s.orbit) {
      s.orbitT    += dt * 0.45;
      s.rotYTarget = Math.sin(s.orbitT) * 0.55;
      s.rotXTarget = Math.sin(s.orbitT * 0.35) * 0.08;
    }
    s.rotX += (s.rotXTarget - s.rotX) * 0.07;
    s.rotY += (s.rotYTarget - s.rotY) * 0.07;

    if (this._model) {
      this._model.rotation.x = s.rotX + extraY * 0.3;
      this._model.rotation.y = s.rotY + extraX * 0.3;
    }

    /*
     * Face overlay billboard — always face camera.
     * Since it's parented to the head anchor which rotates with model,
     * we counter-rotate in world space so the face is always front-facing.
     */
    if (this._faceOverlay && this._model) {
      const worldQuat = new THREE.Quaternion();
      this._headAnchor.getWorldQuaternion(worldQuat);
      this._faceOverlay.quaternion.copy(worldQuat).invert();
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const w = this.canvas.clientWidth  || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  get loaded() { return this._loaded; }
  destroy() { if (this.renderer) this.renderer.dispose(); }
}
