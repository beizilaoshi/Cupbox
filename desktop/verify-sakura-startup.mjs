import {app,BrowserWindow} from 'electron';import path from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';
const out=path.resolve('output/sakura-startup-review');await mkdir(path.join(out,'home/.cupbox'),{recursive:true});process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';await writeFile(path.join(out,'home/.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,startupDuration:2.8}));app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
const errors=[];app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms)),check=(ok,label)=>{if(!ok)throw Error(label);console.log('PASS '+label);};async function wait(fn,label){for(let i=0;i<220;i++){if(await fn())return;await pause(40);}throw Error(label);}
void(async()=>{try{
 await import('./main.js');await wait(()=>BrowserWindow.getAllWindows().length,'main');const main=BrowserWindow.getAllWindows()[0],js=s=>main.webContents.executeJavaScript(s);await wait(()=>js(`Boolean(window.cupboxReady&&window.CupboxSakuraScene)`).catch(()=>false),'ready');await js(`Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});true`);
 check(await js(`cupbox.prefsGet().then(p=>p.startupDuration===5&&CupboxStartup.defaults.startupDuration===5)`),'five-second default follows former built-in duration');
 await js(`cupbox.prefsSet({startupDuration:2.8,startupDurationCustomized:true})`);check(await js(`cupbox.prefsGet().then(p=>p.startupDuration===2.8)`),'explicit custom duration survives preference reload');await js(`cupbox.prefsSet({startupDuration:5,startupDurationCustomized:false})`);
 check(await js(`document.querySelector('#ver-chip').textContent==='v1.1.0'`),'UI version 1.1.0');
 for(const theme of ['light','dark']){
  await js(`document.documentElement.dataset.theme=${JSON.stringify(theme)};window.__startupResult=null;CupboxStartup.play({startupStyle:'orbit',startupDuration:5,startupCaption:'让灵感，轻轻启程。'},{preview:true}).then(r=>window.__startupResult=r);true`);await pause(150);
  check(await js(`document.getElementById('startup-screen').dataset.scenePhase==='gather'`),theme+' opening gathers petals');
  await wait(()=>js(`document.getElementById('startup-screen').dataset.scenePhase==='bloom'`),theme+' bloom phase');
  await writeFile(path.join(out,theme+'-bloom.png'),(await main.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  await wait(()=>js(`document.getElementById('startup-screen').dataset.scenePhase==='drift'`),theme+' drift phase');await pause(250);
  check(await js(`getComputedStyle(document.querySelector('.startup-wordmark')).backgroundImage.includes('linear-gradient')&&getComputedStyle(document.querySelector('.startup-wordmark')).webkitTextFillColor==='rgba(0, 0, 0, 0)'`),theme+' wordmark uses real gradient text');
  check(await js(`getComputedStyle(document.querySelector('#startup-screen h1')).backdropFilter.includes('blur(24px)')`),theme+' title panel uses real frosted-glass blur');
  check(await js(`document.getElementById('startup-backdrop').src.endsWith('/startup-sakura-frost.png')`),theme+' character-free anime artwork selected');
  check(await js(`!document.getElementById('startup-screen').hidden&&document.querySelector('.startup-sakura').width>100&&document.querySelector('.startup-sakura').height>100`),theme+' canvas visible and sized');
  check(await js(`document.getElementById('startup-backdrop').complete&&document.getElementById('startup-backdrop').naturalWidth>1000`),theme+' dreamscape artwork loads');
  const first=await js(`document.querySelector('.startup-sakura').toDataURL()`);await pause(180);check(first!==await js(`document.querySelector('.startup-sakura').toDataURL()`),theme+' petals actually move');
  check(await js(`document.activeElement.id==='skip-startup'&&document.getElementById('settings-modal').inert`),theme+' keyboard focus and background input guarded');
  await writeFile(path.join(out,theme+'.png'),(await main.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  await js(`document.getElementById('skip-startup').click()`);await pause(30);check(await js(`document.getElementById('startup-screen').hidden&&document.querySelector('.startup-sakura').hidden&&!document.getElementById('settings-modal').inert&&__startupResult===true`),theme+' skip stops canvas and restores interaction');
 }
 await js(`CupboxStartup.play({startupStyle:'orbit',startupDuration:5},{preview:true});CupboxStartup.play({startupStyle:'pulse',startupDuration:.8},{preview:true});true`);check(await js(`document.querySelectorAll('.startup-sakura').length===1&&document.querySelector('.startup-sakura').hidden`),'repeated preview reuses scene and stops sakura for other styles');await pause(1000);check(await js(`document.getElementById('startup-screen').hidden`),'duration automatically ends introduction');
 check(await js(`CupboxStartup.play({startupEnabled:false}).then(r=>r===false)`),'disabled startup stays disabled');
 main.webContents.debugger.attach('1.3');await main.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(50);check(await js(`CupboxStartup.play({startupStyle:'orbit'},{preview:true}).then(r=>r===false)`),'reduced motion skips scene');main.webContents.debugger.detach();
 check(errors.length===0,'no renderer errors '+errors.join(';'));console.log('SAKURA_STARTUP_OK');app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();
