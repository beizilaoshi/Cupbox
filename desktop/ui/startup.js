"use strict";
window.CupboxStartup = (() => {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = {startupEnabled:true,startupStyle:'orbit',startupDuration:1.6,startupCaption:'让灵感，轻轻启程。'};
  let hooks, finish = null, timer, textTimer, generation=0;

  function sync(p) {
    $('startup-enabled').checked = p.startupEnabled !== false;
    $('startup-duration').value = String(p.startupDuration || 1.6);
    $('startup-duration-output').value = `${Number(p.startupDuration || 1.6).toFixed(1)} 秒`;
    if (document.activeElement !== $('startup-caption')) $('startup-caption').value = p.startupCaption ?? defaults.startupCaption;
    document.querySelectorAll('.startup-card').forEach(b => {
      const active = b.dataset.startupStyle === (p.startupStyle || 'orbit');
      b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active));
    });
    $('startup-media-name').textContent = p.customStartupName || 'GIF、MP4、WebM 或图片 · 最大 40 MB';
    $('startup-settings-caption').textContent = p.startupCaption ?? defaults.startupCaption;
  }

  function play(p, options = {}) {
    finish?.();
    if ((!options.preview && p.startupEnabled === false) || reduced.matches) return Promise.resolve(false);
    const screen = $('startup-screen');
    const token=++generation;
    const style = ['orbit','cinema','pulse','custom'].includes(p.startupStyle) ? p.startupStyle : 'orbit';
    const duration = Math.max(.8,Math.min(5,Number(p.startupDuration) || 1.6));
    const previousFocus = document.activeElement;
    const surfaces = [...document.querySelectorAll('#app,.layout,.modal,.drawer,#notice-panel,.toast')].map(el => [el,el.inert]);
    surfaces.forEach(([el]) => { el.inert = true; });
    screen.dataset.style = style;
    $('startup-backdrop').onerror=()=>{if(token===generation)screen.dataset.style='pulse';};
    screen.style.setProperty('--startup-duration',`${duration}s`);
    $('startup-display-caption').textContent = p.startupCaption ?? defaults.startupCaption;
    $('startup-display-version').textContent = $('ver-chip').textContent;
    $('startup-media-error').textContent = '';
    const media = $('startup-media'); media.replaceChildren();
    const background = CupboxTheme.sourceFor(p,document.documentElement.dataset.theme);
    $('startup-backdrop').src = style==='orbit'?'assets/startup-atelier.png':background || 'assets/bloom-light.png';
    if (style === 'custom' && p.customStartupUrl) {
      const el = document.createElement(p.customStartupKind === 'video' ? 'video' : 'img');
      if (el.tagName === 'VIDEO') { el.muted=true; el.autoplay=true; el.loop=true; el.playsInline=true; }
      else el.alt = '';
      el.src = p.customStartupUrl;
      el.onerror = () => { if(token!==generation)return; media.replaceChildren(); $('startup-media-error').textContent = '素材无法播放，已使用简洁开场。'; screen.dataset.style='pulse'; };
      media.appendChild(el);
      if (el.tagName === 'VIDEO') el.play().catch(() => el.onerror?.());
    } else if (style === 'custom') screen.dataset.style = 'pulse';
    screen.hidden=false;
    void screen.offsetWidth;
    screen.classList.add('playing');
    $('skip-startup').focus();
    return new Promise(resolve => {
      finish = () => {
        generation++;
        clearTimeout(timer);
        screen.classList.remove('playing'); screen.hidden=true;
        media.querySelector('video')?.pause(); media.replaceChildren();
        surfaces.forEach(([el,wasInert]) => { el.inert=wasInert; });
        finish=null;
        if (previousFocus?.isConnected && !previousFocus.inert) previousFocus.focus();
        resolve(true);
      };
      timer=setTimeout(() => finish?.(),duration*1000);
    });
  }

  async function choose() {
    const btn=$('choose-startup-media'); if(btn.disabled)return;
    btn.disabled=true;
    try {
      const r=await hooks.pick();
      if(r?.canceled)return;
      if(!r?.ok)throw new Error(r?.error || '导入失败');
      await hooks.save({startupStyle:'custom',customStartupUrl:r.url,customStartupKind:r.kind,customStartupName:r.name});
      sync(hooks.getPrefs());
      $('startup-status').textContent='素材已保存在本机，点击预览查看效果。视频将静音播放。';
    } catch(e){ $('startup-status').textContent=e.message; }
    finally{btn.disabled=false;}
  }

  function init(options) {
    hooks=options;
    $('skip-startup').addEventListener('click',()=>finish?.());
    window.addEventListener('keydown',e=>{
      if(!finish)return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish();}
      if(e.key==='Tab'){e.preventDefault();$('skip-startup').focus();}
    },true);
    reduced.addEventListener('change',()=>{if(reduced.matches)finish?.();});
    document.querySelectorAll('.startup-card').forEach(b=>b.addEventListener('click',()=>{
      if(b.dataset.startupStyle==='custom'&&!hooks.getPrefs().customStartupUrl){void choose();return;}
      void hooks.save({startupStyle:b.dataset.startupStyle});sync(hooks.getPrefs());
    }));
    $('startup-enabled').addEventListener('change',()=>void hooks.save({startupEnabled:$('startup-enabled').checked}));
    $('startup-duration').addEventListener('input',()=>{
      hooks.getPrefs().startupDuration=Number($('startup-duration').value);sync(hooks.getPrefs());
    });
    $('startup-duration').addEventListener('change',()=>void hooks.save({startupDuration:Number($('startup-duration').value)}));
    $('startup-caption').addEventListener('input',()=>{
      hooks.getPrefs().startupCaption=$('startup-caption').value.slice(0,60);
      $('startup-settings-caption').textContent=hooks.getPrefs().startupCaption;
      clearTimeout(textTimer);textTimer=setTimeout(()=>void hooks.save({startupCaption:hooks.getPrefs().startupCaption}),200);
    });
    $('startup-caption').addEventListener('change',()=>{clearTimeout(textTimer);void hooks.save({startupCaption:$('startup-caption').value.slice(0,60)});});
    $('choose-startup-media').addEventListener('click',()=>void choose());
    $('preview-startup').addEventListener('click',()=>{if(reduced.matches)$('startup-status').textContent='系统已开启减少动态效果，启动动画将自动跳过。';else void play(hooks.getPrefs(),{preview:true});});
    $('reset-startup').addEventListener('click',()=>{clearTimeout(textTimer);void hooks.save({...defaults});sync(hooks.getPrefs());$('startup-status').textContent='已恢复默认启动动画。';});
    sync(hooks.getPrefs());
  }
  return {init,sync,play,skip:()=>finish?.(),defaults};
})();
