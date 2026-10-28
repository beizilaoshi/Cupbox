import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {BrowserWindow,ipcMain,dialog,globalShortcut} from 'electron';
import {normalizeMarchConfig,MARCH_TASKS} from './march7th-workflow.js';
import {uiMessageBox} from './ui-prompts.js';

export function installMarchWorkflow({workflow,desktopDir,getPrefs,savePrefs,computer}){
  let starting=null,shortcutReady=false;
  const shortcut='Control+Alt+F12';
  const busy=()=>Boolean(starting)||workflow.snapshot().running;
  const trusted=event=>{if(event.sender.isDestroyed()||event.sender.getURL()!==pathToFileURL(path.join(desktopDir,'ui/index.html')).href)throw Error('三月七工作流只接受主窗口中的本地操作');};
  function syncShortcut(){if(!busy()&&shortcutReady){globalShortcut.unregister(shortcut);shortcutReady=false;}}
  async function stop(){starting?.abort();try{return await workflow.stop();}finally{syncShortcut();}}
  ipcMain.handle('march:state',async event=>{trusted(event);return{...workflow.snapshot(),running:busy(),status:starting?'confirming':workflow.snapshot().status,tasks:MARCH_TASKS,config:(await getPrefs()).march7th||{}};});
  ipcMain.handle('march:pick',async event=>{trusted(event);const r=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:'选择 March7th Assistant.exe（不是 Launcher）',properties:['openFile'],filters:[{name:'小助手程序',extensions:['exe']}]});return r.canceled?'':r.filePaths[0];});
  ipcMain.handle('march:save',async(event,input)=>{trusted(event);if(busy())throw Error('任务正在运行或等待确认，停止后再修改配置');const config=normalizeMarchConfig(input);await savePrefs({march7th:config});return config;});
  ipcMain.handle('march:start',async event=>{
    trusted(event);if(busy())throw Error('三月七工作流已在运行或等待确认');
    const controller=new AbortController();starting=controller;const destroyed=()=>controller.abort();event.sender.once('destroyed',destroyed);
    try{
      const p=await getPrefs();if(p.executionEnvironment!=='native')throw Error('三月七会控制真实游戏窗口，请先切换到本机运行');
      const config=normalizeMarchConfig(p.march7th);
      const r=await uiMessageBox(BrowserWindow.fromWebContents(event.sender),{type:'warning',title:'高风险：启动三月七游戏自动化',message:MARCH_TASKS[config.task],detail:`程序：${config.executable}\n${config.task==='custom'?'自定义流程：'+config.workflowName:'任务：'+config.task}\n\n将启动本机第三方程序，可能占用鼠标、键盘，改变游戏进度、消耗体力或资源。完成后可能执行小助手配置的关机、退出等动作；请先在小助手中核对。程序可能弹出 Windows UAC；Cupbox 不自动提权。\n\n确认后撤销当前桌面协作授权，运行期间禁止同时接管桌面。Ctrl+Alt+F12 可请求停止启动的进程树；已发生的游戏操作无法撤回，自行提权的子进程可能需要在小助手中另行停止。`,buttons:['取消','核对配置并启动'],cancelId:0,signal:controller.signal});
      controller.signal.throwIfAborted();if(r.response!==1)return{...workflow.snapshot(),cancelled:true};
      const next=await getPrefs();if(next.executionEnvironment!=='native'||JSON.stringify(normalizeMarchConfig(next.march7th))!==JSON.stringify(config))throw Error('配置或运行环境已改变，请重新确认');
      computer.stopAll();
      shortcutReady=globalShortcut.register(shortcut,()=>{void stop().catch(()=>{});});
      if(!shortcutReady)throw Error('紧急停止快捷键被占用，未启动任务');
      controller.signal.throwIfAborted();return await workflow.start(config);
    }finally{if(starting===controller)starting=null;event.sender.removeListener('destroyed',destroyed);syncShortcut();}
  });
  ipcMain.handle('march:stop',async event=>{trusted(event);return stop();});
  return{busy,stop,syncShortcut,blockedReason:()=>busy()?'三月七正在运行或等待确认；先停止游戏工作流，再授权桌面协作。':''};
}
