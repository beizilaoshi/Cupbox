import path from 'node:path';
import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

export const MARCH_TASKS={main:'完整运行',daily:'每日实训与奖励',routine:'日常流程',power:'清体力',universe:'模拟宇宙',divergent:'差分宇宙',currencywars:'货币战争',forgottenhall:'混沌回忆',purefiction:'虚构叙事',apocalyptic:'末日幻影',fight:'锄大地',redemption:'兑换码',custom:'小助手自定义流程'};
export function marchArgs(task,workflowName=''){
  if(typeof task!=='string'||!Object.hasOwn(MARCH_TASKS,task))throw Error('请选择有效任务');
  if(task!=='custom')return[task];
  if(typeof workflowName!=='string'||!workflowName.trim()||workflowName.length>200||/[\x00-\x1f\x7f]/.test(workflowName))throw Error('请填写小助手中已创建的流程名称，不支持控制字符');
  return['--workflow-name',workflowName.trim()];
}
export function normalizeMarchConfig(config){
  if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['executable','task','workflowName'].includes(k)))throw Error('三月七配置参数无效');
  const executable=config.executable;
  if(typeof executable!=='string'||!path.isAbsolute(executable)||/[\x00-\x1f\x7f]/.test(executable)||path.basename(executable).toLowerCase()!=='march7th assistant.exe')throw Error('请选择 March7th Assistant.exe（非 Launcher 或其他程序）');
  if(config.workflowName!==undefined&&(typeof config.workflowName!=='string'||config.workflowName.length>200))throw Error('流程名称不能超过200字');
  marchArgs(config.task,config.workflowName);
  return{executable:path.normalize(executable),task:config.task,workflowName:(config.workflowName||'').trim()};
}
function childEnvironment(){
  const env={};for(const key of ['SystemRoot','WINDIR','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMDATA','HOMEDRIVE','HOMEPATH','COMSPEC','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','LANG'])if(process.env[key]!==undefined)env[key]=process.env[key];
  return{...env,PYTHONIOENCODING:'utf-8',PYTHONUNBUFFERED:'1'};
}
export function createMarchWorkflow({launch=spawn,platform=process.platform,stopTimeoutMs=8000,onStateChange=()=>{}}={}){
  let child=null,starting=null,stopping=null,generation=0,state={status:'idle',log:''};
  const snapshot=()=>({...state,running:Boolean(starting||child||stopping)});
  const notify=()=>onStateChange(snapshot());
  const append=(text,run=state)=>{if(run===state)run.log=(run.log+text).slice(-60000);};
  async function start(input){
    if(child||starting||stopping)throw Error('三月七工作流已在运行');
    const token=++generation;
    const job=(async()=>{
      const config=normalizeMarchConfig(input),args=marchArgs(config.task,config.workflowName);
      if(!(await stat(config.executable)).isFile())throw Error('小助手程序不存在');
      if(token!==generation)throw Error('启动已取消');
      const run={status:'running',task:config.task,log:'正在启动 '+MARCH_TASKS[config.task]+'…\n',startedAt:new Date().toISOString()};state=run;
      const current=launch(config.executable,args,{cwd:path.dirname(config.executable),shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env:childEnvironment()});child=current;
      for(const stream of [current.stdout,current.stderr]){const decoder=new StringDecoder('utf8');stream?.on('data',data=>append(decoder.write(data),run));stream?.on('end',()=>append(decoder.end(),run));}
      current.once('error',error=>{run.status='error';append('\n启动失败：'+error.message,run);if(child===current)child=null;notify();});
      current.once('close',(code,signal)=>{if(run.status==='stopping')run.status='stopped';else if(run.status==='running')run.status=code===0?'done':'error';run.exitCode=code;append(`\n进程结束：${signal||code}`,run);if(child===current)child=null;notify();});
      return snapshot();
    })();starting=job;
    try{return await job;}finally{if(starting===job)starting=null;notify();}
  }
  async function stop(){
    generation++;if(starting)await starting.catch(()=>{});
    if(stopping){await stopping;return snapshot();}
    if(!child)return snapshot();
    const current=child,run=state,previous=run.status;
    if(!Number.isInteger(current.pid)||current.pid<=0)throw Error('进程标识不可用，请检查小助手是否仍在运行');
    run.status='stopping';run.lastError='';notify();
    const job=(async()=>{
      let timer,onClosed;
      const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('停止超时，请在小助手或任务管理器中核对进程；Cupbox 保持打开')),stopTimeoutMs);});
      try{
        const closed=new Promise(resolve=>{if(child!==current)resolve();else{onClosed=resolve;current.once('close',onClosed);}});
        const killed=platform==='win32'?new Promise((resolve,reject)=>{
          const killer=launch(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(current.pid),'/T','/F'],{windowsHide:true,shell:false,stdio:'ignore'});
          killer.once('error',reject);killer.once('close',code=>code===0||child!==current?resolve():reject(Error('停止失败，请在小助手中检查进程')));
        }):current.kill('SIGTERM')?Promise.resolve():Promise.reject(Error('无法停止小助手'));
        await Promise.race([Promise.all([closed,killed]),timeout]);append('\n启动的进程已停止。',run);
      }catch(error){if(child===current)run.status=previous;run.lastError=error.message;append('\n停止失败：'+error.message,run);throw error;}finally{clearTimeout(timer);if(onClosed)current.removeListener('close',onClosed);}
    })();stopping=job;
    try{await job;}finally{if(stopping===job)stopping=null;notify();}
    return snapshot();
  }
  return{snapshot,start,stop};
}
