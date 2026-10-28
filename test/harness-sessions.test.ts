import { describe,it,expect,beforeEach,afterEach } from 'vitest';
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import { zstdCompressSync } from 'node:zlib';
import path from 'node:path';
import os from 'node:os';
import { listHarnessSessions } from '../desktop/harness-sessions.js';

let temp:string,home:string;
beforeEach(async()=>{temp=await mkdtemp(path.join(os.tmpdir(),'cupbox-hs-'));home=path.join(temp,'data');});
afterEach(async()=>{await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});

function sessionHeader(id:string,createdAt:number,cwd='E:\\work'){
  return JSON.stringify({type:'session',version:4,id,createdAt,cwd,isSeeded:false,delegationDepth:0,agentPreset:'standard'})+'\n';
}
async function putSession(id:string,createdAt:number,slug='proj'){
  const dir=path.join(home,'harness','sessions',slug,id);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'session.v4.jsonl.zstd'),zstdCompressSync(Buffer.from(sessionHeader(id,createdAt))));
}
async function putCache(id:string,rows:any){
  const dir=path.join(home,'harness','storages','session_projcache','sessions');
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,id+'.json'),JSON.stringify({version:7,record:{identity:{formatVersion:4,createdAt:1,cwd:'E:\\work'},rows}}));
}
function rows({title=null,prompt=null,lastPromptAt=null,turns=1}={}){
  return{
    title:{val:title},
    titleInput:{val:{first:prompt?{seq:1,text:prompt}:null,count:0,lastSeq:null}},
    sessionListMetadata:{val:{blank:false,lastPromptAt}},
    turnOutline:{val:{turns:Array.from({length:turns},(_,i)=>({turn:i+1,seq:i*2+1,prompt:`第 ${i+1} 轮`,response:''})),draft:''}},
    sessionStats:{val:{turns}},
  };
}

describe('harness session listing',()=>{
  it('does not mistake a multi-frame durable task for an empty header when its projection cache is absent',async()=>{
    await putSession('session-cold',1000);const file=path.join(home,'harness/sessions/proj/session-cold/session.v4.jsonl.zstd');
    const {appendFile}=await import('node:fs/promises');await appendFile(file,zstdCompressSync(Buffer.from(JSON.stringify({type:'user/message',text:'task'})+'\n')));
    const [task]=await listHarnessSessions(home);expect(task).toMatchObject({id:'session-cold',blank:false,title:'未命名任务'});
  });
  it('reads only the header when later frames expand beyond the metadata output limit',async()=>{
    await putSession('session-large',1000);const {appendFile}=await import('node:fs/promises');
    await appendFile(path.join(home,'harness/sessions/proj/session-large/session.v4.jsonl.zstd'),zstdCompressSync(Buffer.from(JSON.stringify({type:'user/message',text:'large '.repeat(100000)})+'\n')));
    expect((await listHarnessSessions(home))[0].id).toBe('session-large');
  });
  it('refreshes changed metadata and keeps cached results isolated from callers and other accounts',async()=>{
    await putSession('session-a',1000);await putCache('session-a',rows({title:'First',lastPromptAt:1200}));
    const first=await listHarnessSessions(home);first[0].title='caller mutation';
    expect((await listHarnessSessions(home))[0].title).toBe('First');
    await putCache('session-a',rows({title:'Updated title',lastPromptAt:2200}));expect((await listHarnessSessions(home))[0].title).toBe('Updated title');
    expect(await listHarnessSessions(path.join(temp,'other-account'))).toEqual([]);
  });
  it('returns cached titles, turn counts and metadata, newest first',async()=>{
    await putSession('session-old',1000);
    await putCache('session-old',rows({title:'旧任务',lastPromptAt:1000,turns:2}));
    await putSession('session-new',2000);
    await putCache('session-new',rows({title:'新任务',lastPromptAt:5000,turns:3}));
    const list=await listHarnessSessions(home);
    expect(list.map(s=>s.id)).toEqual(['session-new','session-old']);
    expect(list[0]).toMatchObject({title:'新任务',turns:3,updatedAt:5000,engine:'harness',cwd:'E:\\work'});
  });

  it('skips blank sessions and header-only leftovers',async()=>{
    await putSession('session-blank',1000);
    await putCache('session-blank',{title:{val:null},sessionListMetadata:{val:{blank:true,lastPromptAt:null}},turnOutline:{val:{turns:[]}}});
    await putSession('session-header-only',2000);
    expect(await listHarnessSessions(home)).toEqual([]);
  });

  it('falls back to the first prompt when the title is empty',async()=>{
    await putSession('session-a',1000);
    await putCache('session-a',rows({title:null,prompt:'帮我整理文件',lastPromptAt:1200}));
    const [row]=await listHarnessSessions(home);
    expect(row.title).toBe('帮我整理文件');
  });

  it('honours the limit and ignores homes without harness data',async()=>{
    for(let i=0;i<5;i++){await putSession(`session-${i}`,i);await putCache(`session-${i}`,rows({title:`任务 ${i}`,lastPromptAt:i,turns:1}));}
    expect((await listHarnessSessions(home,{limit:2})).map(s=>s.id)).toEqual(['session-4','session-3']);
    expect(await listHarnessSessions(path.join(temp,'none'))).toEqual([]);
  });

  it('does not read session files beyond the scan depth',async()=>{
    const deep=path.join(home,'harness','sessions','a','b','c','d');
    await mkdir(deep,{recursive:true});
    await writeFile(path.join(deep,'session.v4.jsonl.zstd'),zstdCompressSync(Buffer.from(sessionHeader('session-deep',1000))));
    await putSession('session-top',2000);await putCache('session-top',rows({lastPromptAt:2000}));
    expect((await listHarnessSessions(home)).map(s=>s.id)).toEqual(['session-top']);
  });
});
