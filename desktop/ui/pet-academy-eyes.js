// Hand-registered academy eyelids. No color-based eye detection or cross-pose face patches.
window.CupboxAcademyEyes=(()=>{
 // Cell coordinates refer to the 313.5px source cells; skin, mouth and brows stay in the original drawing.
 const eyes=[
  [[140,140,22,19],[192,131,22,19]],
  [[140,147,14,8,true],[193,123,22,19]],
  [[138,143,16,9,true],[198,126,16,8,true]],
  [[142,147,21,18],[192,130,22,19]],
  [[146,142,21,18],[197,125,22,19]],
  [[143,154,21,17],[194,142,22,17]],
  [[141,149,22,18],[193,140,22,18]],
  [[147,139,23,21],[199,127,23,21]],
  [[146,176,15,8,true],[202,154,17,8,true]],
  [[152,133,16,8,true],[210,113,16,8,true]],
  [[148,143,21,14],[199,129,22,14]],
  [[145,148,22,18],[195,132,22,18]],
  [[144,129,21,18],[192,120,21,18]],
  [[141,128,21,18],[189,120,21,18]],
  [[141,128,21,18],[189,120,21,18]],
  [[142,128,21,18],[190,120,21,18]]
 ];
 function sample(base,frame,x,y){const cw=base.width/4,ch=base.height/4,ox=frame%4*cw,oy=Math.floor(frame/4)*ch,colors=[];for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const k=(Math.floor(oy+y/313.5*ch+dy)*base.width+Math.floor(ox+x/313.5*cw+dx))*4,r=base.pixels[k],g=base.pixels[k+1],b=base.pixels[k+2];if(base.pixels[k+3]>220&&r>220&&g>165&&b>155&&r>=g+4&&r>=b+3)colors.push([r,g,b]);}if(!colors.length)return[255,230,226];return[0,1,2].map(channel=>colors.map(c=>c[channel]).sort((a,b)=>a-b)[Math.floor(colors.length/2)]);}
 const rgb=color=>'rgb('+color.map(Math.round).join(',')+')';
 function calibrate(base,frame,registered){const pair=registered||eyes[frame]||eyes[0],angle=Math.atan2(pair[1][1]-pair[0][1],pair[1][0]-pair[0][0]);return{base,frame,eyes:pair.map((eye,side)=>({x:eye[0],y:eye[1],rx:eye[2],ry:eye[3],closed:eye[4]===true,angle,top:sample(base,frame,eye[0]+(side?-1:1)*(eye[2]+3),eye[1]),bottom:sample(base,frame,eye[0],eye[1]+eye[3]+3)}))};}
 function outline(ctx,rx,ry){ctx.beginPath();ctx.moveTo(-rx,-1);ctx.bezierCurveTo(-rx*.70,-ry*1.32,rx*.56,-ry*1.32,rx,-1);ctx.bezierCurveTo(rx*.72,ry*1.06,-rx*.75,ry*1.06,-rx,-1);ctx.closePath();}
 function paint(ctx,value,calibration){const {base,frame}=calibration,scale=ctx.canvas.width/313.5,cw=base.width/4,ch=base.height/4,closure=Math.max(0,Math.min(1,value/2));
  for(let side=0;side<2;side++){const eye=calibration.eyes[side];if(frame===1&&side===0)continue;
   if(eye.closed){const rx=eye.rx+2,ry=eye.ry+2,factor=1-closure*.06;ctx.save();ctx.scale(scale,scale);ctx.beginPath();ctx.ellipse(eye.x,eye.y,rx,ry,0,0,Math.PI*2);ctx.clip();ctx.drawImage(base.image,(frame%4+(eye.x-rx)/313.5)*cw,(Math.floor(frame/4)+(eye.y-ry/factor)/313.5)*ch,rx*2/313.5*cw,ry*2/factor/313.5*ch,eye.x-rx,eye.y-ry,rx*2,ry*2);ctx.restore();continue;}
   ctx.save();ctx.scale(scale,scale);ctx.translate(eye.x,eye.y);ctx.rotate(eye.angle);outline(ctx,eye.rx,eye.ry);ctx.clip();const gradient=ctx.createLinearGradient(0,-eye.ry,0,eye.ry);gradient.addColorStop(0,rgb(eye.top));gradient.addColorStop(1,rgb(eye.bottom));ctx.fillStyle=gradient;
   const lid=-eye.ry*(1-closure),bottom=eye.ry*(1-closure),dip=eye.ry*.32*closure;
   ctx.beginPath();ctx.moveTo(-eye.rx-2,-eye.ry-2);ctx.lineTo(eye.rx+2,-eye.ry-2);ctx.lineTo(eye.rx+2,lid);ctx.bezierCurveTo(eye.rx*.5,lid+dip,-eye.rx*.5,lid+dip,-eye.rx-2,lid);ctx.closePath();ctx.fill();
   ctx.fillRect(-eye.rx-2,bottom,eye.rx*2+4,eye.ry+2-bottom);
   ctx.strokeStyle='#754c50';ctx.lineWidth=2.05;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(-eye.rx*.94,lid);ctx.bezierCurveTo(-eye.rx*.48,lid+dip,eye.rx*.48,lid+dip,eye.rx*.94,lid);ctx.stroke();ctx.restore();
  }
 }
 return{calibrate,paint,landmarks:eyes};
})();
