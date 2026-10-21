import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {BotMemory} from '../desktop/qq/memory.js';
import {BotEngine} from '../desktop/qq/engine.js';
import {DEFAULTS} from '../desktop/qq/store.js';
const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
async function store(){const root=await mkdtemp(path.join(os.tmpdir(),'qq-memory-'));dirs.push(root);return new BotMemory(root);}
const event=(group=111111,account=123456):any=>({post_type:'message',message_type:'group',self_id:account,user_id:654321,group_id:group,message_id:1,message:[{type:'at',data:{qq:account}},{type:'text',data:{text:'我喜欢乌龙茶，请记住'}}]});
const turns=[{role:'user',text:'我喜欢乌龙茶，请记住',name:'qq_654321',sender:{qq:'654321',nickname:'小鱼'}},{role:'assistant',text:'好，记住了。'}];
describe('QQ durable automatic memory',()=>{
  it('survives a new store and engine after stop, with QQ identity separate from body',async()=>{
    const memory=await store(),send=vi.fn(async()=>{}),respond=vi.fn(async()=>({text:'记住了。'}));const c={...DEFAULTS,enabled:true,globalMemory:false};let engine=new BotEngine({settings:c,persistentMemory:memory,send,respond});await engine.receive(event());engine.stop();
    const again=new BotMemory(memory.root);engine=new BotEngine({settings:c,persistentMemory:again,send,respond});await engine.receive({...event(),message_id:2});const p=respond.mock.calls[1][0];expect(p.history[0]).toMatchObject({text:turns[0].text,name:'qq_654321'});expect(p.system).toContain('乌龙茶');expect(p.prompt).not.toContain('654321');engine.stop();
    const list=await memory.inventory();expect(list).toHaveLength(1);expect(list[0].file.startsWith(memory.root)).toBe(true);expect(JSON.parse(await readFile(list[0].file,'utf8')).turns[0].sender.qq).toBe('654321');
  });
  it('isolates groups, private chats and accounts; global mode shares relevant notes only',async()=>{
    const m=await store();await m.append(event(),turns);const query='我喜欢乌龙茶';expect((await m.recall(event(222222),DEFAULTS,query)).memory).toBe('');const shared=await m.recall(event(222222),{...DEFAULTS,memoryScope:'global'},query);expect(shared.memory).toContain('乌龙茶');expect(shared.history).toEqual([]);
    expect((await m.recall(event(222222,999999),{...DEFAULTS,memoryScope:'global'},query)).memory).toBe('');expect((await m.recall({...event(),message_type:'private'},{...DEFAULTS},query)).memory).toBe('');
    expect((await m.recall(event(222222),{...DEFAULTS,memoryScope:'global',groupPolicy:'block',blockedGroups:['111111']},query)).memory).toBe('');
  });
  it('turning memory off preserves files and re-enabling restores them',async()=>{
    const m=await store();await m.append(event(),turns);expect(await m.recall(event(),{...DEFAULTS,retainDialogue:false},'乌龙茶')).toEqual({history:[],memory:''});expect((await m.inventory())[0].turns).toBe(2);expect((await m.recall(event(),DEFAULTS,'乌龙茶')).history).toHaveLength(2);
  });
  it('deletion cannot be undone by a stale in-flight append and affects only selected record',async()=>{
    const m=await store();await m.append(event(),turns);await m.append(event(222222),turns);const epoch=m.epoch;await m.erase({kind:'group',id:'111111',account:'123456'});await m.append(event(),turns,epoch);const rows=await m.inventory();expect(rows.map(r=>r.target.id)).toEqual(['222222']);await m.append(event(222222),turns,epoch);expect((await m.read({account:'123456',kind:'group',id:'222222'})).turns).toHaveLength(4);await m.append(event(),turns);expect((await m.inventory()).length).toBe(2);
  });
  it('manual editing survives reopen without overwriting another group',async()=>{
    const m=await store();await m.append(event(),turns);const target={account:'123456',kind:'group',id:'111111'};await m.edit(target,'下次聊旅行计划');const result=await new BotMemory(m.root).inspect(target);expect(result.text).toBe('下次聊旅行计划');expect(result.turns).toBe(2);
    await expect(m.inspect({...target,id:'../bad'})).rejects.toThrow('有效');const rows=await m.inventory();await writeFile(rows[0].file,'broken');await expect(m.append(event(),turns)).rejects.toThrow('不会覆盖');expect(await readFile(rows[0].file,'utf8')).toBe('broken');
  });
});
