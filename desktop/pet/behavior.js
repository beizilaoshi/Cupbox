// Local autonomous choices. No screen contents, model calls or input control.
export class PetBehavior{
 constructor({random=Math.random}={}){this.random=random;this.clock=0;this.phase='waiting';this.remaining=this.between(2,6);this.walked=0;this.direction=1;this.leg=0;this.fatigueAt=this.between(45,80);this.workSeconds=0;this.touches=[];this.sulkUntil=0;this.temperCooldown=0;this.moodCheck=45;}
 between(a,b){return a+(b-a)*Math.max(0,Math.min(.999999,this.random()));}
 resetPresence(){this.workSeconds=0;}
 soothe(){this.sulkUntil=0;this.touches=[];}
 touch(kind,{allowed=true}={}){
  if(!allowed)return false;this.touches=this.touches.filter(t=>this.clock-t.at<10);this.touches.push({at:this.clock,weight:kind==='lift'?2:1});
  if(this.clock<this.temperCooldown||this.touches.reduce((n,t)=>n+t.weight,0)<5)return false;
  this.sulkUntil=this.clock+this.between(7,11);this.temperCooldown=this.clock+120;this.touches=[];return true;
 }
 step(seconds,{enabled=true,roam=true,motion=true,idleActions=true,available=true,paused=false,energy=80,mood=80,idleSeconds=0,reminders=true,reminderMinutes=45}={}){
  const dt=Math.min(2,Math.max(0,Number.isFinite(seconds)?seconds:0));this.clock+=dt;let event=null;
  if(!enabled){this.workSeconds=0;return this.result(false,null);}
  if(idleSeconds>=300)this.workSeconds=0;else if(idleSeconds<60&&reminders)this.workSeconds+=dt;
  if(!reminders)this.workSeconds=0;
  if(available&&!paused&&idleSeconds<60&&reminders&&this.workSeconds>=reminderMinutes*60){this.workSeconds=0;event='break';}
  if(!available||paused)return this.result(false,event);
  if(!idleActions)this.soothe();
  this.moodCheck-=dt;if(this.moodCheck<=0){this.moodCheck=45;if(idleActions&&mood<35&&this.clock>=this.temperCooldown&&this.random()<.2){this.sulkUntil=this.clock+9;this.temperCooldown=this.clock+180;event=event||'sulk';}}
  if(this.sulkUntil>this.clock)return this.result(false,event);
  if(!roam){this.phase='waiting';this.walked=0;this.remaining=Math.max(2,this.remaining);return this.result(false,event);}
  if(!motion)return this.result(false,event);
  if(this.phase!=='resting'&&(energy<25||this.walked>=this.fatigueAt)){this.phase='resting';this.remaining=this.between(40,75)+(energy<25?30:0);event=event||'rest';}
  this.remaining-=dt;
  if(this.remaining<=0){
   if(this.phase==='walking'){this.phase='waiting';this.remaining=this.between(3,12);}
   else if(this.phase==='resting'){this.phase='waiting';this.remaining=this.between(4,9);this.walked=0;this.fatigueAt=this.between(45,80);event=event||'awake';}
   else{this.phase='walking';this.remaining=this.between(4,11);this.direction=this.random()<.5?-1:1;this.leg++;}
  }
  if(this.phase==='walking')this.walked+=dt;
  return this.result(this.phase==='walking',event);
 }
 result(walk,event){const sulking=this.clock<this.sulkUntil;return{walk:walk&&!sulking,direction:this.direction,leg:this.leg,event,state:sulking?'sulking':this.phase,restRemaining:this.phase==='resting'?Math.ceil(this.remaining):0,walkedSeconds:Math.floor(this.walked),workMinutes:Math.floor(this.workSeconds/60)};}
 snapshot(){return this.result(false,null);}
}
