import {app,BrowserWindow} from 'electron';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';

const out=path.resolve('output/march7th-review');
await mkdir(out,{recursive:true});
process.env.CUPBOX_HOME=path.join(out,'home');
process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
app.setPath('userData',path.join(out,'profile'));
app.disableHardwareAcceleration();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,label){for(let i=0;i<150;i++){if(await fn())return;await pause(100);}throw Error('等待超时：'+label);}
void(async()=>{
  try{
    await import('./main.js');
    await waitFor(()=>BrowserWindow.getAllWindows().length,'主窗口');
    const win=BrowserWindow.getAllWindows()[0],js=code=>win.webContents.executeJavaScript(code);
    await waitFor(async()=>!win.webContents.isLoading()&&await js('Boolean(window.cupboxReady)'),'页面初始化');
    await js(`openModal('march7th')`);
    if(!await js(`!document.getElementById('tab-march7th').hidden && document.getElementById('tab-api').hidden && document.getElementById('march-task').options.length===13`))throw Error('工作流入口不完整');
    await js(`document.getElementById('march-task').value='custom';document.getElementById('march-task').dispatchEvent(new Event('change'))`);
    if(!await js(`!document.getElementById('march-custom').hidden`))throw Error('自定义流程输入未显示');
    await js(`document.getElementById('march-executable').value='C:/March7th/March7th Assistant.exe';cupbox.marchSave({executable:'C:/March7th/March7th Assistant.exe',task:'custom',workflowName:'日常流程'})`);
    if(!await js(`cupbox.prefsGet().then(p=>p.march7th.workflowName==='日常流程')`))throw Error('设置保存失败');
    await js(`switchTab('api')`);
    if(!await js(`document.getElementById('tab-march7th').hidden`))throw Error('标签切换失败');
    await js(`switchTab('march7th')`);win.show();await pause(700);
    let screenshot;
    for(let attempt=0;attempt<3;attempt++){try{screenshot=await win.webContents.capturePage();break;}catch(error){if(attempt===2)throw error;await pause(500);}}
    await writeFile(path.join(out,'settings.png'),screenshot.toPNG());
    console.log('PASS 工作流入口、13 项任务、自定义流程切换、设置持久化与页面切换');
    await js(`switchTab('agent-presets')`);
    if(!await js(`!document.getElementById('tab-agent-presets').hidden && document.getElementById('tab-march7th').hidden && document.querySelectorAll('[data-agent-preset]').length===5`))throw Error('Agent 预设卡片缺失');
    await js(`document.querySelector('[data-agent-preset="coding"] .agent-preset-select').click()`);
    await waitFor(()=>js(`document.querySelector('[data-agent-preset="coding"] .agent-preset-select').getAttribute('aria-pressed')==='true'`),'预设选择');
    if(!await js(`cupbox.prefsGet().then(p=>p.agentPreset==='coding' && p.mode==='agent')`))throw Error('预设未持久化或未切换 Agent');
    if(!await js(`cupbox.prefsSet({agentPreset:'bad-preset'}).then(r=>!r.ok)`))throw Error('无效预设被接受');
    await js(`document.querySelector('[data-agent-preset="march7th"] .agent-preset-configure').click()`);
    if(!await js(`!document.getElementById('tab-march7th').hidden && document.getElementById('tab-agent-presets').hidden`))throw Error('三月七配置入口不可用');
    await js(`switchTab('agent-presets')`);await pause(400);
    await writeFile(path.join(out,'agent-presets.png'),(await win.webContents.capturePage()).toPNG());
    console.log('PASS Agent 预设卡片、选择状态、持久化、Agent 模式和三月七配置入口');
    win.hide();
    let duplicateCode;
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const duplicate=spawn(process.execPath,[path.resolve('desktop/verify-march7th-duplicate.mjs'),app.getPath('userData')],{windowsHide:true,env,stdio:'inherit'});
    duplicate.once('exit',code=>duplicateCode=code);
    await waitFor(()=>duplicateCode!==undefined,'重复实例退出');
    if(duplicateCode!==0)throw Error('重复实例退出码错误：'+duplicateCode);
    await waitFor(()=>win.isVisible(),'重复启动唤起窗口');
    if(duplicateCode!==0)throw Error('重复实例退出码错误');
    console.log('PASS 真实 Electron 重复实例退出并唤起隐藏主窗口');
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
})();
