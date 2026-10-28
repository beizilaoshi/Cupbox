import {app,BrowserWindow} from 'electron';
import path from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const out=path.resolve('output/pet-care-review'),home=path.join(out,'home');await mkdir(home,{recursive:true});
process.env.CUPBOX_HOME=home;process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
await mkdir(path.join(home,'.cupbox'),{recursive:true});const prefsFile=path.join(home,'.cupbox/desktop.json');await writeFile(prefsFile,JSON.stringify({startupEnabled:false,musicEnabled:false,untouchedMarker:'keep-me',desktopPet:{enabled:false,outfit:'hanfu-wisteria',holidayAuto:false},desktopPetCare:{affection:49.99,satiety:40,energy:60,mood:60,updatedAt:Date.now()}}));
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();const errors=[];
app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms)),check=(ok,label)=>{if(!ok)throw Error(label);console.log('PASS '+label);};
async function wait(fn,label){for(let i=0;i<240;i++){if(await fn())return;await pause(40);}throw Error('Timeout '+label);}
void(async()=>{try{
 await import(process.env.CUPBOX_PET_REVIEW_APP?pathToFileURL(path.join(process.env.CUPBOX_PET_REVIEW_APP,'desktop/main.js')).href:'./main.js');await wait(()=>BrowserWindow.getAllWindows().length,'main');
 const main=BrowserWindow.getAllWindows()[0],js=s=>main.webContents.executeJavaScript(s);await wait(()=>js(`Boolean(window.cupboxReady&&document.querySelectorAll('[data-pet-care]').length===5)`).catch(()=>false),'care controls');await js(`openModal('pet')`);
 check(await js(`document.querySelector('#pet-care-affection').textContent==='49.99 / 1000'&&document.querySelector('#pet-care-stage').textContent==='初次相遇'`),'saved affection is visible in settings before enabling pet');
 await js(`cupbox.petConfigure({enabled:true,bubbles:true,motion:true,roam:false})`);let feedingWindow;await wait(()=>{feedingWindow=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet/pet.html'));return feedingWindow&&!feedingWindow.webContents.isLoading();},'feeding window');
 const fj=s=>feedingWindow.webContents.executeJavaScript(s);await wait(()=>fj(`document.querySelector('#character').dataset.motionReady==='true'`).catch(()=>false),'feeding artwork');
 await js(`document.querySelector('[data-pet-care="feed"]').click();true`);await wait(()=>js(`document.querySelector('#pet-care-affection').textContent==='50.02 / 1000'`),'feed saved');
 check(await js(`document.querySelector('#pet-care-stage').textContent==='渐渐熟悉'&&Number(document.querySelector('#pet-care-satiety').value)===65&&document.querySelector('[data-pet-care="treat"]').disabled`),'meal changes needs, unlocks a relationship stage and shares food cooldown');
 await wait(()=>fj(`document.querySelector('#character').dataset.pose==='eating'&&document.querySelector('#character').dataset.eatingReady==='true'`),'native eating pose');const eatenFrames=new Set();for(let i=0;i<8;i++){await pause(140);eatenFrames.add(await fj(`document.querySelector('.pet-motion-layer').dataset.sourceFrame`));}check(eatenFrames.size>=6,'a real meal plays changing drawn eating frames in the native pet');await writeFile(path.join(out,'native-eating.png'),(await feedingWindow.webContents.capturePage()).toPNG());
 check(await js(`cupbox.petCare('feed').then(r=>!r.accepted&&r.state.care.affection===50.02)`),'backend blocks repeated feeding even through direct IPC');
 check(await js(`cupbox.prefsSet({desktopPetCare:{affection:1000}}).then(r=>!r.ok)`),'generic preference updates cannot overwrite care progress');
 check(await js(`cupbox.petCare('set-affection').then(()=>false,()=>true)`),'unknown interaction commands are rejected');
 await js(`document.querySelector('[data-pet-care="play"]').click();true`);await wait(()=>js(`!document.querySelector('#pet-play-arena').hidden`),'inline play arena');
 check(await js(`cupbox.petState().then(s=>s.care.affection===50.02&&s.care.play.hits===0)`),'starting a game does not award affection');
 await js(`cupbox.petConfigure({enabled:true,bubbles:true,motion:true,roam:false})`);
 const gameWindow=await(async()=>{let w;await wait(()=>{w=BrowserWindow.getAllWindows().find(item=>item.webContents.getURL().endsWith('/pet/pet.html'));return w&&!w.webContents.isLoading();},'game window');return w;})();const gj=s=>gameWindow.webContents.executeJavaScript(s);
 await wait(()=>gj(`!document.querySelector('#pet-play-toy').hidden&&document.querySelector('#character').dataset.motionReady==='true'`).catch(()=>false),'native toy');
 const point=await gj(`(()=>{const r=document.querySelector('#pet-play-toy').getBoundingClientRect();return{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);gameWindow.webContents.sendInputEvent({type:'mouseMove',...point});await pause(60);gameWindow.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});gameWindow.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});
 await wait(()=>js(`cupbox.petState().then(s=>s.care.play?.hits===1)`),'real native toy hit');await wait(()=>gj(`document.querySelector('#pet-play-toy').dataset.step==='1'&&document.querySelector('#bubble').textContent.includes('还差2')`),'native toy and progress stay synchronized');await pause(250);await writeFile(path.join(out,'native-play.png'),(await gameWindow.webContents.capturePage()).toPNG());
 check(await js(`cupbox.petState().then(s=>s.care.affection===50.02)`),'native mouse click advances the shared game without premature reward');
 for(let i=2;i<=3;i++){
await js(`document.querySelector('#pet-play-toy').click();true`);await pause(300);if(i<3)check(await js(`cupbox.petState().then(s=>s.care.play.hits===${i}&&s.care.affection===50.02)`),'toy hit '+i+' is counted without premature reward');}
 await wait(()=>js(`document.querySelector('#pet-care-affection').textContent==='50.08 / 1000'`),'game complete');
 check(await js(`document.querySelector('#pet-play-arena').hidden&&document.querySelector('[data-pet-care="play"]').disabled`),'third hit awards one game reward and begins cooldown');
 await js(`document.querySelector('[data-pet-care="groom"]').click();true`);await wait(()=>js(`document.querySelector('#pet-care-affection').textContent==='50.10 / 1000'`),'groom saved');
 await js(`document.querySelector('[data-pet-care="nap"]').click();true`);await wait(()=>js(`document.querySelector('#pet-care-affection').textContent==='50.11 / 1000'`),'nap saved');
 const saved=JSON.parse(await readFile(prefsFile,'utf8'));check(saved.desktopPetCare.affection===50.11&&saved.desktopPetCare.history.length===4&&saved.untouchedMarker==='keep-me','care history and progress are stored locally without replacing other preferences');
 await js(`cupbox.petConfigure({enabled:true,bubbles:true,motion:true,roam:false})`);let petWindow;await wait(()=>{petWindow=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet/pet.html'));return petWindow&&!petWindow.webContents.isLoading();},'pet');const pj=s=>petWindow.webContents.executeJavaScript(s);
 await wait(()=>pj(`Boolean(document.querySelectorAll('[data-pet-care]').length===5&&document.querySelector('#character').dataset.motionReady==='true')`).catch(()=>false),'native care menu');
 check(await pj(`document.querySelector('#pet-feed').disabled&&document.querySelector('#pet-play').disabled`),'native toolbar reflects the same cooldowns as settings');
 await pj(`pet.care('groom')`);check(await js(`cupbox.petState().then(s=>s.care.affection===50.11)`),'native controls cannot bypass shared reward limits');
 await js(`cupbox.petConfigure({size:60})`);await pause(100);check(await pj(`(()=>{const r=document.querySelector('#toolbar').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()`),'feeding and play toolbar fit the smallest pet window');await pj(`document.querySelector('#more').click();true`);check(await pj(`(()=>{const r=document.querySelector('#menu').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})()`),'expanded care menu stays inside the smallest window');
 await js(`cupbox.petConfigure({enabled:false})`);await js(`cupbox.petConfigure({enabled:true})`);
 check(await js(`cupbox.petState().then(s=>s.care.affection===50.11&&s.care.history.length===4)`),'hiding and reopening the pet preserves progress');
 await wait(()=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('/pet/pet.html')&&!w.webContents.isLoading()),'reopened pet ready');await js(`cupbox.petConfigure({enabled:false})`);await js(`document.querySelector('.pet-care-card').scrollIntoView({block:'start'});true`);await pause(100);
 for(const theme of ['light','dark']){await js(`applyTheme('${theme}','aurora');true`);await pause(400);await writeFile(path.join(out,'settings-'+theme+'.png'),(await main.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
 check(await js(`document.querySelector('#tab-pet').scrollWidth<=document.querySelector('#tab-pet').clientWidth+1`),'care card has no horizontal overflow');
 main.setSize(960,640);await pause(200);check(await js(`document.querySelector('#tab-pet').scrollWidth<=document.querySelector('#tab-pet').clientWidth+1`),'care controls fit the minimum main window');
 check(errors.length===0,'no renderer errors '+errors.join(';'));console.log('PET_CARE_OK');app.exit(0);
}catch(error){console.error(error,errors);app.exit(1);}})();
