import {ipcMain,app} from 'electron';
import {HarnessEngine,blockText,engineProjection} from './harness-engine.js';
import {originalToolInventory} from './harness-host.js';
import {listHarnessSessions} from './harness-sessions.js';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
export function installHarness({home,choices,getPrefs,trusted,readNative,writeNative,listNative}){
 const engine=new HarnessEngine({home});
 let hiddenQueue=Promise.resolve();const hiddenFile=()=>path.join(home(),'harness','native-history-hidden.json');
 async function hidden(){try{const rows=JSON.parse(await readFile(hiddenFile(),'utf8'));return new Set(Array.isArray(rows)?rows:[]);}catch(e){if(e.code==='ENOENT')return new Set();throw e;}}
 async function hideSession(id){if(!id)return;const work=hiddenQueue.catch(()=>{}).then(async()=>{const rows=await hidden();rows.add(id);const file=hiddenFile();await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify([...rows]),{mode:0o600});await rename(file+'.tmp',file);});hiddenQueue=work;return work;}
 ipcMain.handle('harness:state',async e=>{trusted(e);return{status:engine.active.size?'working':'idle',native:true,version:'0.2.1-rc.2',inventory:await originalToolInventory()};});
 ipcMain.handle('harness:sessions',async e=>{trusted(e);await hiddenQueue.catch(()=>{});const excluded=await hidden();return(await listHarnessSessions(home(),{limit:60})).filter(s=>!excluded.has(s.id));});
 ipcMain.handle('harness:read',async(e,id)=>{
  trusted(e);if(typeof id!=='string'||!/^session-[a-zA-Z0-9-]{1,100}$/.test(id))throw Error('任务标识无效');
  const linked=(await listNative()).find(s=>s.harnessSessionId===id);if(linked)return readNative(linked.id);
  const meta=(await listHarnessSessions(home(),{limit:200})).find(s=>s.id===id);if(!meta||(await hidden()).has(id))throw Error('找不到这个工作任务');
  const records=await choices.records(),prefs=await getPrefs(),config=records.all.find(m=>m.id===prefs.modelRoutes?.text&&m.enabled!==false&&m.provider!=='free')||records.all.find(m=>m.enabled!==false&&m.provider!=='free'&&m.capabilities.includes('text'));if(!config)throw Error('请先配置文本模型连接');
  const connection=await engine.connect({workspace:meta.cwd||prefs.workspace,config});let saved;try{saved=await connection.inspect(id);}finally{await connection.close();}
  const messages=[],calls=new Map();let trace=[];
  for(const event of saved.events){const update=engineProjection(event,calls);if(update?.item)trace.push(update.item);const d=event.data||{},message=event.type==='user/message'?d:d.message;if(event.type==='user/message'&&message?.source?.kind==='user'){const text=blockText(message.content);if(text)messages.push({id:randomUUID(),role:'user',text});}if(event.type==='assistant/message'){const text=blockText(message?.content);if(text)messages.push({id:randomUUID(),role:'assistant',text,trace});trace=[];}}
  const session={id:'h-'+randomUUID(),title:meta.title,mode:'agent',workspace:saved.session.cwd||meta.cwd,messages,harnessSessionId:id,harnessSyncedMessages:messages.length,createdAt:new Date(meta.createdAt||Date.now()).toISOString(),updatedAt:new Date(meta.updatedAt||Date.now()).toISOString()};await writeNative(session);return session;
 });
 let exiting=false;app.on('will-quit',event=>{if(exiting||!engine.active.size)return;event.preventDefault();void engine.stopAll().finally(()=>{exiting=true;app.quit();});});
 return{engine,hideSession};
}
