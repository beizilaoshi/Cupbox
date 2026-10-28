// Imported audio stays private. The bundled default was supplied by the user.
import path from 'node:path';
import {mkdir,readFile,stat,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const LIMIT=2*1024*1024;
export function audioMime(bytes){
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE')return 'audio/wav';
 if(bytes.length>=4&&bytes.toString('ascii',0,4)==='OggS')return 'audio/ogg';
 if(bytes.length>=3&&(bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&224)===224))return 'audio/mpeg';
 throw Error('仅支持有效的 MP3、WAV 或 OGG 音频');
}
export function createPetAudio(home){
 const file=()=>path.join(home(),'.cupbox','pet-audio','custom.json');
 let cache;
 async function builtin(){const bytes=await readFile(new URL('../ui/assets/pet/audio/press-recording-4.mp3',import.meta.url));return{source:'builtin',press:{name:'标准录音 4.mp3',data:`data:audio/mpeg;base64,${bytes.toString('base64')}`,playbackRate:2},release:null};}
 async function load(){if(cache!==undefined)return cache;try{if((await stat(file())).size>6*1024*1024)throw Error('音效文件过大');const saved=JSON.parse(await readFile(file(),'utf8'));for(const clip of [saved.press,saved.release]){if(!clip||typeof clip.name!=='string'||clip.name.length>255||typeof clip.data!=='string'||clip.data.length>3*1024*1024||!/^data:audio\/(mpeg|wav|ogg);base64,[A-Za-z0-9+/=]+$/.test(clip.data))throw Error('音效配置无效');clip.playbackRate=1;}cache={...saved,source:'custom'};return cache;}catch(e){if(e.code==='ENOENT'){cache=await builtin();return cache;}throw Error('自定义音效损坏，请重新导入或恢复内置音效');}}
 async function importFiles(files){
  if(files.length!==2)throw Error('请同时选择按下、松开两个音效文件（如 Ya1.mp3 和 Ya2.mp3）');
  const sorted=[...files].sort((a,b)=>path.basename(a).localeCompare(path.basename(b),'en',{numeric:true}));
  const clips=[];for(const name of sorted){if((await stat(name)).size>LIMIT)throw Error('每个音效文件不能超过 2 MB');const bytes=await readFile(name);if(bytes.length>LIMIT)throw Error('音效文件过大');const mime=audioMime(bytes);clips.push({name:path.basename(name),data:`data:${mime};base64,${bytes.toString('base64')}`});}
  const next={source:'custom',press:clips[0],release:clips[1]},target=file(),temporary=target+'.'+randomUUID()+'.tmp';await mkdir(path.dirname(target),{recursive:true});
  try{await writeFile(temporary,JSON.stringify(next));await rename(temporary,target);cache=next;}finally{await unlink(temporary).catch(()=>{});}
  return state();
 }
 async function state(){const value=await load();return{custom:value.source==='custom',press:value.press.name,release:value.release?.name||'',playbackRate:value.press.playbackRate||1};}
 return{load,state,importFiles,async reset(){await unlink(file()).catch(e=>{if(e.code!=='ENOENT')throw e;});cache=undefined;return state();}};
}
