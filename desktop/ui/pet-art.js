// Shared renderer-only wardrobe and sprite animation player. No tool or network API.
window.CupboxPetArt=(()=>{
 const outfits=[{id:'hanfu-wisteria',name:'紫藤月纱',note:'紫色汉服 · 银绣花纹 · 逐帧步态与眨眼',drawnMotion:true},{id:'sakura',name:'樱花礼服',note:'樱花与蓝缎带'},{id:'academy',name:'筑梦学院',note:'水手领与百褶裙'},{id:'cozy',name:'软绵居家',note:'星星睡衣与猫拖鞋'},{id:'starlight',name:'星夜魔法',note:'紫金星纹与月亮胸针'},...[
 ['hanfu-jade','青竹听风','青竹宋韵 · 青瓷绿与玉白'],['hanfu-peony','牡丹春宴','牡丹唐韵 · 桃粉披帛与金饰'],['hanfu-indigo','月白云锦','月白明韵 · 靛蓝云纹与银穗'],['jk-plaid','紫藤放课','JK 格纹 · 藏蓝开衫与藤紫领结']
 ].map(([id,name,note])=>({id,name,note,atlasOnly:true})),...[
 ['spring','春节锦绣','正月初一至初七 · 红金绣服'],['christmas','圣诞雪绒','12月24–25日 · 绒边礼裙'],['lantern','元宵灯语','正月十五 · 灯花汉服'],['halloween','万圣绮夜','10月31日 · 紫夜魔女'],['midautumn','中秋月桂','八月十五 · 月桂汉服'],['april','愚人奇想','4月1日 · 彩糖奇想'],['labor','劳动小匠','5月1日 · 牛仔工装'],['dragonboat','端午竹露','五月初五 · 粽叶青绣'],['qixi','七夕星桥','七月初七 · 星河绫罗'],['national','国庆云锦','10月1–7日 · 红绫金云'],['winter','冬至暖雪','冬至当日 · 雪绒围巾']
 ].map(([id,name,note])=>({id,name,note,festival:true}))];
 const actions=[
  {id:'idle',name:'安静陪伴',group:'daily',frames:[0]},
  {id:'greeting',name:'挥挥手',group:'interactive',frames:[13]},
  {id:'thinking',name:'认真思考',group:'task',frames:[4]},
  {id:'working',name:'埋头记笔记',group:'task',frames:[5]},
  {id:'success',name:'开心庆祝',group:'interactive',frames:[2]},
  {id:'sleep',name:'抱猫小憩',group:'daily',frames:[8]},
  {id:'wink',name:'俏皮眨眼',group:'mood',frames:[1]},
  {id:'shy',name:'有点害羞',group:'mood',frames:[3]},
  {id:'sad',name:'委屈巴巴',group:'mood',frames:[6]},
  {id:'surprised',name:'突然惊讶',group:'mood',frames:[7]},
  {id:'stretch',name:'伸个懒腰',group:'daily',frames:[9]},
  {id:'angry',name:'鼓起脸颊',group:'mood',frames:[10]},
  {id:'heart',name:'给你比心',group:'interactive',frames:[11]},
  {id:'dance',name:'轻轻摇摆',group:'interactive',frames:[0]},
  {id:'hop',name:'开心轻颤',group:'interactive',frames:[2]},
  {id:'listening',name:'侧耳倾听',group:'interactive',frames:[7]},
  {id:'reading',name:'低头查阅',group:'task',frames:[5]},
  {id:'waiting',name:'等你批准',group:'task',frames:[4]},
  {id:'reviewing',name:'核对成果',group:'task',frames:[5]},
  {id:'error',name:'遇到困难',group:'task',frames:[6]},
  {id:'cancelled',name:'停下来等你',group:'task',frames:[0]},
  {id:'focus',name:'专心陪你',group:'daily',frames:[4]},
  {id:'cheer',name:'悄悄加油',group:'interactive',frames:[11]},
  {id:'nod',name:'乖巧点头',group:'interactive',frames:[0]},
  {id:'headtilt',name:'歪头看看',group:'interactive',frames:[4]},
  {id:'eartwitch',name:'耳朵动一动',group:'daily',frames:[0]},
  {id:'peek',name:'探头找你',group:'interactive',frames:[7]},
  {id:'pawwave',name:'小爪招呼',group:'interactive',frames:[13]},
  {id:'thankyou',name:'认真道谢',group:'interactive',frames:[11]},
  {id:'yawn',name:'困困哈欠',group:'daily',frames:[9]},
  {id:'proud',name:'得意一下',group:'mood',frames:[2]},
  {id:'eating',name:'乖乖吃饭',group:'interactive',frames:Array.from({length:16},(_,i)=>i)}
 ];
 actions.forEach(action=>{action.frameCount=action.id==='eating'?16:60;});
 const scriptUrl=document.currentScript.src,assetRoot=new URL('assets/pet/',scriptUrl).href;
 const cache=new Map();
 const drawnMotion=outfit=>Boolean(outfits.find(o=>o.id===outfit)?.drawnMotion);
 const singleAtlas=outfit=>{const item=outfits.find(o=>o.id===outfit);return Boolean(item?.festival||item?.atlasOnly);};
 // The generated National Day sheet places neutral/cheer in cells 14/15.
 const atlasFrame=(outfit,index)=>outfit==='national'&&index>=14?29-index:index;
 const heldEyes={academy:[[148,137,21,18],[200,133,21,18]],sakura:[[151,147,21,18],[202,146,21,18]],cozy:[[137,133,21,17],[185,129,21,17]],starlight:[[149,160,21,18],[199,151,21,18]]};
 // Coordinates are registered to each drawing, never inferred from ribbons or collars.
 const walkEyes={sakura:[[157,140,21,18],[209,140,21,18]],academy:[[153,126,21,18],[203,122,21,18]],cozy:[[138,115,20,17],[187,112,20,17]],starlight:[[148,162,21,18],[194,157,21,18]],spring:[[139,130,20,18],[190,121,21,18]],christmas:[[140,131,21,18],[190,124,21,18]],lantern:[[142,127,21,18],[192,120,21,18]],halloween:[[141,130,21,18],[191,122,21,18]],midautumn:[[136,130,21,18],[186,122,21,18]],april:[[134,129,21,18],[186,122,21,18]],labor:[[143,130,21,18],[193,121,21,18]]};
 Object.assign(walkEyes,{dragonboat:[[139,131,21,18],[191,123,21,18]],qixi:[[139,130,21,18],[190,122,21,18]],national:[[139,131,21,18],[190,122,21,18]],winter:[[139,131,21,18],[190,122,21,18]]});
 Object.assign(walkEyes,{'hanfu-jade':[[136,122,21,16],[187,117,21,16]],'hanfu-peony':[[147,125,21,16],[195,121,21,16]],'hanfu-indigo':[[140,124,21,16],[188,117,21,16]],'jk-plaid':[[145,124,21,16],[194,122,21,16]]});
 const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=384;return c;};
 // Assign connected artwork to its owning cell before cropping. A neighbour's
 // shoe or hair can extend several pixels INSIDE a cell, beyond a border trim.
 function atlasOwners(resource){
  if(resource.owners)return resource.owners;
  const {width,height,pixels}=resource,total=width*height,owners=new Uint8Array(total),visited=new Uint8Array(total),queue=new Int32Array(total),cw=width/4,ch=height/4;
  for(let first=0;first<total;first++){
   if(visited[first]||pixels[first*4+3]<220)continue;
   let head=0,end=1;queue[0]=first;visited[first]=1;const votes=new Uint32Array(16);
   while(head<end){const p=queue[head++],x=p%width,y=Math.floor(p/width);votes[Math.min(3,Math.floor(y/ch))*4+Math.min(3,Math.floor(x/cw))]++;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const n=ny*width+nx;if(!visited[n]&&pixels[n*4+3]>=220){visited[n]=1;queue[end++]=n;}}
   }
   let owner=0;for(let cell=1;cell<16;cell++)if(votes[cell]>votes[owner])owner=cell;
   // If two complete poses touch, retain their respective cells rather than
   // deleting one character. Only minority spill (< 15%) belongs to a neighbour.
   for(let n=0;n<end;n++){const p=queue[n],cell=Math.min(3,Math.floor(Math.floor(p/width)/ch))*4+Math.min(3,Math.floor((p%width)/cw));owners[p]=(cell!==owner&&votes[cell]<votes[owner]*.15?owner:cell)+1;}
  }
  // Separate the opaque cores first: translucent hair halos can otherwise join
  // entire rows of poses. Restore every original antialias pixel by nearest-core
  // propagation without changing its colour or opacity.
  let head=0,end=0;for(let p=0;p<total;p++)if(owners[p])queue[end++]=p;
  while(head<end){const p=queue[head++],x=p%width,y=Math.floor(p/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const n=ny*width+nx;if(!owners[n]&&pixels[n*4+3]){owners[n]=owners[p];queue[end++]=n;}}}
  resource.owners=owners;return owners;
 }
 // Copy integer pixels before any filtering. Sampling a fractional atlas rectangle
 // directly can pull neighbouring poses into the mesh, even with a CSS clip.
 function framePixels(resource,index){
  const cw=resource.width/4,ch=resource.height/4,left=index%4*cw,top=Math.floor(index/4)*ch,x0=Math.ceil(left),y0=Math.ceil(top),width=Math.floor(left+cw)-x0,height=Math.floor(top+ch)-y0,data=new Uint8ClampedArray(width*height*4);
  const owners=atlasOwners(resource);let foreign=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const raw=(y0+y)*resource.width+x0+x,p=y*width+x,owner=owners[raw];data.set(resource.pixels.subarray(raw*4,raw*4+4),p*4);if(owner&&owner!==index+1){data[p*4+3]=0;foreign++;}else if(!owner&&data[p*4+3]){let alien=false,own=false;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x0+x+dx,yy=y0+y+dy;if(xx<0||yy<0||xx>=resource.width||yy>=resource.height)continue;const nearby=owners[yy*resource.width+xx];if(nearby===index+1)own=true;else if(nearby)alien=true;}if(alien&&!own)data[p*4+3]=0;}}
  const labels=new Int32Array(width*height),queue=new Int32Array(width*height),parts=[];let largest=0;
  for(let first=0;first<labels.length;first++){if(labels[first]||data[first*4+3]<16)continue;const id=parts.length+1;let head=0,end=1,minX=width,maxX=0,minY=height,maxY=0;queue[0]=first;labels[first]=id;
   while(head<end){const p=queue[head++],x=p%width,y=Math.floor(p/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const n=ny*width+nx;if(!labels[n]&&data[n*4+3]>=16){labels[n]=id;queue[end++]=n;}}}
   parts.push({size:end,minX,maxX,minY,maxY});if(!largest||end>parts[largest-1].size)largest=id;
  }
  const rejected=new Set();parts.forEach((p,i)=>{if(i+1===largest)return;const nearTop=p.minY<=2&&p.maxY<height*.2,nearBottom=p.maxY>=height-3&&p.minY>height*.8,sideSliver=(p.minX<=1||p.maxX>=width-2)&&(p.maxX-p.minX)<width*.035;if(nearTop||nearBottom||sideSliver)rejected.add(i+1);});
  for(let p=0;p<labels.length;p++){if(rejected.has(labels[p]))data[p*4+3]=0;else if(!labels[p]&&data[p*4+3]){const x=p%width,y=Math.floor(p/width);let removed=false,kept=false;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const label=labels[ny*width+nx];if(label){if(rejected.has(label))removed=true;else kept=true;}}if(removed&&!kept)data[p*4+3]=0;}}
  return{data,width,height,x:(x0-left)/cw*384,y:(y0-top)/ch*384,w:width/cw*384,h:height/ch*384,removed:rejected.size+(foreign?1:0),foreign};
 }
 function isolatedFrame(resource,index){
  if(!resource.frames)resource.frames=new Map();if(resource.frames.has(index))return resource.frames.get(index);
  const crop=framePixels(resource,index),cw=resource.width/4,ch=resource.height/4,ox=index%4*cw,oy=Math.floor(index/4)*ch,pad=Math.ceil(Math.max(cw,ch)*.15),left=Math.max(0,Math.floor(ox)-pad),top=Math.max(0,Math.floor(oy)-pad),right=Math.min(resource.width,Math.ceil(ox+cw)+pad),bottom=Math.min(resource.height,Math.ceil(oy+ch)+pad),width=right-left,height=bottom-top,data=new Uint8ClampedArray(width*height*4);
  let minX=cw,maxX=0,minY=ch,maxY=0;
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const raw=y*resource.width+x,k=((y-top)*width+x-left)*4,inside=x>=Math.ceil(ox)&&x<Math.floor(ox+cw)&&y>=Math.ceil(oy)&&y<Math.floor(oy+ch);
   if(inside){const source=((y-Math.ceil(oy))*crop.width+x-Math.ceil(ox))*4;data.set(crop.data.subarray(source,source+4),k);}
   else if(resource.owners[raw]===index+1)data.set(resource.pixels.subarray(raw*4,raw*4+4),k);
   if(data[k+3]>=16){minX=Math.min(minX,x-ox);maxX=Math.max(maxX,x-ox+1);minY=Math.min(minY,y-oy);maxY=Math.max(maxY,y-oy+1);}
  }
  // Preserve owned parts crossing the atlas boundary, then fit them inside a
  // transparent gutter. This replaces the old cross-cell shoe patch entirely.
  if(resource.registration==='eating'&&!resource.eatingScale){const bounds=Array.from({length:16},()=>({left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity}));for(let y=0;y<resource.height;y++)for(let x=0;x<resource.width;x++){const k=y*resource.width+x,owner=resource.owners[k]-1;if(owner<0||resource.pixels[k*4+3]<16)continue;const b=bounds[owner],xx=x-owner%4*cw,yy=y-Math.floor(owner/4)*ch;if(xx < -pad||xx>cw+pad||yy < -pad||yy>ch+pad)continue;b.left=Math.min(b.left,xx);b.right=Math.max(b.right,xx+1);b.top=Math.min(b.top,yy);b.bottom=Math.max(b.bottom,yy+1);}resource.eatingScale=Math.min(cw*.90/Math.max(1,...bounds.map(b=>b.right-b.left)),ch*.90/Math.max(1,...bounds.map(b=>b.bottom-b.top)));}
  const registered=['animation','eating'].includes(resource.registration),fit=resource.eatingScale|| (registered?Math.min((cw*.90)/Math.max(1,maxX-minX),(ch*.90)/Math.max(1,maxY-minY)):Math.min(1,(cw-8)/Math.max(1,maxX-minX),(ch-8)/Math.max(1,maxY-minY))),dx=registered?cw*.5-(minX+maxX)*.5*fit:Math.max(4-minX*fit,Math.min(0,cw-4-maxX*fit)),dy=registered?ch*.95-maxY*fit:Math.max(4-minY*fit,Math.min(0,ch-4-maxY*fit));
  const tile=document.createElement('canvas');tile.width=width+4;tile.height=height+4;tile.getContext('2d').putImageData(new ImageData(data,width,height),2,2);
  const image=canvas(),ctx=image.getContext('2d',{willReadFrequently:true});image.petFit={scale:fit,x:dx/cw*384,y:dy/ch*384};ctx.drawImage(tile,0,0,tile.width,tile.height,((left-ox-2)*fit+dx)/cw*384,((top-oy-2)*fit+dy)/ch*384,(width+4)*fit/cw*384,(height+4)*fit/ch*384);
  resource.frames.set(index,image);return image;
 }
 function asset(outfit,kind='expressions'){return assetRoot+outfit+'-'+(singleAtlas(outfit)&&kind!=='eating'?'expressions':kind)+'.png';}
 function physicalFrame(outfit,physical){
  const phase=((Number.isFinite(physical.phase)?physical.phase:physical.frame/60)%1+1)%1;
  if(drawnMotion(outfit))return physical.mode==='walking'?Math.floor(phase*12+1e-8)%12:15;
  if(physical.mode==='walking'&&!singleAtlas(outfit))return Math.floor(phase*6+1e-8)%6;
  return ['idle','walking','landing'].includes(physical.mode)?15:['lifting','held','falling'].includes(physical.mode)?singleAtlas(outfit)?15:6:physical.frame;
 }
 function load(outfit,kind='expressions'){
  const key=outfit+':'+(singleAtlas(outfit)&&kind!=='eating'?'expressions':kind);if(cache.has(key))return cache.get(key);
  const task=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{let pixels=null;try{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);pixels=ctx.getImageData(0,0,image.width,image.height).data;}catch{}resolve({image,pixels,width:image.width,height:image.height,registration:kind==='eating'?'eating':kind==='motion'&&!singleAtlas(outfit)?'animation':null});};image.onerror=()=>{cache.delete(key);reject(Error('服装素材加载失败'));};image.src=asset(outfit,kind);});
  cache.set(key,task);if(cache.size>4)cache.delete(cache.keys().next().value);return task;
 }
 function mount(element,{onError=()=>{}}={}){
  element.classList.add('pet-art');let outfit='sakura',pose='idle',motion=true,loop=true,sheet=null,sheetOutfit=null,idleActions=true,portrait=false,blinkOnly=false,revision=0,disposed=false;
  const query=matchMedia('(prefers-reduced-motion: reduce)');
  const blinking=CupboxPetBlink.mount(element,{assetRoot,onError});
  const motionLayer=document.createElement('canvas');motionLayer.width=motionLayer.height=384;motionLayer.className='pet-motion-layer';motionLayer.setAttribute('aria-hidden','true');element.append(motionLayer);const motionCtx=motionLayer.getContext('2d');
  let animationTime=0,reaction=null;const animation=CupboxPetAnimation,composite=canvas();const compositeCtx=composite.getContext('2d');element.dataset.rig='continuous';element.dataset.animationFrames=String(animation.FRAMES);element.dataset.deformation='none';
  let physical={mode:'idle',frame:15,direction:1},motionSheet=null,motionOutfit='',loadingMotion='',motionRevision=0,paintTimer=0,lastPaint=0,lastSource='',transitionStart=0;
  
  const updateBlink=()=>{if(blinkOnly){blinking.configure({outfit:sheetOutfit,frame:Number(element.dataset.frame)||0,base:sheet,procedural:singleAtlas(outfit)||drawnMotion(outfit),enabled:loop});return;}if(pose==='eating'&&physical.mode==='idle'){blinking.configure({outfit,frame:0,base:null,enabled:false});element.dataset.blinkReady=String(eatingOutfit===outfit);return;}if(drawnMotion(outfit)){blinking.configure({outfit,frame:0,base:null,enabled:false});element.dataset.blinkReady=String(motionOutfit===outfit);return;}
   const held=physical.mode==='held'||physical.mode==='lifting',walking=physical.mode==='walking',neutral=physical.mode==='idle'&&pose==='idle',moving=held||walking||neutral,festival=singleAtlas(outfit),frame=atlasFrame(outfit,moving?physicalFrame(outfit,physical):Number(element.dataset.frame)||0);
   blinking.configure({outfit:moving?motionOutfit:sheetOutfit,frame,base:moving?motionSheet:sheet,eyes:held?(festival?walkEyes[outfit]:heldEyes[outfit]):walking&&!festival?null:walking||neutral?walkEyes[outfit]:null,procedural:festival,enabled:motion&&loop&&(physical.mode==='idle'||moving)});
  };
  let eatingSheet=null,eatingOutfit='',eatingLoading='',eatingRevision=0;
  function ensureEating(selected){if(eatingOutfit===selected||eatingLoading===selected)return;const ticket=++eatingRevision;eatingLoading=selected;load(selected,'eating').then(resource=>{if(disposed||ticket!==eatingRevision)return;eatingSheet=resource;eatingOutfit=selected;eatingLoading='';paintMotion();updateBlink();}).catch(error=>{if(disposed||ticket!==eatingRevision)return;eatingLoading='';element.dataset.artError='true';onError(error);});}
  let nativeBlinkStart=-Infinity,nextNativeBlink=performance.now()+2600;
  function nativeBlink(){if(!motion||!loop||query.matches||!drawnMotion(outfit))return;nativeBlinkStart=performance.now();nextNativeBlink=nativeBlinkStart+3800+Math.random()*2500;}
  function paintMotion(){const eating=pose==='eating'&&physical.mode==='idle';element.dataset.eatingReady=String(eatingOutfit===outfit);const physicalDrawing=!portrait&&(physical.mode!=='idle'||pose==='idle'),resource=eating?eatingSheet:physicalDrawing?motionSheet:sheet;const active=resource&&(eating?eatingOutfit:physicalDrawing?motionOutfit:sheetOutfit)===outfit;element.dataset.locomotion=physical.mode;element.dataset.locomotionActive=String(Boolean(active));element.dataset.motionReady=String(motionOutfit===outfit);motionLayer.hidden=!active;if(!active){element.querySelector('.pet-blink-layer').style.transform='none';return;}motionLayer.dataset.frame=String(physical.frame);motionLayer.style.transform='none';
   const walking=physical.mode==='walking',native=drawnMotion(outfit)&&!blinkOnly;let index=eating?(motion&&loop&&!query.matches?Math.floor(animationTime*8)%16:0):physicalDrawing?physicalFrame(outfit,physical):Number(element.dataset.frame)||0;
   if(native&&physicalDrawing&&!walking&&motion&&loop&&!query.matches){const now=performance.now();if(now>=nextNativeBlink)nativeBlink();const elapsed=now-nativeBlinkStart,frames=[15,12,13,14,15];if(elapsed>=0&&elapsed<360){index=frames[Math.min(4,Math.floor(elapsed/72))];element.dataset.blinkFrame=String(index-12);}element.dataset.blink=String(index===13?2:index===12||index===14?1:0);}
   if(native&&(!physicalDrawing||walking||!motion||!loop||query.matches))element.dataset.blink=String(walking&&motion&&loop&&!query.matches?(index===9?2:index===8?1:0):0);
   const key=outfit+':'+(eating?'eating:':physicalDrawing?'motion:':'expression:')+index,sourceIndex=eating?index:atlasFrame(outfit,index);
   if(lastSource!==key){if(!eating&&!physicalDrawing&&lastSource.startsWith(outfit+':')&&motion&&loop&&!query.matches){transitionStart=performance.now();}else transitionStart=0;lastSource=key;}
   motionLayer.dataset.sourceFrame=String(index);motionCtx.clearRect(0,0,384,384);motionCtx.drawImage(isolatedFrame(resource,sourceIndex),0,0);
   const phase=(Number.isFinite(physical.phase)?physical.phase:physical.frame/60)*Math.PI*2;
   const transform=walking?`translateY(${-(Math.sin(phase)**2)*.30}%) rotate(0deg) scaleX(1)`:'none';
   motionLayer.style.transform=transform;element.querySelector('.pet-blink-layer').style.transform=transform;
   motionLayer.dataset.gaitFrame=walking?String(index):'';motionLayer.dataset.originalFrame=String(index);
   if(transitionStart){const progress=Math.min(1,(performance.now()-transitionStart)/120);motionCtx.save();motionCtx.globalCompositeOperation='destination-in';motionCtx.fillStyle=`rgba(0,0,0,${.8+.2*progress})`;motionCtx.fillRect(0,0,384,384);motionCtx.restore();if(progress===1)transitionStart=0;}

   compositeCtx.clearRect(0,0,384,384);compositeCtx.drawImage(motionLayer,0,0);const eyelids=element.querySelector('.pet-blink-layer');if(eyelids&&!native&&!eating){compositeCtx.save();const fit=isolatedFrame(resource,sourceIndex).petFit;compositeCtx.drawImage(eyelids,fit.x,fit.y,384*fit.scale,384*fit.scale);compositeCtx.globalCompositeOperation='destination-in';compositeCtx.drawImage(motionLayer,0,0);compositeCtx.restore();}
   const enabled=motion&&loop&&!query.matches,cycle=animationTime/animation.duration(pose),state=enabled?animation.sample(pose,cycle):{breath:0,hair:0,head:0,ear:0,arm:0,bow:0,bounce:0,spark:0};
   if(!idleActions&&pose==='idle'){state.head=0;state.ear=0;state.hair*=.3;}
   if(enabled&&['lifting','held','falling'].includes(physical.mode)){state.arm=0;state.head=0;state.bow=0;state.bounce=0;state.hair*=.5;state.ear*=.5;}
   if(reaction&&enabled){const t=(animationTime-reaction.start)/reaction.duration;if(t>=1)reaction=null;else{const weight=Math.sin(t*Math.PI)**2,extra=animation.sample(reaction.pose,t);for(const key of ['head','ear','arm','bow','bounce'])state[key]+=extra[key]*weight;}}
   if(enabled)animation.draw(motionCtx,composite,state);else{motionCtx.clearRect(0,0,384,384);motionCtx.drawImage(composite,0,0);}
   element.dataset.animationFrame=String(Math.floor(((cycle%1)+1)%1*60));
  }
  function animate(now){if(disposed)return;if(element.classList.contains('pet-preview-sprite')&&!element.getClientRects().length){lastPaint=now;paintTimer=setTimeout(()=>animate(performance.now()),200);return;}const elapsed=now-lastPaint,interval=1000/animation.FPS;if(elapsed>=interval){const dt=Math.min(.05,elapsed/1000);lastPaint=now;const enabled=motion&&loop&&!query.matches;if(enabled)animationTime+=dt;if(enabled||transitionStart||blinkOnly)paintMotion();}paintTimer=setTimeout(()=>animate(performance.now()),Math.max(1,Math.ceil(interval-(performance.now()-lastPaint))));}
  function ensureMotion(selected){if(motionOutfit===selected||loadingMotion===selected)return;const request=++motionRevision;loadingMotion=selected;load(selected,'motion').then(loaded=>{if(disposed||request!==motionRevision)return;motionSheet=loaded;motionOutfit=selected;loadingMotion='';paintMotion();updateBlink();}).catch(error=>{if(disposed||request!==motionRevision)return;loadingMotion='';onError(error);});}
  function configure(next={}){
   if(disposed)return;
   const nextPose=actions.some(a=>a.id===next.pose)?next.pose:pose;
   const changed=nextPose!==pose;pose=nextPose;if(changed||next.restart){animationTime=0;reaction=null;}
   if(typeof next.portrait==='boolean')portrait=next.portrait;if(typeof next.blinkOnly==='boolean')blinkOnly=next.blinkOnly;element.dataset.blinkOnly=String(blinkOnly);
   if(typeof next.motion==='boolean')motion=next.motion;if(typeof next.idleActions==='boolean')idleActions=next.idleActions;if(typeof next.loop==='boolean')loop=next.loop;
   if(next.locomotion&&['idle','walking','lifting','held','falling','landing'].includes(next.locomotion.mode)&&Number.isInteger(next.locomotion.frame)&&next.locomotion.frame>=0&&next.locomotion.frame<=(next.locomotion.mode==='walking'?59:15))physical={mode:next.locomotion.mode,frame:next.locomotion.frame,direction:next.locomotion.direction===-1?-1:1,phase:next.locomotion.phase,landingProgress:next.locomotion.landingProgress};
   element.dataset.pose=pose;element.dataset.motion=String(motion&&loop);element.dataset.idleActions=String(idleActions);
   element.dataset.frame=String((actions.find(a=>a.id===pose)||actions[0]).frames[0]);
   if(next.restart)element.getAnimations().forEach(animation=>{animation.currentTime=0;});
   updateBlink();
   
   const selected=outfits.some(o=>o.id===next.outfit)?next.outfit:outfit;
   outfit=selected;ensureMotion(selected);if(pose==='eating')ensureEating(selected);if(!motion||!loop||query.matches){nativeBlinkStart=-Infinity;nextNativeBlink=performance.now()+2600;transitionStart=0;paintMotion();}updateBlink();
   if(!sheet||selected!==sheetOutfit){const ticket=++revision;outfit=selected;element.dataset.loading='true';load(selected).then(loaded=>{if(disposed||ticket!==revision)return;sheet=loaded;sheetOutfit=selected;element.dataset.outfit=selected;element.dataset.loading='false';element.dataset.artError='false';updateBlink();paintMotion();}).catch(error=>{if(disposed||ticket!==revision)return;element.dataset.loading='false';element.dataset.artError='true';onError(error);});}
  }
  function hitTest(x,y){if(pose==='eating'&&physical.mode==='idle'&&eatingOutfit===outfit){if(x<0||y<0||x>=1||y>=1)return false;const index=motion&&loop&&!query.matches?Math.floor(animationTime*8)%16:0;return isolatedFrame(eatingSheet,index).getContext('2d').getImageData(Math.floor(x*384),Math.floor(y*384),1,1).data[3]>32;}if(x<0||y<0||x>=1||y>=1)return false;const active=!portrait&&(physical.mode!=='idle'||pose==='idle')&&motionOutfit===outfit,current=active?motionSheet:sheet;if(!current?.pixels)return true;const index=atlasFrame(outfit,active?physicalFrame(outfit,physical):Number(element.dataset.frame)||0);return isolatedFrame(current,index).getContext('2d').getImageData(Math.floor(x*384),Math.floor(y*384),1,1).data[3]>32;}

  configure();paintTimer=setTimeout(()=>animate(performance.now()),0);return{configure,hitTest,blink:()=>drawnMotion(outfit)&&!blinkOnly?nativeBlink():blinking.blink(),react(kind='head'){reaction={pose:kind==='head'?'eartwitch':kind==='face'?'headtilt':kind==='peek'?'peek':'nod',start:animationTime,duration:1.2};if(kind!=='peek'){if(drawnMotion(outfit))nativeBlink();else blinking.blink();}},destroy(){disposed=true;clearTimeout(paintTimer);revision++;motionRevision++;eatingRevision++;blinking.destroy();motionLayer.remove();element.getAnimations().forEach(animation=>animation.cancel());}};
 }
 async function thumbnail(element,outfit,index=0){element.dataset.rig='continuous';const sheet=await load(outfit);const image=isolatedFrame(sheet,atlasFrame(outfit,index)),copy=canvas();copy.style.cssText='width:100%;height:100%;display:block';copy.getContext('2d').drawImage(image,0,0);element.replaceChildren(copy);}
 return{outfits,actions,mount,asset,atlasFrame,framePixels,isolatedFrame,thumbnail,physicalFrame};
})();




