import {createHash} from 'node:crypto';
import path from 'node:path';import {mkdir,readFile,writeFile,rename,lstat} from 'node:fs/promises';
const unsupported=()=>Object.assign(Error('此能力不适用于当前官方接入；本版本支持群聊@和单聊的文字、图片回复'),{code:'OFFICIAL_UNSUPPORTED',publicMessage:'官方接入不支持这项操作；请查看接入方式中的能力说明'});
const validOpenId=value=>typeof value==='string'&&/^[\w-]{1,128}$/.test(value);
const numericId=(app,kind,id)=>String(BigInt('0x'+createHash('sha256').update(JSON.stringify([app,kind,id])).digest('hex').slice(0,16))%900000000000000n+100000000000000n);
export class OfficialIds{
 constructor(root,appId){this.root=root;this.appId=appId;this.rows=[];this.pending=Promise.resolve();this.messages=new Map();this.file=path.join(root,'official-ids-'+appId+'.json');}
 async init(){await mkdir(this.root,{recursive:true});await this.check();try{const text=await readFile(this.file,'utf8');if(text.length>4*1024*1024)throw Error('OpenID映射过大');const rows=JSON.parse(text);if(!Array.isArray(rows)||rows.length>10000||rows.some(r=>!['user','group','message'].includes(r.kind)||typeof r.openid!=='string'||r.openid.length>256||!/^\d{15}$/.test(r.id))||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('OpenID映射格式错误');this.rows=rows;}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
 async check(){for(const f of [this.root,this.file])try{if((await lstat(f)).isSymbolicLink())throw Error('OpenID映射路径不能使用符号链接');}catch(e){if(e.code!=='ENOENT')throw e;}}
 id(kind,openid){if(kind==='message'){if(typeof openid!=='string'||!openid||openid.length>256)return Promise.reject(Error('官方消息标识无效'));const id=numericId(this.appId,kind,openid);if(this.messages.has(id)&&this.messages.get(id)!==openid)return Promise.reject(Error('官方消息映射冲突'));this.messages.set(id,openid);while(this.messages.size>10000)this.messages.delete(this.messages.keys().next().value);return Promise.resolve(id);}const run=this.pending.catch(()=>{}).then(async()=>{if(typeof openid!=='string'||!openid||openid.length>256||!['user','group','message'].includes(kind))throw Error('官方事件标识无效');const found=this.rows.find(r=>r.kind===kind&&r.openid===openid);if(found)return found.id;if(this.rows.length>=10000)throw Error('本机官方标识映射达到容量上限');const id=numericId(this.appId,kind,openid);if(this.rows.some(r=>r.id===id))throw Error('官方标识映射冲突，已停止处理');await this.check();const next=[...this.rows,{kind,openid,id}],temp=this.file+'.tmp';await writeFile(temp,JSON.stringify(next),{mode:0o600});await rename(temp,this.file);this.rows=next;return id;});this.pending=run;return run;}
 resolve(kind,id){return this.rows.find(r=>r.kind===kind&&r.id===String(id))?.openid;}
}
export class OfficialBot{
 constructor({credentials,ids,onEvent,onState,onLog=()=>{},onSent=()=>{},SDK,clock=Date.now}){Object.assign(this,{credentials,ids,onEvent,onState,onLog,onSent,SDK,clock});this.active=false;this.online=false;this.receipts=new Map();this.routes=new WeakMap();this.self=credentials.appId;}
 async connect(){if(this.active)return;this.active=true;try{const QQBot=this.SDK||(await import('@tencent-connect/qqbot-nodejs')).QQBot;if(!this.active)return;const client=this.client=new QQBot({...this.credentials,reconnect:{maxAttempts:10},logger:{info:()=>{},error:()=>{},warn:()=>{},debug:()=>{}}});
  for(const name of ['ready','resumed'])client.on(name,()=>{if(!this.active||client!==this.client)return;this.online=true;this.onState('online');});
  client.on('disconnected',()=>{if(!this.active||client!==this.client)return;this.online=false;this.onState('disconnected');});
  client.on('error',e=>{if(!this.active)return;this.onLog('warn','官方通道发生错误，请检查权限、网络与平台状态',{code:'OFFICIAL_ERROR',retcode:e?.bizCode??e?.httpStatus});});
  client.on('message',async(_ctx,msg)=>{if(!this.active||client!==this.client)return;try{const event=await this.normalize(msg);if(event&&this.active)await this.onEvent(event);}catch{this.onLog('warn','官方事件处理未完成，请查看输入范围、映射文件和模型状态',{code:'OFFICIAL_EVENT_FAILED'});}});
  this.onState('connecting');this.task=client.start().catch(e=>{if(!this.active||client!==this.client)return;this.online=false;this.onLog('error','官方接入已停止：核对AppID、AppSecret、沙箱成员、IP白名单与机器人发布状态',{code:e?.code==='GATEWAY_FATAL_CLOSE'?'OFFICIAL_FATAL':'OFFICIAL_START_FAILED'});this.active=false;client.stop();this.onState('error');});
 }catch{this.active=false;this.onState('error');}}
 async normalize(msg){
  if(!['c2c','group'].includes(msg.kind)||msg.senderIsBot||!validOpenId(msg.senderId)||typeof msg.messageId!=='string'||!msg.messageId||msg.messageId.length>256)return null;
  if(msg.kind==='group'&&!validOpenId(msg.groupOpenid))return null;
  const group=msg.kind==='group',targetId=group?msg.groupOpenid:msg.senderId;
  // Ignore supplied replyTarget fields: route only by the platform event's sender/group.
  const route={scope:group?'group':'c2c',targetId,msgId:msg.messageId},user=await this.ids.id('user',msg.senderId),room=group?await this.ids.id('group',targetId):user,id=await this.ids.id('message',msg.messageId);
  const text=String(msg.content||'').replace(/<@!?\d+>/g,'').slice(0,12000),message=[...(group&&msg.rawEventType==='GROUP_AT_MESSAGE_CREATE'?[{type:'at',data:{qq:this.self}}]:[]),{type:'text',data:{text}}];
  for(const a of (msg.attachments||[]).slice(0,5))if(/^image\//.test(a.content_type)&&typeof a.url==='string'){try{const u=new URL(a.url.startsWith('//')?'https:'+a.url:a.url);if(u.protocol==='https:'&&!u.username&&!u.password)message.push({type:'image',data:{url:u.href}});}catch{}}
  const event={post_type:'message',message_type:group?'group':'private',self_id:this.self,user_id:user,...(group?{group_id:room}:{}),message_id:id,message,sender:{nickname:String(msg.senderName||'官方用户 '+user).slice(0,80)},official:true};
  this.routes.set(event,{route,expires:this.clock()+240000});this.remember(event);return event;
 }
 async call(action){if(action==='get_login_info')return{user_id:this.self,nickname:'官方机器人 '+this.self};if(action==='get_status')return{online:this.online};throw unsupported();}
 async send(event,segments){
  if(!this.active||!this.online)throw Object.assign(Error('官方消息通道未连接'),{code:'OFFICIAL_OFFLINE'});
  // Service enrichment and the scheduler copy events, so match the receipt to the
  // original normalized message id as well as account, conversation and speaker.
  const key=[event.self_id,event.message_type,event.group_id||'',event.user_id,event.message_id].join(':');
  const receipt=this.routes.get(event)||this.receipts.get(key);
  if(String(event.self_id)!==this.self||!receipt||this.clock()>receipt.expires)throw Object.assign(Error('官方回复上下文已过期或不是本轮消息；本版本不主动推送'),{code:'OFFICIAL_REPLY_EXPIRED'});
  if(!Array.isArray(segments)||segments.some(s=>!['text','image','at','reply'].includes(s.type)))throw unsupported();
  const text=segments.filter(s=>s.type==='text').map(s=>String(s.data?.text||'')).join('\n'),images=segments.filter(s=>s.type==='image');if(images.length>1)throw unsupported();
  let source;if(images.length){const value=images[0].data?.file;if(typeof value!=='string'||!value.startsWith('base64://')||value.length>11200000)throw unsupported();source={buffer:Buffer.from(value.slice(9),'base64')};if(!source.buffer.length||source.buffer.length>8*1024*1024)throw unsupported();}
  if(!source&&!text.trim())throw unsupported();
  let result;try{result=source?(await this.client.sendImage(receipt.route,source,{content:text||undefined})).message:await this.client.sendText(receipt.route,text);}catch(e){throw Object.assign(Error('官方消息提交未确认；请先核对QQ消息、发送配额与URL白名单，不自动重发'),{publicMessage:'官方接口未确认送达，不自动重发；请查看权限、配额与消息内容限制',code:'OFFICIAL_SEND_FAILED',retcode:e?.bizCode??e?.httpStatus});}
  if(typeof result?.id!=='string'||!result.id)throw Object.assign(Error('官方未返回消息ID，结果未知，不自动重发'),{code:'OFFICIAL_NO_MESSAGE_ID'});this.onSent();return{message_id:await this.ids.id('message',result.id)};
 }
 remember(event){const receipt=this.routes.get(event);if(!receipt)return;this.receipts.set([event.self_id,event.message_type,event.group_id||'',event.user_id,event.message_id].join(':'),receipt);for(const[k,v]of this.receipts)if(v.expires<this.clock())this.receipts.delete(k);while(this.receipts.size>1000)this.receipts.delete(this.receipts.keys().next().value);}
 close(){this.active=false;this.online=false;this.client?.stop();this.client=null;this.receipts.clear();}
}
