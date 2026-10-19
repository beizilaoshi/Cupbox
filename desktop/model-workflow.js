import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { aiChat } from '../dist/core/ai.js';
import { CAPABILITIES } from './model-library.js';

export function resolveRoutes({models,legacy,capabilities,routes={},multiModel}) {
  const caps=[...new Set(capabilities||['text'])];
  if(!caps.length||caps.some(c=>!CAPABILITIES.includes(c)))throw Error('请选择有效的调用能力');
  if(!multiModel&&caps.length>1)throw Error('请先在设置中开启多模型工作，或只选一项能力');
  return caps.map(cap=>{
    let model=routes[cap]?models.find(m=>m.id===routes[cap]&&m.enabled&&m.capabilities.includes(cap)):models.find(m=>m.enabled&&m.capabilities.includes(cap));
    if(!routes[cap]&&cap==='text'&&legacy.model)model={...legacy,id:'default',name:'默认连接',capabilities:['text']};
    if(routes[cap]==='default'&&cap==='text'&&legacy.model)model={...legacy,id:'default',name:'默认连接'};
    if(!model)throw Error(`尚未配置 ${cap} 能力的可用模型，请到模型库添加或重新选择`);
    return {cap,model};
  });
}
async function jsonRequest(model,endpoint,body,signal){
  const base=model.baseUrl||'https://api.openai.com/v1';
  const response=await fetch(base.replace(/\/+$/,'')+endpoint,{method:'POST',headers:{'content-type':'application/json',...(model.apiKey?{authorization:`Bearer ${model.apiKey}`}:{})},body:JSON.stringify(body),signal});
  if(!response.ok)throw Error(`${model.name||model.model} 请求失败（HTTP ${response.status}），请检查模型能力、余额与接口协议`);
  return response;
}
async function bytes(response,limit=80*1024*1024){
  if(Number(response.headers.get('content-length'))>limit)throw Error('生成文件超过 80 MB 上限');
  const parts=[];let size=0;for await(const part of response.body){size+=part.length;if(size>limit)throw Error('生成文件超过 80 MB 上限');parts.push(part);}return Buffer.concat(parts);
}
export async function invokeCapability({cap,model,prompt,system,history=[],attachments=[],signal,home,progress=()=>{}}){
  signal?.throwIfAborted();
  if(cap==='text')return {text:(await aiChat({config:model,signal,messages:[{role:'system',text:system},...history,{role:'user',text:prompt}]})).text};
  if(cap==='vision'){
    if(!attachments.length)throw Error('视觉分析需要先添加参考图片');
    const content=[{type:'text',text:prompt},...attachments.map(a=>({type:'image_url',image_url:{url:a.data}}))];
    let response;
    if(model.provider==='anthropic'){
      const base=model.baseUrl.replace(/\/+$/,'').replace(/\/v1$/,'');
      response=await fetch(base+'/v1/messages',{method:'POST',signal,headers:{'content-type':'application/json','x-api-key':model.apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:model.model,max_tokens:4096,system,messages:[...history.map(h=>({role:h.role,content:h.text})),{role:'user',content:[{type:'text',text:prompt},...attachments.map(a=>({type:'image',source:{type:'base64',media_type:a.mime,data:a.data.split(',')[1]}}))]}]})});
      if(!response.ok)throw Error(`视觉请求失败（HTTP ${response.status}）`);
      const data=await response.json();return{text:(data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n')};
    }
    response=await jsonRequest(model,'/chat/completions',{model:model.model,messages:[{role:'system',content:system},...history.map(h=>({role:h.role,content:h.text})),{role:'user',content}]},signal);
    const data=await response.json();return{text:data.choices?.[0]?.message?.content||'（空回复）'};
  }
  const dir=path.join(home(),'generations');await mkdir(dir,{recursive:true});
  async function store(data,kind,ext){const file=path.join(dir,`${Date.now()}-${randomUUID()}.${ext}`);await writeFile(file,data);return{kind,url:pathToFileURL(file).href,name:path.basename(file)};}
  async function remote(url,kind,ext){const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw Error('生成服务返回了无效媒体地址');const r=await fetch(u,{signal});if(!r.ok)throw Error('生成成功，但下载结果失败');return store(await bytes(r),kind,ext);}
  if(cap==='image'){
    const data=await(await jsonRequest(model,'/images/generations',{model:model.model,prompt,n:1,...(model.preset==='siliconflow'?{image_size:model.imageSize||'1024x1024'}:{size:model.imageSize||'1024x1024'})},signal)).json();
    const items=data.data||data.images||[];if(!items.length)throw Error('绘图接口未返回图片');
    const media=[];for(const i of items.slice(0,4))media.push(i.b64_json?await store(Buffer.from(i.b64_json,'base64'),'image','png'):await remote(i.url,'image','png'));
    return{text:'图片已生成并保存到本机。',media};
  }
  if(cap==='audio'){
    const voice=model.voice||(model.preset==='siliconflow'?`${model.model}:alex`:'alloy');
    const r=await jsonRequest(model,'/audio/speech',{model:model.model,input:prompt,voice,response_format:'mp3'},signal);
    return{text:'语音已生成并保存到本机。',media:[await store(await bytes(r),'audio','mp3')]};
  }
  if(cap==='video'){
    if(model.videoAdapter!=='siliconflow')throw Error('该模型尚未选择受支持的视频协议');
    const data=await(await jsonRequest(model,'/video/submit',{model:model.model,prompt,image_size:'1280x720',...(attachments[0]?{image:attachments[0].data}:{})},signal)).json();
    if(!data.requestId)throw Error('视频服务未返回任务 ID');
    progress(`视频已提交 · ${data.requestId}`);
    for(let i=0;i<180;i++){
      await delay(5000,undefined,{signal});const r=await(await jsonRequest(model,'/video/status',{requestId:data.requestId},signal)).json();
      if(r.status==='Failed')throw Error(`视频生成失败：${String(r.reason||'请检查服务配置').slice(0,200)}`);
      if(r.status==='Succeed'){const url=r.results?.videos?.[0]?.url;if(!url)throw Error('视频完成但未返回地址');return{text:'视频已生成并保存到本机。',media:[await remote(url,'video','mp4')]};}
      progress(r.status==='InQueue'?'视频排队中':'视频生成中');
    }throw Error(`视频等待超时，服务端任务 ID：${data.requestId}，可在服务商后台查询`);
  }
  throw Error('不支持的能力');
}

export async function runWorkflow({selected,workerModels=[],workflow='direct',parallel=2,prompt,system,history,attachments,signal,home,emit,integrate}){
  const tasks=[];let next=0;
  const names={text:'文本',vision:'视觉分析',image:'绘图',audio:'语音',video:'视频'};
  const execute=async(task)=>{
    const route=task.cap==='text'&&['project','plan'].includes(workflow)&&workerModels.length?{cap:'text',model:workerModels[tasks.indexOf(task)%workerModels.length]}:selected.find(r=>r.cap===task.cap);task.model=route.model.name||route.model.model;task.modelId=route.model.id;task.status='running';emit({...task});
    try{const result=await invokeCapability({...route,prompt:task.prompt,system,history,attachments,signal,home,progress:note=>emit({...task,note})});Object.assign(task,result,{status:'done'});}
    catch(e){task.status=signal.aborted?'canceled':'error';task.error=signal.aborted?'已停止等待；服务端生成任务可能仍在运行':e.message;}
    emit({...task});
  };
  const textRoute=selected.find(r=>r.cap==='text');
  if(workflow!=='direct'&&!textRoute)throw Error('该工作流需要勾选文本能力作为规划和汇总模型');
  if(['project','plan'].includes(workflow)){
    emit({id:'planning',title:'拆解任务',status:'running',model:textRoute.model.name||textRoute.model.model});
    const r=await invokeCapability({...textRoute,prompt:`将下面的大任务拆成 2 到 6 个可独立并行完成的小项目。每个任务必须写明清晰的接口、交付范围，避免文件重叠。只返回 JSON：{"tasks":[{"title":"标题","prompt":"完整独立任务说明","cap":"text"}]}。cap 只能选 ${selected.map(r=>r.cap).join(',')}。不要凭空声称已执行或已交付。总目标：${prompt}`,system,history,signal,home});
    let plan;try{plan=JSON.parse(r.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('规划模型未返回有效 JSON；请重试或选择直接处理');}
    if(!Array.isArray(plan.tasks)||!plan.tasks.length||plan.tasks.length>6||plan.tasks.some(t=>!t.title||!t.prompt||!selected.some(r=>r.cap===t.cap)))throw Error('拆解结果无效，任务数量应为 1–6 且使用已勾选能力');
    emit({id:'planning',title:'拆解任务',status:'done',text:`已拆分为 ${plan.tasks.length} 个独立子项目。`});
    for(const t of plan.tasks)tasks.push({id:randomUUID(),title:String(t.title).slice(0,100),prompt:`总目标：${prompt}\n子项目：${String(t.prompt)}`,cap:t.cap,status:'queued'});
    // Every selected media capability is called, even if the planner omitted it.
    for(const r of selected.filter(r=>r.cap!=='text'&&!tasks.some(t=>t.cap===r.cap)))tasks.push({id:randomUUID(),title:`${names[r.cap]}交付`,prompt,cap:r.cap,status:'queued'});
  } else if(workflow==='review'){
    const first={id:randomUUID(),title:'初稿',prompt,cap:'text',status:'queued'};await execute(first);tasks.push(first);
    if(first.status!=='done')return{text:'初稿未完成，请重试。',tasks};
    const review={id:randomUUID(),title:'审阅与改进',prompt:`原始任务：${prompt}\n初稿：${first.text}\n请指出错误、遗漏并给出改进后的完整交付。`,cap:'text',status:'queued'};
    const other=selected.filter(r=>r.cap==='text')[1];if(other)selected=[other,...selected.filter(r=>r!==other)];
    await execute(review);tasks.push(review);
    for(const r of selected.filter(r=>r.cap!=='text'))tasks.push({id:randomUUID(),title:`${r.cap} 交付`,prompt,cap:r.cap,status:'queued'});
  } else for(const r of selected)tasks.push({id:randomUUID(),title:r.cap==='text'?'文本处理':`${names[r.cap]}处理`,prompt,cap:r.cap,status:'queued'});
  tasks.forEach(t=>emit({...t}));
  const pending=tasks.filter(t=>t.status==='queued');
  await Promise.all(Array.from({length:workflow==='plan'?1:Math.min(Math.max(1,parallel),3,pending.length)},async()=>{while(next<pending.length&&!signal.aborted){const t=pending[next++];await execute(t);}}));
  for(const t of tasks.filter(t=>t.status==='queued')){t.status='canceled';emit({...t});}
  let summary='',trace;
  if(!signal.aborted&&workflow!=='direct'&&workflow!=='review'&&tasks.some(t=>t.status==='done')){
    emit({id:'summary',title:'整合交付',status:'running'});
    const completed=tasks.map(t=>`${t.title} (${t.status})\n${t.text||t.error||''}\n${(t.media||[]).map(m=>m.url).join('\n')}`).join('\n\n');
    try{const r=await integrate(`原始目标：${prompt}\n各子项目交付：\n${completed}\n请整合完整结果，说明未完成项。仅在执行任务模式下使用本地工具落实交付。`,textRoute.model);summary=r.text;trace=r.trace;emit({id:'summary',title:'整合交付',status:'done',text:summary});}catch(e){summary=`整合失败：${signal.aborted?'已停止':e.message}`;emit({id:'summary',title:'整合交付',status:'error',error:summary});}
  }
  return{text:summary||tasks.map(t=>`【${t.title} · ${t.model||''}】\n${t.text||t.error||'已停止'}`).join('\n\n'),tasks,media:tasks.flatMap(t=>t.media||[]),...(trace?{trace}:{})};
}
