'use strict';
window.CupboxStartupScenes=(()=>{
  const catalog={
    cinema:{name:'云境漫游',caption:'穿行全屏云境，镜头推入流光深处',builtin:true,wordmark:'Cupbox',eyebrow:'CUPBOX · DREAM VOYAGE',tagline:'云境漫游 · 从此刻启程'},
    pulse:{name:'光核绽放',caption:'光核聚合、晶翼展开、万千微光绽放',builtin:true,wordmark:'Cupbox',eyebrow:'CUPBOX · LUMINOUS GENESIS',tagline:'光核绽放 · 点亮新的可能'},
    prism:{name:'流虹星幕',caption:'虹色绸缎穿过星海，流星点亮光幕',wordmark:'Cupbox',eyebrow:'CUPBOX · AURORA SILK',tagline:'流虹星幕 · 让每一束灵感发光'},
    inkflow:{name:'墨染青岚',caption:'青绿群山逐层晕染，金色流墨穿行云海',wordmark:'Cupbox',eyebrow:'CUPBOX · JADE LANDSCAPE',tagline:'墨染青岚 · 灵感自山海而来'},
    fireworks:{name:'星屑花火',caption:'多层花火次第盛放，星尘沿夜空坠落',wordmark:'Cupbox',eyebrow:'CUPBOX · STARDUST FESTIVAL',tagline:'星屑花火 · 此刻为灵感绽放'},
    moonsea:{name:'月海浮光',caption:'银月从薄雾升起，流光映入层层海浪',wordmark:'Cupbox',eyebrow:'CUPBOX · LUNAR TIDE',tagline:'月海浮光 · 与灵感共赴星海'},
    quantmatrix:{name:'幻方量化 · 矩阵序章',caption:'深空跃迁 → 魔方重构 → 超新星点亮品牌',geometry:true,wordmark:'Cupbox',eyebrow:'CUPBOX · QUANTUM GENESIS',tagline:'幻方量化 · 矩阵序章'},
    quantorbit:{name:'幻方量化 · 星环演算',caption:'引力旋涡 → 多维星环 → 极光能量绽放',geometry:true,wordmark:'Cupbox',eyebrow:'CUPBOX · ORBITAL RESONANCE',tagline:'幻方量化 · 星环演算'},
    lattice:{name:'晶格方舟',caption:'五重冰蓝晶格展开，能量沿立体光桥流动',geometry:true,wordmark:'Cupbox',eyebrow:'CUPBOX · LATTICE',tagline:'晶格方舟 · 灵感在此成形'},
    honeycomb:{name:'六边蜂巢',caption:'黑金六边体起伏拼合，鎏金脉冲逐圈唤醒',geometry:true,wordmark:'Cupbox',eyebrow:'CUPBOX · HONEYCOMB',tagline:'六边蜂巢 · 从一点连接无限'},
    origami:{name:'折纸棱镜',caption:'珠光折面从碎片聚合，双层棱镜轻盈绽开',geometry:true,wordmark:'Cupbox',eyebrow:'CUPBOX · ORIGAMI',tagline:'折纸棱镜 · 折叠想象的边界'},
    mobius:{name:'莫比乌斯环',caption:'虹彩曲面连续扭转，流光沿无限之环追逐',geometry:true,wordmark:'Cupbox',eyebrow:'CUPBOX · MÖBIUS',tagline:'莫比乌斯环 · 灵感循环不息'},
    polyhedron:{name:'星轨多面体',caption:'翡翠晶面聚合，鎏金星轨环绕多面核心',geometry:true,wordmark:'Cupbox',eyebrow:'CUPBOX · POLYHEDRON',tagline:'星轨多面体 · 汇聚每一种可能'}
  };
  const originals=new WeakMap();
  function configure(screen,key){
    const selectors=['.startup-wordmark','.startup-eyebrow','.startup-tagline','.startup-arrival>span'];
    if(!originals.has(screen))originals.set(screen,selectors.map(s=>screen.querySelector(s)?.textContent||''));
    const defaults=originals.get(screen),row=catalog[key],values=row?.wordmark?[row.wordmark,row.eyebrow,row.tagline,'Cupbox · 进入工作台']:defaults;
    screen.dataset.procedural=String(Boolean(row));screen.dataset.geometry=String(Boolean(row?.geometry));
    screen.dataset.cinematic=String(key==='quantmatrix'||key==='quantorbit');
    screen.dataset.premium=String(Boolean(row));
    screen.dataset.fullstage=String(Boolean(row));
    selectors.forEach((s,i)=>{const node=screen.querySelector(s);if(node)node.textContent=values[i];});
  }
  function cards(){const grid=document.querySelector('.startup-grid'),before=grid.querySelector('[data-startup-style=custom]');for(const [key,row]of Object.entries(catalog)){if(row.builtin){const existing=grid.querySelector('[data-startup-style='+key+']');existing.querySelector('b').textContent=row.name;existing.querySelector('small').textContent=row.caption;const art=existing.querySelector('.startup-card-art');art.className='startup-card-art scene-art scene-'+key;art.querySelector('img').src='assets/cupbox-logo.svg';continue;}const button=document.createElement('button');button.type='button';button.className='startup-card';button.dataset.startupStyle=key;button.setAttribute('aria-pressed','false');const art=document.createElement('span');art.className='startup-card-art scene-art scene-'+key;art.setAttribute('aria-hidden','true');for(let i=0;i<3;i++)art.append(document.createElement('i'));if(row.wordmark){const logo=document.createElement('img'),brand=document.createElement('span');logo.src='assets/cupbox-logo.svg';logo.alt='';logo.className='scene-brand-logo';brand.className='scene-brand-name';brand.textContent='Cupbox';art.append(logo,brand);}const name=document.createElement('b'),caption=document.createElement('small');name.textContent=row.name;caption.textContent=row.caption;button.append(art,name,caption);grid.insertBefore(button,before);}}
  function filters(){const grid=document.querySelector('.startup-grid'),all=[...grid.querySelectorAll('.startup-card')],group=document.createElement('div');group.className='startup-scene-filters';group.setAttribute('role','group');group.setAttribute('aria-label','筛选启动动画');const match=(card,key)=>key==='all'||key==='geometry'&&catalog[card.dataset.startupStyle]?.geometry||key==='ambient'&&card.dataset.startupStyle!=='custom'&&!catalog[card.dataset.startupStyle]?.geometry||key==='custom'&&card.dataset.startupStyle==='custom';for(const [key,label]of [['all','全部'],['geometry','几何'],['ambient','光影'],['custom','自定义']]){const button=document.createElement('button');button.type='button';button.dataset.startupFilter=key;button.textContent=label+' · '+all.filter(c=>match(c,key)).length;button.classList.toggle('active',key==='all');button.setAttribute('aria-pressed',String(key==='all'));button.onclick=()=>{for(const b of group.children){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}for(const card of all)card.hidden=!match(card,key);};group.append(button);}grid.before(group);}
  const artwork={prism:'aurora',inkflow:'jade',moonsea:'lunar',quantmatrix:'cathedral',lattice:'cathedral',quantorbit:'orbital',mobius:'liquid',origami:'paper',polyhedron:'emerald',honeycomb:'hive',fireworks:'festival',cinema:'aurora',pulse:'liquid'};
  function mount(screen){
    const canvas=document.createElement('canvas');canvas.className='startup-scene-canvas';canvas.setAttribute('aria-hidden','true');screen.prepend(canvas);
    const ctx=canvas.getContext('2d'),images={};
    for(const key of new Set(Object.values(artwork))){const img=new Image();img.src='assets/opening-'+key+'.png';images[key]=img;}
    let running=false,frame=0,started=0,duration=5,style='',w=1,h=1,p=0,t=0,faces=[],customImage=null;
    const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b)=>{const x=clamp((p-a)/(b-a));return x*x*(3-2*x);};
    const fract=x=>x-Math.floor(x),hash=i=>fract(Math.sin(i*127.1+91.7)*43758.5453);
    const palette={prism:[270,85,70],inkflow:[45,75,68],fireworks:[305,85,74],moonsea:[200,80,80],quantmatrix:[195,88,65],quantorbit:[275,86,73],lattice:[195,90,76],honeycomb:[42,80,62],origami:[300,70,78],mobius:[210,80,72],polyhedron:[145,65,65],cinema:[280,65,80],pulse:[220,78,85]};
    const cube=Array.from({length:8},(_,i)=>[(i&1)?1:-1,(i&2)?1:-1,(i&4)?1:-1]),cubeFaces=[[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]];
    const octa=[[0,-1,0],[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1]],octaFaces=Array.from({length:8},(_,i)=>[i%2,2+Math.floor(i/2),2+(Math.floor(i/2)+1)%4]);
    const phi=(1+Math.sqrt(5))/2,ico=[];for(const a of [-1,1])for(const b of [-phi,phi])ico.push([0,a,b],[a,b,0],[b,0,a]);
    const icoFaces=[];for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)for(let k=j+1;k<12;k++)if([[i,j],[i,k],[j,k]].every(([a,b])=>Math.hypot(...ico[a].map((v,d)=>v-ico[b][d]))<2.01))icoFaces.push([i,j,k]);
    function resize(){const box=screen.getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1);w=Math.max(1,box.width);h=Math.max(1,box.height);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx?.setTransform(ratio,0,0,ratio,0,0);}
    function rotation([x,y,z],yaw=0,pitch=0,roll=0){const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw),c=y*Math.cos(pitch)-b*Math.sin(pitch),d=y*Math.sin(pitch)+b*Math.cos(pitch);return[a*Math.cos(roll)-c*Math.sin(roll),a*Math.sin(roll)+c*Math.cos(roll),d];}
    function project([x,y,z]){const k=5.8/Math.max(1.1,5.8+z),unit=Math.min(w,h)*.255;return[w*.5+x*unit*k,h*.46+y*unit*k,z];}
    function line(points,color,alpha=1,width=1){if(points.length<2)return;ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke();}
    function glow(x,y,r,color,alpha=1){if(r<=0)return;ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    function spark(x,y,size,color,alpha){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x-size*.3,y-size*.3,size*.6,size*.6);if(size>2){line([[x-size,y],[x+size,y]],color,alpha,.8);line([[x,y-size],[x,y+size]],color,alpha,.8);}}
    function mesh(vertices,indices,{scale=1,yaw=0,pitch=0,roll=0,offset=[0,0,0],hue=200,saturation=70,alpha=.85,explode=0,edges=true}={}){
      for(let index=0;index<indices.length;index++){
        const f=indices[index].map(i=>vertices[i]),center=f.reduce((a,v)=>a.map((n,j)=>n+v[j]/f.length),[0,0,0]);
        const world=f.map(v=>rotation(v.map((n,j)=>(n+center[j]*explode)*scale),yaw,pitch,roll).map((n,j)=>n+offset[j]));
        const a=world[1].map((v,j)=>v-world[0][j]),b=world[2].map((v,j)=>v-world[0][j]),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...normal)||1;
        const light=Math.abs((normal[0]*-.38+normal[1]*-.66+normal[2]*-.62)/length);
        faces.push({points:world.map(project),z:world.reduce((n,v)=>n+v[2],0)/world.length,hue:hue+(index%3)*8,saturation,light,alpha,edges});
      }
    }
    function renderFaces(){
      faces.sort((a,b)=>b.z-a.z);
      for(const f of faces){const points=f.points,x=points.reduce((n,v)=>n+v[0],0)/points.length,y=points.reduce((n,v)=>n+v[1],0)/points.length,light=25+f.light*48;
        const g=ctx.createLinearGradient(x-90,y-80,x+100,y+110);g.addColorStop(0,`hsl(${f.hue} ${f.saturation}% ${Math.min(92,light+20)}%)`);g.addColorStop(.42,`hsl(${f.hue+15} ${f.saturation}% ${light}%)`);g.addColorStop(.56,`hsl(${f.hue-15} ${Math.max(15,f.saturation-25)}% ${Math.min(94,light+25)}%)`);g.addColorStop(1,`hsl(${f.hue+20} ${f.saturation}% ${Math.max(15,light-13)}%)`);
        ctx.globalAlpha=f.alpha;ctx.fillStyle=g;ctx.beginPath();points.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fill();if(f.edges){ctx.strokeStyle=`hsla(${f.hue} 90% 91% / .55)`;ctx.lineWidth=.7;ctx.stroke();}
      }
      faces=[];
    }
    function drawEnvironment(){
      const image=customImage||images[artwork[style]],progress=smooth(0,.7),zoom=style==='cinema'?1.02+progress*.18:1.2-progress*.17;
      const dark=['honeycomb','fireworks','pulse'].includes(style);ctx.globalAlpha=1;ctx.fillStyle=dark?'#070615':'#080c20';ctx.fillRect(0,0,w,h);
      if(image?.complete&&image.naturalWidth){
        const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight)*zoom,iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
        ctx.globalAlpha=['polyhedron','origami','mobius','quantorbit'].includes(style)?.83:1;
        ctx.drawImage(image,(w-iw)/2+Math.sin(t*.13)*w*.008,(h-ih)/2+Math.cos(t*.12)*h*.008,iw,ih);
      }
      const [hue]=palette[style];glow(w*.5,h*.45,Math.max(w,h)*.7,`hsla(${hue} 80% 50% / .2)`,1);
      // A centered depth vignette leaves the scenery visible; the brand receives a local veil later.
      const g=ctx.createRadialGradient(w*.5,h*.46,h*.12,w*.5,h*.48,Math.max(w,h)*.7);g.addColorStop(0,'#02051300');g.addColorStop(.72,'#03061626');g.addColorStop(1,'#020310bc');ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }
    function starfield(count=250,warp=0){
      const [hue]=palette[style];ctx.save();ctx.globalCompositeOperation='lighter';
      for(let i=0;i<count;i++){const z=fract(hash(i+1)+t*(.018+warp*.13)),a=hash(i+601)*TAU,d=(.03+z*z*1.3),x=w*.5+Math.cos(a)*w*d,y=h*.46+Math.sin(a)*h*d;
        const alpha=(.15+z*.6)*(1-smooth(.6,.85)*.25),size=i%41?(.6+z):3.5;
        if(warp>0)line([[x,y],[x+Math.cos(a)*warp*z*25,y+Math.sin(a)*warp*z*15]],`hsl(${hue} 85% 85%)`,alpha,.9);else spark(x,y,size,`hsl(${hue} 90% 90%)`,alpha);
      }ctx.restore();
    }
    function coronas(hue,amount=1){
      ctx.save();ctx.globalCompositeOperation='lighter';const open=smooth(.28,.62),alpha=Math.sin(open*Math.PI),radius=Math.min(w,h)*(.04+open*.83);
      glow(w*.5,h*.46,Math.min(w,h)*(.09+alpha*.28),`hsla(${hue} 100% 87% / .8)`,alpha*.65*amount);
      for(let ring=0;ring<3;ring++){ctx.strokeStyle=`hsl(${hue+ring*16} 95% 82%)`;ctx.lineWidth=2-ring*.4;ctx.globalAlpha=alpha*(.35-ring*.08)*amount;ctx.beginPath();ctx.ellipse(w*.5,h*.46,radius*(1+ring*.13),radius*(.33+ring*.07),-.18+ring*.16,0,TAU);ctx.stroke();}
      const beam=ctx.createLinearGradient(0,0,w,0);beam.addColorStop(0,'transparent');beam.addColorStop(.5,`hsl(${hue} 100% 90%)`);beam.addColorStop(1,'transparent');ctx.fillStyle=beam;ctx.globalAlpha=alpha*.7*amount;ctx.fillRect(0,h*.46-1,w,2);ctx.restore();
    }
    function silk(){
      const build=smooth(.02,.34),expand=smooth(.48,.78),radius=1+expand*1.55;
      for(let band=0;band<5;band++){
        const point=(u,v)=>rotation([(Math.cos(u)*(1+v*Math.cos(u*1.5)))*radius,(Math.sin(u*2)*.42+Math.sin(u)*.25+band*.12-.24)*radius,Math.sin(u)*.7],t*.12+band*.18,-.2);
        for(let i=0;i<130;i++){const u=i/130*TAU,a=point(u,-.095),b=point(u+TAU/130+.002,-.095),c=point(u+TAU/130+.002,.095),d=point(u,.095);mesh([a,b,c,d],[[0,1,2,3]],{scale:build,hue:190+i/130*170+band*8,saturation:68,alpha:.85*(1-expand*.985)*build,edges:false});}
      }renderFaces();starfield(320);coronas(275,.6);
    }
    function mistAndGold(){
      const reveal=smooth(.03,.38);ctx.save();ctx.globalCompositeOperation='lighter';
      for(let stream=0;stream<9;stream++){
        const points=[];for(let j=0;j<110;j++){const q=j/109,x=w*.5+Math.sin(q*8+t*.2+stream*.19)*w*.25*(1-q),y=h*(.94-q*.61)+Math.sin(q*15+stream)*12;points.push([x,y]);}
        line(points,'#ffe8a1',reveal*(stream===4?.45:.12),stream===4?2.4:1);
        const head=Math.floor(fract(t*.11+stream*.1)*108);line(points.slice(Math.max(0,head-12),head+1),'#fff5c8',reveal*.85,2);
      }
      for(let i=0;i<430;i++){const x=fract(hash(i)+t*.025)*w,y=fract(hash(i+900)-t*.014)*h; spark(x,y,i%27?1:3.8,'#ffe9ae',reveal*(.15+hash(i+81)*.7));}
      for(let layer=0;layer<7;layer++){const y=h*(.5+layer*.085)+Math.sin(t*.2+layer)*20;glow(w*(.1+layer*.14)+Math.sin(t*.1+layer)*30,y,w*.31,'#f4f6e3',.025);}
      ctx.restore();coronas(44,.45);
    }
    function festival(){
      const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#08051e');sky.addColorStop(.6,'#332349');sky.addColorStop(1,'#101d3a');ctx.fillStyle=sky;ctx.globalAlpha=(images.festival.complete&&images.festival.naturalWidth)? .24:1;ctx.fillRect(0,0,w,h);starfield(200);
      // City lights below the fireworks give the explosions a visible scale.
      if(!images.festival.complete||!images.festival.naturalWidth)for(let i=0;i<85;i++){const x=i/85*w,bh=h*(.025+hash(i+45)*.11),y=h-bh;ctx.globalAlpha=.9;ctx.fillStyle='#0b0d20';ctx.fillRect(x,y,w/85+1,bh);for(let j=0;j<4;j++)spark(x+3+j*3,y+8+hash(i+j)*bh*.7,.8,'#ffd6a2',.25+hash(i+j)*.4);}
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(let burst=0;burst<11;burst++){
        const start=.015+burst*.042,age=(p-start)/.53;if(age<=0||age>=1)continue;
        const x=w*(.08+hash(burst+330)*.84),y=h*(.13+hash(burst+170)*.49),rad=Math.min(w,h)*(.13+hash(burst+125)*.1),alpha=(1-age)**.6;
        const hue=[300,35,200,335,260][burst%5];
        if(age<.1)line([[x,h*.95],[x,y]],`hsl(${hue} 90% 85%)`,(1-age*10)*.6,1.3);
        for(let ray=0;ray<145;ray++){
          const a=ray/145*TAU+hash(ray+burst)*.025,speed=rad*(.65+hash(ray*13+burst)*.55),tail=[];
          for(let j=0;j<9;j++){const local=Math.max(0,age-j*.011),travel=1-(1-local)**3;tail.push([x+Math.cos(a)*speed*travel,y+Math.sin(a)*speed*travel+local*local*rad*.7]);}
          line(tail,`hsl(${hue+ray%17} 95% ${72+ray%20}%)`,alpha*.8,ray%9?1.2:2.2);if(ray%12===0)spark(tail[0][0],tail[0][1],3,'#fff6e7',alpha);
        }glow(x,y,rad*.5,`hsla(${hue} 90% 70% / .35)`,alpha*.2);
      }ctx.restore();
    }
    function tides(){
      const water=h*.47;ctx.save();ctx.globalCompositeOperation='lighter';
      for(let i=0;i<85;i++){const depth=i/85,y=water+(h-water)*depth**1.4,span=w*(.03+depth*.25),x=w*.5+Math.sin(i*2.7+t*.55)*span*.3;line([[x-span*.5,y],[x+span*.5,y]],i%3?'#d9caff':'#f1f7ff',(.07+depth*.12)*smooth(0,.35),i%7?1:2);}
      for(let meteor=0;meteor<7;meteor++){const age=fract(p*1.3+meteor*.177),x=w*(.1+meteor*.13)+age*w*.13,y=h*(.03+meteor%3*.08)+age*h*.13,alpha=Math.sin(age*Math.PI)*.65;line([[x,y],[x-60,y-30]],'#e3d4ff',alpha,1.3);spark(x,y,3,'#ffffff',alpha);}
      ctx.restore();starfield(140);coronas(220,.3);
    }
    function geometry(){
      const build=smooth(.01,.34),reveal=smooth(.48,.82),hero=1+reveal*1.15,alpha=1-smooth(.46,.76)*.96,yaw=t*.27+(1-build)*1.1,pitch=.3+Math.sin(t*.3)*.14;
      const hue=palette[style][0];
      if(style==='quantmatrix'){
        const cubes=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const id=(x+1)*9+(y+1)*3+z+1,spread=1+(1-build)*3+reveal*.9,center=rotation([x*.54*spread,y*.54*spread,z*.54*spread],yaw,pitch);cubes.push({center,id});}
        for(const {center,id}of cubes)mesh(cube,cubeFaces,{scale:.225*build*hero,yaw,pitch,offset:center.map(v=>v*hero),hue:190+id%4*16,alpha:.91*alpha});
        renderFaces();
      }else if(style==='quantorbit'){
        for(let ring=0;ring<5;ring++){
          const radius=(1+ring*.18)*(.2+build*.8)*hero;
          const point=(u,v)=>rotation([(radius+.045*Math.cos(v))*Math.cos(u),.045*Math.sin(v),(radius+.045*Math.cos(v))*Math.sin(u)],t*.16+ring*.6,.45+ring*.42);
          for(let i=0;i<100;i++)for(let j=0;j<3;j++){const u=i/100*TAU,v=j/3*TAU;mesh([point(u,v),point(u+TAU/100+.002,v),point(u+TAU/100+.002,v+TAU/3),point(u,v+TAU/3)],[[0,1,2,3]],{hue:255+ring*18,alpha:.9*alpha,edges:false});}
          const trail=[];for(let i=0;i<40;i++)trail.push(project(point(t*(.65+ring*.1)-i*.012,0)));line(trail,ring%2?'#ffd2ee':'#d5c7ff',.95*alpha,3.8);
        }mesh(octa,octaFaces,{scale:.48*build*(1-reveal*.8),yaw:-yaw,pitch,hue:290,alpha});renderFaces();
      }else if(style==='lattice'){
        for(let shell=0;shell<5;shell++){
          const scale=(.45+shell*.22+(1-build)*(shell+1)*.6)*hero,points=cube.map(v=>project(rotation(v.map(n=>n*scale),yaw+shell*.18,pitch)));
          for(let i=0;i<8;i++)for(const bit of [1,2,4]){const j=i^bit;if(j<i)continue;line([points[i],points[j]],'#a9f2ff',(.25+shell*.12)*alpha,shell===4?2:1.2);const q=fract(t*.3+i*.13+shell*.08);spark(points[i][0]+(points[j][0]-points[i][0])*q,points[i][1]+(points[j][1]-points[i][1])*q,3,'#fff',alpha);}
        }mesh(cube,cubeFaces,{scale:.34*build,yaw,pitch,hue:195,alpha:.9*(1-reveal)});renderFaces();
      }else if(style==='honeycomb'){
        for(let q=-3;q<=3;q++)for(let a=-3;a<=3;a++){
          if(Math.abs(q+a)>3)continue;const distance=Math.max(Math.abs(q),Math.abs(a),Math.abs(q+a)),local=clamp(build*1.5-distance*.12),size=.255,height=.15+Math.sin(t*.9-distance*.7)*.1+smooth(.2,.45)*.2;
          const vertices=[];for(const y of [-height,.24])for(let i=0;i<6;i++){const u=(i+.5)/6*TAU;vertices.push([Math.sqrt(3)*size*(q+a/2)+Math.cos(u)*size*.91*local,y*local,size*1.5*a+Math.sin(u)*size*.91*local]);}
          const indices=[[0,1,2,3,4,5]];for(let i=0;i<6;i++)indices.push([i,(i+1)%6,(i+1)%6+6,i+6]);
          mesh(vertices,indices,{scale:hero,yaw:t*.12,pitch:.88-reveal*.25,hue:35+distance*3,saturation:65,alpha:.95*alpha});
        }renderFaces();
      }else if(style==='origami'){
        for(let petal=0;petal<12;petal++){
          const a=petal/12*TAU,spread=(.55+smooth(.2,.48)*.8+reveal*1.6)*build,center=[Math.cos(a)*spread,Math.sin(a)*spread*.74,Math.sin(a+t*.2)*.35];
          mesh(octa,octaFaces,{scale:.33*build,yaw:a+t*.18,pitch:.3+petal*.14,roll:a,offset:center,hue:270+petal*8,saturation:45,alpha:.97*alpha});
        }mesh(octa,octaFaces,{scale:.85*build*(1-reveal*.7),yaw,pitch:.4,hue:305,saturation:48,alpha:.97*alpha});renderFaces();
      }else if(style==='mobius'){
        const point=(u,v)=>rotation([(1+v*Math.cos(u/2))*Math.cos(u),v*Math.sin(u/2),(1+v*Math.cos(u/2))*Math.sin(u)],yaw*.65,.7);
        for(let i=0;i<170;i++)for(let strip=0;strip<5;strip++){const u=i/170*TAU,v=-.35+strip*.14;mesh([point(u,v),point(u+TAU/170+.002,v),point(u+TAU/170+.002,v+.143),point(u,v+.143)],[[0,1,2,3]],{scale:(.4+build*.9)*hero,hue:185+i/170*120,saturation:65,alpha:.95*alpha,edges:false});}renderFaces();
      }else if(style==='polyhedron'){
        mesh(ico,icoFaces,{scale:.64*hero,yaw,pitch,hue:145,saturation:58,alpha:.9*alpha,explode:(1-build)*2+reveal*.35});
        mesh(octa,octaFaces,{scale:.3*build,yaw:-yaw,pitch:-pitch,hue:42,saturation:85,alpha:alpha});renderFaces();
      }else if(style==='pulse'){
        for(let wing=0;wing<8;wing++){const a=wing/8*TAU,spread=smooth(.18,.52)*(1+reveal*2);mesh(octa,octaFaces,{scale:.43*build,roll:a,yaw,pitch,offset:[Math.cos(a)*spread,Math.sin(a)*spread,0],hue:205+wing*15,saturation:40,alpha:.95*alpha});}renderFaces();
        glow(w*.5,h*.46,Math.min(w,h)*(.12+smooth(.18,.6)*.16),'#d8eaff',(.55+Math.sin(p*Math.PI)*.3)*(1-reveal));
      }
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(let orbit=0;orbit<3;orbit++){
        const points=[],radius=(1.5+orbit*.24)*hero;for(let j=0;j<=140;j++){const a=j/140*TAU;points.push(project(rotation([Math.cos(a)*radius,0,Math.sin(a)*radius],t*.12+orbit*.7,.4+orbit*.65)));}line(points,`hsl(${hue+orbit*8} 85% 80%)`,.17*alpha,1.3);
        const index=Math.floor(fract(t*.13+orbit*.32)*140);line(points.slice(Math.max(0,index-18),index+1),`hsl(${hue} 100% 93%)`,.8*alpha,2.8);
      }ctx.restore();coronas(hue,1);starfield(430,(1-build)*.7);
    }
    function foreground(){
      const hue=palette[style][0],reveal=smooth(.48,.8);ctx.save();ctx.globalCompositeOperation='lighter';
      // Foreground diamond fragments sweep past the lens with stable depth trajectories.
      for(let i=0;i<46;i++){const a=hash(i+800)*TAU,depth=fract(hash(i+312)+t*.035),radius=.28+depth*1.3,x=w*.5+Math.cos(a)*w*radius,y=h*.46+Math.sin(a)*h*radius,size=(2+depth*depth*15)*(i%4?1:1.5);ctx.save();ctx.translate(x,y);ctx.rotate(t*.16+i);ctx.globalAlpha=(.08+depth*.25)*(1-reveal*.35);ctx.fillStyle=`hsl(${hue+i%5*12} 85% 83%)`;ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.4,0);ctx.lineTo(0,size);ctx.lineTo(-size*.4,0);ctx.closePath();ctx.fill();ctx.restore();}
      ctx.restore();
      // Only the center darkens at the brand beat; artwork stays luminous around it.
      const g=ctx.createRadialGradient(w*.5,h*.54,0,w*.5,h*.54,Math.min(w,h)*.55);g.addColorStop(0,`rgba(3,6,20,${reveal*.76})`);g.addColorStop(.55,`rgba(3,6,20,${reveal*.38})`);g.addColorStop(1,'transparent');ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }
    function draw(now){
      if(!running||!ctx)return;t=Math.max(0,(now-started)/1000);p=clamp(t/duration);screen.dataset.scenePhase=p<.28?'approach':p<.54?'ignite':'signature';ctx.clearRect(0,0,w,h);ctx.save();faces=[];
      drawEnvironment();
      if(style==='prism')silk();else if(style==='inkflow')mistAndGold();else if(style==='fireworks')festival();else if(style==='moonsea')tides();else if(style==='cinema'){starfield(240);coronas(275,.45);}else geometry();
      foreground();ctx.restore();frame=requestAnimationFrame(draw);
    }
    function stop(){running=false;cancelAnimationFrame(frame);canvas.hidden=true;faces=[];ctx?.clearRect(0,0,w,h);delete screen.dataset.scenePhase;}
    window.addEventListener('resize',()=>{if(running)resize();});
    return {start(key,seconds=5,background=''){stop();style=key;duration=Math.max(.8,Math.min(20,Number(seconds)||5));customImage=null;if(key==='cinema'&&background){customImage=new Image();customImage.src=background;}canvas.hidden=false;resize();running=true;started=performance.now();frame=requestAnimationFrame(draw);},stop,get running(){return running;}};
  }
  return{catalog,cards,filters,mount,configure};
})();
