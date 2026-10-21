/* Original Cupbox icon set: 24px grid, 1.65px rounded strokes. */
"use strict";
window.CupboxIcons = (() => {
  const paths = {
    'qq-bot': '<rect x="4" y="5" width="16" height="14" rx="5"/><path d="M12 2v3M8 19v3m8-3v3M1 10v5m22-5v5M8 14h8"/><circle cx="8.5" cy="10" r=".8"/><circle cx="15.5" cy="10" r=".8"/>',
    loader: '<circle cx="12" cy="12" r="9" opacity=".2"/><path d="M12 3a9 9 0 0 1 9 9"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    text: '<path d="M4 5h16M12 5v15M8 20h8"/>',
    vision: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    audio: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
    video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
    workflow: '<rect x="3" y="3" width="6" height="6" rx="2"/><rect x="15" y="3" width="6" height="6" rx="2"/><rect x="9" y="16" width="6" height="6" rx="2"/><path d="M6 9v3h12V9m-6 3v4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    shield: '<path d="m12 2 8 3v6c0 5-5 9-8 11-3-2-8-6-8-11V5Z"/><path d="M12 7v6m0 4h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    tools: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h7M17.5 14v7"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/>',
    settings: '<path d="m9 4 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2v-3l-1-2 2-3L7 5Z"/><circle cx="12" cy="11.5" r="3"/>',
    hash: '<path d="m9 3-3 18M18 3l-3 18M4 8h17M3 16h17"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    codec: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
    csv: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11M15 9v11"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    rename: '<path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Z"/><path d="M13 21h8"/>',
    organize: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="m9 14 2 2 4-4"/>',
    zip: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 3v3h2v3h-2v3h2v3h-2v3h2v-3"/>',
    obfuscate: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="M9 9h6v6H9Z" fill="currentColor" stroke="none"/>',
    ocr: '<path d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4M7 9h10M12 9v8M9 17h6"/>',
    clip: '<path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/><rect x="9" y="2" width="6" height="5" rx="1.5"/><path d="M8 12h8M8 16h5"/>',
    shot: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/><rect x="7" y="7" width="10" height="10" rx="2"/>',
    run: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/>',
    proc: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2" fill="var(--surface)"/><circle cx="16" cy="12" r="2" fill="var(--surface)"/><circle cx="10" cy="19" r="2" fill="var(--surface)"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon: '<path d="M21 13.3A9 9 0 0 1 10.7 3 9 9 0 1 0 21 13.3Z"/>',
    desktop_observe:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',desktop_capture:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="7" y="7" width="10" height="10" rx="2"/>',desktop_mouse:'<rect x="7" y="2" width="10" height="20" rx="5"/><path d="M12 3v6M7 10h10"/>',desktop_type:'<path d="M4 4h16M12 4v16M8 20h8"/>',desktop_key:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h1m3 0h1m3 0h1m3 0h1M6 13h1m3 0h1m3 0h1M8 16h8"/>',desktop_ocr:'<path d="M4 8V4h4m8 0h4v4M4 16v4h4m8 0h4v-4M9 8v8m6-8v8M9 12h6"/>',desktop_vision:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
    upload: '<path d="M12 16V3m-4 4 4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  };
  const html = (name, cls = "") => `<svg data-glyph="${Object.hasOwn(paths,name)?name:'tools'}" class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.tools}</svg>`;
  const mount = (root = document) => root.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = html(el.dataset.icon); });
  return { html, mount, names: Object.keys(paths) };
})();
