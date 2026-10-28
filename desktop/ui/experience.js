'use strict';
// UI-only preferences and explanations. No configuration, account or chat writes.
(()=>{
 const explanations={
  'smtp-enabled':'默认关闭。开启并保存后，按每套邮箱的类别和收件人发送脱敏运行告警；不会调用AI。',
  'smtp-recovery':'只为服务器已接受过告警的故障发送恢复通知。主动停止机器人或正常退出不发送恢复通知。',
  'smtp-cooldown':'同一邮箱、实例与故障键再次报警的最短间隔；并非定时重复发送。失败或结果未知也占用间隔，防止反复发送。',
  'smtp-offline':'机器人已启动后持续未在线达到此时长才报警，约每30秒检查一次。手动停止不触发。',
  'smtp-limit':'每套邮箱每小时自动邮件上限，告警、恢复、失败和结果未知的提交都合并计数。',
  'smtp-password':'填写邮箱生成的SMTP授权码或应用专用密码，不一定是网页登录密码。本机系统加密保存，保存后不回显。',
  'smtp-tls':'SSL/TLS从连接开始加密；STARTTLS强制升级为加密后再认证，升级失败则终止。两者都验证服务器证书。',
  'smtp-host':'填写SMTP服务器主机名，不要填写https网址。修改主机、端口、加密方式或账号时必须重新输入授权码。',
  'smtp-to':'可填写最多20个完整邮箱地址，以逗号或换行分隔。使用密送方式，各收件人不会看到其他地址。',
  'smtp-from':'通常需与SMTP登录邮箱一致，或是服务器允许的发件别名。这里只填邮箱地址，显示名称另设。',
  naturalConversation:'使用当前角色自然聊天。自主工具、主动参与和关系成长仍由各自开关控制。',
  agentChat:'允许模型使用本会话提供的聊天工具。需要聊天模式与自然聊天；不会扩大回复范围。',
  groupPolicy:'白名单只回复指定群；黑名单排除指定群；所有群允许按触发条件回复。群号不等于用户QQ。',
  privatePolicy:'决定哪些好友私聊可以回复。私聊总开关和黑名单仍然生效。',
  groupAt:'仅当消息确实提及当前机器人时触发。主动参与、接话窗口和独立指令有各自规则。',
  followUpWindow:'被触发后的短时间内允许接着聊，无需重复 @。设为0关闭，不会突破白黑名单。',
  listenContext:'允许未触发的消息进入临时上下文，后续回答时可能提交给模型。关闭后不旁听。',
  mergeMessages:'短暂等待同一会话连续消息，合成一轮处理，减少打断和多次调用。',
  segmentedStreaming:'把回复拆成多条完整气泡，已发送的内容无法撤回；分段数量和间隔分别设置。',
  proactiveEnabled:'仅在允许主动参与的群中决定是否插话；需要自然聊天、旁听和非零上下文。',
  memoryScope:'单会话隔离、群间共享或私聊群聊全局共享。账号始终隔离；共享范围会影响可召回的私人资料。',
  memoryRecallMode:'混合检索结合中文词项、主题词和用户身份；旧版使用字词交集。可在召回测试中查看实际结果。',
  memoryTokenBudget:'分配给历史、摘要、笔记和公开资料的估算预算，不是整轮请求的总token上限。',
  memoryCompression:'本机提取旧对话并控制注入长度，不额外请求模型；压缩可能省略细节，原文件按保存上限保留。',
  memoryTools:'允许模型追加当前用户的明确原话偏好。关闭写入工具仍可召回已有偏好；不会开放删除或修改权限。',
  retainDialogue:'在本机保存并召回已触发的对话。关闭暂停读取和记录，不会删除已有文件。',
  emojiMode:'标准沿用已有触发与选择方式；创新增加筛选；实验性创新使用独立视觉流程，耗时和调用次数可能更多。',
  emojiJudgeModelId:'用于表情判断的独立模型；选择前确认连接可用及相应费用。',
  emojiVisionModelId:'用于查看候选表情画面的模型，需要支持图片输入。',
  shortVideoEnabled:'群聊需在同一条消息中引用原消息并 @ 机器人。获取不到实际画面或声音时不能当作已经看过视频。',
  shortVideoFrames:'下载允许访问的视频并抽帧给视觉模型。封面与标题不等于视频画面。',
  shortVideoAudio:'提取视频音轨交给所选音频识别模型；这是独立于聊天语音识别的设置。',
  visionModelId:'必须选择支持图像输入的连接。聊天模型是否支持图片与服务商、具体型号有关。',
  reasoningEffort:'控制支持此选项的模型的推理深度；更高档位可能更慢、消耗更多token。',
  asrEnabled:'将符合回复范围的QQ语音交给音频模型转写，再进入聊天流程。不是发送语音开关。',
  ttsEnabled:'把通过检查的回复交给语音合成服务，并补发语音；需要服务地址和可用音色。',
  voiceEnabled:'发送已导入且启用的语音素材，不等于AI语音合成。',
  gmEnabled:'独立于聊天回复的群管总开关。只管理指定群，机器人需要群管理权限。',
  gmDryRun:'只观察和记录，绝不执行撤回、警告、处罚或欢迎欢送。适合先检查规则是否会误判。',
  gmRecall:'尝试撤回命中消息，依赖群权限；失败和结果未知不会自动重复执行。',
  gmMute:'累计达到已设置的阈值后禁言，计数窗口与禁言时长是两件不同的设置。',
  gmWelcomeText:'欢迎模板支持占位符。{用户} 是QQ号，{@用户} 才会生成真实提及；可在下方预览和点选插入。',
  gmFarewellText:'用于离群欢送，可区分主动退群和被移出。离群用户不能真实@，获取不到昵称时回退QQ号。',
  qqMusicReplyMode:'显示歌单先选编号；直接第一首会先发送等待提示，再尝试转语音。',
  qqMusicGroupMode:'需要@或直接发指令，仅影响点歌；不会修改普通聊天的触发规则。',
  playEnabled:'明确指令触发的本地互动，不请求AI。各玩法、@要求、前缀和冷却独立设置。',
  companionEnabled:'基于实际成功的聊天维护关系数据；好感、信任和熟悉度含义不同，不是现实中的人物评分。',
  romanceMode:'选择关系玩法。发展还会结合好感、信任等数值及边界判断，不会只看一个进度条。',
  freeWorkflow:'第三方免费通道的实验性工具工作流，仍受本地工具授权约束；可能限流或不遵守格式。',
  allowWorkTools:'仅主人在工作模式下可请求本地工具，每次操作继续走原有批准流程。',
  connectionMode:'选择实际接入平台。不同平台支持的扫码、群管、表情和消息能力不同。'
 };
 Object.assign(explanations,{
  'api-provider':'选择与服务端相符的接口协议。不同服务商的字段和模型能力可能不同，不能仅凭模型名称判断。',
  'api-base':'填写服务商提供的API地址，不是聊天网页地址。地址会接收后续模型请求，请核对域名。',
  'api-key':'模型服务的访问凭证。请勿填入聊天、共享记忆或截图；是否需要凭证由服务商决定。',
  'api-model':'填写服务端支持的准确模型ID，或从获取的模型列表选择。显示名称不等于实际模型ID。',
  'api-reasoning-mode':'只有支持推理配置的接口才会使用这个选项；推理深度可能影响响应时间和费用。',
  'api-temp':'调整支持采样参数的模型的表达随机性。部分推理模型使用服务端自身配置。',
  'api-turns':'本轮携带的近期对话数量，越多通常消耗更多上下文。不等于长期记忆的存储容量。',
  'workflow-picker':'选择直接处理、分步规划、并行任务或审阅流程。多步流程通常需要更多模型调用。',
  'workflow-quality':'决定完成后是否再检查或修正结果，检查也可能增加耗时和模型用量。',
  'workflow-criteria':'填写你希望最终检查的要求，例如保留布局、输出指定格式；只用于当前任务工作流。',
  'relation-score':'当前档案的好感度，支持负值。修改后需要点击“保存档案”，不会自动改变其他用户。',
  'relation-trust':'当前档案的信任程度，默认0，支持负值；关系发展会结合其他数值综合判断。',
  'relation-familiarity':'相互了解的程度，范围0～100；与好感、信任分别保存。',
  'relation-arc':'设置当前关系的情绪走向，用于后续相处语境，不会改变机器人账号权限。',
  'relation-committed':'仅表示当前档案中的虚构角色关系状态，仍受年龄和相处边界约束。'
 });
 const actions={
  'save-settings':'保存全部机器人设置草稿。切页不会丢失；素材、记忆正文与插件使用卡片内的独立保存按钮。快捷键 Ctrl+S。',
  'qq-settings-discard':'恢复上次保存的机器人设置，不撤销已经单独保存的素材、记忆或关系资料。',
  'memory-test-recall':'只按已保存规则测试本地记忆，不调用模型、不写新记忆、不向QQ发送消息。',
  'memory-ai-merge':'把当前选中记录的部分事实交给模型提出合并建议。先预览，再决定是否应用。',
  'btn-save-api':'保存当前模型连接。若正在编辑密钥，请先核对服务地址和模型。',
  'clear-context':'清除当前聊天上下文，不等于永久删除所有长期记忆。',
  'relation-save':'保存当前用户档案的编辑内容；以卡片内保存结果为准。'
 };
 const $=s=>document.querySelector(s),isBot=Boolean($('#bot-form')),positions=new Map(),active=new Map();
 document.body.classList.add('ux-refined',isBot?'ux-qq':'ux-main');
 const read=(key,fallback)=>{try{return localStorage.getItem('cupbox-ui-'+key)||fallback;}catch{return fallback;}};
 const write=(key,value)=>{try{localStorage.setItem('cupbox-ui-'+key,value);}catch{}};
 document.documentElement.dataset.uiDensity=read('density','comfortable');document.documentElement.dataset.uiNotes=read('notes','visible');
 let serial=0,anchor=null,pinned=false,openTimer,hideTimer;
 const tip=document.createElement('div');tip.id='ux-tooltip';tip.className='ux-tooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);
 const live=document.createElement('div');live.className='ux-message';live.role='status';live.hidden=true;document.body.append(live);let liveTimer;
 function announce(text){live.textContent=text;live.hidden=false;clearTimeout(liveTimer);liveTimer=setTimeout(()=>live.hidden=true,3200);}
 function closeTip(){clearTimeout(openTimer);clearTimeout(hideTimer);if(anchor){const ids=(anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(s=>s&&s!==tip.id);if(ids.length)anchor.setAttribute('aria-describedby',ids.join(' '));else anchor.removeAttribute('aria-describedby');}anchor=null;pinned=false;tip.hidden=true;}
 const helpFor=new WeakMap();
 function position(){if(!anchor?.isConnected){closeTip();return;}const r=anchor.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight){closeTip();return;}tip.style.maxWidth=Math.min(360,innerWidth-24)+'px';const b=tip.getBoundingClientRect(),left=Math.max(12,Math.min(innerWidth-b.width-12,r.left)),below=r.bottom+9;tip.style.left=left+'px';tip.style.top=Math.max(12,below+b.height<innerHeight-12?below:r.top-b.height-9)+'px';}
 function showTip(node,pin=false){clearTimeout(openTimer);clearTimeout(hideTimer);if(anchor!==node)closeTip();const getter=helpFor.get(node),content=typeof getter==='function'?getter():getter;if(!content)return;anchor=node;pinned=pin;tip.textContent=content;tip.hidden=false;const ids=new Set((node.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(tip.id);node.setAttribute('aria-describedby',[...ids].join(' '));position();}
 function bindHelp(node,getter){helpFor.set(node,getter);node.dataset.uxHelp='true';}
 function enhance(root=document){
  const inputs=[...(root.matches?.('input,select,textarea')?[root]:[]),...root.querySelectorAll('label input,label select,label textarea')];
  for(const input of inputs){if(input.dataset.uxEnhanced||input.type==='hidden')continue;const label=input.closest('label');if(!label||label.classList.contains('ux-no-help')||label.querySelector('.ux-help'))continue;
   const note=label.querySelector('small,.hint'),key=input.dataset.setting||input.id,definition=explanations[key],range=input.min!==''&&input.max!==''&&input.min!==undefined?`可填范围：${input.min}～${input.max}。`:'';
   if(!definition&&!note?.textContent.trim()&&!range)continue;
   input.dataset.uxEnhanced='true';if(note)note.classList.add('ux-inline-note');
   const title=(label.querySelector('b')?.textContent||[...label.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim()||input.getAttribute('aria-label')||'此选项').trim();
   const button=document.createElement('button');button.type='button';button.className='ux-help';button.textContent='?';button.setAttribute('aria-label',title+'：查看说明');
   const getter=()=>[definition,note?.textContent.trim(),range].filter((s,i,a)=>s&&a.indexOf(s)===i).join('\n\n');bindHelp(button,getter);bindHelp(input,getter);
   const bold=label.querySelector('b');if(bold){const heading=document.createElement('span');heading.className='ux-field-heading';bold.before(heading);heading.append(bold,button);}
   else{const textNodes=[...label.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());if(textNodes.length){const heading=document.createElement('span');heading.className='ux-field-heading';label.prepend(heading);for(const text of textNodes)heading.append(text);heading.append(button);}else label.append(button);}
   button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(anchor===button&&pinned)closeTip();else showTip(button,true);});
  }
  for(const [id,text]of Object.entries(actions)){const node=document.getElementById(id);if(node&&!node.dataset.uxHelp)bindHelp(node,text);}
 }
 document.addEventListener('pointerover',e=>{const node=e.target.closest?.('[data-ux-help]');if(!node){if(!tip.contains(e.target)&&!pinned&&anchor!==document.activeElement){clearTimeout(openTimer);hideTimer=setTimeout(closeTip,180);}return;}if(pinned&&anchor!==node)return;clearTimeout(hideTimer);clearTimeout(openTimer);openTimer=setTimeout(()=>showTip(node),300);});
 document.addEventListener('pointerout',e=>{if(pinned||anchor===document.activeElement||anchor?.contains(e.relatedTarget)||tip.contains(e.relatedTarget))return;clearTimeout(openTimer);hideTimer=setTimeout(closeTip,180);});
 tip.addEventListener('pointerenter',()=>{clearTimeout(hideTimer);clearTimeout(openTimer);});tip.addEventListener('pointerleave',()=>{if(!pinned)hideTimer=setTimeout(closeTip,180);});
 document.addEventListener('focusin',e=>{if(e.target.matches?.('.ux-help'))showTip(e.target);else if(anchor&&!pinned)closeTip();});
 document.addEventListener('pointerdown',e=>{if(anchor&&!anchor.contains(e.target)&&!tip.contains(e.target))closeTip();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tip.hidden){closeTip();e.preventDefault();e.stopPropagation();return;}if(isBot&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(e.repeat)return;const button=$('#save-settings');if(button.disabled){announce('正在保存，请稍候。');return;}if(!$('#save-hint')?.classList.contains('draft')){announce('没有待保存的机器人设置；素材、笔记和用户档案请使用卡片内保存。');return;}$('#bot-form').requestSubmit();}},true);
 window.addEventListener('resize',closeTip);document.addEventListener('scroll',()=>{if(anchor===document.activeElement&&!tip.hidden)position();else closeTip();},true);
 function addViewTools(){const host=isBot?$('#qq-settings-location'):$('#settings-modal .settings-content-head');if(!host||host.querySelector('.ux-view-tools'))return;
  const tools=document.createElement('div');tools.className='ux-view-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','页面阅读选项');
  for(const [key,label]of [['density','紧凑视图'],['notes','收起说明']]){const button=document.createElement('button');button.type='button';button.className='ux-view-button';button.dataset.uxView=key;button.textContent=label;button.onclick=()=>{const attr=key==='density'?'uiDensity':'uiNotes',on=document.documentElement.dataset[attr]===(key==='density'?'compact':'hidden'),value=key==='density'?(on?'comfortable':'compact'):(on?'visible':'hidden');document.documentElement.dataset[attr]=value;write(key,value);syncViewTools();closeTip();};bindHelp(button,key==='density'?'调整表单间距，不改变功能或设置值。':'收起选项下的补充说明；问号和悬浮提示继续可用，风险提示保持显示。');tools.append(button);}host.append(tools);syncViewTools();
 }
 function syncViewTools(){document.querySelectorAll('[data-ux-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.uxView==='density'?document.documentElement.dataset.uiDensity==='compact':document.documentElement.dataset.uiNotes==='hidden')));}
 function compactOutlines(){for(const outline of document.querySelectorAll('.qq-page-outline:not([data-ux-map])')){outline.dataset.uxMap='true';if(outline.children.length<5)continue;const details=document.createElement('details');details.className='ux-page-map';const summary=document.createElement('summary');summary.textContent='本页目录 · '+outline.children.length+' 个分区';outline.before(details);details.append(summary,outline);outline.addEventListener('click',e=>{if(e.target.closest('button'))details.open=false;});}}
 const top=document.createElement('button');top.type='button';top.className='ux-back-top';top.textContent='↑ 顶部';top.hidden=true;top.onclick=()=>{const scroller=isBot?$('.bot-main'):$('#settings-modal .modal-body');scroller?.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};document.body.append(top);
 const updateTop=()=>{const scroller=isBot?$('.bot-main'):$('#settings-modal:not([hidden]) .modal-body');top.hidden=!scroller||scroller.scrollTop<500;};document.addEventListener('scroll',updateTop,true);
 if(!isBot&&$('#settings-modal'))new MutationObserver(()=>{updateTop();if($('#settings-modal').hidden)closeTip();}).observe($('#settings-modal'),{attributes:true,attributeFilter:['hidden']});
 let pending=false;const observer=new MutationObserver(records=>{if(pending||!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.closest?.('#ux-tooltip'))))return;pending=true;setTimeout(()=>{pending=false;enhance();compactOutlines();addViewTools();updateTop();},100);});observer.observe(document.body,{childList:true,subtree:true});
 window.CupboxUX={...window.CupboxUX,beforePage(kind,name,scroller){const previous=active.get(kind);if(previous&&previous!==name)positions.set(kind+':'+previous,scroller.scrollTop);if(previous===name)return scroller.scrollTop;active.set(kind,name);closeTip();return positions.get(kind+':'+name)||0;},enhance,closeTip,helpCount:()=>document.querySelectorAll('.ux-help').length};
 active.set(isBot?'qq':'settings',isBot?($('.bot-side [data-tab].active')?.dataset.tab||'overview'):($('#modal-tabs .tab.active')?.dataset.tab||'general'));
 enhance();compactOutlines();addViewTools();
})();
