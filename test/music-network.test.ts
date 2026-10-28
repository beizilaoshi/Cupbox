import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {BackgroundMusicOnline} from '../desktop/background-music-online.js';
import {MusicLibrary} from '../desktop/music-library.js';
import {networkSong,networkTrack,musicAccountKey,playlistRows} from '../desktop/music-network.js';

let root:string,prefs:any,library:any,session:any,online:any;
const hash=(n:number)=>n.toString(16).padStart(32,'0');
const song=(n:number)=>({hash:hash(n),filename:'歌手 - 歌曲'+n+'.mp3',album_id:12,mixsongid:n});
const ok=(rows:any[])=>({status:1,data:{info:rows}});
const wave=()=>{const b=Buffer.alloc(80);b.write('RIFF');b.writeUInt32LE(72,4);b.write('WAVE',8);return b;};
beforeEach(async()=>{
 root=await mkdtemp(path.join(os.tmpdir(),'cupbox-network-'));prefs={};
 library=new MusicLibrary({desktopDir:root,getDirectory:()=>path.join(root,'music'),getPrefs:async()=>prefs,savePrefs:async p=>{prefs={...prefs,...p};}});await library.init();
 session={generation:1,controller:new AbortController(),status:vi.fn(async()=>({loggedIn:true,userid:'123'})),request:vi.fn(async(action:string)=>action==='playlists'?ok([{listid:88,name:'夜间收藏',song_count:2}]):ok([song(1),song(2)]))};
 online=new BackgroundMusicOnline({session,library,download:vi.fn(async()=>({status:200,bytes:wave()}))});
});
afterEach(async()=>rm(root,{recursive:true,force:true}));
describe('Kugou Concept network music',()=>{
 it('maps Concept playlist fields including nested audio metadata and ignores unplayable records',()=>{
  expect(networkSong(song(1))).toMatchObject({title:'歌曲1',artist:'歌手',songId:hash(1),albumId:'12',mixId:'1'});
  expect(networkSong({audio_info:{hash_128:hash(2),songname:'轻音乐',author_name:'作曲家'}})).toMatchObject({title:'轻音乐',artist:'作曲家'});
  expect(networkSong({filename:'无音源'})).toBeNull();expect(()=>playlistRows({status:0})).toThrow();expect(()=>playlistRows({status:1,data:{}})).toThrow();
 });
 it('pages user playlists without exposing provider IDs or account credentials to renderer',async()=>{
  session.request.mockImplementation(async(_a,p)=>ok(p.page===1?Array.from({length:30},(_,i)=>({listid:i+1,name:'歌单'+i})):[]));
  const rows=await online.listPlaylists();expect(rows).toHaveLength(30);expect(session.request).toHaveBeenCalledTimes(2);expect(rows[0]).not.toHaveProperty('listid');expect(rows[0]).not.toHaveProperty('owner');
 });
 it('syncs all pages, deduplicates hashes and preserves disabled settings across sync and restart',async()=>{
  const [p]=await online.listPlaylists();session.request.mockImplementation(async(_a,p)=>ok(p.page===1?Array.from({length:100},(_,i)=>song(i+1)):[song(100),song(101),{filename:'缺少hash'}]));
  expect(await online.syncPlaylist(p.token)).toMatchObject({added:101,skipped:1});const track=library.tracks.find(t=>t.network);await library.disable(track.id,true);
  expect(await online.syncPlaylist(p.token)).toMatchObject({added:0,updated:101});expect(library.snapshot().tracks.find(t=>t.id===track.id)).toMatchObject({network:true,disabled:true,url:''});
  const again=new MusicLibrary({desktopDir:root,getDirectory:()=>path.join(root,'music'),getPrefs:async()=>prefs,savePrefs:vi.fn()});await again.init();expect(again.tracks.find(t=>t.id===track.id)?.disabled).toBe(true);
 });
 it('does not delete local songs when the remote list changes or a sync fails halfway',async()=>{
  const [p]=await online.listPlaylists();await online.syncPlaylist(p.token);const before=JSON.stringify(prefs);
  session.request.mockImplementation(async(_a,p)=>{if(p.page===2)throw Error('offline');return ok(Array.from({length:100},(_,i)=>song(i+10)));});
  await expect(online.syncPlaylist(p.token)).rejects.toThrow('offline');expect(JSON.stringify(prefs)).toBe(before);
  session.request.mockResolvedValue(ok([song(2)]));await online.syncPlaylist(p.token);expect(library.tracks.filter(t=>t.network)).toHaveLength(2);
 });
 it('rejects repeated pagination without committing a partial library',async()=>{
  const [p]=await online.listPlaylists();session.request.mockResolvedValue(ok(Array.from({length:100},(_,i)=>song(i+1))));await expect(online.syncPlaylist(p.token)).rejects.toThrow('分页重复');expect(library.network).toHaveLength(0);
 });
 it('preserves collection type and falls back to the original collection ID for shared playlists',async()=>{
  session.request.mockImplementation(async a=>a==='playlists'?ok([{listid:88,type:1,list_create_gid:'collection-88',name:'收藏歌单'}]):a==='playlistTracks'?{status:0}:ok([song(1)]));
  const [p]=await online.listPlaylists();expect(await online.syncPlaylist(p.token)).toMatchObject({added:1});
  expect(session.request).toHaveBeenCalledWith('playlistTracks',expect.objectContaining({listid:'88',type:1}));expect(session.request).toHaveBeenCalledWith('playlistPublicTracks',expect.objectContaining({id:'collection-88'}));
 });
 it('rejects stale playlist tokens and a changed account before committing',async()=>{
  const [p]=await online.listPlaylists();session.generation++;await expect(online.syncPlaylist(p.token)).rejects.toThrow('过期');session.generation--;
  session.request.mockImplementation(async()=>{session.status.mockResolvedValue({loggedIn:true,userid:'456'});return ok([song(1)]);});
  await expect(online.syncPlaylist(p.token)).rejects.toThrow('账号已变化');expect(library.network).toHaveLength(0);
 });
 it('requires login to read playlists, separates identical songs by account, and keeps cards playable after a relogin',async()=>{
  session.status.mockResolvedValue({loggedIn:false});await expect(online.listPlaylists()).rejects.toThrow('先登录');
  const a=networkTrack(networkSong(song(1)),musicAccountKey('123')),b=networkTrack(networkSong(song(1)),musicAccountKey('456'));expect(a.id).not.toBe(b.id);
  await library.mergeNetwork([a,b]);session.status.mockResolvedValue({loggedIn:true,userid:'123'});
  session.request.mockImplementation(async action=>action==='url'?{status:1,url:'https://fs.kugou.com/fixture.wav'}:ok([song(1)]));
  const url=await online.resolve(b.id);expect(await readFile(fileURLToPath(url))).toEqual(wave());
 });
 it('retries Kugou HTTP-only CDN hosts when the shared certificate does not match',async()=>{
  const calls:string[]=[];
  online.download=vi.fn(async(args:any)=>{calls.push(args.url);if(String(args.url).startsWith('https:'))throw Object.assign(new Error("Hostname/IP does not match certificate's altnames"),{code:'ERR_TLS_CERT_ALTNAME_INVALID'});return{status:200,bytes:wave()};});
  session.request.mockImplementation(async action=>action==='url'?{status:1,url:'https://fs.youthandroid.kugou.com/a.mp3'}:action==='playlists'?ok([{listid:88,name:'夜间收藏'}]):ok([song(1)]));
  const [p]=await online.listPlaylists();await online.syncPlaylist(p.token);const t=library.network[0];
  const url=await online.resolve(t.id);
  expect(calls).toEqual(['https://fs.youthandroid.kugou.com/a.mp3','http://fs.youthandroid.kugou.com/a.mp3']);
  expect(await readFile(fileURLToPath(url))).toEqual(wave());
 });
 it('downloads on first play, caches validated audio, and removes only the local item/cache',async()=>{
  const [p]=await online.listPlaylists();await online.syncPlaylist(p.token);expect(online.download).not.toHaveBeenCalled();
  session.request.mockResolvedValue({status:1,url:'https://fs.kugou.com/fixture.wav'});const t=library.network[0],url=await online.resolve(t.id);expect(await readFile(fileURLToPath(url))).toEqual(wave());
  expect(await online.resolve(t.id)).toBe(url);expect(online.download).toHaveBeenCalledTimes(1);
  await library.remove(t.id);await online.removeCache(t.id);expect(library.tracks.some(t2=>t2.id===t.id)).toBe(false);await expect(readFile(fileURLToPath(url))).rejects.toThrow();
  expect(session.request.mock.calls.every(([a])=>!String(a).includes('del'))).toBe(true);
 });
 it('rejects disabled tracks and invalid/tampered persisted network IDs',async()=>{
  const t=networkTrack(networkSong(song(1)),musicAccountKey('123'));await library.mergeNetwork([t]);await library.disable(t.id,true);await expect(online.resolve(t.id)).rejects.toThrow('已禁用');
  prefs.musicNetworkTracks=[{...t,id:'network-../../escape'},{...t,owner:'0'.repeat(24)}];await library.init();expect(library.network).toHaveLength(0);
 });
 it('does not commit an over-capacity sync or overwrite existing disabled state',async()=>{
  const owner=musicAccountKey('123');await library.mergeNetwork(Array.from({length:1000},(_,i)=>networkTrack(networkSong(song(i+1)),owner)));const before=JSON.stringify(prefs);
  await expect(library.mergeNetwork([networkTrack(networkSong(song(1001)),owner)])).rejects.toThrow('1000');expect(JSON.stringify(prefs)).toBe(before);
 });
});
