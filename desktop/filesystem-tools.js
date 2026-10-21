import path from 'node:path';
import { mkdir, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { inside } from './execution-policy.js';
import {dataHome} from '../dist/core/paths.js';
import {checkProtectedStorage} from './protected-storage.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ALLOWED=new Set(['read_text_file','read_multiple_files','write_file','edit_file','create_directory','list_directory','list_directory_with_sizes','search_files','directory_tree','get_file_info']);
const WRITE=new Set(['write_file','edit_file','create_directory']);
export async function openFilesystem({directory,sandbox=true,signal,executable=process.execPath}){
  await mkdir(directory,{recursive:true});const root=await realpath(directory);
  const entry=path.join(ROOT,'node_modules','@modelcontextprotocol','server-filesystem','dist','index.js');
  const args=[...(sandbox?['--permission',`--allow-fs-read=${root}`,`--allow-fs-write=${root}`,`--allow-fs-read=${path.join(ROOT,'node_modules')}`]:[]),entry,root];
  const client=new Client({name:'cupbox-filesystem',version:'1.0.3'},{capabilities:{}});
  const transport=new StdioClientTransport({command:executable,args,cwd:root,stderr:'pipe',env:{ELECTRON_RUN_AS_NODE:'1',SystemRoot:process.env.SystemRoot||'',WINDIR:process.env.WINDIR||'',TEMP:root,TMP:root}});
  let detail='';transport.stderr?.on('data',c=>{detail=(detail+String(c)).slice(-1000);});
  let closed=false;
  const close=async()=>{if(closed)return;closed=true;signal?.removeEventListener('abort',abort);await client.close().catch(()=>{});};
  const abort=()=>void close();signal?.throwIfAborted();signal?.addEventListener('abort',abort,{once:true});
  try{await client.connect(transport,{timeout:15000});const response=await client.listTools();
    const definitions=response.tools.filter(t=>ALLOWED.has(t.name)).map(t=>({name:`fs_${t.name}`,description:`工作目录内的文件工具：${t.description||t.name}`,parameters:t.inputSchema,readOnly:!WRITE.has(t.name)}));
    return{root,definitions,close,async call(name,input,scope){
      signal?.throwIfAborted();const tool=name.replace(/^fs_/,'');if(!ALLOWED.has(tool))throw Error('未启用此文件工具');
      const args=structuredClone(input);
      if(args.path)args.path=path.resolve(root,String(args.path));if(Array.isArray(args.paths))args.paths=args.paths.map(p=>path.resolve(root,String(p)));
      for(const target of [args.path,...(Array.isArray(args.paths)?args.paths:[])].filter(Boolean))await checkProtectedStorage(target,WRITE.has(tool),[dataHome()]);
      if(WRITE.has(tool)&&scope){
        const target=path.resolve(root,String(args.path||'')),allowed=await realpath(scope);if(!inside(allowed,target))throw Error('子项目只能写入分配的交付目录，请把修改放到该目录后交给协调模型整合');
        let ancestor=target;while(true){try{if(!inside(allowed,await realpath(ancestor)))throw Error('子项目不允许通过链接越过交付目录');break;}catch(e){if(e.code!=='ENOENT')throw e;ancestor=path.dirname(ancestor);}}
      }
      const result=await client.callTool({name:tool,arguments:args},undefined,{signal,timeout:30000});
      const text=(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');if(result.isError)throw Error(text||'文件工具失败');return text.slice(0,60000);
    }};
  }catch(e){await close();throw Error(`文件工具连接失败：${e.message}${detail?` · ${detail}`:''}`);}
}
