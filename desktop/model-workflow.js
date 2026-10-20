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

export { runWorkflow } from './workflow-runner.js';
