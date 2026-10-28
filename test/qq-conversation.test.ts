import { describe,it,expect,vi } from 'vitest';
import { conversationStyle,naturalCut,previewParts } from '../desktop/qq/conversation.js';
import { SegmentWriter } from '../desktop/qq/segments.js';
import { BotEngine } from '../desktop/qq/engine.js';
import { DEFAULTS } from '../desktop/qq/store.js';
const text='先不用急着把所有事情都做完。挑一件最容易开始的小事，做一点也算进展。累了就歇一会儿，今天也不一定要那么高效。';
const c={...DEFAULTS,segmentedStreaming:true};
describe('natural conversation and delivery',()=>{
  it('splits short casual bubbles consistently and gives longer bubbles a longer typing pause',async()=>{const body='今天终于忙完啦。一起喝杯奶茶吧。',settings={...c,segmentMode:'bubbles',typingDelay:true};const expected=previewParts(body,settings);expect(expected).toEqual(['今天终于忙完啦。','一起喝杯奶茶吧。']);const sent:string[]=[],wait=vi.fn(async()=>{}),writer=new SegmentWriter({mode:'bubbles',typingDelay:true,interval:600,wait,send:async(text:string)=>{sent.push(text);}});await writer.push(body);await writer.finish(body);expect(sent).toEqual(expected);expect(wait.mock.calls[0][0]).toBeGreaterThanOrEqual(600);expect(previewParts('```js\na(); b();\n```',settings)).toEqual(['```js\na(); b();\n```']);});
  it('keeps short messages intact and splits long ones at complete meanings',()=>{
    expect(previewParts('好呀，晚点见。',c)).toEqual(['好呀，晚点见。']);const parts=previewParts(text,c);expect(parts.length).toBeGreaterThan(1);expect(parts.join('')).toBe(text);expect(parts.every(p=>/[。！？]$/.test(p))).toBe(true);expect(parts.length).toBeLessThanOrEqual(c.maxSegments);
    expect(naturalCut('完全没有标点也没有空格的长句'.repeat(30))).toBe(0);
  });
  it('never splits lists, code blocks, URLs or nested quotes',()=>{
    for(const body of ['```js\n'+text+'\n```','1. '+text+'\n2. 保持完整','- '+text,'"'+text+'"'])expect(previewParts(body,c)).toEqual([body]);
    const body='他说：“'+text+'” 然后把内容发到了 https://example.com/this.is.a.long.path?x=abc，等大家看完再说。';const parts=previewParts(body,c);expect(parts.join('')).toBe(body);expect(parts.some(p=>p.includes('“')&&!p.includes('”'))).toBe(false);expect(parts.some(p=>p.includes('https://example.com/this.is.a.long.path?x=abc'))).toBe(true);
  });
  it('streamed chunks produce the same boundaries as local preview',async()=>{
    const sent:string[]=[];const writer=new SegmentWriter({send:async v=>{sent.push(v);},wait:async()=>{}});for(let i=0;i<text.length;i+=7)await writer.push(text.slice(i,i+7));await writer.finish(text);expect(sent).toEqual(previewParts(text,c));
  });
  it('keeps triggered dialogue while leaving unrelated messages uncollected',async()=>{
    const respond=vi.fn(async()=>({text:'记得你刚才说的。'}));let now=100000;const engine=new BotEngine({settings:{...DEFAULTS,enabled:true,listenContext:false,cooldown:1},clock:()=>now,respond,send:async()=>{}});
    const event=(id:number,at=true)=>({post_type:'message',message_type:'group',group_id:111111,user_id:654321,self_id:123456,message_id:id,message:[...(at?[{type:'at',data:{qq:123456}}]:[]),{type:'text',data:{text:at?'我的计划':'不应旁听'}}]});
    await engine.receive(event(1));now+=2000;await engine.receive(event(2,false));await engine.receive(event(3));const p=respond.mock.calls[1][0];expect(p.history).toHaveLength(2);expect(JSON.stringify(p.history)).not.toContain('不应旁听');expect(p.history[0]).toMatchObject({text:'[qq_654321] '+JSON.stringify('我的计划'),name:'qq_654321'});engine.stop();expect(engine.histories.size).toBe(0);
  });
  it('labels other group speakers so their words cannot be attributed to the current speaker',async()=>{
    const respond=vi.fn(async()=>({text:'好呀'}));const engine=new BotEngine({settings:{...DEFAULTS,enabled:true,listenContext:true,contextCount:30,cooldown:0,retainDialogue:false},clock:()=>100000,respond,send:async()=>{}});
    const event=(id:number,user_id:number,text:string,at=false)=>({post_type:'message',message_type:'group',group_id:111111,user_id,self_id:123456,message_id:id,message:[...(at?[{type:'at',data:{qq:123456}}]:[]),{type:'text',data:{text}}]});
    await engine.receive(event(1,777777,'我喜欢喝乌龙茶'));await engine.receive(event(2,777777,'我明天要去面试'));await engine.receive(event(3,654321,'那我呢',true));
    const p=respond.mock.calls[0][0];expect(p.history.map((t:any)=>t.text)).toEqual(['[qq_777777] '+JSON.stringify('我喜欢喝乌龙茶'),'[qq_777777] '+JSON.stringify('我明天要去面试')]);expect(p.history.every((t:any)=>t.name==='qq_777777')).toBe(true);expect(p.system).toContain('本轮发言者资料');expect(p.system).toContain('qq_654321');expect(p.system).toContain('前缀');engine.stop();
  });
  it('chat styles reach actual policy and work mode remains task focused',()=>{
    expect(conversationStyle({...DEFAULTS})).toContain('一到三句');expect(conversationStyle({...DEFAULTS,replyStyle:'detailed'})).toContain('操作步骤');expect(conversationStyle({...DEFAULTS,mode:'work'})).toBe('');
  });
});
