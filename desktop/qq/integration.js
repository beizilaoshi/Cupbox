import {uiMessageBox} from '../ui-prompts.js';
import path from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';
import { BrowserWindow, ipcMain, dialog,shell,clipboard } from 'electron';
import { QQService } from './service.js';
import { Workbench } from '../workbench/runtime.js';
import { DEFINITIONS } from '../workbench/definitions.js';
import { previewParts } from './conversation.js';
import {checkProtectedStorage} from '../protected-storage.js';
import { inside } from '../execution-policy.js';
import { validateSettings } from './store.js';
const LOCAL_TOOLS=['fs_read','fs_stat','grep','diff','fs_write','fs_edit','fs_mkdir','fs_patch'];
export function installQQ({home,choices,getPrefs,desktopDir,app,plugins}){
  let window,servicePromise,serviceInstance;
  const notify=state=>{if(window&&!window.isDestroyed())window.webContents.send('qq:state',state);};
  const notifyLog=entry=>{if(window&&!window.isDestroyed())window.webContents.send('qq:log',entry);};
  const work={prepare:async(event,signal)=>{
    const prefs=await getPrefs();if(!prefs.workspace)throw Error('工作模式需先在主窗口选择工作目录');
    const currentWindow=window;if(!currentWindow||currentWindow.isDestroyed())throw Error('本地工具需要打开 QQ 机器人窗口进行批准');
    const approve=async payload=>{signal.throwIfAborted();const result=await uiMessageBox(currentWindow,{type:'warning',title:'QQ 工作任务请求批准',message:`QQ ${event.user_id} 请求执行 ${payload.tool}`,detail:`来源：${event.message_type==='group'?'群 '+event.group_id:'私聊'}\n目录：${prefs.workspace}\n\n${JSON.stringify(payload.args,null,2).slice(0,8000)}\n\n文件内容可能被发送到所选模型，并出现在 QQ 回复中。`,buttons:['拒绝','批准本次'],defaultId:0,cancelId:0,noLink:true});signal.throwIfAborted();return result.response===1;};
    let approved=false;
    const bench=await new Workbench({root:prefs.workspace,home:home(),session:'qq-owner-'+event.user_id,approve:async()=>{signal.throwIfAborted();return approved;},getPrefs:async()=>({...await getPrefs(),approvalMode:'ask'})}).init();
    const originalGuard=bench.files.guard;bench.files.guard=async(file,write)=>{await checkProtectedStorage(file,write,[home()]);const root=serviceInstance?.autoMemory.root;if(root&&(inside(root,file)||write&&inside(file,root)))throw Object.assign(Error('QQ 文件工具不能访问或覆盖应用记忆、配置和凭据目录'),{code:'PROTECTED_STORAGE'});await originalGuard(file,write);};
    return{definitions:DEFINITIONS.filter(d=>LOCAL_TOOLS.includes(d.name)),call:async(name,args)=>{if(!LOCAL_TOOLS.includes(name))throw Error('此工具不向 QQ 开放');signal.throwIfAborted();const preview=args.confirmToken?bench.files.tokens.get(args.confirmToken):null;const allowed=await approve({tool:name,args:{...args,...(preview?{diff:preview.prepared?.map(c=>c.diff).join('\n').slice(0,30000)}:{})}});if(!allowed)throw Error('本次操作已拒绝');approved=true;try{return await bench.call(name,args);}finally{approved=false;}},dispose:()=>bench.dispose()};
  }};
  async function service(){return servicePromise||(servicePromise=new QQService({home:home(),memoryRoot:process.env.CUPBOX_HOME?path.join(home(),'memory','qq-bot'):path.join(app.getPath('documents'),'Cupbox','memory','qq-bot'),choices,work,notify,notifyLog,plugins}).init().then(s=>{serviceInstance=s;return s;}));}
  function trusted(event){if(!window||window.isDestroyed()||event.sender.id!==window.webContents.id)throw Error('QQ 功能只接受机器人窗口的本地操作');}
  const handle=(name,fn)=>ipcMain.handle(name,async(event,payload)=>{trusted(event);try{return{ok:true,value:await fn(await service(),payload)}}catch(e){serviceInstance?.log('error','ui','本地控制台操作失败',{action:name,code:e.code||'LOCAL_ACTION_FAILED'});return{ok:false,error:e.message||'操作失败'}};});
  ipcMain.handle('qq:open',async()=>{
    if(window&&!window.isDestroyed()){window.show();window.focus();return true;}
    const prefs=await getPrefs();window=new BrowserWindow({width:1180,height:850,minWidth:960,minHeight:680,title:'Cupbox · QQ 机器人',icon:path.join(desktopDir,'ui/assets/cupbox-logo.ico'),backgroundColor:prefs.theme==='dark'?'#202120':'#fafaf7',titleBarStyle:'hidden',webPreferences:{preload:path.join(desktopDir,'qq-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    window.setMenu(null);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.on('closed',()=>{window=null;serviceInstance?.stop();});
    await window.loadFile(path.join(desktopDir,'ui/qq-bot.html'));await service();return true;
  });
  handle('qq:plugins:list',s=>s.plugins.catalog());handle('qq:plugins:save',(s,p)=>s.pluginSave(p));handle('qq:plugins:preview',(s,p)=>s.plugins.preview(p));handle('qq:plugins:remove',async(s,p)=>{s.clearContext();return s.plugins.remove(p?.id);});handle('qq:plugins:import',async s=>{const r=await dialog.showOpenDialog(window,{title:'选择插件文件夹（需包含 manifest.json 和 rules.json）',properties:['openDirectory']});if(r.canceled||!r.filePaths.length)return null;s.clearContext();return s.plugins.importFolder(r.filePaths[0]);});handle('qq:plugins:example',async s=>{const error=await shell.openPath(s.plugins.exampleFolder());if(error)throw Error('无法打开示例目录');return true;});
  handle('qq:get',s=>s.state());handle('qq:review',(s,p)=>s.review(p||{}));handle('qq:save',(s,p)=>s.save(p?.patch||p||{},p?.confirmationToken));handle('qq:start',s=>s.start());handle('qq:stop',s=>s.stop());handle('qq:qr',s=>s.refreshQR());handle('qq:groups',s=>s.groups());
  handle('qq:preview-segments',(s,p)=>previewParts(String(p?.text||'').slice(0,1800),validateSettings({...s.config,...p?.settings,enabled:false})));
  handle('qq:models',async()=>choices.catalog());handle('qq:theme',()=>getPrefs());handle('qq:clear-context',s=>{s.clearContext();return true;});
  handle('qq:memory:get',s=>s.memory());handle('qq:memory:save',(s,p)=>s.saveMemory(p||{}));handle('qq:rule',(s,p)=>s.testRule(p||{}));
  handle('qq:auto-memory:list',async s=>({root:s.autoMemory.root,records:await s.autoMemory.inventory()}));handle('qq:auto-memory:read',(s,p)=>s.autoMemory.inspect(p));handle('qq:auto-memory:edit',(s,p)=>s.autoMemory.edit(p.target,p.text));
  handle('qq:auto-memory:forget',async(s,p)=>{const item=await s.autoMemory.inspect(p.target),fact=item.facts.find(f=>f.who===p.who&&f.text===p.text);if(!fact)throw Error('偏好已不存在，请刷新');const r=await uiMessageBox(window,{type:'warning',title:'移除记忆偏好',message:'移除这条模型整理的偏好？',detail:fact.who+'：'+fact.text+'\n原话依据：'+fact.evidence+'\n只移除此条整理结果，聊天原文仍会保留。',buttons:['保留','移除此偏好'],defaultId:0,cancelId:0,noLink:true});if(r.response!==1)return false;s.clearContext();return s.autoMemory.forgetFact(p.target,p.who,p.text);});
  handle('qq:romance:records',s=>s.autoMemory.romanceRecords());
  handle('qq:romance:reset',async(s,p)=>{const records=await s.autoMemory.romanceRecords(),record=records.find(r=>r.key===p?.key&&JSON.stringify(r.target)===JSON.stringify(p?.target));if(!record)throw Error('存档已不存在，请刷新');const result=await uiMessageBox(window,{type:'warning',title:'重新开始攻略',message:'重新开始这段攻略？',detail:'账号 '+record.target.account+' · '+record.target.kind+' '+record.target.id+'\n角色存档：'+record.key+'\n只清除此段关系进展，不删除聊天原文、其他用户或其他场景存档。旧聊天不会覆盖新的阶段记录。',buttons:['保留进度','重新开始'],defaultId:0,cancelId:0,noLink:true});if(result.response!==1)return false;s.clearContext();return s.autoMemory.resetRomance(record.target,record.key);});
  handle('qq:auto-memory:open',async s=>{await mkdir(s.autoMemory.root,{recursive:true});const error=await shell.openPath(s.autoMemory.root);if(error)throw Error('无法打开记忆目录');return true;});
  handle('qq:auto-memory:delete',async(s,p)=>{const item=await s.autoMemory.inspect(p);const r=await uiMessageBox(window,{type:'warning',title:'永久删除机器人记忆',message:`删除 QQ ${p.account} 的${p.kind==='group'?'群':'私聊'} ${p.id} 记忆？`,detail:`将删除 ${item.turns} 条近期对话和自动记忆笔记。文件：${item.file}\n本操作无法自动恢复；其他群和应用全局偏好不会删除。`,buttons:['保留记忆','永久删除本记录'],defaultId:0,cancelId:0,noLink:true});if(r.response!==1)return false;s.engine.stop();await s.autoMemory.erase(p);return true;});
  handle('qq:emoji:import',async s=>{const r=await dialog.showOpenDialog(window,{title:'批量导入表情包（可按 Ctrl / Shift 多选，最多100张）',properties:['openFile','multiSelections'],filters:[{name:'位图图片',extensions:['png','jpg','jpeg','gif','webp']}]});return r.canceled||!r.filePaths.length?null:s.importEmojis(r.filePaths);});
  handle('qq:emoji:save',async(s,p)=>{await s.store.saveEmoji(p);s.engine.update(s.config);return s.publicEmojis();});handle('qq:emoji:remove',(s,id)=>s.removeEmoji(id));
  handle('qq:emoji:starter',s=>s.starterEmojis());
  handle('qq:emoji:diagnose',(s,p)=>s.diagnoseEmoji(p));
  handle('qq:emoji:test',async(s,p)=>{if(!['group','private'].includes(p?.kind)||!/^\d{5,16}$/.test(String(p?.target)))throw Error('请填写有效的群号或私聊 QQ 号');if(!s.started||!s.online||!s.bot)throw Error('请先扫码登录并连接 QQ，再发送测试表情');const item=(await s.store.emojis()).find(e=>e.id===p.id);if(!item)throw Error('请选择图库中的表情');const r=await uiMessageBox(window,{type:'warning',title:'向 QQ 发送测试表情',message:`向${p.kind==='group'?'群':'私聊'} ${p.target} 发送一张测试表情？`,detail:`表情：${item.name}\n这是真实发送，与自动触发及表情总开关无关。请核对目标；测试结果会显示在控制台。`,buttons:['取消','确认发送一次'],defaultId:0,cancelId:0,noLink:true});if(r.response!==1)return{canceled:true};return s.testEmoji(p);});
  handle('qq:logs',(s,p)=>s.logger.snapshot(p?.after));handle('qq:logs:clear',s=>s.logger.clear());handle('qq:logs:copy',s=>{clipboard.writeText(s.logger.snapshot().entries.map(e=>JSON.stringify(e)).join('\n'));return true;});
  handle('qq:logs:export',async s=>{const entries=s.logger.snapshot().entries,r=await dialog.showSaveDialog(window,{title:'导出已脱敏的 QQ 控制台日志',defaultPath:'Cupbox-QQ-'+Date.now()+'.jsonl',filters:[{name:'日志 JSON Lines',extensions:['jsonl']}]});if(r.canceled||!r.filePath)return{canceled:true};await writeFile(r.filePath,entries.map(e=>JSON.stringify(e)).join('\n')+'\n',{mode:0o600});s.log('info','system','控制台日志已导出到用户选择的本机文件',{count:entries.length});return{count:entries.length};});
  ipcMain.handle('qq:window',(event,action)=>{trusted(event);if(action==='minimize')window.minimize();else if(action==='maximize'){window.isMaximized()?window.unmaximize():window.maximize();}else if(action==='close')window.close();return true;});
  let draining=false;
  app.on('before-quit',event=>{serviceInstance?.stop();if(serviceInstance&&!draining){event.preventDefault();draining=true;serviceInstance.autoMemory.pending.catch(()=>{}).finally(()=>app.quit());}});
  return{service,state:()=>({open:Boolean(window&&!window.isDestroyed()),running:Boolean(serviceInstance?.started),online:Boolean(serviceInstance?.online)}),show:()=>{if(window&&!window.isDestroyed()){window.show();window.focus();}},close:()=>{if(window&&!window.isDestroyed())window.close();}};
}
