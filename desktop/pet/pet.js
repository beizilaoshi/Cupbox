const character=document.getElementById('character'),menu=document.getElementById('menu'),bubble=document.getElementById('bubble'),more=document.getElementById('more'),ring=document.getElementById('tap-ring');
let pointer=null,snapshot=null,bubbleTimer=null,ringTimer=null,pressTimer=null,suppressClick=false,passing=null,locomotion={mode:'idle',frame:15,direction:1};
const isQuiet=()=>Boolean(snapshot&&(snapshot.config.displayMode==='portrait'||snapshot.config.dockSide!=='none'));
const gesture=kind=>pet.gesture(kind).catch(()=>{});
CupboxPetFeedback.setLoader(()=>pet.audio());
const taskStatus=document.getElementById('task-status'),taskLabels={eating:'吃饭中',thinking:'思考中',working:'执行工具',reading:'查阅中',waiting:'等待你批准',reviewing:'整理结果',success:'任务完成',error:'任务未完成',cancelled:'已停止'};
const player=CupboxPetArt.mount(character,{onError:error=>{bubble.textContent=error.message+'，请到设置重新选择。';}});
function renderCharacter(restart=false){if(!snapshot)return;const config=snapshot.config,docked=config.dockSide!=='none',physical=!docked&&['lifting','held','falling','landing'].includes(locomotion.mode),still=docked||config.displayMode==='portrait'&&!physical,blinkOnly=docked&&config.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches;document.body.dataset.dock=config.dockSide;document.body.dataset.quiet=String(still);player.configure({restart,outfit:snapshot.wardrobe?.outfit||config.outfit,pose:still?config.portraitExpression:snapshot.pose,portrait:still,blinkOnly,motion:config.motion&&!still,idleActions:config.idleActions&&!still,loop:!still||blinkOnly,locomotion:still?{mode:'idle',frame:15,direction:1}:locomotion});document.body.dataset.motion=String(config.motion&&!still);}
function fitCharacter(){if(!snapshot)return;const size=Math.min(snapshot.config.size,Math.max(24,innerWidth-16),Math.max(24,innerHeight-34));document.documentElement.style.setProperty('--pet-size',size+'px');character.style.width=size+'px';character.style.left='50%';character.style.marginLeft=(-size/2)+'px';}
window.addEventListener('resize',()=>{fitCharacter();renderCharacter();});
const physicalLabels={walking:'散步中',lifting:'被提起来啦',held:'轻轻提着',falling:'正在落地',landing:'站稳啦'},physicalLines={lifting:'诶？被你提起来啦！',held:'脚脚碰不到地啦，轻轻放下哦。',falling:'准备落地，站稳就回来。',landing:'落地啦，缓一小下。'};
function showStatus(){if(!snapshot)return;const label=taskLabels[snapshot.pose]||'',physical=physicalLabels[locomotion.mode]||(snapshot.behavior?.active?({resting:'歇歇脚',sulking:'有一点小脾气'}[snapshot.behavior.state]||''):'');taskStatus.textContent=snapshot.pose==='waiting'?label:physical||label;taskStatus.dataset.pose=snapshot.pose;taskStatus.hidden=!taskStatus.textContent;character.setAttribute('aria-label','筑梦喵：'+(physical||label||CupboxPetArt.actions.find(a=>a.id===snapshot.pose)?.name||'陪伴中')+'，点击互动，拖动移动');const shadow=document.getElementById('ground-shadow');shadow.style.opacity=String(Math.max(0,1-(locomotion.groundDistance||0)/24)*.16);}
pet.onMotion(value=>{const changed=value.mode!==locomotion.mode;locomotion=value;if(snapshot)snapshot.locomotion=value;renderCharacter();showStatus();if(changed&&snapshot?.config.bubbles&&snapshot.pose!=='waiting'){const text=physicalLines[value.mode];if(text){clearTimeout(bubbleTimer);bubble.textContent=text;}else if(value.mode==='idle'){bubble.textContent=snapshot.bubble||'';if(!['thinking','working','sleep','reading','reviewing'].includes(snapshot.pose))bubbleTimer=setTimeout(()=>bubble.textContent='',2500);}}});
function toggleMenu(open){menu.hidden=!open;more.setAttribute('aria-expanded',String(open));gesture(open||character.matches(':hover')?'pause':'resume');if(open)menu.querySelector('button').focus();}
function tap(event){
 character.classList.remove('pressed');
 const rect=character.getBoundingClientRect(),hasPoint=event&&event.detail!==0&&Number.isFinite(event.clientY),x=hasPoint?event.clientX:rect.left+rect.width/2,y=hasPoint?event.clientY:rect.top+rect.height*.3;
 const fraction=(y-rect.top)/rect.height,zone=fraction<.42?'head':fraction<.67?'face':'body';
 if(!isQuiet())player.react(zone);gesture('pat:'+zone);if(snapshot?.config.sound!==false)void CupboxPetFeedback.play().then(ok=>{if(ok===false&&snapshot?.config.sound!==false)bubble.textContent='音效未能播放，可到设置重新导入。';});
 if(isQuiet())return;character.classList.remove('pat');void character.offsetWidth;character.classList.add('pat');
 clearTimeout(ringTimer);ring.style.left=x+'px';ring.style.top=y+'px';ring.hidden=false;ring.classList.remove('active');void ring.offsetWidth;ring.classList.add('active');ringTimer=setTimeout(()=>{ring.hidden=true;},520);
}
for(const action of CupboxPetArt.actions){const button=document.createElement('button');button.type='button';button.textContent=action.name;button.onclick=()=>{toggleMenu(false);gesture('action:'+action.id);};document.getElementById('pet-menu-actions').append(button);}
let careState=null,careBusy=false,careInitialized=false,lastCareId=null,careEffectTimer=null;const careView=CupboxPetCareView,careToy=document.getElementById('pet-play-toy');careToy.append(careView.icon('yarn'));
function renderPetCare(care){if(!care)return;if(careState&&((care.revision||0)<(careState.revision||0)||(care.revision||0)===(careState.revision||0)&&care.serverTime<careState.serverTime))return;careState=care;
 for(const action of care.actions){let button=document.querySelector('[data-pet-care="'+action.id+'"]');if(!button){button=document.createElement('button');button.type='button';button.dataset.petCare=action.id;const label=document.createElement('span'),hint=document.createElement('small');label.textContent=action.name;button.append(careView.icon(action.icon),label,hint);button.onclick=()=>{toggleMenu(false);void interactCare(action.id);};document.getElementById('pet-care-menu').append(button);}const status=careView.actionState(action,care);button.disabled=careBusy||status.disabled;button.querySelector('small').textContent=status.disabled?status.text:'';button.title=status.text;
  const quick=document.getElementById(action.id==='feed'?'pet-feed':action.id==='play'?'pet-play':'');if(quick){quick.disabled=careBusy||status.disabled;quick.title=status.disabled?status.text:action.description;}}
 const playing=care.play&&care.play.expiresAt>Date.now();careToy.hidden=!playing;if(playing){careToy.dataset.step=String(care.play.hits);careToy.disabled=careBusy;careToy.setAttribute('aria-label','碰一下毛线球，还差'+(3-care.play.hits)+'下');}
 const event=care.lastEvent;if(careInitialized&&event?.id!==lastCareId&&event&&Date.now()-event.at<5000){const effect=document.getElementById('pet-care-effect');effect.replaceChildren(careView.icon(care.actions.find(a=>a.id===event.action)?.icon||'heart'));effect.hidden=false;effect.classList.remove('active');void effect.offsetWidth;effect.classList.add('active');clearTimeout(careEffectTimer);careEffectTimer=setTimeout(()=>{effect.hidden=true;},1800);}lastCareId=event?.id;careInitialized=true;
}
async function interactCare(action){if(careBusy)return;careBusy=true;if(careState)renderPetCare(careState);try{const result=await pet.care(action,action==='play-hit'?careState?.play?.id:undefined);renderPetCare(result.state.care);bubble.textContent=result.message;}catch(error){bubble.textContent=error.message;}finally{careBusy=false;if(careState)renderPetCare(careState);}}
document.getElementById('pet-feed').onclick=()=>interactCare('feed');document.getElementById('pet-play').onclick=()=>interactCare('play');careToy.onclick=()=>interactCare('play-hit');let careRefreshedAt=0,careRefreshing=false;const careTimer=setInterval(()=>{if(!careState)return;renderPetCare(careState);if(!document.hidden&&!careBusy&&!careRefreshing&&Date.now()-careRefreshedAt>30000){careRefreshing=true;careRefreshedAt=Date.now();pet.care('view').then(r=>renderPetCare(r.state.care)).catch(()=>{}).finally(()=>{careRefreshing=false;});}},1000);
pet.onUpdate(state=>{
 if(snapshot?.audioRevision!==state.audioRevision)CupboxPetFeedback.reset();
 const restart=snapshot?.revision!==state.revision;snapshot=state;
 locomotion=state.locomotion||{mode:'idle',frame:15,direction:1};
 fitCharacter();
 renderCharacter(restart);showStatus();renderPetCare(state.care);
 if(state.config.sound===false)CupboxPetFeedback.stop();
 clearTimeout(bubbleTimer);bubble.textContent=state.config.bubbles?(state.pose==='waiting'?state.bubble:physicalLines[locomotion.mode]||state.bubble):'';
 if(!['thinking','working','sleep','reading','waiting','reviewing'].includes(state.pose))bubbleTimer=setTimeout(()=>{bubble.textContent='';},8000);
});
character.addEventListener('pointerdown',event=>{
 if(event.button!==0)return;clearTimeout(pressTimer);suppressClick=false;passing=null;toggleMenu(false);character.classList.add('pressed');pointer={x:event.screenX,y:event.screenY,clientX:event.clientX,clientY:event.clientY,moved:false,held:['falling','landing'].includes(locomotion.mode),id:event.pointerId};character.setPointerCapture(event.pointerId);gesture('start');pressTimer=setTimeout(()=>{if(pointer&&!pointer.moved){pointer.held=true;character.classList.remove('pressed');gesture('lift');}},220);
});
character.addEventListener('pointermove',event=>{if(!pointer)return;if(Math.max(Math.hypot(event.screenX-pointer.x,event.screenY-pointer.y),Math.hypot(event.clientX-pointer.clientX,event.clientY-pointer.clientY))>4){pointer.moved=true;clearTimeout(pressTimer);character.classList.remove('pressed');}if(pointer.moved)gesture('move');});
window.addEventListener('pointerup',event=>{clearTimeout(pressTimer);character.classList.remove('pressed');if(!pointer||event.pointerId!==pointer.id)return;suppressClick=pointer.moved||pointer.held;pointer=null;passing=null;character.classList.remove('pressed');gesture('end');if(character.hasPointerCapture(event.pointerId))character.releasePointerCapture(event.pointerId);if(suppressClick)setTimeout(()=>{suppressClick=false;},0);});
function cancelPointer(){clearTimeout(pressTimer);suppressClick=true;character.classList.remove('pressed');if(pointer){pointer=null;gesture('end');}}
character.addEventListener('pointercancel',cancelPointer);character.addEventListener('lostpointercapture',()=>{if(pointer)cancelPointer();});
character.addEventListener('click',event=>{if(suppressClick){suppressClick=false;return;}tap(event);});
character.addEventListener('dblclick',()=>{gesture('wake');pet.open('chat');});
character.addEventListener('contextmenu',event=>{event.preventDefault();toggleMenu(menu.hidden);});
character.addEventListener('pointerenter',()=>{gesture('pause');if(snapshot?.pose==='idle'&&!isQuiet())player.react('peek');});character.addEventListener('pointerleave',()=>{if(menu.hidden)gesture('resume');});
more.onclick=()=>toggleMenu(menu.hidden);document.getElementById('chat').onclick=()=>pet.open('chat');document.getElementById('settings').onclick=()=>{toggleMenu(false);pet.open('settings');};
menu.querySelectorAll('[data-gesture]').forEach(button=>button.onclick=()=>{toggleMenu(false);if(button.dataset.gesture==='pat')tap();else gesture(button.dataset.gesture);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){toggleMenu(false);more.focus();}});
window.addEventListener('blur',()=>{character.classList.remove('pressed');toggleMenu(false);if(pointer)cancelPointer();});
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');const syncMotion=()=>gesture(motionQuery.matches?'motion-off':'motion-on');motionQuery.addEventListener('change',syncMotion);syncMotion();
// Pointer forwarding samples only the bundled sprite alpha, never the desktop.
document.addEventListener('mousemove',event=>{
 if(pointer)return;let hit=Boolean(event.target instanceof Element&&event.target.closest('#toolbar,#menu,#pet-play-toy'));
 if(event.target===character){const rect=character.getBoundingClientRect();let x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;if(snapshot?.config.dockSide==='left')[x,y]=[y,1-x];else if(snapshot?.config.dockSide==='right')[x,y]=[1-y,x];hit=player.hitTest(x,y);}
 const next=!hit;if(passing!==next){passing=next;gesture(next?'pass-through':'interact');}
});
character.addEventListener('animationend',event=>{if(event.animationName==='pet-soft-pat')character.classList.remove('pat');});
window.addEventListener('pagehide',()=>{clearInterval(careTimer);clearTimeout(careEffectTimer);player.destroy();clearTimeout(bubbleTimer);clearTimeout(ringTimer);clearTimeout(pressTimer);CupboxPetFeedback.dispose();});
void gesture('ready');


