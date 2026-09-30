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
let perspCamera, orthoCamera;
let isOrtho = false;

let currentModelGroup = null;
let currentMeshes = [];
let mixer = null;
let activeAction = null;
let animationsList = [];
let clock = new THREE.Clock();
let isPlayingAnimation = true;
let animSpeed = 1.0;
let isScrubbing = false;

// Lighting Instances
let keyLight, fillLight, rimLight, ambientLight;
let gridHelper, axesHelper, bboxHelper;

// Touch & Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let originalPositionsMap = new Map();

// Settings & State
const studioState = {
  activeTab: 'layout',
  shadingMode: 'material', // wireframe, solid, material, rendered
  skin: {
    tone: '#f4c7b8',
    roughness: 0.90,
    metalness: 0.0,
    clearcoat: 0.50,
    clearcoatRoughness: 0.35,
    wireframe: false,
    wireframeColor: '#00ffff'
  },
  physics: {
    depth: 0.05,
    radius: 0.12,
    springSpeed: 0.4
  },
  lights: {
    key: 1.8,
    fill: 0.8,
    rim: 1.2,
    bg: '#222222'
  },
  isSmoothShading: true
};

export function initBlenderStudio() {
  const container = document.getElementById('viewport-container');
  const canvas = document.getElementById('threejs-canvas');
  if (!container || !canvas) return;

  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(studioState.lights.bg);

  // 2. Camera Setup (Perspective + Orthographic)
  const aspect = container.clientWidth / container.clientHeight;
  perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.05, 100);
  perspCamera.position.set(0, 1.4, 2.5);

  const frustumSize = 2.5;
  orthoCamera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.05,
    100
  );
  orthoCamera.position.set(0, 1.4, 2.5);

  camera = perspCamera;

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

  // 4. OrbitControls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.1;
  controls.maxDistance = 25;
  controls.target.set(0, 0.8, 0);

  // 5. Grid & Floor Helpers
  setupBlenderGrid();

  // 6. Lighting Rig
  setupLighting();

  // 7. Event Listeners & UI Binding
  setupUI();
  setupTouchInteraction(container);
  setupDragAndDrop(container);

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
  gridHelper = new THREE.GridHelper(10, 20, 0x666666, 0x3a3a3a);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  axesHelper = new THREE.AxesHelper(1.5);
  axesHelper.position.y = 0.001;
  scene.add(axesHelper);
}

function setupLighting() {
  ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Key Light
  keyLight = new THREE.DirectionalLight(0xfffaed, studioState.lights.key);
  keyLight.position.set(3, 4, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.bias = -0.0001;
  scene.add(keyLight);

  // Fill Light
  fillLight = new THREE.DirectionalLight(0xedf2ff, studioState.lights.fill);
  fillLight.position.set(-3, 2, 2);
  scene.add(fillLight);

  // Rim Light (Backlight)
  rimLight = new THREE.DirectionalLight(0xffeedd, studioState.lights.rim);
  rimLight.position.set(0, 3, -3);
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

      if (bboxHelper) {
        scene.remove(bboxHelper);
        bboxHelper = null;
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

          // Preserve original material cache for shading mode switching
          child.userData.originalMaterial = child.material;

          // Apply Physical Skin Shader
          applySkinMaterialToMesh(child);
        }
      });

      scene.add(currentModelGroup);

      // Centering & Bounding Box Framing
      centerAndFrameAvatar(currentModelGroup);

      // Update HUD stats
      updateMeshStats();

      // Setup Animation Mixer if clips exist
      if (gltf.animations && gltf.animations.length > 0) {
        animationsList = gltf.animations;
        if (mixer) mixer.stopAllAction();
        mixer = new THREE.AnimationMixer(currentModelGroup);

        setupAnimationTimeline();
        playAnimationClip(0);
      } else {
        const timelineBar = document.getElementById('studio-timeline');
        if (timelineBar) timelineBar.style.display = 'none';
        if (mixer) mixer.stopAllAction();
        mixer = null;
        activeAction = null;
        animationsList = [];
      }
    },
    undefined,
    (err) => {
      console.error('Error loading model into Blender Studio:', err);
      if (hudTitle) hudTitle.textContent = 'Gagal memuat model';
    }
  );
}

function applySkinMaterialToMesh(mesh) {
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(studioState.skin.tone),
    roughness: studioState.skin.roughness,
    metalness: studioState.skin.metalness,
    clearcoat: studioState.skin.clearcoat,
    clearcoatRoughness: studioState.skin.clearcoatRoughness,
    transmission: 0.05,
    thickness: 0.5,
    wireframe: studioState.skin.wireframe
  });

  // Preserve existing texture map if any
  const prevMat = mesh.userData.originalMaterial || mesh.material;
  if (prevMat && prevMat.map) {
    skinMat.map = prevMat.map;
    skinMat.color.set(0xffffff);
  }

  mesh.material = skinMat;
}

function centerAndFrameAvatar(object) {
  const bbox = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  // Position avatar on floor (y = 0)
  object.position.x = -center.x;
  object.position.y = -bbox.min.y;
  object.position.z = -center.z;

  // Frame Camera
  const maxDim = Math.max(size.x, size.y, size.z) || 1.8;
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs((maxDim / 2) / Math.tan(fov / 2)) * 1.5;
  cameraZ = Math.max(cameraZ, 1.2);

  camera.position.set(0, size.y * 0.55, cameraZ);
  controls.target.set(0, size.y * 0.5, 0);
  controls.update();

  // Update HUD Bounding Box
  const hudBounds = document.getElementById('hud-bounds');
  if (hudBounds) {
    hudBounds.textContent = `Ukuran: ${size.x.toFixed(2)}m x ${size.y.toFixed(2)}m x ${size.z.toFixed(2)}m`;
  }
}

function setupTouchInteraction(container) {
  const rippleEl = document.getElementById('touch-ripple');

  container.addEventListener('pointerdown', (event) => {
    // Only react to primary left click without Shift key
    if (event.button !== 0 || event.shiftKey) return;

    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(currentMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0];

      // Trigger ripple feedback
      if (rippleEl) {
        rippleEl.style.left = `${event.clientX - rect.left}px`;
        rippleEl.style.top = `${event.clientY - rect.top}px`;
        rippleEl.classList.remove('active');
        void rippleEl.offsetWidth;
        rippleEl.classList.add('active');
      }

      // Deform mesh
      deformMeshTactile(hit.object, hit.point);
    }
  });
}

function deformMeshTactile(mesh, hitWorldPoint) {
  if (!mesh.geometry || !mesh.geometry.attributes.position) return;
  const originalPos = originalPositionsMap.get(mesh);
  if (!originalPos) return;

  const hitLocal = mesh.worldToLocal(hitWorldPoint.clone());
  const posAttr = mesh.geometry.attributes.position;
  const radius = studioState.physics.radius;
  const depth = studioState.physics.depth;

  for (let i = 0; i < posAttr.count; i++) {
    const vx = originalPos.getX(i);
    const vy = originalPos.getY(i);
    const vz = originalPos.getZ(i);

    const dist = Math.sqrt((vx - hitLocal.x)**2 + (vy - hitLocal.y)**2 + (vz - hitLocal.z)**2);
    if (dist < radius) {
      const factor = (1 - dist / radius) * depth;
      posAttr.setXYZ(i, vx - factor * 0.4, vy - factor * 0.4, vz - factor * 0.9);
    }
  }

  posAttr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();

  // Elastic Spring Back
  setTimeout(() => {
    let progress = 0;
    const springInterval = setInterval(() => {
      progress += studioState.physics.springSpeed * 0.5;
      for (let i = 0; i < posAttr.count; i++) {
        const curX = posAttr.getX(i);
        const curY = posAttr.getY(i);
        const curZ = posAttr.getZ(i);
        const origX = originalPos.getX(i);
        const origY = originalPos.getY(i);
        const origZ = originalPos.getZ(i);

        posAttr.setXYZ(
          i,
          curX + (origX - curX) * 0.45,
          curY + (origY - curY) * 0.45,
          curZ + (origZ - curZ) * 0.45
        );
      }
      posAttr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();

      if (progress >= 1) {
        clearInterval(springInterval);
        mesh.geometry.setAttribute('position', originalPos.clone());
        mesh.geometry.computeVertexNormals();
      }
    }, 25);
  }, 160);
}

function setupDragAndDrop(container) {
  const dropzone = document.getElementById('viewport-dropzone');
  if (!dropzone) return;

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('visible');
  });

  container.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null || !container.contains(e.relatedTarget)) {
      dropzone.classList.remove('visible');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('visible');

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
      const url = URL.createObjectURL(file);
      loadStudioModel(url, file.name);
    }
  });
}

function setupUI() {
  // 1. Workspace Tabs Navigation
  const tabBtns = document.querySelectorAll('.ws-tab');
  const tabBadge = document.getElementById('active-tab-badge');
  const tabSections = document.querySelectorAll('.tab-section');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.getAttribute('data-tab');
      studioState.activeTab = tab;
      if (tabBadge) tabBadge.textContent = tab.toUpperCase();

      tabSections.forEach(sec => {
        const allowed = sec.getAttribute('data-tab-section') || '';
        if (allowed.includes(tab)) {
          sec.style.display = 'block';
        } else {
          sec.style.display = 'none';
        }
      });
    });
  });

  // 2. Viewport Shading Modes Bar
  const shadingBtns = document.querySelectorAll('.shading-btn');
  shadingBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      shadingBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.getAttribute('data-mode');
      setShadingMode(mode);
    });
  });

  // 3. Model selector dropdown
  const modelSelect = document.getElementById('studio-model-select');
  if (modelSelect) {
    modelSelect.innerHTML = `
      <option value="/models/sample-base-mesh.glb">Female Torso Base Mesh (Sample)</option>
      <option value="/models/sample-panda.glb">Panda Head Low Poly (Sample)</option>
      <optgroup label="188 Model Lokal (E:\\0download blender)">
        ${modelsData.models.map(m => `<option value="${m.filename}">${m.title} (${m.sizeFormatted})</option>`).join('')}
      </optgroup>
    `;

    modelSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val.startsWith('/models/')) {
        loadStudioModel(val, e.target.options[e.target.selectedIndex].text);
      } else {
        alert(`Model "${val}" berada di direktori lokal E:\\0download blender. Silakan klik tombol "Buka File" di atas untuk memuat file langsung dari drive!`);
      }
    });
  }

  // 4. Open Local File
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

  // 5. Recenter Avatar button (Top & Sidebar)
  const btnRecenter = document.getElementById('btn-recenter');
  const btnRecenterSidebar = document.getElementById('btn-recenter-sidebar');
  [btnRecenter, btnRecenterSidebar].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (currentModelGroup) centerAndFrameAvatar(currentModelGroup);
      });
    }
  });

  // 6. Camera Projection Switch (Persp / Ortho)
  const btnToggleCamera = document.getElementById('btn-toggle-camera-type');
  if (btnToggleCamera) {
    btnToggleCamera.addEventListener('click', () => {
      isOrtho = !isOrtho;
      const targetPos = camera.position.clone();
      const targetLook = controls.target.clone();

      if (isOrtho) {
        orthoCamera.position.copy(targetPos);
        camera = orthoCamera;
        btnToggleCamera.textContent = 'Ortografis';
      } else {
        perspCamera.position.copy(targetPos);
        camera = perspCamera;
        btnToggleCamera.textContent = 'Perspektif';
      }
      controls.object = camera;
      controls.target.copy(targetLook);
      controls.update();
      onWindowResize();
    });
  }

  // 7. Grid, Axes, Shadows Toggles
  const toggleGrid = document.getElementById('toggle-grid');
  if (toggleGrid) {
    toggleGrid.addEventListener('change', (e) => {
      if (gridHelper) gridHelper.visible = e.target.checked;
    });
  }

  const toggleAxes = document.getElementById('toggle-axes');
  if (toggleAxes) {
    toggleAxes.addEventListener('change', (e) => {
      if (axesHelper) axesHelper.visible = e.target.checked;
    });
  }

  const toggleShadows = document.getElementById('toggle-shadows');
  if (toggleShadows) {
    toggleShadows.addEventListener('change', (e) => {
      renderer.shadowMap.enabled = e.target.checked;
      currentMeshes.forEach(m => {
        m.castShadow = e.target.checked;
        m.receiveShadow = e.target.checked;
        if (m.material) m.material.needsUpdate = true;
      });
    });
  }

  // 8. Modeling Tab Controls
  const toggleModelWireframe = document.getElementById('toggle-modeling-wireframe');
  if (toggleModelWireframe) {
    toggleModelWireframe.addEventListener('change', (e) => {
      studioState.skin.wireframe = e.target.checked;
      updateSkinMaterials();
    });
  }

  const wireframeColorPicker = document.getElementById('wireframe-color-picker');
  if (wireframeColorPicker) {
    wireframeColorPicker.addEventListener('input', (e) => {
      studioState.skin.wireframeColor = e.target.value;
      if (studioState.skin.wireframe) updateSkinMaterials();
    });
  }

  const btnToggleShading = document.getElementById('btn-toggle-flat-smooth');
  if (btnToggleShading) {
    btnToggleShading.addEventListener('click', () => {
      studioState.isSmoothShading = !studioState.isSmoothShading;
      btnToggleShading.textContent = studioState.isSmoothShading ? 'Smooth Shading' : 'Flat Shading';
      currentMeshes.forEach(mesh => {
        if (mesh.geometry) {
          if (studioState.isSmoothShading) {
            mesh.geometry.computeVertexNormals();
          } else {
            mesh.geometry = mesh.geometry.toNonIndexed();
            mesh.geometry.computeVertexNormals();
          }
        }
      });
    });
  }

  const toggleBBox = document.getElementById('toggle-bbox-helper');
  if (toggleBBox) {
    toggleBBox.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (currentModelGroup) {
          if (bboxHelper) scene.remove(bboxHelper);
          bboxHelper = new THREE.BoxHelper(currentModelGroup, 0xf57920);
          scene.add(bboxHelper);
        }
      } else {
        if (bboxHelper) {
          scene.remove(bboxHelper);
          bboxHelper = null;
        }
      }
    });
  }

  // 9. Orientation Gizmo Buttons
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

  // 10. Skin Tone & Color Presets
  const skinColorInput = document.getElementById('skin-color-picker');
  if (skinColorInput) {
    skinColorInput.addEventListener('input', (e) => {
      studioState.skin.tone = e.target.value;
      updateSkinMaterials();
    });
  }

  document.querySelectorAll('.skin-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      studioState.skin.tone = color;
      if (skinColorInput) skinColorInput.value = color;
      updateSkinMaterials();
    });
  });

  // 11. Roughness, Clearcoat, Wireframe
  const roughnessInput = document.getElementById('skin-roughness');
  const roughnessVal = document.getElementById('val-roughness');
  if (roughnessInput) {
    roughnessInput.addEventListener('input', (e) => {
      studioState.skin.roughness = parseFloat(e.target.value);
      if (roughnessVal) roughnessVal.textContent = studioState.skin.roughness.toFixed(2);
      updateSkinMaterials();
    });
  }

  const clearcoatInput = document.getElementById('skin-clearcoat');
  const clearcoatVal = document.getElementById('val-clearcoat');
  if (clearcoatInput) {
    clearcoatInput.addEventListener('input', (e) => {
      studioState.skin.clearcoat = parseFloat(e.target.value);
      if (clearcoatVal) clearcoatVal.textContent = studioState.skin.clearcoat.toFixed(2);
      updateSkinMaterials();
    });
  }

  const wireframeToggle = document.getElementById('toggle-wireframe');
  if (wireframeToggle) {
    wireframeToggle.addEventListener('change', (e) => {
      studioState.skin.wireframe = e.target.checked;
      if (toggleModelWireframe) toggleModelWireframe.checked = e.target.checked;
      updateSkinMaterials();
    });
  }

  // 12. Tactile Physics Sliders
  const depthInput = document.getElementById('touch-depth-range');
  const depthVal = document.getElementById('val-touch-depth');
  if (depthInput) {
    depthInput.addEventListener('input', (e) => {
      studioState.physics.depth = parseFloat(e.target.value);
      if (depthVal) depthVal.textContent = studioState.physics.depth.toFixed(2);
    });
  }

  const radiusInput = document.getElementById('touch-radius-range');
  const radiusVal = document.getElementById('val-touch-radius');
  if (radiusInput) {
    radiusInput.addEventListener('input', (e) => {
      studioState.physics.radius = parseFloat(e.target.value);
      if (radiusVal) radiusVal.textContent = `${studioState.physics.radius.toFixed(2)}m`;
    });
  }

  const springInput = document.getElementById('touch-spring-range');
  const springVal = document.getElementById('val-touch-spring');
  if (springInput) {
    springInput.addEventListener('input', (e) => {
      studioState.physics.springSpeed = parseFloat(e.target.value);
      if (springVal) springVal.textContent = studioState.physics.springSpeed.toFixed(2);
    });
  }

  // 13. Studio Lighting Controls
  const keyLightInput = document.getElementById('light-key-intensity');
  const keyLightVal = document.getElementById('val-key-light');
  if (keyLightInput) {
    keyLightInput.addEventListener('input', (e) => {
      studioState.lights.key = parseFloat(e.target.value);
      if (keyLight) keyLight.intensity = studioState.lights.key;
      if (keyLightVal) keyLightVal.textContent = studioState.lights.key.toFixed(1);
    });
  }

  const fillLightInput = document.getElementById('light-fill-intensity');
  const fillLightVal = document.getElementById('val-fill-light');
  if (fillLightInput) {
    fillLightInput.addEventListener('input', (e) => {
      studioState.lights.fill = parseFloat(e.target.value);
      if (fillLight) fillLight.intensity = studioState.lights.fill;
      if (fillLightVal) fillLightVal.textContent = studioState.lights.fill.toFixed(1);
    });
  }

  const rimLightInput = document.getElementById('light-rim-intensity');
  const rimLightVal = document.getElementById('val-rim-light');
  if (rimLightInput) {
    rimLightInput.addEventListener('input', (e) => {
      studioState.lights.rim = parseFloat(e.target.value);
      if (rimLight) rimLight.intensity = studioState.lights.rim;
      if (rimLightVal) rimLightVal.textContent = studioState.lights.rim.toFixed(1);
    });
  }

  const bgColorPicker = document.getElementById('bg-color-picker');
  if (bgColorPicker) {
    bgColorPicker.addEventListener('input', (e) => {
      studioState.lights.bg = e.target.value;
      scene.background.set(studioState.lights.bg);
    });
  }

  // 14. Export GLB & Render PNG
  const exportBtn = document.getElementById('btn-export-glb');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportModifiedGLB);
  }

  const renderBtn = document.getElementById('btn-render-png');
  if (renderBtn) {
    renderBtn.addEventListener('click', renderSnapshotPNG);
  }
}

function setShadingMode(mode) {
  studioState.shadingMode = mode;

  currentMeshes.forEach(mesh => {
    if (mode === 'wireframe') {
      mesh.material = new THREE.MeshBasicMaterial({
        color: studioState.skin.wireframeColor,
        wireframe: true
      });
    } else if (mode === 'solid') {
      mesh.material = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.6,
        metalness: 0.1
      });
    } else if (mode === 'material' || mode === 'rendered') {
      applySkinMaterialToMesh(mesh);
      if (mode === 'rendered') {
        mesh.material.roughness = studioState.skin.roughness;
        mesh.material.clearcoat = studioState.skin.clearcoat;
      }
    }
    mesh.material.needsUpdate = true;
  });
}

function updateSkinMaterials() {
  currentMeshes.forEach(mesh => {
    if (mesh.material) {
      if (studioState.skin.wireframe) {
        mesh.material.wireframe = true;
      } else {
        mesh.material.wireframe = false;
        if (!mesh.material.map && mesh.material.color) {
          mesh.material.color.set(studioState.skin.tone);
        }
        mesh.material.roughness = studioState.skin.roughness;
        mesh.material.clearcoat = studioState.skin.clearcoat;
      }
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
  const clipSelect = document.getElementById('anim-clip-select');
  const scrubber = document.getElementById('anim-scrubber');

  if (timelineBar) timelineBar.style.display = 'flex';

  // Populate Clips
  if (clipSelect) {
    clipSelect.innerHTML = animationsList.map((clip, idx) => 
      `<option value="${idx}">${clip.name || `Animation ${idx + 1}`} (${clip.duration.toFixed(1)}s)</option>`
    ).join('');

    clipSelect.addEventListener('change', (e) => {
      playAnimationClip(parseInt(e.target.value, 10));
    });
  }

  // Play / Pause Toggle
  if (playBtn) {
    playBtn.textContent = 'Pause';
    isPlayingAnimation = true;

    playBtn.onclick = () => {
      if (!activeAction) return;
      if (isPlayingAnimation) {
        activeAction.paused = true;
        playBtn.textContent = 'Play';
        isPlayingAnimation = false;
      } else {
        activeAction.paused = false;
        playBtn.textContent = 'Pause';
        isPlayingAnimation = true;
      }
    };
  }

  // Interactive Scrubber Dragging
  if (scrubber) {
    scrubber.onmousedown = () => { isScrubbing = true; };
    scrubber.ontouchstart = () => { isScrubbing = true; };

    scrubber.oninput = (e) => {
      if (!activeAction) return;
      const duration = activeAction.getClip().duration;
      const scrubTime = (parseFloat(e.target.value) / 100) * duration;
      activeAction.time = scrubTime;
      if (mixer) mixer.update(0);
      updateTimeDisplay(scrubTime, duration);
    };

    scrubber.onchange = () => { isScrubbing = false; };
  }

  // Speed Multiplier
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      animSpeed = parseFloat(btn.getAttribute('data-speed'));
      if (mixer) mixer.timeScale = animSpeed;
    };
  });
}

function playAnimationClip(index) {
  if (!mixer || !animationsList[index]) return;

  const clip = animationsList[index];
  const newAction = mixer.clipAction(clip);

  if (activeAction) {
    activeAction.fadeOut(0.2);
  }

  newAction.reset();
  newAction.fadeIn(0.2);
  newAction.play();
  newAction.paused = false;
  activeAction = newAction;

  const playBtn = document.getElementById('btn-play-anim');
  if (playBtn) playBtn.textContent = 'Pause';
  isPlayingAnimation = true;
}

function updateTimeDisplay(current, total) {
  const timeEl = document.getElementById('anim-time-display');
  if (!timeEl) return;

  const formatSec = (sec) => {
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${s.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  timeEl.textContent = `${formatSec(current)} / ${formatSec(total)}`;
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
      link.download = `blender_studio_edited_${Date.now()}.glb`;
      link.click();
    },
    (err) => console.error('Error exporting GLB:', err),
    { binary: true }
  );
}

function renderSnapshotPNG() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = `blender_render_${Date.now()}.png`;
  link.click();
}

function onWindowResize() {
  const container = document.getElementById('viewport-container');
  if (!container || !renderer || !camera) return;

  const aspect = container.clientWidth / container.clientHeight;
  if (isOrtho) {
    const frustumSize = 2.5;
    orthoCamera.left = (frustumSize * aspect) / -2;
    orthoCamera.right = (frustumSize * aspect) / 2;
    orthoCamera.top = frustumSize / 2;
    orthoCamera.bottom = frustumSize / -2;
    orthoCamera.updateProjectionMatrix();
  } else {
    perspCamera.aspect = aspect;
    perspCamera.updateProjectionMatrix();
  }

  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) {
    mixer.update(delta);

    // Sync scrubber and time counter if playing
    if (activeAction && !isScrubbing) {
      const duration = activeAction.getClip().duration;
      if (duration > 0) {
        const progress = (activeAction.time % duration) / duration;
        const scrubber = document.getElementById('anim-scrubber');
        if (scrubber) scrubber.value = (progress * 100).toFixed(1);
        updateTimeDisplay(activeAction.time % duration, duration);
      }
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
