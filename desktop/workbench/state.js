import path from 'node:path';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tokenize } from '../../dist/core/memory.js';
import { digest,fail } from './files.js';
let stateQueue=Promise.resolve();
export class ScopedState{
  constructor(root,home){this.key=digest(root.toLowerCase());this.file=path.join(home,'scoped-state.json');this.queue=Promise.resolve();}
  async read(){try{return JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return{facts:[],tasks:[]};throw e;}}
  change(fn){const work=stateQueue.catch(()=>{}).then(async()=>{const s=await this.read(),result=await fn(s);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(s,null,2));await (await import('node:fs/promises')).rename(this.file+'.tmp',this.file);return result;});stateQueue=work;this.queue=work;return work;}
  async memory(name,a){const scope=a.scope||'project';if(!['global','project'].includes(scope))fail('E_SCOPE','scope 必须为 global/project');if(a.projectKey&&a.projectKey!==this.key)fail('E_SCOPE','不能访问其他项目命名空间');const matches=f=>f.scope===scope&&(scope==='global'||f.projectKey===this.key)&&(!f.expires||f.expires>Date.now());
    if(name==='memory_remember')return this.change(s=>{if(!String(a.text||'').trim())fail('E_MEMORY','记忆不能为空');const fact={id:randomUUID(),text:String(a.text).slice(0,4000),source:String(a.source||'agent'),scope,projectKey:scope==='project'?this.key:undefined,expires:a.ttl?Date.now()+Math.min(365*86400,Math.max(1,a.ttl))*1000:undefined};s.facts.push(fact);return fact;});
    if(name==='memory_manage'&&a.forget)return this.change(s=>{const before=s.facts.length;s.facts=s.facts.filter(f=>!matches(f)||f.id!==a.forget);return{removed:before-s.facts.length};});
    const s=await this.read(),facts=s.facts.filter(matches);if(name==='memory_manage')return{facts,projectKey:this.key};const terms=tokenize(String(a.query||''));return{facts:facts.filter(f=>!terms.length||terms.some(t=>f.text.toLowerCase().includes(t))).slice(-(Math.min(20,a.limit||5))),projectKey:this.key};
  }
  async task(a){return this.change(s=>{if(a.workspaceKey&&a.workspaceKey!==this.key)fail('E_SCOPE','不能操作其他项目任务');if(a.action==='add'){const task={id:randomUUID(),workspaceKey:this.key,text:String(a.text||'').slice(0,2000),done:false};if(!task.text)fail('E_TASK','任务不能为空');s.tasks.push(task);}else if(a.action==='done'){const task=s.tasks.find(t=>t.workspaceKey===this.key&&t.id===a.id);if(!task)fail('E_NOT_FOUND','找不到任务');task.done=true;}else if(a.action==='clear')s.tasks=s.tasks.filter(t=>t.workspaceKey!==this.key);return{tasks:s.tasks.filter(t=>t.workspaceKey===this.key),workspaceKey:this.key};});}
}
