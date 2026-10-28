import {Worker} from 'node:worker_threads';
import {inspectUntrusted,outputRisk} from './security.js';
export const PUBLIC_MUSIC_PROVIDERS=['netease','tencent','kugou','kuwo'];
const hosts={netease:['music.126.net','music.163.com'],tencent:['qq.com'],kugou:['kugou.com','kugou.net'],kuwo:['kuwo.cn']};
export function publicMusicURL(value,provider){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||u.href.length>4000||!hosts[provider]?.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return'';u.protocol='https:';return u.href;}catch{return'';}}
const safeText=(value,max=120)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max):'';
const validID=value=>typeof value==='string'&&/^[\w-]{1,80}$/.test(value);
export function publicMusicRequest(provider,action,params,{signal}={}){
 if(!PUBLIC_MUSIC_PROVIDERS.includes(provider)||!['search','url'].includes(action))throw Error('音乐平台无效');signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./public-music-worker.mjs',import.meta.url),{execArgv:[],workerData:{provider,action,...params},stdout:true,stderr:true});worker.stdout.resume();worker.stderr.resume();let done=false;const finish=(e,v)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();e?reject(e):resolve(v);},abort=()=>finish(signal?.reason||Error('音乐请求已取消')),timer=setTimeout(()=>finish(Error('公开曲库请求超时')),12000);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();worker.on('message',r=>finish(r?.ok?null:Error('公开曲库暂不可用'),r?.data));worker.on('error',()=>finish(Error('音乐聚合组件不可用')));worker.on('exit',()=>{if(!done)finish(Error('音乐请求中断'));});});
}
export async function searchPublicMusic(query,{signal,request=publicMusicRequest,verifyPlayable=true,limit=5}={}){
 limit=Number.isInteger(limit)&&limit>=1&&limit<=5?limit:5;
 const text=safeText(query);if(!text||inspectUntrusted(text).blocked||outputRisk(text))throw Error('搜索词无效');
 const results=await Promise.allSettled(PUBLIC_MUSIC_PROVIDERS.map(p=>request(p,'search',{query:text},{signal})));signal?.throwIfAborted();
 const groups=results.map((r,i)=>r.status==='fulfilled'&&Array.isArray(r.value)?r.value.slice(0,5).flatMap(row=>{const title=safeText(row.name),artist=safeText(Array.isArray(row.artist)?row.artist.join(' / '):row.artist),songId=String(row.id||''),urlId=String(row.url_id||row.id||'');return title&&validID(songId)&&validID(urlId)&&!inspectUntrusted(title+' '+artist).blocked&&!outputRisk(title+' '+artist)?[{provider:PUBLIC_MUSIC_PROVIDERS[i],songId,urlId,title,artist,album:safeText(row.album),source:'meting'}]:[];}):[]);
 const songs=[],seen=new Set();for(let pos=0;pos<5;pos++)for(const group of groups){const row=group[pos];if(!row)continue;const key=row.provider+':'+row.songId;if(!seen.has(key)){seen.add(key);songs.push(row);}}
 if(!songs.length&&results.every(r=>r.status==='rejected'))throw Error('多个公开曲库均未响应，请稍后重试');
 if(!verifyPlayable)return songs.slice(0,limit);
 const playable=[];
 // Search metadata is not proof of a playable stream. Probe the exact IDs,
 // including later results, without substituting another singer or recording.
 for(let offset=0;offset<songs.length&&playable.length<limit;offset+=5){
  const batch=songs.slice(offset,offset+5),checks=await Promise.allSettled(batch.map(song=>resolvePublicMusic(song,{signal,request})));
  signal?.throwIfAborted();checks.forEach((result,index)=>{if(result.status==='fulfilled')playable.push({...batch[index],playable:true});});
 }
 return playable.slice(0,limit);
}
export async function resolvePublicMusic(song,{signal,request=publicMusicRequest}={}){
 if(song.source!=='meting'||!PUBLIC_MUSIC_PROVIDERS.includes(song.provider)||!validID(song.urlId||song.songId))throw Error('音乐结果无效，请重新搜索');
 const result=await request(song.provider,'url',{id:song.urlId||song.songId},{signal});signal?.throwIfAborted();
 const url=publicMusicURL(result?.url,song.provider);if(!url)throw Object.assign(Error('当前平台未提供可免费播放的音频，请重新搜歌选择其他候选'),{code:'MUSIC_UNAVAILABLE'});if(result?.preview===true||result?.trial===true)throw Object.assign(Error('平台仅提供试听片段，不能作为完整歌曲发送'),{code:'MUSIC_PREVIEW_ONLY'});
 return{type:'file',data:{file:url,name:safeText(song.title)||'歌曲'}};
}
