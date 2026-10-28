import {describe,it,expect} from 'vitest';
import {PET_DEFAULTS,normalizePet,petBounds,petDockSide,quietPet,PET_EXPRESSIONS,petGravityEnabled} from '../desktop/pet/model.js';
describe('desktop pet configuration and display boundaries',()=>{
 it('gravity survives a static portrait selection and is suspended only at a dock or when motion is off',()=>{
  expect(petGravityEnabled({...PET_DEFAULTS,displayMode:'portrait'})).toBe(true);expect(petGravityEnabled({...PET_DEFAULTS,dockSide:'left'})).toBe(false);expect(petGravityEnabled({...PET_DEFAULTS,motion:false})).toBe(false);expect(petGravityEnabled(PET_DEFAULTS,true)).toBe(false);
 });
 it('keeps every supported size inside common and fractional scaled resolutions',()=>{
  for(const [width,height]of [[1280,680],[1366,728],[1920,1040],[1536,824],[1280.8,682.4],[180,200]])for(const size of [60,140,280])for(const dockSide of ['none','left','right']){
   const area={x:-1280.4,y:-50.2,width,height},b=petBounds({...PET_DEFAULTS,size,dockSide,position:{x:5000,y:9999}},[area]);expect(b.x).toBeGreaterThanOrEqual(area.x);expect(b.y).toBeGreaterThanOrEqual(area.y);expect(b.x+b.width).toBeLessThanOrEqual(area.x+width);expect(b.y+b.height).toBeLessThanOrEqual(area.y+height);
  }
 });
 it('selects the display with the largest window overlap at a shared edge',()=>{
  const areas=[{x:0,y:0,width:1920,height:1040},{x:1920,y:0,width:1280,height:680}];
  expect(petBounds({...PET_DEFAULTS,position:{x:1920,y:100}},areas).x).toBe(1920);
 });
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
  expect(normalizePet(old)).toEqual({...PET_DEFAULTS,...old});
  const next=normalizePet({outfit:'cozy',idleActions:false},normalizePet(old));
  expect(next).toEqual({...PET_DEFAULTS,...old,outfit:'cozy',idleActions:false});
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
 it('pins either side of the selected display and detects nearby drops',()=>{
  const area={x:-1280,y:-100,width:1280,height:1000},base={...PET_DEFAULTS,position:{x:-1100,y:200}};
  const left=petBounds({...base,dockSide:'left'},[area]),right=petBounds({...base,dockSide:'right'},[area]);
  expect(left.x).toBe(area.x);expect(right.x+right.width).toBe(area.x+area.width);expect(left.y).toBe(200);
  expect(petDockSide({...left,x:left.x+20},area)).toBe('left');expect(petDockSide({...right,x:right.x-20},area)).toBe('right');expect(petDockSide({...left,x:left.x+100},area)).toBe('none');
 });
 it('accepts seven static expressions and rejects invalid display settings',()=>{
  for(const portraitExpression of PET_EXPRESSIONS)expect(quietPet(normalizePet({displayMode:'portrait',portraitExpression}))).toBe(true);
  expect(quietPet(normalizePet({dockSide:'left'}))).toBe(true);expect(quietPet(normalizePet())).toBe(false);
  for(const patch of [{edgeSnap:'true'},{dockSide:'top'},{displayMode:'video'},{portraitExpression:'../../file'}])expect(()=>normalizePet(patch)).toThrow();
 });
});


