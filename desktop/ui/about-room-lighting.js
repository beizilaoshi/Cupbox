// Multipliers operate on the original painted RGB. Alpha is never changed.
globalThis.CupboxRoomLight=(()=>{
 const profiles={morning:[.94,.91,.87],noon:[.96,.95,.92],afternoon:[.93,.90,.86],dusk:[.77,.70,.69],night:[.78,.75,.77],midnight:[.67,.65,.72]},cache=new Map();
 function at(x,y,period='afternoon',lamp=true,weather='clear'){
  const ambient=profiles[period]||profiles.afternoon,night=period==='night'||period==='midnight',fall=(cx,cy,r)=>Math.exp(-((x-cx)**2+(y-cy)**2)/(r*r)),sky=fall(127,66,190)*(weather==='clear'?1:.65),desk=lamp?fall(175,113,91):0,wall=fall(361,59,125);
  return ambient.map((v,i)=>Math.min(1.04,v+sky*(night?[.025,.04,.075]:[.065,.06,.035])[i]+desk*(night?[.14,.10,.045]:[.05,.035,.012])[i]+wall*(night?[.13,.105,.065]:[.015,.01,.005])[i]));
 }
 function field(period,lamp,weather){const key=[period,lamp,weather].join(':');if(cache.has(key))return cache.get(key);const values=new Float32Array(480*300*3);for(let y=0;y<300;y++)for(let x=0;x<480;x++)values.set(at(x,y,period,lamp,weather),(y*480+x)*3);cache.set(key,values);if(cache.size>4)cache.delete(cache.keys().next().value);return values;}
 function shade(data,width,height,originX,originY,scale,options){const values=field(options.period,options.lamp,options.weather),xs=Int16Array.from({length:width},(_,x)=>Math.max(0,Math.min(479,Math.round(originX+x*scale))));for(let y=0;y<height;y++){const row=Math.max(0,Math.min(299,Math.round(originY+y*scale)))*480;for(let x=0;x<width;x++){const p=(y*width+x)*4;if(!data[p+3])continue;const k=(row+xs[x])*3;data[p]*=values[k];data[p+1]*=values[k+1];data[p+2]*=values[k+2];}}return data;}
 return{at,shade};
})();
