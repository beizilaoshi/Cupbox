// Load an installed copy using the development Electron test runner; isolate all user state.
import { app } from 'electron';
app.commandLine.appendSwitch('mute-audio');
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
  win.webContents.setBackgroundThrottling(false);
  win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  win.webContents.once('did-finish-load',async()=>{
    try{
      const js=source=>win.webContents.executeJavaScript(source);
      await js(`new Promise((resolve,reject)=>{let count=0;const timer=setInterval(()=>{if(window.cupboxReady){clearInterval(timer);resolve();}else if(++count>200){clearInterval(timer);reject(Error('UI not ready'));}},50);})`);
      if(!await js(`document.querySelector('#ver-chip').textContent==='v1.1.0'`))throw Error('Incorrect installed version');
      console.log('PASS installed application loads with version 1.1.0');
      if(!await js(`Boolean(document.querySelector('#chat-model-picker')&&document.querySelector('#reasoning-slider'))`))throw Error('Missing picker');
      console.log('PASS installed model picker and effort slider available');
      if(!await js(`Boolean(document.querySelector('#main-plugin-search')&&document.querySelector('#agent-custom-add'))`))throw Error('Missing preset/plugin settings');
      const pluginCatalog=await js(`cupbox.agentPlugins()`);
      if(!Array.isArray(pluginCatalog)||pluginCatalog.length!==6)throw Error('Installed plugin bridge unavailable');
      console.log('PASS installed custom presets and six session plugins available');
      if(!await js(`Boolean(document.querySelector('#pet-holiday-auto')&&document.querySelector('#pet-festival-wardrobe')&&!document.querySelector('#pet-festival-wardrobe').open&&CupboxPetArt.outfits.length===15&&CupboxPetArt.outfits.filter(o=>o.festival).length===11)`))throw Error('Missing holiday wardrobe');
      const petConfig=await js(`cupbox.petState()`);
      if(typeof petConfig.config.holidayAuto!=='boolean'||!petConfig.wardrobe?.outfit)throw Error('Missing local calendar runtime');
      console.log('PASS installed fifteen-outfit wardrobe including eleven festivals and local calendar runtime available');
      const cfg=await js(`cupbox.aiConfigGet()`);
      if(!cfg.ok||cfg.config.model!=='installer-preserve-test')throw Error('Existing configuration changed');
      console.log('PASS installation preserves existing model configuration');
      if(!await js(`document.querySelector('#btn-model').click();!document.querySelector('#chat-model-picker').hidden`))throw Error('Picker cannot open');
      console.log('PASS installed preload bridge and interactions work');
      if(errors.length)throw Error(errors.join('\n'));
      console.log('PASS installed renderer has no errors');
      await mkdir(path.resolve('output/installer-review'),{recursive:true});
      await writeFile(path.resolve('output/installer-review/installed-app.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
      const pkg=JSON.parse(await readFile(path.join(installed,'resources/app/package.json'),'utf8'));
      if(pkg.version!=='1.1.0')throw Error('Incorrect package version');
      clearTimeout(timeout);app.exit(0);
    }catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}
  });
});
await import(pathToFileURL(path.join(installed,'resources/app/desktop/main.js')).href);
