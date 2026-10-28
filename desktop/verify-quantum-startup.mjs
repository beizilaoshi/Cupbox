// Capture the real renderer at each narrative beat, using an isolated preference directory.
import {app,BrowserWindow} from 'electron';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const out=path.resolve('output/quantum-startup-review');await mkdir(path.join(out,'home/.cupbox'),{recursive:true});
process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
await writeFile(path.join(out,'home/.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,petEnabled:false,musicEnabled:false}));
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('mute-audio');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),errors=[];
app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
setTimeout(()=>{console.error('Quantum verification timeout');app.exit(1);},60000).unref();
void(async()=>{try{
 await import('./main.js');let main;for(let i=0;i<200;i++){main=BrowserWindow.getAllWindows()[0];if(main&&await main.webContents.executeJavaScript('Boolean(window.cupboxReady)').catch(()=>false))break;await pause(50);}
 if(!main)throw Error('Main window unavailable');const js=s=>main.webContents.executeJavaScript(s);main.setSize(1340,880);await pause(150);
 for(const style of ['quantmatrix','quantorbit']){
  await js(`void CupboxStartup.play({...prefs,startupStyle:'${style}',startupDuration:5},{preview:true})`);
  const start=performance.now(),frames=[],delays=[];let previous=start;
  for(let i=0;i<14;i++){
   await pause(Math.max(0,start+160+i*300-performance.now()));
   if(await js('document.querySelector("#startup-screen").hidden'))break;
   const png=(await main.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG();
   const now=performance.now();if(frames.length)delays.push(Math.max(20,Math.round((now-previous)/10)*10));previous=now;
   frames.push(await sharp(png).resize(900).png().toBuffer());
   if([2,6,10].includes(i))await writeFile(path.join(out,`${style}-${i}.png`),png);
  }
  await pause(650);if(!await js(`document.querySelector('#startup-screen').hidden&&!CupboxStartup.sceneRunning&&!document.querySelector('.layout').inert&&document.querySelector('#startup-screen').dataset.cinematic==='false'`))throw Error('Completion did not reset scene: '+style);
  if(frames.length<6)throw Error('Insufficient actual animation frames');delays.push(350);
  await sharp(frames,{join:{animated:true}}).gif({delay:delays,loop:0,colours:128,effort:3}).toFile(path.join(out,`${style}.gif`));
  console.log('PASS '+style+' multi-stage animation, brand hold and automatic cleanup ('+frames.length+' frames)');
 }
 main.setMinimumSize(960,680);main.setSize(960,680);await pause(100);
 for(const style of ['quantmatrix','quantorbit']){
  await js(`void CupboxStartup.play({...prefs,startupStyle:'${style}',startupDuration:5},{preview:true})`);await pause(3400);
  if(!await js(`(()=>{const screen=document.querySelector('#startup-screen'),logo=screen.querySelector('.startup-logo'),name=screen.querySelector('.startup-wordmark');return screen.dataset.cinematic==='true'&&logo.complete&&logo.naturalWidth>0&&getComputedStyle(logo).opacity==='1'&&name.textContent==='Cupbox'&&getComputedStyle(name.parentElement).opacity==='1'&&['.startup-logo','.startup-wordmark','.startup-tagline'].every(s=>{const r=screen.querySelector(s).getBoundingClientRect();return r.width>0&&r.left>=0&&r.top>=50&&r.right<=innerWidth&&r.bottom<=innerHeight})})()`))throw Error('Compact branding missing or overflowing: '+style);
  await writeFile(path.join(out,style+'-compact.png'),(await main.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  await js('CupboxStartup.skip()');
  await js(`void CupboxStartup.play({...prefs,startupStyle:'${style}',startupDuration:.8},{preview:true})`);await pause(950);
  if(!await js(`document.querySelector('#startup-screen').hidden&&!CupboxStartup.sceneRunning`))throw Error('Short duration did not finish');
 }
 console.log('PASS both cinematic scenes fit 960px window, skip and compressed .8s timelines');
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS no renderer errors');app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();
