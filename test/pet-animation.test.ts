import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {PET_POSES} from '../desktop/pet/model.js';
const window:any={};runInNewContext(readFileSync(new URL('../desktop/ui/pet-animation.js',import.meta.url),'utf8'),{window});
const rig=window.CupboxPetAnimation;
describe('intact mascot artwork motion',()=>{
 it('gives every action sixty distinct poses with smooth loop boundaries and no foot sliding',()=>{
  expect(rig.FRAMES).toBe(60);expect(rig.FPS).toBeLessThanOrEqual(60);
  for(const pose of PET_POSES){const states=Array.from({length:60},(_,i)=>rig.sample(pose,i/60));expect(new Set(states.map(s=>JSON.stringify(s))).size,pose).toBe(60);
   const points=states.map(s=>rig.point(120,110,s));for(let i=0;i<60;i++){const a=points[i],b=points[(i+1)%60];expect(Math.hypot(a[0]-b[0],a[1]-b[1]),pose).toBeLessThan(4);const left=rig.point(90,180,states[i]),right=rig.point(294,300,states[i]);expect(Math.hypot(right[0]-left[0],right[1]-left[1])).toBeCloseTo(Math.hypot(204,120),8);}
   const start=rig.sample(pose,0),end=rig.sample(pose,1);expect(end).toEqual(start);
  }
 });
 it('renders one intact image without scaling, triangle meshes or limb patches',()=>{const calls:string[]=[],ctx:any={clearRect(){},save(){},translate(){},rotate(){},drawImage(){calls.push('draw');},restore(){},scale(){throw Error('Unexpected scaling');},transform(){throw Error('Unexpected mesh transform');},clip(){throw Error('Unexpected limb clipping');}};for(const pose of PET_POSES){rig.draw(ctx,{},rig.sample(pose,.27));expect(Math.abs(rig.transform(rig.sample(pose,.27)).angle)).toBeLessThanOrEqual(.012);}expect(calls.length).toBe(PET_POSES.length);});
 it('interpolates between adjacent key poses rather than holding repeated still frames',()=>{
  const a=rig.sample('headtilt',1/60),b=rig.sample('headtilt',2/60),between=rig.sample('headtilt',1.5/60);
  expect(between.head).toBeCloseTo((a.head+b.head)/2,8);expect(between.head).not.toBe(a.head);
 });
});
