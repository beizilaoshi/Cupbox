import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {PNG} from 'pngjs';import{runInNewContext}from'node:vm';import{PET_OUTFITS,normalizePet,PET_POSES}from'../desktop/pet/model.js';
describe('four outfit motion atlases',()=>{
 for(const outfit of ['sakura','academy','cozy','starlight'])it(outfit+' has distinct six-step walk, a suspended pose and landing drawings',()=>{
  const png=PNG.sync.read(readFileSync(new URL('../desktop/ui/assets/pet/'+outfit+'-motion.png',import.meta.url)));expect(png.width).toBe(png.height);expect(png.width).toBeGreaterThanOrEqual(1024);
  const digests=[];for(let frame=0;frame<16;frame++){const hash=createHash('sha256'),x0=Math.floor(frame%4*png.width/4),x1=Math.floor((frame%4+1)*png.width/4),y0=Math.floor(Math.floor(frame/4)*png.height/4),y1=Math.floor((Math.floor(frame/4)+1)*png.height/4);let visible=0,transparent=0;for(let y=y0;y<y1;y++){hash.update(png.data.subarray((y*png.width+x0)*4,(y*png.width+x1)*4));for(let x=x0;x<x1;x++){if(png.data[(y*png.width+x)*4+3]>128)visible++;else transparent++;}}expect(visible).toBeGreaterThan(5000);expect(transparent).toBeGreaterThan(1000);digests.push(hash.digest('hex'));}
  expect(new Set(digests.slice(0,6)).size).toBe(6);expect(new Set(digests.slice(12,15)).size).toBe(3);
 });
});

describe('new festival sprite registration',()=>{
 const window:any={};runInNewContext(readFileSync(new URL('../desktop/ui/pet-art.js',import.meta.url),'utf8'),{window,document:{currentScript:{src:'file:///pet-art.js'}},URL});const art=window.CupboxPetArt;
 it('keeps the renderer action list aligned with the trusted backend',()=>{expect([...art.actions.map((a:any)=>a.id)]).toEqual([...PET_POSES]);expect(art.actions.every((a:any)=>a.frameCount===(a.id==='eating'?16:60))).toBe(true);});
 it('selects twelve genuine purple walk drawings and six legacy walk drawings from distance phase',()=>{for(const [outfit,count]of [['hanfu-wisteria',12],['sakura',6],['academy',6],['cozy',6],['starlight',6],['hanfu-jade',1],['christmas',1]] as const){const frames=Array.from({length:60},(_,i)=>art.physicalFrame(outfit,{mode:'walking',frame:i,phase:i/60}));expect(new Set(frames).size,outfit).toBe(count);}expect(Array.from({length:12},(_,i)=>art.physicalFrame('hanfu-wisteria',{mode:'walking',frame:i*5,phase:i/12}))).toEqual(Array.from({length:12},(_,i)=>i));expect(Array.from({length:6},(_,i)=>art.physicalFrame('sakura',{mode:'walking',frame:i*10,phase:i/6}))).toEqual([0,1,2,3,4,5]);expect(art.physicalFrame('hanfu-wisteria',{mode:'idle',frame:15})).toBe(15);expect(art.physicalFrame('hanfu-wisteria',{mode:'held',frame:6})).toBe(15);});
 it('keeps all twenty wardrobe choices aligned with backend validation',()=>{expect([...art.outfits.map((o:any)=>o.id)]).toEqual([...PET_OUTFITS]);for(const o of art.outfits)expect(normalizePet({outfit:o.id}).outfit).toBe(o.id);});
 for(const outfit of ['hanfu-wisteria','hanfu-jade','hanfu-peony','hanfu-indigo','jk-plaid','dragonboat','qixi','national','winter'])it(outfit+' has transparent artwork and an open-eyed standing cell',()=>{
  const png=PNG.sync.read(readFileSync(new URL('../desktop/ui/assets/pet/'+outfit+'-expressions.png',import.meta.url))),frame=art.atlasFrame(outfit,15),cw=png.width/4,ch=png.height/4;expect(png.width).toBe(png.height);expect(png.width).toBeGreaterThanOrEqual(1024);
  let transparent=0,gold=0,blue=0;for(let y=0;y<png.height;y+=4)for(let x=0;x<png.width;x+=4)if(png.data[(y*png.width+x)*4+3]===0)transparent++;
  for(let y=Math.floor(ch*.32);y<ch*.54;y++)for(let x=Math.floor(cw*.34);x<cw*.7;x++){const k=(Math.floor(Math.floor(frame/4)*ch+y)*png.width+Math.floor(frame%4*cw+x))*4,r=png.data[k],g=png.data[k+1],b=png.data[k+2];if(png.data[k+3]<200)continue;if(x<cw*.53&&r>130&&g>70&&b<r*.55&&g<r*.85&&r>g*1.12)gold++;if(x>cw*.5&&b>r*1.5&&b>g*1.15&&g>85)blue++;}
  expect(transparent).toBeGreaterThan(1000);expect(gold).toBeGreaterThan(15);expect(blue).toBeGreaterThan(15);
 });
});
