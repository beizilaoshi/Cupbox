'use strict';
(() => {
 const host=document.querySelector('[data-setting="emojiEnabled"]').closest('.bot-card');
 const title=document.createElement('h2');title.textContent='图片表情';host.prepend(title);
 const section=document.createElement('div');section.className='emoji-mode-settings';
 const modes=[
  {id:'standard',name:'标准',badge:'内置',description:'沿用触发词、聊天模型和表情工具。适合日常聊天，配置简单。',flow:'触发与选择 → 发送 → 记住含义',risk:'沿用对话模型与原有权限',help:'启用图片表情，在素材库添加图片并填写含义。按需配置触发词或语义触发，然后保存设置。'},
  {id:'innovative',name:'创新',badge:'双模型',description:'先判断是否适合发图，再让视觉模型亲眼复核候选。没有合适的图就不发。',flow:'判断 → 召回粗筛 → 看图复核',risk:'额外调用 · 聊天片段与图片上传',help:'选择判断模型和支持看图的视觉复核模型，设置参考聊天条数。图片需启用并填写含义；保存时会检查相关授权。'},
  {id:'experimental',name:'实验性创新',badge:'实验',description:'聊天模型只写回复。独立简报与编号拼图挑图，配合硬门槛和必要的位置复测。',flow:'简报 → 双路召回 → 拼图挑选 → 复测',risk:'多次调用 · 图片上传 · 可能等待更久',help:'配置简报与视觉模型，选择拼图数量和发送等待方式。可设置群内禁用；详细本机记录默认关闭，开启后包含聊天片段和拼图。'}
 ];
 section.innerHTML=`<select data-setting="emojiMode" id="emoji-mode" aria-label="表情模式" hidden><option value="standard">标准</option><option value="innovative">创新</option><option value="experimental">实验性创新</option></select>
 <div class="emoji-mode-heading"><h3 id="emoji-mode-label">选择表情模式</h3><span id="emoji-mode-current" role="status"></span></div>
 <p class="small-note">选择适合当前聊天的发图方式。切换后配置下方选项，保存设置才会生效。</p>
 <div class="emoji-mode-grid" role="radiogroup" aria-labelledby="emoji-mode-label">${modes.map(m=>`<article class="emoji-mode-card" data-emoji-card="${m.id}"><button type="button" role="radio" aria-checked="false" tabindex="-1" class="emoji-mode-select" data-emoji-mode="${m.id}" aria-labelledby="emoji-name-${m.id}" aria-describedby="emoji-description-${m.id} emoji-risk-${m.id}"><span class="emoji-mode-head"><strong id="emoji-name-${m.id}">${m.name}</strong><span class="emoji-mode-badge">${m.badge}</span></span><span class="emoji-mode-description" id="emoji-description-${m.id}">${m.description}</span><span class="emoji-mode-flow">${m.flow}</span><span class="emoji-mode-risk ${m.id==='standard'?'quiet':''}" id="emoji-risk-${m.id}">${m.id==='standard'?'':'△ '}${m.risk}</span><span class="emoji-mode-check" aria-hidden="true">✓ 已选择</span></button><div class="emoji-mode-footer"><button type="button" data-emoji-help="${m.id}" data-help-kind="description" aria-expanded="false" aria-controls="emoji-help-${m.id}">模式说明</button><button type="button" data-emoji-help="${m.id}" data-help-kind="usage" aria-expanded="false" aria-controls="emoji-help-${m.id}">如何使用</button></div><div class="emoji-mode-help" id="emoji-help-${m.id}" hidden></div></article>`).join('')}</div>
 <p id="emoji-mode-summary" class="small-note"></p>
 <div id="emoji-innovation-options" class="emoji-innovation-options" hidden>
 <h3 id="emoji-options-title">创新模式设置</h3>
 <div class="warning-note"><b>额外模型调用与图片上传</b><p id="emoji-model-disclosure">近期聊天会交给判断模型，最多3张已启用的本机表情及相同聊天片段会交给视觉模型，可能增加费用和等待时间。无法判断就不发，不会退回标准模式。</p></div>
 <div class="settings-grid"><label class="field">判断模型<select data-setting="emojiJudgeModelId" id="emoji-judge-model"><option value="">沿用对话模型</option></select><small>只回答发不发、发什么类型。</small></label><label class="field">视觉复核模型<select data-setting="emojiVisionModelId" id="emoji-vision-model"><option value="">请选择可看图的模型</option></select><small>真正查看候选图片；此授权不自动开启群聊来图识别。</small></label></div>
 <label class="field short-field" id="emoji-innovation-context">参考最近几条聊天<input type="number" data-setting="emojiRecentCount" min="1" max="20" step="1"><small>默认8条，仅使用当前会话按原记忆设置已有的记录；不会额外旁听。</small></label>
 <ol class="emoji-pipeline"><li><b>判断</b><span>结合近期聊天，先决定是否适合发图。</span></li><li><b>召回与粗筛</b><span>召回最多20张，去重并避开最近两张，筛到最多3张。</span></li><li><b>看图复核</b><span>看不出哪张更贴切，或没有安全明确的选择，就不发。</span></li><li><b>确认后记住</b><span>QQ确认发送成功后，将真实表情含义写回本会话；是否落盘遵循现有记忆开关。</span></li></ol>
 <details class="inline-help emoji-score-help"><summary>查看明确评分与不发送条件</summary><p>粗筛满分100：类型匹配40、聊天词语覆盖35、命中触发词15、近期未用10。类型词按内置近义词扩展；覆盖率为匹配词数÷查询词数。低于35分不进入候选，同内容去重，最近两张不再选。</p><p>视觉评分：语境0～4、情绪0～3、安全性0～2；程序再加近期未用0～1，总分10。至少8分，且语境至少3、情绪至少2、安全性必须为2，领先第二名至少1分；模型最终选择还必须与最高分一致。无合适图、并列、图片损坏、结果不合格式或调用失败，都不发图。</p><p>每张图仍需启用并填写含义。触发词模式仍需命中本条消息；想按聊天含义召回，请在图片卡片中选择语义模式。免费通道不支持本机图片视觉复核。各阶段结果与评分拆分可在运行日志查看，不记录聊天正文与图片数据。</p></details></div>`;
 const toolbar=host.querySelector('.button-row');toolbar.classList.add('emoji-mode-toolbar');toolbar.prepend(title);toolbar.querySelector('.switch-row b').textContent='启用';toolbar.after(section);
 window.BotExperimentalEmoji?.mount?.(section.querySelector('#emoji-innovation-options'));
 const select=section.querySelector('#emoji-mode'),buttons=[...section.querySelectorAll('[data-emoji-mode]')];
 const choose=button=>{if(select.value===button.dataset.emojiMode)return;select.value=button.dataset.emojiMode;select.dispatchEvent(new Event('input',{bubbles:true}));};
 buttons.forEach((button,index)=>{
  button.addEventListener('click',()=>choose(button));
  button.addEventListener('keydown',event=>{let next;if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else if(['ArrowRight','ArrowDown'].includes(event.key))next=(index+1)%buttons.length;else if(['ArrowLeft','ArrowUp'].includes(event.key))next=(index+buttons.length-1)%buttons.length;else return;event.preventDefault();buttons[next].focus();choose(buttons[next]);});
 });
 section.querySelectorAll('[data-emoji-help]').forEach(button=>button.addEventListener('click',()=>{
  const mode=modes.find(m=>m.id===button.dataset.emojiHelp),panel=section.querySelector('#emoji-help-'+mode.id),closing=button.getAttribute('aria-expanded')==='true';
  button.closest('.emoji-mode-footer').querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded',String(b===button&&!closing)));
  panel.hidden=closing;panel.textContent=button.dataset.helpKind==='usage'?mode.help:mode.description+' '+mode.flow+'。'+mode.risk+'。';
 }));
 window.CupboxEmojiModes={sync(c,saved){
  buttons.forEach(button=>{const active=button.dataset.emojiMode===c.emojiMode;button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1;button.closest('.emoji-mode-card').classList.toggle('selected',active);});
  const pending=c.emojiMode!==saved?.emojiMode,current=section.querySelector('#emoji-mode-current'),name=modes.find(m=>m.id===c.emojiMode)?.name;current.textContent=(pending?'待保存：':'当前：')+name;current.classList.toggle('pending',pending);section.querySelector('#emoji-options-title').textContent=name+'设置';
 }};
 const note=host.querySelector('.info-note');if(note)note.textContent='每次最多一张，遵守素材启用状态、含义、触发方式和会话冷却。标准模式沿用原逻辑；创新模式不绕过视觉复核。';
})();
