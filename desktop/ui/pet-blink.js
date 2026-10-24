// Composite only AI-drawn eyelids over the original drawing. Bodies never change frames.
window.CupboxPetBlink=(()=>{
 const cache=new Map();
 function load(url){if(cache.has(url))return cache.get(url);const promise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);resolve({image,width:image.width,height:image.height,pixels:ctx.getImageData(0,0,image.width,image.height).data});};image.onerror=()=>{cache.delete(url);reject(Error('眨眼素材加载失败'));};image.src=url;});cache.set(url,promise);if(cache.size>2)cache.delete(cache.keys().next().value);return promise;}
 function center(sheet,index,rows,side,closed=false,expected){
  const cw=sheet.width/4,ch=sheet.height/rows,col=index%4,row=Math.floor(index/4),pixels=sheet.pixels;
  const fallback=expected||[side? .58:.41,index===8?.53:.45];
  if(closed){
   const points=new Set(),originX=Math.floor(col*cw),originY=Math.floor(row*ch),x0=Math.floor((fallback[0]-.070)*cw),x1=Math.ceil((fallback[0]+.070)*cw),y0=Math.floor((fallback[1]-.065)*ch),y1=Math.ceil((fallback[1]+.065)*ch);
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=((originY+y)*sheet.width+originX+x)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2];if(pixels[k+3]>200&&r<140&&g<110&&b<140&&r>g*1.1&&r>b*.75)points.add(y*10000+x);}
   let best=null,bestScore=0;while(points.size){const first=points.values().next().value;points.delete(first);const stack=[first];let n=0,sx=0,sy=0,minX=1e9,maxX=0,minY=1e9,maxY=0;while(stack.length){const key=stack.pop(),y=Math.floor(key/10000),x=key-y*10000;n++;sx+=x;sy+=y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const delta of [-1,1,-10000,10000,-10001,-9999,9999,10001])if(points.delete(key+delta))stack.push(key+delta);}
    const w=maxX-minX+1,h=maxY-minY+1;if(n<3||w<h*1.3)continue;const x=sx/n/cw,y=sy/n/ch,score=n*w/(1+180*((x-fallback[0])**2+(y-fallback[1])**2));if(score>bestScore){bestScore=score;best=[x,y];}
   }return best||fallback;
  }
  const features=new Set();
  const xmin=side?.51:.35,xmax=side?.68:.52,ymin=.35,ymax=.59;
  for(let y=Math.max(0,Math.floor(ymin*ch));y<Math.min(ch,ymax*ch);y++)for(let x=Math.max(0,Math.floor(xmin*cw));x<Math.min(cw,xmax*cw);x++){
   const offset=(Math.floor(row*ch+y)*sheet.width+Math.floor(col*cw+x))*4,r=pixels[offset],g=pixels[offset+1],b=pixels[offset+2];if(pixels[offset+3]<200)continue;
   const match=side?b>r*1.5&&b>g*1.15&&g>85:r>130&&g>70&&b<r*.55&&g<r*.85&&r>g*1.12;
   if(match)features.add(y*10000+x);
  }
  let best=null,bestScore=0;
  while(features.size){const first=features.values().next().value;features.delete(first);const stack=[first];let n=0,sx=0,sy=0,minX=1e9,maxX=0,minY=1e9,maxY=0;while(stack.length){const key=stack.pop(),y=Math.floor(key/10000),x=key-y*10000;n++;sx+=x;sy+=y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const delta of [-1,1,-10000,10000,-10001,-9999,9999,10001])if(features.delete(key+delta))stack.push(key+delta);}
   if(n<2)continue;const x=sx/n/cw,y=sy/n/ch,w=maxX-minX+1,h=maxY-minY+1,aspect=Math.max(w/h,h/w),score=Math.min(n,cw*ch*.002)/(1+500*((x-fallback[0])**2+(y-fallback[1])**2))/(aspect>3?Math.sqrt(aspect):1);if(score>bestScore){bestScore=score;best=[x,y];}
  }
  return best||center(sheet,index,rows,side,true,fallback);
 }
 function mount(element,{assetRoot,onError=()=>{}}){
  const canvas=document.createElement('canvas');canvas.className='pet-blink-layer';canvas.width=canvas.height=384;canvas.setAttribute('aria-hidden','true');element.append(canvas);const ctx=canvas.getContext('2d');
  const query=matchMedia('(prefers-reduced-motion: reduce)');let base=null,atlas=null,outfit='',frame=0,enabled=true,disposed=false,timer=null,ticket=0,phase=0,calibration=null,requested='',registered=null,procedural=false,startedAt=null,nextAt=0;
  const allowed=()=>!disposed&&enabled&&!query.matches&&!document.hidden&&base&&atlas&&calibration;
  function draw(value){phase=value;element.dataset.blink=String(value);ctx.clearRect(0,0,384,384);if(!value||!calibration)return;
   CupboxAcademyEyes.paint(ctx,value,calibration);return;
  }
  function cancel(reset=true){clearTimeout(timer);timer=null;draw(0);if(reset){startedAt=null;nextAt=0;}}
  function schedule(soon=false){clearTimeout(timer);if(!allowed())return;if(!nextAt)nextAt=performance.now()+(soon?1200+Math.random()*1400:3400+Math.random()*2600);timer=setTimeout(blink,Math.max(0,nextAt-performance.now()));}
  function tickBlink(){clearTimeout(timer);if(!allowed()){cancel();return;}const progress=Math.min(1,(performance.now()-startedAt)/500),closure=progress<.30?Math.sin(progress/.30*Math.PI/2):progress<.40?1:Math.cos((progress-.40)/.60*Math.PI/2);draw(Math.max(0,closure)*2);element.dataset.blinkFrame=String(Math.min(29,Math.floor(progress*30)));if(progress<1)timer=setTimeout(tickBlink,1000/60);else{startedAt=null;nextAt=0;draw(0);schedule();}}
  function blink(){clearTimeout(timer);if(!allowed())return;startedAt=performance.now();nextAt=0;tickBlink();}
  function ready(){if(startedAt!==null)tickBlink();else schedule(true);}
  function calibrate(){const resting=[2,8,9].includes(frame),left=center(base,frame,4,0,resting),halfLeft=center(atlas,0,8,0),target=[left,center(base,frame,4,1,resting,[left[0]+.18,left[1]])],half=[halfLeft,center(atlas,0,8,1,false,[halfLeft[0]+.18,halfLeft[1]])],closed=[0,1].map(side=>center(atlas,16,8,side,true,half[side]));calibration={target,1:half,2:closed};}
  function configure(next){if(disposed)return;const sameSubject=next.outfit===outfit&&next.base===base;const changed=next.outfit!==outfit||next.frame!==frame||next.base!==base||(next.eyes||null)!==registered||Boolean(next.procedural)!==procedural;const wasEnabled=enabled;enabled=next.enabled;outfit=next.outfit;frame=next.frame;base=next.base;registered=next.eyes||null;procedural=Boolean(next.procedural);
   if(changed){cancel(false);if(!sameSubject||!enabled){startedAt=null;nextAt=0;}calibration=null;element.dataset.blinkReady='false';if(!base)return;const identity=outfit;const request=++ticket;
    if(identity==='academy'||registered||procedural){const resting=[2,8,9].includes(frame),detected=procedural&&!registered?[0,1].map(side=>{const point=center(base,frame,4,side,resting);return[point[0]*313.5,point[1]*313.5,resting?16:21,resting?8:18,resting];}):registered;atlas=base;calibration=CupboxAcademyEyes.calibrate(base,frame,detected);element.dataset.blinkReady='true';ready();return;}
    const url=assetRoot+identity+'-blink.png';if(requested!==url){requested=url;atlas=null;}
    load(url).then(image=>{if(disposed||request!==ticket)return;atlas=image;calibrate();calibration=CupboxAcademyEyes.calibrate(base,frame,calibration.target.map(point=>[point[0]*313.5,point[1]*313.5,21,18,[2,8,9].includes(frame)]));element.dataset.blinkReady='true';ready();}).catch(error=>{if(disposed||request!==ticket)return;onError(error);});
   }else if(!enabled&&wasEnabled)cancel();else if(enabled&&!wasEnabled)schedule(true);
  }
  const sync=()=>{cancel();schedule(true);};query.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  return{configure,blink,destroy(){disposed=true;ticket++;cancel();query.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);canvas.remove();}};
 }
 return{mount};
})();
