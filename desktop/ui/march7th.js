window.CupboxMarch7th=(()=>{
  async function init({getPrefs,toast,settings}){
    const $=id=>document.getElementById(id),api=window.cupbox,config=getPrefs().march7th||{};
    let lastError='',actionPending=false,polling=false,lastState={status:'idle',running:false,log:''};
    const names={idle:'待运行',confirming:'等待风险确认（尚未启动）',running:'运行中',stopping:'正在停止',stopped:'已停止',done:'进程已退出，请核对任务日志',error:'运行失败，请查看日志'};
    const bar=document.createElement('div');bar.id='march-live';bar.hidden=true;bar.innerHTML='<span id="march-live-title"></span><button id="march-live-open" type="button">查看工作流</button><button id="march-live-stop" type="button">停止任务 · Ctrl+Alt+F12</button>';document.querySelector('#app').append(bar);
    function feedback(text,error=false){$('march-feedback').textContent=text;$('march-feedback').dataset.level=error?'error':'info';if(error)toast(text);}
    function render(state){lastState=state;if(state.lastError&&state.lastError!==lastError){lastError=state.lastError;feedback(state.lastError,true);}if(state.running&&state.config){$('march-executable').value=state.config.executable||'';$('march-task').value=state.config.task||'main';$('march-name').value=state.config.workflowName||'';custom();}$('march-status').textContent=names[state.status]||state.status;$('march-status').dataset.state=state.status;const log=$('march-log'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;if(log.textContent!==state.log){log.textContent=state.log||'';if(bottom)log.scrollTop=log.scrollHeight;}
      for(const id of ['march-pick','march-task','march-name','march-save','march-run'])$(id).disabled=actionPending||state.running;
      if(!$('march-executable').value)$('march-run').disabled=true;
      $('march-stop').disabled=!state.running||state.status==='stopping';$('march-live-stop').disabled=state.status==='stopping';bar.hidden=!state.running;$('march-live-title').textContent=(names[state.status]||'三月七')+' · '+(state.tasks?.[state.task]||'三月七工作流');
    }
    const guarded=fn=>async()=>{try{await fn();}catch(e){feedback(e.message,true);}};
    const state=await api.marchState();for(const [value,label]of Object.entries(state.tasks)){const option=document.createElement('option');option.value=value;option.textContent=label;$('march-task').append(option);}
    $('march-executable').value=config.executable||'';$('march-task').value=config.task||'main';$('march-name').value=config.workflowName||'';
    const custom=()=>{$('march-custom').hidden=$('march-task').value!=='custom';};custom();render(state);$('march-task').onchange=custom;
    $('march-pick').onclick=guarded(async()=>{const file=await api.marchPick();if(file){$('march-executable').value=file;render(lastState);}});
    async function save(){const config=await api.marchSave({executable:$('march-executable').value,task:$('march-task').value,workflowName:$('march-name').value});getPrefs().march7th=config;return config;}
    $('march-save').onclick=guarded(async()=>{actionPending=true;render(lastState);try{await save();feedback('配置已保存，尚未启动任务。');}finally{actionPending=false;render(await api.marchState());}});
    $('march-run').onclick=guarded(async()=>{actionPending=true;render(lastState);try{await save();const result=await api.marchStart();feedback(result.cancelled?'已取消，未启动任何任务。':'已提交启动，请核对实时日志；进程退出不等于游戏任务完成。');}finally{actionPending=false;render(await api.marchState());}});
    const stop=guarded(async()=>{render(await api.marchStop());feedback('已停止启动的任务。自行提权或单独运行的进程请在小助手中核对。');});$('march-stop').onclick=stop;$('march-live-stop').onclick=stop;$('march-live-open').onclick=()=>settings('march7th');
    $('march-source').onclick=()=>api.openExternal('https://github.com/moesnow/March7thAssistant');
    $('march-copy-log').onclick=guarded(async()=>{await navigator.clipboard.writeText($('march-log').textContent);feedback('日志已复制。分享给 AI 或他人前，请核对账号与其他隐私。');});
    const timer=setInterval(async()=>{if(polling)return;polling=true;try{render(await api.marchState());}catch{}finally{polling=false;}},1000);window.addEventListener('beforeunload',()=>clearInterval(timer));
  }
  return{init};
})();
