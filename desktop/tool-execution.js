import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { TOOL_DEFS, runTool } from '../dist/core/toolkit.js';
import { classifyTool, needsApproval, sandboxArgs } from './execution-policy.js';
const desktop=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(desktop);

export function createToolExecution({getPrefs,home}) {
  const pending=new Map();
  const sandboxRoot=()=>path.join(home(),'sandbox');
  function requestApproval(sender,payload) {
    return new Promise(resolve=>{
      const id=randomUUID();
      const timeout=setTimeout(()=>done(false),300000);
      const destroyed=()=>done(false);
      const done=allow=>{clearTimeout(timeout);sender.removeListener('destroyed',destroyed);pending.delete(id);resolve(allow);};
      pending.set(id,{sender:sender.id,done});
      sender.once('destroyed',destroyed);
      sender.send('execution:approval',{id,...payload});
    });
  }
  function respond(sender,id,allow) {
    const request=pending.get(String(id));
    if(!request || request.sender!==sender.id)return false;
    request.done(allow===true);return true;
  }
  async function execute(sender,tool,input={},actor='manual',signal) {
    signal?.throwIfAborted();
    if(!TOOL_DEFS.some(t=>t.name===tool))throw new Error('未知的本地工具');
    const p=await getPrefs();
    if((p.disabledTools||[]).includes(tool))throw new Error('此工具已在设置中关闭');
    const environment=p.executionEnvironment==='native'?'native':'sandbox';
    const approval=['ask','smart','full'].includes(p.approvalMode)?p.approvalMode:'smart';
    let args=structuredClone(input);
    let directory=p.workspace || '';
    if(environment==='sandbox') { const checked=await sandboxArgs(tool,args,sandboxRoot());args=checked.args;directory=checked.root; }
    else {
      for(const key of ({search:['root'],rename:['dir'],organize:['dir'],run:['cwd']}[tool]||[])) if(!args[key]&&directory)args[key]=directory;
      const fields={hash:['file'],search:['root'],rename:['dir'],organize:['dir'],zip:['output','zipPath','destDir'],obfuscate:['input','output'],ocr:['imagePath'],shot:['outputPath'],run:['cwd']}[tool]||[];
      for(const key of fields)if(args[key])args[key]=path.resolve(directory||process.cwd(),String(args[key]));
      if(tool==='zip'&&args.sources)args.sources=String(args.sources).split(',').map(s=>path.resolve(directory||process.cwd(),s.trim())).join(',');
    }
    const payload={tool,args,actor,environment,directory,risk:classifyTool(tool,args)};
    let outsideRead=false;
    if(environment==='native'&&payload.risk==='read'){
      const target=args.file||args.dir||args.root;
      if(target){try{const base=directory?await realpath(directory):null;const resolved=await realpath(target);const relative=base?path.relative(base,resolved):'..';outsideRead=!base||relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative);}catch{outsideRead=true;}}
    }
    signal?.throwIfAborted();
    if((needsApproval(approval,tool,args)||(approval==='smart'&&outsideRead)) && !await requestApproval(sender,payload))throw new Error('用户未批准此操作，已取消执行');
    if(sender.isDestroyed())throw new Error('窗口已关闭');
    signal?.throwIfAborted();
    if(environment==='sandbox') args=(await sandboxArgs(tool,args,sandboxRoot())).args;
    sender.send('execution:progress',{...payload,state:'running'});
    try {
      const result=environment==='sandbox'?await restrictedRun(tool,args,directory):await runTool(tool,args);
      sender.send('execution:progress',{tool,state:'completed',environment});
      return result;
    } catch(e){if(!sender.isDestroyed())sender.send('execution:progress',{tool,state:'failed',environment,error:e.message});throw e;}
  }
  function cancel(sender){for(const [id,r] of pending)if(r.sender===sender.id){r.done(false);if(!sender.isDestroyed())sender.send('execution:approval-canceled',id);}}
  return {execute,respond,sandboxRoot,cancel};
}

export async function restrictedRun(tool,args,directory) {
  await mkdir(directory,{recursive:true});
  const reads=[directory,path.join(desktop,'sandbox-worker.mjs'),path.join(desktop,'package.json'),path.join(root,'package.json'),path.join(root,'dist'),path.join(root,'node_modules','pngjs')];
  const flags=['--permission',...reads.map(p=>`--allow-fs-read=${p}`),`--allow-fs-write=${directory}`,'--max-old-space-size=256',path.join(desktop,'sandbox-worker.mjs')];
  return new Promise((resolve,reject)=>{
    const env={ELECTRON_RUN_AS_NODE:'1',SystemRoot:process.env.SystemRoot||'',WINDIR:process.env.WINDIR||'',TEMP:directory,TMP:directory};
    const child=spawn(process.execPath,flags,{cwd:directory,windowsHide:true,env,stdio:['pipe','pipe','pipe']});
    let out='',error='',settled=false;
    const finish=(e,value)=>{if(settled)return;settled=true;clearTimeout(timer);e?reject(e):resolve(value);};
    const timer=setTimeout(()=>{child.kill();finish(new Error('沙箱执行超时（30 秒）'));},30000);
    child.on('error',e=>finish(e));
    child.stdout.on('data',chunk=>{out+=chunk;if(out.length>2*1024*1024){child.kill();finish(new Error('结果超过沙箱输出限制'));}});
    child.stderr.on('data',chunk=>{error=(error+chunk).slice(-2000);});
    child.on('close',()=>{try{const r=JSON.parse(out);if(!r.ok)throw new Error(r.error);finish(null,r.result);}catch(e){finish(new Error(out?e.message:`无法启动受限沙箱：${error || '运行时不支持权限限制'}`));}});
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify({tool,args}));
  });
}
