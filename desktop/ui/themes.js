"use strict";
window.CupboxTheme = (() => {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const catalog = {
    sakura:{ name:'樱晴 · Sakura companion', label:'樱晴插画', caption:'樱花、晴空和陪伴', group:'illustration', file:'sakura-companion.png' },
    bloom:{ name:'绽放 · Fluent bloom', label:'绽放壁纸', caption:'随深浅模式变换', group:'minimal' },
    moonlake:{ name:'月湖 · Moonlit lake', label:'月湖星语', caption:'银月、湖光与星河', group:'illustration', file:'moonlake.png' },
    garden:{ name:'花庭 · Secret garden', label:'花庭午后', caption:'花香里的一小段闲暇', group:'illustration', file:'garden.png' },
    aurora:{ name:'极光 · Northern lights', label:'极光夜航', caption:'青绿光幕掠过夜空', group:'nature', file:'aurora.png' },
    dunes:{ name:'沙丘 · Golden dunes', label:'流金沙丘', caption:'温暖、柔软的日光', group:'nature', file:'dunes.png' },
    ink:{ name:'水墨 · Quiet ink', label:'远山水墨', caption:'留白之间，思路自明', group:'minimal', file:'ink.png' },
    none:{ name:'纯色 · 专注此刻', group:'minimal' },
    custom:{ name:'自定义 · 你的风景', group:'custom' },
  };
  const names = Object.fromEntries(Object.entries(catalog).map(([id,t]) => [id,t.name]));
  let hooks, activeLayer = 0, request = 0, source = '', saveTimer;
  const defaults = { background: 'sakura', backgroundVeil: 72, backgroundBlur: 0, backgroundFit: 'cover' };
  const sourceFor = (p, theme) => p.background === 'custom' ? (p.customBackground || '') : p.background === 'bloom' ? `assets/bloom-${theme === 'dark' ? 'dark' : 'light'}.png` : p.background === 'none' ? '' : `assets/${(catalog[p.background] || catalog.sakura).file}`;

  function apply(p) {
    const root = document.documentElement;
    const theme = root.dataset.theme || 'light';
    const kind = Object.hasOwn(names, p.background) ? p.background : 'sakura';
    root.dataset.background = kind;
    const veil = Number.isFinite(Number(p.backgroundVeil)) ? Math.max(35, Math.min(95, Number(p.backgroundVeil))) : 72;
    const blur = Math.max(0, Math.min(20, Number(p.backgroundBlur) || 0));
    root.style.setProperty('--wallpaper-veil', String(veil / 100));
    root.style.setProperty('--wallpaper-blur', `${blur}px`);
    root.style.setProperty('--wallpaper-fit', p.backgroundFit === 'contain' ? 'contain' : 'cover');
    const next = sourceFor({ ...p, background: kind }, theme);
    if (next !== source) {
      source = next;
      const token = ++request;
      const layers = [...document.querySelectorAll('.desktop-wallpaper img')];
      if (!next) layers.forEach(img => img.classList.remove('visible'));
      else {
        const layer = layers[1 - activeLayer];
        layer.onload = () => {
          if (token !== request) return;
          layers[activeLayer].classList.remove('visible');
          layer.classList.add('visible');
          activeLayer = 1 - activeLayer;
        };
        layer.onerror = () => {
          if (token !== request) return;
          layers.forEach(img => img.classList.remove('visible'));
          $('wallpaper-status').textContent = '背景图片暂时无法读取，可重新选择图片。';
        };
        layer.src = next;
      }
    }
    $('theme-preview-image').src = next || 'assets/sakura-companion.png';
    $('theme-preview-name').textContent = names[kind];
    $('theme-preview-caption').textContent = kind === 'custom' ? (p.customBackgroundName || '让喜欢的风景陪你工作。') : catalog[kind].caption || '收起背景，让思路更清晰。';
    document.querySelectorAll('.background-card[data-background]').forEach(b => {
      const selected = b.dataset.background === kind;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('#seg-theme [data-theme]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === root.dataset.themePref)));
    const selected = [...$('seg-theme').children].findIndex(b => b.dataset.theme === root.dataset.themePref);
    $('seg-theme').style.setProperty('--selected', String(Math.max(0, selected)));
    $('wallpaper-veil').value = String(veil); $('veil-output').value = `${veil}%`;
    $('wallpaper-blur').value = String(blur); $('blur-output').value = `${blur} px`;
    $('wallpaper-fit').value = p.backgroundFit === 'contain' ? 'contain' : 'cover';
    $('wallpaper-controls').hidden = kind === 'none';
    $('custom-background-name').textContent = p.customBackgroundName || 'PNG、JPG、WebP、BMP · 最大 20 MB';
    $('bloom-thumbnail').src = `assets/bloom-${theme}.png`;
    if (p.customBackground) { $('custom-thumbnail').src = p.customBackground; $('custom-thumbnail').hidden = false; }
    else $('custom-thumbnail').hidden = true;
  }

  async function chooseCustom() {
    const btn = $('choose-wallpaper');
    if (btn.disabled) return;
    btn.disabled = true;
    $('wallpaper-status').textContent = '选择一张喜欢的图片…';
    try {
      const r = await hooks.pick();
      if (r?.canceled) { $('wallpaper-status').textContent = ''; return; }
      if (!r?.ok) throw new Error(r?.error || '无法导入图片');
      await hooks.save({ background: 'custom', customBackground: r.url, customBackgroundName: r.name });
      apply(hooks.getPrefs());
      $('wallpaper-status').textContent = '已保存到本机，移动原图片也不会影响背景。';
    } catch (e) { $('wallpaper-status').textContent = e.message; }
    finally { btn.disabled = false; }
  }

  function init(options) {
    hooks = options;
    const grid = document.querySelector('.background-grid');
    const before = grid.querySelector('[data-background="none"]');
    for (const [id,t] of Object.entries(catalog)) {
      if (!t.file || id === 'sakura') continue;
      const b = document.createElement('button');
      b.className = 'background-card'; b.dataset.background = id;
      b.setAttribute('aria-pressed','false');
      b.innerHTML = `<span class="background-thumb"><img src="assets/${t.file}" alt="" /><i data-icon="check">${CupboxIcons.html('check')}</i></span><b>${t.label}</b><small>${t.caption}</small>`;
      grid.insertBefore(b,before);
    }
    document.querySelectorAll('[data-theme-filter]').forEach(b => b.addEventListener('click',() => {
      document.querySelectorAll('[data-theme-filter]').forEach(x => { x.classList.toggle('active',x===b); x.setAttribute('aria-pressed',String(x===b)); });
      grid.querySelectorAll('.background-card').forEach(card => { card.hidden = b.dataset.themeFilter !== 'all' && catalog[card.dataset.background].group !== b.dataset.themeFilter; });
    }));
    document.querySelectorAll('.background-card[data-background]').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.background === 'custom' && !hooks.getPrefs().customBackground) { await chooseCustom(); return; }
      const pending = hooks.save({ background: b.dataset.background });
      apply(hooks.getPrefs());
      await pending;
    }));
    $('choose-wallpaper').addEventListener('click', chooseCustom);
    for (const [id, key] of [['wallpaper-veil', 'backgroundVeil'], ['wallpaper-blur', 'backgroundBlur']]) {
      $(id).addEventListener('input', () => {
        const value = Number($(id).value);
        Object.assign(hooks.getPrefs(), { [key]: value });
        apply(hooks.getPrefs());
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => void hooks.save({ backgroundVeil: hooks.getPrefs().backgroundVeil, backgroundBlur: hooks.getPrefs().backgroundBlur }), 180);
      });
      $(id).addEventListener('change', () => {
        clearTimeout(saveTimer);
        void hooks.save({ [key]: Number($(id).value) });
      });
    }
    $('wallpaper-fit').addEventListener('change', () => {
      void hooks.save({ backgroundFit: $('wallpaper-fit').value });
      apply(hooks.getPrefs());
    });
    $('reset-appearance').addEventListener('click', () => {
      clearTimeout(saveTimer);
      void hooks.save({ ...defaults, theme: 'light', accent: 'aurora' });
      hooks.theme('light', 'aurora');
      $('wallpaper-status').textContent = '已恢复樱晴主题。';
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('.background-card,.startup-card,.theme-filters button,.seg-btn,.swatch,.tab,.mode-btn,.quick-card');
      if (b && !reduced.matches) b.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    apply(hooks.getPrefs());
  }
  return { init, apply, sourceFor, catalog };
})();
