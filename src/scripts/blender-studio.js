/* ==========================================================================
   BLENDER STUDIO 3D ENGINE (THREE.JS)
   Full Blender-Style Viewport, Skin Touch Physics & Modifiable Studio
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import modelsData from '../data/models.json';

// Core Three.js Instances
let scene, camera, renderer, controls;
let currentModelGroup = null;
let currentMeshes = [];
let mixer = null;
let activeAction = null;
let animationsList = [];
let clock = new THREE.Clock();

// Lighting Instances
let keyLight, fillLight, rimLight, ambientLight;
let gridHelper, axesHelper;

// Touch & Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let originalPositionsMap = new Map();

// Skin Shader Settings
const skinParams = {
  tone: '#f4c7b8',
  subsurfaceColor: '#e05345',
  roughness: 0.45,
  metalness: 0.0,
  clearcoat: 0.25,
  clearcoatRoughness: 0.35,
  wireframe: false,
  shadingMode: 'material' // wireframe, solid, material, render
};

export function initBlenderStudio() {
  const container = document.getElementById('viewport-container');
  const canvas = document.getElementById('threejs-canvas');
  if (!container || !canvas) return;

  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // 2. Camera
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 100);
  camera.position.set(0, 1.4, 2.5);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 4. OrbitControls (Blender navigation)
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.2;
  controls.maxDistance = 20;
  controls.target.set(0, 0.8, 0);

  // 5. Grid & Floor Helpers (Blender style)
  setupBlenderGrid();

  // 6. Lighting Rig
  setupLighting();

  // 7. Event Listeners & UI Binding
  setupUI();
  setupTouchInteraction(container);

  // 8. Handle Window Resize
  window.addEventListener('resize', onWindowResize);

  // 9. Load Default Model or URL Param Model
  const urlParams = new URLSearchParams(window.location.search);
  const modelId = urlParams.get('id');
  if (modelId) {
    const selected = modelsData.models.find(m => m.id === modelId);
    if (selected && selected.filename.includes('female_torso')) {
      loadStudioModel('/models/sample-base-mesh.glb', selected.title);
    } else if (selected && selected.filename.includes('panda_head')) {
      loadStudioModel('/models/sample-panda.glb', selected.title);
    } else {
      loadStudioModel('/models/sample-base-mesh.glb', 'Female Torso Base Mesh');
    }
  } else {
    loadStudioModel('/models/sample-base-mesh.glb', 'Female Torso Base Mesh');
  }

  // 10. Start Animation Loop
  animate();
}

function setupBlenderGrid() {
  // Blender 3D Floor Grid
  gridHelper = new THREE.GridHelper(10, 20, 0x666666, 0x3a3a3a);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Axes Helper (Red = X, Green = Y, Blue = Z)
  axesHelper = new THREE.AxesHelper(1.5);
  axesHelper.position.y = 0.001;
  scene.add(axesHelper);
}

function setupLighting() {
  ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Key Light (Warm Front-Right)
  keyLight = new THREE.DirectionalLight(0xfff4e6, 1.8);
  keyLight.position.set(3, 4, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  scene.add(keyLight);

  // Fill Light (Cool Front-Left)
  fillLight = new THREE.DirectionalLight(0xd9ecff, 0.9);
  fillLight.position.set(-3, 2, 2);
  scene.add(fillLight);

  // Rim / Hair Light (Warm Backlight)
  rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
  rimLight.position.set(0, 3, -4);
  scene.add(rimLight);
}

export function loadStudioModel(url, titleText) {
  const loader = new GLTFLoader();
  const hudTitle = document.getElementById('hud-model-title');
  if (hudTitle) hudTitle.textContent = titleText || 'Loading Model...';

  loader.load(
    url,
    (gltf) => {
      // Remove old model
      if (currentModelGroup) {
        scene.remove(currentModelGroup);
        currentModelGroup.traverse(c => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
            else c.material.dispose();
          }
        });
      }

      currentModelGroup = gltf.scene;
      currentMeshes = [];
      originalPositionsMap.clear();

      // Collect meshes & apply skin materials
      currentModelGroup.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          currentMeshes.push(child);

          // Store geometry clone for elastic touch physics
          if (child.geometry && child.geometry.attributes.position) {
            originalPositionsMap.set(child, child.geometry.attributes.position.clone());
          }

          // Apply Physical Skin Shader
          applySkinMaterialToMesh(child);
        }
      });

      // Strictly Center and Frame Avatar
      centerAndFrameAvatar(currentModelGroup);

      // Handle Animations
      animationsList = gltf.animations || [];
      if (animationsList.length > 0) {
        mixer = new THREE.AnimationMixer(currentModelGroup);
        activeAction = mixer.clipAction(animationsList[0]);
        activeAction.play();
        setupAnimationTimeline();
      } else {
        mixer = null;
      }

      scene.add(currentModelGroup);

      if (hudTitle) hudTitle.textContent = titleText;
      updateMeshStats();
    },
    (xhr) => {
      // Progress
    },
    (err) => {
      console.error('Failed to load GLB model:', err);
      if (hudTitle) hudTitle.textContent = 'Error Loading 3D Model';
    }
  );
}

function applySkinMaterialToMesh(mesh) {
  // Create high-fidelity Physical Material mimicking human skin
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(skinParams.tone),
    roughness: skinParams.roughness,
    metalness: skinParams.metalness,
    clearcoat: skinParams.clearcoat,
    clearcoatRoughness: skinParams.clearcoatRoughness,
    transmission: 0.05, // subtle organic translucency
    thickness: 0.5,
    wireframe: skinParams.wireframe
  });

  // Preserve existing texture map if any
  if (mesh.material && mesh.material.map) {
    skinMat.map = mesh.material.map;
    skinMat.color.set(0xffffff); // allow texture color to shine through
  }

  mesh.material = skinMat;
}

function centerAndFrameAvatar(object) {
  // Compute tight bounding box
  const bbox = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  // Offset model so it rests precisely on the floor grid (Y = 0) and centered at (0, 0, 0)
  object.position.x = -center.x;
  object.position.y = -bbox.min.y;
  object.position.z = -center.z;

  // Frame Camera
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraDist = Math.abs(maxDim / Math.sin(fov / 2)) * 0.8;
  cameraDist = Math.max(cameraDist, 1.2);

  const targetHeight = size.y * 0.5;
  camera.position.set(0, targetHeight + 0.2, cameraDist);
  controls.target.set(0, targetHeight, 0);
  controls.update();
}

function setupTouchInteraction(container) {
  const rippleEl = document.getElementById('touch-ripple');

  container.addEventListener('pointerdown', (e) => {
    // Only trigger touch on left click without shift (not when panning/orbiting with right click)
    if (e.button !== 0) return;

    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(currentMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0];

      // 1. Show Visual Skin Tactile Ripple
      if (rippleEl) {
        rippleEl.style.left = `${e.clientX - rect.left}px`;
        rippleEl.style.top = `${e.clientY - rect.top}px`;
        rippleEl.classList.remove('active');
        void rippleEl.offsetWidth; // trigger reflow
        rippleEl.classList.add('active');
      }

      // 2. Elastic Skin Deformation (Depress and spring back)
      deformSkinAtPoint(hit.object, hit.point, hit.face.normal);
    }
  });
}

function deformSkinAtPoint(mesh, worldPoint, normal) {
  if (!mesh.geometry || !mesh.geometry.attributes.position) return;

  const originalPos = originalPositionsMap.get(mesh);
  if (!originalPos) return;

  const posAttr = mesh.geometry.attributes.position;
  const localHit = mesh.worldToLocal(worldPoint.clone());
  const radius = 0.25; // touch radius
  const depth = 0.035; // skin compression depth

  // Deform inward
  for (let i = 0; i < posAttr.count; i++) {
    const vx = originalPos.getX(i);
    const vy = originalPos.getY(i);
    const vz = originalPos.getZ(i);

    const dist = Math.hypot(vx - localHit.x, vy - localHit.y, vz - localHit.z);
    if (dist < radius) {
      const factor = Math.cos((dist / radius) * (Math.PI / 2));
      posAttr.setXYZ(
        i,
        vx - normal.x * depth * factor,
        vy - normal.y * depth * factor,
        vz - normal.z * depth * factor
      );
    }
  }
  posAttr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();

  // Elastic Spring Back after 220ms
  setTimeout(() => {
    let progress = 0;
    const springInterval = setInterval(() => {
      progress += 0.2;
      for (let i = 0; i < posAttr.count; i++) {
        const curX = posAttr.getX(i);
        const curY = posAttr.getY(i);
        const curZ = posAttr.getZ(i);
        const origX = originalPos.getX(i);
        const origY = originalPos.getY(i);
        const origZ = originalPos.getZ(i);

        posAttr.setXYZ(
          i,
          curX + (origX - curX) * 0.4,
          curY + (origY - curY) * 0.4,
          curZ + (origZ - curZ) * 0.4
        );
      }
      posAttr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();

      if (progress >= 1) {
        clearInterval(springInterval);
        // Reset strictly to original
        mesh.geometry.setAttribute('position', originalPos.clone());
        mesh.geometry.computeVertexNormals();
      }
    }, 25);
  }, 180);
}

function setupUI() {
  // Model selector dropdown
  const modelSelect = document.getElementById('studio-model-select');
  if (modelSelect) {
    modelSelect.innerHTML = `
      <option value="/models/sample-base-mesh.glb">Female Torso Base Mesh (Clean Topology)</option>
      <option value="/models/sample-panda.glb">Panda Head Low Poly</option>
      ${modelsData.models.slice(0, 15).map(m => `<option value="${m.filename}">${m.title} (${m.sizeFormatted})</option>`).join('')}
    `;

    modelSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val.startsWith('/models/')) {
        loadStudioModel(val, e.target.options[e.target.selectedIndex].text);
      } else {
        alert(`Model "${val}" berada di direktori lokal E:\\0download blender. Silakan klik tombol "Buka File Lokal" untuk memuatnya langsung!`);
      }
    });
  }

  // Open Local File
  const fileInput = document.getElementById('studio-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        loadStudioModel(url, file.name);
      }
    });
  }

  // Recenter Avatar button
  const btnRecenter = document.getElementById('btn-recenter');
  if (btnRecenter) {
    btnRecenter.addEventListener('click', () => {
      if (currentModelGroup) centerAndFrameAvatar(currentModelGroup);
    });
  }

  // Orientation Gizmo Buttons (Numpad views)
  const btnViewFront = document.getElementById('gizmo-front');
  const btnViewSide = document.getElementById('gizmo-side');
  const btnViewTop = document.getElementById('gizmo-top');

  if (btnViewFront) {
    btnViewFront.addEventListener('click', () => {
      camera.position.set(0, controls.target.y, 2.5);
      controls.update();
    });
  }
  if (btnViewSide) {
    btnViewSide.addEventListener('click', () => {
      camera.position.set(2.5, controls.target.y, 0);
      controls.update();
    });
  }
  if (btnViewTop) {
    btnViewTop.addEventListener('click', () => {
      camera.position.set(0, 3.5, 0.001);
      controls.update();
    });
  }

  // Skin Tone & Color
  const skinColorInput = document.getElementById('skin-color-picker');
  if (skinColorInput) {
    skinColorInput.addEventListener('input', (e) => {
      skinParams.tone = e.target.value;
      updateSkinMaterials();
    });
  }

  // Preset Skin Tones
  document.querySelectorAll('.skin-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      skinParams.tone = color;
      if (skinColorInput) skinColorInput.value = color;
      updateSkinMaterials();
    });
  });

  // Roughness & Softness
  const roughnessInput = document.getElementById('skin-roughness');
  const roughnessVal = document.getElementById('val-roughness');
  if (roughnessInput) {
    roughnessInput.addEventListener('input', (e) => {
      skinParams.roughness = parseFloat(e.target.value);
      if (roughnessVal) roughnessVal.textContent = skinParams.roughness.toFixed(2);
      updateSkinMaterials();
    });
  }

  // Clearcoat (Moisture / Sweat sheen)
  const clearcoatInput = document.getElementById('skin-clearcoat');
  const clearcoatVal = document.getElementById('val-clearcoat');
  if (clearcoatInput) {
    clearcoatInput.addEventListener('input', (e) => {
      skinParams.clearcoat = parseFloat(e.target.value);
      if (clearcoatVal) clearcoatVal.textContent = skinParams.clearcoat.toFixed(2);
      updateSkinMaterials();
    });
  }

  // Wireframe toggle
  const wireframeToggle = document.getElementById('toggle-wireframe');
  if (wireframeToggle) {
    wireframeToggle.addEventListener('change', (e) => {
      skinParams.wireframe = e.target.checked;
      updateSkinMaterials();
    });
  }

  // Lighting sliders
  const keyLightInput = document.getElementById('light-key-intensity');
  if (keyLightInput) {
    keyLightInput.addEventListener('input', (e) => {
      if (keyLight) keyLight.intensity = parseFloat(e.target.value);
    });
  }

  // Export Modified GLB
  const exportBtn = document.getElementById('btn-export-glb');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportModifiedGLB);
  }
}

function updateSkinMaterials() {
  currentMeshes.forEach(mesh => {
    if (mesh.material) {
      if (mesh.material.color) mesh.material.color.set(skinParams.tone);
      mesh.material.roughness = skinParams.roughness;
      mesh.material.clearcoat = skinParams.clearcoat;
      mesh.material.wireframe = skinParams.wireframe;
      mesh.material.needsUpdate = true;
    }
  });
}

function updateMeshStats() {
  let vertices = 0;
  let triangles = 0;

  currentMeshes.forEach(mesh => {
    if (mesh.geometry) {
      if (mesh.geometry.attributes.position) {
        vertices += mesh.geometry.attributes.position.count;
      }
      if (mesh.geometry.index) {
        triangles += mesh.geometry.index.count / 3;
      } else if (mesh.geometry.attributes.position) {
        triangles += mesh.geometry.attributes.position.count / 3;
      }
    }
  });

  const statVerts = document.getElementById('hud-vertices');
  const statTris = document.getElementById('hud-triangles');
  if (statVerts) statVerts.textContent = `Verts: ${vertices.toLocaleString()}`;
  if (statTris) statTris.textContent = `Tris: ${Math.round(triangles).toLocaleString()}`;
}

function setupAnimationTimeline() {
  const timelineBar = document.getElementById('studio-timeline');
  const playBtn = document.getElementById('btn-play-anim');
  if (timelineBar) timelineBar.style.display = 'flex';

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!activeAction) return;
      if (activeAction.isRunning()) {
        activeAction.paused = true;
        playBtn.textContent = 'Play';
      } else {
        activeAction.paused = false;
        playBtn.textContent = 'Pause';
      }
    });
  }
}

function exportModifiedGLB() {
  if (!currentModelGroup) return;

  const exporter = new GLTFExporter();
  exporter.parse(
    currentModelGroup,
    (gltf) => {
      const blob = new Blob([gltf], { type: 'model/gltf-binary' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'blender_studio_edited_model.glb';
      link.click();
    },
    (err) => console.error('Error exporting GLB:', err),
    { binary: true }
  );
}

function onWindowResize() {
  const container = document.getElementById('viewport-container');
  if (!container || !renderer || !camera) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  controls.update();
  renderer.render(scene, camera);
}
