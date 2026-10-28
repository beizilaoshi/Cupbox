import {describe,it,expect,vi} from 'vitest';
import {searchPublicMusic,resolvePublicMusic,publicMusicURL} from '../desktop/qq/public-music.js';
describe('anonymous multi-platform music',()=>{
 it('stops probing after the first playable batch in direct-first mode',async()=>{
  const request=vi.fn(async(p,a)=>a==='search'?Array.from({length:5},(_,i)=>({id:String(i+1),name:'版本'+i,artist:['歌手']})):{url:'https://m801.music.126.net/full.mp3'});
  const rows=await searchPublicMusic('歌名',{request,limit:1});expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({provider:'netease',songId:'1',playable:true});expect(request.mock.calls.filter(c=>c[1]==='url')).toHaveLength(5);
 });
 it('omits unavailable and preview results and probes later exact recordings',async()=>{
  const request=vi.fn(async(p,a,args)=>a==='search'?p==='netease'?Array.from({length:5},(_,i)=>({id:String(i+1),name:'版本'+i,artist:['真实歌手']})):[{id:'99',name:'原唱',artist:['原唱歌手']}]:p==='netease'&&args.id==='4'?{url:'https://m801.music.126.net/full.mp3'}:p==='netease'&&args.id==='1'?{url:'https://m801.music.126.net/preview.mp3',preview:true}:{url:''});
  const rows=await searchPublicMusic('歌名',{request});expect(rows).toMatchObject([{provider:'netease',songId:'4',title:'版本3',artist:'真实歌手',playable:true}]);expect(request.mock.calls.some(c=>c[1]==='url'&&c[2].id==='99')).toBe(true);
 });
 it('returns no selectable candidates when only metadata is available',async()=>{
  const rows=await searchPublicMusic('原唱',{request:async(p,a)=>a==='search'?[{id:'123',name:'原唱',artist:['歌手']}]:{url:''}});expect(rows).toEqual([]);
 });
 it('aggregates valid results from different sources without login or fake metadata',async()=>{const request=vi.fn(async(p,a,args,opts)=>p==='kuwo'?[{artist:[]}]:[{id:p==='kugou'?'a'.repeat(32):'12345',url_id:'12345',name:'晴天',artist:['歌手'],album:'专辑'}]);const rows=await searchPublicMusic('晴天',{verifyPlayable:false,request});expect(rows.map(r=>r.provider)).toEqual(['netease','tencent','kugou']);expect(rows.every(r=>r.source==='meting')).toBe(true);expect(request.mock.calls.every(c=>Object.keys(c[2]).join()==='query'&&!('cookie'in c[3]))).toBe(true);});
 it('tolerates provider errors and deduplicates only the same platform ID',async()=>{const rows=await searchPublicMusic('晴天',{verifyPlayable:false,request:async p=>{if(p==='kugou')throw Error('offline');return[{id:'12345',name:'晴天',artist:['歌手']},{id:'12345',name:'晴天',artist:['歌手']}];}});expect(rows).toHaveLength(3);expect(rows.map(r=>r.provider)).toEqual(['netease','tencent','kuwo']);});
 it('resolves the selected source without switching singers, credentials or platforms',async()=>{const request=vi.fn(async()=>({url:'http://m801.music.126.net/track.mp3',br:128,size:1000})),song={source:'meting',provider:'netease',songId:'12345',urlId:'12345',title:'晴天'};expect((await resolvePublicMusic(song,{request})).data.file).toBe('https://m801.music.126.net/track.mp3');expect(request).toHaveBeenCalledTimes(1);expect(request.mock.calls[0].slice(0,3)).toEqual(['netease','url',{id:'12345'}]);});
 it('refuses preview-only or unavailable streams instead of claiming full playback',async()=>{const song={source:'meting',provider:'netease',songId:'12345'};for(const body of [{url:''},{url:'https://m801.music.126.net/a.mp3',preview:true},{url:'https://evil.example/a.mp3'}])await expect(resolvePublicMusic(song,{request:async()=>body})).rejects.toThrow();});
 it('bounds IDs, source domains and cancellation',async()=>{expect(publicMusicURL('https://music.126.net.evil.example/a','netease')).toBe('');expect(publicMusicURL('https://127.0.0.1/a','netease')).toBe('');expect(publicMusicURL('https://m801.music.126.net/a','tencent')).toBe('');await expect(resolvePublicMusic({source:'meting',provider:'netease',songId:'../bad'},{request:vi.fn()})).rejects.toThrow();const c=new AbortController();c.abort();await expect(searchPublicMusic('晴天',{signal:c.signal,request:async()=>[]})).rejects.toThrow();});
});
