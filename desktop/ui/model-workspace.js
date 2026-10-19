"use strict";
window.CupboxModels=(()=>{
  const $=id=>document.getElementById(id);
  const labels={text:'文本',vision:'视觉',image:'绘图',audio:'语音',video:'视频'};
  const states={queued:'等待中',running:'进行中',done:'已完成',error:'失败',canceled:'已停止'};
  let models=[],legacy={},prefs,hooks,editing='',attachments=[],runId='',tasks=new Map(),busy=false;
  function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  function message(text){$('ml-status').textContent=text;}
  function activeCaps(){return [...document.querySelectorAll('[data-chat-cap]:checked')].map(c=>c.dataset.chatCap);}
  function sync(){
    const multi=prefs.multiModel===true;$('multi-model-enabled').checked=multi;$('parallel-tasks').value=prefs.parallelTasks||2;
    $('workflow-picker').disabled=!multi||busy;$('workflow-picker').value=multi?(prefs.workflow||'direct'):'direct';
    $('multi-state').textContent=multi?'协作已开启':'单模型工作';
    $('workflow-note').textContent={direct:'按勾选能力处理；多模型开启时可同时调用。',plan:'规划 2–6 个子项目，依次制作后整合。',project:'自动拆成 2–6 个独立子项目，并行制作后整合。',review:'先生成初稿，再由审阅模型检查并改进。'}[$('workflow-picker').value];
    $('reviewer-row').hidden=$('workflow-picker').value!=='review';
    for(const check of document.querySelectorAll('[data-chat-cap]'))check.disabled=busy;
    for(const select of document.querySelectorAll('[data-route]'))select.disabled=busy;
    $('add-chat-image').disabled=busy;$('reviewer-model').disabled=busy;
    $('stop-chat').hidden=!busy;
  }
  async function refresh(){
    try{models=await cupbox.modelsList();const c=await cupbox.aiConfigGet();legacy=c.config||{};renderList();renderRoutes();return models.length>0||Boolean(legacy.model);}catch(e){message(e.message);return Boolean(legacy.model);}
  }
  function renderList(){
    const list=$('model-library-list');list.replaceChildren();
    if(!models.length)list.append(node('p','还没有独立模型。可在右侧添加，原有“模型连接”继续作为默认文本模型。','control-note'));
    for(const m of models){
      const row=node('button',undefined,'ml-model'+(m.id===editing?' active':''));row.type='button';row.append(node('b',m.name),node('small',`${m.enabled?'可用':'已停用'} · ${m.capabilities.map(c=>labels[c]).join(' / ')}`),node('span',m.model));row.addEventListener('click',()=>edit(m));list.append(row);
    }
    $('model-library-count').textContent=`${models.length} 个模型`;
    const workers=$('project-workers');workers.replaceChildren();
    for(const m of models.filter(m=>m.enabled&&m.capabilities.includes('text'))){const label=node('label'),input=node('input');input.type='checkbox';input.checked=(prefs.projectWorkers||[]).includes(m.id);input.addEventListener('change',()=>{const ids=new Set(prefs.projectWorkers||[]);if(input.checked)ids.add(m.id);else ids.delete(m.id);void hooks.save({projectWorkers:[...ids]});});label.append(input,document.createTextNode(m.name));workers.append(label);}
  }
  function renderRoutes(){
    const enabled=models.filter(m=>m.enabled);
    for(const cap of Object.keys(labels)){
      const select=$(`route-${cap}`),old=select.value||prefs.modelRoutes?.[cap]||'';select.replaceChildren();
      if(cap==='text'&&legacy.model){const o=node('option',`默认 · ${legacy.model}`);o.value='default';select.append(o);}
      for(const m of enabled.filter(m=>m.capabilities.includes(cap))){const o=node('option',m.name);o.value=m.id;select.append(o);}
      if(!select.options.length){const o=node('option','尚未配置模型');o.value='';select.append(o);}
      if([...select.options].some(o=>o.value===old))select.value=old;
    }
    const reviewer=$('reviewer-model'),old=reviewer.value||prefs.reviewerId;reviewer.replaceChildren(node('option','沿用文本模型'));
    reviewer.options[0].value='';for(const m of enabled.filter(m=>m.capabilities.includes('text'))){const o=node('option',m.name);o.value=m.id;reviewer.append(o);}if(old&&enabled.some(m=>m.id===old))reviewer.value=old;
    sync();
  }
  function edit(m={}){
    editing=m.id||'';
    for(const [id,key] of Object.entries({'ml-name':'name','ml-model':'model','ml-base':'baseUrl','ml-voice':'voice'}))$(id).value=m[key]||'';
    $('ml-preset').value=m.preset||'custom';$('ml-provider').value=m.provider||'openai-compatible';$('ml-key').value='';$('ml-key').placeholder=m.hasApiKey?'已配置 · 留空保留密钥':'填写这个服务的 API Key';
    $('ml-size').value=m.imageSize||'1024x1024';$('ml-video').value=m.videoAdapter||'unsupported';$('ml-enabled').checked=m.enabled!==false;
    for(const c of document.querySelectorAll('[data-model-cap]'))c.checked=(m.capabilities||['text']).includes(c.dataset.modelCap);
    $('ml-editor-title').textContent=editing?'编辑模型':'添加模型';$('ml-delete').hidden=!editing;$('ml-delete').dataset.confirm='';$('ml-delete').textContent='删除模型';message('');renderList();
  }
  async function save(){
    const b=$('ml-save');b.disabled=true;try{
      const draft={...(editing?{id:editing}:{}),name:$('ml-name').value,model:$('ml-model').value,baseUrl:$('ml-base').value,apiKey:$('ml-key').value,preset:$('ml-preset').value,provider:$('ml-provider').value,voice:$('ml-voice').value,imageSize:$('ml-size').value,videoAdapter:$('ml-video').value,enabled:$('ml-enabled').checked,capabilities:[...document.querySelectorAll('[data-model-cap]:checked')].map(c=>c.dataset.modelCap)};
      const r=await cupbox.modelSave(draft);if(!r.ok)throw Error(r.error);models=r.models;editing=editing||models.at(-1).id;edit(models.find(m=>m.id===editing));renderRoutes();message('已保存到本机，可在对话下方选择调用。');await hooks.refresh();
    }catch(e){message(e.message);}finally{b.disabled=false;}
  }
  function payload(retry){
    const caps=retry?[retry.cap]:activeCaps();
    if(!caps.length)throw Error('请至少勾选一项能力');
    if(!prefs.multiModel&&caps.length>1)throw Error('同时调用多项能力，请先在设置开启“多模型工作”');
    const routes=Object.fromEntries(caps.map(c=>[c,retry?.modelId||$(`route-${c}`).value]));
    for(const c of caps)if(!routes[c])throw Error(`请在模型库添加${labels[c]}模型`);
    if(caps.includes('vision')&&!attachments.length)throw Error('请先添加参考图片，再使用视觉分析');
    if(attachments.length&&!caps.some(c=>['vision','video'].includes(c)))throw Error('已添加参考图，请勾选视觉或视频能力');
    const workflow=retry?'direct':prefs.multiModel?$('workflow-picker').value:'direct';
    if(workflow!=='direct'&&!caps.includes('text'))throw Error('规划和审阅工作流需要勾选文本能力');
    runId=crypto.randomUUID();return{runId,capabilities:caps,routes,workflow,reviewerId:$('reviewer-model').value,attachments:attachments.map(a=>a.id)};
  }
  function drawMedia(parent,media){
    for(const m of media||[]){if(!/^file:\/\//.test(m.url))continue;
      const wrap=node('div',undefined,'generated-media');
      const el=node(m.kind==='image'?'img':m.kind==='audio'?'audio':'video');el.src=m.url;if(m.kind==='image'){el.alt='AI 生成图片';el.loading='lazy';}else{el.controls=true;el.preload='metadata';}wrap.append(el);
      const link=node('a','保存位置 · '+m.name);link.href=m.url;link.target='_blank';wrap.append(link);parent.append(wrap);
    }
  }
  function taskCard(t,live=false){
    const card=node('article',undefined,'workflow-card');card.dataset.state=t.status;card.dataset.taskId=t.id;
    if(!t.cap)card.classList.add('workflow-coordinator');
    const head=node('div',undefined,'workflow-card-head');head.append(node('b',t.title),node('span',states[t.status]||t.status,'task-state'));card.append(head,node('small',t.model||(t.cap?labels[t.cap]+'模型':'工作流协调')));
    const body=node('div',undefined,'workflow-card-body');body.append(node('p',t.text||t.error||t.note||(t.status==='queued'?'等待可用的执行位置…':'正在向模型请求结果…')));drawMedia(body,t.media);card.append(body);
    if(t.status==='error'&&t.cap){const retry=node('button','重试这个子项目','btn-ghost2');retry.disabled=busy;retry.addEventListener('click',()=>hooks.retry(t));card.append(retry);}
    if(t.text){const copy=node('button','复制结果','ghost-btn');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(t.text);hooks.toast('已复制');}catch{hooks.toast('复制失败，请选中文字复制');}});card.append(copy);}
    return card;
  }
  function renderTasks(parent,list){
    if(!list?.length)return;const details=node('details',undefined,'saved-workflow');details.append(node('summary',`子项目交付 · ${list.filter(t=>t.status==='done').length}/${list.length} 完成`));const grid=node('div',undefined,'workflow-grid');for(const t of list)grid.append(taskCard(t));details.append(grid);parent.append(details);
  }
  function progress({runId:id,task}){if(id!==runId)return;tasks.set(task.id,task);$('workflow-board').hidden=false;const grid=$('workflow-live-grid');const old=[...grid.children].find(c=>c.dataset.taskId===task.id);const card=taskCard(task,true);if(old)old.replaceWith(card);else grid.append(card);$('workflow-count').textContent=`${[...tasks.values()].filter(t=>t.status==='done').length} / ${tasks.size} 完成`;}
  function setBusy(value){busy=value;if(value){tasks.clear();$('workflow-live-grid').replaceChildren();$('workflow-live-grid').hidden=false;$('workflow-collapse').textContent='收起';$('workflow-board').hidden=true;document.querySelector('.composer-capabilities').open=false;}else{for(const b of document.querySelectorAll('.workflow-card button'))b.disabled=false;}sync();}
  function clearImages(){attachments=[];renderAttachments();}
  function renderAttachments(){const row=$('chat-attachments');row.replaceChildren();for(const a of attachments){const b=node('button',a.name+' ×','attachment-chip');b.title='移除参考图片';b.disabled=busy;b.addEventListener('click',()=>{attachments=attachments.filter(x=>x.id!==a.id);renderAttachments();});row.append(b);}}
  async function init(options){
    prefs={...options.prefs};hooks={...options,save:async patch=>{Object.assign(prefs,patch);await options.save(patch);}};
    $('multi-model-enabled').addEventListener('change',async()=>{await hooks.save({multiModel:$('multi-model-enabled').checked});if(!prefs.multiModel){const checks=[...document.querySelectorAll('[data-chat-cap]:checked')];checks.slice(1).forEach(c=>c.checked=false);}sync();});
    $('parallel-tasks').addEventListener('change',()=>void hooks.save({parallelTasks:Number($('parallel-tasks').value)}));
    $('workflow-picker').addEventListener('change',()=>{void hooks.save({workflow:$('workflow-picker').value});sync();});
    for(const c of document.querySelectorAll('[data-chat-cap]'))c.addEventListener('change',()=>{if(c.checked&&!prefs.multiModel)document.querySelectorAll('[data-chat-cap]').forEach(o=>{if(o!==c)o.checked=false;});});
    for(const c of document.querySelectorAll('[data-route]'))c.addEventListener('change',()=>void hooks.save({modelRoutes:Object.fromEntries([...document.querySelectorAll('[data-route]')].map(s=>[s.dataset.route,s.value]))}));
    $('reviewer-model').addEventListener('change',()=>void hooks.save({reviewerId:$('reviewer-model').value}));
    for(const [id,p] of Object.entries(CupboxProviders.presets)){const o=node('option',p.name);o.value=id;$('ml-preset').append(o);}
    $('ml-preset').addEventListener('change',()=>{const p=CupboxProviders.presets[$('ml-preset').value];$('ml-base').value=p.base;$('ml-model').value=p.model;$('ml-provider').value=p.provider;$('ml-key').value='';$('ml-video').value=$('ml-preset').value==='siliconflow'?'siliconflow':'unsupported';});
    $('ml-new').addEventListener('click',()=>edit());$('ml-save').addEventListener('click',save);
    $('ml-delete').addEventListener('click',async()=>{const b=$('ml-delete');if(b.dataset.confirm!=='yes'){b.dataset.confirm='yes';b.textContent='确认删除此模型';message('再次点击确认删除；历史交付会保留。点击其他模型可取消。');return;}try{models=await cupbox.modelRemove(editing);edit();renderRoutes();await hooks.refresh();}catch(e){message(e.message);}});
    $('ml-from-default').addEventListener('click',async()=>{const c=await cupbox.aiConfigGet();edit({...c.config,id:'',name:'默认模型副本'});message('已填入默认连接信息，请重新填写密钥后保存。');});
    $('add-chat-image').addEventListener('click',async()=>{try{const files=await cupbox.chatImages();attachments=[...attachments,...files].slice(-4);renderAttachments();if(files.length)hooks.toast('参考图将在发送时上传至所选模型服务');}catch(e){hooks.toast(e.message);}});
    $('stop-chat').addEventListener('click',async()=>{await cupbox.chatCancel();$('stop-chat').textContent='正在停止…';});
    $('workflow-collapse').addEventListener('click',()=>{const grid=$('workflow-live-grid');grid.hidden=!grid.hidden;$('workflow-collapse').textContent=grid.hidden?'展开':'收起';});
    $('workflow-dismiss').addEventListener('click',()=>{$('workflow-board').hidden=true;});
    $('export-chat').addEventListener('click',async()=>{try{if(await cupbox.chatExport(hooks.session()))hooks.toast('对话已导出');}catch(e){hooks.toast(e.message);}});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='m'){e.preventDefault();void cupbox.win.minimize();}});
    cupbox.onChatProgress(progress);edit();await refresh();
    const draft=localStorage.getItem('cupbox.chatDraft');if(draft&&!$('chat-text').value)$('chat-text').value=draft;
    $('chat-text').addEventListener('input',()=>localStorage.setItem('cupbox.chatDraft',$('chat-text').value));
  }
  function finished(success){setBusy(false);$('stop-chat').textContent='停止';if(success){clearImages();localStorage.removeItem('cupbox.chatDraft');}}
  function failed(error){for(const t of tasks.values())if(['running','queued'].includes(t.status))progress({runId,task:{...t,status:'error',error}});}
  return{init,refresh,payload,setBusy,finished,failed,drawMedia,renderTasks,clearImages};
})();
