/* ==========================================================================
   INTERACTIVE 3D VIEWER MODULE
   High-performance WebGL rendering with @google/model-viewer
   ========================================================================== */

let modelViewerEl = null;
let viewerTitleEl = null;
let autoRotateBtn = null;
let isAutoRotating = true;

export function init3DViewer() {
  modelViewerEl = document.querySelector('model-viewer');
  viewerTitleEl = document.getElementById('viewer-current-title');
  autoRotateBtn = document.getElementById('btn-auto-rotate');

  const btnSample1 = document.getElementById('btn-sample-1');
  const btnSample2 = document.getElementById('btn-sample-2');
  const btnResetCamera = document.getElementById('btn-reset-camera');
  const localFileInput = document.getElementById('local-file-input');
  const viewerWrap = document.querySelector('.viewer-card');

  if (!modelViewerEl) return;

  // Set default model
  loadModel('/models/sample-base-mesh.glb', 'Female Torso Base Mesh (Clean Topology)');

  // Auto rotate toggle
  if (autoRotateBtn) {
    autoRotateBtn.addEventListener('click', () => {
      isAutoRotating = !isAutoRotating;
      if (isAutoRotating) {
        modelViewerEl.setAttribute('auto-rotate', '');
        autoRotateBtn.classList.add('active');
      } else {
        modelViewerEl.removeAttribute('auto-rotate');
        autoRotateBtn.classList.remove('active');
      }
    });
  }

  // Camera reset
  if (btnResetCamera) {
    btnResetCamera.addEventListener('click', () => {
      modelViewerEl.cameraOrbit = '0deg 75deg 105%';
      modelViewerEl.cameraTarget = 'auto auto auto';
      modelViewerEl.fieldOfView = 'auto';
    });
  }

  // Sample model 1
  if (btnSample1) {
    btnSample1.addEventListener('click', () => {
      loadModel('/models/sample-base-mesh.glb', 'Female Torso Base Mesh (Clean Topology)');
      setActiveSample(btnSample1);
    });
  }

  // Sample model 2
  if (btnSample2) {
    btnSample2.addEventListener('click', () => {
      loadModel('/models/sample-panda.glb', 'Panda Head Low Poly (Fortnite)');
      setActiveSample(btnSample2);
    });
  }

  // Local file input
  if (localFileInput) {
    localFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleLocalFile(file);
      }
    });
  }

  // Drag and drop support
  if (viewerWrap) {
    ['dragenter', 'dragover'].forEach(eventName => {
      viewerWrap.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        viewerWrap.style.borderColor = 'var(--color-primary)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      viewerWrap.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        viewerWrap.style.borderColor = 'var(--color-outline)';
      }, false);
    });

    viewerWrap.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
          handleLocalFile(file);
        }
      }
    });
  }
}

function handleLocalFile(file) {
  const url = URL.createObjectURL(file);
  loadModel(url, `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
  document.querySelectorAll('.sample-toggle-btn').forEach(b => b.classList.remove('active'));
}

function setActiveSample(activeBtn) {
  document.querySelectorAll('.sample-toggle-btn').forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');
}

export function loadModel(srcUrl, titleText) {
  if (!modelViewerEl) return;
  modelViewerEl.src = srcUrl;
  if (viewerTitleEl && titleText) {
    viewerTitleEl.textContent = titleText;
  }
}
