import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {runInNewContext} from 'node:vm';
import {PET_OUTFITS} from '../desktop/pet/model.js';
const window:any={};runInNewContext(readFileSync(new URL('../desktop/ui/pet-art.js',import.meta.url),'utf8'),{window,document:{currentScript:{src:'file:///pet-art.js'}},URL});const art=window.CupboxPetArt;
describe('individually drawn eating clips for every outfit',()=>{
 it('routes all outfits to their own eating sheet, including festival and single-atlas outfits',()=>{for(const id of PET_OUTFITS)expect(art.asset(id,'eating')).toContain('/'+id+'-eating.png');expect(art.actions.find((a:any)=>a.id==='eating')).toMatchObject({frameCount:16,frames:Array.from({length:16},(_,i)=>i)});});
 for(const outfit of PET_OUTFITS)it(outfit+' has sixteen different transparent eating drawings',async()=>{
  const png=PNG.sync.read(readFileSync(new URL('../desktop/ui/assets/pet/'+outfit+'-eating.png',import.meta.url)));
  expect(png.width).toBe(png.height);expect(png.width).toBeGreaterThanOrEqual(1024);
  const resource={width:png.width,height:png.height,pixels:png.data},hashes=[];for(let i=0;i<16;i++){
   const x0=Math.ceil(i%4*png.width/4),x1=Math.floor((i%4+1)*png.width/4),y0=Math.ceil(Math.floor(i/4)*png.height/4),y1=Math.floor((Math.floor(i/4)+1)*png.height/4),hash=createHash('sha256');let visible=0,transparent=0;
   for(let y=y0;y<y1;y++){hash.update(png.data.subarray((y*png.width+x0)*4,(y*png.width+x1)*4));for(let x=x0;x<x1;x++){const a=png.data[(y*png.width+x)*4+3];if(a>128)visible++;if(a===0)transparent++;}}
   expect(visible,'drawing '+i).toBeGreaterThan(5000);expect(transparent,'alpha '+i).toBeGreaterThan(1000);hashes.push(hash.digest('hex'));
   const isolated=art.framePixels(resource,i);let kept=0;for(let p=3;p<isolated.data.length;p+=4)if(isolated.data[p]>128)kept++;expect(kept,'isolated body '+i).toBeGreaterThan(5000);await new Promise(r=>setImmediate(r));
  }expect(new Set(hashes).size).toBe(16);
 },15000);
});
