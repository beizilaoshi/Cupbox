'use strict';
window.BotSections=(()=>{
 const pages=new Map(),$=id=>document.getElementById(id),field=key=>document.querySelector(`[data-setting="${key}"]`),card=key=>field(key)?.closest('article.bot-card'),panel=id=>document.querySelector(`[data-panel="${id}"]`);
 function activate(page,key,{focus=false}={}){const state=pages.get(page);if(!state)return;state.current=key||state.current||state.sections[0].key;for(const section of state.sections){const selected=section.key===state.current;section.host.hidden=!selected;section.button.setAttribute('aria-selected',String(selected));section.button.tabIndex=selected?0:-1;if(selected&&focus)section.button.focus();}}
 function organizePage(id,definitions,classify){const page=panel(id);if(!page)return;const cards=[...new Set([...page.querySelectorAll('article.bot-card,article.chat-preview,details.advanced-settings'),...page.querySelectorAll(':scope>details')])].filter(c=>!c.parentElement.closest('article,details.advanced-settings'));
  const tabs=document.createElement('div');tabs.className='qq-section-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',page.querySelector('h1').textContent+'分类');const state={sections:[],current:null};page.dataset.organized='true';page.querySelector('.page-heading').after(tabs);
  for(const [key,title,description]of definitions){const host=document.createElement('div');host.className='qq-section-content';host.dataset.qqSection=key;host.id=`qq-${id}-${key}`;host.setAttribute('role','tabpanel');host.setAttribute('aria-labelledby',host.id+'-tab');const intro=document.createElement('p');intro.className='qq-section-intro';intro.textContent=description;host.append(intro);const button=document.createElement('button');button.type='button';button.id=host.id+'-tab';button.textContent=title;button.setAttribute('role','tab');button.setAttribute('aria-controls',host.id);button.onclick=()=>{activate(id,key);document.querySelector('.bot-main').scrollTop=0;};tabs.append(button);page.append(host);state.sections.push({key,button,host});}
  for(const node of cards){const keys=[...node.querySelectorAll('[data-setting]')].map(f=>f.dataset.setting);const key=classify(keys,node),section=state.sections.find(s=>s.key===key)||state.sections[0];section.host.append(node);}
  // Remove empty layout shells left when the original cards were moved.
  for(const grid of page.querySelectorAll(':scope>.settings-grid'))if(!grid.children.length)grid.remove();
  tabs.addEventListener('keydown',event=>{const buttons=state.sections.map(s=>s.button),at=buttons.indexOf(document.activeElement);if(at<0)return;let next;if(event.key==='ArrowRight')next=(at+1)%buttons.length;if(event.key==='ArrowLeft')next=(at-1+buttons.length)%buttons.length;if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;if(next===undefined)return;event.preventDefault();activate(id,state.sections[next].key,{focus:true});});pages.set(id,state);activate(id);
 }
 function organize(){
  document.body.classList.add('qq-organized');
  const participation=card('mergeMessages'),proactive=document.createElement('article');proactive.className='bot-card';proactive.innerHTML='<h2>主动参与群聊</h2>';participation.after(proactive);const toggle=field('proactiveEnabled').closest('label');let node=toggle;while(node&&node.id!=='companion-draft-status'){const next=node.nextElementSibling;proactive.append(node);node=next;}participation.querySelector('h2').textContent='连续消息与等待';
  // The main sharing switch belongs above both manual and autonomous sharing.
  const relay=panel('relay'),sharing=document.createElement('article');sharing.className='bot-card qq-page-master';sharing.innerHTML='<h2>分享总开关</h2>';sharing.append(field('shareEnabled').closest('label'));relay.querySelector('.page-heading').after(sharing);
  const story=card('ownerStoryEnabled');if(story){story.querySelector('h2').textContent='定时群聊小报';relay.append(story);}
  const title=(key,text)=>{const c=card(key);if(c&&!c.querySelector('h2')){const h=document.createElement('h2');h.textContent=text;c.prepend(h);}};title('globalMemory','QQ 公开资料');title('slangEnabled','会话词库');title('relayEnabled','传话权限');title('companionEnabled','成长与日常相处');
  organizePage('chat',[
   ['rhythm','节奏与接话','选择整体节奏，或为不同群和私聊设置例外。'],
   ['delivery','消息发送','调整分段、停顿、引用和称呼；可在下方本地预览。'],
   ['context','上下文与频率','决定参考多少聊天，以及普通回复的发送频率。'],
   ['proactive','主动群聊','仅在指定群中判断是否主动接话；主动私聊在“主动陪伴”配置。']
  ],(keys,node)=>keys.includes('proactiveEnabled')?'proactive':keys.includes('listenContext')?'context':keys.some(k=>['segmentedStreaming','replyStyle'].includes(k))||node.classList.contains('chat-preview')?'delivery':'rhythm');
  organizePage('persona',[
   ['presets','角色预设','选择内置角色，或管理已保存的人设副本。'],
   ['identity','名字与表达','编辑角色身份、自定义设定、语气和表达习惯。'],
   ['romance','恋爱玩法','关系玩法、场景与发展节奏集中在这里。'],
   ['rooms','会话差异','为指定会话添加背景，以及用于学习语气的示例。']
  ],keys=>keys.includes('romanceMode')?'romance':keys.some(k=>['initialNotes','styleExamples'].includes(k))?'rooms':keys.some(k=>['persona','customPrompt','rolePresentation','livingVoiceEnabled'].includes(k))?'identity':'presets');
  organizePage('models',[
   ['models','模型连接','选择对话模型并调整生成参数。'],['capabilities','工作方式与能力','管理工作模式、联网搜索与图片识别。']
  ],keys=>keys.includes('modelId')?'models':'capabilities');
  organizePage('memory',[
   ['automatic','自动记忆','管理保存范围、偏好整理与上下文预算。'],['notes','查看与整理','查看实际记录，编辑笔记或删除指定会话的记忆。'],['public','公开资料','只填写愿意让机器人在 QQ 中使用的资料。'],['lexicon','会话词库','维护会话里的词义与黑话。']
  ],(keys,node)=>keys.includes('globalMemory')?'public':keys.includes('slangEnabled')?'lexicon':node.querySelector('#memory-record,#memory-local-merge,#memory-test-recall,#memory-evidence-preview')?'notes':'automatic');
  organizePage('background',[
   ['outreach','主动私聊','设置接收者、问候、催睡觉、日常分享和安静时段。'],['diary','AI 日记','选择允许写入的聊天范围和每日生成时间。'],['status','任务与日记记录','查看后台执行状态、暂停名单和已保存的本地日记。']
  ],(keys,node)=>keys.includes('qqDiaryEnabled')?'diary':node.querySelector('#background-status')?'status':'outreach');
  organizePage('relay',[
   ['manual','手动分享','维护接收别名，编辑正文并选择接收者执行发送。'],['automatic','自主分享与小报','设置 AI 自主分享、允许接收者及定时群聊小报。'],['relay','传话规则','决定哪些用户可以请求机器人转达原话。']
  ],(keys,node)=>node===sharing?'common':keys.some(k=>['shareMode','ownerStoryEnabled'].includes(k))?'automatic':keys.includes('relayEnabled')?'relay':'manual');
  // Keep the sharing master visible regardless of the selected category.
  relay.querySelector('.qq-section-tabs').before(sharing);
  organizePage('social',[
   ['chat','会话工具','当前聊天可使用的工具与每轮额度。'],['files','本地文件权限','工作模式下的主人名单与本机文件操作批准。'],['status','状态与边界','查看当前会话状态和程序执行的安全边界。']
  ],(keys,node)=>keys.includes('ownerIds')?'files':keys.includes('agentChat')||node.tagName==='DETAILS'&&!node.classList.contains('advanced-settings')?'chat':'status');
  organizePage('interactions',[
   ['poke','戳戳回复','开关、AI／预设模式和独立冷却都在这里。'],['likes','主页点赞','设置允许点赞的名单，也可手动为指定主页点赞。']
  ],keys=>keys.includes('profileLikeEnabled')?'likes':'poke');
  organizePage('research',[['web','网页搜索','检索公开网页并按来源链接回答。'],['vision','图片识别','读取本条或被引用消息中的真实图片。'],['video','短视频解析','解析平台公开内容，区分标题、封面与视频抽样画面。']],keys=>keys.includes('visionEnabled')?'vision':keys.includes('shortVideoEnabled')?'video':'web');
  const researchIntro=panel('research')?.querySelector('article.bot-card');if(researchIntro&&!researchIntro.querySelector('[data-setting]'))panel('research').querySelector('.qq-section-tabs').before(researchIntro);
  organizePage('moderation',[
   ['scope','范围与分群','选择管理群和豁免名单，按群覆盖规则。'],['rules','内容与刷屏','维护违禁词、链接限制、刷屏与安静时段。'],['penalties','处理与处罚','设置撤回、警告与累计禁言、移出阈值。'],['members','成员与手动','配置入群离群提示，执行本机手动管理。'],['records','执行记录','查看规则命中、处理结果并清零用户计数。']
  ],(keys,node)=>keys.includes('gmGroups')||keys.includes('gmOverrides')?'scope':keys.includes('gmRecall')?'penalties':keys.includes('gmWelcome')||keys.includes('gmManual')?'members':node.querySelector('#gm-logs')?'records':'rules');
  const master=document.getElementById('gm-master');panel('moderation')?.querySelector('.qq-section-tabs')?.before(master);
  for(const grid of document.querySelectorAll('[data-panel="rules"]>.settings-grid'))grid.classList.add('qq-card-stack');
 }
 function reveal(node){const group=node.closest('[data-qq-section]'),page=node.closest('[data-panel]');if(group&&page)activate(page.dataset.panel,group.dataset.qqSection);}
 return{organize,reveal,activatePage:id=>activate(id),selected:id=>pages.get(id)?.current};
})();
