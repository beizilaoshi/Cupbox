import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';
const host:any={};new Function('globalThis',readFileSync('desktop/ui/about-room-lighting.js','utf8'))(host);const Light=host.CupboxRoomLight;
describe('room RGB illumination',()=>{
 it('preserves transparent edges and original alpha exactly',()=>{const pixels=new Uint8ClampedArray([250,240,230,0,245,220,210,127,180,150,120,255]);Light.shade(pixels,3,1,180,170,.4,{period:'night',lamp:true,weather:'clear'});expect([pixels[3],pixels[7],pixels[11]]).toEqual([0,127,255]);expect(pixels[4]).toBeLessThan(245);expect(pixels[8]).toBeLessThan(180);});
 it('lights the figure near the desk without turning distant characters white',()=>{const a=Light.at(175,135,'night',true),b=Light.at(175,135,'night',false),far=Light.at(355,260,'night',true),farOff=Light.at(355,260,'night',false);expect(a[0]-b[0]).toBeGreaterThan(.12);expect(a[0]-b[0]).toBeGreaterThan(a[2]-b[2]);expect(far[0]-farOff[0]).toBeLessThan(.003);expect(a[0]).toBeLessThan(1);});
 it('keeps illumination continuous as a figure crosses the room',()=>{for(const period of ['morning','noon','afternoon','dusk','night','midnight'])for(let x=180;x<367;x++){const a=Light.at(x,240,period,true),b=Light.at(x+1,240,period,true);for(let i=0;i<3;i++)expect(Math.abs(a[i]-b[i])).toBeLessThan(.006);}});
});
