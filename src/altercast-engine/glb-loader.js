/* ═══════════════════════════════════════════════════════════
   AlterCast — Three.js GLB Loader Engine
   Real 3D rigged model rendering: loads .glb, plays animations,
   3-point cinematic lighting, post-processing-free for perf.
   ES module. Uses importmap-aliased 'three' + 'three/addons/'.
═══════════════════════════════════════════════════════════ */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class GLBEngine {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, premultipliedAlpha: false,
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();

    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
    this.camera.position.set(0, 1.45, 3.4);
    this.camera.lookAt(0, 1.2, 0);

    /* ── 3-point cinematic lighting ── */
    this.lights = {};

    const ambient = new THREE.AmbientLight(0x404660, 0.6);
    this.scene.add(ambient);
    this.lights.ambient = ambient;

    // Key (warm-cool depending on preset)
    const key = new THREE.DirectionalLight(0xfff2e0, 1.8);
    key.position.set(2, 3, 2.5);
    this.scene.add(key);
    this.lights.key = key;

    // Fill (cool)
    const fill = new THREE.DirectionalLight(0xb8d8ff, 0.7);
    fill.position.set(-2.5, 2, 1.5);
    this.scene.add(fill);
    this.lights.fill = fill;

    // Rim (cyan, behind, lifts silhouette)
    const rim = new THREE.DirectionalLight(0x00d4ff, 2.2);
    rim.position.set(-1.5, 2, -3);
    this.scene.add(rim);
    this.lights.rim = rim;

    // Bottom kicker (violet, optional)
    const kick = new THREE.DirectionalLight(0x7c3aff, 0.45);
    kick.position.set(0, -2, 1.5);
    this.scene.add(kick);
    this.lights.kick = kick;

    /* ── Controls (optional drag-to-rotate around model) ── */
    if (opts.controls !== false) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.target.set(0, 1.25, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.enablePan = false;
      this.controls.minDistance = 1.4;
      this.controls.maxDistance = 6;
      this.controls.minPolarAngle = Math.PI * 0.15;
      this.controls.maxPolarAngle = Math.PI * 0.85;
      this.controls.update();
    }

    /* ── Model + animation state ── */
    this.model = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.actions = {};
    this.autoOrbit = false;
    this.orbitT = 0;
    this.faceTexture = null; // optional swap-in for face material

    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Load a GLB model from URL. Returns the loaded gltf object.
   */
  async load(url, { onProgress } = {}) {
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        url,
        (g) => resolve(g),
        (xhr) => {
          if (onProgress && xhr.total) {
            onProgress(xhr.loaded / xhr.total, xhr.loaded, xhr.total);
          }
        },
        (err) => reject(err)
      );
    });

    this.model = gltf.scene;

    /* Compute bounding box → center model on origin, scale to fit ~2 units tall */
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const targetHeight = 2.0;
    const scale = targetHeight / Math.max(0.001, size.y);
    this.model.scale.setScalar(scale);

    /* Re-center horizontally + put feet on y=0 */
    this.model.position.x = -center.x * scale;
    this.model.position.z = -center.z * scale;
    this.model.position.y = -box.min.y * scale;

    /* Improve materials: ensure double-sided where alpha may matter,
       boost specular on cosplay outfits, fix UV channel mappings. */
    this.model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
        const mat = obj.material;
        if (mat) {
          if (Array.isArray(mat)) {
            mat.forEach(m => this._enhanceMaterial(m));
          } else {
            this._enhanceMaterial(mat);
          }
        }
      }
    });

    this.scene.add(this.model);

    /* Setup animations */
    if (gltf.animations && gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(this.model);
      gltf.animations.forEach((clip) => {
        const a = this.mixer.clipAction(clip);
        this.actions[clip.name] = a;
      });
      /* Auto-play first animation */
      const first = Object.values(this.actions)[0];
      if (first) {
        first.reset();
        first.play();
      }
    }

    /* Camera aim slightly above center for portrait-style framing */
    const newBox = new THREE.Box3().setFromObject(this.model);
    const newSize = newBox.getSize(new THREE.Vector3());
    const headY = newBox.min.y + newSize.y * 0.92;
    if (this.controls) {
      this.controls.target.set(0, newSize.y * 0.6, 0);
      this.controls.update();
    }
    this.camera.lookAt(0, newSize.y * 0.6, 0);

    return gltf;
  }

  _enhanceMaterial(mat) {
    if (!mat) return;
    if ("transparent" in mat) {
      // Keep existing transparency, but make sure alphaTest is set
      // to avoid sorting artifacts on hair.
      if (mat.transparent && (mat.alphaTest === undefined || mat.alphaTest === 0)) {
        mat.alphaTest = 0.5;
      }
    }
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    if ("envMapIntensity" in mat) mat.envMapIntensity = 1.0;
    if ("roughness" in mat) mat.roughness = Math.min(1, mat.roughness ?? 0.8);
    mat.needsUpdate = true;
  }

  /**
   * Replace the texture of any mesh whose name matches the regex
   * with the supplied image (URL or Image). Useful for face-swap onto cosplay model.
   */
  async swapFaceTexture(faceImageUrl, namePattern = /face|head|skin/i) {
    if (!this.model) return false;
    const tex = await new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(faceImageUrl, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.flipY = false;
        resolve(t);
      }, undefined, reject);
    });
    let swapped = 0;
    this.model.traverse((obj) => {
      if (obj.isMesh && obj.material && obj.name && namePattern.test(obj.name)) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if ("map" in m) {
            m.map = tex;
            m.needsUpdate = true;
            swapped++;
          }
        });
      }
    });
    this.faceTexture = tex;
    return swapped > 0;
  }

  /** Apply a lighting preset name */
  setLighting(name) {
    const presets = {
      cinematic: { key: 0xfff2e0, keyI: 1.8, fill: 0xb8d8ff, fillI: 0.7, rim: 0x00d4ff, rimI: 2.2, amb: 0x404660, ambI: 0.6, kick: 0x7c3aff, kickI: 0.45, exposure: 1.0 },
      hologram:  { key: 0x80c8ff, keyI: 1.2, fill: 0x4080ff, fillI: 0.9, rim: 0x00ffff, rimI: 3.2, amb: 0x102040, ambI: 0.5, kick: 0x00d4ff, kickI: 0.8, exposure: 1.1 },
      sunset:    { key: 0xffcc88, keyI: 2.4, fill: 0xff8866, fillI: 0.8, rim: 0xff4488, rimI: 1.5, amb: 0x402030, ambI: 0.5, kick: 0xff6688, kickI: 0.4, exposure: 1.0 },
      studio:    { key: 0xffffff, keyI: 2.0, fill: 0xeef4ff, fillI: 1.2, rim: 0xffffff, rimI: 1.0, amb: 0x808890, ambI: 0.8, kick: 0xffffff, kickI: 0.5, exposure: 1.0 },
      neon:      { key: 0xff80ff, keyI: 1.4, fill: 0x80ffff, fillI: 1.0, rim: 0xff00ff, rimI: 2.4, amb: 0x201040, ambI: 0.6, kick: 0x00ffff, kickI: 0.6, exposure: 1.1 },
    };
    const p = presets[name] || presets.cinematic;
    this.lights.key.color.setHex(p.key);    this.lights.key.intensity = p.keyI;
    this.lights.fill.color.setHex(p.fill);  this.lights.fill.intensity = p.fillI;
    this.lights.rim.color.setHex(p.rim);    this.lights.rim.intensity = p.rimI;
    this.lights.ambient.color.setHex(p.amb);this.lights.ambient.intensity = p.ambI;
    this.lights.kick.color.setHex(p.kick);  this.lights.kick.intensity = p.kickI;
    this.renderer.toneMappingExposure = p.exposure;
  }

  setAutoOrbit(on) { this.autoOrbit = on; }

  playAnimation(name) {
    if (!this.actions[name]) return false;
    Object.values(this.actions).forEach(a => a.stop());
    this.actions[name].reset().play();
    return true;
  }

  listAnimations() { return Object.keys(this.actions); }

  /** Frame render */
  render() {
    const dt = this.clock.getDelta();
    if (this.mixer) this.mixer.update(dt);

    if (this.autoOrbit && this.controls) {
      this.orbitT += dt * 0.25;
      const r = this.controls.target.distanceTo(this.camera.position);
      this.camera.position.x = Math.sin(this.orbitT) * r;
      this.camera.position.z = Math.cos(this.orbitT) * r;
      this.camera.position.y = this.controls.target.y + Math.sin(this.orbitT * 0.4) * 0.15 + 0.4;
      this.camera.lookAt(this.controls.target);
    } else if (this.controls) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
