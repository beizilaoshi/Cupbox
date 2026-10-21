import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {ChatScheduler} from '../desktop/qq/scheduler.js';
import {BotEngine} from '../desktop/qq/engine.js';
import {BotMemory} from '../desktop/qq/memory.js';
import {createChatTools} from '../desktop/qq/chat-tools.js';
import {validateSettings} from '../desktop/qq/store.js';
import {risksFor} from '../desktop/qq/risks.js';
const cleanups:(()=>any)[]=[];afterEach(async()=>{vi.useRealTimers();for(const fn of cleanups.splice(0))await fn();});
const message=(text='今天好累',id=1,user=654321,at=false,group=111111):any=>({post_type:'message',message_type:'group',self_id:123456,user_id:user,group_id:group,message_id:id,message:[...(at?[{type:'at',data:{qq:123456}}]:[]),{type:'text',data:{text}}]});
const config=(extra:any={})=>validateSettings({enabled:true,globalMemory:false,naturalConversation:true,mergeMessages:true,listenContext:true,proactiveEnabled:true,proactiveGroups:['111111'],proactiveDelay:3,proactiveBatch:3,proactiveCooldown:30,...extra});
describe('companion scheduling boundaries',()=>{
  it('merges only the same speaker and preserves a real @ when following fragments lack @',async()=>{
    vi.useFakeTimers();const c=config({proactiveEnabled:false}),engine={generation:0,receive:vi.fn(async()=>({sent:true}))},scheduler=new ChatScheduler({engine,settings:()=>c});await scheduler.receive(message('先等等',1,654321,true));await scheduler.receive(message('我还没说完',2));await scheduler.receive(message('别人的话',3,777777));expect(engine.receive).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(1200);expect(engine.receive).toHaveBeenCalledTimes(2);const merged=engine.receive.mock.calls[1][0];expect(merged.user_id).toBe(654321);expect(merged.message.find(s=>s.type==='text').data.text).toBe('先等等\n我还没说完');expect(merged.message.some(s=>s.type==='at')).toBe(true);scheduler.stop();
  });
  it('batches ambient messages once, enforces its cooldown and still allows direct @',async()=>{
    vi.useFakeTimers();const c=config({mergeMessages:false}),engine={generation:0,receive:vi.fn(async()=>({sent:true}))},scheduler=new ChatScheduler({engine,settings:()=>c});for(let i=1;i<=3;i++)await scheduler.receive(message('旁听'+i,i));expect(engine.receive.mock.calls.filter(c=>c[1]?.proactive)).toHaveLength(1);for(let i=4;i<=6;i++)await scheduler.receive(message('旁听'+i,i));expect(engine.receive.mock.calls.filter(c=>c[1]?.proactive)).toHaveLength(1);await scheduler.receive(message('叫你呢',7,654321,true));expect(engine.receive.mock.calls.at(-1)[1]).toBeUndefined();scheduler.stop();
  });
  it('does not schedule excluded groups or private messages; changes and stop invalidate delayed work',async()=>{
    vi.useFakeTimers();let c=config({groupPolicy:'block',blockedGroups:['111111']}),engine={generation:0,receive:vi.fn(async()=>({sent:true}))},scheduler=new ChatScheduler({engine,settings:()=>c});await scheduler.receive(message());expect(scheduler.pending.size).toBe(0);c=config();await scheduler.receive(message('a',2));expect(scheduler.pending.size).toBe(1);engine.generation++;await vi.advanceTimersByTimeAsync(3000);expect(engine.receive.mock.calls.filter(c=>c[1]?.proactive)).toHaveLength(0);await scheduler.receive(message('b',3));scheduler.stop();await vi.advanceTimersByTimeAsync(3000);expect(scheduler.pending.size).toBe(0);
  });
  it('never accepts event-supplied flags as authorization and skips without sending text or fallback emojis',async()=>{
    const send=vi.fn(),respond=vi.fn(async(p:any)=>{expect(p.system).toContain('主动插话判断');await p.chatTools.execute('pass_turn');return{text:'这句话不能发出去'};}),engine=new BotEngine({settings:config(),send,respond,clock:()=>100000});const e=message();e.proactive=true;e.cupbox_force=true;expect((await engine.receive(e)).collected).toBe(true);expect(respond).not.toHaveBeenCalled();expect(await engine.receive(e,{proactive:true})).toMatchObject({sent:false,skipped:'模型选择保持安静'});expect(send).not.toHaveBeenCalled();engine.stop();
  });
  it('requires explicit scope and disclosure for proactive mode and preserves off-by-default migration',()=>{
    expect(validateSettings({}).proactiveEnabled).toBe(false);expect(()=>config({listenContext:false})).toThrow('旁听');expect(()=>config({proactiveGroups:[]})).toThrow('名单');expect(()=>config({mode:'work'})).toThrow('聊天模式');const c=config({memoryTools:true});const risks=risksFor(validateSettings({enabled:true}),c);expect(risks.some(r=>r.code==='proactive')).toBe(true);expect(risks.some(r=>r.code==='memoryTools')).toBe(true);
  });
  it('a direct @ cancels an unfinished proactive thought and is not swallowed by its cooldown',async()=>{
    const send=vi.fn(async()=>({message_id:10}));let ready:()=>void;const started=new Promise<void>(resolve=>{ready=resolve;});const respond=vi.fn(async(p:any)=>{if(!p.proactive)return{text:'我在，什么事？'};ready();await new Promise((_resolve,reject)=>p.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));return{text:'不该发出的插话'};});const engine=new BotEngine({settings:config({mergeMessages:false}),send,respond,clock:()=>100000});await engine.receive(message());const ambient=engine.receive(message(),{proactive:true});await started;const direct=engine.receive(message('叫你呢',2,654321,true));await ambient;expect(await direct).toMatchObject({sent:true});expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][1][0].data.text).toBe('我在，什么事？');engine.stop();
  });
});
describe('grounded scoped preference tools',()=>{
  async function fixture(){const root=await mkdtemp(path.join(os.tmpdir(),'qq-companion-'));cleanups.push(()=>rm(root,{recursive:true,force:true}));const memory=new BotMemory(root),event=message(),c=config({memoryTools:true}),signal=new AbortController().signal;const tools=createChatTools({config:c,event,prompt:'我喜欢乌龙茶，不喜欢咖啡。',memory,epoch:memory.epochFor(event),signal});return{memory,event,c,tools,root};}
  it('stores evidence and speaker separately, survives reload, respects sharing and can remove a fact',async()=>{
    const {memory,event,c,tools,root}=await fixture();expect(await tools.execute('update_memo',{text:'喜欢乌龙茶',evidence:'我喜欢乌龙茶'})).toMatchObject({ok:true,status:'saved'});const restarted=new BotMemory(root),facts=await restarted.factsFor(event,c,'乌龙茶');expect(facts[0]).toMatchObject({who:'qq_654321',text:'喜欢乌龙茶',evidence:'我喜欢乌龙茶'});expect(await restarted.factsFor({...event,group_id:222222},c,'茶')).toHaveLength(0);expect(await restarted.factsFor({...event,group_id:222222},{...c,memoryScope:'global'},'茶')).toHaveLength(1);expect(await restarted.factsFor({...event,self_id:999999},{...c,memoryScope:'global'},'茶')).toHaveLength(0);const target={account:'123456',kind:'group',id:'111111'};await restarted.forgetFact(target,'qq_654321','喜欢乌龙茶');expect(await restarted.factsFor(event,c,'茶')).toHaveLength(0);
  });
  it('rejects invented evidence and secrets, limits per-turn writes, and cannot resurrect deleted records',async()=>{
    const {memory,event,c,tools}=await fixture();expect((await tools.execute('update_memo',{text:'喜欢旅行',evidence:'我喜欢旅行'})).ok).toBe(false);expect((await tools.execute('update_memo',{text:'密码abc',evidence:'我喜欢乌龙茶'})).ok).toBe(false);await tools.execute('update_memo',{text:'喜欢茶',evidence:'我喜欢乌龙茶'});await tools.execute('update_memo',{text:'不喜欢咖啡',evidence:'不喜欢咖啡'});expect((await tools.execute('update_memo',{text:'第三条',evidence:'不喜欢咖啡'})).ok).toBe(false);await memory.erase({account:'123456',kind:'group',id:'111111'});const stale=createChatTools({config:c,event,prompt:'我喜欢茶',memory,epoch:0,signal:new AbortController().signal});expect((await stale.execute('update_memo',{text:'茶',evidence:'我喜欢茶'})).ok).toBe(false);expect(await memory.inventory()).toHaveLength(0);
  });
  it('does not allow skip after real output, and uses an actual clock tool',async()=>{
    const {c}=await fixture();const tools=createChatTools({config:c,event:message(),prompt:'',signal:new AbortController().signal,hasSent:()=>true});expect((await tools.execute('pass_turn')).ok).toBe(false);expect(tools.skipped).toBe(false);expect(await tools.execute('get_datetime')).toMatchObject({ok:true,timezone:'Asia/Shanghai'});
  });
});
