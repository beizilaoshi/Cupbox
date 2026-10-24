import {afterEach,describe,expect,it,vi} from 'vitest';
import {BotEngine,parseMessage} from '../desktop/qq/engine.js';
import {QQService} from '../desktop/qq/service.js';
import {OneBot} from '../desktop/qq/onebot.js';
import {validateSettings} from '../desktop/qq/store.js';

const event=(id=1):any=>({post_type:'message',message_type:'private',self_id:123456,user_id:654321,message_id:id,message:'你好'});
const disposals:(()=>void)[]=[];
afterEach(()=>{for(const dispose of disposals.splice(0))dispose();vi.useRealTimers();});
function service(){
 const s:any=new QQService({home:'output/qq-audit-unused',choices:{}});
 s.config=validateSettings({enabled:true,visionEnabled:true});
 s.engine={generation:0};s.scheduler={receive:vi.fn(async(e:any)=>({text:parseMessage(e).text}))};s.bot={call:vi.fn()};
 return s;
}
class Socket extends EventTarget{
 static instances:Socket[]=[];readyState=0;sent:any[]=[];
 constructor(public url:string){super();Socket.instances.push(this);}
 send(value:string){this.sent.push(JSON.parse(value));}
 close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
 open(){this.readyState=1;this.dispatchEvent(new Event('open'));}
 push(value:any){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
 login(){const request=this.sent[0];this.push({echo:request.echo,status:'ok',retcode:0,data:{user_id:123456}});}
}
describe('QQ isolated lifecycle simulations',()=>{
 it('preserves string messages when vision is enabled',async()=>{
  const s=service();expect(await s.receive(event())).toEqual({text:'你好'});expect(s.bot.call).not.toHaveBeenCalled();
 });
 it('rejects invalid events and tolerates malformed message segments',async()=>{
  const s=service();expect(await s.receive(null)).toHaveProperty('skipped');
  expect(await s.receive({...event(),message:[null,42,{type:'text',data:{text:'有效文字'}}]})).toEqual({text:'有效文字'});
 });
 it('reports experimental diagnostics without pretending standard keyword selection is sufficient',async()=>{
  const s=service();s.config.emojiMode='experimental';s.log=vi.fn();s.store.emojis=async()=>[{id:'fixture',meaning:'开心',enabled:true,triggers:['你好']}];
  const result=await s.diagnoseEmoji({id:'fixture',text:'你好'});
  expect(result.reason).toContain('位置复测');expect(result.reason).toContain('不调用模型');expect(s.bot.call).not.toHaveBeenCalled();
 });
 it.each(['session','generation'])('drops old image enrichment after %s changes',async(field)=>{
  const s=service();let finish:any;s.bot.call.mockImplementation(()=>new Promise(r=>finish=r));
  const job=s.receive({...event(),message:[{type:'image',data:{file:'example.png'}}]});
  if(field==='session')s.session++;else s.engine.generation++;
  finish({url:'https://example.com/image.png'});
  expect(await job).toHaveProperty('skipped');expect(s.scheduler.receive).not.toHaveBeenCalled();
 });
 it('deduplicates messages received while an agent is waiting, even after inbox eviction',async()=>{
  const respond=vi.fn(async()=>({text:'收到'})),send=vi.fn(async()=>({message_id:900}));
  const engine=new BotEngine({settings:validateSettings({enabled:true,agentChat:true,naturalConversation:true,contextCount:1,cooldown:0}),respond,send});
  disposals.push(()=>engine.stop());const e=event();
  engine.inbox.waiters.set('123456:private:654321',new Set([()=>{}]));
  expect(await engine.receive(e)).toMatchObject({waiting:true});
  engine.inbox.waiters.clear();engine.inbox.rooms.clear();
  expect(await engine.receive(e)).toEqual({skipped:'重复事件'});expect(respond).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();
 });
 it('connect is idempotent and closed sockets cannot publish late messages or state',async()=>{
  const onEvent=vi.fn(),onState=vi.fn();Socket.instances=[];
  const bot=new OneBot({url:'ws://127.0.0.1:12345',token:'fixture',WebSocketImpl:Socket,onEvent,onState});
  disposals.push(()=>bot.close());bot.connect();bot.connect();expect(Socket.instances).toHaveLength(1);
  const old=Socket.instances[0];old.open();old.login();await Promise.resolve();bot.close();
  onState.mockClear();old.push(event());old.push({post_type:'meta_event',meta_event_type:'heartbeat',status:{online:true}});old.dispatchEvent(new Event('error'));
  expect(onEvent).not.toHaveBeenCalled();expect(onState).not.toHaveBeenCalled();expect(bot.online).toBe(false);expect(bot.self).toBeUndefined();
  bot.connect();const next=Socket.instances[1];next.open();next.login();await Promise.resolve();
  old.push(event());next.push(event(2));expect(onEvent).toHaveBeenCalledTimes(1);
 });
 it('disconnect rejects pending RPCs and reconnects once without stale socket callbacks',async()=>{
  vi.useFakeTimers();Socket.instances=[];const onState=vi.fn();
  const bot=new OneBot({url:'ws://127.0.0.1:12345',token:'fixture',WebSocketImpl:Socket,onState});disposals.push(()=>bot.close());
  bot.connect();const old=Socket.instances[0];old.open();old.login();await Promise.resolve();
  const pending=bot.call('send_private_msg');const rejected=expect(pending).rejects.toMatchObject({code:'ONEBOT_DISCONNECTED'});old.close();await rejected;
  expect(bot.pending.size).toBe(0);expect(bot.self).toBeUndefined();await vi.advanceTimersByTimeAsync(3000);
  const next=Socket.instances[1];expect(next).toBeDefined();next.open();next.login();await Promise.resolve();onState.mockClear();
  old.close();old.push({post_type:'meta_event',meta_event_type:'heartbeat',status:{online:true}});
  expect(onState).not.toHaveBeenCalled();expect(bot.socket).toBe(next);
 });
});
