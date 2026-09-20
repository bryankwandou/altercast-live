/* ==========================================================================
   MAIN APPLICATION BOOTSTRAPPER
   ========================================================================== */

import './styles/main.css';
import { init3DViewer } from './scripts/viewer.js';
import { initCatalog, renderCatalog } from './scripts/catalog.js';
import { getLocale, setLocale, applyTranslations } from './scripts/i18n.js';

function initTheme() {
  const savedTheme = localStorage.getItem('app_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  applyTheme(initialTheme);

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('app_theme', theme);

  const sunIcon = document.getElementById('icon-sun');
  const moonIcon = document.getElementById('icon-moon');
  if (sunIcon && moonIcon) {
    if (theme === 'dark') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }
}

function initLanguage() {
  const currentLang = getLocale();
  setLocale(currentLang);

  const langToggleBtn = document.getElementById('lang-toggle-btn');
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      const nextLang = getLocale() === 'id' ? 'en' : 'id';
      setLocale(nextLang);
      renderCatalog();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLanguage();
  init3DViewer();
  initCatalog();
  applyTranslations();
});
