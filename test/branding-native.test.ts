import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
const SharpModule:any=await import('sharp').catch(()=>null);
const sharp=SharpModule?.default as any;
import {BrandingStore,syncLogoShortcuts,resolveLogoSelection} from '../desktop/branding-store.js';
const desktopDir=path.resolve('desktop');
async function cleanup(dir:string){const target=path.resolve(dir);if(path.dirname(target)!==path.resolve(os.tmpdir())||!path.basename(target).startsWith('cupbox-branding-'))throw Error('Unexpected test cleanup path');await rm(target,{recursive:true,force:true});}
describe.skipIf(!sharp)('native logo assets',()=>{
 it('has eleven festival variants and four genuinely separate action illustrations',async()=>{const catalog=JSON.parse(await readFile(path.join(desktopDir,'branding-catalog.json'),'utf8'));expect(catalog).toHaveLength(30);expect(new Set(catalog.map((x:any)=>x.id)).size).toBe(30);expect(catalog.filter((x:any)=>x.festival)).toHaveLength(11);expect(catalog.filter((x:any)=>x.group==='action')).toHaveLength(4);});
 it('changes mascot clothing on all festival dates and restores the manual choice without changing custom or geometric logos',async()=>{
  const catalog=JSON.parse(await readFile(path.join(desktopDir,'branding-catalog.json'),'utf8')),prefs={logoStyle:'mascot-sakura',logoHolidayAuto:true};
  for(const [date,id]of [['2026-02-17','spring'],['2026-03-03','lantern'],['2026-04-01','april'],['2026-05-01','labor'],['2026-06-19','dragonboat'],['2026-08-19','qixi'],['2026-09-25','midautumn'],['2026-10-01','national'],['2026-10-31','halloween'],['2026-12-22','winter'],['2026-12-25','christmas']]){const state=resolveLogoSelection(catalog,null,prefs,new Date(date+'T12:00:00'));expect(state.selected.id).toBe('mascot-'+id);expect(state.manualSelected.id).toBe('mascot-sakura');expect(state.automatic).toBe(true);}
  expect(resolveLogoSelection(catalog,null,prefs,new Date('2026-12-26T12:00:00')).selected.id).toBe('mascot-sakura');expect(prefs.logoStyle).toBe('mascot-sakura');const date=new Date('2026-12-25T12:00:00');expect(resolveLogoSelection(catalog,null,{...prefs,logoStyle:'ink'},date).selected.id).toBe('ink');expect(resolveLogoSelection(catalog,{id:'custom',kind:'custom'},{...prefs,logoStyle:'custom'},date).selected.id).toBe('custom');
 });
 it('validates settings and pauses automatic clothing when a style is manually chosen',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-branding-'));let prefs:any={logoStyle:'mascot-sakura'};const store=new BrandingStore({desktopDir,getDirectory:()=>dir,getPrefs:async()=>prefs,savePrefs:async(p:any)=>Object.assign(prefs,p)});
  try{for(const patch of [null,[],{}, {logoMotion:'bad'}, {logoHolidayAuto:'yes'}, {logoMotion:'heart',apiKey:'bad'}])await expect(store.configure(patch)).rejects.toThrow();await store.configure({logoHolidayAuto:true,logoMotion:'heart'});expect(prefs).toMatchObject({logoHolidayAuto:true,logoMotion:'heart'});await store.select('mascot-wave');expect(prefs.logoHolidayAuto).toBe(false);expect((await store.snapshot()).preferences.motion).toBe('heart');await store.select('ink');await expect(store.configure({logoHolidayAuto:true})).rejects.toThrow();
  }finally{await cleanup(dir);}
 });
 it('renders every builtin into a nonempty square native image and a complete multi-size ICO',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-branding-'));let prefs:any={};const store=new BrandingStore({desktopDir,getDirectory:()=>dir,getPrefs:async()=>prefs,savePrefs:async(p:any)=>Object.assign(prefs,p)});
  try{for(const item of await store.catalog()){const native=await store.prepareNative(item),meta=await sharp(native.png).metadata(),ico=await readFile(native.icoPath);expect(meta.width).toBe(256);expect(meta.height).toBe(256);expect(ico.readUInt16LE(2)).toBe(1);expect(ico.readUInt16LE(4)).toBe(9);let end=6+9*16;
   for(let i=0;i<9;i++){const offset=6+i*16,size=ico[offset]||256,length=ico.readUInt32LE(offset+8),start=ico.readUInt32LE(offset+12);expect(start).toBe(end);const image=await sharp(ico.subarray(start,start+length)).metadata();expect(image.width).toBe(size);expect(image.height).toBe(size);end+=length;}expect(end).toBe(ico.length);
  }}finally{await cleanup(dir);}
 });
 it('preserves custom aspect ratio with transparent padding and changes the cache path when image content changes',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-branding-'));let prefs:any={};const store=new BrandingStore({desktopDir,getDirectory:()=>dir,getPrefs:async()=>prefs,savePrefs:async(p:any)=>Object.assign(prefs,p)}),file=path.join(dir,'input.png');
  try{await sharp({create:{width:400,height:100,channels:4,background:'#ff0000'}}).png().toFile(file);const first=await store.importFile(file),a=await store.prepareNative(first.selected),again=await store.prepareNative(first.selected),raw=await sharp(a.png).raw().toBuffer();expect(a.icoPath).toBe(again.icoPath);expect(raw[3]).toBe(0);expect(raw[(128*256+128)*4]).toBe(255);expect(raw[(128*256+128)*4+3]).toBe(255);
   await sharp({create:{width:400,height:100,channels:4,background:'#0000ff'}}).png().toFile(file);const next=await store.importFile(file),b=await store.prepareNative(next.selected);expect(b.icoPath).not.toBe(a.icoPath);expect(prefs.logoStyle).toBe('custom');expect((await readFile(a.icoPath)).length).toBeGreaterThan(0);await writeFile(b.icoPath,'broken');expect((await store.prepareNative(next.selected)).icoPath).toBe(b.icoPath);expect((await readFile(b.icoPath)).readUInt16LE(2)).toBe(1);
   await store.select('original');expect(prefs.logoStyle).toBe('original');expect((await store.snapshot()).custom).toBeTruthy();await expect(store.select('../outside')).rejects.toThrow();expect(prefs.logoStyle).toBe('original');
  }finally{await cleanup(dir);}
 });
 it('updates only matching existing shortcuts without replacing targets, arguments or other applications',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-branding-')),calls:any[]=[],failures:any[]=[];const executable=path.join(dir,'Cupbox.exe');
  try{for(const name of ['Cupbox.lnk','Other.lnk','Already.lnk','Broken.lnk','Failed.lnk','notes.txt'])await writeFile(path.join(dir,name),'fixture');await mkdir(path.join(dir,'folder.lnk'));
   await syncLogoShortcuts({directories:[dir,path.join(dir,'missing')],executable,iconPath:path.join(dir,'new.ico'),readShortcut:(link:string)=>{if(link.endsWith('Broken.lnk'))throw Error('broken');return{target:link.endsWith('Other.lnk')?path.join(dir,'other.exe'):executable.toUpperCase(),icon:link.endsWith('Already.lnk')?path.join(dir,'new.ico'):'old.ico',args:'--existing',cwd:'unchanged'};},writeShortcut:(...args:any[])=>{calls.push(args);return!args[0].endsWith('Failed.lnk');},onError:(e:Error)=>failures.push(e)});
   expect(calls.map(x=>path.basename(x[0])).sort()).toEqual(['Cupbox.lnk','Failed.lnk']);for(const [,operation,options]of calls){expect(operation).toBe('update');expect(options).toEqual({icon:path.join(dir,'new.ico'),iconIndex:0});}expect(failures).toHaveLength(2);
  }finally{await cleanup(dir);}
 });
});
