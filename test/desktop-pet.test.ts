import {describe,it,expect} from 'vitest';
import {PET_DEFAULTS,normalizePet,petBounds} from '../desktop/pet/model.js';
describe('desktop pet configuration and display boundaries',()=>{
 it('defaults off and rejects unknown or unsafe config',()=>{
  expect(normalizePet()).toEqual(PET_DEFAULTS);expect(PET_DEFAULTS.enabled).toBe(false);
  for(const bad of [{enabled:'true'},{idleActions:'true'},{sound:'true'},{breakReminder:'true'},{breakMinutes:0},{breakMinutes:NaN},{breakMinutes:44},{outfit:'../../private'},{outfit:'custom.exe'},{size:NaN},{size:59},{size:281},{position:{x:Infinity,y:0}},{position:{x:0,y:0,file:'secret'}},{apiKey:'secret'},null,[]])expect(()=>normalizePet(bad)).toThrow();
 });
 it('keeps preferences while disabling and validates stored positions',()=>{
  const config=normalizePet({enabled:true,size:230,roam:true,position:{x:-900,y:50}});
  expect(normalizePet({enabled:false},config)).toEqual({...config,enabled:false});
  expect(normalizePet({position:null},config).position).toBe(null);
 });
 it('upgrades saved legacy settings without losing desktop preferences',()=>{
  const old={enabled:true,size:230,alwaysOnTop:false,roam:true,bubbles:false,motion:false,position:{x:-900,y:50}};
  expect(normalizePet(old)).toEqual({...old,outfit:'sakura',holidayAuto:true,idleActions:true,sound:true,breakReminder:true,breakMinutes:45});
  const next=normalizePet({outfit:'cozy',idleActions:false},normalizePet(old));
  expect(next).toEqual({...old,outfit:'cozy',holidayAuto:true,idleActions:false,sound:true,breakReminder:true,breakMinutes:45});
  expect(normalizePet({enabled:false},next).outfit).toBe('cozy');
 });
 it('recovers a disconnected monitor and stays within the work area',()=>{
  const a={x:0,y:0,width:1920,height:1040};const b=petBounds({...PET_DEFAULTS,position:{x:9000,y:-5000}},[a]);
  expect(b.x).toBeGreaterThanOrEqual(a.x);expect(b.y).toBeGreaterThanOrEqual(a.y);expect(b.x+b.width).toBeLessThanOrEqual(a.width);expect(b.y+b.height).toBeLessThanOrEqual(a.height);
 });
 it('supports negative monitor coordinates and small work areas',()=>{
  const a={x:-1280,y:-100,width:1280,height:1000};const b=petBounds({...PET_DEFAULTS,position:{x:-1100,y:0}},[{x:0,y:0,width:1920,height:1040},a]);expect(b.x).toBe(-1100);expect(b.y).toBe(0);
  expect(petBounds(PET_DEFAULTS,[{x:0,y:0,width:180,height:200}])).toEqual({x:0,y:0,width:180,height:200});
 });
});


