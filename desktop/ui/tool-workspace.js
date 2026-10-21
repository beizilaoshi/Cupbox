"use strict";
window.CupboxToolWorkspace=(()=>{
  const $=id=>document.getElementById(id);
  let hooks,category='全部',query='';
  const summaries={desktop_observe:'查看已授权窗口与会话额度',desktop_capture:'截取已授权窗口，图片不自动上传',desktop_ocr:'本地OCR，文字可能进入当前模型',desktop_vision:'确认截图后交给所选视觉模型分析',desktop_mouse:'移动、点击、右击、双击和滚动',desktop_type:'向授权窗口输入普通文本',desktop_key:'向授权窗口发送受限按键',hash:'计算文本或文件的校验值',time:'秒、毫秒与日期互相转换',codec:'格式化 JSON、编码与解码',csv:'CSV 和 JSON 数据互转',search:'按名称或内容查找文件',rename:'按规则批量修改文件名',organize:'按类型或日期整理文件',zip:'创建、解压或查看压缩包',obfuscate:'图片像素混淆与还原',ocr:'提取图片中的文字',clip:'读取或写入系统剪贴板',shot:'截取屏幕并保存图片',run:'执行允许列表中的命令',proc:'查看进程或结束指定进程'};
  const system=new Set(['zip','ocr','clip','shot','run','proc','desktop_observe','desktop_capture','desktop_ocr','desktop_vision','desktop_mouse','desktop_type','desktop_key']);
  function library(){ $('drawer').dataset.view='library';render();$('library-search').focus(); }
  function editor(){ $('drawer').dataset.view='editor'; }
  function render(){
    if(!hooks)return;
    const box=$('tool-cards');box.replaceChildren();
    const tools=hooks.tools().filter(t=>(category==='全部'||t.group===category)&&`${t.name} ${t.id} ${summaries[t.id]}`.toLowerCase().includes(query));
    const featureKey=({文件:'files',数据:'data',图片:'vision',系统:'workflow'})[category]||'files';const feature=CupboxVisuals.features[featureKey];$('tools-category-art').src='assets/'+feature.image;$('tools-category-description').textContent=category==='全部'?'文件归类、格式转换、图片文字识别，从一个小任务开始。':category==='系统'?'运行命令、查看进程与系统工具。需要本机权限，执行前请核对操作范围。':feature.description+'。无需配置 AI，也可以直接使用。';
    if(!tools.length){box.append(CupboxVisuals.empty(featureKey,'没有找到匹配工具','试试其他关键词，或在设置中启用需要的工具。'));return;}
    for(const tool of tools){
      const b=document.createElement('button');b.className='tool-card';b.dataset.tool=tool.id;
      b.innerHTML=`<span class="tool-card-icon">${CupboxIcons.html(tool.id)}</span><span><b>${tool.name}</b><small>${summaries[tool.id]}</small></span><em>${system.has(tool.id)?'本机工具':tool.group}</em>`;
      b.addEventListener('click',()=>{hooks.select(tool.id,true);editor();});box.appendChild(b);
    }
  }
  const pathFields={file:'file',dir:'directory',root:'directory',cwd:'directory',input:'file',imagePath:'file',sources:'files',destDir:'directory',output:'save',outputPath:'save'};
  function form(){
    $('tool-form').querySelectorAll('input[data-key]').forEach(input=>{
      const kind=pathFields[input.dataset.key];if(!kind||input.type==='checkbox')return;
      const row=document.createElement('div');row.className='path-input-row';input.before(row);row.appendChild(input);
      const b=document.createElement('button');b.type='button';b.className='path-picker';b.innerHTML=CupboxIcons.html(kind==='directory'?'folder':'image');b.title=kind==='directory'?'选择文件夹':'选择文件';b.setAttribute('aria-label',b.title);
      b.addEventListener('click',async()=>{try{let picker=kind;if(hooks.current()==='zip'&&input.dataset.key==='output'&&$('tool-form').querySelector('[data-key="action"]').value!=='create')picker='file';const value=await cupbox.pickToolPath(picker);if(value){input.value=value;if(hooks.current()==='hash'&&input.dataset.key==='file')$('tool-form').querySelector('[data-key="text"]').value='';input.dispatchEvent(new Event('input',{bubbles:true}));}}catch(e){hooks.toast(e.message);}});row.appendChild(b);
    });
    $('tool-form').onchange=()=>availability(hooks.current());
  }
  function availability(id){
    const blocked=system.has(id)&&document.documentElement.dataset.executionEnvironment!=='native';
    $('tool-environment-hint').hidden=!blocked;
    $('btn-run').disabled=blocked||hooks.busy();
    const get=key=>$('tool-form').querySelector('[data-key="'+key+'"]');const action=get('action')?.value;const modifying=['rename','organize'].includes(id)&&!get('dryRun')?.checked;
    const warn=id.startsWith('desktop_')||modifying||id==='run'||id==='proc'&&action==='kill'||id==='clip'||id==='shot'||id==='zip'&&action!=='list';$('tool-risk-notice').hidden=!warn;
    if(warn){const profile=CupboxRisk.describe(id,{action},modifying||id==='zip'?'write':'system');$('tool-risk-title').textContent=id==='shot'?'截图会包含当前屏幕内容':profile.title;$('tool-risk-text').textContent=id==='shot'?'请确认屏幕没有私人信息。截图保存位置由下方参数决定。':profile.consequence;$('tool-risk-notice').dataset.level=profile.level;}
    $('btn-run').dataset.risk=warn?'warning':'normal';
    if(!hooks.busy())$('btn-run').querySelector('.btn-label').textContent=['rename','organize'].includes(id)?($('tool-form').querySelector('[data-key="dryRun"]')?.checked?'预览变更':'执行变更'):'运行工具';
  }
  function text(tag,value,cls){const el=document.createElement(tag);el.textContent=String(value??'');if(cls)el.className=cls;return el;}
  function table(headers,rows){const t=document.createElement('table');t.className='visual-result-table';const head=document.createElement('tr');headers.forEach(h=>head.appendChild(text('th',h)));const thead=document.createElement('thead');thead.appendChild(head);t.appendChild(thead);const tbody=document.createElement('tbody');rows.slice(0,200).forEach(row=>{const tr=document.createElement('tr');row.forEach(v=>tr.appendChild(text('td',v)));tbody.appendChild(tr);});t.appendChild(tbody);return t;}
  function result(r,body){
    if(!r||typeof r!=='object')return false;
    if(Array.isArray(r.changes)){
      body.appendChild(text('div',`${r.changes.length} 项变更 · ${r.applied?'已执行':'预览，未修改原文件'}${r.changes.length>200?'（显示前 200 项）':''}`,'result-summary'));
      body.appendChild(table(['原名称','新名称','状态'],r.changes.map(c=>[c.from,c.to,c.skippedReason|| (c.applied?'已完成':'待执行')])));
    }else if(Array.isArray(r.hits)){
      body.appendChild(text('div',`找到 ${r.hits.length} 个文件${r.truncated?'（已截断）':''}`,'result-summary'));
      r.hits.slice(0,100).forEach(hit=>{const card=document.createElement('div');card.className='search-hit';card.appendChild(text('b',hit.path));for(const match of hit.matches||[])card.appendChild(text('pre',`${match.line}  ${match.text}`));body.appendChild(card);});
    }else if(Object.keys(r).some(k=>['md5','sha1','sha256','sha512'].includes(k))){body.appendChild(table(['算法','校验值'],Object.entries(r)));}
    else if(Array.isArray(r)){if(!r.length)body.appendChild(text('div','没有结果','placeholder'));else if(typeof r[0]!=='object'){body.appendChild(table(['序号','内容'],r.map((value,i)=>[i+1,value])));}else{const keys=Object.keys(r[0]).slice(0,5);const labels={pid:'PID',name:'进程名称',cpu:'CPU',mem:'内存'};body.appendChild(table(keys.map(k=>labels[k]||k),r.map(row=>keys.map(k=>row[k]))));}}
    else if(Object.values(r).every(v=>v===null||typeof v!=='object')&&!('text'in r)){
      const labels={unixSeconds:'时间戳（秒）',unixMilliseconds:'时间戳（毫秒）',iso:'ISO 时间',utc:'UTC 时间',cst:'北京时间',relative:'相对时间',output:'输出位置',path:'文件路径',width:'宽度',height:'高度',outputBytes:'输出大小',message:'说明',ok:'成功',exitCode:'退出码',command:'命令',stdout:'标准输出',stderr:'错误输出',durationMs:'耗时（毫秒）',timedOut:'是否超时',truncated:'是否截断'};
      body.appendChild(table(['项目','结果'],Object.entries(r).map(([k,v])=>[labels[k]||k,typeof v==='boolean'?(v?'是':'否'):v])));
    }
    else return false;
    const raw=document.createElement('details');raw.className='raw-result';raw.appendChild(text('summary','查看原始 JSON'));raw.appendChild(text('pre',JSON.stringify(r,null,2)));body.appendChild(raw);return true;
  }
  function examples(){
    const id=hooks.current();const values={hash:{text:'Hello, Cupbox',algo:'sha256'},time:{input:'1718000000'},codec:{op:'json',text:'{"project":"Cupbox","tasks":["整理文件","处理数据"]}'},csv:{to:'json',text:'name,role\nAlice,designer\nBob,developer'},search:{pattern:'.txt'},rename:{template:'{n}-{name}'},organize:{mode:'category'}}[id];
    if(!values){hooks.toast('先选择文件或填写要处理的内容');return;}
    for(const [key,value]of Object.entries(values)){const el=$('tool-form').querySelector(`[data-key="${key}"]`);if(el){el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}}
  }
  function init(options){hooks=options;
    for(const name of ['全部','文件','数据','图片','系统']){const b=document.createElement('button');const icon=document.createElement('span');icon.className='tool-category-icon';icon.innerHTML=CupboxIcons.html(({全部:'tools',文件:'folder',数据:'csv',图片:'image',系统:'monitor'})[name]);b.append(icon,document.createTextNode(name));b.className=name==='全部'?'active':'';b.addEventListener('click',()=>{category=name;[...$('tool-categories').children].forEach(el=>el.classList.toggle('active',el===b));render();});$('tool-categories').appendChild(b);}
    $('library-search').addEventListener('input',()=>{query=$('library-search').value.trim().toLowerCase();$('drawer').dataset.view='library';render();});
    $('tools-library').addEventListener('click',library);$('tool-example')?.addEventListener('click',examples);render();
    $('switch-tool-native').addEventListener('click',()=>hooks.native());
  }
  return{init,library,editor,render,form,result,availability};
})();
