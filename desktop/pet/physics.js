// Deterministic physics for the pet's own window only. Coordinates never control other apps.
const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
export const WALK_FRAMES=60;
export class PetPhysics{
 constructor(bounds,area,size=140){this.mode='idle';this.direction=1;this.distance=0;this.gaitDistance=0;this.vx=0;this.vy=0;this.time=0;this.dragging=false;this.configure(bounds,area,size);}
 configure(bounds,area,size=this.size){this.area={...area};this.width=bounds.width;this.height=bounds.height;this.size=size;this.left=area.x;this.right=Math.max(this.left,area.x+area.width-this.width);this.top=area.y;this.floor=Math.max(this.top,area.y+area.height-this.height);this.x=clamp(bounds.x,this.left,this.right);this.y=clamp(bounds.y,this.top,this.floor);if(!this.dragging)this.stop();}
 stop(){this.mode='idle';this.time=0;this.vx=this.vy=0;this.y=clamp(this.y,this.top,this.floor);}
 grab(){this.mode='lifting';this.time=0;this.dragging=true;this.vx=this.vy=0;}
 dragTo(bounds,area,dt=.016){const mode=this.mode,time=this.time;this.dragging=true;const oldX=this.x,oldY=this.y;this.configure(bounds,area,this.size);this.mode=mode;this.time=time;dt=clamp(dt,.008,.12);this.vx=clamp((this.x-oldX)/dt,-this.size*1.2,this.size*1.2);this.vy=clamp((this.y-oldY)/dt,-120,160);}
 release(animate=true){if(!this.dragging)return false;this.dragging=false;this.time=0;if(!animate){this.stop();return true;}this.mode='falling';this.vx=clamp(this.vx,-this.size,this.size);this.vy=clamp(this.vy,-100,160);return true;}
 step(seconds,{walk=false,animate=true}={}){
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05);let settled=false;
  if(!animate){if(this.dragging){this.mode='lifting';this.time=0;}else this.stop();return{...this.snapshot(),settled};}
  this.time+=dt;
  if(this.dragging){this.vx*=Math.exp(-9*dt);this.vy*=Math.exp(-9*dt);if(Math.abs(this.vx)<.5)this.vx=0;if(Math.abs(this.vy)<.5)this.vy=0;if(this.time>=.14)this.mode='held';return{...this.snapshot(),settled};}
  if(this.mode==='falling'){
   this.vy=Math.min(1050,this.vy+1500*dt);this.vx*=Math.exp(-1.2*dt);this.x=clamp(this.x+this.vx*dt,this.left,this.right);this.y=Math.max(this.top,this.y+this.vy*dt);
   if(this.y>=this.floor){this.y=this.floor;this.bounce=Math.min(this.size*.035,this.vy*this.vy*.000012);this.mode='landing';this.time=0;this.vx*=.12;this.vy=0;}
  }else if(this.mode==='landing'){
   const t=Math.min(1,this.time/.36);this.y=Math.max(this.top,this.floor-this.bounce*Math.sin(Math.PI*t)*(1-t));this.x=clamp(this.x+this.vx*dt,this.left,this.right);this.vx*=Math.exp(-12*dt);
   if(t>=1){this.y=this.floor;this.stop();settled=true;}
  }else if(walk&&this.right>this.left){
   const oldX=this.x,before=Math.round(this.x);this.vx=this.direction*this.size*.14;const desired=this.x+this.vx*dt;this.x=clamp(desired,this.left,this.right);const moved=Math.abs(Math.round(this.x)-before);this.distance+=moved;this.gaitDistance+=Math.abs(this.x-oldX);
   if(desired>=this.right)this.direction=-1;else if(desired<=this.left)this.direction=1;
   this.mode='walking';
  }else{this.mode='idle';this.vx=this.vy=0;}
  return{...this.snapshot(),settled};
 }
 snapshot(){let frame=15;if(this.mode==='walking')frame=Math.floor(this.gaitDistance/(this.size*.20)*WALK_FRAMES+1e-8)%WALK_FRAMES;else if(this.mode==='lifting'||this.mode==='held')frame=6;else if(this.mode==='falling')frame=this.vy>350?11:10;else if(this.mode==='landing')frame=12+Math.min(2,Math.floor(this.time/.12));return{mode:this.mode,frame,phase:(this.gaitDistance/(this.size*.20))%1,direction:this.direction,distance:this.distance,x:Math.round(this.x),y:Math.round(this.y),vx:this.vx,vy:this.vy,landingProgress:this.mode==='landing'?Math.min(1,this.time/.36):0,groundDistance:Math.max(0,this.floor-this.y)};}
}
