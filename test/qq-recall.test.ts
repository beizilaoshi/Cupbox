import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {ChatInbox} from '../desktop/qq/chat-tools.js';
import {ChatScheduler} from '../desktop/qq/scheduler.js';
import {QQService} from '../desktop/qq/service.js';
import {validateSettings} from '../desktop/qq/store.js';
import {BotMemory} from '../desktop/qq/memory.js';

const account=123456,group=111111,user=654321;
const message=(text:string,id:number,from=user,room=group)=>({post_type:'message',message_type:'group',self_id:account,group_id:room,user_id:from,message_id:id,message:[{type:'text',data:{text}}]});
const recall=(id:number,from=user,room=group)=>({post_type:'notice',notice_type:'group_recall',self_id:account,group_id:room,user_id:from,operator_id:from,message_id:id});
const cleanups:(()=>Promise<void>|void)[]=[];
afterEach(async()=>{vi.useRealTimers();for(const cleanup of cleanups.splice(0))await cleanup();});

describe('OneBot message recall awareness',()=>{
 it('tombstones only the matching speaker and room, then rejects quote of recalled id',()=>{
  const inbox=new ChatInbox();const e=message('明天十点',7);
  inbox.observe(e,{collect:true,text:'明天十点'});
  inbox.observe(message('隔壁消息',7,user,222222),{collect:true,text:'隔壁消息'});
  expect(inbox.recall(recall(7,777777))).toBe(false);
  expect(inbox.recall(recall(7))).toBe(true);
  expect(inbox.known(e,7)).toBe(false);
  expect(inbox.recent(e)[0]).toMatchObject({text:'[消息已撤回]',recalled:true,speaker:String(user)});
  expect(inbox.recent(message('',8,user,222222))[0].text).toBe('隔壁消息');
 });
 it('drops a buffered message when its actual OneBot message is recalled',async()=>{
  vi.useFakeTimers();const c=validateSettings({enabled:true,naturalConversation:true,listenContext:true,mergeMessages:true,mergeDelay:5000});
  const engine={generation:0,receive:vi.fn(async()=>({sent:true})),rule:()=>({collect:true,reply:true})};
  const scheduler=new ChatScheduler({engine,settings:()=>c});
  await scheduler.receive(message('别发这句',7));
  expect(scheduler.recall(recall(7))).toBe(1);
  await vi.advanceTimersByTimeAsync(5100);
  expect(engine.receive).not.toHaveBeenCalled();
  scheduler.stop();vi.useRealTimers();
 });
 it('handles a scoped recall notice without asking the model or sending QQ text',async()=>{
  const home=await mkdtemp(path.join(os.tmpdir(),'qq-recall-'));cleanups.push(()=>rm(home,{recursive:true,force:true}));
  const respond=vi.fn(async()=>({text:'收到'}));
  const service=await new QQService({home,choices:{records:async()=>({all:[]})},respond}).init();
  cleanups.unshift(async()=>{service.background.dispose();await service.stop();});
  service.config=validateSettings({enabled:true,retainDialogue:false,globalMemory:false,naturalConversation:true,listenContext:true,contextCount:12});
  service.engine.update(service.config);service.started=true;
  await service.receive(message('明天十点',7));
  expect(service.engine.inbox.known(message('',8),7)).toBe(true);
  expect(service.engine.histories.get('group:'+group)?.[0].text).toBe('明天十点');
  const result=await service.receive(recall(7));
  expect(result).toMatchObject({recalled:true});
  expect(service.engine.inbox.known(message('',8),7)).toBe(false);
  expect(service.engine.histories.get('group:'+group)?.[0].text).toBe('[消息已撤回]');
  expect(respond).not.toHaveBeenCalled();
 });
 it('redacts an already saved message and its automatic note, without changing another speaker',async()=>{
  const home=await mkdtemp(path.join(os.tmpdir(),'qq-recall-memory-'));cleanups.push(()=>rm(home,{recursive:true,force:true}));
  const memory=new BotMemory(home),c=validateSettings({enabled:true,retainDialogue:true,listenContext:true});
  await memory.append(message('我的生日是九月八日',7),[{role:'user',text:'我的生日是九月八日'}],undefined,c);
  await memory.append(message('他喜欢咖啡',7,777777),[{role:'user',text:'他喜欢咖啡'}],undefined,c);
  expect(await memory.recallMessage(recall(7,777777))).toBe(true);
  const data=await memory.read({account:String(account),kind:'group',id:String(group)});
  expect(data.turns.find(t=>t.subject==='qq_777777')?.text).toBe('[消息已撤回]');
  expect(data.turns.find(t=>t.subject==='qq_'+user)?.text).toBe('我的生日是九月八日');
  expect(data.notes.some(n=>n.text==='他喜欢咖啡')).toBe(false);
 });
 it('removes an automatic fact that only came from the withdrawn message',async()=>{
  const home=await mkdtemp(path.join(os.tmpdir(),'qq-recall-fact-'));cleanups.push(()=>rm(home,{recursive:true,force:true}));
  const memory=new BotMemory(home),c=validateSettings({enabled:true,retainDialogue:true,listenContext:true});
  await memory.append(message('记住我喜欢咖啡',9),[{role:'user',text:'记住我喜欢咖啡'}],undefined,c);
  const target={account:String(account),kind:'group',id:String(group)} as const;
  expect((await memory.read(target)).facts.some(f=>f.text.includes('咖啡'))).toBe(true);
  await memory.recallMessage(recall(9));
  expect((await memory.read(target)).facts.some(f=>f.text.includes('咖啡'))).toBe(false);
 });
 it('works in the main app customer mode even when group @ replies are disabled',async()=>{
  const home=await mkdtemp(path.join(os.tmpdir(),'qq-recall-customer-'));cleanups.push(()=>rm(home,{recursive:true,force:true}));
  const service=await new QQService({home,customerService:true,choices:{records:async()=>({all:[]})}}).init();
  cleanups.unshift(async()=>{service.customer.dispose();await service.stop();});
  service.config=validateSettings({customerService:true,enabled:true,groupAt:false,listenContext:false});service.engine.update(service.config);
  await service.autoMemory.append(message('旧报价是十元',12),[{role:'user',text:'旧报价是十元'}]);
  expect(await service.receive(recall(12))).toMatchObject({recalled:true});
  expect((await service.autoMemory.read({account:String(account),kind:'group',id:String(group)})).turns[0].text).toBe('[消息已撤回]');
 });
});
