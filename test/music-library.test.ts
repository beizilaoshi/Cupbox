import {describe,it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {MusicLibrary,nextMusicId,validateMusicFile,SYSTEM_MUSIC} from '../desktop/music-library.js';
let root:string,prefs:any,library:MusicLibrary;
beforeEach(async()=>{root=await mkdtemp(path.join(os.tmpdir(),'cupbox-music-'));prefs={};library=make();await library.init();});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
function make(save=async p=>{prefs={...prefs,...p};}){return new MusicLibrary({desktopDir:path.join(root,'desktop'),getDirectory:()=>path.join(root,'managed'),getPrefs:async()=>prefs,savePrefs:save});}
async function wave(name:string,variant=0){const file=path.join(root,name),b=Buffer.alloc(80);b.write('RIFF');b.writeUInt32LE(72,4);b.write('WAVE',8);b[70]=variant;await writeFile(file,b);return file;}
describe('persistent local music library',()=>{
 it('supports sequence wrap and random without immediately repeating or playing disabled tracks',()=>{
  const tracks=[{id:'a',disabled:false},{id:'b',disabled:true},{id:'c',disabled:false}];
  expect(nextMusicId(tracks,'a','sequence')).toBe('c');expect(nextMusicId(tracks,'c','sequence')).toBe('a');expect(nextMusicId(tracks,'a','sequence',-1)).toBe('c');
  expect(nextMusicId(tracks,'a','random',1,()=>0)).toBe('c');expect(nextMusicId(tracks.map(t=>({...t,disabled:true})),'a','random')).toBeNull();
 });
 it('never deletes builtins, advances when current is disabled and recovers from an empty queue',async()=>{
  await expect(library.remove('petal-drift')).rejects.toThrow('系统歌曲');
  for(const t of SYSTEM_MUSIC)await library.disable(t.id,true);expect(library.current).toBeNull();
  await library.disable('morning-sync',false);expect(library.current).toBe('morning-sync');
  const restored=make();await restored.init();expect(restored.snapshot()).toMatchObject({currentId:'morning-sync',mode:'single'});
 });
 it('previous returns to the actual listening history, including in random mode',async()=>{
  await library.select('petals-on-the-glass');await library.select('morning-sync');await library.setMode('random');await library.next(-1);expect(library.current).toBe('petals-on-the-glass');await library.next(-1);expect(library.current).toBe('petal-drift');
 });
 it('copies imports, deduplicates bytes, persists mode/volume, and deletes only the managed copy',async()=>{
  const original=await wave('个人音乐.wav'),originalBytes=await readFile(original);
  const result=await library.importFiles([original,original]);expect(result).toMatchObject({added:1});expect(result.skipped).toHaveLength(1);
  const custom=library.snapshot().tracks.find(t=>!t.system)!;await library.select(custom.id);await library.setMode('random');await library.setVolume(.72);
  const restored=make();await restored.init();expect(restored.snapshot()).toMatchObject({currentId:custom.id,mode:'random',volume:.72});
  await restored.remove(custom.id);expect(await readdir(path.join(root,'managed'))).toEqual([]);expect(await readFile(original)).toEqual(originalBytes);
 });
 it('rejects disguised files and ignores tampered filenames in stored metadata',async()=>{
  const bad=path.join(root,'fake.mp3');await writeFile(bad,'<script>bad media is not accepted</script>');await expect(validateMusicFile(bad)).rejects.toThrow('格式不符');
  expect((await library.importFiles([bad])).added).toBe(0);
  prefs.musicTracks=[{id:'../../source',ext:'wav',title:'bad',hash:'a'.repeat(64)},{id:'custom-'+randomUUID(),ext:'../wav',title:'bad',hash:'a'.repeat(64)}];
  const restored=make();await restored.init();expect(restored.snapshot().tracks).toHaveLength(SYSTEM_MUSIC.length);
 });
 it('rolls back imported files and live changes if persistence fails',async()=>{
  const broken=make(async()=>{throw Error('disk full');});await broken.init();
  await expect(broken.disable('petal-drift',true)).rejects.toThrow('disk full');expect(broken.current).toBe('petal-drift');expect(broken.snapshot().tracks[0].disabled).toBe(false);
  const source=await wave('save-failure.wav');await expect(broken.importFiles([source])).rejects.toThrow('disk full');expect(await readdir(path.join(root,'managed'))).toEqual([]);
 });
});
