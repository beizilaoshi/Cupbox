import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import {createPetAudio,audioMime} from '../desktop/pet/audio.js';
describe('private desktop pet audio',()=>{
 it('imports an ordered pair, restores it across restarts and resets without changing original files',async()=>{
  const home=await mkdtemp(path.join(tmpdir(),'cupbox-pet-audio-'));
  try{const files=[path.join(home,'Ya2.mp3'),path.join(home,'Ya1.mp3')];for(const f of files)await writeFile(f,Buffer.from('ID3fixture'));
   const audio=createPetAudio(()=>home);expect((await audio.state()).custom).toBe(false);
   expect(await audio.importFiles(files)).toEqual({custom:true,press:'Ya1.mp3',release:'Ya2.mp3',playbackRate:1});
   expect((await createPetAudio(()=>home).load()).press.data).toMatch(/^data:audio\/mpeg;base64,/);
   await expect(audio.importFiles([files[0]])).rejects.toThrow();
   await writeFile(files[0],'<html>not audio</html>');await expect(audio.importFiles(files)).rejects.toThrow();
   expect((await audio.state()).custom).toBe(true);
   expect((await audio.reset()).custom).toBe(false);expect((await createPetAudio(()=>home).load()).press.playbackRate).toBe(2);
  }finally{await rm(home,{recursive:true,force:true});}
 });
 it('loads the exact user-supplied default recording at 2x with no release clip',async()=>{
  const home=await mkdtemp(path.join(tmpdir(),'cupbox-pet-recording-'));
  try{const audio=createPetAudio(()=>home),value=await audio.load();expect(value.release).toBe(null);expect(value.press.playbackRate).toBe(2);expect(value.press.name).toBe('标准录音 4.mp3');expect(Buffer.from(value.press.data.split(',')[1],'base64').length).toBe(38002);expect(await audio.state()).toEqual({custom:false,press:'标准录音 4.mp3',release:'',playbackRate:2});}finally{await rm(home,{recursive:true,force:true});}
 });
 it('rejects oversize files and forged extension types',async()=>{
  expect(()=>audioMime(Buffer.from('malware.mp3'))).toThrow();
  const home=await mkdtemp(path.join(tmpdir(),'cupbox-pet-audio-'));
  try{const f=path.join(home,'large.mp3');await writeFile(f,Buffer.alloc(2*1024*1024+1));await expect(createPetAudio(()=>home).importFiles([f,f])).rejects.toThrow('2 MB');}finally{await rm(home,{recursive:true,force:true});}
 });
});
