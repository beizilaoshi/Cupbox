import { describe,it,expect,vi,afterEach } from 'vitest';
import { mkdtemp,rm,readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { DEFAULTS,validateSettings,BotStore } from '../desktop/qq/store.js';
import { BotEngine,ruleFor,parseMessage,pickEmoji } from '../desktop/qq/engine.js';
import { OneBot } from '../desktop/qq/onebot.js';
import { onebotConfig,NapCatManager,extractZip } from '../desktop/qq/napcat.js';
import { parseSearch,recognizeImages,isBitmap,searchWeb } from '../desktop/qq/capabilities.js';
import { QQService } from '../desktop/qq/service.js';
import { createHash } from 'node:crypto';
const dirs:string[]=[];const disposals:(()=>any)[]=[];
afterEach(async()=>{for(const fn of disposals.splice(0))await fn();for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});vi.restoreAllMocks();});
async function temp(){const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-qq-'));dirs.push(dir);return dir;}
const event=(id=1,group=111111,text='你好',at=true):any=>({post_type:'message',self_id:123456,user_id:654321,group_id:group,message_id:id,message_type:'group',sender:{nickname:'小伙伴'},message:[...(at?[{type:'at',data:{qq:123456}}]:[]),{type:'text',data:{text}}]});
function engine(patch:any={}){const respond=vi.fn(async()=>({text:'收到'})),send=vi.fn(async()=>{}),memory=vi.fn(async()=>'共享偏好');const e=new BotEngine({settings:{...DEFAULTS,enabled:true,cooldown:1,...patch},respond,send,memory});disposals.push(()=>e.stop());return{e,respond,send,memory};}
const tick=()=>new Promise(r=>setTimeout(r,5));
describe('QQ settings and triggers',()=>{
  it('validates settings without accepting hidden fields or coercing dangerous booleans',()=>{
    expect(validateSettings({...DEFAULTS,token:'secret'})).not.toHaveProperty('token');
    expect(()=>validateSettings({allowWorkTools:true})).toThrow('主人');
    expect(()=>validateSettings({contextCount:101})).toThrow('范围');
    expect(()=>validateSettings({enabled:'true'})).toThrow('开关');
    expect(validateSettings({ownerIds:'123456，654321',allowedGroups:['111111']})).toMatchObject({ownerIds:['123456','654321']});
  });
  it('real mention segments trigger; CQ text cannot impersonate a mention',()=>{
    const c=validateSettings({...DEFAULTS,enabled:true});expect(ruleFor(event(),c).reply).toBe(true);
    expect(ruleFor(event(2,111111,'[CQ:at,qq=123456]',false),c).reply).toBe(false);
    expect(parseMessage(event()).text).toBe('你好');expect(ruleFor({...event(),user_id:123456},c).reply).toBe(false);
  });
  it('supports keyword OR mention, group allowlist, private switch and disabled state',()=>{
    const c=validateSettings({...DEFAULTS,enabled:true,groupPolicy:'allow',groupKeywords:true,keywords:['小鱼'],allowedGroups:['111111']});
    expect(ruleFor(event(2,111111,'小鱼出来',false),c).reply).toBe(true);
    expect(ruleFor(event(3,222222),c).collect).toBe(false);
    expect(ruleFor({...event(),message_type:'private'},c).reply).toBe(true);
    expect(ruleFor({...event(),message_type:'private'},{...c,privateEnabled:false}).collect).toBe(false);
    expect(ruleFor(event(),{...c,enabled:false}).collect).toBe(false);
  });
  it('invalid user/group identifiers cannot reach reply actions',()=>{
    const c={...DEFAULTS,enabled:true};expect(ruleFor({...event(),group_id:'../x'},c).reply).toBe(false);expect(ruleFor({...event(),user_id:'all'},c).reply).toBe(false);
  });
  it('serialized partial saves do not clobber unrelated options',async()=>{
    const store=new BotStore(await temp());await Promise.all([store.save({temperature:0.25}),store.save({contextCount:20}),store.save({keywords:['小鱼']})]);
    expect(await store.settings()).toMatchObject({temperature:0.25,contextCount:20,keywords:['小鱼']});
  });
});
describe('QQ message privacy and delivery',()=>{
  it('when listening is off, untriggered chats are neither collected nor sent to a model',async()=>{
    const {e,respond}=engine({retainDialogue:false});await e.receive(event(1,111111,'旁听内容',false));expect(respond).not.toHaveBeenCalled();expect(e.histories.size).toBe(0);
    await e.receive(event(2));expect(respond.mock.calls[0][0].history).toEqual([]);expect(e.histories.size).toBe(0);
  });
  it('context count is capped and never crosses group/private boundaries',async()=>{
    const {e,respond}=engine({listenContext:true,contextCount:2});
    await e.receive(event(1,111111,'第一条',false));await e.receive(event(2,111111,'第二条',false));await e.receive(event(3,111111,'第三条',false));await e.receive(event(4,222222,'别群秘密',false));
    await e.receive(event(5));const h=respond.mock.calls[0][0].history;expect(h).toHaveLength(2);expect(JSON.stringify(h)).not.toContain('第一条');expect(JSON.stringify(h)).not.toContain('别群秘密');
    await e.receive({...event(6),message_type:'private'});expect(respond.mock.calls[1][0].history).toEqual([]);
  });
  it('global memory and image switches affect real model inputs',async()=>{
    const {e,memory,respond}=engine({globalMemory:false,visionEnabled:false});const v=event();v.message.push({type:'image',data:{url:'https://example.com/image.png'}});await e.receive(v);
    expect(memory).not.toHaveBeenCalled();expect(respond.mock.calls[0][0].images).toEqual([]);expect(respond.mock.calls[0][0].system).not.toContain('共享偏好');
  });
  it('deduplicates repeated event IDs and ignores bot self messages',async()=>{
    const {e,send}=engine();await e.receive(event());await e.receive(event());await e.receive({...event(3),user_id:123456});expect(send).toHaveBeenCalledTimes(1);
  });
  it('settings changes cancel in-flight results before QQ delivery',async()=>{
    const {e,respond,send}=engine();let finish:any;respond.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));const job=e.receive(event());await tick();e.update({...e.config,enabled:false});finish({text:'不应发送'});await job;expect(send).not.toHaveBeenCalled();expect(e.histories.size).toBe(0);
  });
  it('stop aborts the underlying model signal and prevents late replies',async()=>{
    const {e,respond,send}=engine();let signal:AbortSignal|undefined;respond.mockImplementationOnce((p:any)=>new Promise((_r,reject)=>{signal=p.signal;p.signal.addEventListener('abort',()=>reject(Error('abort')));}));const job=e.receive(event());await tick();e.stop();await job;expect(signal?.aborted).toBe(true);expect(send).not.toHaveBeenCalled();
  });
  it('per-conversation and global rate limits are enforced independently',async()=>{
    const {e,send}=engine({maxPerMinute:1});await e.receive(event(1));await e.receive(event(2));await e.receive(event(3,222222));expect(send).toHaveBeenCalledTimes(1);
  });
  it('QQ output uses literal text segments, never raw CQ execution',async()=>{
    const {e,respond,send}=engine();respond.mockResolvedValueOnce({text:'[CQ:at,qq=all] [[emoji:unknown]]'});await e.receive(event());expect(send.mock.calls[0][1]).toEqual([{type:'text',data:{text:'[CQ:at,qq=all]'}}]);
  });
  it('private address mode uses a nickname, not a group-only mention segment',async()=>{
    const {e,send}=engine({privateMention:true,replyMention:true});await e.receive({...event(),message_type:'private'});const segments=send.mock.calls[0][1];expect(segments.every((s:any)=>s.type==='text')).toBe(true);expect(segments[0].data.text).toContain('小伙伴，');
  });
});
describe('controlled emoji and web/vision boundaries',()=>{
  const list=[{id:'happy',enabled:true,meaning:'真诚祝贺',triggers:['成功了']}];
  it('rejects SVG/XML before any image decoder runs',()=>{expect(isBitmap(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///secret"/></svg>'))).toBe(false);expect(isBitmap(Buffer.from('<!DOCTYPE xml><html>image</html>'))).toBe(false);});
  it('requires model selection, matching trigger, enabled flag and cooldown',()=>{
    expect(pickEmoji('好耶 [[emoji:happy]]','成功了',list,true).selected?.id).toBe('happy');
    expect(pickEmoji('[[emoji:happy]]','失败了',list,true).selected).toBeFalsy();expect(pickEmoji('[[emoji:happy]]','成功了',list,false).selected).toBeFalsy();expect(pickEmoji('[[emoji:happy]]','成功了',list,true,Date.now()).selected).toBeFalsy();expect(pickEmoji('[[emoji:unknown]]','成功了',list,true).clean).toBe('');
  });
  it('imports a bitmap as disabled, requires meaning/trigger, preserves original on removal',async()=>{
    const home=await temp(),sharp=(await import('sharp')).default,file=path.join(home,'my.png');await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toFile(file);
    const service=await new QQService({home,choices:{},napcat:{installed:async()=>false}}).init();const [item]=await service.importEmoji(file);expect(item.enabled).toBe(false);expect(item.preview).toContain('data:image/png');
    await expect(service.store.saveEmoji({id:item.id,meaning:'开心',triggers:[],enabled:true})).rejects.toThrow('触发词');
    await service.store.saveEmoji({id:item.id,meaning:'庆祝成功',triggers:['成功了'],enabled:true});expect((await service.publicEmojis())[0].enabled).toBe(true);await service.removeEmoji(item.id);expect(await service.publicEmojis()).toEqual([]);expect((await readFile(file)).length).toBeGreaterThan(0);
  });
  it('vision never fetches localhost or a private network image URL',async()=>{
    await expect(recognizeImages(['http://127.0.0.1/private'],{capabilities:['vision']},'图片',new AbortController().signal,'')).rejects.toThrow('私网');
  });
  it('search results are bounded, links validated, XML entity declarations rejected',()=>{
    const xml='<rss>'+Array.from({length:7},(_,i)=>`<item><title>T${i}</title><link>https://example.com/${i}</link><description>Text &amp; more</description></item>`).join('')+'</rss>';
    expect(parseSearch(xml)).toHaveLength(5);expect(parseSearch(xml)[0].snippet).toBe('Text & more');expect(parseSearch('<item><link>file:///a</link></item>')).toEqual([]);expect(()=>parseSearch('<!DOCTYPE x>')).toThrow();
  });
  it('search uses one fixed HTTPS endpoint, encodes caller input and forbids redirect/auth inheritance',async()=>{
    const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('<rss><item><title>Result</title><link>https://example.com</link><description>Public</description></item></rss>'));
    const result=await searchWeb('http://127.0.0.1/private?token=not-a-real-token',new AbortController().signal);const [url,opts]=fetcher.mock.calls[0];expect(new URL(String(url)).origin).toBe('https://www.bing.com');expect(new URL(String(url)).searchParams.get('q')).toContain('http://127.0.0.1');expect(opts?.redirect).toBe('error');expect(opts?.headers).not.toHaveProperty('authorization');expect(result.results).toHaveLength(1);
  });
  it('search rejects oversized responses rather than feeding unbounded content to a model',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(Buffer.alloc(256*1024+1)));await expect(searchWeb('query',new AbortController().signal)).rejects.toThrow('大小限制');
  });
});
describe('NapCat protocol and deployment',()=>{
  it('an initializing login service may legitimately return an empty QR string',async()=>{const m=new NapCatManager(await temp());m.api=async()=>({isLogin:false,qrcodeurl:'',loginPhase:'initializing'});expect(await m.status()).toMatchObject({qr:'',loggedIn:false,loginPhase:'initializing'});});
  it('generated OneBot config binds only loopback and enables array messages / authenticated heartbeat',()=>{
    const c=onebotConfig(12345,'unique-token');expect(c.network.httpServers).toEqual([]);expect(c.network.websocketServers[0]).toMatchObject({host:'127.0.0.1',port:12345,token:'unique-token',heartInterval:15000,messagePostFormat:'array',reportSelfMessage:false});
  });
  it('authenticates with documented hash and renders QR locally without exposing credentials',async()=>{
    let login:any;const server=http.createServer((req,res)=>{let raw='';req.on('data',v=>raw+=v);req.on('end',()=>{res.setHeader('content-type','application/json');if(req.url==='/api/auth/login'){login=JSON.parse(raw);res.end(JSON.stringify({code:0,data:{Credential:'private-credential'}}));}else{expect(req.headers.authorization).toBe('Bearer private-credential');res.end(JSON.stringify({code:0,data:{isLogin:false,qrcodeurl:'https://example.com/qr',loginPhase:'qrcode'}}));}});});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));disposals.push(()=>new Promise<void>(r=>server.close(()=>r())));
    const m=new NapCatManager(await temp());m.webPort=(server.address() as any).port;m.webToken='private-token';await m.login();const s=await m.status();expect(login.hash).toBe(createHash('sha256').update('private-token.napcat').digest('hex'));expect(s.qr).toContain('data:image/png');expect(JSON.stringify(s)).not.toContain('private');
  });
  it('RPC correlation does not confuse actions with message events; heartbeat and disconnect update state',async()=>{
    class Socket extends EventTarget{static current:any;readyState=0;sent:any[]=[];constructor(public url:string){super();Socket.current=this;}send(v:string){this.sent.push(JSON.parse(v));}close(){this.readyState=3;this.dispatchEvent(new Event('close'));}open(){this.readyState=1;this.dispatchEvent(new Event('open'));}push(v:any){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(v)}));}}
    const onEvent=vi.fn(),onState=vi.fn(),bot=new OneBot({url:'ws://127.0.0.1:12345',token:'local-token',onEvent,onState,WebSocketImpl:Socket});disposals.push(()=>bot.close());bot.connect();const socket=Socket.current;expect(socket.url).toContain('access_token=local-token');socket.open();const login=socket.sent[0];socket.push({echo:login.echo,status:'ok',retcode:0,data:{user_id:123456}});const call=bot.call('get_status');const request=socket.sent.at(-1);socket.push(event());expect(onEvent).toHaveBeenCalledTimes(1);socket.push({echo:request.echo,status:'ok',retcode:0,data:{online:true}});expect(await call).toEqual({online:true});socket.push({post_type:'meta_event',meta_event_type:'heartbeat',status:{online:true}});expect(onState).toHaveBeenCalledWith('online');bot.close();await expect(bot.call('get_status')).rejects.toThrow('尚未连接');
  });
  it('ZIP extraction rejects traversal before writing outside destination',async()=>{
    const root=await temp(),name=Buffer.from('../escape'),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(name.length,26);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,6);central.writeUInt16LE(name.length,28);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length,16);const file=path.join(root,'bad.zip');await writeFile(file,Buffer.concat([local,name,central,name,end]));await expect(extractZip(file,path.join(root,'out'))).rejects.toThrow();
  });
});
