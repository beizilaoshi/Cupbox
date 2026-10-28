import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {sleeping,sleepReply} from '../desktop/qq/sleep.js';
import {validateSettings,BotStore} from '../desktop/qq/store.js';
import {BotEngine} from '../desktop/qq/engine.js';import {QQService} from '../desktop/qq/service.js';
import {QQBackground} from '../desktop/qq/background.js';
const cleanups:(()=>any)[]=[];afterEach(async()=>{for(const f of cleanups.splice(0))await f();vi.restoreAllMocks();});
const time=(clock:string)=>Date.parse('2026-10-26T'+clock+':00+08:00');
const settings=(patch:any={})=>validateSettings({enabled:true,sleepReplyEnabled:true,sleepHour:23,wakeHour:7,cooldown:0,...patch});
const event=(id=1,group=false,at=true)=>({post_type:'message',message_type:group?'group':'private',self_id:123456,user_id:654321,...(group?{group_id:111111}:{}),message_id:id,sender:{nickname:'测试用户'},message:[...(group&&at?[{type:'at',data:{qq:123456}}]:[]),{type:'text',data:{text:'你好'}}]});
async function home(){const root=await mkdtemp(path.join(os.tmpdir(),'qq-sleep-'));cleanups.push(()=>rm(root,{recursive:true,force:true}));return root;}
function fixture(patch:any={},clock=()=>time('01:00')){
 const respond=vi.fn(async()=>({text:'醒着正常回复'})),send=vi.fn(async()=>({message_id:8})),memory=vi.fn(async()=>''),knowledge=vi.fn(async()=>''),emojis=vi.fn(async()=>[]),speakReply=vi.fn(),recall=vi.fn(async()=>({history:[],memory:''}));
 const engine=new BotEngine({settings:settings(patch),clock,resolveModelName:async()=> 'DeepSeek',respond,send,memory,knowledge,emojis,speakReply,persistentMemory:{recall}});cleanups.push(()=>engine.stop());return{engine,respond,send,memory,knowledge,emojis,speakReply,recall};
}
describe('睡眠固定回复，不请求模型',()=>{
 it('默认关闭，验证作息与模板；支持跨天、同日和午夜边界',()=>{
  expect(validateSettings({}).sleepReplyEnabled).toBe(false);
  const c=settings();for(const [clock,value]of [['22:59',false],['23:00',true],['00:00',true],['06:59',true],['07:00',false]] as const)expect(sleeping(c,time(clock))).toBe(value);
  const day=settings({sleepHour:12,wakeHour:14});expect(sleeping(day,time('12:00'))).toBe(true);expect(sleeping(day,time('14:00'))).toBe(false);
  expect(sleeping(settings({sleepReplyEnabled:false}),time('01:00'))).toBe(false);
  for(const patch of [{wakeHour:23},{sleepReplyTemplate:''},{sleepReplyTemplate:'x'.repeat(501)},{sleepReplyEnabled:'true'}])expect(()=>settings(patch)).toThrow();
  expect(sleepReply(c,'DeepSeek')).toBe('DeepSeek睡着了，明天再找吧。');expect(sleepReply(settings({sleepReplyTemplate:'{model}休息中，{wake}再见。'}),'小模型')).toBe('小模型休息中，07:00再见。');
 });
 it('睡眠时直接发送固定文本，不读记忆、不请求AI/知识库/表情/语音',async()=>{
  const f=fixture({ttsEnabled:false,visionEnabled:true,companionEnabled:true});expect(await f.engine.receive(event())).toMatchObject({sent:true,sleeping:true});
  expect(f.send.mock.calls[0][1]).toEqual([{type:'text',data:{text:'DeepSeek睡着了，明天再找吧。'}}]);
  for(const spy of [f.respond,f.memory,f.knowledge,f.emojis,f.speakReply,f.recall])expect(spy).not.toHaveBeenCalled();
 });
 it('自定义文字可不含模型名，起床后恢复正常AI回复',async()=>{
  let now=time('06:59');const f=fixture({sleepReplyTemplate:'先休息啦，{wake}回来。'},()=>now);
  await f.engine.receive(event());expect(f.send.mock.calls[0][1][0].data.text).toBe('先休息啦，07:00回来。');
  now=time('07:00');await f.engine.receive(event(2));expect(f.respond).toHaveBeenCalledTimes(1);expect(f.send.mock.calls[1][1][0].data.text).toBe('醒着正常回复');
 });
 it('睡眠时收到的请求即使处理时跨过起床点，也只回复固定文字',async()=>{
  const f=fixture({},()=>time('07:00'));await f.engine.receive(event(),{sleepingAtReceipt:true});expect(f.respond).not.toHaveBeenCalled();expect(f.send.mock.calls[0][1][0].data.text).toContain('DeepSeek睡着了');
 });
 it('沿用白黑名单、群触发、去重及限速，主动群聊睡眠时保持安静',async()=>{
  const blocked=fixture({blockedUsers:['654321']});await blocked.engine.receive(event());expect(blocked.send).not.toHaveBeenCalled();
  const f=fixture({naturalConversation:true,listenContext:true,contextCount:12,proactiveEnabled:true,proactiveGroups:['111111'],maxPerMinute:1});
  await f.engine.receive(event(1,true,false));expect(f.send).not.toHaveBeenCalled();
  expect(await f.engine.receive(event(2,true,false),{proactive:true})).toMatchObject({skipped:'机器人正在睡觉，不主动插话'});
  await f.engine.receive(event(3,true));expect(f.send).toHaveBeenCalledTimes(1);
  expect(await f.engine.receive(event(3,true))).toMatchObject({skipped:'重复事件'});
  await f.engine.receive(event(4,true));expect(f.send).toHaveBeenCalledTimes(1);expect(f.respond).not.toHaveBeenCalled();
 });
 it('输出检测仍可拦截固定回复，失败发送不会转而请求AI或泄漏模板',async()=>{
  const f=fixture();f.engine.filterReply=vi.fn(async()=>({allowed:false,text:'blocked'}));await f.engine.receive(event());expect(f.send).not.toHaveBeenCalled();expect(f.respond).not.toHaveBeenCalled();
  f.engine.filterReply=async(text:string)=>({allowed:true,text});f.send.mockRejectedValueOnce(Error('offline'));await f.engine.receive(event(2));expect(f.respond).not.toHaveBeenCalled();
 });
 it('服务入口覆盖私聊、戳戳预设与群内引用，真实默认模型名来自本地配置',async()=>{
  const c=settings({pokeEnabled:true,pokeReplyMode:'preset',pokeReplyTemplates:['戳戳预设'],visionEnabled:false});
  const service=await new QQService({home:await home(),choices:{records:async()=>({all:[{id:'default',name:'筑梦模型',capabilities:['text'],enabled:true}]})}}).init();cleanups.unshift(()=>service.stop());
  service.config=c;service.engine.update(c);service.engine.clock=()=>time('01:00');service.send=vi.fn(async()=>({message_id:9}));
  const respond=vi.spyOn(service,'respond'),poke=vi.spyOn(service.extras.social,'poke');
  await service.receive(event());await service.receive({post_type:'notice',notice_type:'notify',sub_type:'poke',self_id:123456,user_id:654321,target_id:123456});
  service.bot={call:vi.fn(async()=>({group_id:111111,sender:{user_id:123456},message:[{type:'text',data:{text:'旧回复'}}]})),close:()=>{}};
  await service.receive({...event(3,true,false),message:[{type:'reply',data:{id:'5'}},{type:'text',data:{text:'继续聊'}}]});
  expect(service.send).toHaveBeenCalledTimes(2);
  await service.receive({...event(4,true,false),message:[{type:'reply',data:{id:'5'}},{type:'at',data:{qq:123456}},{type:'text',data:{text:'继续聊'}}]});
  expect(service.send).toHaveBeenCalledTimes(3);for(const call of service.send.mock.calls)expect(call[1][0].data.text).toBe('筑梦模型睡着了，明天再找吧。');
  expect(respond).not.toHaveBeenCalled();expect(poke).not.toHaveBeenCalled();
 });
 it('睡眠时暂停主动私聊，不调用生成或发送，醒来后正常执行定时问候',async()=>{
  let now=time('08:00');const c=settings({sleepHour:7,wakeHour:9,outreachEnabled:true,outreachUsers:['654321'],outreachMorning:true,outreachMorningTime:'08:00',outreachQuietFrom:'23:30',outreachQuietUntil:'06:00'});
  const generate=vi.fn(async()=>({text:'早上好'})),deliver=vi.fn(async()=>({message_id:1}));
  const bg=new QQBackground({store:new BotStore(await home()),settings:()=>c,ready:async()=> '123456',generate,deliver,clock:()=>now});cleanups.unshift(()=>bg.cancel());
  await bg.tick({force:true});expect(generate).not.toHaveBeenCalled();expect(deliver).not.toHaveBeenCalled();
  c.wakeHour=8;now=time('08:01');await bg.tick({force:true});expect(generate).toHaveBeenCalledTimes(1);expect(deliver).toHaveBeenCalledTimes(1);
 });
});
