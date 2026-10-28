// Generated room layers and identity-preserving sprite atlas, rendered locally.
window.CupboxRoomArt=(()=>{
 const base=new URL('assets/about-room/',document.currentScript.src),images={},sheets={},frames=new Map();let error='';
 const load=(name,url)=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[name]=im;resolve(im);};im.onerror=()=>reject(Error('房间素材加载失败：'+name));im.src=url;});
 async function sheet(name,url){const im=await load(name,url),c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);sheets[name]={width:c.width,height:c.height,pixels:ctx.getImageData(0,0,c.width,c.height).data,registration:'animation'};}
 const ready=Promise.all([load('day',new URL('room-day-v2.png',base)),load('night',new URL('room-night-v2.png',base)),sheet('maid',new URL('zhumengmiao-actions-v2.png',base)),sheet('cozy',new URL('../pet/cozy-expressions.png',base)),sheet('academy',new URL('../pet/academy-expressions.png',base))]).then(()=>true).catch(e=>{error=e.message;return false;});
 const index={work:3,eat:4,sleep:5,walk:1,read:6,tea:7,water:8,stretch:9,window:10,play:11,dance:12,tidy:13};
 const legacy={work:5,eat:0,sleep:8,walk:0,read:5,tea:0,water:0,stretch:9,window:4,play:2,dance:2,tidy:5};
 function tile(outfit,action,t){let i=outfit==='maid'?index[action]??0:legacy[action]??0;if(outfit==='maid'&&action==='walk')i=Math.floor(t*5)%2?1:2;if(outfit==='maid'&&action==='work')i=Math.floor(t*3)%2?3:15;const key=outfit+':'+i;if(!frames.has(key))frames.set(key,CupboxPetArt.isolatedFrame(sheets[outfit],i));return frames.get(key);}
 function backdrop(ctx,period,weather,lamp,t){ctx.imageSmoothingEnabled=true;ctx.drawImage(images[['night','midnight'].includes(period)?'night':'day'],0,0,480,300);
  const tint={morning:['#ffe9ce',.09],noon:['#fff7df',.045],afternoon:['#c4dcff',.035],dusk:['#e9a178',.22],night:['#142347',.08],midnight:['#121d42',.27]}[period];ctx.save();ctx.fillStyle=tint[0];ctx.globalAlpha=tint[1];ctx.fillRect(0,0,480,300);ctx.restore();
  if(weather!=='clear'){ctx.save();ctx.beginPath();ctx.rect(74,5,95,69);ctx.clip();ctx.globalAlpha=.65;ctx.fillStyle=weather==='snow'?'#f0f4ff':'#c6ddfc';for(let i=0;i<55;i++){const x=74+(i*17+t*(weather==='rain'?8:2))%95,y=5+(i*13+t*(weather==='rain'?44:9))%69;ctx.fillRect(x,y,weather==='snow'?.65:.35,weather==='snow'?.65:2.8);}ctx.restore();}
  if(!lamp){ctx.save();ctx.fillStyle='#182343';ctx.globalAlpha=.32;ctx.beginPath();ctx.ellipse(175,113,20,25,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 }
 function character(ctx,action,x,y,t,outfit,moving){const pose=moving?'walk':action,frame=tile(outfit,pose,t),size=pose==='sleep'?90:pose==='work'?82:78;const bob=pose==='walk'?Math.sin(t*10)*.8:pose==='dance'?Math.sin(t*5)*1.3:Math.sin(t*1.7)*.25;
  ctx.save();ctx.imageSmoothingEnabled=true;
  ctx.fillStyle='#20243b';ctx.globalAlpha=.18;ctx.beginPath();ctx.ellipse(x,y-1,pose==='sleep'?30:19,3,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.drawImage(frame,x-size/2,y-size+bob,size,size);ctx.restore();
  if(pose==='sleep'){ctx.save();ctx.fillStyle='#f7ebff';ctx.font='6px monospace';ctx.globalAlpha=.8;ctx.fillText('z Z',x-16,y-54-(Math.floor(t)%3));ctx.restore();}
 }
 function draw(ctx,{period,weather,lamp,t,action,x,y,outfit,moving}){if(!images.day||!images.night||!sheets[outfit])return false;backdrop(ctx,period,weather,lamp,t);character(ctx,action,x,y,t,outfit,moving);return true;}
 return{ready,draw,status:()=>({ready:Boolean(images.day&&images.night&&sheets.maid&&sheets.cozy&&sheets.academy),error,daySize:images.day?[images.day.naturalWidth,images.day.naturalHeight]:null,spriteSize:images.maid?[images.maid.naturalWidth,images.maid.naturalHeight]:null})};
})();
