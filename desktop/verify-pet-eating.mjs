import {app,BrowserWindow} from 'electron';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const out=path.resolve(process.env.CUPBOX_EATING_REVIEW_DIR||'output/pet-eating-review');await mkdir(path.join(out,'home/.cupbox'),{recursive:true});
process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
await writeFile(path.join(out,'home/.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,musicEnabled:false}));
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();const errors=[];
app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function wait(fn,label){for(let i=0;i<300;i++){if(await fn())return;await pause(40);}throw Error('Timeout '+label);}
void(async()=>{try{
 await import(process.env.CUPBOX_PET_REVIEW_APP?pathToFileURL(path.join(process.env.CUPBOX_PET_REVIEW_APP,'desktop/main.js')).href:'./main.js');await wait(()=>BrowserWindow.getAllWindows().length,'main');
 const main=BrowserWindow.getAllWindows()[0],js=s=>main.webContents.executeJavaScript(s);await wait(()=>js(`Boolean(window.cupboxReady&&window.CupboxPetArt)`).catch(()=>false),'art');
 await js(`(()=>{window.eatHost=document.createElement('div');eatHost.style.cssText='width:384px;height:384px;position:fixed;top:0;left:0;z-index:99999;background:#f0edf7';document.body.append(eatHost);window.eatPlayer=CupboxPetArt.mount(eatHost);window.eatBoard=document.createElement('canvas');eatBoard.width=1600;eatBoard.height=1000;const ctx=eatBoard.getContext('2d');ctx.fillStyle='#f0edf7';ctx.fillRect(0,0,1600,1000);})()`);
 const outfits=(await js(`CupboxPetArt.outfits`)).filter(o=>!process.env.CUPBOX_EATING_OUTFITS||process.env.CUPBOX_EATING_OUTFITS.split(',').includes(o.id));for(let i=0;i<outfits.length;i++){
  const id=outfits[i].id;await js(`eatPlayer.configure({outfit:'${id}',pose:'eating',motion:true,loop:true,restart:true,locomotion:{mode:'idle',frame:15}})`);
  await wait(()=>js(`eatHost.dataset.eatingReady==='true'&&eatHost.dataset.outfit==='${id}'&&!eatHost.querySelector('.pet-motion-layer').hidden`),id+' load');
  const frames=new Set();for(let j=0;j<22;j++){await pause(95);frames.add(await js(`eatHost.querySelector('.pet-motion-layer').dataset.sourceFrame`));}
  if(frames.size<12)throw Error(id+' stalled eating frames '+[...frames]);
  const height=await js(`(()=>{const data=eatHost.querySelector('.pet-motion-layer').getContext('2d').getImageData(0,0,384,384).data;let top=384,bottom=0;for(let y=0;y<384;y++)for(let x=0;x<384;x++)if(data[(y*384+x)*4+3]>64){top=Math.min(top,y);bottom=Math.max(bottom,y);}return bottom-top+1;})()`);if(height<270)throw Error(id+' eating figure unexpectedly shrunk: '+height);
  await js(`(()=>{const ctx=eatBoard.getContext('2d');ctx.drawImage(eatHost.querySelector('.pet-motion-layer'),${i%8*200},${Math.floor(i/8)*330},200,280);ctx.fillStyle='#43546f';ctx.textAlign='center';ctx.font='16px "Microsoft YaHei"';ctx.fillText('${outfits[i].name}',${i%8*200+100},${Math.floor(i/8)*330+300});eatPlayer.configure({motion:false});})()`);
  const a=await js(`eatHost.querySelector('.pet-motion-layer').dataset.sourceFrame`);await pause(180);if(await js(`eatHost.querySelector('.pet-motion-layer').dataset.sourceFrame`)!==a)throw Error(id+' motion toggle ignored');
  console.log('PASS '+id+' eating, '+frames.size+' live frames, pause and outfit isolation');
 }
 await writeFile(path.join(out,'all-outfits-eating.png'),Buffer.from(await js(`eatBoard.toDataURL().split(',')[1]`),'base64'));
 await js(`eatPlayer.destroy();eatHost.remove()`);if(errors.length)throw Error(errors.join(';'));console.log('PET_EATING_OK '+outfits.length+' outfits');app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();
