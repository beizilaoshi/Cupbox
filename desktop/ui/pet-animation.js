// Intact original artwork, small rigid motion, sampled at at most 60 fps.
window.CupboxPetAnimation=(()=>{
 const FRAMES=60,FPS=60,TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const durations={idle:5.4,greeting:2.4,thinking:4.2,working:2.1,sleep:6.2,success:2.6,stretch:4,heart:3.6,nod:2.4,headtilt:3.2,eartwitch:2.6,peek:3.4,pawwave:2.2,thankyou:3.2,yawn:4.8,proud:3.4};
 function poseState(pose,phase){
  const p=((phase%1)+1)%1,s=Math.sin(p*TAU),pulse=Math.sin(p*Math.PI)**2;
  const state={breath:s*1.25,hair:Math.sin(p*TAU-.7)*1.8,head:s*.006,ear:Math.sin(p*TAU*2)*.012,arm:0,bow:0,bounce:0,spark:0};
  if(['greeting','pawwave'].includes(pose)){state.arm=Math.sin(p*TAU*3)*.18*pulse;state.head=s*.015;}
  if(['heart','thankyou','cheer'].includes(pose)){state.bow=pulse*(pose==='thankyou'?.045:.015);state.spark=pulse;state.arm=s*.025;}
  if(['success','hop','proud'].includes(pose)){state.bounce=-pulse*3;state.ear=s*.026;state.spark=pulse;}
  if(['thinking','headtilt','listening'].includes(pose))state.head=s*(pose==='headtilt'?.035:.018);
  if(pose==='nod'){state.bow=pulse*.05;state.head=s*.008;}
  if(pose==='eartwitch'){state.ear=Math.sin(p*TAU*4)*.065*pulse;state.head=s*.012;}
  if(pose==='peek'){state.head=s*.035;state.hair=s*3;state.bounce=-pulse*1.5;}
  if(['working','reading','reviewing'].includes(pose)){state.arm=s*.018;state.bow=pulse*.012;}
  if(['stretch','yawn'].includes(pose)){state.bow=-pulse*.025;state.arm=s*.025;state.breath=-pulse*2;}
  if(pose==='sleep'){state.breath=s*.8;state.head=0;state.ear=0;}
  return state;
 }
 const clips=new Map();
 function sample(pose,phase){if(!clips.has(pose))clips.set(pose,Array.from({length:FRAMES},(_,i)=>poseState(pose,i/FRAMES)));const clip=clips.get(pose),position=(((phase%1)+1)%1)*FRAMES,index=Math.floor(position),mix=position-index,a=clip[index],b=clip[(index+1)%FRAMES];return Object.fromEntries(Object.keys(a).map(key=>[key,a[key]+(b[key]-a[key])*mix]));}
 // Animate the intact drawing as one rigid object. Local mesh warping and limb
 // extraction distort embroidered fabric and facial features, so neither is used.
 function transform(s){return{angle:clamp((s.head||0)*.35,-.012,.012),x:0,y:clamp((s.breath||0)*.16+(s.bounce||0)*.18,-1,1)};}
 function point(x,y,s){const t=transform(s),dx=x-192,dy=y-350,c=Math.cos(t.angle),sn=Math.sin(t.angle);return[192+dx*c-dy*sn+t.x,350+dx*sn+dy*c+t.y];}
 function draw(ctx,source,state){const t=transform(state);ctx.clearRect(0,0,384,384);ctx.save();ctx.translate(192+t.x,350+t.y);ctx.rotate(t.angle);ctx.drawImage(source,-192,-350);ctx.restore();}
 return{FRAMES,FPS,sample,point,draw,transform,duration:pose=>durations[pose]||3.8};
})();
