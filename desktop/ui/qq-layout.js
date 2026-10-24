'use strict';
(() => {
  const $=id=>document.getElementById(id),panel=n=>document.querySelector(`[data-panel=${n}]`);
  const overview=panel('overview'),persona=panel('persona'),rules=panel('rules');
  document.querySelector('.bot-emblem b').textContent='QQ 机器人';document.querySelector('.bot-emblem small').textContent='Cupbox · 聊天空间';
  for(const [name,title]of Object.entries({overview:'连接',rules:'消息与节奏',persona:'人格与能力',emoji:'表情收藏',memory:'共享记忆'}))document.querySelector(`[data-tab=${name}]`).lastChild.textContent=title;
  overview.querySelector('h1').textContent='聊天，从这里开始';overview.querySelector('.page-heading p').textContent='连上 QQ，调好语气，让每次回应都更自然。';
  rules.querySelector('h1').textContent='消息与节奏';rules.querySelector('.page-heading p').textContent='回应谁、记住什么、怎么发送，在这里决定。';
  persona.querySelector('h1').textContent='它的说话方式';persona.querySelector('.page-heading p').textContent='先选模型，再给它一点自己的性格。';
  const steps=document.querySelector('.setup-steps');const help=document.createElement('details');help.className='setup-help';help.innerHTML='<summary>第一次使用？查看连接步骤</summary>';help.append(steps);overview.append(help);
  const disclosure=document.createElement('details');disclosure.className='data-disclosure';disclosure.innerHTML='<summary>查看已保存的回复范围与数据使用</summary>';disclosure.append($('live-risks'));overview.append(disclosure);
  const settings=document.querySelector('.overview-settings'),enabled=settings.querySelector('[data-setting=enabled]').closest('label');enabled.classList.add('enable-control');document.querySelector('.run-summary').append(enabled);
  settings.querySelector('h2').textContent='工作方式与能力';persona.insertBefore(settings,persona.querySelector('.settings-grid'));
  const login=document.querySelector('.login-card');login.querySelector('h2').textContent='QQ 连接';$('qr-placeholder').querySelector('b').textContent='还没有连接 QQ';$('qr-placeholder').querySelector('p').textContent='点击启动，自动准备扫码登录';
  const loginNote=login.querySelector('.small-note'),loginHelp=document.createElement('details');loginHelp.className='inline-help';loginHelp.innerHTML='<summary>账号与连接须知</summary>';loginHelp.append(loginNote);login.append(loginHelp);
  const preview=document.createElement('article');preview.className='chat-preview';preview.innerHTML=`<header><div><span class="section-kicker">CONVERSATION</span><h2>先感受一下聊天节奏</h2></div><span class="local-badge">本地预览</span></header><div class="preview-thread" id="preview-thread" aria-live="polite"><div class="preview-message user">今天事情好多，完全不想动。</div><div class="preview-message bot">那就先缓一缓。挑一件最容易开始的小事，做一点也算今天的进展。</div></div><div class="preview-controls"><label for="preview-text">换一段话，试试分段</label><textarea id="preview-text" rows="2" maxlength="1800">先不用急着把所有事情都做完。挑一件最容易开始的小事，做一点也算进展。累了就歇一会儿，今天也不一定要那么高效。</textarea><div><span id="preview-caption">使用当前草稿 · 不调用模型，不发送 QQ</span><button type="button" id="play-preview" class="btn-run">播放节奏 <span aria-hidden="true">↗</span></button></div></div>`;document.querySelector('.overview-grid').append(preview);
  const mode=document.querySelector('[data-setting=mode]').closest('label');mode.insertAdjacentHTML('afterend',`<label class="field">回复风格<select data-setting="replyStyle"><option value="casual">随口聊聊 · 简短、口语化</option><option value="balanced">认真聊聊 · 随问题展开</option><option value="detailed">详细说明 · 必要时给步骤</option></select><small>影响真实模型提示，不会把闲聊强制写成一份报告。</small></label>`);
  const context=document.querySelector('[data-setting=listenContext]').closest('label');context.insertAdjacentHTML('beforebegin','<label class="switch-row"><span><b>记住刚才聊过的内容</b><small>只记住已触发的消息与回复，不旁听其他聊天。停止后清除。</small></span><input type="checkbox" data-setting="retainDialogue"></label>');context.querySelector('b').textContent='也参考未触发的群聊';context.querySelector('small').textContent='额外收集范围内未 @ 机器人的消息；使用前请让群成员知情。';
  const stream=document.querySelector('[data-setting=segmentedStreaming]').closest('article');stream.classList.add('delivery-card');stream.querySelector('h2').textContent='像聊天一样发消息';stream.querySelector('.switch-row b').textContent='分段回复';stream.querySelector('.switch-row small').textContent='先检查完整回复，再按所选方式分段发送；短话、代码和列表保持完整。安全检查前不提前发送片段。';$('stream-options').insertAdjacentHTML('afterbegin','<label class="field">分段方式<select data-setting="segmentMode"><option value="natural">自然语意 · 推荐</option><option value="lines">按行发送 · 源项目方式</option><option value="fixed">按目标字数 · 兼容旧方式</option></select></label>');
  const target=document.querySelector('[data-setting=segmentChars]').closest('label');target.firstChild.textContent='长句参考字数';
  const work=document.querySelector('[data-setting=allowWorkTools]').closest('article'),workDetails=document.createElement('details');workDetails.className='advanced-settings';workDetails.innerHTML='<summary>高级：主人权限与本地文件工具</summary>';work.parentNode.insertBefore(workDetails,work);workDetails.append(work);
  const test=document.querySelector('.rule-test'),testDetails=document.createElement('details');testDetails.className='inline-help rule-test-details';testDetails.innerHTML='<summary>测试一条消息会不会触发</summary>';test.parentNode.insertBefore(testDetails,test);testDetails.append(test);
  const rates=document.createElement('details');rates.className='inline-help';rates.innerHTML='<summary>发送频率与上下文管理</summary>';for(const name of ['cooldown','maxPerMinute'])rates.append(document.querySelector(`[data-setting=${name}]`).closest('label'));rates.append($('clear-context'));context.closest('article').append(rates);
  let previewGeneration=0;
  async function play(){const generation=++previewGeneration,button=$('play-preview'),root=$('preview-thread');button.disabled=true;root.replaceChildren();const typing=document.createElement('div');typing.className='typing-dots';typing.setAttribute('aria-label','节奏预览中');typing.innerHTML='<i></i><i></i><i></i>';root.append(typing);
    try{const settings={};for(const f of document.querySelectorAll('[data-setting]'))settings[f.dataset.setting]=f.type==='checkbox'?f.checked:f.hasAttribute('data-json')?JSON.parse(f.value||'[]'):f.hasAttribute('data-array')?f.value.split(/[\s,，;；]+/).filter(Boolean):['number','range'].includes(f.type)?Number(f.value):f.value;const parts=await window.qqBot.previewSegments({text:$('preview-text').value,settings});
      for(let i=0;i<parts.length;i++){if(generation!==previewGeneration)return;if(i&&!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(r=>setTimeout(r,settings.segmentDelay));if(generation!==previewGeneration)return;const bubble=document.createElement('div');bubble.className='preview-message bot';bubble.textContent=parts[i];root.insertBefore(bubble,typing);root.scrollTop=root.scrollHeight;}$('preview-caption').textContent=`${parts.length} 条消息 · 当前草稿，仅本地模拟，未调用模型或发送 QQ`;
    }catch(e){$('preview-caption').textContent=e.message||'预览失败，请检查设置';}finally{if(generation===previewGeneration){typing.remove();button.disabled=false;}}}
  $('play-preview').onclick=play;
  window.BotLayout={cancelPreview(){previewGeneration++;document.querySelector('.typing-dots')?.remove();$('play-preview').disabled=false;}};
})();

// One information architecture for the complete, already-created QQ form.
window.BotLayout.organize = function () {
  document.body.classList.add('qq-settings-layout');
  const $=id=>document.getElementById(id),panel=name=>document.querySelector(`[data-panel="${name}"]`);
  const form=$('bot-form'),nav=document.querySelector('.bot-side nav');
  form.noValidate=true;
  const field=name=>document.querySelector(`[data-setting="${name}"]`);
  const label=name=>field(name)?.closest('label');
  const card=name=>field(name)?.closest('.bot-card');
  function move(node,to){if(node&&to)to.append(node);return node;}
  function page(id,title,description){const section=document.createElement('section');section.dataset.panel=id;section.hidden=true;const head=document.createElement('div');head.className='page-heading';const h=document.createElement('h1'),p=document.createElement('p');h.textContent=title;p.textContent=description;head.append(h,p);section.append(head);form.insertBefore(section,form.querySelector('footer'));const b=document.createElement('button');b.type='button';b.dataset.tab=id;nav.append(b);return section;}
  function article(to,title){const node=document.createElement('article'),h=document.createElement('h2');node.className='bot-card';h.textContent=title;node.append(h);to.append(node);return node;}
  function heading(id,title,description){const node=panel(id);node.querySelector('h1').textContent=title;node.querySelector('.page-heading p').textContent=description;}
  const chat=page('chat','聊天节奏','先选聊天节奏，再按需要调整接话、分段与主动参与。');
  const models=page('models','模型与能力','选择对话和视觉模型，管理联网、思考深度与免费模型工作流。');
  heading('overview','连接与运行','扫码登录和自动回复是两个步骤。先核对回复范围，再确认开启。');
  heading('rules','回复对象','哪些群、哪些私聊可以触发，以及需要 @ 还是关键词，都在这里。');
  heading('persona','角色设定','选择人格、名字与相处约定。模型连接和发送节奏有各自的入口。');
  heading('memory','记忆管理','自动记忆、QQ公开资料和会话词库集中管理，明确区分保存范围。');
  heading('emoji','表情与语音','原生表情、图片图库与语音素材。导入、写明含义，再允许使用。');
  heading('social','工具与权限','自主工具额度、本地文件批准与安全边界。普通聊天通常无需修改。');
  heading('relationship','关系成长','好感、心情、作息、日记与后续关心，共用同一份相处存档。');
  heading('usage','用量与费用','查看真实用量；费用根据你填写的单价估算。');

  // Move existing nodes, never clone controls or introduce a second settings state.
  const working=document.querySelector('.overview-settings');move(working,models);working.querySelector('h2').textContent='工作方式与可选能力';
  working.querySelector('.info-note').textContent='聊天模式用于日常对话与已启用的会话工具；工作模式可由主人申请本地文件操作，以及 Word/PPT 修改与模板、Excel 清洗统计、PDF 整理和格式交换；每次仍需本机批准。';
  const modelCard=card('modelId');move(modelCard,models);modelCard.querySelector('h2').textContent='模型连接与生成参数';
  const roleCard=article(panel('persona'),'人格与补充设定');for(const key of ['persona','customPrompt'])move(label(key),roleCard);
  const rolePolicy=modelCard.querySelector('p:last-child');if(rolePolicy)move(rolePolicy,roleCard);
  const work=card('allowWorkTools');move(work.closest('details')||work,panel('social'));
  const reload=$('reload-models');move(reload,modelCard);
  const privateCard=card('privatePolicy');move(privateCard,panel('rules'));
  move(label('privateEnabled'),privateCard);
  const delivery=document.querySelector('.delivery-card');move(delivery,chat);
  const formats=article(chat,'回复形式');for(const key of ['replyStyle','plainTextReplies','quoteReply','replyMention','privateMention'])move(label(key),formats);
  const rhythm=card('followUpWindow');chat.insertBefore(rhythm,chat.querySelector('.bot-card'));rhythm.querySelector('h2').textContent='先选一种聊天节奏';
  move(label('naturalConversation'),rhythm);move(label('typingDelay'),delivery);
  const budgets=field('maxToolTurns')?.closest('details');move(budgets,panel('social'));
  const participation=card('mergeMessages');move(participation,chat);participation.querySelector('h2').textContent='连续接话与主动参与';
  const context=card('listenContext');move(context,chat);context.querySelector('h2').textContent='聊天上下文与发送频率';
  move(document.querySelector('.rule-test-details'),panel('rules'));
  move(document.querySelector('.chat-preview'),chat);
  const original=article(chat,'更多聊天推荐');const oldHelp=document.createElement('details'),oldTitle=document.createElement('summary');oldTitle.textContent='简洁陪伴 · 同时整理偏好档案';oldHelp.append(oldTitle,$('apply-companion'));original.append(oldHelp);
  move($('companion-draft-status'),participation);
  const privateNotes=article(panel('persona'),'每个群的聊天背景');
  const notes=card('initialNotes');if(notes){privateNotes.remove();move(notes,panel('persona'));}
  const permission=card('agentChat');permission.querySelector('h2').textContent='自主聊天工具';move(permission,panel('social'));
  const interactions=article(chat,'日常互动');move(label('pokeEnabled'),interactions);move(card('reminderEnabled'),chat);
  const native=article(panel('emoji'),'QQ 原生表情');move(label('faceEnabled'),native);panel('emoji').insertBefore(native,panel('emoji').querySelector('.bot-card'));
  const imageModes=card('emojiEnabled');panel('emoji').insertBefore(imageModes,panel('emoji').querySelector('.bot-card'));
  move(card('voiceEnabled'),panel('emoji'));
  const lexicon=card('slangEnabled');move(lexicon,panel('memory'));lexicon.querySelector('button').textContent='刷新会话词库';
  move(label('memoryDecay'),panel('memory').querySelector('.bot-card'));
  const web=article(models,'联网与网页获取');move(label('searchEnabled'),web);move(label('webFetchEnabled'),web);
  const vision=article(models,'图片识别');move(label('visionEnabled'),vision);move(label('visionModelId'),vision);
  move($('bot-security-status'),panel('social'));
  models.querySelector('.page-heading').after(modelCard);
  panel('social').querySelector('.page-heading').after(permission);permission.after(budgets);
  move(document.querySelector('.activity-card'),document.querySelector('.overview-grid'));
  const memoryNote=document.querySelector('.memory-note');if(memoryNote)memoryNote.remove();

  window.BotConversationUI?.mount({chat,persona:panel('persona')});
  const routes={overview:['连接与运行','基础设置'],rules:['回复对象','基础设置'],chat:['聊天节奏','基础设置'],persona:['角色设定','基础设置'],models:['模型与能力','基础设置'],memory:['记忆管理','陪伴与素材'],relationship:['关系成长','陪伴与素材'],emoji:['表情与语音','陪伴与素材'],social:['工具与权限','高级与维护'],plugins:['插件中心','高级与维护'],console:['运行日志','高级与维护'],usage:['用量与费用','高级与维护']};
  // Preserve the legacy resources route as an internal redirect for existing actions.
  const alias=document.querySelector('[data-tab=resources]');alias.hidden=true;alias.setAttribute('aria-hidden','true');alias.tabIndex=-1;
  const existing=[...nav.querySelectorAll('[data-tab]')];nav.replaceChildren();
  for(const group of ['基础设置','陪伴与素材','高级与维护']){
    const holder=document.createElement(group==='高级与维护'?'details':'div');holder.className='qq-nav-group';holder.dataset.group=group;
    const title=document.createElement(group==='高级与维护'?'summary':'p');title.textContent=group;holder.append(title);
    for(const [id,[text,category]]of Object.entries(routes)){if(category!==group)continue;const button=existing.find(b=>b.dataset.tab===id);if(!button)continue;button.replaceChildren();const icon=document.createElement('span');icon.dataset.icon=({overview:'workflow',rules:'settings',chat:'text',persona:'sparkle',models:'settings',memory:'text',relationship:'sparkle',emoji:'image',social:'settings',plugins:'settings',console:'workflow',usage:'text'})[id];button.append(icon,document.createTextNode(text));holder.append(button);}
    nav.append(holder);
  }
  nav.append(alias);
  document.querySelector('.bot-emblem small').textContent='设置与运行管理';
  const searchBox=document.createElement('div');searchBox.className='qq-settings-search';searchBox.innerHTML='<label for="qq-settings-search">查找功能 <kbd>Ctrl K</kbd></label><input id="qq-settings-search" type="search" autocomplete="off" placeholder="例如：好感、白名单、语音" role="combobox" aria-expanded="false" aria-controls="qq-settings-results" aria-autocomplete="list">';nav.before(searchBox);
  const results=document.createElement('div');results.id='qq-settings-results';results.className='qq-settings-results';results.hidden=true;results.setAttribute('role','listbox');results.setAttribute('aria-label','功能搜索结果');document.querySelector('.bot-main').prepend(results);
  const breadcrumb=document.createElement('div');breadcrumb.className='qq-settings-location';breadcrumb.id='qq-settings-location';breadcrumb.textContent='基础设置 / 连接与运行';document.querySelector('.bot-main').prepend(breadcrumb);
  const footer=form.querySelector('footer'),reset=document.createElement('button');reset.type='button';reset.id='qq-settings-discard';reset.className='btn-ghost2';reset.textContent='放弃草稿';reset.hidden=true;footer.insertBefore(reset,$('save-settings'));$('save-settings').textContent='保存所有设置';
  const saveHelp=document.createElement('p');saveHelp.className='small-note qq-save-help';saveHelp.textContent='底部统一保存机器人设置；素材、记忆内容和插件在各自卡片中单独保存。切页和搜索会保留草稿。';footer.before(saveHelp);
  for(const id of ['emoji','memory','plugins','relationship']){const hint=document.createElement('p');hint.className='settings-local-note';hint.textContent=({emoji:'总开关随底部保存；图片和语音的导入、含义、启用状态在素材卡片中单独保存。',memory:'记忆开关随底部保存；公开资料、笔记、置顶和删除通过对应按钮单独保存。',plugins:'插件配置单独保存，不随底部机器人设置一起提交。',relationship:'成长开关随底部保存；结束跟进与重置记录会单独执行。'})[id];panel(id).querySelector('.page-heading').append(hint);}

  // Stable card anchors provide local navigation and search destinations.
  let serial=0;
  for(const id of Object.keys(routes)){const section=panel(id);if(!section)continue;const outline=document.createElement('div');outline.className='qq-page-outline';outline.setAttribute('aria-label','本页分区');for(const node of [...section.querySelectorAll('article.bot-card,article.chat-preview,details.advanced-settings')].filter(n=>!n.parentElement.closest('article,details.advanced-settings'))){const title=node.querySelector('h2')?.textContent||node.querySelector('summary')?.textContent;if(!title)continue;node.id||=(id+'-section-'+ ++serial);const b=document.createElement('button');b.type='button';b.textContent=title;b.onclick=()=>reveal(node);outline.append(b);}if(outline.children.length>1)section.querySelector('.page-heading').after(outline);}
  const quick=article(panel('overview'),'常用设置');quick.classList.add('qq-overview-shortcuts');for(const [title,key,description]of [['回复谁','groupPolicy','群聊白黑名单、私聊范围与触发条件'],['怎么聊天','followUpWindow','接话窗口、分段和主动参与'],['选择模型','modelId','对话、视觉模型与思考深度'],['调整角色','persona','人格、名字与恋爱玩法'],['好感与日记','companionEnabled','关系成长、心情和待跟进事件'],['添加表情','emojiEnabled','图片图库、语音和原生表情']]){const b=document.createElement('button');b.type='button';const strong=document.createElement('strong'),p=document.createElement('span');strong.textContent=title;p.textContent=description;b.append(strong,p);b.onclick=()=>jump(key);quick.append(b);}panel('overview').querySelector('.overview-grid').after(quick);

  const aliases={groupPolicy:'白名单 黑名单 群聊 群号 收不到 不回复',privatePolicy:'私聊 好友 私信',segmentedStreaming:'分段 气泡 流式 输出',followUpWindow:'接话 连续对话 不用艾特 免@',proactiveEnabled:'主动 插话 搭话 潜水',persona:'人设 人格 角色 蓝色大肥鱼 鲸鱼娘',companionEnabled:'好感 亲密 信任 熟悉度 关系 成长',companionDiary:'日记 相处 记录',openLoopsEnabled:'面试 后续关心 未完成',companionRoutine:'作息 睡觉 起床 日程',memoryScope:'记忆 全局 单群 隔离',globalMemory:'公开资料 共享 隐私',emojiEnabled:'表情包 图片 导入 图库',emojiMode:'表情 标准 创新 实验 拼图 编号 简报 判断 模型 视觉 召回 粗筛',emojiExperimentalWait:'实验 表情 等待 并行 文字 图片',emojiExperimentalTrace:'实验 表情 日志 拼图 记录 费用',emojiExperimentalBlockedGroups:'实验 表情 群号 禁用 关闭',emojiJudgeModelId:'判断 模型 表情 创新',emojiVisionModelId:'视觉 复核 看图 表情 创新',voiceEnabled:'语音 音频 声音 录音',modelId:'模型 免费 deepseek GPT 硅基流动 服务',reasoningEffort:'思考 推理 深度',freeWorkflow:'免费 工作流 工具',allowWorkTools:'批准 权限 本地 文件 主人 危险',reminderEnabled:'提醒 闹钟 喝水 定时',slangEnabled:'词库 黑话 解释',faceEnabled:'QQ表情 原生表情',searchEnabled:'联网 搜索 查资料',visionEnabled:'识图 视觉 图片识别'};
  const index=[];
  for(const f of document.querySelectorAll('[data-setting]')){const parent=f.closest('label'),owner=f.closest('[data-panel]');if(!parent||!routes[owner?.dataset.panel])continue;const title=(parent.querySelector('b')?.textContent||[...parent.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim()||f.dataset.setting).replace(/\s+/g,' ').slice(0,90);index.push({title,node:parent,field:f,page:owner.dataset.panel,keywords:(title+' '+(aliases[f.dataset.setting]||'')+' '+(parent.querySelector('small')?.textContent||'')).toLowerCase()});}
  for(const section of form.querySelectorAll('[data-panel]'))if(routes[section.dataset.panel])for(const card of section.querySelectorAll('.bot-card')){const h=card.querySelector('h2');if(h)index.push({title:h.textContent,node:card,page:section.dataset.panel,keywords:(h.textContent+' '+routes[section.dataset.panel][0]).toLowerCase()});}
  for(const [id,title,keywords]of [['emoji-mode-label','选择表情模式','标准 创新 实验性创新 模式 拼图 编号 简报'],['login-qr','QQ登录二维码','扫码 登录 连接 启动'],['bridge-usage','模型用量与费用','token tokens 用量 费用 账单'],['import-emoji','批量导入表情包','导入 图片 表情 图库'],['bridge-voice-import','导入语音素材','声音 录音 音频'],['memory-record','查看与编辑记忆','记忆 删除 遗忘 置顶'],['relationship-summary','查看好感与日记','好感度 亲密度 信任值 关系 日记'],['plugin-test-text','输出内容检测插件','过滤 脱敏 敏感词 拦截 输出检测'],['log-search','查看实时日志','控制台 报错 发送失败 不回复']]){const node=$(id),owner=node?.closest('[data-panel]');if(node&&routes[owner?.dataset.panel])index.push({title,node:node.closest('.bot-card')||node,page:owner.dataset.panel,keywords:(title+' '+keywords).toLowerCase()});}
  const needs=[['conversationTuning',[['naturalConversation','自然聊天']]],['agentChat',[['naturalConversation','自然聊天'],['mode','聊天模式']]],['proactiveEnabled',[['naturalConversation','自然聊天'],['listenContext','旁听上下文'],['contextCount','非零上下文条数'],['proactiveGroups','主动插话群名单'],['mode','聊天模式']]],['companionEnabled',[['retainDialogue','自动聊天记忆'],['mode','聊天模式']]],['voiceEnabled',[['agentChat','自主聊天工具']]],['faceEnabled',[['agentChat','自主聊天工具']]],['reminderEnabled',[['agentChat','自主聊天工具']]],['webFetchEnabled',[['searchEnabled','联网搜索']]],['identityName',[['whaleFreedom','自由演绎']]],['routineNotes',[['companionEnabled','相处成长']]]];
  const dependencyNodes=needs.map(([key,requirements])=>{const f=field(key);if(!f)return null;const box=document.createElement('div');box.className='qq-dependency';box.hidden=true;(f.closest('fieldset')||label(key)).after(box);return{key,f,requirements,box};}).filter(Boolean);
  function syncDependencies(){if(!config)return;const c=draft();for(const {key,f,requirements,box}of dependencyNodes){const missing=requirements.filter(([name])=>name==='mode'?c.mode!=='chat':name==='contextCount'?c.contextCount<=0:name==='proactiveGroups'?!c.proactiveGroups.length:name==='whaleFreedom'?c.persona==='whale'&&!c.whaleFreedom:!c[name]);box.replaceChildren();box.hidden=!missing.length||!(f.checked||f.matches(':disabled'));if(box.hidden)continue;box.append(document.createTextNode('需要先设置：'));for(const [name,text]of missing){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>jump(name);box.append(b);}}}
  function reveal(node){let parent=node;while(parent&&parent!==form){if(parent.tagName==='DETAILS')parent.open=true;if(['stream-options','proactive-options','romance-options','route-options'].includes(parent.id)&&parent.hidden)parent.classList.add('settings-revealed');parent=parent.parentElement;}node.classList.remove('settings-target');void node.offsetWidth;node.classList.add('settings-target');node.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});node.tabIndex=-1;node.focus({preventScroll:true});setTimeout(()=>node.classList.remove('settings-target'),2400);}
  function activate(name){document.querySelector(`[data-tab="${name}"]`)?.click();}
  function jump(key){const f=field(key),owner=f?.closest('[data-panel]');if(!owner)return;activate(owner.dataset.panel);requestAnimationFrame(()=>reveal(f.closest('label')||f));}
  let matches=[],active=-1;
  const search=$('qq-settings-search');
  function close(){results.hidden=true;search.setAttribute('aria-expanded','false');search.removeAttribute('aria-activedescendant');}
  function select(i){active=Math.max(0,Math.min(matches.length-1,i));for(const [j,b]of [...results.querySelectorAll('[role=option]')].entries())b.setAttribute('aria-selected',String(j===active));const b=results.querySelectorAll('[role=option]')[active];if(b){search.setAttribute('aria-activedescendant',b.id);b.scrollIntoView({block:'nearest'});}}
  function find(){const query=search.value.trim().toLowerCase();results.replaceChildren();if(!query){close();return;}const words=query.split(/\s+/),rank=entry=>words.reduce((n,w)=>n+(entry.title.toLowerCase().includes(w)?3:entry.keywords.includes(w)?1:0),0);matches=index.filter(e=>words.every(w=>e.keywords.includes(w))).sort((a,b)=>rank(b)-rank(a)).slice(0,14);const status=document.createElement('p');status.className='qq-search-count';status.textContent=matches.length?'找到 '+matches.length+' 个入口 · 不会修改任何开关':'没有找到。可试试“白名单”“好感”“语音”“审批”。';status.setAttribute('role','status');results.append(status);matches.forEach((entry,i)=>{const b=document.createElement('button');b.type='button';b.id='qq-search-option-'+i;b.setAttribute('role','option');const title=document.createElement('strong'),path=document.createElement('small');title.textContent=entry.title;path.textContent=routes[entry.page][1]+' / '+routes[entry.page][0];b.append(title,path);b.onclick=()=>{close();activate(entry.page);requestAnimationFrame(()=>reveal(entry.node));};results.append(b);});results.hidden=false;search.setAttribute('aria-expanded','true');active=-1;if(matches.length)select(0);}
  search.oninput=find;search.onfocus=()=>{if(search.value.trim())find();};search.onkeydown=e=>{if(e.key==='Escape'){close();e.preventDefault();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){if(results.hidden)find();if(matches.length)select(active+(e.key==='ArrowDown'?1:-1));e.preventDefault();}else if(e.key==='Enter'&&!results.hidden){e.preventDefault();results.querySelectorAll('[role=option]')[Math.max(0,active)]?.click();}};
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus();search.select();}});
  document.addEventListener('pointerdown',e=>{if(!results.contains(e.target)&&!searchBox.contains(e.target))close();});
  reset.onclick=async()=>{if(!dirty)return;if(!await BotGuidance.confirm({title:'放弃未保存的机器人设置？',intro:'恢复到上次已保存的设置。',items:[{title:'仅撤销当前设置草稿',detail:'已经单独保存的素材、记忆、插件与关系记录不会撤销；机器人仍使用上次保存的设置。'}],action:'放弃草稿'}))return;fill(config);note('已恢复上次保存的机器人设置。');};
  function syncDraft(){if(!config)return;const current=draft(),changed=fields.filter(f=>JSON.stringify(current[f.dataset.setting])!==JSON.stringify(config[f.dataset.setting]));dirty=changed.length>0;reset.hidden=!changed.length;for(const b of nav.querySelectorAll('[data-tab]')){const count=changed.filter(f=>f.closest('[data-panel]')?.dataset.panel===b.dataset.tab).length;if(count)b.dataset.drafts=count;else delete b.dataset.drafts;}$('save-hint').textContent=changed.length?'有 '+changed.length+' 项未保存 · 切页不会丢失':'设置已保存 · 自动回复'+(config.enabled?'已开启':'已关闭');$('save-hint').classList.toggle('draft',Boolean(changed.length));syncDependencies();}
  function onNavigate(name){const route=routes[name];if(!route)return;breadcrumb.textContent=route[1]+' / '+route[0];const button=document.querySelector(`[data-tab="${name}"]`),group=button?.closest('details');if(group)group.open=true;for(const node of form.querySelectorAll('.settings-revealed'))if(node.closest('[data-panel]')?.dataset.panel!==name)node.classList.remove('settings-revealed');if(['emoji','memory'].includes(name))void window.BotBridge?.refresh().catch(e=>note(e.message,true));syncDraft();}
  function validateForm(){const invalid=fields.find(f=>f.willValidate&&!f.checkValidity());if(invalid){jump(invalid.dataset.setting);invalid.setAttribute('aria-invalid','true');let message=invalid.parentElement.querySelector('.qq-validation');if(!message){message=document.createElement('small');message.className='qq-validation';message.setAttribute('role','alert');invalid.after(message);}message.textContent=invalid.validity.rangeOverflow?'不能大于 '+invalid.max:invalid.validity.rangeUnderflow?'不能小于 '+invalid.min:invalid.validity.stepMismatch?'请按 '+invalid.step+' 的步长填写':'请填写有效的值';note('有一项设置需要修正，已为你定位。',true);return false;}const c=draft();if(c.proactiveEnabled&&(!c.naturalConversation||!c.listenContext||!c.contextCount||!c.proactiveGroups.length||c.mode!=='chat')){jump('proactiveEnabled');note('主动参与还缺少必要设置，请按下方提示补齐。',true);return false;}return true;}
  form.addEventListener('input',e=>{if(e.target.matches('[data-setting]')){e.target.removeAttribute('aria-invalid');e.target.parentElement.querySelector('.qq-validation')?.remove();}});
  window.BotSettings={hasLocalDrafts:()=>Boolean(form.querySelector('[data-local-dirty=true]')||window.BotConversationUI?.hasLocalDrafts()),resolve:name=>name==='resources'?'memory':name,onNavigate,syncDraft,jump,find,close,validateForm,routes};
};
