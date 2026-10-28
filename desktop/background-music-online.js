import {musicPublicLookup} from './qq/music-dns.js';
import path from 'node:path';
import {mkdir,mkdtemp,writeFile,unlink,rmdir,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {musicAccountKey,networkTrack,networkSong,playlistRows,userPlaylist} from './music-network.js';
import {validateMusicFile} from './music-library.js';
import {searchEchoMusic,echoMusicAudioFile,musicURL} from './qq/echo-music.js';
import {requestHTTP} from './workbench/http.js';
import {audioFormat} from './qq/music-voice-converter.js';
export class BackgroundMusicOnline{
 constructor({session,library,download=requestHTTP}){Object.assign(this,{session,library,download});this.results=new Map();this.playlists=new Map();}
 async search(query){const text=typeof query==='string'?query.trim():'';if(!text||text.length>120)throw Error('请填写1～120字的歌名或歌手');const generation=this.session.generation,status=await this.session.status();const rows=await searchEchoMusic(text,{limit:20,request:(...args)=>this.session.request(...args)});const items=rows.map(song=>{const token=randomUUID();this.results.set(token,{song,owner:status.loggedIn?musicAccountKey(status.userid):null,generation,at:Date.now()});return{token,title:song.title,artist:song.artist};});while(this.results.size>100)this.results.delete(this.results.keys().next().value);return items;}
 async account(){const s=await this.session.status();if(!s.loggedIn)throw Error('请先登录酷狗概念版账号，再读取收藏歌单');return musicAccountKey(s.userid);}
 async listPlaylists(){
  const owner=await this.account(),generation=this.session.generation,next=new Map(),seen=new Set();let complete=false;
  for(let page=1;page<=20;page++){
   const rows=playlistRows(await this.session.request('playlists',{page,pagesize:30}));let fresh=0;
   const s=await this.session.status();
   for(const row of rows){const item=userPlaylist(row,s.userid);if(!item||seen.has(item.listid))continue;fresh++;seen.add(item.listid);const token=randomUUID();next.set(token,{...item,owner,generation,at:Date.now()});}
   if(rows.length<30){complete=true;break;}if(!fresh)throw Error('歌单分页重复，请稍后重试');
  }
  if(!complete)throw Error('歌单超过600份，请先在酷狗整理歌单后重试');
  if(owner!==await this.account()||generation!==this.session.generation)throw Error('音乐账号已变化，请重新读取歌单');
  this.playlists=next;return [...next].map(([token,p])=>({token,title:p.title,count:p.count,kind:p.kind}));
 }
 async syncPlaylist(token){
  const p=this.playlists.get(token),owner=await this.account();
  if(!p||p.owner!==owner||p.generation!==this.session.generation||Date.now()-p.at>1800000)throw Error('歌单列表已过期，请刷新歌单后重试');
  const songs=new Map();let complete=false,skipped=0,seen=new Set();
  for(let page=1;page<=20;page++){
   let rows;try{rows=playlistRows(await this.session.request('playlistTracks',{listid:p.listid,type:p.type,page,pagesize:100}));}catch(e){if(!p.gid||p.generation!==this.session.generation)throw e;rows=playlistRows(await this.session.request('playlistPublicTracks',{id:p.gid,page,pagesize:100}));}
   const fingerprint=JSON.stringify(rows);
   if(rows.length&&seen.has(fingerprint))throw Error('歌曲分页重复，本次未改动本地歌单');seen.add(fingerprint);
   for(const r of rows){const song=networkSong(r);if(song)songs.set(song.songId,networkTrack(song,owner,p.title));else skipped++;}
   if(rows.length<100){complete=true;break;}
  }
  if(!complete)throw Error('歌单超过2000首，请选择较小的歌单，本地歌单未改动');
  if(owner!==await this.account()||p.generation!==this.session.generation)throw Error('音乐账号已变化，请重新同步');
  const result=await this.library.mergeNetwork([...songs.values()]);return{...result,skipped,title:p.title};
 }
 async addNetwork(token){
  const row=this.results.get(token);if(!row||Date.now()-row.at>300000)throw Error('搜索结果已过期，请重新搜索');
  const owner=await this.account();if(row.owner&&row.owner!==owner||row.generation!==this.session.generation)throw Error('音乐账号已变化，请重新搜索');
  return this.library.mergeNetwork([networkTrack(row.song,owner)]);
 }
 async audioDownload(url,signal){
  const authorize=target=>{if(!['http:','https:'].includes(target.protocol)||!musicURL(target.href))throw Error('音乐下载地址不属于酷狗');};
  const request=target=>this.download({url:target,responseType:'binary',timeoutMs:45000,maxBytes:10*1024*1024},{signal,lookup:musicPublicLookup,authorize});
  try{return await request(url);}catch(e){
   // The concept API hands out HTTP CDN hosts, while echoMusicVoice upgrades them
   // to HTTPS. Those shared-CDN hosts usually serve HTTP only and their certificate
   // does not cover the Kugou hostname, so retry the same pinned host over HTTP.
   if(!String(url).startsWith('https:')||!(e.code==='ERR_TLS_CERT_ALTNAME_INVALID'||/certificate|altnames/i.test(e.message||'')))throw e;
   return request('http:'+String(url).slice(6));
  }
 }
 async fetchAudio(song,signal){
  const audio=await echoMusicAudioFile(song,{signal,request:(...args)=>this.session.request(...args)});
  const response=await this.audioDownload(audio.data.file,signal);
  signal.throwIfAborted();if(response.status!==200||response.truncated||!response.bytes?.length)throw Error('音乐文件下载失败或超过10MB');
  const ext=({mov:'m4a',mp3:'mp3',wav:'wav',flac:'flac',ogg:'ogg',aac:'aac'})[audioFormat(response.bytes)];if(!ext)throw Error('背景音乐暂不支持此格式');return{bytes:response.bytes,ext};
 }
 async resolve(id){
  const track=this.library.tracks.find(t=>t.id===id&&t.network&&!t.disabled);if(!track)throw Error('网络歌曲不存在或已禁用');
  const owner=await this.account(),generation=this.session.generation;
  const signal=this.session.controller.signal,root=path.join(this.library.getDirectory(),'online-cache');
  for(const ext of ['mp3','m4a','wav','flac','ogg','aac']){const file=path.join(root,track.id+'.'+ext);try{await validateMusicFile(file);signal.throwIfAborted();return pathToFileURL(file).href;}catch(e){signal.throwIfAborted();}}
  const {bytes,ext}=await this.fetchAudio({...track,provider:'kugou'},signal);signal.throwIfAborted();
  if(owner!==await this.account()||generation!==this.session.generation)throw Error('音乐账号已变化，请重新播放');
  if(!this.library.tracks.some(t=>t.id===id&&!t.disabled))throw Error('歌曲已被移除或禁用');
  await mkdir(root,{recursive:true});const file=path.join(root,track.id+'.'+ext),temp=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(temp,bytes,{flag:'wx',mode:0o600});signal.throwIfAborted();await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}return pathToFileURL(file).href;
 }
 async removeCache(id){if(!/^network-[a-f0-9]{64}$/.test(id))return;for(const ext of ['mp3','m4a','wav','flac','ogg','aac'])await unlink(path.join(this.library.getDirectory(),'online-cache',id+'.'+ext)).catch(()=>{});}
 async add(token){const row=this.results.get(token);if(!row||Date.now()-row.at>300000)throw Error('搜索结果已过期，请重新搜索');const signal=this.session.controller.signal,audio=await echoMusicAudioFile(row.song,{signal,request:(...args)=>this.session.request(...args)});const response=await this.audioDownload(audio.data.file,signal);signal.throwIfAborted();if(response.status!==200||response.truncated||!response.bytes?.length)throw Error('音乐文件下载失败或超过10MB');const format=audioFormat(response.bytes),ext=({mov:'m4a',mp3:'mp3',wav:'wav',flac:'flac',ogg:'ogg',aac:'aac'})[format];if(!ext)throw Error('背景音乐暂不支持此格式');const root=this.library.getDirectory();await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'online-')),file=path.join(dir,(row.song.title+' - '+row.song.artist).replace(/[\\/:*?"<>|\x00-\x1f]/g,' ').slice(0,100)+'.'+ext);try{await writeFile(file,response.bytes,{mode:0o600,flag:'wx'});signal.throwIfAborted();return await this.library.importFiles([file]);}finally{await unlink(file).catch(()=>{});await rmdir(dir).catch(()=>{});}}
}
