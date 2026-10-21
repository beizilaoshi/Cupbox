import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {QQService} from '../desktop/qq/service.js';
import {OneBot} from '../desktop/qq/onebot.js';
import {selectEmoji} from '../desktop/qq/emoji-policy.js';
import {BotLogger,redact} from '../desktop/qq/logger.js';
import {createMemeTools,MEME_TOOL} from '../desktop/qq/meme-tools.js';
import {runFreeWorkflow} from '../src/core/free-workflow.js';
// sharp 需要 Node≥20：CI 的 Node 18 加载不了，依赖真实解码器的用例按环境跳过
let sharpOk=true;try{await import('sharp');}catch{sharpOk=false;}
const cleanups:(()=>any)[]=[];
afterEach(async()=>{for(const fn of cleanups.splice(0))await fn();vi.restoreAllMocks();});
class Socket extends EventTarget{
  static current:Socket;readyState=0;sent:any[]=[];reply:any={message_id:123};retcode=0;wording='';
  constructor(public url:string){super();Socket.current=this;}
  send(raw:string){const request=JSON.parse(raw);this.sent.push(request);queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({echo:request.echo,status:this.retcode?'failed':'ok',retcode:this.retcode,wording:this.wording,data:request.action==='get_login_info'?{user_id:123456}:this.reply})})));}
  open(){this.readyState=1;this.dispatchEvent(new Event('open'));}close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
}
async function fixture(format='png'){
  const home=await mkdtemp(path.join(os.tmpdir(),'qq-emoji-send-'));cleanups.push(()=>rm(home,{recursive:true,force:true}));const entries:any[]=[];
  const service=await new QQService({home,choices:{records:async()=>({all:[{id:'default',capabilities:['text']}]})},respond:async()=>({text:'好耶，成功了！'}),notifyLog:e=>entries.push(e),napcat:{installed:async()=>false,stop(){}}}).init();
  const sharp=(await import('sharp')).default,file=path.join(home,'meme.'+format);await sharp({create:{width:4,height:4,channels:3,background:'pink'}}).toFormat(format as any).toFile(file);const [image]=await service.importEmoji(file);await service.store.saveEmoji({id:image.id,meaning:'真诚庆祝',triggers:['成功'],enabled:true,selectionMode:'trigger'});
  const config={enabled:true,emojiEnabled:true,globalMemory:false,retainDialogue:false,cooldown:1};const review=await service.review(config);await service.save(config,review.token);service.started=true;service.online=true;
  const bot=service.bot=new OneBot({url:'ws://127.0.0.1:1234',token:'never-log-this-token',WebSocketImpl:Socket,onLog:(l,m,d)=>service.log(l,'transport',m,d)});bot.connect();Socket.current.open();cleanups.unshift(()=>service.stop());return{service,image,socket:Socket.current,entries};
}
const event=(kind='group',id=1):any=>({post_type:'message',message_type:kind,self_id:123456,user_id:654321,group_id:111111,message_id:id,message:[{type:'at',data:{qq:123456}},{type:'text',data:{text:'我成功了'}}]});
describe.runIf(sharpOk)('actual emoji delivery path',()=>{
  it('semantic search sends a real picture before the model sees the acknowledged outcome, and persists it across restarts',async()=>{
    const {service,image,socket}=await fixture();await service.store.saveEmoji({id:image.id,meaning:'猫猫比心，表达感谢',triggers:[],selectionMode:'semantic',enabled:true});service.engine.update({...service.config,retainDialogue:true,segmentedStreaming:true,replyMention:true});
    let seen:any;service.customRespond=async(p:any)=>{seen=p;expect(p.onTextDelta).toBeUndefined();expect(p.system).toContain('历史中');expect(p.memeTools.definitions[0].name).toBe('send_meme');const search=await p.memeTools.execute('send_meme',{action:'search',query:'比心'});expect(search.candidates[0].id).toBe(image.id);expect(socket.sent.filter(r=>r.action==='send_group_msg')).toHaveLength(0);const result=await p.memeTools.execute('send_meme',{action:'send',id:image.id});expect(result).toMatchObject({ok:true,status:'accepted',messageId:'123'});expect(socket.sent.filter(r=>r.action==='send_group_msg')).toHaveLength(1);expect((await p.memeTools.execute('send_meme',{action:'send',id:image.id})).status).toBe('already_attempted');return{text:'给你一个比心。'};};
    const incoming=event();incoming.message[1].data.text='谢谢你一直陪着我';expect((await service.engine.receive(incoming)).sent).toBe(true);
    const sends=socket.sent.filter(r=>r.action==='send_group_msg');expect(sends).toHaveLength(2);expect(sends[0].params.message.some(s=>s.type==='image')).toBe(true);expect(sends[1].params.message.some(s=>s.type==='at')).toBe(false);
    const recalled=await service.autoMemory.recall(incoming,{...service.config,retainDialogue:true},'');expect(recalled.history.at(-1).delivery).toMatchObject({status:'accepted',id:image.id});
    service.engine.stop();service.engine.update({...service.config,retainDialogue:true});service.customRespond=async(p:any)=>{expect(p.system).toContain('本机会话图片发送记录');expect(p.system).toContain('accepted');expect(p.history.at(-1).delivery).toBeUndefined();return{text:'刚才那张是比心。'};};incoming.message_id=2;service.engine.last.clear();await service.engine.receive(incoming);expect(seen.prompt).toBe('谢谢你一直陪着我');
  });
  it('rejected tool sends report failure and cannot fall back to a second image or mark a success',async()=>{
    const {service,image,socket}=await fixture();socket.retcode=1200;service.customRespond=async(p:any)=>{await p.memeTools.execute('send_meme',{action:'search'});const result=await p.memeTools.execute('send_meme',{action:'send',id:image.id});expect(result).toMatchObject({ok:false,status:'failed'});socket.retcode=0;return{text:'这张图没发成功，先用文字说声恭喜。'};};
    expect((await service.engine.receive(event())).sent).toBe(true);expect(socket.sent.filter(r=>r.params?.message?.some(s=>s.type==='image'))).toHaveLength(1);expect(service.engine.emojiLast.size).toBe(0);
  });
  it('records an already acknowledged image even if subsequent model generation fails',async()=>{
    const {service,image}=await fixture();service.engine.update({...service.config,retainDialogue:true});service.customRespond=async(p:any)=>{await p.memeTools.execute('send_meme',{action:'search'});await p.memeTools.execute('send_meme',{action:'send',id:image.id});throw Error('model disconnected');};expect((await service.engine.receive(event())).parts).toBe(1);expect((await service.autoMemory.recall(event(),{...service.config,retainDialogue:true},'')).history.at(-1).delivery.status).toBe('accepted');
  });
  it('auto trigger sends an actual base64 image over group and private OneBot RPC without model marker',async()=>{
    const {service,socket,entries}=await fixture();expect((await service.engine.receive(event())).sent).toBe(true);expect((await service.engine.receive(event('private',2))).sent).toBe(true);
    const requests=socket.sent.filter(r=>r.action.startsWith('send_'));expect(requests.map(r=>r.action)).toEqual(['send_group_msg','send_private_msg']);for(const request of requests){const image=request.params.message.find(s=>s.type==='image');expect(image.data.file.startsWith('base64://')).toBe(true);expect(Buffer.from(image.data.file.slice(9),'base64').subarray(1,4).toString()).toBe('PNG');expect(JSON.stringify(request.params)).not.toContain('cupbox-emoji');}
    expect(entries.some(e=>e.stage==='emoji'&&e.details.reason==='trigger')).toBe(true);expect(entries.some(e=>e.stage==='send'&&e.details.messageId==='123')).toBe(true);expect(JSON.stringify(entries)).not.toContain('base64://');expect(JSON.stringify(entries)).not.toContain('我成功了');
  });
  it('supports single-character triggers and explicit model-only choice with cooldowns',async()=>{
    const {service,image}=await fixture();await service.store.saveEmoji({id:image.id,meaning:'笑出声',triggers:['笑'],enabled:true,selectionMode:'model'});const list=await service.store.emojis();expect(selectEmoji('好呀','笑',list,true).reason).toBe('model_wait');expect(selectEmoji(`好呀 [[ emoji : ${image.id} ]]`,'笑',list,true).selected.id).toBe(image.id);expect(selectEmoji('好呀','笑',list,false).reason).toBe('disabled');expect(selectEmoji(`[[emoji:${image.id}]]`,'笑',list,true,100,101,60).reason).toBe('cooldown');
  });
  it('converts WebP to a standard PNG and provides local diagnostic results',async()=>{
    const {service,image}=await fixture('webp');const segment=await service.emojiSegment((await service.store.emojis())[0]);expect(Buffer.from(segment.data.file.slice(9),'base64').subarray(1,4).toString()).toBe('PNG');expect(await service.diagnoseEmoji({id:image.id,text:'成功了'})).toMatchObject({globalEnabled:true,itemEnabled:true,meaning:true,matched:true});
  });
  it('reports actual image rejection code and never logs acknowledgement as success or retries',async()=>{
    const {service,socket,entries}=await fixture();socket.retcode=1200;socket.wording='image upload error token=not-a-real-secret';const result=await service.engine.receive(event());expect(result.error).toContain('1200');expect(result.error).toContain('图片');expect(socket.sent.filter(r=>r.action==='send_group_msg')).toHaveLength(1);expect(entries.some(e=>e.level==='error'&&e.details.retcode===1200)).toBe(true);expect(entries.some(e=>e.stage==='send'&&e.message.includes('已确认'))).toBe(false);expect(JSON.stringify(entries)).not.toContain('not-a-real-secret');
  });
  it('missing message id is an unknown result, never a confirmed delivery',async()=>{
    const {service,socket,entries}=await fixture();socket.reply={};const result=await service.engine.receive(event());expect(result.error).toContain('消息编号');expect(entries.some(e=>e.details.code==='ONEBOT_NO_MESSAGE_ID')).toBe(true);
  });
  it('manual test is possible while automatic replies are paused, but refuses offline targets',async()=>{
    const {service,image,socket}=await fixture();await service.save({enabled:false});expect((await service.testEmoji({id:image.id,kind:'group',target:'111111'})).messageId).toBe(123);expect(socket.sent.filter(r=>r.action==='send_group_msg')[0].params.message).toHaveLength(1);service.online=false;await expect(service.testEmoji({id:image.id,kind:'private',target:'654321'})).rejects.toThrow('扫码');
  });
});
describe('scoped meme tools',()=>{
  const item={id:'safe-id',name:'猫',meaning:'开心猫猫',triggers:['开心'],enabled:true,selectionMode:'semantic'};
  function tools(patch:any={}){const send=vi.fn(async()=>({message_id:42,emojiSent:true})),api=createMemeTools({list:[item],input:'给我发一张猫',enabled:true,last:0,now:()=>100000,cooldown:60,send,signal:new AbortController().signal,...patch});return{api,send};}
  it('requires a searched authorized id, rejects paths, and keeps keyword restrictions for existing modes',async()=>{
    const {api,send}=tools();expect((await api.execute('send_meme',{action:'send',id:item.id})).ok).toBe(false);await api.execute('send_meme',{action:'search',query:'猫'});expect((await api.execute('send_meme',{action:'send',id:'C:/private.png'})).ok).toBe(false);expect(send).not.toHaveBeenCalled();expect(tools({list:[{...item,selectionMode:'model'}]}).api.definitions).toHaveLength(0);expect(tools({list:[{...item,enabled:false}]}).api.definitions).toHaveLength(0);
  });
  it('informs the model about disabled, unmatched and cooling states without registering empty send tools',()=>{
    for(const patch of [{enabled:false},{last:99999},{list:[]}]){const {api}=tools(patch);expect(api.definitions).toHaveLength(0);expect(api.system).toMatch(/关闭|冷却|没有符合/);}
  });
  it('keeps an unknown receipt distinct from accepted and prevents retries or a second send',async()=>{
    const send=vi.fn(async()=>({})),{api}=tools({send});await api.execute('send_meme',{action:'search'});expect(await api.execute('send_meme',{action:'send',id:item.id})).toMatchObject({ok:false,status:'unknown'});expect(await api.execute('send_meme',{action:'send',id:item.id})).toMatchObject({ok:false,status:'already_attempted'});expect(send).toHaveBeenCalledTimes(1);
  });
  it('uses bounded free-model JSON compatibility for memes without local file permission or a vision model',async()=>{
    const {api,send}=tools(),chat=vi.fn().mockResolvedValueOnce({text:JSON.stringify({type:'tool',name:'send_meme',arguments:{action:'search',query:'猫'}})}).mockResolvedValueOnce({text:JSON.stringify({type:'tool',name:'send_meme',arguments:{action:'send',id:item.id}})}).mockResolvedValueOnce({text:JSON.stringify({type:'final',text:'喵～'})});const result=await runFreeWorkflow({prompt:'发张猫',system:api.system,executeTool:api.execute},[MEME_TOOL],chat,4);expect(send).toHaveBeenCalledTimes(1);expect(result.text).toBe('喵～');expect(JSON.stringify(chat.mock.calls[2][0])).toContain('accepted');
  });
});
describe('bounded redacted real-time console',()=>{
  it('publishes immediately, redacts credentials and images, drops arbitrary prompt data and keeps a bounded ring',()=>{
    const sink=vi.fn(),logger=new BotLogger(sink,3);logger.add('error','test','Bearer ABCDEFG token=private-token sk-1234567890 https://user:pass@example.com/path?access_token=secret',{action:'send_group_msg',prompt:'private conversation',file:'base64://AAAA',retcode:1200});expect(sink).toHaveBeenCalledTimes(1);const raw=JSON.stringify(logger.snapshot());for(const secret of ['ABCDEFG','private-token','sk-1234567890','user:pass','access_token=secret','private conversation','base64://AAAA'])expect(raw).not.toContain(secret);
    for(let i=0;i<5;i++)logger.add('info','test','stage '+i);expect(logger.snapshot().entries).toHaveLength(3);expect(logger.snapshot(5).entries).toHaveLength(1);expect(logger.clear().entries).toHaveLength(1);expect(redact('image=base64://aGVsbG8=')).not.toContain('aGVsbG8');
  });
});
