"use strict";
window.CupboxExecution=(()=>{
  const $=id=>document.getElementById(id);
  const modes={ask:'请求批准',smart:'智能批准',full:'完全控制'};
  const queue=[];let hooks,context={},active=null,previousFocus,lastEnvironment,surfaces=[],changing=false,activeNotice=null,decision=null;
  function sync(p){
    const mode=modes[p.approvalMode]?p.approvalMode:'smart';const env=p.executionEnvironment==='native'?'native':'sandbox';
    document.querySelectorAll('[data-approval-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.approvalMode===mode);b.setAttribute('aria-pressed',String(b.dataset.approvalMode===mode));});
    document.querySelectorAll('[data-execution-environment]').forEach(b=>{b.classList.toggle('active',b.dataset.executionEnvironment===env);b.setAttribute('aria-pressed',String(b.dataset.executionEnvironment===env));});
    document.documentElement.dataset.approvalMode=mode;
    $('execution-risk-banner').hidden=mode!=='full';
    document.querySelectorAll('.runtime-approval').forEach(b=>{b.textContent=modes[mode];b.title=mode==='full'?'普通文件修改可自动执行，点击调整权限':'点击调整批准方式';});
    document.querySelectorAll('.runtime-environment').forEach(b=>b.textContent=env==='native'?'本机运行':'沙箱运行');
    $('execution-directory').textContent=env==='native'?(p.workspace||'使用工具指定的路径'):context.sandbox||'沙箱目录';
    $('execution-environment-note').textContent=env==='native'?'直接操作本机文件；已批准的命令可影响整个系统。Shell、敏感访问与策略变更仍需单独批准。':'只处理隔离目录中的文件，拒绝路径与链接越界；终端、进程、Git 和剪贴板不可用。联网请求仍需域名授权，且拒绝私网地址。此模式不是虚拟机。';
    document.querySelectorAll('.sandbox-actions').forEach(el=>el.hidden=env!=='sandbox');
    document.documentElement.dataset.executionEnvironment=env;
    if(hooks.onChange&&env!==lastEnvironment){lastEnvironment=env;hooks.onChange(env,context.sandbox);}
  }
  function endNotice(){if(activeNotice){activeNotice.update(decision?.allow?'已批准这次操作，执行结果请查看任务。':decision?'本次操作已拒绝。':'这项批准请求已结束。',{kind:'info',title:decision?.allow?'已批准操作':decision?'已拒绝操作':'请求已结束'});activeNotice=null;}}
  function restore(){surfaces.forEach(([el,was])=>el.inert=was);surfaces=[];if(previousFocus?.isConnected)previousFocus.focus();}
  function queueLabel(){$('approval-queue').textContent=queue.length?'另有 '+queue.length+' 项操作排队等待；每项单独确认':'';}
  function showNext(){
    if(active||!queue.length)return;CupboxStartup.skip();CupboxUX.cancelConfirmation();CupboxUX.closeNotices();active=queue.shift();previousFocus=document.activeElement;
    const profile=CupboxRisk.describe(active.tool,active.args,active.risk);
    $('approval-screen').dataset.level=profile.level;$('approval-title').textContent=profile.title;$('approval-level').textContent=profile.label;$('approval-consequence').textContent=profile.consequence;
    $('approval-art').src='assets/ui-'+(profile.level==='info'?'info':'warning')+'.svg';$('approval-allow').textContent=profile.action;
    $('approval-check').checked=false;$('approval-ack').hidden=!profile.ack;$('approval-allow').disabled=profile.ack;
    $('approval-tool').textContent=hooks.toolName(active.tool);
    $('approval-context').textContent=(active.actor==='agent'?'AI 请求':'本地工具请求')+' · '+(active.environment==='sandbox'?'沙箱运行':'本机运行')+' · '+(active.risk==='read'?'读取 / 预览':active.risk==='write'?'修改文件':'系统或网络操作');
    $('approval-args').textContent=JSON.stringify(active.args,(key,value)=>/api.?key|password|authorization|secret|confirmToken/i.test(key)?'[已隐藏]':value,2);document.querySelector('.approval-details').open=false;
    $('approval-diff').textContent=active.args?.diff||'';$('approval-change').hidden=!active.args?.diff;
    const targets=$('approval-targets');targets.replaceChildren();for(const [key,value]of CupboxRisk.targets(active.args||{})){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=({source:'源文档',path:'目标路径',from:'来源',to:'目标',input:'输入',output:'输出',saveTo:'保存到',url:'请求目标',command:'执行命令',cwd:'运行目录',pid:'进程 PID',name:'名称'}[key]||key);dd.textContent=value;targets.append(dt,dd);}
    $('approval-directory').textContent=active.directory||'按参数中指定的路径执行';queueLabel();
    surfaces=[...document.querySelectorAll('#app,#notice-panel,.toast')].map(el=>[el,el.inert]);surfaces.forEach(([el])=>el.inert=true);
    $('approval-screen').hidden=false;$('approval-deny').focus();
    activeNotice=CupboxUX.notify('有一项'+hooks.toolName(active.tool)+'请求，正在等待你批准。',{kind:'warning',title:'需要你的决定'});
  }
  async function answer(allow){
    if(!active||allow&&$('approval-allow').disabled)return;const id=active.id;decision={id,allow};
    $('approval-allow').disabled=$('approval-deny').disabled=true;
    try{await cupbox.executionRespond(id,allow);if(active?.id===id){active=null;$('approval-screen').hidden=true;endNotice();restore();}}
    catch(e){CupboxUX.notify('无法提交批准决定：'+e.message,{kind:'error'});}
    finally{decision=null;$('approval-deny').disabled=false;if(active)$('approval-allow').disabled=!$('approval-ack').hidden&&!$('approval-check').checked;showNext();}
  }
  async function changePreference(key,value){
    if(changing)return;changing=true;try{const p=hooks.getPrefs();if(p[key]===value)return;
      if(key==='approvalMode'&&value==='full'&&!await CupboxUX.confirm('开启后，普通文件修改可能直接执行。',{tool:'permission_full'}))return;
      if(key==='executionEnvironment'&&value==='native'&&!await CupboxUX.confirm('请确认当前工作目录，只运行你信任的任务。',{tool:'environment_native'}))return;
      const saved=await hooks.save({[key]:value});sync(hooks.getPrefs());if(saved===false)return;hooks.toast(key==='approvalMode'?'批准方式已更新':'运行环境已切换');
    }finally{changing=false;}
  }
  async function init(options){
    hooks=options;context=await cupbox.executionContext();
    cupbox.onApprovalCanceled(id=>{const i=queue.findIndex(a=>a.id===id);if(i>=0)queue.splice(i,1);queueLabel();if(active?.id===id){active=null;$('approval-screen').hidden=true;endNotice();restore();showNext();}});
    cupbox.onApproval(value=>{queue.push(value);showNext();queueLabel();});
    cupbox.onExecution(value=>{const text=value.state==='running'?`${hooks.toolName(value.tool)} · 执行中…`:value.state==='completed'?'执行完成':'执行失败';document.querySelectorAll('.execution-progress').forEach(el=>el.textContent=text);});
    document.querySelectorAll('[data-approval-mode]').forEach(b=>b.addEventListener('click',()=>void changePreference('approvalMode',b.dataset.approvalMode)));
    document.querySelectorAll('[data-execution-environment]').forEach(b=>b.addEventListener('click',()=>void changePreference('executionEnvironment',b.dataset.executionEnvironment)));
    document.querySelectorAll('.runtime-settings').forEach(b=>b.addEventListener('click',()=>hooks.settings('execution')));
    document.querySelectorAll('.import-sandbox').forEach(b=>b.addEventListener('click',async()=>{try{const files=await cupbox.importSandbox();if(files.length)hooks.toast(`已导入 ${files.length} 个文件，原文件保留`);}catch(e){hooks.toast(e.message);}}));
    document.querySelectorAll('.open-sandbox').forEach(b=>b.addEventListener('click',()=>void cupbox.openSandbox()));
    $('approval-check').addEventListener('change',()=>$('approval-allow').disabled=!$('approval-check').checked);
    $('approval-allow').addEventListener('click',()=>void answer(true));$('approval-deny').addEventListener('click',()=>void answer(false));
    window.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();void answer(false);}if(e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();const all=[...$('approval-screen').querySelectorAll('button:not(:disabled),input,summary')].filter(el=>el.getClientRects().length);const i=all.indexOf(document.activeElement);all[(i+(e.shiftKey?-1:1)+all.length)%all.length].focus();}},true);
    sync(hooks.getPrefs());
  }
  return{init,sync,context:()=>context,setEnvironment:value=>changePreference('executionEnvironment',value)};
})();
