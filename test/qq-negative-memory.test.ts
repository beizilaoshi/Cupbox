import {describe,it,expect,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRomanceTurn,routeKey,stageFor} from '../desktop/qq/romance.js';
import {companionView} from '../desktop/qq/companion.js';
import {BotMemory} from '../desktop/qq/memory.js';
import {BotEngine} from '../desktop/qq/engine.js';
import {validateSettings} from '../desktop/qq/store.js';

const now=Date.parse('2026-10-24T12:00:00+08:00');
const config=(patch={})=>validateSettings({enabled:true,mode:'chat',companionEnabled:true,retainDialogue:true,romanceMode:'off',cooldown:0,...patch});
const event=(text='你真是废物',patch={})=>({post_type:'message',message_type:'private',self_id:123456,user_id:654321,message_id:1,message:[{type:'text',data:{text}}],...patch});
const turn=(patch:any={})=>createRomanceTurn({config:config(),event:event(),prompt:'你真是废物',state:null,signal:new AbortController().signal,clock:()=>now,...patch});
const homes:string[]=[];
afterEach(async()=>{for(const home of homes.splice(0))await rm(home,{recursive:true,force:true});});
async function memory(){const home=await mkdtemp(path.join(os.tmpdir(),'qq-negative-'));homes.push(home);return{home,memory:new BotMemory(home)};}

describe('QQ 记仇与负好感',()=>{
  it('信任从零开始，可跌到负数、逐渐修复并限定在正负100',()=>{
    expect(companionView({},now).trust).toBe(0);
    expect(turn({prompt:'聊聊今天',state:null}).pending.trust).toBe(0);
    expect(turn({state:{score:0,trust:-99,steps:[]}}).pending.trust).toBe(-100);
    expect(turn({prompt:'对不起',state:{score:0,trust:-20,steps:[]}}).pending.trust).toBe(-19);
    expect(turn({prompt:'谢谢你',state:{score:0,trust:99,steps:[]}}).pending.trust).toBe(100);
    const old={score:0,trust:20,steps:[]};expect(turn({prompt:'聊聊今天',state:old}).pending.trust).toBe(20);
    expect(companionView({trust:-30},now).presence.address).toBe('你');
  });
  it('直接伤害降到负数，记录证据并影响当前语气，信任仍维持独立范围',()=>{
    const t=turn();expect(t.pending.score).toBe(-5);expect(t.pending.trust).toBe(-2);
    expect(t.pending.negativeMemories).toMatchObject([{kind:'harsh_words',evidence:'你真是废物',status:'active'}]);
    expect(companionView(t.pending,now)).toMatchObject({score:-5,stage:'疏远'});expect(t.system).toContain('本人负面记忆');
    expect(turn({state:{score:-99,steps:[]}}).pending.score).toBe(-100);
    expect(stageFor({score:-20,committed:true})).toBe('戒备');expect(companionView({score:-80,committed:true}).stage).toBe('反感');
  });
  it('只在已开启的相处成长下记仇，引用、玩笑、沉默与拒绝不扣分',()=>{
    expect(turn({config:config({companionEnabled:false})}).pending).toBeNull();
    for(const prompt of ['他说你真是废物','有人骂你是废物','你这代码写得垃圾','你真是废物，开玩笑的','我不要和你恋爱','你好','']){
      const t=turn({prompt,state:{score:0,steps:[]}});expect(t.pending.score).toBeGreaterThanOrEqual(0);expect(t.pending.negativeMemories||[]).toHaveLength(0);
    }
    const t=turn();expect(companionView(t.pending,now+7*86400000).score).toBe(-5);expect(companionView(t.pending,now+7*86400000).negativeMemories).toHaveLength(1);
    expect(turn({proactive:true}).pending.score).toBe(0);
  });
  it('每轮仅扣一次，有独立冷却与每日上限，正面上限不屏蔽负面事件',async()=>{
    const t=turn();await t.execute('record_companion_event',{event:'harsh_words',evidence:'你真是废物'});expect(t.pending.score).toBe(-5);
    expect(turn({state:t.pending,clock:()=>now+1000}).pending.score).toBe(-5);
    expect(turn({state:t.pending,clock:()=>now+31000}).pending.score).toBe(-10);
    expect(turn({state:{...t.pending,negativeDaily:6},clock:()=>now+31000}).pending.score).toBe(-5);
    expect(turn({state:{score:0,steps:[],companionDay:t.pending.companionDay,companionDaily:6}}).pending.score).toBe(-5);
    expect((await t.execute('record_companion_event',{event:'harsh_words',evidence:'编造的辱骂'})).ok).toBe(false);
  });
  it('道歉缓慢修复而不抹去原事，友好互动可以恢复分数',()=>{
    const hurt=turn().pending;
    const apology=turn({prompt:'对不起，我错了',state:hurt,clock:()=>now+31000}).pending;
    expect(apology.score).toBe(-4);expect(apology.negativeMemories[0]).toMatchObject({status:'repairing',evidence:'你真是废物',repairEvidence:'对不起，我错了'});
    expect(turn({prompt:'谢谢你',state:apology,clock:()=>now+62000}).pending.score).toBe(-2);
  });
  it('攻略模式也扣分且不能在同一轮推进亲密，负分不产生未定义场景',async()=>{
    const t=turn({config:config({romanceMode:'route'}),state:{score:-5,committed:false,steps:[]}});
    expect(t.pending.score).toBe(-10);expect(t.system).not.toContain('undefined');
    expect(await t.execute('advance_romance',{event:'care',evidence:'你真是废物'})).toMatchObject({ok:false});
    const old=turn({config:config({romanceMode:'route'}),prompt:'我们一起喝茶吧',state:{score:-20,committed:true,steps:[]}});
    await old.execute('advance_romance',{event:'shared_moment',evidence:'一起喝茶'});expect(old.pending.score).toBe(-15);
  });
  it('负面记忆最多30条，情绪关闭仍保留，重置后清除',async()=>{
    const first=turn({config:config({emotionEnabled:false})}).pending;
    const records=Array.from({length:30},(_,i)=>({...first.negativeMemories[0],id:'old-'+i}));
    const t=turn({config:config({emotionEnabled:false}),state:{...first,negativeMemories:records},clock:()=>now+31000});
    expect(t.pending.negativeMemories).toHaveLength(30);expect(t.pending.negativeMemories[0].id).toBe('old-1');
    const {memory:m,home}=await memory(),e=event(),key=routeKey(e,config());await m.saveRomance(e,key,t.pending);
    expect((await new BotMemory(home).romanceRecords())[0].companion.negativeMemories).toHaveLength(30);
    await m.resetRomance({account:'123456',kind:'private',id:'654321'},key);expect(await m.romanceFor(e,key)).toBeNull();
  });
  it('仅成功回复后存档，重启可召回，不跨用户、群、账号或角色共享',async()=>{
    for(const failure of [true,false]){
      const {memory:m,home}=await memory(),c=config(),e=event();
      const engine=new BotEngine({settings:c,persistentMemory:m,clock:()=>now,respond:async()=>({text:'这句话让我有些不舒服。'}),send:async()=>{if(failure)throw Error('delivery failed');return{message_id:9};}});
      try{await engine.receive(e);}finally{engine.stop();}
      const restored=new BotMemory(home),key=routeKey(e,c),state=await restored.romanceFor(e,key);
      if(failure){expect(state).toBeNull();continue;}
      expect(state.score).toBe(-5);expect(turn({prompt:'今天聊点什么',state,clock:()=>now+86400000}).system).toContain('你真是废物');
      for(const other of [event('',{user_id:777777}),event('',{self_id:999999}),event('',{message_type:'group',group_id:111111})])expect(await restored.romanceFor(other,routeKey(other,c))).toBeNull();
      expect(await restored.romanceFor(e,routeKey(e,{...c,persona:'other'}))).toBeNull();
    }
  });
});
