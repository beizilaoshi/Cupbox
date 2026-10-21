import { describe,it,expect,vi,afterEach } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
vi.mock('../desktop/qq/capabilities.js',async(importOriginal)=>({...await importOriginal<any>(),searchWeb:vi.fn(async()=>({results:[{title:'本机搜索桩',url:'https://example.com',snippet:'公开结果'}]})),recognizeImages:vi.fn(async()=>({text:'图片显示一只猫'}))}));
import { searchWeb,recognizeImages } from '../desktop/qq/capabilities.js';
import { QQService } from '../desktop/qq/service.js';
import { DEFAULTS } from '../desktop/qq/store.js';
import {MEME_TOOL} from '../desktop/qq/meme-tools.js';
import {createChatTools} from '../desktop/qq/chat-tools.js';
import {createRomanceTurn} from '../desktop/qq/romance.js';
const cleanups:(()=>any)[]=[];
afterEach(async()=>{for(const fn of cleanups.splice(0))await fn();vi.clearAllMocks();});
async function fixture(handler:(body:any,calls:any[])=>any,stream=false){
  const home=await mkdtemp(path.join(os.tmpdir(),'cupbox-qq-service-'));cleanups.push(()=>rm(home,{recursive:true,force:true}));const calls:any[]=[];
  const server=http.createServer((req,res)=>{let raw='';req.on('data',v=>raw+=v);req.on('end',()=>{const body=JSON.parse(raw);calls.push(body);if(stream){res.setHeader('content-type','text/event-stream');res.write('data: '+JSON.stringify({choices:[{delta:{content:'先到的段落'}}]})+'\n\n');setTimeout(()=>res.end('data: '+JSON.stringify({choices:[{delta:{content:'和结尾'},finish_reason:'stop'}]})+'\n\n'),60);}else{res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:handler(body,calls)}]}));}});});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));cleanups.unshift(()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r());}));
  const model={id:'default',name:'test',model:'ordinary',provider:'openai-compatible',baseUrl:`http://127.0.0.1:${(server.address() as any).port}/v1`,apiKey:'test-key',capabilities:['text'],enabled:true};
  const vision={...model,id:'vision',capabilities:['vision']};const choices={records:async()=>({all:[model,vision]}),select:async()=>({apply:(m:any)=>m})};const prepare=vi.fn(async()=>({definitions:[{name:'fs_read',description:'读取',parameters:{type:'object',properties:{path:{type:'string'}},required:['path']}}],call:vi.fn(async()=>({ok:true,data:'已批准的文件'})),dispose:vi.fn()}));
  const service=await new QQService({home,choices,work:{prepare},napcat:{installed:async()=>false}}).init();
  const payload=(patch:any={})=>({event:{user_id:654321,self_id:123456,group_id:111111,message_type:'group'},config:{...DEFAULTS,modelId:'default',...patch},prompt:'请帮忙',system:'测试',history:[],images:[],signal:new AbortController().signal});return{service,payload,calls,prepare};
}
describe('QQ service uses actual model protocol and bounded tool capability sets',()=>{
  it('applies upstream QA once without exposing meme tools or repeating actions',async()=>{
    const {service,payload,calls}=await fixture((_body,calls)=>({content:calls.length===1?'有什么可以帮您？':'你才是大肥鱼，这叫标准身材！'}));const p:any=payload({persona:'whale'});p.prompt='大肥鱼你好';p.whaleSource=true;p.roleGuard=true;p.memeTools={definitions:[MEME_TOOL],execute:vi.fn()};expect((await service.respond(p)).text).toBe('你才是大肥鱼，这叫标准身材！');expect(calls).toHaveLength(2);expect(calls[0].tools).toBeUndefined();expect(calls[1].tools).toBeUndefined();expect(JSON.stringify(calls[1].messages)).toContain('R3-honorific');expect(p.memeTools.execute).not.toHaveBeenCalled();
  });
  it('repairs a role-breaking self-description once, with no second tool execution and no model text in logs',async()=>{
    const {service,payload,calls}=await fixture((_body,calls)=>calls.length===1?{content:'',tool_calls:[{id:'s',type:'function',function:{name:'web_search',arguments:'{"query":"公开问题"}'}}]}:{content:calls.length===2?'我只是个AI聊天搭子，套了个鲸鱼娘的壳。':'蓝色大肥鱼。白米饭爱好者，偶尔还接点你的废话。'});await service.save({searchEnabled:true});const p:any=payload({persona:'whale',searchEnabled:true});p.prompt='你是谁呀';p.roleGuard=true;expect((await service.respond(p)).text).toContain('蓝色大肥鱼');expect(calls).toHaveLength(3);expect(searchWeb).toHaveBeenCalledTimes(1);expect(calls[2].tools).toBeUndefined();expect(JSON.stringify(calls[2].messages)).toContain('不调用工具');expect(JSON.stringify(service.logger.snapshot())).not.toContain('白米饭爱好者');
  });
  it('never retries role repair indefinitely and never suppresses an explicit true AI identity answer',async()=>{
    const {service,payload,calls}=await fixture(()=>({content:'我是AI聊天搭子。'}));const p:any=payload({persona:'whale'});p.prompt='你好';p.roleGuard=true;expect((await service.respond(p)).text).toBe('我是AI聊天搭子。');expect(calls).toHaveLength(2);p.prompt='你是AI吗';await service.respond(p);expect(calls).toHaveLength(3);
  });
  it('passes a bounded romance progression tool and its pending-delivery result through the native protocol',async()=>{
    const {service,payload,calls}=await fixture((_body,calls)=>calls.length===1?{content:'',tool_calls:[{id:'r',type:'function',function:{name:'advance_romance',arguments:JSON.stringify({event:'preference',evidence:'喜欢乌龙茶'})}}]}:{content:'原来你喜欢这个。'});const p:any=payload({romanceMode:'route',romanceInGroups:true});p.prompt='我喜欢乌龙茶';p.romanceTurn=createRomanceTurn({config:p.config,event:p.event,prompt:p.prompt,state:null,signal:p.signal});expect((await service.respond(p)).text).toBe('原来你喜欢这个。');expect(calls[0].tools.map(t=>t.function.name)).toEqual(['advance_romance']);expect(JSON.stringify(calls[1].messages)).toContain('pending_delivery');expect(p.romanceTurn.pending.score).toBe(5);
  });
  it('native pass_turn ends after one request without a second model call or parent cancellation',async()=>{
    const {service,payload,calls}=await fixture(()=>({content:'',tool_calls:[{id:'quiet',type:'function',function:{name:'pass_turn',arguments:'{}'}}]}));const p:any=payload({naturalConversation:true});p.chatTools=createChatTools({config:p.config,event:p.event,prompt:p.prompt,signal:p.signal});expect(await service.respond(p)).toMatchObject({text:'',skipped:true});expect(calls).toHaveLength(1);expect(p.signal.aborted).toBe(false);expect(service.logger.snapshot().entries.some(e=>e.level==='error')).toBe(false);
  });
  it('passes real native meme tool calls and their delivery receipts back into model protocol',async()=>{
    const {service,payload,calls,prepare}=await fixture((_body,calls)=>calls.length<3?{content:'',tool_calls:[{id:'m'+calls.length,type:'function',function:{name:'send_meme',arguments:JSON.stringify(calls.length===1?{action:'search',query:'猫'}:{action:'send',id:'safe-id'})}}]}:{content:'喵～'});const execute=vi.fn(async(_name,args)=>args.action==='search'?{ok:true,candidates:[{id:'safe-id',meaning:'开心猫猫'}]}:{ok:true,status:'accepted',messageId:'123'});const p:any=payload({emojiEnabled:true});p.memeTools={definitions:[MEME_TOOL],execute};expect((await service.respond(p)).text).toBe('喵～');expect(calls[0].tools.map(t=>t.function.name)).toEqual(['send_meme']);expect(JSON.stringify(calls[2].messages)).toContain('accepted');expect(execute).toHaveBeenCalledTimes(2);expect(prepare).not.toHaveBeenCalled();
  });
  it('plain text streams before HTTP completion and separates current/history QQ identity',async()=>{
    const {service,payload,calls}=await fixture(()=>({}),true);const p:any=payload({segmentedStreaming:true});p.history=[{role:'user',text:'上一条正文',name:'qq_777777'}];const deltas:string[]=[];let done=false;p.onTextDelta=async(d:string)=>{expect(done).toBe(false);deltas.push(d);};const result=await service.respond(p);done=true;
    expect(deltas).toEqual(['先到的段落','和结尾']);expect(result.text).toBe(deltas.join(''));expect(calls[0].stream).toBe(true);expect(calls[0].messages.at(-1)).toEqual({role:'user',content:'请帮忙',name:'qq_654321'});expect(calls[0].messages[1]).toMatchObject({content:'上一条正文',name:'qq_777777'});
  });
  it('chat temperature reaches the interface and disabled search/vision/local tools are absent',async()=>{
    const {service,payload,calls,prepare}=await fixture(()=>({content:'文本回答'}));const p=payload({temperature:.35,allowWorkTools:true,ownerIds:['654321']});p.images=['https://example.com/a.png'];expect((await service.respond(p)).text).toBe('文本回答');expect(calls[0].temperature).toBe(.35);expect(calls[0].tools).toBeUndefined();expect(prepare).not.toHaveBeenCalled();expect(searchWeb).not.toHaveBeenCalled();expect(recognizeImages).not.toHaveBeenCalled();
  });
  it('search-on exposes only web_search and actually executes its returned request',async()=>{
    const {service,payload,calls}=await fixture((_body,calls)=>calls.length===1?{content:'',tool_calls:[{id:'s1',type:'function',function:{name:'web_search',arguments:'{"query":"公开问题"}'}}]}:{content:'根据结果回答 https://example.com'});await service.save({searchEnabled:true});const out=await service.respond(payload({searchEnabled:true}));expect(calls[0].tools.map((x:any)=>x.function.name)).toEqual(['web_search']);expect(searchWeb).toHaveBeenCalledTimes(1);expect(calls[1].messages.some((x:any)=>x.role==='tool')).toBe(true);expect(out.text).toContain('https://');
  });
  it('non-owner messages in work mode do not acquire local file capabilities',async()=>{
    const {service,payload,calls,prepare}=await fixture(()=>({content:'规划建议'}));const p=payload({mode:'work',allowWorkTools:true,ownerIds:['999999']});await service.save(p.config);await service.respond(p);expect(prepare).not.toHaveBeenCalled();expect(calls[0].tools).toBeUndefined();
  });
  it('owner work requests use the explicit execution hook and dispose the scoped workbench',async()=>{
    const {service,payload,calls,prepare}=await fixture((_body,calls)=>calls.length===1?{content:'',tool_calls:[{id:'r1',type:'function',function:{name:'fs_read',arguments:'{"path":"note.txt"}'}}]}:{content:'已按批准内容处理'});const p=payload({mode:'work',allowWorkTools:true,ownerIds:['654321']});await service.save(p.config);await service.respond(p);expect(calls[0].tools.map((x:any)=>x.function.name)).toEqual(['fs_read']);const work=await prepare.mock.results[0].value;expect(work.call).toHaveBeenCalledWith('fs_read',{path:'note.txt'});expect(work.dispose).toHaveBeenCalledTimes(1);
  });
  it('enabled image recognition uses a separately selected vision model then integrates its result',async()=>{
    const {service,payload,calls}=await fixture(()=>({content:'图像答复'}));const p=payload({visionEnabled:true,visionModelId:'vision'});p.images=['https://example.com/a.png'];await service.respond(p);expect(recognizeImages).toHaveBeenCalledTimes(1);expect(calls[0].messages.at(-1).content).toContain('图片显示一只猫');
  });
});
