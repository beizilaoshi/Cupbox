import { describe,it,expect,vi,afterEach } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readTextStream } from '../src/core/streaming.js';
import { SegmentWriter,clipText } from '../desktop/qq/segments.js';
import { BotEngine,ruleFor } from '../desktop/qq/engine.js';
import { DEFAULTS,validateSettings } from '../desktop/qq/store.js';
import { QQService } from '../desktop/qq/service.js';
const cleanups:(()=>any)[]=[];
afterEach(async()=>{for(const fn of cleanups.splice(0))await fn();});
const ev=(id=1,group=111111):any=>({post_type:'message',message_type:'group',self_id:123456,user_id:654321,group_id:group,message_id:id,sender:{nickname:'小鱼'},message:[{type:'at',data:{qq:123456}},{type:'text',data:{text:'请帮忙'}}]});
function sse(frames:any[],ending=true){const raw=frames.map(v=>'data: '+JSON.stringify(v)+'\r\n\r\n').join('')+(ending?'data: [DONE]\r\n\r\n':'');const bytes=new TextEncoder().encode(raw);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}}));}
describe('QQ explicit group scope and separate speaker identity',()=>{
  it('migrates old allowlists; empty whitelist denies group collection but preserves private switch',()=>{
    expect(validateSettings({allowedGroups:['111111']}).groupPolicy).toBe('allow');
    const c=validateSettings({...DEFAULTS,enabled:true,listenContext:true,groupPolicy:'allow'});
    expect(ruleFor(ev(),c).collect).toBe(false);expect(ruleFor({...ev(),message_type:'private'},c).reply).toBe(true);
    expect(ruleFor(ev(),{...c,groupPolicy:'block',blockedGroups:['111111']}).collect).toBe(false);
    expect(ruleFor(ev(1,222222),{...c,groupPolicy:'block',blockedGroups:['111111']}).reply).toBe(true);
  });
  it('keeps raw messages intact and labels history only at the model boundary',async()=>{
    const respond=vi.fn(async()=>({text:'收到'}));const e=new BotEngine({settings:{...DEFAULTS,enabled:true,listenContext:true,cooldown:1},respond,send:async()=>{}});cleanups.push(()=>e.stop());
    await e.receive({...ev(),message:[{type:'text',data:{text:'前文'}}]});await e.receive(ev(2));
    const p=respond.mock.calls[0][0];expect(p.prompt).toBe('请帮忙');expect(p.sender).toEqual({qq:'654321',nickname:'小鱼'});expect(p.history).toEqual([{role:'user',text:'[qq_654321] '+JSON.stringify('前文'),name:'qq_654321'}]);expect(e.histories.get('group:111111')[0]).toMatchObject({text:'前文',sender:{qq:'654321'}});
  });
});
describe('bounded text-only SSE',()=>{
  it('decodes split UTF8 and CRLF while withholding reasoning and tool arguments',async()=>{
    const chunks:string[]=[];const out=await readTextStream(sse([{choices:[{index:0,delta:{reasoning_content:'私有思考'}}]},{choices:[{delta:{content:'你好🐱'}}]},{choices:[{delta:{content:'。'},finish_reason:'stop'}]}]),'openai',d=>{chunks.push(d);});
    expect(out.text).toBe('你好🐱。');expect(chunks).toEqual(['你好🐱','。']);
    await expect(readTextStream(sse([{choices:[{delta:{tool_calls:[{arguments:'secret'}]}}]}]),'openai',()=>{})).rejects.toThrow('工具');
  });
  it('Anthropic streams only text and rejects truncated or incomplete responses',async()=>{
    const chunks:string[]=[];expect((await readTextStream(sse([{type:'content_block_delta',delta:{type:'thinking_delta',thinking:'不公开'}},{type:'content_block_delta',delta:{type:'text_delta',text:'正文'}},{type:'message_stop'}],false),'anthropic',d=>{chunks.push(d);})).text).toBe('正文');expect(chunks).toEqual(['正文']);
    await expect(readTextStream(sse([{choices:[{delta:{content:'部分'}}]}],false),'openai',()=>{})).rejects.toThrow('中断');
    await expect(readTextStream(sse([{type:'message_delta',delta:{stop_reason:'max_tokens'}}],false),'anthropic',()=>{})).rejects.toThrow('完整');
  });
  it('awaits each consumer and fails closed on provider errors',async()=>{
    const order:string[]=[];await readTextStream(sse([{choices:[{delta:{content:'A'}}]},{choices:[{delta:{content:'B'}}]}]),'openai',async d=>{await Promise.resolve();order.push(d);});expect(order).toEqual(['A','B']);
    await expect(readTextStream(sse([{error:{message:'not public'}}]),'openai',()=>{})).rejects.toThrow('失败');
  });
});
describe('segmented delivery',()=>{
  it('caps parts, handles split emoji markers and mentions only the first segment',async()=>{
    const sent:any[]=[];const wait=vi.fn(async()=>{});const writer=new SegmentWriter({send:async(text:any,meta:any)=>{sent.push({text,...meta});},chars:80,max:3,interval:900,mode:'fixed',wait});
    await writer.push('  '+'甲'.repeat(80)+'乙'.repeat(80)+'丙'.repeat(100)+'[[emo');await writer.push('ji:happy]]');await writer.finish('甲'.repeat(80)+'乙'.repeat(80)+'丙'.repeat(100),{id:'happy'});
    expect(sent).toHaveLength(3);expect(sent.map(s=>s.first)).toEqual([true,false,false]);expect(sent.at(-1).emoji).toEqual({id:'happy'});expect(sent.map(s=>s.text).join('')).not.toContain('emoji');expect(wait).toHaveBeenCalledTimes(2);expect(wait.mock.calls[0][0]).toBe(900);
    expect(clipText('甲🐱',2)).toBe('甲');
  });
  it('pause after a partial send cancels the rest and does not restore cleared history',async()=>{
    let e:any;const send=vi.fn(async()=>{e.update({...e.config,enabled:false});});e=new BotEngine({settings:{...DEFAULTS,enabled:true,listenContext:true,segmentedStreaming:true,segmentMode:'fixed',segmentChars:80},send,wait:async()=>{},respond:async(p:any)=>{expect(p.onTextDelta).toBeUndefined();return{text:'甲'.repeat(200)};}});cleanups.push(()=>e.stop());
    const result=await e.receive(ev());expect(send).toHaveBeenCalledTimes(1);expect(result.parts).toBe(1);expect(result.error).toContain('无法自动撤回');expect(e.histories.size).toBe(0);
  });
  it('counts every actual part against the global message rate',async()=>{
    const send=vi.fn(async()=>{});const e=new BotEngine({settings:{...DEFAULTS,enabled:true,segmentedStreaming:true,segmentMode:'fixed',segmentChars:80,maxPerMinute:1},send,wait:async()=>{},respond:async()=>({text:'甲'.repeat(200)})});cleanups.push(()=>e.stop());
    const result=await e.receive(ev());expect(send).toHaveBeenCalledTimes(1);expect(result.parts).toBe(1);expect(result.error).toContain('中断');
  });
});
describe('server-enforced risk acknowledgement',()=>{
  async function service(){const home=await mkdtemp(path.join(os.tmpdir(),'qq-review-'));cleanups.push(()=>rm(home,{recursive:true,force:true}));return new QQService({home,choices:{records:async()=>({all:[{id:'default',capabilities:['text'],enabled:true}]})},napcat:{installed:async()=>false}}).init();}
  it('requires a reviewed identical candidate and rejects stale/reused approval',async()=>{
    const s=await service();await expect(s.save({enabled:true})).rejects.toThrow('核对风险');
    let review=await s.review({enabled:true});expect(review.risks.map((r:any)=>r.code)).toContain('globalMemory');await expect(s.save({enabled:true,privateEnabled:false},review.token)).rejects.toThrow('核对风险');
    review=await s.review({enabled:true});await s.save({temperature:.4});await expect(s.save({enabled:true},review.token)).rejects.toThrow('重新确认');
    review=await s.review({enabled:true});await s.save({enabled:true},review.token);expect(s.config.enabled).toBe(true);await s.save({enabled:false});await expect(s.save({enabled:true},review.token)).rejects.toThrow('核对风险');
  });
  it('new scope and privacy capabilities require approval; emergency pause does not',async()=>{
    const s=await service();let r=await s.review({enabled:true});await s.save({enabled:true},r.token);
    await expect(s.save({segmentedStreaming:true})).rejects.toThrow('核对风险');await expect(s.save({listenContext:true})).rejects.toThrow('核对风险');await expect(s.save({groupPolicy:'block',blockedGroups:['111111']})).rejects.toThrow('核对风险');await s.save({enabled:false});expect(s.config.enabled).toBe(false);
  });
  it('returns bounded actual group list only after login',async()=>{
    const s=await service();await expect(s.groups()).rejects.toThrow('扫码');s.started=true;s.online=true;const call=vi.fn(async()=>[{group_id:111111,group_name:'群一'},{group_id:'../oops',group_name:'错误'}]);s.bot={call};expect(await s.groups()).toEqual([{id:'111111',name:'群一'}]);expect(call).toHaveBeenCalledWith('get_group_list');
  });
});
