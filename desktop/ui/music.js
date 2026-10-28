'use strict';
(() => {
  const api=window.cupbox||window.qqBot,owner=Boolean(window.cupbox);
  if(!api?.musicState)return;
  const right=document.querySelector('.topbar-right'),caption=document.querySelector('.topbar .caption');
  if(!right&&!caption)return;
  const button=document.createElement('button');button.id='music-control';button.type='button';button.className='music-toggle no-drag';
  button.innerHTML='<span class="music-vinyl" aria-hidden="true"><span class="music-label"></span></span><span class="music-copy"><b>背景音乐</b><small>准备音乐…</small></span><span class="music-notes" aria-hidden="true"><i>♪</i><i>♫</i><i>♬</i></span>';
  if(right)right.prepend(button);else caption.before(button);
  if(owner){const settings=document.createElement('button');settings.id='music-settings-open';settings.className='music-settings-open no-drag';settings.type='button';settings.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7m4 0h5M4 17h3m4 0h9M11 4v6M7 14v6"/></svg>';settings.setAttribute('aria-label','打开背景音乐设置');settings.title='歌单与播放设置';settings.onclick=()=>window.openModal?.('music');button.after(settings);}
  const audio=owner?new Audio():null,$=id=>document.getElementById(id),panel=$('tab-music');
  if(audio){audio.volume=.3;audio.preload='auto';}
  let state,applied=-1,generation=0,pending=false,listSignature='';
  const status=()=>!state?.currentId?'没有可播放的歌曲':state.error?'播放失败，点击重试或切换歌曲':state.playing?'播放中':state.enabled?'正在开启':'已暂停';
  function buildList(){
    const signature=JSON.stringify(state.tracks.map(t=>[t.id,t.title,t.disabled,t.system,t.network,t.artist,t.playlist]));if(signature===listSignature)return;listSignature=signature;
    const list=$('music-track-list'),active=document.activeElement,rowId=active?.closest('[data-track-id]')?.dataset.trackId,action=active?.dataset.action;list.replaceChildren();
    if(!state.tracks.length){const empty=document.createElement('p');empty.className='music-empty';empty.textContent='还没有歌曲，可以导入本地音乐，或在下方酷狗概念版中加入歌曲。';list.append(empty);}
      for(const track of state.tracks){
        const system=Boolean(track.system),network=Boolean(track.network);
        const row=document.createElement('div');row.className='music-track';row.dataset.trackId=track.id;row.classList.toggle('is-disabled',track.disabled);
        const play=document.createElement('button');play.type='button';play.className='music-track-play';play.dataset.action='select';play.setAttribute('aria-label','播放 '+track.title);play.disabled=track.disabled;
        const icon=document.createElement('span');icon.className='music-track-bars';icon.setAttribute('aria-hidden','true');icon.innerHTML='<i></i><i></i><i></i>';play.append(icon);
        const copy=document.createElement('span');copy.className='music-track-copy';const name=document.createElement('b'),sub=document.createElement('small');name.textContent=track.title;sub.textContent=track.disabled?'已禁用':system?'内置音乐 · 仅可禁用':network?[track.artist,track.playlist].filter(Boolean).join(' · '):'本机导入 · 可删除';copy.append(name,sub);play.append(copy);row.append(play);
        const toggle=document.createElement('label');toggle.className='switch music-track-switch';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!track.disabled;checkbox.dataset.action='disable';checkbox.setAttribute('aria-label','启用 '+track.title);const rail=document.createElement('span');rail.className='track';rail.innerHTML='<span class="thumb"></span>';toggle.append(checkbox,rail);row.append(toggle);
        if(!system){const remove=document.createElement('button');remove.type='button';remove.dataset.action='remove';remove.className='music-remove';remove.textContent=network?'移除':'删除';remove.setAttribute('aria-label','删除 '+track.title);row.append(remove);}else{const spacer=document.createElement('span');spacer.className='music-remove-placeholder';spacer.setAttribute('aria-hidden','true');row.append(spacer);}
        const badge=document.createElement('span');badge.className='music-source-label';badge.textContent=system?'系统':network?'网络歌单':'本地歌曲';badge.dataset.source=system?'system':network?'network':'local';if(system)badge.title='系统歌曲不可删除，可以禁用';row.append(badge);
        list.append(row);
      }
    if(rowId&&action){const replacement=[...list.querySelectorAll('[data-track-id]')].find(r=>r.dataset.trackId===rowId)?.querySelector('[data-action="'+action+'"]');replacement?.focus({preventScroll:true});}
  }
  function paint(){
    if(!state)return;const text=status();button.classList.toggle('is-playing',state.playing);button.classList.toggle('has-error',state.error);button.setAttribute('aria-pressed',String(state.playing));button.setAttribute('aria-busy',String(state.enabled&&Boolean(state.currentId)&&!state.playing&&!state.error));button.querySelector('b').textContent=state.title;button.querySelector('small').textContent=text;button.setAttribute('aria-label',`${state.title}，${text}，${state.error?'重试播放':state.enabled?'关闭音乐':'开启音乐'}`);button.title=`${state.title} · ${state.enabled?'点击暂停':'点击播放'}`;
    if(!panel)return;buildList();$('music-now-title').textContent=state.title;$('music-now-status').textContent=text;panel.querySelector('.music-studio').classList.toggle('is-playing',state.playing);$('music-play').textContent=state.error?'重试':state.enabled?'暂停':'播放';$('music-play').disabled=pending||!state.currentId;
    $('music-mode').value=state.mode;$('music-mode-note').textContent=state.mode==='single'?'反复播放当前歌曲。':state.mode==='sequence'?'按歌单顺序播放，末尾从头开始；跳过禁用歌曲。':'随机切换已启用的歌曲，多首时不会连续重复同一首。';
    if(document.activeElement!==$('music-volume')){$('music-volume').value=String(Math.round(state.volume*100));$('music-volume-output').value=Math.round(state.volume*100)+'%';}
    $('music-library-count').textContent=state.tracks.filter(t=>!t.disabled).length+' 首可播放 / 共 '+state.tracks.length+' 首';
    for(const row of panel.querySelectorAll('.music-track')){row.classList.toggle('is-current',row.dataset.trackId===state.currentId);row.classList.toggle('is-playing',row.dataset.trackId===state.currentId&&state.playing);row.querySelector('.music-track-play').setAttribute('aria-pressed',String(row.dataset.trackId===state.currentId));row.querySelector('input').checked=!state.tracks.find(t=>t.id===row.dataset.trackId)?.disabled;}
    for(const el of panel.querySelectorAll('button,input,select')){if(el.id==='music-play'||el.closest('#echo-login-card,#bgmusic-online'))continue;el.disabled=pending||(el.dataset.action==='select'&&Boolean(state.tracks.find(t=>t.id===el.closest('[data-track-id]')?.dataset.trackId)?.disabled))||(['music-next','music-previous'].includes(el.id)&&!state.currentId);}
  }
  function report(error=false){if(!audio||!state)return;void api.musicReport({revision:state.revision,playing:!audio.paused&&!error,error}).catch(()=>{});}
  async function apply(next){
    if(state&&next.revision<state.revision)return;state=next;paint();if(!audio||applied===next.revision)return;
    applied=next.revision;const token=++generation,current=next.tracks.find(t=>t.id===next.currentId&&!t.disabled);
    audio.loop=next.mode==='single';audio.volume=next.volume;
    if(!current){audio.pause();audio.removeAttribute('src');audio.load();return;}
    if(!next.enabled){audio.pause();return;}
    try{
      let url=current.url;
      if(current.network){
        if(audio.dataset.trackId!==current.id||!audio.src||audio.error){audio.pause();audio.removeAttribute('src');url=await api.backgroundMusicResolve(current.id);if(token!==generation)return;}
        else url=audio.src;
      }
      if(token!==generation)return;
      if(audio.src!==url){audio.pause();audio.src=url;}audio.dataset.trackId=current.id;
      if(audio.error)audio.load();await audio.play();if(token!==generation)return;report();
    }catch(e){if(token===generation){if(panel)$('music-feedback').textContent=e.message||'音乐播放失败，请重试';report(true);}}
  }
  async function perform(action,message){if(pending)return;pending=true;button.disabled=true;paint();try{const next=await action();await apply(next);if(panel&&!next.canceled&&message)$('music-feedback').textContent=typeof message==='function'?message(next):message;}catch(e){if(panel)$('music-feedback').textContent=e.message||'音乐操作未成功，请重试';button.title='音乐操作未成功，请重试';}finally{pending=false;button.disabled=false;paint();}}
  if(audio){audio.addEventListener('playing',()=>report());audio.addEventListener('pause',()=>report());audio.addEventListener('error',()=>{if(state?.currentId)report(true);});audio.addEventListener('ended',()=>{if(state?.enabled)void api.musicAdvance(state.revision).then(apply).catch(()=>report(true));});}
  button.onclick=()=>void perform(()=>api.musicSet(state?.error?true:!state?.enabled));
  if(panel){
    $('music-play').onclick=button.onclick;$('music-next').onclick=()=>void perform(()=>api.musicCommand({action:'next'}));$('music-previous').onclick=()=>void perform(()=>api.musicCommand({action:'previous'}));
    $('music-mode').onchange=event=>{const mode=event.target.value;void perform(()=>api.musicCommand({action:'mode',mode}),'播放方式已保存');};
    $('music-volume').oninput=event=>{$('music-volume-output').value=event.target.value+'%';if(audio)audio.volume=Number(event.target.value)/100;};$('music-volume').onchange=event=>{const volume=Number(event.target.value)/100;void perform(()=>api.musicCommand({action:'volume',volume}));};
    $('music-import').onclick=()=>void perform(()=>api.musicImport(),next=>{const result=next.importResult;return result?`已导入 ${result.added} 首。${result.skipped.length?' 跳过 '+result.skipped.length+' 首：'+result.skipped.join('；'):''}`:'';});
    $('music-track-list').onclick=event=>{const control=event.target.closest('button[data-action]');if(!control)return;const id=control.closest('[data-track-id]').dataset.trackId;if(control.dataset.action==='remove')void perform(()=>api.musicCommand({action:'remove',id}),'已从本机歌单移除，不影响原文件或酷狗收藏');else void perform(()=>id===state.currentId?api.musicSet(state.error?true:!state.enabled):api.musicCommand({action:'select',id}));};
    $('music-track-list').onchange=event=>{if(event.target.dataset.action==='disable'){const id=event.target.closest('[data-track-id]').dataset.trackId,disabled=!event.target.checked;void perform(()=>api.musicCommand({action:'disable',id,disabled}),disabled?'歌曲已禁用，播放队列会跳过它':'歌曲已启用');}};
  }
  api.onMusicChanged(next=>void apply(next));void api.musicState().then(apply).catch(()=>{button.querySelector('small').textContent='音乐暂不可用';});
  window.CupboxMusic={get state(){return state?{...state}:null;},get audio(){return audio;}};
})();
