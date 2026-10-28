// Same sakura artwork and title composition; layered wind, blossom lighting and close-focus petals.
window.CupboxSakuraScene=(()=>{
 const ease=t=>1-(1-Math.max(0,Math.min(1,t)))**3;
 function mount(screen){
  const canvas=document.createElement('canvas');canvas.className='startup-sakura';canvas.setAttribute('aria-hidden','true');screen.append(canvas);
  const foreground=document.createElement('canvas');foreground.className='startup-sakura startup-sakura-near';foreground.setAttribute('aria-hidden','true');screen.append(foreground);const front=foreground.getContext('2d');
  const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let running=false,raf=0,elapsed=0,last=0,width=1,height=1,seed=1482,duration=5,cx=0,cy=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const petals=Array.from({length:1280},()=>({x:random(),y:random(),size:5+random()*17,depth:random(),phase:random()*Math.PI*2,speed:32+random()*53,turn:random()*2-1,color:Math.floor(random()*3)}));
  const flowers=Array.from({length:14},()=>({x:random(),y:random(),size:32+random()*42,phase:random()*Math.PI*2,depth:random()}));
  const motes=Array.from({length:240},()=>({x:random(),y:random(),phase:random()*Math.PI*2}));
  function petalPath(c,s){c.beginPath();c.moveTo(0,-s*.64);c.bezierCurveTo(s*.27,-s*1.10,s*.79,-s*.88,s*.75,-s*.27);c.bezierCurveTo(s*.73,s*.32,s*.27,s*.79,0,s);c.bezierCurveTo(-s*.29,s*.75,-s*.78,s*.27,-s*.75,-s*.27);c.bezierCurveTo(-s*.80,-s*.87,-s*.28,-s*1.10,0,-s*.64);c.closePath();}
  function texture(color,flower=false){const image=document.createElement('canvas');image.width=image.height=160;const c=image.getContext('2d');c.translate(80,80);const palette=[['#fff1f8','#ed9fc5','#c7569c'],['#fff','#f7cfe3','#d993bc'],['#f1f8ff','#cbb6ed','#aa7bcc']][color];
   function leaf(s){const g=c.createLinearGradient(-s,-s*.2,s,s*.3);g.addColorStop(0,palette[0]);g.addColorStop(.48,palette[1]);g.addColorStop(.88,palette[2]);g.addColorStop(1,palette[1]);petalPath(c,s);c.fillStyle=g;c.fill();c.strokeStyle='#fff9';c.lineWidth=.8;c.stroke();c.beginPath();c.moveTo(0,s*.8);c.bezierCurveTo(-s*.08,s*.3,s*.03,-s*.2,0,-s*.55);c.strokeStyle='#fff5';c.lineWidth=.7;c.stroke();}
   if(flower){for(let i=0;i<5;i++){c.save();c.rotate(i*Math.PI*2/5);c.translate(0,-24);leaf(26);c.restore();}c.fillStyle='#e3b474';for(let i=0;i<10;i++){c.beginPath();c.arc(Math.cos(i*Math.PI/5)*9,Math.sin(i*Math.PI/5)*9,1.6,0,Math.PI*2);c.fill();}}else leaf(56);return image;}
  const petalTextures=[0,1,2].map(c=>texture(c)),fallbackFlower=texture(0,true);
  const blurTextures=petalTextures.map(image=>{const c=document.createElement('canvas');c.width=c.height=200;const g=c.getContext('2d');g.filter='blur(3px)';g.drawImage(image,20,20,160,160);return c;});
  let protectedBounds=[];
  function bounds(el){let x=0,y=0,node=el;while(node&&node!==screen){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent;}return{x,y,w:el.offsetWidth,h:el.offsetHeight};}
  function resize(){width=Math.max(1,screen.clientWidth);height=Math.max(1,screen.clientHeight);const ratio=window.devicePixelRatio||1;for(const [surface,c]of [[canvas,ctx],[foreground,front]]){surface.width=Math.round(width*ratio);surface.height=Math.round(height*ratio);c.setTransform(ratio,0,0,ratio,0,0);}const logo=bounds(screen.querySelector('.startup-logo'));cx=logo.x+logo.w/2;cy=logo.y+logo.h/2;protectedBounds=[logo,bounds(screen.querySelector('.startup-content h1')),bounds(screen.querySelector('#skip-startup'))];}
  function sprite(c,image,x,y,size,angle,alpha,flip=1){if(alpha<.005)return;c.save();c.translate(x,y);c.rotate(angle);c.scale(Math.max(.12,Math.abs(flip)),1);c.globalAlpha=Math.max(0,Math.min(1,alpha));c.drawImage(image,-size,-size,size*2,size*2);c.restore();}
  function glow(c,x,y,r,color,alpha){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.save();c.globalAlpha=alpha;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
  function protection(x,y){let value=0;for(const b of protectedBounds){const dx=Math.max(b.x-x,0,x-b.x-b.w),dy=Math.max(b.y-y,0,y-b.y-b.h);value=Math.max(value,1-Math.min(1,Math.hypot(dx,dy)/70));}return value;}
  function position(x,y,progress,depth,phase){const dx=x-cx,dy=y-cy,delay=depth*.022;let scale=1,angle=0;
   if(progress<.255+delay){const t=ease(Math.max(0,progress-delay)/.255);scale=1-t*.89;angle=t*(.82+depth*.28);}
   else if(progress<.53+delay){const t=ease((progress-.255-delay)/.275);scale=.11+t*.89;angle=(1-t)*(1.1+depth*.3);}
   const length=Math.max(1,Math.hypot(dx,dy)),wreath=(1-scale)**2*78,rx=(dx*Math.cos(angle)-dy*Math.sin(angle)),ry=(dx*Math.sin(angle)+dy*Math.cos(angle));
   const drift=Math.max(0,progress-.53)*5,wind=Math.sin(progress*6.2+phase)*drift*(12+depth*22);return{x:cx+rx*(scale+wreath/length)+drift*(30+depth*42)+wind,y:cy+ry*(scale+wreath/length)+drift*(14+depth*35),scale};
  }
  function breeze(progress,time){ctx.save();ctx.globalCompositeOperation='screen';
   // Diffuse sunlight stays behind the same painted branches and frosted title.
   const bloom=Math.sin(Math.max(0,Math.min(1,(progress-.23)/.40))*Math.PI);
   glow(ctx,cx,cy,Math.min(width,height)*(.21+bloom*.25),'#ffcae9',.14+bloom*.26);
   glow(ctx,width*.18+Math.sin(time*.3)*35,height*.12,Math.min(width,height)*.56,'#d2e9ff',.16);
   glow(ctx,width*.88,height*.24+Math.sin(time*.4)*20,Math.min(width,height)*.44,'#fff0db',.14+bloom*.08);
   // Fine curved pollen currents, not a solid luminous ribbon.
   const open=ease(Math.max(0,progress-.38)/.25);for(let lane=0;lane<5;lane++){const shift=lane*height*.10;
    for(let i=0;i<52;i++){const t=i/51,x=(t*1.3-.15)*width+(time*12)%60,y=height*.11+shift+Math.sin(t*5.2+time*.45+lane*.5)*height*.13;const shimmer=Math.max(0,Math.sin(t*14-time*1.1+lane));ctx.globalAlpha=open*shimmer*(.06+(i%5)*.014);ctx.fillStyle=i%3?'#fff7e9':'#ffe0f1';ctx.beginPath();ctx.arc(x,y,.6+(i%4)*.23,0,Math.PI*2);ctx.fill();}}
   if(progress>.265&&progress<.66)for(let wave=0;wave<3;wave++){const t=(progress-.265-wave*.035)/.31;if(t<0||t>1)continue;ctx.globalAlpha=Math.sin(t*Math.PI)*.16*(1-t);ctx.strokeStyle=wave===1?'#fff2fd':'#d5ebff';ctx.lineWidth=wave===0?2:1;ctx.beginPath();ctx.ellipse(cx,cy,70+ease(t)*width*.65,50+ease(t)*height*.7,-.12,0,Math.PI*2);ctx.stroke();}
   ctx.restore();
  }
  function glint(c,x,y,r,alpha){c.save();c.globalCompositeOperation='screen';c.globalAlpha=alpha;c.strokeStyle='#fff7ef';c.lineWidth=.8;c.beginPath();c.moveTo(x-r,y);c.quadraticCurveTo(x,y,x,y-r*1.5);c.quadraticCurveTo(x,y,x+r,y);c.quadraticCurveTo(x,y,x,y+r*1.5);c.quadraticCurveTo(x,y,x-r,y);c.stroke();c.restore();}
  function draw(){ctx.clearRect(0,0,width,height);front.clearRect(0,0,width,height);const progress=Math.min(1,elapsed/duration),time=progress*5;screen.dataset.scenePhase=progress<.24?'gather':progress<.49?'bloom':'drift';breeze(progress,time);
   for(let layer=0;layer<4;layer++)for(const p of petals){const group=p.depth<.27?0:p.depth<.68?1:p.depth<.92?2:3;if(group!==layer)continue;const near=layer===3,c=near?front:ctx,wind=Math.sin(time*(.35+p.depth*.22)+p.phase)*(9+p.depth*33),targetX=p.x*(width+240)-120+wind,targetY=p.y*(height+270)-220+time*p.speed*(.08+p.depth*.28),pos=position(targetX,targetY,progress,p.depth,p.phase),protect=protection(pos.x,pos.y),settle=ease(Math.max(0,progress-.18)/.18);
    const alpha=(layer===0?.30:.55+p.depth*.32)*(1-protect*(near?.98:.66)*settle)*(.58+.42*pos.scale),size=p.size*(layer===0?.5:layer===1?.9:near?2.2:1.25)*(.66+.34*pos.scale)*(1+.08*Math.sin(time+p.phase)),angle=p.phase+time*p.turn*(.45+p.depth*.72)+Math.sin(time*.8+p.phase)*.22;
    sprite(c,near&&p.depth>.96?blurTextures[p.color]:petalTextures[p.color],pos.x,pos.y,size,angle,alpha,Math.cos(time*(.6+p.depth*.6)+p.phase));
    const shimmer=Math.max(0,Math.sin(time*1.6+p.phase*3)-.94)/.06;if(layer===2&&shimmer>0&&progress>.48&&protect<.2)glint(ctx,pos.x,pos.y,2.5+p.depth*2,shimmer*.35);
   }
   for(const f of flowers){let tx=f.x*(width+140)-70,ty=f.y*(height+160)-80;if(Math.abs(tx-width*.5)<width*.31&&ty>height*.20&&ty<height*.83)tx=tx<width*.5?width*.055:width*.945;const pos=position(tx+Math.sin(time*.35+f.phase)*18,ty+time*(8+f.depth*9),progress,f.depth,f.phase);sprite(ctx,fallbackFlower,pos.x,pos.y,f.size*(.65+.35*pos.scale),f.phase+time*.13,.62+.20*ease(progress/.7));}
   ctx.save();ctx.globalCompositeOperation='screen';for(const m of motes){const x=m.x*width+Math.sin(time*.7+m.phase)*14,y=m.y*height-time*(2+Math.sin(m.phase)*2),twinkle=(Math.sin(time*1.2+m.phase)+1)*.5;ctx.globalAlpha=(.07+twinkle*.24)*(1-protection(x,y)*.6);ctx.fillStyle='#fff3df';ctx.beginPath();ctx.arc(x,y,.6+twinkle*.9,0,Math.PI*2);ctx.fill();}ctx.restore();
   // A few defocused edge petals pass in front of the glass without covering the wordmark.
   for(let i=0;i<7;i++){const t=Math.max(0,Math.min(1,(progress-.40-i*.045)/.34));if(t===0||t===1)continue;const fromLeft=i%2===0,x=fromLeft?-90+ease(t)*width*.28:width+90-ease(t)*width*.28,y=height*(.08+(i%4)*.26)+Math.sin(t*Math.PI)*45,alpha=Math.sin(t*Math.PI)*.42*(1-protection(x,y));sprite(front,blurTextures[i%3],x,y,44+i*7,time*.4+i,alpha,Math.cos(time*.7+i));}
  }
  function tick(now){raf=0;if(!running||document.hidden||reduced.matches)return;elapsed+=last?Math.max(0,(now-last)/1000):0;last=now;draw();raf=requestAnimationFrame(tick);}
  function stop(){running=false;cancelAnimationFrame(raf);raf=0;last=0;canvas.hidden=true;foreground.hidden=true;}
  function start(seconds=5){stop();if(reduced.matches)return;duration=seconds;elapsed=0;running=true;canvas.hidden=false;foreground.hidden=false;resize();draw();if(!document.hidden)raf=requestAnimationFrame(tick);}
  function visibility(){cancelAnimationFrame(raf);raf=0;last=0;if(running&&!document.hidden&&!reduced.matches)raf=requestAnimationFrame(tick);}
  const onReduced=()=>{if(reduced.matches)stop();},observer=new ResizeObserver(()=>{if(running){resize();draw();}});observer.observe(screen);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',onReduced);window.addEventListener('pagehide',()=>{stop();observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',onReduced);},{once:true});
  return{start,stop};
 }
 return{mount};
})();
