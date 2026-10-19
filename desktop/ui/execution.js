"use strict";
window.CupboxExecution=(()=>{
  const $=id=>document.getElementById(id);
  const modes={ask:'请求批准',smart:'智能批准',full:'完全控制'};
  const queue=[];let hooks,context={},active=null,previousFocus,lastEnvironment;
  function sync(p){
    const mode=modes[p.approvalMode]?p.approvalMode:'smart';const env=p.executionEnvironment==='native'?'native':'sandbox';
    document.querySelectorAll('[data-approval-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.approvalMode===mode);b.setAttribute('aria-pressed',String(b.dataset.approvalMode===mode));});
    document.querySelectorAll('[data-execution-environment]').forEach(b=>{b.classList.toggle('active',b.dataset.executionEnvironment===env);b.setAttribute('aria-pressed',String(b.dataset.executionEnvironment===env));});
    document.querySelectorAll('.runtime-approval').forEach(b=>b.textContent=modes[mode]);
    document.querySelectorAll('.runtime-environment').forEach(b=>b.textContent=env==='native'?'本机运行':'沙箱运行');
    $('execution-directory').textContent=env==='native'?(p.workspace||'使用工具指定的路径'):context.sandbox||'沙箱目录';
    $('execution-environment-note').textContent=env==='native'?'直接操作本机文件；所有工具均可使用，按权限模式决定是否请求批准。':'文件工具在受限子进程中运行，只能处理沙箱目录；系统工具不可用。模型连接仍使用你配置的服务。';
    document.querySelectorAll('.sandbox-actions').forEach(el=>el.hidden=env!=='sandbox');
    document.documentElement.dataset.executionEnvironment=env;
    if(hooks.onChange&&env!==lastEnvironment){lastEnvironment=env;hooks.onChange(env,context.sandbox);}
  }
  function showNext(){
    if(active||!queue.length)return;active=queue.shift();previousFocus=document.activeElement;
    $('approval-title').textContent=`允许${active.actor==='agent'?' AI':'本地工具'}执行此操作？`;
    const tool=hooks.toolName(active.tool);
    $('approval-tool').textContent=tool;
    $('approval-context').textContent=`${active.environment==='sandbox'?'沙箱运行':'本机运行'} · ${active.risk==='read'?'读取 / 预览':active.risk==='write'?'修改文件':'系统操作'}`;
    $('approval-args').textContent=JSON.stringify(active.args,null,2);
    $('approval-directory').textContent=active.directory||'按参数中指定的路径执行';
    $('approval-screen').hidden=false;$('approval-deny').focus();
  }
  async function answer(allow){
    if(!active)return;const id=active.id;active=null;$('approval-screen').hidden=true;
    await cupbox.executionRespond(id,allow);previousFocus?.focus();showNext();
  }
  async function init(options){
    hooks=options;context=await cupbox.executionContext();
    cupbox.onApprovalCanceled(id=>{const i=queue.findIndex(a=>a.id===id);if(i>=0)queue.splice(i,1);if(active?.id===id){active=null;$('approval-screen').hidden=true;previousFocus?.focus();showNext();}});
    cupbox.onApproval(value=>{queue.push(value);showNext();});
    cupbox.onExecution(value=>{const text=value.state==='running'?`${hooks.toolName(value.tool)} · 执行中…`:value.state==='completed'?'执行完成':'执行失败';document.querySelectorAll('.execution-progress').forEach(el=>el.textContent=text);});
    document.querySelectorAll('[data-approval-mode]').forEach(b=>b.addEventListener('click',()=>{void hooks.save({approvalMode:b.dataset.approvalMode});sync(hooks.getPrefs());}));
    document.querySelectorAll('[data-execution-environment]').forEach(b=>b.addEventListener('click',()=>{void hooks.save({executionEnvironment:b.dataset.executionEnvironment});sync(hooks.getPrefs());}));
    document.querySelectorAll('.runtime-settings').forEach(b=>b.addEventListener('click',()=>hooks.settings('execution')));
    document.querySelectorAll('.import-sandbox').forEach(b=>b.addEventListener('click',async()=>{try{const files=await cupbox.importSandbox();if(files.length)hooks.toast(`已导入 ${files.length} 个文件，原文件保留`);}catch(e){hooks.toast(e.message);}}));
    document.querySelectorAll('.open-sandbox').forEach(b=>b.addEventListener('click',()=>void cupbox.openSandbox()));
    $('approval-allow').addEventListener('click',()=>void answer(true));$('approval-deny').addEventListener('click',()=>void answer(false));
    window.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();void answer(false);}if(e.key==='Tab'){e.preventDefault();(document.activeElement===$('approval-deny')&&!e.shiftKey?$('approval-allow'):$('approval-deny')).focus();}},true);
    sync(hooks.getPrefs());
  }
  return{init,sync,context:()=>context};
})();
