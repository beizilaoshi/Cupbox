window.CupboxSettingsLayout=(()=>{
 const pages={
  general:['常用设置','设置','从常用功能开始，按需调整。','常用 首页'],
  api:['模型连接','日常使用','连接服务商，设置默认对话模型。','API key 密钥 服务商 deepseek GPT 硅基流动 模型'],
  models:['模型库与协作','日常使用','管理独立模型，多模型协作按需开启。','模型 能力 视觉 文本 绘图 视频 语音 协作'],
  theme:['外观主题','日常使用','选择主题与背景，让工作台更合眼缘。','主题 背景 壁纸 浅色 深色 自定义 外观'],
  branding:['Logo 样式','日常使用','选择品牌标识，或让筑梦喵抱住你的灵感。','logo 图标 标识 品牌 自定义 导入 筑梦喵 抱抱'],
  music:['背景音乐','日常使用','管理本地歌单、播放方式和音量。','背景 音乐 歌曲 歌单 唱片 随机 顺序 单曲 循环 禁用 删除 导入 上传'],
  pet:['筑梦喵桌宠','日常使用','喂食、玩耍与好感度，日常陪伴都在这里。','吉祥物 筑梦喵 桌宠 喂食 玩耍 好感度 饱食 心情 梳毛 休息 换装 衣服 大小 动作 陪伴 随机 散步 走动 脾气 提醒 工作 休息 冷却 声音 音效 橡皮鸭 叫声'],
  'agent-presets':['Agent 预设','任务与工具','选择适合当前任务的工作方式。','agent 预设 角色 模式 代码'],
  plugins:['插件中心','任务与工具','按预设组合会话能力，管理本机扩展与工具。','插件 扩展 导入 输出 检测 本地 工具 能力 开关'],
  execution:['权限与运行','任务与工具','决定 AI 能做什么，以及每次操作如何批准。','权限 安全 批准 沙箱 本机 工作目录 风险 渗透'],
  startup:['启动动画','更多设置','调整启动时的画面与节奏。','启动 动画 自定义 视频'],
  freemodel:['免费模型','更多设置','第三方免费通道有使用与隐私风险，开启前请阅读提示。','免费 模型 通道'],
  workbench:['办公与开发','任务与工具','读写 Word、PPT、Excel，管理开发工具与项目授权。','办公 Word PPT Excel 文档 演示 表格 开发 授权 文件 终端 策略 审计'],
  march7th:['三月七工作流','更多设置','本机游戏自动化，启动前需单独确认。','游戏 星穹铁道 三月七 工作流'],
  about:['关于与更新','更多设置','查看当前版本与更新信息。','版本 更新 关于 存储']
 };
 let navigate=null;const $=id=>document.getElementById(id);
 const searchable='label,.f-label,h3,h4,summary,.policy-options button,.environment-options button';
 const wordsOf=value=>value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 function filter(){const query=$('settings-search').value.trim().toLocaleLowerCase(),words=wordsOf(query),tabs=[...document.querySelectorAll('#modal-tabs .tab')];let matches=0;
  for(const tab of tabs){const text=[...(pages[tab.dataset.tab]||[]),...[...($('tab-'+tab.dataset.tab)?.querySelectorAll(searchable)||[])].map(n=>n.textContent)].join(' ').toLocaleLowerCase();tab.hidden=Boolean(query)&&!words.every(word=>text.includes(word));if(!tab.hidden)matches++;}
  document.querySelectorAll('.settings-nav-group').forEach(group=>{group.hidden=![...group.querySelectorAll('.tab')].some(tab=>!tab.hidden);});
  const more=$('settings-nav-more');more.hidden=![...more.querySelectorAll('.tab')].some(tab=>!tab.hidden);if(query&&!more.hidden)more.open=true;
  $('settings-search-empty').hidden=matches>0;
 }
 function sync(name){const query=$('settings-search').value,words=wordsOf(query),page=pages[name]||pages.general;$('settings-page-title').textContent=page[0];$('settings-page-group').textContent=page[1];$('settings-page-description').textContent=page[2];
  if($('settings-search').value){$('settings-search').value='';filter();}
  const active=document.querySelector('#modal-tabs [data-tab="'+name+'"]');if(active?.closest('details'))active.closest('details').open=true;
  document.querySelectorAll('#modal-tabs .tab').forEach(tab=>{const selected=tab===active;tab.tabIndex=selected?0:-1;tab.setAttribute('aria-controls','tab-'+tab.dataset.tab);tab.id='settings-tab-'+tab.dataset.tab;const panel=$('tab-'+tab.dataset.tab);if(panel){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);}});
  if(active)active.scrollIntoView({block:'nearest'});
  if(words.length)requestAnimationFrame(()=>{const panel=$('tab-'+name),target=[...(panel?.querySelectorAll(searchable)||[])].find(node=>words.every(word=>node.textContent.toLocaleLowerCase().includes(word)));if(!target)return;for(let parent=target.parentElement;parent&&parent!==panel;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target.scrollIntoView({block:'center',behavior:'instant'});target.classList.add('settings-search-target');target.tabIndex=-1;target.focus({preventScroll:true});setTimeout(()=>target.classList.remove('settings-search-target'),2000);});
 }
 function init({switchPage}){navigate=switchPage;$('settings-search').addEventListener('input',filter);
  $('settings-search').addEventListener('keydown',event=>{if(event.key==='Escape'&&event.currentTarget.value){event.preventDefault();event.stopPropagation();event.currentTarget.value='';filter();}});
  document.querySelectorAll('[data-settings-target]').forEach(button=>button.onclick=()=>navigate(button.dataset.settingsTarget));
  $('modal-tabs').addEventListener('keydown',event=>{if(!event.target.matches('.tab')||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('#modal-tabs .tab')].filter(tab=>!tab.hidden&&tab.getClientRects().length),index=tabs.indexOf(event.target);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowDown'?1:-1)+tabs.length)%tabs.length;const target=tabs[next];if(target){navigate(target.dataset.tab);target.focus();}});
  sync('general');
 }
 return{init,sync};
})();

