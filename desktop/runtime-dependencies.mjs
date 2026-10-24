import path from 'node:path';
import { readFile, cp, mkdir,stat } from 'node:fs/promises';
import {createHash} from 'node:crypto';
/** Copy the installed production dependency closure, preserving nested package layouts. */
export async function copyRuntimeDependencies(root,target,{skipUnchanged=false}={}){
  const seen=new Set(),top=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  async function locate(name,from){let current=from;while(true){const candidate=path.join(current,'node_modules',name);try{await readFile(path.join(candidate,'package.json'));return candidate;}catch{}const parent=path.dirname(current);if(parent===current)throw Error('缺少运行依赖 '+name);current=parent;}}
  async function copy(name,from){
    const source=await locate(name,from);if(seen.has(source))return;seen.add(source);
    const relative=path.relative(root,source);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('运行依赖位于项目目录之外');
    const pkg=JSON.parse(await readFile(path.join(source,'package.json'),'utf8'));
    await mkdir(path.dirname(path.join(target,relative)),{recursive:true});await cp(source,path.join(target,relative),{recursive:true,...(skipUnchanged?{filter:async(from,to)=>{const info=await stat(from);if(!info.isFile())return true;try{const old=await stat(to);if(!old.isFile()||old.size!==info.size)return true;const hash=bytes=>createHash('sha256').update(bytes).digest('hex');return hash(await readFile(from))!==hash(await readFile(to));}catch(e){if(e.code==='ENOENT')return true;throw e;}}}:{})});
    for(const dep of Object.keys(pkg.dependencies||{}))await copy(dep,source);
    for(const dep of Object.keys(pkg.optionalDependencies||{})){try{await copy(dep,source);}catch(e){if(!e.message.startsWith('缺少运行依赖'))throw e;}}
  }
  for(const name of Object.keys(top.dependencies||{}))await copy(name,root);
  return seen.size;
}
