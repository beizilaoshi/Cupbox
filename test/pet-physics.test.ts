import {describe,it,expect} from 'vitest';import {PetPhysics} from '../desktop/pet/physics.js';
const area={x:0,y:0,width:1920,height:1040},bounds={x:500,y:500,width:204,height:284};
describe('pet window walking and gravity',()=>{
 it('shows sixty walking frames, advances gait by actual displacement and freezes when paused',()=>{
  const body=new PetPhysics(bounds,area,140),frames=new Set();let previous=body.snapshot();
  for(let i=0;i<200;i++){const next=body.step(.016,{walk:true});if(previous.mode==='walking'&&next.frame!==previous.frame)expect(next.phase).not.toBe(previous.phase);frames.add(next.frame);previous=next;}
  expect(frames.size).toBe(60);expect(body.x-bounds.x).toBeCloseTo(62.72,1);const distance=body.distance,x=body.x,phase=body.snapshot().phase;for(let i=0;i<60;i++)body.step(.016,{walk:false});expect(body.distance).toBe(distance);expect(body.x).toBe(x);expect(body.snapshot().phase).toBe(phase);expect(body.snapshot().mode).toBe('idle');
 });
 it('keeps travel and gait synchronized at different timer rates and sizes',()=>{
  for(const size of [60,140,280]){const fast=new PetPhysics(bounds,area,size),slow=new PetPhysics(bounds,area,size);for(let i=0;i<240;i++)fast.step(1/120,{walk:true});for(let i=0;i<60;i++)slow.step(1/30,{walk:true});expect(fast.snapshot().x).toBe(slow.snapshot().x);expect(fast.distance).toBe(slow.distance);expect(fast.snapshot().frame).toBe(slow.snapshot().frame);}
 });
 it('holds one suspended pose and falls with acceleration into three landing frames',()=>{
  const body=new PetPhysics(bounds,area);body.grab();expect(body.snapshot().frame).toBe(6);const held=new Set();for(let i=0;i<60;i++){const state=body.step(.016);if(state.mode==='held')held.add(state.frame);}expect([...held]).toEqual([6]);
  body.release();const start=body.snapshot();body.step(.016);const speed=body.vy;body.step(.016);expect(body.vy).toBeGreaterThan(speed);expect(body.y).toBeGreaterThan(start.y);const landing=new Set();let settled=false;for(let i=0;i<180;i++){const state=body.step(.016);if(state.mode==='landing')landing.add(state.frame);if(state.settled){settled=true;break;}expect(state.y).toBeLessThanOrEqual(756);}
  expect([...landing].sort()).toEqual([12,13,14]);expect(settled).toBe(true);expect(body.snapshot().mode).toBe('idle');expect(body.y).toBe(756);
 });
 it('stays on negative-coordinate monitors and can catch a fall again',()=>{
  const a={x:-1280,y:-100,width:1280,height:1000},body=new PetPhysics({x:-1200,y:-50,width:204,height:284},a);body.grab();body.dragTo({x:-99999,y:-99999,width:204,height:284},a,.02);expect(body.x).toBe(-1280);expect(body.y).toBe(-100);body.release();for(let i=0;i<12;i++)body.step(.016);body.grab();for(let i=0;i<50;i++)body.step(.016);expect(body.snapshot().mode).toBe('held');expect(body.y).toBeGreaterThanOrEqual(-100);body.release();for(let i=0;i<300;i++)body.step(.016);expect(body.y).toBe(616);expect(body.x).toBeGreaterThanOrEqual(-1280);expect(body.x+body.width).toBeLessThanOrEqual(0);
 });
 it('honors disabled motion and small screens without an offscreen fall',()=>{
  const body=new PetPhysics(bounds,area);body.grab();body.release(false);const y=body.y;for(let i=0;i<90;i++)body.step(.016,{animate:false,walk:true});expect(body.y).toBe(y);expect(body.snapshot().mode).toBe('idle');
  const tiny=new PetPhysics({x:0,y:0,width:180,height:200},{x:0,y:0,width:180,height:200});for(let i=0;i<30;i++)tiny.step(.05,{walk:true});expect(tiny.x).toBe(0);expect(tiny.snapshot().mode).toBe('idle');tiny.grab();tiny.release();for(let i=0;i<100;i++)tiny.step(.016);expect(tiny.y).toBe(0);
 });
});
