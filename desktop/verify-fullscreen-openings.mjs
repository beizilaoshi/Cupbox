// Record native presentation frames: the preview contains the actual DOM and Canvas animation.
import {app,BrowserWindow} from 'electron';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const out=path.resolve('output/fullscreen-openings-review');await mkdir(path.join(out,'home/.cupbox'),{recursive:true});
process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
await writeFile(path.join(out,'home/.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,petEnabled:false,musicEnabled:false}));
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('mute-audio');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),errors=[];
app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
setTimeout(()=>{console.error('Fullscreen preview timeout');app.exit(1);},100000).unref();
void(async()=>{try{
 await import('./main.js');let main;for(let i=0;i<200;i++){main=BrowserWindow.getAllWindows()[0];if(main&&await main.webContents.executeJavaScript('Boolean(window.cupboxReady)').catch(()=>false))break;await pause(50);}
 if(!main)throw Error('Main window unavailable');const js=s=>main.webContents.executeJavaScript(s);main.setMinimumSize(960,680);main.setSize(1100,740);await pause(200);
 const sakura=await js(`(()=>{const s=document.querySelector('#startup-screen');s.dataset.style='orbit';CupboxStartupScenes.configure(s,'orbit');return [getComputedStyle(s.querySelector('.startup-content')).backgroundImage,s.dataset.fullstage,CupboxStartup.defaults.startupStyle,CupboxStartup.defaults.startupDuration]})()`);
 if(sakura[1]!=='false'||sakura[2]!=='orbit'||sakura[3]!==5)throw Error('Sakura default changed');
 for(const style of ['prism','quantmatrix','moonsea']){
  const frames=[];let start=0,last=0;
  main.webContents.beginFrameSubscription(false,img=>{const now=performance.now();if(!start||now-last<70||now-start>4900)return;last=now;frames.push({time:now-start,png:img.resize({width:880,quality:'good'}).toJPEG(88)});});
  start=performance.now();await js(`void CupboxStartup.play({...prefs,startupStyle:'${style}',startupDuration:5},{preview:true})`);
  await main.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await pause(3700);
  const brand=await js(`(()=>{const screen=document.querySelector('#startup-screen'),content=screen.querySelector('.startup-content'),name=screen.querySelector('.startup-wordmark'),r=name.getBoundingClientRect(),s=getComputedStyle(content);return {full:screen.dataset.fullstage==='true',center:Math.abs((r.left+r.right)/2-innerWidth/2)<5,opacity:getComputedStyle(name.parentElement).opacity,card:s.backgroundImage!=='none'||s.backdropFilter!=='none',phase:screen.dataset.scenePhase}})()`);
  if(!brand.full||!brand.center||brand.opacity!=='1'||brand.card||brand.phase!=='signature')throw Error('Fullscreen brand direction invalid: '+JSON.stringify(brand));
  await writeFile(path.join(out,style+'-brand.png'),(await main.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  await pause(1550);main.webContents.endFrameSubscription();
  if(frames.length<8)throw Error('Insufficient native frames: '+frames.length);
  for(const [name,time]of [['approach',1500],['signature',4200]]){const selected=frames.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b);await sharp(selected.png).png().toFile(path.join(out,style+'-'+name+'.png'));}
  const delays=frames.map((f,i)=>i+1<frames.length?Math.max(20,Math.round((frames[i+1].time-f.time)/10)*10):200);
  await sharp(frames.map(f=>f.png),{join:{animated:true}}).gif({delay:delays,loop:0,colours:192,effort:3,dither:.25}).toFile(path.join(out,style+'.gif'));
  if(!await js(`document.querySelector('#startup-screen').hidden&&!CupboxStartup.sceneRunning&&!document.querySelector('.layout').inert&&document.querySelector('#startup-screen').dataset.fullstage==='false'`))throw Error('Scene did not release resources');
  console.log('PASS '+style+': '+frames.length+' native frames, centered brand, no card, phased animation and cleanup');
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS native fullscreen previews; Sakura remains the default');app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();
