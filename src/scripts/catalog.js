/* ==========================================================================
   CATALOG CONTROLLER & SEARCH ENGINE
   ========================================================================== */

import modelsData from '../data/models.json';
import { getLocale, t } from './i18n.js';
import { loadModel } from './viewer.js';

let currentCategory = 'all';
let currentSearchQuery = '';
let currentSort = 'name-asc';
let activeModelForModal = null;

export function initCatalog() {
  renderStats();
  renderCategoryPills();
  bindControls();
  renderCatalog();
}

function renderStats() {
  const statFilesEl = document.getElementById('stat-total-files');
  const statUniqueEl = document.getElementById('stat-unique-models');
  const statVolumeEl = document.getElementById('stat-archive-volume');

  if (statFilesEl) statFilesEl.textContent = modelsData.totalFiles;
  if (statUniqueEl) statUniqueEl.textContent = modelsData.uniqueModels;
  if (statVolumeEl) statVolumeEl.textContent = modelsData.totalSizeFormatted;
}

function renderCategoryPills() {
  const navEl = document.getElementById('categories-nav');
  if (!navEl) return;

  const locale = getLocale();
  const counts = {
    all: modelsData.models.length
  };

  modelsData.models.forEach(m => {
    counts[m.categoryKey] = (counts[m.categoryKey] || 0) + 1;
  });

  navEl.innerHTML = modelsData.categories.map(cat => {
    const label = locale === 'id' ? cat.labelId : cat.labelEn;
    const count = counts[cat.key] || 0;
    const isActive = cat.key === currentCategory;
    return `
      <button class="cat-pill ${isActive ? 'active' : ''}" data-category="${cat.key}">
        <span>${label}</span>
        <span class="cat-count">${count}</span>
      </button>
    `;
  }).join('');

  navEl.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      navEl.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category');
      renderCatalog();
    });
  });
}

function bindControls() {
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const copyBtn = document.getElementById('btn-copy-path');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      renderCatalog();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderCatalog();
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeModal();
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (activeModelForModal) {
        const fullPath = `E:\\0download blender\\${activeModelForModal.filename}`;
        navigator.clipboard.writeText(fullPath).then(() => {
          showToast(t('copiedToast'));
        });
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

export function renderCatalog() {
  const gridEl = document.getElementById('models-grid');
  const countEl = document.getElementById('result-count-text');
  if (!gridEl) return;

  const locale = getLocale();

  // Filter
  let filtered = modelsData.models.filter(m => {
    if (currentCategory !== 'all' && m.categoryKey !== currentCategory) {
      return false;
    }
    if (currentSearchQuery) {
      const matchTitle = m.title.toLowerCase().includes(currentSearchQuery);
      const matchFile = m.filename.toLowerCase().includes(currentSearchQuery);
      const matchTags = m.tags.some(t => t.toLowerCase().includes(currentSearchQuery));
      if (!matchTitle && !matchFile && !matchTags) return false;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (currentSort === 'name-asc') return a.title.localeCompare(b.title);
    if (currentSort === 'name-desc') return b.title.localeCompare(a.title);
    if (currentSort === 'size-desc') return b.sizeBytes - a.sizeBytes;
    if (currentSort === 'size-asc') return a.sizeBytes - b.sizeBytes;
    return 0;
  });

  // Update count text
  if (countEl) {
    countEl.innerHTML = `${t('showingCount')} <strong>${filtered.length}</strong> ${t('ofTotal')} <strong>${modelsData.models.length}</strong> ${t('modelsWord')}`;
  }

  // Render cards
  if (filtered.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 style="font-size: var(--text-lg); font-weight: 700;">${t('emptyTitle')}</h3>
        <p style="font-size: var(--text-sm); max-width: 440px;">${t('emptyDesc')}</p>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = filtered.map(model => {
    const categoryName = locale === 'id' ? model.categoryNameId : model.categoryNameEn;
    const formatClass = model.format.toLowerCase();

    return `
      <article class="model-card" data-id="${model.id}">
        <div class="card-top">
          <span class="format-badge ${formatClass}">${model.format}</span>
          <span class="file-size">${model.sizeFormatted}</span>
        </div>
        <h3 class="card-title" title="${model.title}">${model.title}</h3>
        <div class="card-filename" title="${model.filename}">${model.filename}</div>
        <div class="card-tags">
          <span class="tag-badge" style="color: var(--color-primary);">${categoryName}</span>
          ${model.tags.slice(0, 3).map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
        </div>
        <div class="card-actions">
          <button class="action-btn btn-secondary btn-inspect" data-id="${model.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>${t('details')}</span>
          </button>
          <button class="action-btn btn-primary btn-preview-action" data-id="${model.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>${t('viewIn3d')}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  // Attach card event listeners
  gridEl.querySelectorAll('.btn-inspect').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const model = modelsData.models.find(m => m.id === id);
      if (model) openModal(model);
    });
  });

  gridEl.querySelectorAll('.btn-preview-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const model = modelsData.models.find(m => m.id === id);
      if (model) handleCardPreview(model);
    });
  });
}

function handleCardPreview(model) {
  // Check if it matches bundled samples
  if (model.filename.includes('female_torso__clean_topology_base_mesh')) {
    loadModel('/models/sample-base-mesh.glb', model.title);
    scrollToViewer();
    return;
  }
  if (model.filename.includes('panda_head')) {
    loadModel('/models/sample-panda.glb', model.title);
    scrollToViewer();
    return;
  }

  // Otherwise open modal with copy path to drop into viewer
  openModal(model);
  showToast(getLocale() === 'id' 
    ? 'File fisik siap: Salin path atau tarik file ke area 3D viewer.' 
    : 'Local file ready: Copy path or drag file into 3D viewer.');
}

function scrollToViewer() {
  const viewerCard = document.querySelector('.viewer-card');
  if (viewerCard) {
    viewerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function openModal(model) {
  activeModelForModal = model;
  const locale = getLocale();
  const modalBackdrop = document.getElementById('modal-backdrop');
  const titleEl = document.getElementById('modal-model-title');
  const filenameEl = document.getElementById('modal-model-filename');
  const catEl = document.getElementById('modal-model-category');
  const formatEl = document.getElementById('modal-model-format');
  const sizeEl = document.getElementById('modal-model-size');
  const dateEl = document.getElementById('modal-model-date');
  const pathEl = document.getElementById('modal-model-path');

  if (titleEl) titleEl.textContent = model.title;
  if (filenameEl) filenameEl.textContent = model.filename;
  if (catEl) catEl.textContent = locale === 'id' ? model.categoryNameId : model.categoryNameEn;
  if (formatEl) formatEl.textContent = model.format;
  if (sizeEl) sizeEl.textContent = `${model.sizeFormatted} (${model.sizeBytes.toLocaleString()} bytes)`;
  if (dateEl) dateEl.textContent = model.lastModified;
  if (pathEl) pathEl.textContent = `E:\\0download blender\\${model.filename}`;

  const btnStudio = document.getElementById('btn-open-in-studio');
  if (btnStudio) {
    btnStudio.href = `/studio.html?id=${model.id}`;
  }

  if (modalBackdrop) modalBackdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modalBackdrop = document.getElementById('modal-backdrop');
  if (modalBackdrop) modalBackdrop.classList.remove('active');
  document.body.style.overflow = '';
}

function showToast(message) {
  const toastEl = document.getElementById('app-toast');
  const toastMsgEl = document.getElementById('toast-message');
  if (!toastEl || !toastMsgEl) return;

  toastMsgEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3500);
}
