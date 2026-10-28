import {describe,it,expect,vi} from 'vitest';
import {createServer} from 'node:http';
import {parseThanks,createThanksSync,THANKS_SOURCE,THANKS_ENDPOINT} from '../desktop/about-thanks.js';
const file=(text='软件作者/开发者：杯艺宣（龚震宇）')=>JSON.stringify({schemaVersion:1,entries:[{text,links:[]}]});
describe('GitHub-only acknowledgements',()=>{
 it('accepts structured plain text and safe HTTPS links',()=>{
  const entries=parseThanks(JSON.stringify({schemaVersion:1,entries:[{text:'<img src=x onerror=alert(1)>杯艺宣',links:[{label:'安全',url:'https://github.com/example'},{label:'危险',url:'javascript:alert(1)'},{label:'凭证',url:'https://u:p@example.com'}]}]}));
  expect(entries[0].text).toBe('杯艺宣');expect(entries[0].links).toEqual([{label:'安全',url:'https://github.com/example'}]);
  for(const content of ['## 致谢',file('').replace('"schemaVersion":1','"schemaVersion":2'),JSON.stringify({schemaVersion:1,entries:[]}),file(''),file('x'.repeat(129*1024))])expect(()=>parseThanks(content)).toThrow();
 });
 it('checks GitHub on every open, even within the same millisecond, and never consults home',async()=>{
  const home=vi.fn(()=>{throw Error('Must not read local data');}),fetcher=vi.fn(async()=>new Response(file())),sync=createThanksSync(home,{fetcher,clock:()=>100000});
  for(let i=0;i<3;i++)expect((await sync.get()).source).toBe('github');
  expect(fetcher).toHaveBeenCalledTimes(3);expect(home).not.toHaveBeenCalled();
  expect(fetcher.mock.calls[0][0]).toBe(THANKS_ENDPOINT+'?t=100000');expect(fetcher.mock.calls[0][1]).toMatchObject({redirect:'error',cache:'no-store',headers:{'cache-control':'no-cache'}});
 });
 it('uses an in-memory response only after GitHub confirms it with 304',async()=>{
  const fetcher=vi.fn(async()=>new Response(file(),{headers:{etag:'"one"'}})),sync=createThanksSync(()=>'',{fetcher});
  await sync.get();fetcher.mockImplementationOnce(async()=>new Response(null,{status:304}));const r=await sync.get();
  expect(fetcher.mock.calls[1][1].headers['if-none-match']).toBe('"one"');expect(r).toMatchObject({ok:true,source:'github',unchanged:true});expect(r.entries[0].text).toContain('软件作者/开发者');
 });
 it('displays changed remote text immediately instead of a local author label',async()=>{
  const fetcher=vi.fn(async()=>new Response(file('旧文案'))),sync=createThanksSync(()=>'',{fetcher});await sync.get();
  fetcher.mockImplementationOnce(async()=>new Response(file()));const r=await sync.get();expect(r.entries[0].text).toBe('软件作者/开发者：杯艺宣（龚震宇）');
 });
 it('does not show bundled, cached or previous entries after network or data failure',async()=>{
  for(const bad of [async()=>{throw Error('offline');},async()=>new Response('Not Found',{status:404}),async()=>new Response('x'.repeat(129*1024)),async()=>new Response('{}')]){
   const fetcher=vi.fn(async()=>new Response(file(),{headers:{etag:'"one"'}})),sync=createThanksSync(()=>'',{fetcher});await sync.get();fetcher.mockImplementationOnce(bad);const r=await sync.get();
   expect(r).toMatchObject({ok:false,entries:[],source:'github',url:THANKS_SOURCE});expect(r.error).toContain('GitHub');await sync.get();expect(fetcher.mock.calls[2][1].headers).not.toHaveProperty('if-none-match');
  }
 });
 it('does not accept 304 on a fresh process with no previously verified response',async()=>{
  const r=await createThanksSync(()=>'',{fetcher:async()=>new Response(null,{status:304})}).get();expect(r.ok).toBe(false);expect(r.entries).toEqual([]);
 });
 it('coalesces simultaneous checks without skipping later checks',async()=>{
  const fetcher=vi.fn(async()=>new Response(file())),sync=createThanksSync(()=>'',{fetcher});const [a,b]=await Promise.all([sync.get(),sync.get(true)]);
  expect(a).toEqual(b);expect(fetcher).toHaveBeenCalledTimes(1);await sync.get();expect(fetcher).toHaveBeenCalledTimes(2);expect(a).not.toHaveProperty('etag');
 });
 it('passes a real HTTP update and unchanged round trip, with no offline fallback',async()=>{
  let body=file(),version='"v1"',hits=0;const server=createServer((req,res)=>{hits++;if(req.headers['if-none-match']===version){res.writeHead(304);res.end();}else{res.writeHead(200,{'content-type':'application/json; charset=utf-8',etag:version});res.end(body);}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as any,url='http://127.0.0.1:'+address.port+'/thanks.json';
  try{
   const sync=createThanksSync(()=>'',{fetcher:(_url,options)=>fetch(url,options)});expect((await sync.get()).entries[0].text).toContain('杯艺宣');expect((await sync.get()).unchanged).toBe(true);
   body=file('GitHub 新文案');version='"v2"';expect((await sync.get()).entries[0].text).toBe('GitHub 新文案');expect(hits).toBe(3);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
  const offline=await createThanksSync(()=>'',{fetcher:async()=>{throw Error('offline');}}).get();expect(offline.entries).toEqual([]);
 });
});
