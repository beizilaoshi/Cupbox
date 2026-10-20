import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const CAPABILITIES = ['text','vision','image','audio','video'];
export function publicModel({apiKey,...m}) { return {...m,hasApiKey:Boolean(apiKey)}; }
export function createModelLibrary(home) {
  let queue=Promise.resolve();
  const file=()=>path.join(home(),'models.json');
  async function read(){try{return JSON.parse(await readFile(file(),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
  function change(fn){const p=queue.catch(()=>{}).then(async()=>{const models=await read();await fn(models);await mkdir(home(),{recursive:true});await writeFile(file()+'.tmp',JSON.stringify(models,null,2),{mode:0o600});await rename(file()+'.tmp',file());return models.map(publicModel);});queue=p;return p;}
  return {
    async list(){await queue.catch(()=>{});return read();},
    save(draft){return change(models=>{
      const id=String(draft.id||randomUUID());const old=models.find(m=>m.id===id);
      const baseUrl=String(draft.baseUrl||'').trim().replace(/\/+$/,'');
      const u=new URL(baseUrl);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('服务地址必须是 HTTP / HTTPS，且不能包含凭据');
      const capabilities=[...new Set((draft.capabilities||[]).filter(c=>CAPABILITIES.includes(c)))];
      if(!capabilities.length)throw Error('至少勾选一项能力');
      const model=String(draft.model||'').trim();if(!model)throw Error('请填写模型 ID');
      const provider=draft.provider==='anthropic'?'anthropic':'openai-compatible';
      if(provider==='anthropic'&&capabilities.some(c=>!['text','vision'].includes(c)))throw Error('Anthropic 连接仅支持文本和视觉');
      const same=old?.baseUrl===baseUrl&&old?.provider===provider;
      const item={id,name:String(draft.name||model).slice(0,70),model,baseUrl,provider,preset:String(draft.preset||'custom'),capabilities,enabled:draft.enabled!==false,apiKey:String(draft.apiKey||(same?old?.apiKey:'')||''),voice:String(draft.voice||''),imageSize:String(draft.imageSize||'1024x1024'),videoAdapter:draft.videoAdapter==='siliconflow'?'siliconflow':'unsupported',reasoningMode:['auto','disabled','openai','deepseek','openrouter'].includes(draft.reasoningMode)?draft.reasoningMode:old?.reasoningMode||'auto'};
      if(capabilities.includes('video')&&item.videoAdapter!=='siliconflow')throw Error('视频需要选择硅基流动视频协议（也适用于兼容网关）');
      const i=models.findIndex(m=>m.id===id);if(i>=0)models[i]=item;else models.push(item);
    });},
    remove(id){return change(models=>{const i=models.findIndex(m=>m.id===id);if(i>=0)models.splice(i,1);});}
  };
}
