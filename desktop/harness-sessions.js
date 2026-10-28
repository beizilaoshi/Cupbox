import path from 'node:path';
import {readdir,readFile,stat,open} from 'node:fs/promises';
import {zstdDecompressSync} from 'node:zlib';

const SESSION_FILE='session.v4.jsonl.zstd';
const CACHE_DIR=path.join('storages','session_projcache','sessions');
const MAX_DEPTH=3;
// Only metadata is retained. Bound memory use across accounts and invalidate on
// file replacement, including writes with the same timestamp but different size.
const metadataCache=new Map();
const CACHE_LIMIT=400;

function cleanTitle(value){
  const text=typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
  return text.slice(0,120);
}

async function sessionFiles(root){
  const found=[];
  async function walk(directory,depth){
    if(depth>MAX_DEPTH)return;
    let entries;
    try{entries=await readdir(directory,{withFileTypes:true});}catch{return;}
    for(const entry of entries){
      const full=path.join(directory,entry.name);
      if(entry.isDirectory()){await walk(full,depth+1);continue;}
      if(!entry.isFile()||entry.name!==SESSION_FILE)continue;
      let info;
      try{info=await stat(full);}catch{continue;}
      found.push({file:full,id:path.basename(path.dirname(full)),mtime:info.mtimeMs,size:info.size});
    }
  }
  await walk(root,0);
  return found;
}

function cacheRecord(cache){
  const record=cache?.record;
  if(!record||typeof record!=='object')return null;
  const rows=record.rows&&typeof record.rows==='object'?record.rows:{};
  const identity=record.identity||{};
  const title=cleanTitle(rows.title?.val);
  const metadata=rows.sessionListMetadata?.val||{};
  const turns=Array.isArray(rows.turnOutline?.val?.turns)?rows.turnOutline.val.turns:[];
  const prompt=cleanTitle(rows.titleInput?.val?.first?.text)||cleanTitle(turns[0]?.prompt);
  const titleText=title||prompt||'未命名任务';
  const updatedAt=Number(metadata.lastPromptAt)||Number(identity.createdAt)||0;
  return{
    id:'',
    title:titleText,
    prompt,
    preview:cleanTitle(turns[turns.length-1]?.prompt),
    updatedAt,
    createdAt:Number(identity.createdAt)||0,
    cwd:typeof identity.cwd==='string'?identity.cwd:'',
    turns:Number(rows.sessionStats?.val?.turns)||turns.length,
    blank:metadata.blank===true||(!title&&!prompt&&turns.length===0),
  };
}

function headerRecord(text,hasEvents=false){
  const line=String(text).split(/\r?\n/).find(Boolean);
  if(!line)return null;
  let event;
  try{event=JSON.parse(line);}catch{return null;}
  if(event?.type!=='session'||typeof event.id!=='string')return null;
  return{
    title:'未命名任务',
    prompt:'',
    preview:'',
    updatedAt:Number(event.createdAt)||0,
    createdAt:Number(event.createdAt)||0,
    cwd:typeof event.cwd==='string'?event.cwd:'',
    turns:0,
    blank:!hasEvents,
  };
}

async function readSession(file,id,mtime,base,size){
  let meta=null;
  const cacheFile=path.join(base,CACHE_DIR,`${id}.json`);
  try{
    const info=await stat(cacheFile),signature=[info.mtimeMs,info.ctimeMs,info.size].join(':');
    const hit=metadataCache.get(cacheFile);
    if(hit?.signature===signature){metadataCache.delete(cacheFile);metadataCache.set(cacheFile,hit);return {...hit.meta,id};}
    const cached=JSON.parse(await readFile(cacheFile,'utf8'));
    meta=cacheRecord(cached);
    if(meta){metadataCache.set(cacheFile,{signature,meta:{...meta,updatedAt:meta.updatedAt||mtime}});if(metadataCache.size>CACHE_LIMIT)metadataCache.delete(metadataCache.keys().next().value);}
  }catch{}
  if(!meta){
    let handle;
    try{
      // Upstream stores separate zstd frames. A single decompression reads only
      // the header, so header-only must not imply that the whole task is blank.
      handle=await open(file,'r');const buffer=Buffer.alloc(65536),{bytesRead}=await handle.read(buffer,0,buffer.length,0);
      const source=buffer.subarray(0,bytesRead),magic=Buffer.from([0x28,0xb5,0x2f,0xfd]);
      // Node 24 expands concatenated frames; Node 25 stops after the first.
      // Decode only a complete header frame on both versions. A magic sequence
      // inside compressed data is rejected by decompression/header validation.
      let end=source.indexOf(magic,4);
      for(let attempts=0;attempts<32;attempts++){
        const boundary=end<0?source.length:end;
        try{const text=zstdDecompressSync(source.subarray(0,boundary),{maxOutputLength:65536}).toString('utf8');meta=headerRecord(text,size>boundary);if(meta)break;}catch{}
        if(end<0)break;end=source.indexOf(magic,end+4);
      }
    }catch{}finally{await handle?.close();}
  }
  if(!meta)return null;
  meta.id=id;
  if(!meta.updatedAt)meta.updatedAt=mtime;
  return meta;
}

/**
 * Enumerate DeepSeek Harness sessions stored under <home>/harness.
 * Reads the projection cache for titles; falls back to the session header.
 * @param {string} home - Cupbox home directory (DSH_HOME is <home>/harness).
 * @param {{limit?:number}} [options]
 * @returns {Promise<Array<{id:string,title:string,prompt:string,preview:string,updatedAt:number,createdAt:number,cwd:string,turns:number,engine:'harness'}>>}
 */
export async function listHarnessSessions(home,options={}){
  const limit=Number.isInteger(options.limit)&&options.limit>0?Math.min(options.limit,200):60;
  if(!home)return[];
  const base=path.join(home,'harness');
  const root=path.join(base,'sessions');
  const files=await sessionFiles(root);
  if(!files.length)return[];
  const records=[];
  files.sort((a,b)=>b.mtime-a.mtime);
  for(const entry of files.slice(0,limit*3)){
    const record=await readSession(entry.file,entry.id,entry.mtime,base,entry.size).catch(()=>null);
    if(!record||record.blank)continue;
    records.push({...record,engine:'harness'});
  }
  records.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  return records.slice(0,limit);
}
