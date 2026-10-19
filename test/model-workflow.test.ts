import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import http from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createModelLibrary, publicModel } from '../desktop/model-library.js';
import { resolveRoutes, invokeCapability, runWorkflow } from '../desktop/model-workflow.js';
import { aiChat } from '../src/core/ai.js';

let base='',home='',server:http.Server,active=0,peak=0;
let calls:any[]=[];
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aovcAAAAASUVORK5CYII=';
const config=(extra={})=>({id:'m1',name:'测试模型',preset:'custom',provider:'openai-compatible',model:'test',apiKey:'local-test',baseUrl:base,enabled:true,capabilities:['text'],...extra});
beforeAll(async()=>{
  home=await mkdtemp(path.join(os.tmpdir(),'cupbox-workflow-'));
  server=http.createServer((req,res)=>{
    let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
      const body=JSON.parse(raw||'{}');calls.push({url:req.url,body,auth:req.headers.authorization});
      if(req.url==='/v1/images/generations'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({data:[{b64_json:png}]}));}
      if(req.url==='/v1/audio/speech'){res.setHeader('content-type','audio/mpeg');return res.end(Buffer.from('ID3-test-audio'));}
      if(req.url==='/v1/video/submit'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({requestId:'video-test'}));}
      if(req.url==='/v1/video/status'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({status:'Succeed',results:{videos:[{url:base.replace('/v1','')+'/asset.mp4'}]}}));}
      if(req.url==='/asset.mp4'){res.setHeader('content-type','video/mp4');return res.end(Buffer.from('test-video'));}
      const text=body.messages?.at(-1)?.content||'';
      const content=typeof text==='string'&&text.includes('只返回 JSON')?JSON.stringify({tasks:[{title:'模块 A',prompt:'制作 A',cap:'text'},{title:'模块 B',prompt:'制作 B',cap:'text'}]}):'真实模拟输出';
      active++;peak=Math.max(peak,active);setTimeout(()=>{active--;res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content}}]}));},80);
    });
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as any).port}/v1`;
});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(home,{recursive:true,force:true});});
beforeEach(()=>{calls=[];peak=0;});
describe('独立模型库与路由',()=>{
  it('并发保存不丢配置，公开信息不含密钥，换地址清除旧密钥',async()=>{
    const dir=await mkdtemp(path.join(home,'library-'));const library=createModelLibrary(()=>dir);
    await Promise.all([library.save(config({id:'a'})),library.save(config({id:'b',capabilities:['image']}))]);
    expect((await library.list()).length).toBe(2);
    expect(publicModel((await library.list())[0])).not.toHaveProperty('apiKey');
    await library.save(config({id:'a',apiKey:undefined,baseUrl:base+'/new'}));
    expect((await library.list()).find(m=>m.id==='a').apiKey).toBe('');
    await library.remove('b');expect((await library.list()).length).toBe(1);
  });
  it('拒绝错误协议、能力及不支持的视频适配',async()=>{
    const library=createModelLibrary(()=>path.join(home,'invalid'));
    await expect(library.save(config({baseUrl:'file:///C:/'}))).rejects.toThrow();
    await expect(library.save(config({capabilities:[]}))).rejects.toThrow();
    await expect(library.save(config({capabilities:['video']}))).rejects.toThrow('视频');
    await expect(library.save(config({provider:'anthropic',capabilities:['image']}))).rejects.toThrow('Anthropic');
  });
  it('默认关闭多模型，停用或删除的路由不会被静默替代',()=>{
    expect(()=>resolveRoutes({models:[],legacy:config(),capabilities:['text','image'],multiModel:false})).toThrow('开启');
    expect(()=>resolveRoutes({models:[config({enabled:false})],legacy:{},capabilities:['text'],routes:{text:'m1'},multiModel:true})).toThrow('尚未配置');
    expect(resolveRoutes({models:[],legacy:config(),capabilities:['text'],routes:{text:'default'},multiModel:false})[0].model.id).toBe('default');
  });
});
describe('真实 HTTP 调用与工作流调度',()=>{
  it('视觉上传图片内容而不是仅发送文本',async()=>{
    const r=await invokeCapability({cap:'vision',model:config(),prompt:'看图',system:'s',attachments:[{data:'data:image/png;base64,'+png,mime:'image/png'}],home:()=>home,signal:new AbortController().signal});
    expect(r.text).toBe('真实模拟输出');expect(calls[0].body.messages.at(-1).content[1].image_url.url).toContain(png);
    await expect(invokeCapability({cap:'vision',model:config(),prompt:'看图',system:'s',home:()=>home})).rejects.toThrow('参考图片');
  });
  it('绘图与语音分别调用生成端点并保存可读取的本地文件',async()=>{
    for(const cap of ['image','audio']){
      const r=await invokeCapability({cap,model:config(),prompt:'生成',system:'s',home:()=>home,signal:new AbortController().signal});
      expect((await readFile(fileURLToPath(r.media[0].url))).length).toBeGreaterThan(0);
    }
    expect(calls.map(c=>c.url)).toEqual(['/v1/images/generations','/v1/audio/speech']);
    expect(calls[1].body.voice).toBe('alloy');
  });
  it('视频提交后轮询并保存结果',async()=>{
    const r=await invokeCapability({cap:'video',model:config({videoAdapter:'siliconflow'}),prompt:'生成视频',home:()=>home,signal:new AbortController().signal});
    expect(r.media[0].kind).toBe('video');expect(calls.some(c=>c.url==='/v1/video/status'&&c.body.requestId==='video-test')).toBe(true);
  });
  it('项目先规划、限制并发、再整合，记录每个真实子任务',async()=>{
    const events:any[]=[];let integrated=false;
    const r=await runWorkflow({selected:[{cap:'text',model:config()}],workflow:'project',parallel:2,prompt:'大项目',system:'s',signal:new AbortController().signal,home:()=>home,emit:t=>events.push(t),integrate:async prompt=>{integrated=true;expect(prompt).toContain('模块 A');return{text:'整合结果'};}});
    expect(r.tasks).toHaveLength(2);expect(r.tasks.every(t=>t.status==='done')).toBe(true);expect(peak).toBe(2);expect(integrated).toBe(true);expect(r.text).toBe('整合结果');expect(events.some(t=>t.status==='running')).toBe(true);
  });
  it('顺序工作流只允许一个子项目运行',async()=>{
    const r=await runWorkflow({selected:[{cap:'text',model:config()}],workflow:'plan',parallel:3,prompt:'大项目',system:'s',signal:new AbortController().signal,home:()=>home,emit:()=>{},integrate:async()=>({text:'完成'})});
    expect(peak).toBe(1);expect(r.tasks).toHaveLength(2);
  });
  it('子项目轮流分配到明确勾选的文本模型，规划仍使用协调模型',async()=>{
    const r=await runWorkflow({selected:[{cap:'text',model:config()}],workerModels:[config({id:'worker-a',model:'a'}),config({id:'worker-b',model:'b'})],workflow:'project',parallel:2,prompt:'大项目',system:'s',signal:new AbortController().signal,home:()=>home,emit:()=>{},integrate:async()=>({text:'完成'})});
    expect(calls.map(c=>c.body.model)).toEqual(['test','a','b']);expect(r.tasks.map(t=>t.modelId)).toEqual(['worker-a','worker-b']);
  });
  it('审阅可使用另一个独立模型',async()=>{
    const r=await runWorkflow({selected:[{cap:'text',model:config()},{cap:'text',model:config({id:'reviewer',model:'review-test'})}],workflow:'review',prompt:'审阅',system:'s',signal:new AbortController().signal,home:()=>home,emit:()=>{}});
    expect(r.tasks).toHaveLength(2);expect(calls.map(c=>c.body.model)).toEqual(['test','review-test']);
  });
  it('单个模型失败保留其他任务产物，失败可单独重试',async()=>{
    const r=await runWorkflow({selected:[{cap:'vision',model:config()},{cap:'image',model:config()}],prompt:'做素材',system:'s',signal:new AbortController().signal,home:()=>home,emit:()=>{}});
    expect(r.tasks.map(t=>t.status)).toEqual(['error','done']);expect(r.tasks[0].modelId).toBe('m1');expect(r.media).toHaveLength(1);
  });
  it('已取消的请求不会发送到服务，排队任务不启动',async()=>{
    const controller=new AbortController();controller.abort();
    await expect(aiChat({messages:[{role:'user',text:'test'}],config:config(),signal:controller.signal})).rejects.toThrow();expect(calls).toHaveLength(0);
    const r=await runWorkflow({selected:[{cap:'text',model:config()}],prompt:'test',system:'s',signal:controller.signal,home:()=>home,emit:()=>{}});expect(r.tasks[0].status).toBe('canceled');expect(calls).toHaveLength(0);
  });
});
