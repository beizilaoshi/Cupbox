import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,stat} from 'node:fs/promises';
const RUNTIME=fileURLToPath(new URL('./harness-runtime/',import.meta.url));
const SHORT_RUNTIME=fileURLToPath(new URL('../../../dsh/',import.meta.url));
const VERSION='0.2.1-rc.2';
export async function runtimeDirectory(preferred=RUNTIME){try{await stat(path.join(preferred,'bin/node.exe'));return preferred;}catch(error){if(error.code!=='ENOENT'||preferred!==RUNTIME)throw error;await stat(path.join(SHORT_RUNTIME,'bin/node.exe'));return SHORT_RUNTIME;}}

export function launchConfiguration(records,prefs={}){
 const models=records.all.filter(m=>m.enabled!==false&&m.provider!=='free'&&m.capabilities?.includes('text'));
 const providers={},env={};let preferred;
 models.forEach((m,i)=>{const id='cupbox-'+i,key='CUPBOX_HARNESS_KEY_'+i;env[key]=m.apiKey||'';providers[id]={displayName:m.name||m.model,apiKeyEnv:key,api:m.provider==='anthropic'?'anthropic-messages':'openai-completions',baseURL:m.baseUrl|| (m.provider==='anthropic'?'https://api.anthropic.com':'https://api.openai.com/v1'),retryPolicy:{mode:'normal',maxRetries:1},models:[{id:m.model,name:m.name||m.model,input:m.capabilities.includes('vision')?['text','image']:['text'],contextWindow:128000,maxTokens:8192}]};if(m.id===prefs.modelRoutes?.text||!preferred)preferred={provider:id,model:m.model};});
 const patch=[{id:'llm-pi-ai',config:{providers}},...(preferred?[{id:'agent-default-model',config:preferred}]:[])];
 return{patch,env,models:models.map(m=>({name:m.name||m.model,id:m.id})),version:VERSION};
}
export function environment(base,home,keys={}){
 const env={};for(const [k,v]of Object.entries(base))if(/^(?:path|pathext|systemroot|windir|comspec|temp|tmp|userprofile|homedrive|homepath|appdata|localappdata|programfiles(?:\(x86\))?|programw6432|allusersprofile|psmodulepath)$/i.test(k)&&v!==undefined)env[k]=v;
 return{...env,...keys,DSH_HOME:home,DSH_TELEMETRY_DISABLED:'1',DSH_PERMISSION_MODE:'workspace-write'};
}
export async function originalToolInventory(runtime=RUNTIME){
 const catalogue=JSON.parse(await readFile(path.join(await runtimeDirectory(runtime),'tool-inventory.json'),'utf8'));return catalogue;
}
