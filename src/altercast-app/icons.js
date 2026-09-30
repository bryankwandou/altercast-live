/* ═══════════════════════════════════════════════════════════
   AlterCast — Inline SVG Icons (no library, no fonts)
   Each function returns SVG markup string with stroke=currentColor
═══════════════════════════════════════════════════════════ */

const SVG = (size, body) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const icons = {
  studio:  (s = 16) => SVG(s, `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>`),
  avatar:  (s = 16) => SVG(s, `<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>`),
  dashboard: (s = 16) => SVG(s, `<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>`),
  settings: (s = 16) => SVG(s, `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`),
  monitor: (s = 16) => SVG(s, `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`),
  radio:   (s = 16) => SVG(s, `<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>`),
  brain:   (s = 16) => SVG(s, `<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15A2.5 2.5 0 0 1 9.5 22a2.5 2.5 0 0 1-2.5-2.5V18A2.5 2.5 0 0 1 4.5 15.5 2.5 2.5 0 0 1 2 13.05 2.5 2.5 0 0 1 4 10.5 2.5 2.5 0 0 1 4 7 2.5 2.5 0 0 1 6.5 4.5 2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5V18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 22 13.05a2.5 2.5 0 0 0-2-2.55A2.5 2.5 0 0 0 20 7a2.5 2.5 0 0 0-2.5-2.5A2.5 2.5 0 0 0 14.5 2z"/>`),
  mic:     (s = 16) => SVG(s, `<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>`),
  micOff:  (s = 16) => SVG(s, `<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>`),
  vol:     (s = 16) => SVG(s, `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>`),
  volX:    (s = 16) => SVG(s, `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`),
  cam:     (s = 16) => SVG(s, `<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>`),
  camOff:  (s = 16) => SVG(s, `<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/>`),
  play:    (s = 16) => SVG(s, `<polygon points="5 3 19 12 5 21 5 3"/>`),
  stop:    (s = 16) => SVG(s, `<rect x="6" y="6" width="12" height="12"/>`),
  record:  (s = 16) => SVG(s, `<circle cx="12" cy="12" r="6"/>`),
  fullscreen: (s = 16) => SVG(s, `<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>`),
  exitFs:  (s = 16) => SVG(s, `<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>`),
  share:   (s = 16) => SVG(s, `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>`),
  copy:    (s = 16) => SVG(s, `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`),
  refresh: (s = 16) => SVG(s, `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`),
  download: (s = 16) => SVG(s, `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`),
  upload:  (s = 16) => SVG(s, `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`),
  moon:    (s = 16) => SVG(s, `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`),
  sun:     (s = 16) => SVG(s, `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`),
  plus:    (s = 16) => SVG(s, `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`),
  x:       (s = 16) => SVG(s, `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`),
  heart:   (s = 16) => SVG(s, `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`),
  send:    (s = 16) => SVG(s, `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`),
  eye:     (s = 16) => SVG(s, `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`),
  bolt:    (s = 16) => SVG(s, `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`),
  shield:  (s = 16) => SVG(s, `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`),
  message: (s = 16) => SVG(s, `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`),
  sliders: (s = 16) => SVG(s, `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`),
  orbit:   (s = 16) => SVG(s, `<circle cx="12" cy="12" r="3"/><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12"/><path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12" stroke-dasharray="2 2"/>`),
  cinema:  (s = 16) => SVG(s, `<rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>`),
  wand:    (s = 16) => SVG(s, `<line x1="11" y1="4" x2="13" y2="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/><polygon points="5 22 9 18 14 13 11 10 6 15 2 19 5 22"/>`),
  home:    (s = 16) => SVG(s, `<path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>`),
};

export function injectIcon(el, name, size = 16) {
  if (icons[name]) el.innerHTML = icons[name](size);
}
