/* ==========================================================================
   LOCALIZATION SYSTEM (id & en)
   Rule [X-D]: Mandatory Bilingual Support (Bahasa Indonesia & English)
   ========================================================================== */

export const translations = {
  id: {
    brandTitle: "Arsip 3D Blender",
    brandSubtitle: "Katalog Aset Komprehensif",
    taglineBadge: "188 Aset Terindeks",
    heroTitle: "Katalog Model 3D & Arsip Aset Interaktif",
    heroDescription: "Koleksi aset 3D fidelitas tinggi, model karakter, base mesh topologi bersih, rig siap-game, dan scene lingkungan. Pratinjau langsung secara interaktif dengan WebGL di browser Anda.",
    statTotalFiles: "Total File",
    statUniqueModels: "Model Unik",
    statArchiveVolume: "Ukuran Arsip",
    liveViewerTitle: "Interactive 3D WebGL Viewer",
    sampleModel1: "Base Mesh Torso",
    sampleModel2: "Panda Head",
    autoRotate: "Putar Otomatis",
    resetCamera: "Reset Kamera",
    loadLocalModel: "Muat File Lokal (.glb)",
    searchPlaceholder: "Cari nama karakter, game, atau tag...",
    sortNameAsc: "Urutkan: Nama (A-Z)",
    sortNameDesc: "Urutkan: Nama (Z-A)",
    sortSizeDesc: "Urutkan: Ukuran Terbesar",
    sortSizeAsc: "Urutkan: Ukuran Terkecil",
    cat_all: "Semua Model",
    cat_game_characters: "Karakter Game",
    cat_anime_manga: "Anime & Manga",
    cat_base_mesh: "Base Mesh & Anatomi",
    cat_props_costumes: "Aset & Busana",
    cat_environment: "Lingkungan & Scene",
    cat_stylized_fantasy: "Fantasi & Lainnya",
    showingCount: "Menampilkan",
    ofTotal: "dari",
    modelsWord: "model",
    viewIn3d: "Pratinjau 3D",
    details: "Spesifikasi",
    modalTitle: "Spesifikasi Model 3D",
    modalFilename: "Nama File",
    modalCategory: "Kategori",
    modalFormat: "Format File",
    modalSize: "Ukuran File",
    modalLastModified: "Terakhir Diperbarui",
    modalLocalPath: "Lokasi Folder Fisik",
    copyCommand: "Salin Lokasi Path",
    copiedToast: "Lokasi path berhasil disalin ke clipboard",
    emptyTitle: "Tidak ada model yang sesuai",
    emptyDesc: "Coba gunakan kata kunci pencarian lain atau pilih kategori yang berbeda.",
    footerNote: "Arsip Model 3D Blender. Dibangun dengan standar performa dan aksesibilitas tinggi.",
    themeToggle: "Ganti Tema",
    langToggle: "English"
  },
  en: {
    brandTitle: "Blender 3D Archive",
    brandSubtitle: "Comprehensive Asset Catalog",
    taglineBadge: "188 Assets Indexed",
    heroTitle: "Interactive 3D Model Catalog & Asset Archive",
    heroDescription: "High-fidelity 3D assets, character models, clean topology base meshes, game-ready rigs, and environment scans. Preview in real-time WebGL directly in your browser.",
    statTotalFiles: "Total Files",
    statUniqueModels: "Unique Models",
    statArchiveVolume: "Archive Volume",
    liveViewerTitle: "Interactive 3D WebGL Viewer",
    sampleModel1: "Base Mesh Torso",
    sampleModel2: "Panda Head",
    autoRotate: "Auto Rotate",
    resetCamera: "Reset Camera",
    loadLocalModel: "Load Local (.glb)",
    searchPlaceholder: "Search character name, franchise, or tag...",
    sortNameAsc: "Sort: Name (A-Z)",
    sortNameDesc: "Sort: Name (Z-A)",
    sortSizeDesc: "Sort: Largest Size",
    sortSizeAsc: "Sort: Smallest Size",
    cat_all: "All Models",
    cat_game_characters: "Game Characters",
    cat_anime_manga: "Anime & Manga",
    cat_base_mesh: "Base Mesh & Anatomy",
    cat_props_costumes: "Props & Costumes",
    cat_environment: "Environment & Scene",
    cat_stylized_fantasy: "Fantasy & Stylized",
    showingCount: "Showing",
    ofTotal: "of",
    modelsWord: "models",
    viewIn3d: "Preview 3D",
    details: "Specs",
    modalTitle: "3D Model Specifications",
    modalFilename: "Filename",
    modalCategory: "Category",
    modalFormat: "File Format",
    modalSize: "File Size",
    modalLastModified: "Last Modified",
    modalLocalPath: "Physical Directory Path",
    copyCommand: "Copy Path",
    copiedToast: "Directory path copied to clipboard",
    emptyTitle: "No matching models found",
    emptyDesc: "Try adjusting your search keywords or switching category filters.",
    footerNote: "Blender 3D Asset Archive. Built with modern performance and accessibility standards.",
    themeToggle: "Toggle Theme",
    langToggle: "Bahasa Indonesia"
  }
};

let currentLocale = localStorage.getItem('app_locale') || 'id';

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  currentLocale = locale;
  localStorage.setItem('app_locale', locale);
  document.documentElement.setAttribute('lang', locale);
  applyTranslations();
}

export function t(key) {
  return translations[currentLocale][key] || key;
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLocale][key]) {
      el.textContent = translations[currentLocale][key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[currentLocale][key]) {
      el.setAttribute('placeholder', translations[currentLocale][key]);
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (translations[currentLocale][key]) {
      el.setAttribute('title', translations[currentLocale][key]);
    }
  });

  const langBtnText = document.getElementById('lang-btn-text');
  if (langBtnText) {
    langBtnText.textContent = currentLocale === 'id' ? 'EN' : 'ID';
  }
}
