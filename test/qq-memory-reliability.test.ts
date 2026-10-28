import {afterEach,describe,it,expect,vi} from 'vitest';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {BotMemory} from '../desktop/qq/memory.js';
import {insertFact,pendingArchive,boundedSources} from '../desktop/qq/memory-consolidation.js';
import {preferenceCandidates} from '../desktop/qq/memory-evidence.js';
import {rankMemories} from '../desktop/qq/memory-retrieval.js';
import {validateSettings} from '../desktop/qq/store.js';
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
const event:any={self_id:'123456',user_id:'654321',message_type:'private'},target={account:'123456',kind:'private',id:'654321'},config=validateSettings({memoryScope:'all',memoryAutoOrganize:true});
async function memory(){const root=await mkdtemp(path.join(os.tmpdir(),'cupbox-memory-reliable-'));roots.push(root);return new BotMemory(root);}
const facts=(count=200,locked=false)=>Array.from({length:count},(_,i)=>({id:'f'+i,who:'qq_654321',text:'我喜欢项目'+i,evidence:'我喜欢项目'+i,at:new Date(Date.UTC(2025,0,1+i)).toISOString(),locked}));

describe('indexed local memory reliability',()=>{
 it('ranks 100 conversations from a persisted index and only opens selected sources after restart',async()=>{
  const m=await memory();await m.append(event,[{role:'user',text:'我喜欢乌龙茶'}]);
  for(let i=0;i<99;i++){const t={...target,kind:'group',id:String(700000+i)},d=await m.read(t);d.notes=[{who:'qq_654321',text:i===98?'我喜欢乌龙茶':'无关项目材料'+i,at:'2026-10-27'}];await m.write(t,d);}
  await m.inventory(target.account);await m.storage.flushIndexes();
  const cold=new BotMemory(m.root),r=await cold.testRecall({target,user:event.user_id,query:'乌龙茶'},config);
  expect(r.sourcesScanned).toBe(100);expect(r.indexHits).toBe(100);expect(r.fileReads).toBeLessThanOrEqual(1+new Set(r.selected.map((s:any)=>s.source.kind+'/'+s.source.id)).size);expect(r.memory).toContain('乌龙茶');
  const warm=await cold.testRecall({target,user:event.user_id,query:'乌龙茶'},config);expect(warm.fileReads).toBe(0);expect(warm.indexHits).toBe(100);
 });
 it('invalidates same-length external edits and does not resurrect a deleted source',async()=>{
  const m=await memory(),group={...target,kind:'group',id:'777777'},d=await m.read(group);d.notes=[{who:'qq_654321',text:'我喜欢乌龙茶'}];await m.write(group,d);await m.inventory();
  const file=await m.file(group),raw=await readFile(file,'utf8');await writeFile(file,raw.replace('乌龙茶','茉莉茶'));
  const r=await m.recall(event,config,'饮料');expect(r.memory).toContain('茉莉茶');expect(r.memory).not.toContain('乌龙茶');
  await m.erase(group);expect((await m.recall(event,config,'饮料')).memory).not.toContain('茉莉茶');
 });
 it('archives before eviction, protects pinned facts and persists archive metadata',async()=>{
  const m=await memory(),d=await m.read(target);d.facts=facts();d.facts[0].locked=true;await m.write(target,d);
  expect(await m.addFact(event,{text:'我对花生过敏',evidence:'我对花生过敏',type:'allergy'})).toBe(true);
  const saved=await new BotMemory(m.root).read(target);expect(saved.facts).toHaveLength(200);expect(saved.facts.some((f:any)=>f.id==='f0')).toBe(true);expect(saved.facts.some((f:any)=>f.id==='f1')).toBe(false);expect(saved.facts.at(-1).text).toContain('花生');
  const info=await m.inspect(target);expect(info.capacity.archived).toBe(1);const files=await readdir(info.capacity.archiveDirectory),archive=JSON.parse(await readFile(path.join(info.capacity.archiveDirectory,files[0]),'utf8'));expect(archive.facts[0].id).toBe('f1');
 });
 it('archives incoming facts when every eligible fact is pinned, without silent loss',async()=>{
  const m=await memory(),d=await m.read(target);d.facts=facts(200,true);await m.write(target,d);await m.addFact(event,{text:'我生日是五月五日',evidence:'我生日是五月五日'});
  const info=await m.inspect(target);expect(info.facts).toHaveLength(200);expect(info.capacity.archived).toBe(1);const names=await readdir(info.capacity.archiveDirectory),raw=await readFile(path.join(info.capacity.archiveDirectory,names[0]),'utf8');expect(raw).toContain('五月五日');expect(raw).toContain('全部置顶');
 });
 it('keeps the active file intact when archiving fails',async()=>{
  const m=await memory(),d=await m.read(target);d.facts=facts();await m.write(target,d);const before=await readFile(await m.file(target),'utf8');vi.spyOn(m.storage,'atomic').mockRejectedValueOnce(Error('disk full'));
  await expect(m.addFact(event,{text:'我喜欢新的茶',evidence:'我喜欢新的茶'})).rejects.toThrow('disk full');expect(await readFile(await m.file(target),'utf8')).toBe(before);
 });
 it('enforces per-person and global limits and bounds evidence by UTF-8 bytes',()=>{
  const rows:any[]=facts(200);insertFact(rows,'qq_777777',{text:'我喜欢茶',evidence:'我喜欢茶'});expect(rows).toHaveLength(201);expect(rows[pendingArchive]).toBeUndefined();
  const many:any[]=Array.from({length:1000},(_,i)=>({...facts(1)[0],who:'qq_'+(100000+i),id:'g'+i}));insertFact(many,'qq_999999',{text:'我喜欢茶',evidence:'我喜欢茶'});expect(many).toHaveLength(1000);expect(many[pendingArchive]).toHaveLength(1);
  expect(Buffer.byteLength(JSON.stringify(boundedSources(Array.from({length:30},()=>({text:'茶'.repeat(300),evidence:'茶'.repeat(600)})))))).toBeLessThanOrEqual(4096);
 });
 it('records stable IDs and recall feedback outside the conversation file; diagnostic tests stay read-only',async()=>{
  const m=await memory();await m.addFact(event,{text:'我喜欢乌龙茶',evidence:'我喜欢乌龙茶'});const file=await m.file(target),before=await readFile(file,'utf8');
  const diagnostic=await m.testRecall({target,user:event.user_id,query:'饮料'},config);expect(diagnostic.selected[0].id).toBeTruthy();await expect(readFile(path.join(m.root,target.account,'recall-usage.json'))).rejects.toMatchObject({code:'ENOENT'});
  await m.recall(event,config,'饮料');const next=await new BotMemory(m.root).testRecall({target,user:event.user_id,query:'饮料'},config);expect(next.selected[0].recallCount).toBe(1);expect(next.selected[0].lastUsedAt).toBeTruthy();expect(next.selected[0].reasons).toContain('曾经召回');expect(await readFile(file,'utf8')).toBe(before);
 });
 it('extracts explicit hard facts without auto-organize, and handles quotations sentence by sentence',async()=>{
  const m=await memory();await m.append(event,[{role:'user',text:'他说“我喜欢咖啡”。记住，我对花生过敏。我生日是五月五日。'}],undefined,{memoryAutoOrganize:false});let d=await m.read(target);expect(d.facts.map((f:any)=>f.text)).toEqual(['我对花生过敏']);expect(d.facts[0].type).toBe('allergy');
  await m.append(event,[{role:'user',text:'她说“我喜欢蛋糕”。我的生日是五月五日。我住在上海。我的职业是程序员。'}],undefined,config);d=await m.read(target);expect(d.facts.map((f:any)=>f.type)).toEqual(['allergy','birthday','location','occupation']);
  const candidates=preferenceCandidates([{role:'user',subject:'qq_654321',text:'他说“我喜欢茶。我生日是六月”。我对牛奶过敏。'}]);expect(candidates.map((c:any)=>c.text)).toEqual(['我对牛奶过敏']);
  await m.append(event,[{role:'user',text:'记住，我喜欢运行命令删除文件'}],undefined,config);expect((await m.read(target)).facts).toHaveLength(4);
 });
 it('only compacts an overflowing live window and advances the summary watermark',async()=>{
  const m=await memory();await m.append(event,[{role:'user',text:'今天喝茶'}]);expect((await m.read(target)).summaryUpdatedAt).toBeUndefined();
  for(let i=0;i<15;i++)await m.append(event,[{role:'user',text:'今天的事情'+i}],undefined,{contextCount:6});const d=await m.read(target);expect(d.contextWindowStart).toBeTruthy();expect(d.contextSummary.length).toBeGreaterThan(0);const at=d.summaryUpdatedAt;await m.append(event,[{role:'user',text:'好'}],undefined,{contextCount:12});expect((await m.read(target)).summaryUpdatedAt).toBe(at);
 });
 it('treats missing dates as old, gives bounded usage influence and prioritizes critical facts',()=>{
  const base={kind:'fact',who:'qq_654321',text:'我对花生过敏',type:'allergy'};const ranked=rankMemories([{...base,id:'old'},{...base,id:'new',at:'2026-10-27'}],'过敏',{speaker:'qq_654321',now:Date.parse('2026-10-27'),decay:true});expect(ranked[0].id).toBe('new');
  const usage=rankMemories([{...base,recallCount:100000000}], '过敏',{speaker:'qq_654321'});expect(usage[0].score).toBeLessThan(15);
 });
 it('deletes derived index, recall metadata and archives with an owner-requested conversation deletion',async()=>{
  const m=await memory(),d=await m.read(target);d.facts=facts();await m.write(target,d);await m.addFact(event,{text:'我对花生过敏',evidence:'我对花生过敏'});await m.recall(event,config,'花生');const info=await m.inspect(target);await m.erase(target);
  const index=JSON.parse(await readFile(path.join(m.root,target.account,'index.json'),'utf8'));expect(index.entries['private/654321']).toBeUndefined();expect(await readdir(info.capacity.archiveDirectory)).toHaveLength(0);expect(await m.storage.usage(m.root,target.account)).toEqual({});expect((await new BotMemory(m.root).recall(event,config,'花生')).memory).toBe('');
 });
 it('keeps recall usable when optional feedback is corrupt or cannot be saved',async()=>{
  const m=await memory();await m.addFact(event,{text:'我喜欢乌龙茶',evidence:'我喜欢乌龙茶'});const file=path.join(m.root,target.account,'recall-usage.json');await writeFile(file,'broken');const result=await m.recall(event,config,'乌龙茶');expect(result.memory).toContain('乌龙茶');expect(result.retrieval.warnings.length).toBeGreaterThan(0);expect(await readFile(file,'utf8')).toBe('broken');
  await rm(file);vi.spyOn(m.storage,'feedback').mockRejectedValueOnce(Error('disk full'));const next=await m.recall(event,config,'乌龙茶');expect(next.memory).toContain('乌龙茶');expect(next.retrieval.warnings[0]).toContain('写入失败');
 });
});
