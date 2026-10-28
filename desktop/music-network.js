import {createHash} from 'node:crypto';

const text=(v,n=100)=>typeof v==='string'?v.replace(/<[^>]*>/g,'').replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,n):'';
const number=v=>/^\d{1,20}$/.test(String(v??''))?String(v):'';
export const musicAccountKey=userid=>createHash('sha256').update(String(userid)).digest('hex').slice(0,24);
export const networkMusicId=(owner,hash)=>'network-'+createHash('sha256').update(owner+':'+hash).digest('hex');
export function networkSong(row){
 const a=row?.audio_info||{},hash=String(row?.hash||a.hash_128||a.hash||row?.FileHash||'').toLowerCase();
 if(!/^[a-f0-9]{32}$/.test(hash))return null;
 const raw=text(row.songname||row.filename||row.name||row.audio_name||a.songname||a.filename||row.SongName).replace(/\.(mp3|flac|wav|m4a)$/i,'');
 if(!raw)return null;
 const artist=text(row.author_name||row.singername||row.singer||a.author_name||a.singername||row.SingerName||(raw.includes(' - ')?raw.split(' - ')[0]:''));
 return{provider:'kugou',songId:hash,title:raw.startsWith(artist+' - ')?raw.slice(artist.length+3):raw,artist,albumId:number(row.album_id||row.albumid||row.album_info?.id||row.albuminfo?.id||row.AlbumID),mixId:number(row.album_audio_id||row.mixsongid||row.MixSongID)};
}
export function networkTrack(song,owner,playlist='在线搜索'){
 return{id:networkMusicId(owner,song.songId),owner,songId:song.songId,title:text(song.title),artist:text(song.artist),albumId:number(song.albumId),mixId:number(song.mixId),playlist:text(playlist)};
}
export function validateNetworkTrack(t){
 if(!t||!/^network-[a-f0-9]{64}$/.test(t.id)||!/^[a-f0-9]{24}$/.test(t.owner)||!/^[a-f0-9]{32}$/.test(t.songId)||!text(t.title)||t.id!==networkMusicId(t.owner,t.songId))return null;
 return networkTrack(t,t.owner,t.playlist);
}
export function playlistRows(body){
 if(body?.status!==1||body.error_code)throw Error('歌单读取失败，请检查登录状态后重试');
 for(const candidate of [body.data,body.info,body.list,body.lists,body.songs,body]){
  if(Array.isArray(candidate))return candidate;
  for(const key of ['info','list','lists','songs','songlist','items'])if(Array.isArray(candidate?.[key]))return candidate[key];
 }
 throw Error('歌单返回的数据格式无法识别，本地歌单已保留');
}
export function userPlaylist(row,userid){
 const listid=number(row?.listid||row?.specialid),gid=String(row?.list_create_gid||row?.global_collection_id||row?.gid||'');
 if(!listid)return null;
 return{listid,gid:/^[\w-]{1,160}$/.test(gid)?gid:'',type:Number(row.type)===1?1:0,title:text(row.name||row.specialname)||'未命名歌单',count:Math.max(0,Number(row.song_count??row.songcount??row.count)||0),kind:Number(row.is_def)===1||Number(row.is_def)===2||Number(row.is_default)===1?'我喜欢':String(row.list_create_userid)===String(userid)?'自建':'收藏'};
}
