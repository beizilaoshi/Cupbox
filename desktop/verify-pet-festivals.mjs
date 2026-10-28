import {pathToFileURL} from 'node:url';
import {app,BrowserWindow,powerMonitor} from 'electron';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const out=path.resolve('output/pet-festival-review');await mkdir(path.join(out,'home/.cupbox'),{recursive:true});
process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
await writeFile(path.join(out,'home/.cupbox/desktop.json'),JSON.stringify({startupEnabled:false}));
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
const errors=[];app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms)),check=(ok,label)=>{if(!ok)throw Error(label);console.log('PASS '+label);};
async function wait(fn,label){for(let n=0;n<240;n++){if(await fn())return;await pause(40);}throw Error(label);}
const timeout=setTimeout(()=>{console.error('Festival review timed out');app.exit(1);},180000);
void(async()=>{try{
 await import(process.env.CUPBOX_PET_REVIEW_APP?pathToFileURL(path.join(process.env.CUPBOX_PET_REVIEW_APP,'desktop/main.js')).href:'./main.js');await wait(()=>BrowserWindow.getAllWindows().length,'main window');const win=BrowserWindow.getAllWindows()[0],js=s=>win.webContents.executeJavaScript(s);
 await wait(()=>js(`Boolean(window.cupboxReady&&document.querySelectorAll('[data-pet-outfit]').length===CupboxPetArt.outfits.length)`).catch(()=>false),'wardrobe ready');
 await js(`Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});true`);
 check(await js(`!document.querySelector('#pet-festival-wardrobe').open&&document.querySelector('#pet-festival-outfits').children.length===11&&document.querySelector('#pet-outfits').children.length===9`),'eleven festival clothes are collapsed separately from daily clothes');
 await js(`document.querySelector('#btn-desktop-pet').click();true`);
 check(await js(`document.querySelector('#pet-holiday-auto').checked`),'automatic local date outfit enabled by default');
 await js(`document.querySelector('#pet-festival-wardrobe').open=true;document.querySelector('[data-pet-outfit="christmas"]').click();true`);
 await wait(()=>js(`document.querySelector('[data-pet-outfit="christmas"]').getAttribute('aria-pressed')==='true'&&!document.querySelector('#pet-holiday-auto').checked`),'manual festival choice pauses auto selection');
 check(await js(`(async()=>{const s=await cupbox.petState();return s.config.outfit==='christmas'&&s.config.holidayAuto===false&&s.wardrobe.outfit==='christmas';})()`),'manual choice really persists through backend');
 await js(`document.querySelector('#pet-holiday-auto').click();true`);await wait(()=>js(`document.querySelector('#pet-holiday-auto').checked`),'automatic selection restored');
 const NativeDate=globalThis.Date;let computerDate=new NativeDate(2026,11,25,12);
 globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[computerDate.getTime()]));}};
 try{
  await js(`cupbox.petConfigure({outfit:'cozy',holidayAuto:true,enabled:true})`);
  await wait(()=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet/pet.html')),'real pet window');
  const petWindow=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet/pet.html'));
  await wait(()=>petWindow.webContents.executeJavaScript(`document.querySelector('#character')?.dataset.outfit==='christmas'`).catch(()=>false),'Christmas skin reaches real desktop pet');
  check(true,'computer holiday date replaces the actual pet outfit');
  computerDate=new NativeDate(2026,11,26,12);powerMonitor.emit('resume');
  await wait(()=>petWindow.webContents.executeJavaScript(`document.querySelector('#character')?.dataset.outfit==='cozy'`).catch(()=>false),'resume restores manual outfit after holiday');
  check(await js(`(async()=>{const s=await cupbox.petState();return s.config.outfit==='cozy'&&s.wardrobe.outfit==='cozy';})()`),'resume and date rollover restore saved manual clothes without overwriting them');
 }finally{globalThis.Date=NativeDate;powerMonitor.emit('resume');await js(`cupbox.petConfigure({enabled:false})`);}
 for(const outfit of (process.env.CUPBOX_PET_REVIEW_OUTFITS?.split(',')||await js('CupboxPetArt.outfits.map(o=>o.id)'))){
  await js(`window.__walkEl=document.createElement('div');__walkEl.style.cssText='position:fixed;top:100px;left:100px;width:280px;height:280px;z-index:10000';document.body.append(__walkEl);window.__walkPlayer=CupboxPetArt.mount(__walkEl);__walkPlayer.configure({outfit:${JSON.stringify(outfit)},locomotion:{mode:'walking',frame:0,direction:1}});true`);
  await wait(()=>js(`__walkEl.dataset.outfit===${JSON.stringify(outfit)}&&__walkEl.dataset.blinkReady==='true'&&__walkEl.dataset.motionReady==='true'`),'walk assets '+outfit);
  await pause(250);
  const gait=await js(`(async()=>{const values=[];window.__walkBoard=document.createElement('canvas');__walkBoard.width=840;__walkBoard.height=840;const ctx=__walkBoard.getContext('2d');for(let frame=0;frame<60;frame++){__walkPlayer.configure({locomotion:{mode:'walking',frame,phase:frame/60,direction:1}});await new Promise(r=>setTimeout(r,40));const body=__walkEl.querySelector('.pet-motion-layer');values.push(body.toDataURL());if(frame%10===0){const tile=frame/10;ctx.fillStyle='#f5f1fa';ctx.fillRect(tile%3*280,Math.floor(tile/3)*280,280,280);ctx.drawImage(body,tile%3*280,Math.floor(tile/3)*280,280,280);}}return new Set(values).size;})()`);
  check(gait===60,outfit+' has sixty playback samples with intact original artwork: '+gait);
  if(outfit==='hanfu-wisteria'){
   await js(`__walkPlayer.configure({locomotion:{mode:'idle',frame:15,direction:1}});window.__nativeFrames=new Set();window.__nativeTimer=setInterval(()=>{const body=__walkEl.querySelector('.pet-motion-layer'),frame=body.dataset.sourceFrame;__nativeFrames.add(frame);const tile=frame==='15'?0:frame==='13'?2:1,ctx=__walkBoard.getContext('2d');ctx.fillStyle='#f5f1fa';ctx.fillRect(tile*280,560,280,280);ctx.drawImage(body,tile*280,560,280,280);},15);__walkPlayer.blink();true`);await pause(430);
   const native=await js(`(()=>{clearInterval(__nativeTimer);return{frames:[...__nativeFrames],end:__walkEl.querySelector('.pet-motion-layer').dataset.sourceFrame,warp:__walkEl.dataset.deformation};})()`);
   check(['12','13','14','15'].every(f=>native.frames.includes(f))&&native.end==='15'&&native.warp==='none',outfit+' plays four independently drawn blink frames without face patches');
  }else{
  await js(`window.__walkPhases=new Map();window.__walkObserver=new MutationObserver(()=>{const phase=Number(__walkEl.dataset.blink);if(!__walkPhases.has(phase)){const body=__walkEl.querySelector('.pet-motion-layer'),eyes=__walkEl.querySelector('.pet-blink-layer');__walkPhases.set(phase,eyes.toDataURL());const ctx=__walkBoard.getContext('2d');ctx.fillStyle='#f5f1fa';ctx.fillRect((phase===2?2:phase>0?1:0)*280,560,280,280);ctx.drawImage(body,(phase===2?2:phase>0?1:0)*280,560,280,280);}});__walkObserver.observe(__walkEl,{attributes:true,attributeFilter:['data-blink']});window.__walkStep=0;window.__walkTimer=setInterval(()=>{__walkStep++;__walkPlayer.configure({locomotion:{mode:'walking',frame:__walkStep%60,phase:(__walkStep%60)/60,direction:__walkStep<12?1:-1}});},16);__walkPlayer.blink();true`);
  await wait(()=>js(`__walkPhases.size>=20&&__walkEl.dataset.blink==='0'`),'complete smooth blink cycle');
  check(await js(`__walkPhases.size>=15&&new Set(__walkPhases.values()).size>=15&&__walkEl.dataset.blink==='0'`),outfit+' keeps thirty smooth blink samples while walking and turning');
  check(await js(`__walkEl.querySelector('.pet-blink-layer').style.transform===__walkEl.querySelector('.pet-motion-layer').style.transform&&__walkEl.querySelector('.pet-motion-layer').style.transform.includes('scaleX(1)')`),outfit+' eyes and body stay aligned without a sudden mirror flip');
  }
  const data=await js(`__walkBoard.toDataURL().split(',')[1]`);await writeFile(path.join(out,outfit+'-walking-blink.png'),Buffer.from(data,'base64'));
  await js(`clearInterval(window.__walkTimer);window.__walkObserver?.disconnect();__walkPlayer.configure({locomotion:{mode:'idle',frame:15,direction:1}});true`);await pause(250);
  check(await js(`__walkEl.querySelector('.pet-blink-layer').style.transform==='none'`),outfit+' stop clears walking transforms');
  if(!['sakura','academy','cozy','starlight'].includes(outfit)){
   await js(`__walkPlayer.configure({locomotion:{mode:'held',frame:6,direction:1}});__walkPlayer.blink();true`);await pause(600);
   check(await js(`__walkEl.querySelector('.pet-motion-layer').dataset.sourceFrame==='15'&&__walkEl.dataset.blinkReady==='true'&&__walkEl.dataset.blink==='0'`),outfit+' held and falling reuse dangling-feet pose instead of seated expression');
  }
  await js(`__walkPlayer.configure({motion:false});__walkPlayer.blink();true`);await pause(70);check(await js(`__walkEl.dataset.blink==='0'`),outfit+' motion off suppresses blinking');
  await js(`__walkPlayer.destroy();__walkEl.remove();true`);
 }
 await js(`document.querySelector('#pet-demo-walking').click();true`);await pause(220);win.webContents.invalidate();await pause(100);
 await writeFile(path.join(out,'wardrobe-settings.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 check(errors.length===0,'no renderer errors '+errors.join(';'));console.log('PET_FESTIVALS_OK');clearTimeout(timeout);app.exit(0);
}catch(error){console.error(error,errors);clearTimeout(timeout);app.exit(1);}})();
