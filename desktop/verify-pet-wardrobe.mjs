import {app,BrowserWindow} from 'electron';import path from 'node:path';import {mkdir,writeFile,readFile} from 'node:fs/promises';
const out=path.resolve('output/pet-wardrobe-review');await mkdir(path.join(out,'home/.cupbox'),{recursive:true});
process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';await writeFile(path.join(out,'home/.cupbox/desktop.json'),JSON.stringify({startupEnabled:false}));
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();const errors=[];
app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms)),assert=(ok,msg)=>{if(!ok)throw Error(msg);console.log('PASS '+msg);};
async function wait(fn,msg){for(let i=0;i<160;i++){if(await fn())return;await pause(50);}throw Error('timeout '+msg);}
void(async()=>{try{
 await import('./main.js');await wait(()=>BrowserWindow.getAllWindows().length,'main');const main=BrowserWindow.getAllWindows()[0],js=s=>main.webContents.executeJavaScript(s);
 await wait(()=>js(`Boolean(window.cupboxReady&&window.CupboxPetArt)`).catch(()=>false),'UI ready');await js(`openModal('pet')`);
 assert(await js(`document.querySelectorAll('[data-pet-outfit]').length===20&&document.querySelectorAll('[data-pet-pose]').length===32`),'twenty outfits and thirty-two actions');
 assert(await js(`cupbox.petConfigure({outfit:'../../private'}).then(()=>false,()=>true)`),'outfit whitelist blocks arbitrary paths');
 await js(`cupbox.petConfigure({enabled:true})`);let petWin;await wait(()=>{petWin=BrowserWindow.getAllWindows().find(w=>w!==main);return petWin&&!petWin.webContents.isLoading();},'pet');const petJs=s=>petWin.webContents.executeJavaScript(s);
 for(const outfit of await js('CupboxPetArt.outfits.filter(o=>!o.festival).map(o=>o.id)')){
  await js(`document.querySelector('[data-pet-outfit="${outfit}"]').click()`);
  await wait(()=>js(`document.getElementById('pet-preview').dataset.outfit==='${outfit}'&&document.getElementById('pet-preview').dataset.loading==='false'&&!document.querySelector('[data-pet-outfit="${outfit}"]').disabled`),'preview '+outfit);
  await wait(()=>petJs(`document.getElementById('character').dataset.outfit==='${outfit}'&&document.getElementById('character').dataset.loading==='false'`),'desktop '+outfit);
  assert(await js(`cupbox.petState().then(s=>s.config.outfit==='${outfit}')`),'saved synchronized outfit '+outfit);
  await js(`document.querySelector('[data-pet-outfit="${outfit}"]').scrollIntoView({block:'nearest'});true`);await wait(()=>js(`Boolean(document.querySelector('[data-pet-outfit="${outfit}"] .pet-outfit-thumb canvas'))`),'isolated thumbnail '+outfit);await pause(180);await writeFile(path.join(out,'pet-'+outfit+'.png'),(await petWin.webContents.capturePage()).toPNG());
 }
 const preview=await js(`(async()=>{const c=document.createElement('canvas');c.width=1400;c.height=340;const ctx=c.getContext('2d');ctx.fillStyle='#f3f1f8';ctx.fillRect(0,0,c.width,c.height);const items=CupboxPetArt.outfits.filter(o=>o.atlasOnly||o.drawnMotion);for(let i=0;i<items.length;i++){const el=document.createElement('span');await CupboxPetArt.thumbnail(el,items[i].id);ctx.drawImage(el.firstChild,i*280,0,280,280);ctx.fillStyle='#43546f';ctx.textAlign='center';ctx.font='21px "Microsoft YaHei"';ctx.fillText(items[i].name,i*280+140,316);}return c.toDataURL().split(',')[1];})()`);await writeFile(path.join(out,'new-outfits.png'),Buffer.from(preview,'base64'));
 assert(await petJs(`new Promise(resolve=>{const c=document.getElementById('character');const stop=setInterval(()=>{if(c.dataset.loading==='false'){clearInterval(stop);resolve(getComputedStyle(c).backgroundSize==='400% 400%');}},25)})`),'new atlas layout active');
 await js(`document.querySelector('[data-pet-filter="mood"]').click()`);assert(await js(`[...document.querySelectorAll('[data-pet-pose]')].filter(b=>!b.hidden).length===CupboxPetArt.actions.filter(a=>a.group==='mood').length`),'mood category filter');
 await js(`document.querySelector('[data-pet-filter="all"]').click()`);
 for(const id of ['shy','sad','surprised','stretch','angry','heart','dance','hop']){
  await js(`document.querySelector('[data-pet-pose="${id}"]').click()`);await wait(()=>petJs(`document.getElementById('character').dataset.pose==='${id}'`),'new action '+id);
 }
 // Hidden test windows force only their own document visibility for timer checks.
 await petJs(`Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));pet.gesture('action:greeting')`);await pause(40);
 const frames=new Set();for(let i=0;i<12;i++){frames.add(await petJs(`document.getElementById('character').dataset.frame`));await pause(100);}
 assert(frames.size===1&&frames.has('13'),'greeting holds a single drawing without frame jumps');
 for(const pose of ['wink','dance']){
  await js(`cupbox.petAction('${pose}')`);await pause(70);const held=await petJs(`document.getElementById('character').dataset.frame`);await pause(450);
  assert(await petJs(`document.getElementById('character').dataset.frame===${JSON.stringify(held)}`),'stable expression for '+pose);
 }
 assert(await petJs(`(()=>{const m=new DOMMatrix(getComputedStyle(document.getElementById('character')).transform);return Math.abs(m.e)<=2&&Math.abs(m.f)<=2&&Math.abs(Math.atan2(m.b,m.a)*180/Math.PI)<=.5})()`),'gentle translation and rotation amplitude');
 await js(`cupbox.petConfigure({motion:false})`);await pause(120);const stopped=await petJs(`document.getElementById('character').dataset.frame`);await pause(350);assert(await petJs(`document.getElementById('character').dataset.frame===${JSON.stringify(stopped)}&&getComputedStyle(document.getElementById('character')).animationName==='none'`),'motion switch stops frames and CSS animation');
 await js(`cupbox.petConfigure({motion:true,idleActions:false});document.querySelector('[data-pet-pose="idle"]').click()`);await pause(70);assert(await js(`cupbox.petState().then(s=>!s.config.idleActions)`),'idle action preference saved');
 await js(`cupbox.petConfigure({idleActions:true});cupbox.petAction('idle')`);
 const realNow=Date.now;try{Date.now=()=>realNow()+120000;await pause(1250);}finally{Date.now=realNow;}
 assert(await js(`cupbox.petState().then(s=>['eartwitch','headtilt','nod','stretch','yawn'].includes(s.pose))`),'idle companion occasionally performs a bounded local action');
 await js(`cupbox.petConfigure({idleActions:false});cupbox.petAction('idle')`);
 try{Date.now=()=>realNow()+120000;await pause(1250);}finally{Date.now=realNow;}
 assert(await js(`cupbox.petState().then(s=>s.pose==='idle')`),'idle actions remain off after preference disabled');
 await js(`document.querySelector('[data-pet-pose="greeting"]').click();document.getElementById('pet-preview-loop').click()`);await pause(100);const still=await js(`document.getElementById('pet-preview').dataset.frame`);await pause(250);assert(await js(`document.getElementById('pet-preview').dataset.frame===${JSON.stringify(still)}`),'preview can pause independently');
 await js(`document.getElementById('pet-preview-loop').click();document.querySelector('[data-pet-outfit="academy"]').click();applyTheme('dark',prefs.accent);document.querySelector('#settings-modal .modal-body').scrollTop=0`);await pause(400);
 await writeFile(path.join(out,'settings-dark.png'),(await main.webContents.capturePage()).toPNG());
 await js(`applyTheme('light',prefs.accent)`);await pause(250);await writeFile(path.join(out,'settings-light.png'),(await main.webContents.capturePage()).toPNG());
 await js(`document.getElementById('pet-action-grid').scrollIntoView({block:'center'})`);await pause(200);await writeFile(path.join(out,'action-library.png'),(await main.webContents.capturePage()).toPNG());
 main.setSize(1040,680);await pause(200);assert(await js(`(()=>{const p=document.getElementById('tab-pet');return p.scrollWidth<=p.clientWidth+1})()`),'minimum window has no horizontal overflow');
 await js(`cupbox.petConfigure({enabled:false})`);const saved=JSON.parse(await readFile(path.join(out,'home/.cupbox/desktop.json'),'utf8'));assert(saved.desktopPet.outfit==='academy'&&!saved.desktopPet.idleActions,'wardrobe survives disabling');
 assert(errors.length===0,'no renderer errors '+errors.join(';'));console.log('WARDROBE_REVIEW_OK');app.exit(0);
}catch(e){console.error(e);app.exit(1);}})();


