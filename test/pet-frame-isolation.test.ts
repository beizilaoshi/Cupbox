import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {PNG} from 'pngjs';
const window:any={};runInNewContext(readFileSync(new URL('../desktop/ui/pet-art.js',import.meta.url),'utf8'),{window,document:{currentScript:{src:'file:///pet-art.js'}},URL});
const extract=window.CupboxPetArt.framePixels;
describe('isolated mascot atlas frames',()=>{
 it('removes a neighbouring foot extending inside the cell, preserving this pose and its detached decoration',()=>{
  const width=400,height=400,pixels=new Uint8ClampedArray(width*height*4);
  const box=(x:number,y:number,w:number,h:number)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const k=(yy*width+xx)*4;pixels[k]=150;pixels[k+3]=255;}};
  box(30,15,40,80);box(44,94,12,18); // previous row's body and foot
  box(22,130,56,61);box(4,153,7,9); // current body and legitimate accessory
  // Translucent halos must not merge the two opaque characters into one owner.
  for(let y=112;y<130;y++){const k=(y*width+48)*4;pixels[k]=150;pixels[k+3]=50;}
  const resource={width,height,pixels},result=extract(resource,4),alpha=(x:number,y:number)=>result.data[(y*100+x)*4+3];
  expect(alpha(48,8)).toBe(0);expect(alpha(48,50)).toBe(255);expect(alpha(7,57)).toBe(255);
  expect(result.foreign).toBeGreaterThan(0);expect(resource).toHaveProperty('owners');
 });
 it('uses integer cell boundaries and removes detached neighbour strips without losing a side decoration',()=>{
  const width=42,height=42,pixels=new Uint8ClampedArray(width*height*4),x0=11,y0=11;
  const box=(x:number,y:number,w:number,h:number)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const p=((y0+yy)*width+x0+xx)*4;pixels[p]=120;pixels[p+3]=255;}};
  box(3,3,5,6);box(3,0,3,1);box(0,4,2,3);
  const result=extract({width,height,pixels},5);
  expect(result.width).toBe(10);expect(result.height).toBe(10);expect(result.x).toBeCloseTo(.5/10.5*384);
  expect(result.data[(0*10+4)*4+3]).toBe(0);
  expect(result.data[(5*10+5)*4+3]).toBe(255);
  expect(result.data[(5*10+0)*4+3]).toBe(255);
 });
 it('keeps every shipped pose visible and never invents colour or alpha pixels',()=>{
  const root=new URL('../desktop/ui/assets/pet/',import.meta.url);let removed=0,frames=0;
  for(const name of readdirSync(root).filter(n=>/-(expressions|motion)\.png$/.test(n))){const png=PNG.sync.read(readFileSync(new URL(name,root)));const resource={width:png.width,height:png.height,pixels:png.data};for(let index=0;index<16;index++){
   const result=extract(resource,index);removed+=result.removed;frames++;
   let visible=0;for(let p=3;p<result.data.length;p+=4)if(result.data[p]>=128)visible++;
   expect(visible,name+':'+index).toBeGreaterThan(1500);
   const cw=png.width/4,ch=png.height/4,x0=Math.ceil(index%4*cw),y0=Math.ceil(Math.floor(index/4)*ch);
   let errors=0;for(let y=0;y<result.height;y+=4)for(let x=0;x<result.width;x+=4){const old=((y+y0)*png.width+x+x0)*4,next=(y*result.width+x)*4;if(result.data[next+3]>png.data[old+3])errors++;if(result.data[next+3])for(let channel=0;channel<3;channel++)if(result.data[next+channel]!==png.data[old+channel])errors++;}expect(errors,name+':'+index).toBe(0);
  }}expect(frames).toBe(readdirSync(root).filter(n=>/-(expressions|motion)\.png$/.test(n)).length*16);expect(removed).toBeGreaterThan(0);
 },60000);
});
