import {app,BrowserWindow} from 'electron';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const out=path.resolve('output/packaged-preset-review');await mkdir(out,{recursive:true});
process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.webContents.setBackgroundThrottling(false);});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,label)=>{if(!ok)throw Error(label);console.log('PASS '+label);};
void (async()=>{try{
 await import('../output/installer-stage/Cupbox/resources/app/desktop/main.js');
 let win;for(let i=0;i<150;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading()&&await win.webContents.executeJavaScript('Boolean(window.cupboxReady)').catch(()=>false))break;await pause(100);}
 const js=s=>win.webContents.executeJavaScript(s);win.setSize(1340,880);
 await js(`openModal('agent-presets');applyTheme('dark',prefs.accent)`);await pause(500);
 assert(await js(`document.querySelectorAll('[data-agent-preset]').length===5`),'保留五种预设');
 await js(`document.querySelector('[data-agent-preset="coding"] .agent-preset-select').click()`);await pause(350);
 assert(await js(`document.querySelector('[data-agent-preset="coding"] .agent-preset-select').getAttribute('aria-pressed')==='true'`),'卡片切换及选中状态');
 await writeFile(path.join(out,'dark.png'),(await win.webContents.capturePage()).toPNG());
 await js(`document.querySelector('[data-agent-preset="standard"] .agent-preset-info').click()`);
 assert(await js(`document.getElementById('agent-preset-dialog').open&&document.getElementById('agent-preset-detail-title').textContent.includes('模式说明')&&prefs.agentPreset==='coding'`),'说明弹窗不切换预设');
 await writeFile(path.join(out,'detail.png'),(await win.webContents.capturePage()).toPNG());
 await js(`document.getElementById('agent-preset-dialog').close();document.querySelectorAll('[data-agent-preset="standard"] .agent-preset-info')[1].click()`);
 assert(await js(`document.getElementById('agent-preset-detail-title').textContent.includes('如何使用')`),'如何使用入口');
 await win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});await win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await pause(100);
 assert(await js(`!document.getElementById('agent-preset-dialog').open`),'Esc关闭说明');
 await js(`document.querySelector('[data-agent-preset="march7th"] .agent-preset-configure').click()`);
 assert(await js(`!document.getElementById('tab-march7th').hidden`),'工作流配置入口');
 await js(`switchTab('agent-presets');applyTheme('light',prefs.accent)`);await pause(350);
 await writeFile(path.join(out,'light.png'),(await win.webContents.capturePage()).toPNG());
 win.setSize(1040,680);await pause(350);
 assert(await js(`(()=>{const g=document.getElementById('agent-preset-grid');return g.scrollWidth<=g.clientWidth+1&&[...g.querySelectorAll('.agent-preset-head')].every(e=>e.scrollWidth<=e.clientWidth+1)})()`),'最小窗口卡片无横向溢出');
 await writeFile(path.join(out,'compact.png'),(await win.webContents.capturePage()).toPNG());
 console.log('UI_REVIEW_OK');app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();


