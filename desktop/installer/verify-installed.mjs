// Load an installed copy using the development Electron test runner; isolate all user state.
import { app } from 'electron';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const home=process.env.CUPBOX_HOME;
const installed=process.env.CUPBOX_INSTALL_TEST_ROOT;
if(!home||!installed)throw Error('CUPBOX_HOME and CUPBOX_INSTALL_TEST_ROOT are required');
app.setPath('userData',path.join(home,'electron-test-profile'));
app.disableHardwareAcceleration();
const errors=[];
const timeout=setTimeout(()=>{console.error('FAIL installed UI timeout');app.exit(1);},30000);
app.on('browser-window-created',(_event,win)=>{
  win.hide();win.show=()=>{};
  win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  win.webContents.once('did-finish-load',async()=>{
    try{
      const js=source=>win.webContents.executeJavaScript(source);
      await js(`new Promise((resolve,reject)=>{let count=0;const timer=setInterval(()=>{if(window.cupboxReady){clearInterval(timer);resolve();}else if(++count>200){clearInterval(timer);reject(Error('UI not ready'));}},50);})`);
      if(!await js(`document.querySelector('#ver-chip').textContent==='v1.0.2'`))throw Error('Incorrect installed version');
      console.log('PASS installed application loads with version 1.0.2');
      if(!await js(`Boolean(document.querySelector('#chat-model-picker')&&document.querySelector('#reasoning-slider'))`))throw Error('Missing picker');
      console.log('PASS installed model picker and effort slider available');
      const cfg=await js(`cupbox.aiConfigGet()`);
      if(!cfg.ok||cfg.config.model!=='installer-preserve-test')throw Error('Existing configuration changed');
      console.log('PASS installation preserves existing model configuration');
      if(!await js(`document.querySelector('#btn-model').click();!document.querySelector('#chat-model-picker').hidden`))throw Error('Picker cannot open');
      console.log('PASS installed preload bridge and interactions work');
      if(errors.length)throw Error(errors.join('\n'));
      console.log('PASS installed renderer has no errors');
      await mkdir(path.resolve('output/installer-review'),{recursive:true});
      await writeFile(path.resolve('output/installer-review/installed-app.png'),(await win.webContents.capturePage()).toPNG());
      const pkg=JSON.parse(await readFile(path.join(installed,'resources/app/package.json'),'utf8'));
      if(pkg.version!=='1.0.2')throw Error('Incorrect package version');
      clearTimeout(timeout);app.exit(0);
    }catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}
  });
});
await import(pathToFileURL(path.join(installed,'resources/app/desktop/main.js')).href);
