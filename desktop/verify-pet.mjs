import {app,BrowserWindow,screen} from 'electron';
import path from 'node:path';
import http from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const out=path.resolve('output/pet-review');await mkdir(path.join(out,'home/.cupbox'),{recursive:true});
process.env.CUPBOX_HOME=path.join(out,'home');process.env.CUPBOX_UPDATE_DISABLE='1';process.env.CUPBOX_ANNOUNCEMENT_DISABLE='1';
await writeFile(path.join(out,'home/.cupbox/desktop.json'),JSON.stringify({startupEnabled:false,approvalMode:'ask'}));
app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
const errors=[];app.on('browser-window-created',(_,w)=>{w.show=()=>{};w.showInactive=()=>{};w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label){for(let i=0;i<200;i++){if(await fn())return;await pause(50);}throw Error('Timeout '+label);}
const assert=(v,label)=>{if(!v)throw Error(label);console.log('PASS '+label);};
void(async()=>{try{
 await import('./main.js');await wait(()=>BrowserWindow.getAllWindows().length,'main');const main=BrowserWindow.getAllWindows()[0],js=s=>main.webContents.executeJavaScript(s);
 await wait(()=>js(`Boolean(window.cupboxReady&&document.getElementById('btn-desktop-pet'))`).catch(()=>false),'UI');
 await js(`document.getElementById('btn-desktop-pet').click()`);
 assert(await js(`!document.getElementById('tab-pet').hidden&&document.getElementById('tab-agent-presets').hidden`),'visible settings entry');
 assert(await js(`cupbox.petState().then(s=>!s.config.enabled&&!s.visible)`),'disabled by default');
 assert(await js(`cupbox.prefsSet({desktopPet:{enabled:true}}).then(r=>!r.ok)`),'generic preference bypass denied');
 assert(await js(`cupbox.petConfigure({size:999}).then(()=>false,()=>true)`),'invalid configuration denied');
 await js(`document.getElementById('pet-enabled').click()`);let petWindow;
 await wait(()=>{petWindow=BrowserWindow.getAllWindows().find(w=>w!==main);return petWindow&&!petWindow.webContents.isLoading();},'pet window');const petJs=s=>petWindow.webContents.executeJavaScript(s);
 await wait(()=>petJs(`document.getElementById('character').dataset.pose==='idle'`).catch(()=>false),'pet UI');await pause(300);
 assert(petWindow.getNormalBounds().width===204,'small window leaves space for menu');
 assert(await petJs(`getComputedStyle(document.getElementById('character')).width==='140px'`),'default character is actually 140px');
 assert(await petJs(`typeof cupbox==='undefined'&&typeof require==='undefined'&&typeof pet.gesture==='function'`),'pet isolated from tools and Node');
 const security=petWindow.webContents.getLastWebPreferences();assert(security.sandbox&&security.contextIsolation&&!security.nodeIntegration,'sandboxed transparent window');
 await js(`applyTheme('dark',prefs.accent)`);await pause(300);await writeFile(path.join(out,'settings-dark.png'),(await main.webContents.capturePage()).toPNG());
 await js(`applyTheme('light',prefs.accent)`);await pause(300);await writeFile(path.join(out,'settings-light.png'),(await main.webContents.capturePage()).toPNG());
 await writeFile(path.join(out,'desktop-pet.png'),(await petWindow.webContents.capturePage()).toPNG());
 await petJs(`pet.gesture('pat')`);await pause(70);assert(await petJs(`document.getElementById('character').dataset.pose==='idle'`),'petting preserves the current pose');
 await petJs(`pet.gesture('sleep')`);await pause(70);assert(await petJs(`document.getElementById('character').dataset.pose==='sleep'`),'sleep action');
 await petJs(`pet.open('settings')`);assert(await js(`!document.getElementById('tab-pet').hidden`),'pet can return to settings');
 await petJs(`pet.open('chat')`);assert(await js(`document.getElementById('settings-modal').hidden===false`),'chat navigation starts modal dismissal');await pause(350);assert(await js(`document.getElementById('settings-modal').hidden`),'chat navigation dismisses settings');
 await js(`openModal('pet');cupbox.petAction('working')`);await pause(70);assert(await petJs(`document.getElementById('character').dataset.pose==='working'`),'work pose communication');
 await js(`cupbox.petAction('idle');cupbox.petConfigure({size:220,roam:true,motion:true})`);const before=petWindow.getBounds();await pause(300);assert(petWindow.getBounds().x!==before.x,'bounded desktop roaming');
 await js(`cupbox.petConfigure({motion:false})`);const still=petWindow.getBounds();await pause(250);assert(petWindow.getBounds().x===still.x,'motion off pauses roaming');
 petWindow.setPosition(100000,-100000);await js(`cupbox.petAction('reset')`);const b=petWindow.getBounds(),a=screen.getDisplayMatching(b).workArea;assert(b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height,'recover offscreen position');
 assert(await js(`cupbox.chatSend({text:'fixture invalid route',mode:'ask',routes:{text:'deleted-fixture'}}).then(r=>!r.ok)`),'invalid chat fails without network');
 assert(await js(`cupbox.petState().then(s=>s.pose==='error')`),'failed chat shows error pose');
 let fixture='chat';
 const server=http.createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>setTimeout(()=>{const sent=JSON.parse(body),tool=fixture==='agent'&&!sent.messages.some(m=>m.role==='tool');res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:tool?{role:'assistant',content:'',tool_calls:[{id:'fixture-hash',type:'function',function:{name:'hash',arguments:JSON.stringify({text:'fixture',algorithm:'sha256'})}}]}:{role:'assistant',content:'本机模拟回复'}}]}));},400));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  await js(`cupbox.aiConfigSet({provider:'openai-compatible',baseUrl:'http://127.0.0.1:${server.address().port}/v1',apiKey:'fixture-only',model:'fixture'})`);
  await js(`window.petFixtureChat=cupbox.chatSend({text:'本机测试',mode:'ask'});true`);await pause(80);
  assert(await js(`cupbox.petState().then(s=>s.pose==='thinking')`),'real chat IPC starts thinking pose');
  assert(await js(`window.petFixtureChat.then(r=>r.ok)`),'local fixture chat succeeds');
  assert(await js(`cupbox.petState().then(s=>s.pose==='success')`),'completed chat triggers celebration');
  fixture='agent';await js(`window.__petApproval=null;window.__petOff=cupbox.onApproval(p=>window.__petApproval=p);window.petToolChat=cupbox.chatSend({text:'本机工具状态测试',mode:'agent'});true`);
  await wait(()=>js(`Boolean(window.__petApproval)`),'real tool approval');
  assert(await js(`cupbox.petState().then(s=>s.pose==='waiting')`),'real tool authorization pauses pet in waiting state');
  await js(`cupbox.petConfigure({bubbles:false})`);await pause(300);
  assert(await petJs(`document.getElementById('bubble').textContent===''&&!document.getElementById('task-status').hidden&&document.getElementById('task-status').dataset.pose==='waiting'`),'approval badge remains visible with bubbles disabled');
  await writeFile(path.join(out,'task-waiting.png'),(await petWindow.webContents.capturePage()).toPNG());
  await js(`cupbox.executionRespond(window.__petApproval.id,true)`);
  await wait(()=>js(`cupbox.petState().then(s=>s.pose==='reviewing')`),'real tool result review');
  await pause(180);
  await writeFile(path.join(out,'task-reviewing.png'),(await petWindow.webContents.capturePage()).toPNG());
  assert(await js(`window.petToolChat.then(r=>r.ok)`),'approved fixture tool completes');
  await js(`window.__petOff();cupbox.petConfigure({bubbles:true})`);
  fixture='chat';await js(`window.petCancelChat=cupbox.chatSend({text:'本机取消测试',mode:'ask'});true`);await pause(80);await js(`cupbox.chatCancel()`);
  assert(await js(`window.petCancelChat.then(r=>!r.ok)`),'real chat cancels');
  assert(await js(`cupbox.petState().then(s=>s.pose==='cancelled')`),'cancelled task is distinct from failure and success');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 await js(`cupbox.petConfigure({enabled:false})`);assert(BrowserWindow.getAllWindows().length===1,'disable destroys native pet');
 await js(`cupbox.petConfigure({enabled:true})`);await pause(250);assert(await js(`cupbox.petState().then(s=>s.config.size===220&&s.config.roam&&!s.config.motion&&s.visible)`),'re-enable retains preferences');
 await js(`cupbox.petConfigure({enabled:false})`);const saved=JSON.parse(await readFile(path.join(out,'home/.cupbox/desktop.json'),'utf8'));assert(saved.desktopPet.size===220&&!saved.desktopPet.enabled,'persistent local configuration');
 assert(errors.length===0,'no renderer errors: '+errors.join(';'));console.log('PET_REVIEW_OK');app.exit(0);
}catch(error){console.error(error);app.exit(1);}})();





