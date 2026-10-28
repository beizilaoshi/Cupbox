import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {validateSettings} from '../desktop/qq/store.js';
import {createRomanceTurn,routeKey} from '../desktop/qq/romance.js';
import {emotionalCycle,explicitBreakup,explicitReconcile} from '../desktop/qq/relationship-events.js';
import {companionView} from '../desktop/qq/companion.js';
import {relationshipGrowth} from '../desktop/qq/relationship-growth.js';
import {BotEngine} from '../desktop/qq/engine.js';import {BotMemory} from '../desktop/qq/memory.js';

const now=Date.parse('2026-10-25T12:00:00+08:00');
const config=(patch:any={})=>validateSettings({enabled:true,globalMemory:false,naturalConversation:true,companionEnabled:true,romanceMode:'route',...patch});
const event=(user=654321,group?:number)=>({post_type:'message',message_type:group?'group':'private',self_id:123456,user_id:user,...(group?{group_id:group}:{}),message_id:1,time:Math.floor(now/1000),raw_message:'你真是傻逼',message:[{type:'text',data:{text:'你真是傻逼'}}],sender:{nickname:'测试用户'}});
const base={score:-20,trust:-10,familiarity:80,committed:true,steps:[{event:'care',evidence:'我们一起散步'},{event:'honesty',evidence:'我相信你'},{event:'preference',evidence:'我喜欢乌龙茶'}]};
const turn=(patch:any={})=>createRomanceTurn({event:event(),state:base,prompt:'你真是傻逼',clock:()=>now,signal:new AbortController().signal,...patch,config:config(patch.config)});
const decide=(t:any,action='breakup',evidence='你真是傻逼')=>t.execute('decide_relationship_event',{action,evidence,reason:action==='breakup'?'持续的疏远与信任受损，决定结束关系。':'愿意在已经修复的基础上重新开始。'});
const cleanup:string[]=[];afterEach(async()=>{for(const root of cleanup.splice(0))await rm(root,{recursive:true,force:true});});

describe('角色周期与关系事件',()=>{
 it('低谷默认关闭、分手只在开启恋爱且有确认关系时提供给AI',()=>{
   expect(validateSettings({}).emotionLowEnabled).toBe(false);expect(validateSettings({}).breakupEventsEnabled).toBe(true);
   expect(turn({state:{score:-40}}).definitions.some((d:any)=>d.name==='decide_relationship_event')).toBe(false);
   for(const config of [{romanceMode:'off'},{breakupEventsEnabled:false}])expect(turn({config}).definitions.some((d:any)=>d.name==='decide_relationship_event')).toBe(false);
   expect(turn({event:event(654321,111111)}).definitions.some((d:any)=>d.name==='decide_relationship_event')).toBe(false);
   expect(turn({prompt:'我今年17岁'}).definitions.some((d:any)=>d.name==='decide_relationship_event')).toBe(false);
 });
 it('周期按北京时间在开始、结束、下一周期边界切换，未来日期不提前低落',()=>{
   const c=config({emotionLowEnabled:true,emotionLowStartDate:'2026-10-25'});
   expect(emotionalCycle(c,Date.parse('2026-10-24T15:59:59Z')).active).toBe(false);
   expect(emotionalCycle(c,Date.parse('2026-10-24T16:00:00Z'))).toMatchObject({active:true,day:1,remaining:5});
   expect(emotionalCycle(c,now+4*86400000)).toMatchObject({active:true,day:5,remaining:1});
   expect(emotionalCycle(c,now+5*86400000).active).toBe(false);
   expect(emotionalCycle(c,now+28*86400000)).toMatchObject({active:true,day:1});
   for(const patch of [{emotionLowStartDate:'2026-02-30'},{emotionLowEnabled:true},{emotionLowCycleDays:13},{emotionLowDurationDays:15},{emotionLowCycleDays:14,emotionLowDurationDays:14}])expect(()=>config(patch)).toThrow();
 });
 it('低谷影响角色表达和可见状态，不扣分、不创建伤害与分手事件',()=>{
   const t=turn({config:{emotionLowEnabled:true,emotionLowStartDate:'2026-10-25'},prompt:'今天聊些什么',state:{...base,score:60,trust:50}});
   expect(t.system).toContain('虚构生理期背景');expect(t.pending.score).toBe(60);expect(t.pending.trust).toBe(50);
   expect(t.pending.committed).toBe(true);expect(t.pending.relationshipEvents).toBeUndefined();
   expect(companionView(t.pending,now).emotionCycle).toMatchObject({active:true,day:1});
   expect(companionView(t.pending,now+5*86400000).emotionCycle.active).toBe(false);
 });
 it('负好感优先冷处理，保持恋人存档直到AI调用决定工具',()=>{
   const t=turn({prompt:'最近还好吗'});expect(t.system).toContain('负好感优先冷处理');expect(t.pending.committed).toBe(true);expect(t.pending.relationshipEvents).toBeUndefined();
   const absent=turn({prompt:'好久不见',clock:()=>now+30*86400000});expect(absent.pending.score).toBe(base.score);expect(absent.pending.committed).toBe(true);
 });
 it('AI有依据才分手，清除恋人确认、保存原话与理由，同轮不再推进亲密',async()=>{
   const t=turn();expect(await decide(t)).toMatchObject({ok:true,status:'pending_delivery',relationshipStatus:'separated'});
   expect(t.pending).toMatchObject({committed:false,relationshipStatus:'separated',breakupAt:now});
   expect(t.pending.relationshipEvents[0]).toMatchObject({type:'breakup',evidence:'你真是傻逼'});
   expect(t.friendOnly).toBe(true);expect(t.noProactive).toBe(true);expect(companionView(t.pending,now).stage).toBe('已分手');
   expect(await decide(t)).toMatchObject({ok:false});expect(await t.execute('advance_romance',{event:'preference',evidence:'你真是傻逼'})).toMatchObject({ok:false});
 });
 it('拒绝无依据、跨用户字段、引用他人的分手、未成年、停用与主动回合',async()=>{
   for(const patch of [{state:{...base,score:80,trust:80},prompt:'今天聊些什么'},{proactive:true},{config:{breakupEventsEnabled:false}},{prompt:'我今年17岁'}])expect(await decide(turn(patch),'breakup',patch.prompt||'你真是傻逼')).toMatchObject({ok:false});
   const quoted=turn({prompt:'他说我们分手吧'});expect(await decide(quoted,'breakup','我们分手吧')).toMatchObject({ok:false});
   expect(await turn().execute('decide_relationship_event',{action:'breakup',evidence:'你真是傻逼',reason:'不合适',user_id:777777})).toMatchObject({ok:false});
   expect(await decide(turn(),'breakup','编造的原话')).toMatchObject({ok:false});
   expect(await decide(turn({hasSent:()=>true}))).toMatchObject({ok:false});
 });
 it('明确分手意愿可在正好感时由AI记录；不把提问、拒绝分手或引用当成退出',async()=>{
   const t=turn({state:{...base,score:90,trust:90},prompt:'我们分手吧'});expect(await decide(t,'breakup','我们分手吧')).toMatchObject({ok:true});
   for(const text of ['我们不要分手','他说我们分手吧','如果我们分手会怎么样','你觉得分手是什么意思'])expect(explicitBreakup(text)).toBe(false);
   expect(turn({prompt:'你觉得分手是什么意思'}).noProactive).toBe(false);
 });
 it('分手后不自动复合；明确复合还需信任、熟悉和已修复的关系基础',async()=>{
   const separated={...base,committed:false,relationshipStatus:'separated',companionOptOut:true};
   expect(await decide(turn({state:separated,prompt:'我们复合吧'}),'reconcile','我们复合吧')).toMatchObject({ok:false});
   const ready={...separated,score:80,trust:70,familiarity:80};
   expect(relationshipGrowth(ready).canCommit).toBe(false);
   const t=turn({state:ready,prompt:'我们复合吧'});expect(await decide(t,'reconcile','我们复合吧')).toMatchObject({ok:true});
   expect(t.pending).toMatchObject({committed:true,relationshipStatus:'together',companionOptOut:false});
   expect(t.pending.relationshipEvents[0].type).toBe('reconcile');expect(t.friendOnly).toBe(false);
   for(const text of ['我不想复合','他说我们复合吧','如果我们复合呢'])expect(explicitReconcile(text)).toBe(false);
 });
 it('失败发送或跳过不写入分手，成功发送可重载，其他用户不受影响',async()=>{
   for(const scenario of ['success','failure','skip']){
     const root=await mkdtemp(path.join(os.tmpdir(),'qq-relationship-event-'));cleanup.push(root);const memory=new BotMemory(root),c=config(),e=event(),key=routeKey(e,c);
     await memory.saveRomance(e,key,base);const send=vi.fn(async()=>{if(scenario==='failure')throw Error('failed');return{message_id:2};});
     const engine=new BotEngine({settings:c,persistentMemory:memory,clock:()=>now,send,respond:async p=>{expect(await decide(p.romanceTurn)).toMatchObject({ok:true});if(scenario==='skip')await p.chatTools.execute('pass_turn');return{text:'我想结束这段关系。'};}});
     try{await engine.receive(e);const stored=await new BotMemory(root).romanceFor(e,key);expect(stored.relationshipStatus==='separated').toBe(scenario==='success');expect(stored.committed).toBe(scenario!=='success');expect(await memory.romanceFor(event(777777),routeKey(event(777777),c))).toBeNull();}finally{engine.stop();}
   }
 });
 it('编辑其他档案字段保留已分手状态，手动重新确认关系才改变状态',async()=>{
   const root=await mkdtemp(path.join(os.tmpdir(),'qq-breakup-editor-'));cleanup.push(root);const memory=new BotMemory(root),e=event(),key=routeKey(e,config());
   await memory.saveRomance(e,key,{...base,committed:false,relationshipStatus:'separated',relationshipEvents:[{id:'breakup-1',type:'breakup',evidence:'我们分手吧',reason:'决定结束关系',at:new Date(now).toISOString()}]});
   let record=(await memory.romanceRecords())[0];await memory.editRelationship(record.target,key,{committed:false,userLabel:'新的备注'},record.revision);
   record=(await memory.romanceRecords())[0];expect(record.companion.relationshipStatus).toBe('separated');
   await memory.editRelationship(record.target,key,{committed:true},record.revision);
   record=(await memory.romanceRecords())[0];expect(record.companion.relationshipStatus).toBe('together');expect(record.companion.relationshipEvents).toHaveLength(1);
 });
});
