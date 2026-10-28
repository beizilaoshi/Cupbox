import {readFile,writeFile,lstat,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {replaceMemoryFile} from './atomic-memory.js';
import {factId,memoryRevision} from './memory-consolidation.js';

export const memoryRowId=row=>row.id|| (row.kind==='fact'?factId(row):'row-'+memoryRevision([row.kind,row.who,row.subject,row.text,row.at]).slice(0,32));
const fingerprint=s=>`${s.mtimeMs}:${s.ctimeMs}:${s.size}`;
// Cached values are cloned: callers routinely mutate the objects returned by read().
export class MemoryStorage{
  constructor(){this.cache=new Map();this.cacheBytes=0;this.indexes=new Map();this.stats={reads:0,dataReads:0,hits:0,indexHits:0};this.sidecarWrites=Promise.resolve();}
  async read(file,maxBytes=8*1024*1024){
    const stat=await lstat(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>maxBytes)throw Error('记忆文件类型或大小异常');
    const stamp=fingerprint(stat),cached=this.cache.get(file);
    if(cached?.stamp===stamp){this.stats.hits++;this.cache.delete(file);this.cache.set(file,cached);return structuredClone(cached.data);}
    this.stats.reads++;if(/^\d+\.json$/.test(path.basename(file)))this.stats.dataReads++;const data=JSON.parse(await readFile(file,'utf8'));this.cacheBytes-=cached?.bytes||0;this.cache.set(file,{stamp,data,bytes:stat.size});this.cacheBytes+=stat.size;
    while(this.cache.size>128||this.cacheBytes>32*1024*1024){const key=this.cache.keys().next().value;this.cacheBytes-=this.cache.get(key).bytes;this.cache.delete(key);}return structuredClone(data);
  }
  async atomic(file,data){
    let dir=path.parse(file).root;
    for(const part of path.dirname(file).slice(dir.length).split(path.sep).filter(Boolean)){
      dir=path.join(dir,part);try{await mkdir(dir);}catch(e){if(e.code!=='EEXIST')throw e;}
      const s=await lstat(dir);if(s.isSymbolicLink()||!s.isDirectory())throw Error('记忆目录不能使用符号链接');
    }
    try{const s=await lstat(file);if(s.isSymbolicLink()||!s.isFile())throw Error('记忆文件类型异常');}catch(e){if(e.code!=='ENOENT')throw e;}
    const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify(data),{flag:'wx',mode:0o600});await replaceMemoryFile(tmp,file);}finally{await unlink(tmp).catch(()=>{});}
  }
  async account(root,account){
    const file=path.join(root,account,'index.json');let state=this.indexes.get(file);if(state)return state;
    let entries={};try{const data=await this.read(file,32*1024*1024);if(data.version===1&&data.entries&&typeof data.entries==='object')entries=data.entries;}catch{}
    state={file,entries,dirty:false,savedAt:0};this.indexes.set(file,state);return state;
  }
  async entry(root,target,file,read){
    const state=await this.account(root,target.account),key=target.kind+'/'+target.id,stamp=fingerprint(await lstat(file)),old=state.entries[key];
    const validRows=(rows,fact=false)=>Array.isArray(rows)&&rows.every(row=>row&&typeof row.text==='string'&&(!fact||typeof row.who==='string'));
    if(old?.stamp===stamp&&old.target?.account===target.account&&old.target?.kind===target.kind&&old.target?.id===target.id&&validRows(old.indexData?.facts,true)&&validRows(old.indexData?.notes)&&validRows(old.indexData?.turns)){this.stats.indexHits++;return structuredClone(old);}
    const data=await read(target),entry={target,stamp,turns:data.turns.length,notes:data.notes.length,facts:data.facts.length,updatedAt:data.updatedAt||'',file,indexData:{facts:data.facts,notes:data.notes,activeSession:data.activeSession,turns:data.turns.filter(t=>(t.sessionId||'legacy')===(data.activeSession||'legacy')).slice(-6)}};
    state.entries[key]=entry;state.dirty=true;return structuredClone(entry);
  }
  async flushIndexes(force=true){
    for(const state of this.indexes.values())if(state.dirty&&(force||Date.now()-state.savedAt>=1000)){
      const entries={};let bytes=100;
      for(const [key,row]of Object.entries(state.entries).sort((a,b)=>String(b[1].updatedAt).localeCompare(String(a[1].updatedAt)))){const size=Buffer.byteLength(JSON.stringify(row))+key.length+6;if(bytes+size>32*1024*1024)continue;entries[key]=row;bytes+=size;}
      const snapshot=JSON.stringify({version:1,entries});state.dirty=false;state.savedAt=Date.now();
      this.sidecarWrites=this.sidecarWrites.catch(()=>{}).then(()=>this.atomic(state.file,JSON.parse(snapshot))).catch(error=>{state.dirty=true;this.stats.indexError=error.message;});
    }await this.sidecarWrites;
  }
  async usage(root,account){
    const file=path.join(root,account,'recall-usage.json');try{
      const data=await this.read(file);if(data.version!==1||!data.rows||typeof data.rows!=='object')throw Error('Invalid recall usage');
      const rows={};for(const [key,value]of Object.entries(data.rows).slice(0,10000))if(value&&Number.isFinite(value.recallCount)&&value.recallCount>=0)Object.defineProperty(rows,key,{value:{recallCount:Math.min(1000000,Math.floor(value.recallCount)),...(Number.isFinite(Date.parse(value.lastUsedAt))?{lastUsedAt:value.lastUsedAt}:{})},enumerable:true,configurable:true,writable:true});
      delete this.stats.usageError;return rows;
    }catch(e){if(e.code==='ENOENT')delete this.stats.usageError;else this.stats.usageError='召回统计文件不可读，已跳过统计，保留原文件';return{};}
  }
  usageKey(row){return `${row.source.kind}/${row.source.id}/${memoryRowId(row)}`;}
  async feedback(root,account,selected){
    if(!selected.length)return;const rows=await this.usage(root,account),at=new Date().toISOString();if(this.stats.usageError)return;
    for(const row of selected){const key=this.usageKey(row),old=rows[key];rows[key]={recallCount:Math.min(1000000,(Number(old?.recallCount)||0)+1),lastUsedAt:at};}
    const kept=Object.fromEntries(Object.entries(rows).sort((a,b)=>String(b[1].lastUsedAt).localeCompare(String(a[1].lastUsedAt))).slice(0,10000));
    await this.atomic(path.join(root,account,'recall-usage.json'),{version:1,rows:kept});
  }
  async forget(root,target){
    const state=await this.account(root,target.account);delete state.entries[target.kind+'/'+target.id];state.dirty=true;
    const file=path.join(root,target.account,target.kind,target.id+'.json');this.cacheBytes-=this.cache.get(file)?.bytes||0;this.cache.delete(file);
    const rows=await this.usage(root,target.account),prefix=target.kind+'/'+target.id+'/';let changed=false;
    for(const key of Object.keys(rows))if(key.startsWith(prefix)){delete rows[key];changed=true;}
    if(changed)await this.atomic(path.join(root,target.account,'recall-usage.json'),{version:1,rows});
    await this.flushIndexes();
  }
}
