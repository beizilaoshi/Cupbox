import {readFile,mkdir,writeFile,rename,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {normalized,outputRisk} from '../qq/security.js';
export const PLUGIN_API_VERSION=1;
const EXAMPLE=fileURLToPath(new URL('./examples/output-inspector/',import.meta.url));
const BUILTIN='cupbox.output-inspector',permissions=['response.read','response.block','response.replace'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
export function validateRules(value){
  if(!exact(value,['blockWords','maskWords','replacement','maxChars']))throw Error('插件规则只能包含拦截词、脱敏词、替换文本和长度限制');
  const out={blockWords:[],maskWords:[],replacement:'[已隐藏]',maxChars:0,...value};
  for(const key of ['blockWords','maskWords']){if(!Array.isArray(out[key])||out[key].length>100||out[key].some(s=>typeof s!=='string'||!s.trim()||s.length>200))throw Error('每类词表最多100条，每条1～200字');out[key]=[...new Set(out[key].map(s=>s.trim()))];}
  if(typeof out.replacement!=='string'||!out.replacement.trim()||out.replacement.length>200||outputRisk(out.replacement))throw Error('替换文本需为1～200字且不能包含密钥');
  if(!Number.isInteger(out.maxChars)||out.maxChars<0||out.maxChars>100000)throw Error('长度上限需为0～100000的整数');return out;
}
export function validateManifest(m){
  if(!exact(m,['apiVersion','id','name','version','description','kind','hook','entry','permissions'])||m.apiVersion!==1||!/^\w[\w.-]{2,63}$/.test(m.id)||!/^\d+\.\d+\.\d+$/.test(m.version)||typeof m.name!=='string'||!m.name.trim()||m.name.length>60||typeof m.description!=='string'||m.description.length>500)throw Error('插件清单无效或 API 版本不支持');
  if(m.kind!=='output-rules'||m.hook!=='reply.beforeSend'||m.entry!=='rules.json')throw Error('API v1 只支持 reply.beforeSend 声明式文字检测，不执行脚本');
  if(!Array.isArray(m.permissions)||new Set(m.permissions).size!==m.permissions.length||!m.permissions.includes('response.read')||m.permissions.some(p=>!permissions.includes(p)))throw Error('插件申请了不支持的权限');return m;
}
export function runOutputRules(text,rules,grants=permissions){
  if(typeof text!=='string'||text.length>200000)throw Error('待检测文字超过插件输入上限');
  const policy=validateRules(rules),normalWords=policy.blockWords.map(normalized),hit=value=>{const clean=normalized(value);return policy.blockWords.some((w,i)=>value.includes(w)||clean.includes(normalWords[i]));};
  if((policy.blockWords.length||policy.maxChars)&&!grants.includes('response.block')||policy.maskWords.length&&!grants.includes('response.replace'))throw Error('规则超过插件声明的权限');
  if(hit(text))return{action:'block',code:'BLOCK_WORD'};
  if(policy.maxChars&&[...text].length>policy.maxChars)return{action:'block',code:'MAX_LENGTH'};
  let next=text;for(const word of policy.maskWords){const pieces=next.split(word);if(next.length+(pieces.length-1)*(policy.replacement.length-word.length)>200000)return{action:'block',code:'OUTPUT_LIMIT'};next=pieces.join(policy.replacement);}
  if(next.length>200000||hit(next)||policy.maxChars&&[...next].length>policy.maxChars)return{action:'block',code:'REPLACEMENT_BLOCKED'};
  return{action:next===text?'pass':'replace',text:next,code:next===text?'PASS':'MASKED'};
}
async function json(file,max=128*1024){const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>max)throw Error('插件文件必须是大小受限的普通 JSON 文件，不能使用链接');return JSON.parse(await readFile(file,'utf8'));}
async function bundle(dir){if((await lstat(dir)).isSymbolicLink())throw Error('插件目录不能使用链接');const manifest=validateManifest(await json(path.join(dir,'manifest.json'))),rules=validateRules(await json(path.join(dir,'rules.json')));runOutputRules('',rules,manifest.permissions);return{manifest,rules,hash:digest(JSON.stringify({manifest,rules}))};}
export class PluginHost{
  constructor({home}){this.home=home;this.pending=Promise.resolve();}
  get root(){return path.join(typeof this.home==='function'?this.home():this.home,'plugins');}
  async state(){try{const s=await json(path.join(this.root,'settings.json'),4*1024*1024);if(!exact(s,['version','plugins'])||s.version!==1||!Array.isArray(s.plugins)||s.plugins.length>20||s.plugins.some(p=>!exact(p,['id','name','enabled','hash','rules'])||typeof p.id!=='string'||typeof p.enabled!=='boolean'||typeof p.hash!=='string')||new Set(s.plugins.map(p=>p.id)).size!==s.plugins.length)throw Error('invalid');return s;}catch(e){if(e.code==='ENOENT')return{version:1,plugins:[]};throw Error('插件配置损坏，已停止回复检测流程；请备份后修复');}}
  folder(id){return path.join(this.root,digest(id).slice(0,24));}
  async catalog(){const state=await this.state(),ids=[BUILTIN,...state.plugins.filter(p=>p.id!==BUILTIN).map(p=>p.id)],items=[];
    for(const id of ids){const saved=state.plugins.find(p=>p.id===id);try{const data=await bundle(id===BUILTIN?EXAMPLE:this.folder(id));if(data.manifest.id!==id)throw Error('插件 ID 与登记不一致');const changed=Boolean(saved&&saved.hash!==data.hash),rules=validateRules(saved?.rules||data.rules);runOutputRules('',rules,data.manifest.permissions);items.push({...data.manifest,rules,builtin:id===BUILTIN,enabled:saved?.enabled===true,active:saved?.enabled===true&&!changed,changed,hash:data.hash});}catch{items.push({id,name:saved?.name||id,enabled:saved?.enabled===true,active:false,error:'插件文件缺失、损坏或权限不兼容；启用时会拦截回复',builtin:id===BUILTIN});}}
    return{apiVersion:1,plugins:items};
  }
  change(fn){const run=this.pending.catch(()=>{}).then(fn);this.pending=run;return run;}
  async write(state){await mkdir(this.root,{recursive:true});const file=path.join(this.root,'settings.json'),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});await rename(temp,file);}
  async save(draft){return this.change(async()=>{if(!exact(draft,['id','enabled','rules'])||typeof draft.id!=='string'||typeof draft.enabled!=='boolean')throw Error('插件设置无效');const state=await this.state(),item=(await this.catalog()).plugins.find(p=>p.id===draft.id);if(!item)throw Error('插件不存在');if(draft.enabled&&(item.error||item.changed))throw Error('插件文件已变化或不可用；请重新导入审阅后启用');const rules=validateRules(draft.rules||item.rules||{});if(item.permissions)runOutputRules('',rules,item.permissions);const record={id:item.id,name:item.name,hash:item.hash||state.plugins.find(p=>p.id===item.id)?.hash||'',enabled:draft.enabled,rules};const index=state.plugins.findIndex(p=>p.id===item.id);if(index<0)state.plugins.push(record);else state.plugins[index]=record;await this.write(state);return this.catalog();});}
  async importFolder(dir){return this.change(async()=>{const data=await bundle(await realpath(dir));if(data.manifest.id===BUILTIN)throw Error('不能覆盖内置示例；复制示例后请修改插件 ID');const state=await this.state();if(state.plugins.some(p=>p.id===data.manifest.id))throw Error('该插件 ID 已存在；更新前请先停用并移出插件');if(state.plugins.filter(p=>p.id!==BUILTIN).length>=19)throw Error('最多安装19个外部插件');await mkdir(this.folder(data.manifest.id),{recursive:true});for(const [file,value]of [['manifest.json',data.manifest],['rules.json',data.rules]])await writeFile(path.join(this.folder(data.manifest.id),file),JSON.stringify(value,null,2),{mode:0o600});state.plugins.push({id:data.manifest.id,name:data.manifest.name,hash:data.hash,enabled:false,rules:data.rules});await this.write(state);return this.catalog();});}
  async remove(id){return this.change(async()=>{if(id===BUILTIN)throw Error('内置示例可停用，不能移出');const state=await this.state();state.plugins=state.plugins.filter(p=>p.id!==id);await this.write(state);return this.catalog();});}
  async preview({id,text,rules}){const item=(await this.catalog()).plugins.find(p=>p.id===id);if(!item||item.error||item.changed)throw Error('插件不可用，请重新导入审阅');if(outputRisk(text))return{action:'block',code:'CORE_SECURITY',dryRun:true};const result=runOutputRules(text, rules||item.rules,item.permissions);if(result.action!=='block'&&outputRisk(result.text))return{action:'block',code:'CORE_SECURITY',dryRun:true};return{...result,dryRun:true};}
  async apply(text,{surface='qq',signal,guard=outputRisk}={}){signal?.throwIfAborted();if(guard(text))return{allowed:false,text:'',checks:[{id:'core',action:'block',code:'CORE_SECURITY'}]};const catalog=await this.catalog(),checks=[],enabled=catalog.plugins.filter(p=>p.enabled);let current=text;
    for(const plugin of enabled){signal?.throwIfAborted();if(!plugin.active){checks.push({id:plugin.id,action:'block',code:'PLUGIN_UNAVAILABLE'});return{allowed:false,text:'',checks};}let result;try{const original=runOutputRules(text,{...plugin.rules,maskWords:[]},plugin.permissions);result=original.action==='block'?original:runOutputRules(current,plugin.rules,plugin.permissions);}catch{result={action:'block',code:'PLUGIN_ERROR'};}checks.push({id:plugin.id,action:result.action,code:result.code});if(result.action==='block')return{allowed:false,text:'',checks};current=result.text;}
    for(const plugin of enabled){const final=runOutputRules(current,{...plugin.rules,maskWords:[]},plugin.permissions);if(final.action==='block')return{allowed:false,text:'',checks:[...checks,{id:plugin.id,action:'block',code:'FINAL_RECHECK'}]};}
    if(guard(current))return{allowed:false,text:'',checks:[...checks,{id:'core',action:'block',code:'CORE_SECURITY'}]};signal?.throwIfAborted();return{allowed:true,text:current,checks,surface};
  }
  exampleFolder(){return EXAMPLE;}
}
