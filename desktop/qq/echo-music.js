import {Worker} from 'node:worker_threads';
import {inspectUntrusted,outputRisk} from './security.js';

const clean=(value,max=100)=>typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
const safe=text=>text&&!outputRisk(text)&&!inspectUntrusted(text).blocked;
export const isMusicId=(provider,id)=>provider==='kugou'?/^[a-f0-9]{32}$/i.test(String(id)):['163','qq'].includes(provider)&&/^\d{1,20}$/.test(String(id));
const id=value=>/^\d{1,20}$/.test(String(value||''))?String(value):'';
// Only platform-hosted metadata URLs can be handed to the QQ card renderer.
export function musicURL(value){if(typeof value!=='string')return'';try{const u=new URL(value.replace(/\{size\}/g,'400'));if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!/(^|\.)kugou\.com$/i.test(u.hostname))return'';u.protocol='https:';return u.href.length<=2000?u.href:'';}catch{return'';}}
export function echoShareURL(hash){if(!isMusicId('kugou',hash))throw Error('酷狗歌曲 Hash 无效');return'https://hoowhoami.github.io/EchoMusic/share/?type=song&id='+hash.toLowerCase();}
export async function runEchoRequest(action,params,{signal,cookie}={}){
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./echo-music-worker.cjs',import.meta.url),{workerData:{action,params,cookie},env:{...process.env,platform:'lite'},stdout:true,stderr:true});
  worker.stdout.resume();worker.stderr.resume();let done=false;
  const finish=(error,body)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();error?reject(error):resolve(body);};
  const abort=()=>finish(signal.reason||Error('点歌已取消'));
  const timer=setTimeout(()=>finish(Error('酷狗概念版请求超时，请稍后重试')),['url','qqCreate','qqCheck','wxCreate','wxCheck','wxLogin'].includes(action)?35000:15000);
  signal?.addEventListener('abort',abort,{once:true});
  worker.on('message',r=>finish(r?.ok?null:Object.assign(Error('酷狗概念版请求失败，请检查网络或重新登录'),{code:'KUGOU_REQUEST_FAILED',platformCode:Number.isInteger(r?.errorCode)?r.errorCode:0}),r?.body));
  worker.on('error',()=>finish(Error('EchoMusic 曲库组件无法加载，请检查软件文件')));
  worker.on('exit',()=>{if(!done)finish(Error('EchoMusic 曲库请求中断'));});
  if(signal?.aborted)abort();
 });
}
export function parseEchoSongs(body,limit=5){
 if(body?.status!==1||body.error_code)throw Error('EchoMusic 曲库未返回有效结果');
 const rows=Array.isArray(body.data?.lists)?body.data.lists:[],seen=new Set(),songs=[];
 for(const row of rows.slice(0,30)){
  const hash=String(row.FileHash||'').toLowerCase(),title=clean(row.SongName||row.OriSongName),artist=clean(row.SingerName);
  if(!isMusicId('kugou',hash)||seen.has(hash)||!safe(title)||artist&&!safe(artist))continue;
  seen.add(hash);songs.push({provider:'kugou',songId:hash,title,artist,album:clean(row.AlbumName),albumId:id(row.AlbumID),mixId:id(row.MixSongID),image:musicURL(row.Image||row.trans_param?.union_cover),url:'https://www.kugou.com/song/#hash='+hash,echoUrl:echoShareURL(hash)});
  if(songs.length===Math.max(1,Math.min(30,limit)))break;
 }
 return songs;
}
export async function searchEchoMusic(query,{signal,request=runEchoRequest,limit=5}={}){
 const text=clean(query,120);if(!safe(text))throw Error('点歌搜索词无效');
 const body=await request('search',{keywords:text,type:'song',page:1,pagesize:Math.max(10,Math.min(30,limit))},{signal});signal?.throwIfAborted();return parseEchoSongs(body,limit);
}
export async function echoMusicVoice(song,{signal,request=runEchoRequest}={}){
 signal?.throwIfAborted();
 if(song.provider!=='kugou'||!isMusicId('kugou',song.songId))throw Error('语音点歌需要酷狗曲目，请搜索酷狗曲库或登记酷狗 Hash');
 const body=await request('url',{hash:song.songId,quality:128,album_id:id(song.albumId)||'0',album_audio_id:id(song.mixId)||'0'},{signal});
 signal?.throwIfAborted();
 const audio=body?.status===1&&!body.error_code?[body.url,body.backupUrl,body.backup_url,body.data?.url].flat().map(musicURL).find(Boolean):'';
 if(!audio)throw Error('这首歌暂无可用音频，请检查酷狗概念版登录和歌曲播放权限');
 // NapCat downloads and transcodes this trusted provider stream to QQ Silk.
 // A fresh authorized URL is obtained only when the selected result is sent.
 return{type:'record',data:{file:audio}};
}
export async function echoMusicAudioFile(song,options={}){
 const stream=await echoMusicVoice(song,options),audio=stream.data.file,path=new URL(audio).pathname;
 if(/\.(?:kgm|kgg|vpr)$/i.test(path))throw Error('平台返回加密音频，无法作为普通音频文件发送');
 const ext=/\.(mp3|m4a|aac|ogg|opus|flac|wav)$/i.exec(path)?.[1].toLowerCase()||'mp3';
 let name=[clean(song.title)||'歌曲',clean(song.artist)].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g,' ').replace(/\s+/g,' ').replace(/^[. ]+|[. ]+$/g,'');
 name=Array.from(name||'歌曲').slice(0,100).join('');if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='歌曲 '+name;
 return{type:'file',data:{file:audio,name:name+'.'+ext}};
}
export async function echoMusicCard(song,{signal,request=runEchoRequest}={}){
 signal?.throwIfAborted();
 if(!isMusicId('kugou',song.songId))throw Error('酷狗歌曲 Hash 无效');
 const image=musicURL(song.image),title=clean(song.title),artist=clean(song.artist);
 if(!safe(title)||artist&&!safe(artist))throw Error('歌曲信息无效');
 // Manual hash registrations have no trusted cover metadata: let NapCat resolve it.
 if(!image)return{type:'music',data:{type:'kugou',id:song.songId}};
 let audio='';try{
  const body=await request('url',{hash:song.songId,quality:128,album_id:id(song.albumId)||'0',album_audio_id:id(song.mixId)||'0'},{signal});
  if(body?.status===1&&!body.error_code){const urls=[body.url,body.backupUrl,body.backup_url,body.data?.url].flat();audio=urls.map(musicURL).find(Boolean)||'';}
 }catch{signal?.throwIfAborted();}
 signal?.throwIfAborted();
 // A restricted song remains a metadata card linking to its official song page.
 // NapCat accepts platform-specific metadata without an id, so its signer uses
 // Kugou attribution while retaining the stream authorized by the Concept login.
 // Do not supply an id here: that would ask the signer to resolve audio again.
 return{type:'music',data:{type:'kugou',url:'https://www.kugou.com/song/#hash='+song.songId.toLowerCase(),audio,title,image,singer:artist,content:artist}};
}
