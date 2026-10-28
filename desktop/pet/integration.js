import {app,BrowserWindow,ipcMain,screen,dialog,powerMonitor} from 'electron';
import {PetDiary} from './diary.js';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {PET_DEFAULTS,PET_POSES,PET_PERSISTENT_POSES,normalizePet,petBounds,quietPet,petDockSide,petGravityEnabled,petWorkArea} from './model.js';
import {createPetReplies} from './replies.js';
import {createPetAudio} from './audio.js';
import {PetPhysics} from './physics.js';
import {PetBehavior} from './behavior.js';
import {petWardrobe} from './holidays.js';
import {randomUUID} from 'node:crypto';
import {normalizeCare,projectCare,careView,applyCare} from './care.js';

export function installDesktopPet({desktopDir,getPrefs,savePrefs,showMain,home,writeDiary,openDiaryFolder}){
 const replies=createPetReplies(),behavior=new PetBehavior();let walkDecision=false,appliedLeg=-1,behaviorAt=Date.now(),locked=false;
 const audio=createPetAudio(home);let audioRevision=0,lastInteraction=Date.now(),nextIdle=Date.now()+45000;
 const approvals=new Set();
 let physics=null,lastTick=0,lastMotion='';
 let care=normalizeCare({}),careRevision=0,playSession=null,playTimer=null,lastCareEvent=null;
 let win=null,config={...PET_DEFAULTS},loaded=false,queue=Promise.resolve(),drag=null,paused=false,reducedMotion=false,ticker=null,activity='idle',revision=0,bubble='筑梦喵在这儿，今天也一起慢慢来。',resetTimer=null;
 const diary=new PetDiary({home,getConfig:()=>config,generate:writeDiary,changed:()=>broadcast()});
 const noteDiary=action=>void diary.record(action).catch(()=>{});
 const mainUrl=pathToFileURL(path.join(desktopDir,'ui/index.html')).href;
 const petUrl=pathToFileURL(path.join(desktopDir,'pet/pet.html')).href;
 const areas=()=>screen.getAllDisplays().map(d=>d.workArea);
 const serial=fn=>{const run=queue.catch(()=>{}).then(fn);queue=run;return run;};
 async function load(){if(loaded)return;const prefs=await getPrefs();try{config=normalizePet(prefs.desktopPet||{});}catch{config={...PET_DEFAULTS};}care=normalizeCare(prefs.desktopPetCare);loaded=true;}
 function trustedMain(e){if(e.sender.isDestroyed()||e.senderFrame!==e.sender.mainFrame||e.sender.getURL()!==mainUrl)throw Error('请从 Cupbox 设置操作桌宠');}
 function trustedPet(e){if(!win||e.sender!==win.webContents||e.senderFrame!==e.sender.mainFrame||e.sender.getURL()!==petUrl)throw Error('桌宠窗口无效');}
 const snapshot=()=>({config:{...config},diary:diary.status(),care:{...careView(care),revision:careRevision,busy:Boolean(approvals.size||['thinking','working','reading','reviewing','waiting','focus'].includes(activity)),play:playSession&&playSession.expiresAt>Date.now()?{id:playSession.id,hits:playSession.hits,expiresAt:playSession.expiresAt}:null,lastEvent:lastCareEvent},wardrobe:petWardrobe(config),visible:Boolean(win&&!win.isDestroyed()),pose:approvals.size&&activity!=='sleep'?'waiting':activity==='idle'&&!quietPet(config)&&config.roam&&config.motion&&config.idleActions&&behavior.snapshot().state==='resting'?'sleep':activity==='idle'&&!quietPet(config)&&config.idleActions&&behavior.snapshot().state==='sulking'?'angry':activity,behavior:{...behavior.snapshot(),active:config.enabled&&!quietPet(config)&&activity==='idle'&&!approvals.size&&!drag&&!playSession},revision,audioRevision,locomotion:physics?.snapshot()||{mode:'idle',frame:15,direction:1}});
 function motionUpdate(force=false){if(!win||win.isDestroyed()||!physics)return;const value=physics.snapshot(),key=JSON.stringify(value);if(force||key!==lastMotion){lastMotion=key;win.webContents.send('pet:motion',value);}}
 function broadcast(ready=false){if(win&&!win.isDestroyed()&&(ready||!win.webContents.isLoading()))win.webContents.send('pet:update',{...snapshot(),bubble:approvals.size&&activity!=='sleep'?'这一步需要你批准，我先停在这里。':bubble});for(const w of BrowserWindow.getAllWindows())if(w!==win&&!w.isDestroyed()&&w.webContents.getURL()===mainUrl)w.webContents.send('pet:changed',snapshot());}
 function perform(pose,text){revision++;clearTimeout(resetTimer);activity=pose;bubble=text;broadcast();if(!PET_PERSISTENT_POSES.includes(pose))resetTimer=setTimeout(()=>{revision++;activity='idle';bubble='';broadcast();},6500);}
 const busyForCare=()=>approvals.size||['thinking','working','reading','reviewing','waiting','focus'].includes(activity);
 function endPlay(){if(playSession)careRevision++;clearTimeout(playTimer);playTimer=null;playSession=null;}
 function careFeedback(result){noteDiary(result.action);if(['feed','treat','groom','play'].includes(result.action))behavior.soothe();lastCareEvent={id:randomUUID(),at:Date.now(),action:result.action,message:result.message,gain:result.gain||0};if(busyForCare()){bubble=result.message;broadcast();}else perform(result.pose||'nod',result.message);}
 async function interactCare(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['action','sessionId'].includes(k))||typeof input.action!=='string'||input.sessionId!==undefined&&(typeof input.sessionId!=='string'||input.sessionId.length>64))throw Error('互动请求无效');
  await load();const now=Date.now(),{action,sessionId}=input;if(action==='view')return{accepted:true,state:snapshot()};
  if(action==='cancel-play'){if(!playSession||sessionId!==playSession.id)throw Error('这一轮玩耍已结束');endPlay();broadcast();return{state:snapshot(),accepted:false,message:'毛线球先收好，下次接着玩。'};}
  if(action==='play-hit'){
   if(!playSession||sessionId!==playSession.id||now>=playSession.expiresAt)throw Error('这一轮玩耍已结束，重新邀请筑梦喵吧');
   if(busyForCare()){endPlay();broadcast();return{state:snapshot(),accepted:false,message:'正在忙任务，等忙完再一起玩吧。'};}
   if(now-playSession.lastHit<220)return{state:snapshot(),accepted:false,message:'毛线球滚过来啦，再碰一下。'};
   if(playSession.hits<2){playSession.hits++;playSession.lastHit=now;careRevision++;bubble='碰到啦，还差'+(3-playSession.hits)+'下。';broadcast();return{state:snapshot(),accepted:true,message:bubble};}
   const result=applyCare(care,'play',now);if(!result.accepted){endPlay();broadcast();return{...result,state:snapshot()};}
   await savePrefs({desktopPetCare:result.state});care=result.state;careRevision++;endPlay();lastInteraction=now;nextIdle=now+45000;careFeedback({...result,action:'play'});return{accepted:true,message:result.message,gain:result.gain,state:snapshot()};
  }
  const result=applyCare(care,action,now);
  if(!result.accepted)return{accepted:false,message:result.message,gain:0,state:snapshot()};
  if((action==='play'||action==='nap')&&busyForCare())return{accepted:false,message:'正在忙任务，等忙完再一起'+(action==='play'?'玩吧。':'休息吧。'),state:snapshot()};
  if(action==='play'){
   if(playSession&&playSession.expiresAt>now)return{accepted:true,message:'毛线球还在，碰三下就好。',state:snapshot()};
   endPlay();playSession={id:randomUUID(),hits:0,lastHit:0,expiresAt:now+20000};careRevision++;const id=playSession.id;
   playTimer=setTimeout(()=>{void serial(async()=>{if(playSession?.id===id){endPlay();bubble='毛线球先收好，下次再一起玩。';broadcast();}}).catch(()=>{});},20000);playTimer.unref();
   perform('listening','来碰三下毛线球吧，我陪你一起玩！');return{accepted:true,message:'碰三下毛线球，完成这一轮玩耍。',state:snapshot()};
  }
  await savePrefs({desktopPetCare:result.state});care=result.state;careRevision++;if(action==='nap'&&playSession)endPlay();lastInteraction=now;nextIdle=now+45000;careFeedback({...result,action});return{accepted:true,message:result.message,gain:result.gain,state:snapshot()};
 }
 ipcMain.handle('pet:care',(e,input)=>{if(e.sender.getURL()===petUrl)trustedPet(e);else trustedMain(e);return serial(()=>interactCare(input));});
 function stopTicker(){clearInterval(ticker);ticker=null;}
 function destroy(){stopTicker();clearTimeout(resetTimer);drag=null;physics=null;lastMotion='';paused=false;walkDecision=false;appliedLeg=-1;if(win&&!win.isDestroyed())win.destroy();win=null;}
 function syncPhysics(){if(!win)return;const b=win.getBounds(),a=screen.getDisplayMatching(b).workArea;if(!physics)physics=new PetPhysics(b,a,config.size);else if(physics.width!==b.width||physics.height!==b.height||physics.size!==config.size||Math.round(physics.x)!==b.x||Math.round(physics.y)!==b.y||Object.keys(a).some(key=>a[key]!==physics.area[key]))physics.configure(b,a,config.size);motionUpdate(true);}
 function fit(){if(!win)return;win.setBounds(petBounds({...config,position:win.getPosition().reduce((p,n,i)=>({...p,[i?'y':'x']:n}),{})},areas()));syncPhysics();}
 function syncWindow(){
  if(!config.enabled){behavior.resetPresence();walkDecision=false;destroy();broadcast();return;}
  if(!win){
   win=new BrowserWindow({...petBounds(config,areas()),title:'Cupbox · 筑梦喵桌宠',transparent:true,frame:false,resizable:false,hasShadow:false,skipTaskbar:true,show:false,alwaysOnTop:config.alwaysOnTop,webPreferences:{preload:path.join(desktopDir,'pet/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
   win.setMenu(null);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
   win.once('ready-to-show',()=>{win?.showInactive();broadcast();});
   win.on('closed',()=>{win=null;physics=null;stopTicker();});
   void win.loadFile(path.join(desktopDir,'pet/pet.html')).catch(error=>console.error('[pet]',error.message));
  }else{win.setAlwaysOnTop(config.alwaysOnTop);fit();broadcast();}
  syncPhysics();stopTicker();lastTick=performance.now();
  ticker=setInterval(()=>{
   const now=performance.now(),dt=(now-lastTick)/1000;lastTick=now;if(!win||!physics)return;
   const native=win.getBounds(),displays=areas(),safe=petBounds({...config,position:{x:native.x,y:native.y}},displays);
   if(Object.keys(safe).some(key=>safe[key]!==native[key])){win.setBounds(safe);syncPhysics();}
   else{const area=petWorkArea(native,displays);if(Object.keys(area).some(key=>area[key]!==physics.area[key]))syncPhysics();}
   const animate=petGravityEnabled(config,reducedMotion),walk=walkDecision&&animate&&!quietPet(config)&&config.roam&&!drag&&!paused&&!approvals.size&&['idle','greeting','dance','hop'].includes(activity);if(physics.mode==='idle'&&!walk&&!drag)return;
   const next=physics.step(dt,{animate,walk});
   if(!drag){const [x,y]=win.getPosition();if(x!==next.x||y!==next.y)win.setPosition(next.x,next.y);}
   motionUpdate();if(next.settled)void serial(persistPosition).catch(error=>console.error('[pet position]',error.message));
  },16);
 }
 async function persistPosition(){if(win){const [x,y]=win.getPosition();config={...config,position:{x,y}};await savePrefs({desktopPet:config});}}
 function leaveEdge(){if(config.dockSide==='none'||!win)return;config={...config,dockSide:'none'};const cursor=screen.getCursorScreenPoint(),b=win.getBounds();win.setBounds(petBounds({...config,position:{x:cursor.x-Math.round(b.width/2),y:b.y}},areas()));if(drag){drag.dx=Math.round(b.width/2);drag.dy=cursor.y-win.getBounds().y;}syncPhysics();revision++;broadcast();}
 ipcMain.handle('pet:state',async e=>{trustedMain(e);await queue.catch(()=>{});await load();return snapshot();});
 ipcMain.handle('pet:diary',async(e,input)=>{trustedMain(e);if(!input||Object.keys(input).some(k=>!['action','date'].includes(k)))throw Error('日记操作无效');await queue.catch(()=>{});await load();if(input.action==='list')return diary.list();if(input.action==='read')return diary.read(input.date);if(input.action==='write')return diary.write(snapshot());if(input.action==='open'&&openDiaryFolder){await openDiaryFolder(await diary.folder());return true;}throw Error('日记操作无效');});
 ipcMain.handle('pet:configure',(e,patch)=>{trustedMain(e);return serial(async()=>{await load();const next=normalizePet(patch.edgeSnap===false?{...patch,dockSide:'none'}:patch,config);await savePrefs({desktopPet:next});config=next;if(!config.diaryEnabled)diary.cancel();if(patch.outfit)noteDiary('outfit');syncWindow();if((patch.motion===false||quietPet(config))&&win&&!drag){physics?.stop();motionUpdate(true);await persistPosition();}void diary.tick(snapshot()).catch(()=>{});return snapshot();});});
 ipcMain.handle('pet:audio:state',e=>{trustedMain(e);return audio.state();});
 ipcMain.handle('pet:audio:load',e=>{trustedPet(e);return audio.load();});
 ipcMain.handle('pet:audio:import',async e=>{trustedMain(e);const result=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{title:'选择按下与松开音效（例如 Ya1.mp3、Ya2.mp3）',properties:['openFile','multiSelections'],filters:[{name:'音效',extensions:['mp3','wav','ogg']}]});if(result.canceled)return audio.state();return serial(async()=>{const state=await audio.importFiles(result.filePaths);audioRevision++;broadcast();return state;});});
 ipcMain.handle('pet:audio:reset',e=>{trustedMain(e);return serial(async()=>{const state=await audio.reset();audioRevision++;broadcast();return state;});});
 ipcMain.handle('pet:action',(e,action)=>{trustedMain(e);return serial(async()=>{await load();if(action==='reset'){config={...config,position:null,dockSide:'none'};await savePrefs({desktopPet:config});if(win){drag=null;physics?.release(false);win.setBounds(petBounds(config,areas()));syncPhysics();}}else if(PET_POSES.includes(action)){if(playSession)endPlay();perform(action,replies.action(action));}else throw Error('未知桌宠动作');broadcast();return snapshot();});});
 ipcMain.handle('pet:gesture',async(e,kind)=>{
  trustedPet(e);
  if(['start','lift','move','wake','pat','pat:head','pat:face','pat:body'].includes(kind)||typeof kind==='string'&&kind.startsWith('action:')){lastInteraction=Date.now();nextIdle=lastInteraction+35000+Math.random()*30000;}
  if(kind==='ready')broadcast(true);
  else if(kind==='pass-through'&&!drag)win.setIgnoreMouseEvents(true,{forward:true});
  else if(kind==='interact')win.setIgnoreMouseEvents(false);
  else if(kind==='start'){if(playSession){endPlay();broadcast();}win.setIgnoreMouseEvents(false);const cursor=screen.getCursorScreenPoint(),b=win.getBounds(),caught=['falling','landing'].includes(physics?.mode);drag={dx:cursor.x-b.x,dy:cursor.y-b.y,lifting:caught,last:performance.now()};if(caught){physics.grab();motionUpdate(true);}}
  else if(kind==='lift'&&drag&&!drag.lifting){leaveEdge();if(behavior.touch('lift',{allowed:!quietPet(config)&&config.idleActions&&activity==='idle'&&!approvals.size}))perform('angry',replies.action('sulk'));drag.lifting=true;physics?.grab();motionUpdate(true);}
  else if(kind==='move'&&drag){leaveEdge();if(!drag.lifting){drag.lifting=true;physics?.grab();}const p=screen.getCursorScreenPoint(),b=petBounds({...config,position:{x:p.x-drag.dx,y:p.y-drag.dy}},areas()),now=performance.now();physics?.dragTo(b,screen.getDisplayMatching(b).workArea,(now-drag.last)/1000);drag.last=now;const native=win.getBounds();if(native.width!==b.width||native.height!==b.height)win.setBounds(b);else win.setPosition(b.x,b.y);motionUpdate(true);}
  else if(kind==='end'){const lifted=drag?.lifting;drag=null;const b=win.getBounds(),side=lifted&&config.edgeSnap?petDockSide(b,screen.getDisplayMatching(b).workArea):'none';if(side!=='none'){config={...config,dockSide:side};win.setBounds(petBounds({...config,position:{x:b.x,y:b.y}},areas()));physics?.release(false);syncPhysics();revision++;await serial(persistPosition);broadcast();}else if(lifted&&physics?.release(petGravityEnabled(config,reducedMotion))){motionUpdate(true);if(!petGravityEnabled(config,reducedMotion))await serial(persistPosition);}else await serial(persistPosition);}
  else if(['dock:left','dock:right','dock:none'].includes(kind))await serial(async()=>{if(kind==='dock:none'&&config.dockSide==='none')return;config={...config,dockSide:kind.slice(5),edgeSnap:kind==='dock:none'?config.edgeSnap:true};if(config.dockSide==='none'){const b=win.getBounds();config.position={x:b.x+(b.x===screen.getDisplayMatching(b).workArea.x?64:-64),y:b.y};win.setBounds(petBounds(config,areas()));}else fit();physics?.stop();syncPhysics();revision++;await persistPosition();broadcast();});
  else if(kind==='motion-off'){reducedMotion=true;if(physics&&!physics.dragging&&physics.mode!=='idle'){physics.stop();motionUpdate(true);await serial(persistPosition);}}
  else if(kind==='motion-on')reducedMotion=false;
  else if(kind==='pause')paused=true;
  else if(kind==='resume')paused=false;
  else if(['pat','pat:head','pat:face','pat:body'].includes(kind)){noteDiary('pat');if(behavior.touch('pat',{allowed:!quietPet(config)&&config.idleActions&&activity==='idle'&&!approvals.size})){perform('angry',replies.action('sulk'));return true;}bubble=replies.tap(kind.split(':')[1]||'head',snapshot().pose,petWardrobe(config).outfit);broadcast();}
  else if(typeof kind==='string'&&kind.startsWith('action:')&&PET_POSES.includes(kind.slice(7))){if(playSession)endPlay();perform(kind.slice(7),replies.action(kind.slice(7)));}
  else if(kind==='sleep'){if(playSession)endPlay();perform('sleep',replies.action('sleep'));}
  else if(kind==='wake'){if(playSession)endPlay();perform('greeting',replies.action('greeting'));}
  else if(kind==='hide')await serial(async()=>{config={...config,enabled:false};await savePrefs({desktopPet:config});syncWindow();});
  return true;
 });
 ipcMain.handle('pet:open',(e,tab)=>{trustedPet(e);showMain(tab==='settings'?'pet':null);return true;});
 const onDisplays=()=>{fit();void serial(persistPosition).catch(()=>{});};void app.whenReady().then(()=>{screen.on('display-added',onDisplays);screen.on('display-removed',onDisplays);screen.on('display-metrics-changed',onDisplays);});
 let calendarKey='';
 const refreshCalendar=()=>{const now=new Date(),key=now.toDateString()+'|'+now.getTimezoneOffset();if(key!==calendarKey){calendarKey=key;if(loaded)broadcast();}};
 const calendarTimer=setInterval(refreshCalendar,30000);calendarTimer.unref();
 const idleTimer=setInterval(()=>{const now=Date.now(),dt=(now-behaviorAt)/1000;behaviorAt=now;const previous=behavior.snapshot().state,needs=projectCare(care,now);let idleSeconds=0;try{idleSeconds=powerMonitor.getSystemIdleTime?.()??0;}catch{idleSeconds=60;}
  const available=Boolean(win&&config.enabled&&!quietPet(config)&&!locked&&!drag&&!paused&&!approvals.size&&!playSession&&activity==='idle');
  const decision=behavior.step(dt,{enabled:Boolean(win&&config.enabled&&!locked&&!quietPet(config)),roam:config.roam,motion:config.motion&&!reducedMotion,idleActions:config.idleActions,available,paused,energy:needs.energy,mood:needs.mood,idleSeconds,reminders:config.breakReminder&&config.bubbles,reminderMinutes:config.breakMinutes});walkDecision=decision.walk;
  if(physics&&decision.walk&&appliedLeg!==decision.leg){physics.direction=decision.direction;appliedLeg=decision.leg;}
  if(decision.event&&available){if(decision.event==='break')perform('stretch',replies.action('break'));else if(decision.event==='rest'&&config.idleActions) {bubble=replies.action('rest');revision++;broadcast();}else if(decision.event==='sulk')perform('angry',replies.action('moody'));else if(decision.event==='awake'){bubble=replies.action('awake');revision++;broadcast();}}
  else if(previous!==decision.state){revision++;broadcast();}
  if(decision.state==='resting'||decision.state==='sulking'||Date.now()<nextIdle||!win||!config.enabled||quietPet(config)||!config.motion||!config.idleActions||reducedMotion||drag||paused||approvals.size||activity!=='idle')return;nextIdle=Date.now()+45000+Math.random()*30000;const hour=new Date().getHours(),choices=hour>=22||hour<7?['eartwitch','headtilt','yawn']:['eartwitch','headtilt','nod','stretch'];const pose=choices[Math.floor(Math.random()*choices.length)];perform(pose,replies.action(pose));},1000);idleTimer.unref();
 const onResume=()=>{locked=false;behavior.resetPresence();behaviorAt=Date.now();refreshCalendar();};const onLock=()=>{locked=true;walkDecision=false;behavior.resetPresence();};
 void app.whenReady().then(()=>{powerMonitor.on('resume',onResume);powerMonitor.on('suspend',onLock);powerMonitor.on('lock-screen',onLock);powerMonitor.on('unlock-screen',onResume);});
 const diaryTimer=setInterval(()=>{if(loaded)void diary.tick(snapshot()).catch(()=>{});},60000);diaryTimer.unref();
 app.on('will-quit',()=>{diary.cancel();clearInterval(diaryTimer);endPlay();clearInterval(calendarTimer);clearInterval(idleTimer);powerMonitor.removeListener('resume',onResume);powerMonitor.removeListener('suspend',onLock);powerMonitor.removeListener('lock-screen',onLock);powerMonitor.removeListener('unlock-screen',onResume);destroy();});
 return{restore:()=>serial(async()=>{await load();syncWindow();void diary.tick(snapshot()).catch(()=>{});}),activity(pose,text){if(['success','cancelled','error'].includes(pose))noteDiary({success:'taskDone',cancelled:'taskStopped',error:'taskError'}[pose]);if(PET_POSES.includes(pose)&&activity!=='sleep'){if(playSession&&['thinking','working','reading','reviewing','waiting'].includes(pose))endPlay();perform(pose,text);}},beginApproval(){if(playSession)endPlay();const token=Symbol();approvals.add(token);revision++;broadcast();return()=>{if(approvals.delete(token)){revision++;broadcast();}};},snapshot,destroy};
}







