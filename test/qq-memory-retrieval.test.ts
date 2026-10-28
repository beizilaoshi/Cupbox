import {afterEach,describe,expect,it,vi} from 'vitest';import {mkdtemp,rm,readFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {BotMemory} from '../desktop/qq/memory.js';import {validateSettings} from '../desktop/qq/store.js';import {rankMemories,packMemories} from '../desktop/qq/memory-retrieval.js';import {estimateTokens} from '../dist/core/context.js';import {tokenClip} from '../desktop/qq/context.js';
const roots:string[]=[];afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const event:any={self_id:'123456',user_id:'654321',message_type:'private'},target={account:'123456',kind:'private',id:'654321'},c=validateSettings({memoryTools:false,memoryScope:'all'});
async function fixture(){const root=await mkdtemp(path.join(os.tmpdir(),'qq-retrieval-'));roots.push(root);return new BotMemory(root);}
const row=(text:string,extra:any={})=>({text,who:'qq_654321',kind:'note',source:target,at:'2026-10-27T00:00:00Z',...extra});
describe('local Chinese hybrid memory retrieval',()=>{
 it('retrieves category questions without shared literal words and ignores unrelated single-character noise',()=>{
  const result=rankMemories([row('我喜欢乌龙茶'),row('明天要整理文件夹'),row('文件传好了')],'喝什么饮料合适',{speaker:'qq_654321'});expect(result[0].text).toContain('乌龙茶');expect(result[0].reasons).toContain('主题扩展');expect(result.some(r=>r.text==='文件传好了')).toBe(false);
 });
 it('answers personal recall from the correct user instead of another member',async()=>{
  const m=await fixture();await m.append(event,[{role:'user',name:'qq_654321',text:'我喜欢乌龙茶'}]);await m.append({...event,user_id:'777777'},[{role:'user',name:'qq_777777',text:'我喜欢咖啡'}]);
  const result=await m.recall(event,c,'你还记得我喜欢喝什么吗');expect(result.memory).toContain('乌龙茶');expect(result.memory).not.toContain('咖啡');expect(result.retrieval.selfQuery).toBe(true);
 });
 it('recalls saved facts even when model memory-write tools are off and places them inside the budget',async()=>{
  const m=await fixture();await m.addFact(event,{text:'喜欢乌龙茶',evidence:'我喜欢乌龙茶'});await m.pinFact(target,'qq_654321','喜欢乌龙茶',true);
  for(let i=0;i<8;i++)await m.append({...event,user_id:String(700000+i)},[{role:'user',name:'qq_'+(700000+i),text:'我今天在讨论完全不同的事情'+i},{role:'assistant',text:'这是一段很长的其他聊天。'.repeat(20)}]);
  const r=await m.recall(event,c,'你记得我吗');expect(r.memory).toContain('喜欢乌龙茶');expect(r.retrieval.selected[0].kind).toBe('fact');expect(r.retrieval.estimatedTokens).toBeLessThanOrEqual(r.retrieval.budgetTokens);expect(tokenClip(r.memory,600)).toBe(r.memory);expect((await m.factsFor(event,c,'饮料'))[0].text).toBe('喜欢乌龙茶');
 });
 it('never lets old source caps omit the current conversation',async()=>{
  const m=await fixture();await m.append(event,[{role:'user',name:'qq_654321',text:'我喜欢乌龙茶'}]);vi.spyOn(m,'inventory').mockResolvedValue(Array.from({length:100},(_,i)=>({target:{account:'123456',kind:'group',id:String(800000+i)},updatedAt:'2026-10-27'})) as any);
  const r=await m.recall(event,c,'乌龙茶');expect(r.memory).toContain('乌龙茶');expect(r.retrieval.sourcesScanned).toBe(100);
 });
 it('keeps account, allowlist and legacy scopes isolated and honors memory-off',async()=>{
  const m=await fixture();await m.append(event,[{role:'user',name:'qq_654321',text:'我喜欢乌龙茶'}]);const group={...event,message_type:'group',group_id:'111111'};
  for(const patch of [{memoryScope:'conversation'},{memoryScope:'global'},{blockedUsers:['654321']},{privateEnabled:false}])expect((await m.recall(group,{...c,...patch},'饮料')).memory).not.toContain('乌龙茶');
  expect((await m.recall({...group,self_id:'999999'},c,'饮料')).memory).toBe('');expect(await m.recall(event,{...c,retainDialogue:false},'饮料')).toEqual({history:[],memory:''});
 });
 it('downranks an older opposite preference without deleting it or mixing users',()=>{
  const rows=[row('我喜欢咖啡',{at:'2026-01-01T00:00:00Z'}),row('我不喜欢咖啡',{at:'2026-10-27T00:00:00Z'}),row('我喜欢咖啡',{who:'qq_777777',at:'2026-10-28T00:00:00Z'})],r=rankMemories(rows,'我的偏好',{speaker:'qq_654321'});
  expect(r[0].text).toBe('我不喜欢咖啡');expect(r.find(r=>r.text==='我喜欢咖啡').possiblyOutdated).toBe(true);expect(rows).toHaveLength(3);expect(r.every(r=>r.who==='qq_654321')).toBe(true);
 });
 it('packs whole source-attributed entries into strict budgets rather than cutting JSON',()=>{
  const ranked=rankMemories(Array.from({length:30},(_,i)=>row('我喜欢乌龙茶。'.repeat(30),{kind:'fact',evidence:'我喜欢乌龙茶',locked:i===0})),'乌龙茶',{speaker:'qq_654321'});
  for(const budget of [300,570,1000,2400]){const r=packMemories(ranked,budget);expect(r.estimatedTokens).toBeLessThanOrEqual(budget);expect(estimateTokens(r.memory)).toBeLessThanOrEqual(budget);if(r.memory)expect(JSON.parse(r.memory).记录[0].speaker_id).toBe('qq_654321');expect(r.selected.length).toBeLessThanOrEqual(4);}
 });
 it('provides a read-only scoped diagnostic and rejects invalid test identities',async()=>{
  const m=await fixture();await m.append(event,[{role:'user',name:'qq_654321',text:'我喜欢乌龙茶'}]);const file=await m.file(target),before=await readFile(file,'utf8');const r=await m.testRecall({target,user:'654321',query:'我爱喝什么'},c);expect(r.selected[0].text).toContain('乌龙茶');expect(r.sourcesScanned).toBe(1);expect(await readFile(file,'utf8')).toBe(before);
  await expect(m.testRecall({target,user:'777777',query:'饮料'},c)).rejects.toThrow();await expect(m.testRecall({target:{...target,id:'../bad'},user:'654321',query:'饮料'},c)).rejects.toThrow();expect(()=>validateSettings({memoryRecallMode:'unknown'})).toThrow();
 });
 it('can fall back to original keyword behavior without migrating or editing files',async()=>{
  const m=await fixture();await m.append(event,[{role:'user',name:'qq_654321',text:'我喜欢乌龙茶'}]);const before=await readFile(await m.file(target),'utf8');const old=await m.recall(event,{...c,memoryRecallMode:'keyword'},'乌龙茶');expect(old.memory).toContain('乌龙茶');expect(old.retrieval).toBeUndefined();expect(await readFile(await m.file(target),'utf8')).toBe(before);
 });
});
