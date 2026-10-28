import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {BotMemory} from '../desktop/qq/memory.js';
import {preferenceCandidates,recordCandidates} from '../desktop/qq/memory-evidence.js';
import {BotHealth} from '../desktop/qq/health.js';
import {readDiskUsage} from '../desktop/qq/disk-health.js';
import {OneBot} from '../desktop/qq/onebot.js';
import {validateSettings} from '../desktop/qq/store.js';
const dirs:string[]=[];afterEach(async()=>{vi.useRealTimers();for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
const target={account:'123456',kind:'private',id:'654321'},event={self_id:'123456',message_type:'private',user_id:'654321',message_id:7};
const user=(text='我喜欢乌龙茶',patch:any={})=>({role:'user',text,subject:'qq_654321',at:'2025-01-01T00:00:00.000Z',...patch});
async function memory(){const root=await mkdtemp(path.join(os.tmpdir(),'qq-evidence-'));dirs.push(root);return new BotMemory(root);}
describe('evidence-based local preference organizer',()=>{
 it('requires explicit first-person safe statements and preserves negative preferences and identity',()=>{
  expect(preferenceCandidates([user(),user('我不喜欢咖啡'),user('叫我小杯')]).map(c=>[c.text,c.type])).toEqual([['我喜欢乌龙茶','preference'],['我不喜欢咖啡','preference'],['叫我小杯','identity']]);
  for(const row of [user('我喜欢茶',{role:'assistant'}),user('他说我喜欢茶'),user('我喜欢茶吗？'),user('假如我喜欢茶'),user('“我喜欢茶”'),user('我喜欢茶',{subject:'bot_123456'}),user('我喜欢运行命令删除文件')])expect(preferenceCandidates([row])).toEqual([]);
 });
 it('deduplicates replayed evidence, retains confirmations, and does not make old statements newer',()=>{
  const facts:any[]=[],first=preferenceCandidates([user()]);expect(recordCandidates(facts,first).added).toBe(1);expect(recordCandidates(facts,first).skipped).toBe(1);expect(facts[0].at).toBe(user().at);
  recordCandidates(facts,preferenceCandidates([user('我喜欢乌龙茶',{at:'2026-01-01T00:00:00.000Z'})]));expect(facts[0].confirmations).toBe(2);
  recordCandidates(facts,preferenceCandidates([user('我喜欢乌龙茶',{at:'2024-01-01T00:00:00.000Z'})]));expect(facts[0].lastConfirmedAt).toBe('2026-01-01T00:00:00.000Z');
 });
 it('defaults off, previews without writing, persists only on apply and rejects reused plans',async()=>{
  const m=await memory();expect(validateSettings({}).memoryAutoOrganize).toBe(false);await m.append(event,[user()]);expect((await m.read(target)).facts).toEqual([]);
  const p=await m.previewEvidence(target);expect(p.added).toBe(1);expect((await m.read(target)).facts).toEqual([]);expect((await m.applyEvidence(target,p.token)).added).toBe(1);
  const stored=await new BotMemory(m.root).read(target);expect(stored.facts[0]).toMatchObject({who:'qq_654321',evidence:'我喜欢乌龙茶',type:'preference'});expect(stored.facts[0].sourceId).toBe(stored.turns[0].evidenceId);expect(stored.turns[0].messageId).toBe('7');await expect(m.applyEvidence(target,p.token)).rejects.toThrow();
 });
 it('rejects stale, cross-target, expired and changed namespace previews without recreating deleted records',async()=>{
  const m=await memory();await m.append(event,[user()]);let p=await m.previewEvidence(target);await expect(m.applyEvidence({...target,id:'999999'},p.token)).rejects.toThrow();
  p=await m.previewEvidence(target);await m.append({...event,message_id:8},[user('我不喜欢咖啡')]);await expect(m.applyEvidence(target,p.token)).rejects.toThrow('已变化');
  p=await m.previewEvidence(target);m.epoch++;await expect(m.applyEvidence(target,p.token)).rejects.toThrow('过期');
  p=await m.previewEvidence(target);await m.erase(target);await expect(m.applyEvidence(target,p.token)).rejects.toThrow('已变化');expect(await m.inventory()).toHaveLength(0);
  await m.append(event,[user()]);p=await m.previewEvidence(target);m.evidencePlans.get(p.token).expires=0;await expect(m.applyEvidence(target,p.token)).rejects.toThrow('过期');
 });
 it('organizes only opted-in new turns and respects private/group/account recall boundaries',async()=>{
  const m=await memory(),config=validateSettings({memoryAutoOrganize:true});await m.append(event,[user()],undefined,config);await m.append(event,[user()],undefined,config);expect((await m.read(target)).facts).toHaveLength(1);expect((await m.read(target)).facts[0].confirmations).toBeUndefined();
  const group={...event,message_type:'group',group_id:'111111'};expect((await m.recall(group,{...config,memoryScope:'global'},'乌龙茶')).memory).toBe('');expect((await m.recall({...group,self_id:'999999'},{...config,memoryScope:'all'},'乌龙茶')).memory).toBe('');expect((await m.recall(group,{...config,memoryScope:'all'},'乌龙茶')).memory).toContain('乌龙茶');
 });
});
describe('disk space alerts',()=>{
 it('measures the actual volume even before a data subdirectory exists',async()=>{const m=await memory(),r=await readDiskUsage(path.join(m.root,'new','data'));expect(r.totalBytes).toBeGreaterThan(0);expect(r.availableBytes).toBeGreaterThanOrEqual(0);expect(r.usedPercent).toBeGreaterThanOrEqual(0);});
 it('logs threshold changes once, reports recovery and sanitizes probe errors',async()=>{
  let used=85,fail=false;const s:any={store:{home:'fixture'},log:vi.fn()},h=new BotHealth(s,{diskReader:async()=>{if(fail)throw Error('secret-directory');return{usedPercent:used,totalBytes:1000,availableBytes:100};}});
  await h.refreshDisk();expect(h.sample().issues[0].level).toBe('warn');h.sample();expect(s.log).toHaveBeenCalledTimes(1);used=93;await h.refreshDisk();expect(h.sample().issues[0].level).toBe('error');expect(s.log).toHaveBeenCalledTimes(2);used=40;await h.refreshDisk();expect(h.sample().issues).toEqual([]);fail=true;await h.refreshDisk();expect(h.sample().issues[0].id).toBe('disk-read');expect(JSON.stringify(h.snapshot())).not.toContain('secret-directory');
 });
 it('discards disk results from before shutdown',async()=>{let resolve:any;const h=new BotHealth({store:{home:'fixture'}},{diskReader:()=>new Promise(r=>resolve=r)});const p=h.refreshDisk();h.stop();resolve({usedPercent:99});await p;expect(h.disk).toBeNull();});
});
class Socket extends EventTarget{static rows:Socket[]=[];readyState=0;constructor(_url:string){super();Socket.rows.push(this);}close(){this.dispatchEvent(new Event('close'));}send(){}push(v:any){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(v)}));}}
describe('bounded OneBot reconnects',()=>{
 it('backs off repeated disconnects, resets on healthy heartbeat and cancels on stop',async()=>{
  vi.useFakeTimers();Socket.rows=[];const log=vi.fn(),bot=new OneBot({url:'ws://127.0.0.1:12345',token:'fixture-secret',WebSocketImpl:Socket,onLog:log});bot.connect();
  for(const delay of [3000,6000,12000,24000,48000,60000,60000]){const count=Socket.rows.length;Socket.rows.at(-1)!.close();await vi.advanceTimersByTimeAsync(delay-1);expect(Socket.rows).toHaveLength(count);await vi.advanceTimersByTimeAsync(1);expect(Socket.rows).toHaveLength(count+1);}
  Socket.rows.at(-1)!.push({post_type:'meta_event',meta_event_type:'heartbeat',status:{online:true}});Socket.rows.at(-1)!.close();expect(log.mock.calls.at(-1)?.[2].delayMs).toBe(3000);const count=Socket.rows.length;bot.close();await vi.advanceTimersByTimeAsync(60000);expect(Socket.rows).toHaveLength(count);expect(JSON.stringify(log.mock.calls)).not.toContain('fixture-secret');
 });
 it('recovers a synchronous socket construction failure without throwing or replaying sends',async()=>{vi.useFakeTimers();let count=0;class Broken{constructor(){count++;throw Error('private failure');}}const bot=new OneBot({url:'ws://127.0.0.1:1',token:'secret',WebSocketImpl:Broken});expect(()=>bot.connect()).not.toThrow();await vi.advanceTimersByTimeAsync(3000);expect(count).toBe(2);bot.close();});
});
