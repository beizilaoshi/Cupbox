import {mkdir,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {requestHTTP} from '../workbench/http.js';
import {isBitmap} from './capabilities.js';
import {ruleFor} from './engine.js';
import {backgroundTime} from './background.js';
import {inspectUntrusted,outputRisk} from './security.js';

const MAX=8*1024*1024,idOK=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v),digest=b=>createHash('sha256').update(b).digest('hex');
const safePrompt=p=>typeof p==='string'&&p.trim()&&p.length<=2000&&!outputRisk(p)&&!inspectUntrusted(p).blocked;
async function bounded(response,limit){
 if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('生图返回内容超过大小上限');}
 const chunks=[];let size=0;for await(const b of response.body){size+=b.length;if(size>limit){await response.body.cancel().catch(()=>{});throw Error('生图返回内容超过大小上限');}chunks.push(b);}return Buffer.concat(chunks);
}
export async function generateBitmap(model,prompt,{signal,fetcher=fetch,download=requestHTTP}={}){
 const base=new URL(model.baseUrl);if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||model.provider!=='openai-compatible')throw Error('请选择OpenAI兼容或硅基流动的生图连接');
 const size=model.imageSize||'1024x1024';if(!/^\d{3,4}x\d{3,4}$/.test(size)&&!['auto','1024x1536','1536x1024'].includes(size))throw Error('请在模型库填写有效的生图尺寸');
 const r=await fetcher(base.href.replace(/\/+$/,'')+'/images/generations',{method:'POST',redirect:'error',signal,headers:{'content-type':'application/json',...(model.apiKey?{authorization:'Bearer '+model.apiKey}:{})},body:JSON.stringify({model:model.model,prompt,n:1,...(model.preset==='siliconflow'?{image_size:size}:{size})})});
 if(!r.ok){await r.body?.cancel();throw Error('生图接口请求失败（HTTP '+r.status+'），请检查模型、额度和接口地址');}
 const data=JSON.parse((await bounded(r,12*1024*1024)).toString('utf8')),item=(data.data||data.images)?.[0];let bytes;
 if(typeof item?.b64_json==='string'){if(item.b64_json.length>Math.ceil(MAX/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(item.b64_json))throw Error('返回的图片编码无效或超过8MB');bytes=Buffer.from(item.b64_json,'base64');}
 else if(typeof item?.url==='string'){
  const u=new URL(item.url);if(u.protocol!=='https:'||u.username||u.password||u.href.length>6000)throw Error('生图下载地址必须是无内嵌凭据的公开HTTPS地址');
  const result=await download({url:u.href,responseType:'binary',maxBytes:MAX,timeoutMs:45000},{signal});if(result.status!==200||result.truncated)throw Error('生图下载失败或超过8MB');bytes=Buffer.from(result.bytes);
 }else throw Error('生图接口未返回可用图片');
 if(!bytes?.length||bytes.length>MAX||!isBitmap(bytes))throw Error('生图结果不是8MB内的PNG/JPEG/WebP/GIF位图');
 const png=await sharp(bytes,{limitInputPixels:16777216,animated:false}).rotate().png().toBuffer();if(png.length>MAX)throw Error('转换后的图片超过8MB，请减小尺寸');
 return{bytes:png,usage:data.usage};
}

export class QQImageGeneration{
 constructor(extras){this.extras=extras;this.s=extras.service;this.busy=false;this.render=generateBitmap;}
 async directory(){const dir=path.join(this.s.store.root,'generated-images');await mkdir(dir,{recursive:true});if((await lstat(dir)).isSymbolicLink()||path.resolve(await realpath(dir)).toLowerCase()!==path.resolve(dir).toLowerCase())throw Error('生图目录不能是链接');return dir;}
 async list(){return(await this.s.store.json('generated-images.json',[])).slice(-100).reverse().map(({id,at,prompt,model})=>({id,at,prompt,model}));}
 async asset(id){if(!idOK(id))throw Error('生图编号无效');const row=(await this.s.store.json('generated-images.json',[])).find(r=>r.id===id);if(!row)throw Error('找不到这张本机生成的图片');const file=path.join(await this.directory(),id+'.png'),st=await lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size>MAX)throw Error('本机图片无效或超过8MB');const bytes=await readFile(file);if(bytes.length>MAX||digest(bytes)!==row.hash||!isBitmap(bytes))throw Error('本机图片已被修改，请重新生成');return{row,bytes};}
 async preview(id){const a=await this.asset(id);return{id,url:'data:image/png;base64,'+a.bytes.toString('base64')};}
 async files(ids=[]){if(!Array.isArray(ids)||ids.length>9||new Set(ids).size!==ids.length)throw Error('每篇说说最多9张不同的本机生成图片');const images=[];let size=0;for(const id of ids){const {bytes}=await this.asset(id);size+=bytes.length;if(size>20*1024*1024)throw Error('说说配图总量超过20MB');images.push('base64://'+bytes.toString('base64'));}return images;}
 async generate({prompt,event,signal:outerSignal}){
  if(!this.s.config.qqImageEnabled)throw Error('请先开启AI生图并保存设置');if(!safePrompt(prompt))throw Error('请填写1～2000字的有效绘图描述');if(this.busy)throw Error('正在生图，请等待当前任务结束');this.busy=true;
  try{return await this.extras.operation(async({signal,check})=>{
   const c=this.s.config,model=await this.s.model(c.qqImageModelId,'image');if(model.provider!=='openai-compatible')throw Error('生图需要OpenAI兼容或硅基流动连接');
   const secrets=(await this.s.choices.records()).all.map(m=>m.apiKey).filter(Boolean);if(outputRisk(prompt,secrets))throw Error('绘图描述包含敏感凭证，已阻止提交');
   const date=backgroundTime(Date.now()).date;
   await this.s.store.change(async()=>{const rows=await this.s.store.json('generated-images.json',[]);if(rows.length>=100)throw Error('本机生图已达100张，请先备份并整理生成图片目录和索引');const q=await this.s.store.json('image-quota.json',{}),count=q.date===date?q.count:0;if(count>=c.qqImageDailyLimit)throw Error('今天的生图次数已达上限');if(Date.now()-(q.at||0)<c.qqImageCooldown*1000)throw Error('生图冷却中，请稍后再试');await this.s.store.write('image-quota.json',{date,count:count+1,at:Date.now()});});
   check();let generated;const usageEvent=event||{self_id:'local',message_type:'private',user_id:'local'};
   try{generated=await this.render(model,prompt.trim(),{signal});await this.s.store.addUsage(usageEvent,model.id,null,c,1,{stage:'image'}).catch(()=>{});}catch(e){await this.s.store.addUsage(usageEvent,model.id,null,c,1,{stage:'image',status:'unconfirmed'}).catch(()=>{});throw e;}
   check();const id=randomUUID(),row={id,at:Date.now(),prompt:prompt.trim(),model:model.name||model.model,hash:digest(generated.bytes)};await writeFile(path.join(await this.directory(),id+'.png'),generated.bytes,{mode:0o600,flag:'wx'});check();await this.s.store.change(async()=>{const rows=await this.s.store.json('generated-images.json',[]);rows.push(row);await this.s.store.write('generated-images.json',rows);});this.s.log('info','image','AI图片已生成并保存在本机',{model:model.id});return{id,at:row.at,prompt:row.prompt,model:row.model};
  },outerSignal,180000);}finally{this.busy=false;}
 }
 async send({id,name,requestId,event,signal:outerSignal}){
  if(!this.s.config.qqImageEnabled)throw Error('AI生图已关闭');if(typeof requestId!=='string'||requestId.length<1||requestId.length>180)throw Error('发送请求编号无效');
  return this.extras.operation(async({signal,check})=>{const account=await this.extras.account();let target;
   if(event){if(account!==String(event.self_id)||!ruleFor(event,this.s.config).reply)throw Error('当前聊天未允许回复');target=event;}else target=this.extras.target(name,account).event;
   const {bytes}=await this.asset(id);check();this.extras.rate();const key=account+':image:'+requestId;await this.extras.auditClaim(key,{account,kind:'image',target:target.message_type+':'+(target.group_id||target.user_id),imageId:id});
   try{check();const r=await this.s.send(target,[{type:'image',data:{file:'base64://'+bytes.toString('base64')}}],signal,{manual:!event});await this.extras.auditFinish(key,'delivered',r.message_id);return{ok:true};}catch(e){await this.extras.auditFinish(key,'unknown');throw e;}
  },outerSignal);
 }
 async command(event){
  const c=this.s.config;if(!c.qqImageEnabled||event.post_type!=='message')return null;const parts=Array.isArray(event.message)?event.message:[{type:'text',data:{text:event.message||''}}],text=parts.filter(p=>p.type==='text').map(p=>p.data?.text||'').join('').trim();if(!text.startsWith(c.qqImagePrefix))return null;
  if(parts.some(p=>p.type==='at'&&String(p.data?.qq)!==String(event.self_id))||event.message_type==='group'&&!parts.some(p=>p.type==='at'&&String(p.data?.qq)===String(event.self_id)))return{skipped:'群聊生图需@机器人'};
  if(!ruleFor(event,c).reply)return{skipped:'当前会话未允许生图'};
  const key=[event.self_id,event.message_type,event.group_id||event.user_id,event.message_id].join(':');let claimed=false,drawn=false;
  try{return await this.extras.operation(async({signal,check})=>{
   await this.s.store.change(async()=>{const rows=await this.s.store.json('image-commands.json',[]);if(event.message_id===undefined||rows.includes(key))throw Object.assign(Error('重复或缺少编号的生图消息'),{code:'IMAGE_DUPLICATE'});rows.push(key);await this.s.store.write('image-commands.json',rows.slice(-500));});
   claimed=true;const prompt=text.slice(c.qqImagePrefix.length).replace(/^[\s:：]+/,'');if(!prompt)throw Error('请在“'+c.qqImagePrefix+'”后填写想画的内容');const image=await this.generate({prompt,event,signal});drawn=true;check();await this.send({id:image.id,event,requestId:key,signal});return{sent:true};
  },undefined,190000);}catch(e){if(claimed&&!drawn&&this.s.config===c&&this.s.online&&!['AbortError','TimeoutError'].includes(e.name)){try{await this.extras.operation(async({signal,check})=>{check();if(!ruleFor(event,this.s.config).reply)return;this.extras.rate();await this.s.send(event,[{type:'text',data:{text:'这张图暂时没能生成，请检查生图模型、额度和冷却时间；不会自动重复扣费重试。'}}],signal);});}catch{}}this.s.log('warn','image','生图或发送未完成，请查看面板中的本机图片',{code:e.code||'IMAGE_FAILED'});return{skipped:'生图或发送未完成：'+(safePrompt(e.message)?e.message:'请检查生图配置或额度')};}
 }
}
