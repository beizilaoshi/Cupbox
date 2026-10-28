import {createHash,randomUUID} from 'node:crypto';
import {moderationConfig} from './moderation-settings.js';
import {renderNotice,previewNotice,resolveNoticeMetadata} from './notice-template.js';
const id=v=>/^\d{5,16}$/.test(String(v)),messageId=v=>/^-?\d{1,24}$/.test(String(v));
const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/[\u200b-\u200f\u2060\ufeff]/g,'');
const segments=e=>Array.isArray(e.message)?e.message:typeof e.message==='string'?[{type:'text',data:{text:e.message}}]:[];
const textOf=e=>segments(e).filter(s=>s?.type==='text').map(s=>String(s.data?.text||'')).join('');
const rank=r=>({owner:2,admin:1,member:0}[r]??-1);
const unknown=e=>['ONEBOT_TIMEOUT','ONEBOT_DISCONNECTED','ONEBOT_NO_MESSAGE_ID'].includes(e?.code);
export function moderationReasons(event,c,{history=[],now=Date.now()}={}){
 const parts=segments(event),text=normalize(textOf(event)),reasons=[];
 if(c.gmWordsEnabled&&c.gmWords.some(w=>c.gmMatchMode==='exact'?text.trim()===normalize(w):text.includes(normalize(w))))reasons.push('命中自定义违禁词');
 if(c.gmBlacklistEnabled&&c.gmBlacklist.includes(String(event.user_id)))reasons.push('群管黑名单用户');
 if(c.gmFlood&&history.filter(r=>now-r.at<c.gmFloodSeconds*1000).length+1>=c.gmFloodLimit)reasons.push('短时间连续刷屏');
 const fingerprint=createHash('sha256').update(JSON.stringify(parts.filter(s=>s?.type!=='reply').map(s=>s.type==='text'?['text',normalize(s.data?.text||'')]:[s.type,s.data?.file||s.data?.qq||'']))).digest('hex');
 if(c.gmRepeat&&history.filter(r=>now-r.at<c.gmRepeatSeconds*1000&&r.fingerprint===fingerprint).length+1>=c.gmRepeatLimit)reasons.push('重复消息刷屏');
 if(c.gmLinks){const urls=text.match(/(?:https?:\/\/|www\.)[^\s<>"'，。！；]+/giu)||[];if(parts.some(s=>['json','xml','share'].includes(s.type))||urls.some(raw=>{try{const host=new URL(raw.startsWith('www.')?'https://'+raw:raw).hostname;return!c.gmAllowedDomains.some(d=>host===d||host.endsWith('.'+d));}catch{return true;}}))reasons.push('未允许的链接或分享卡片');}
 if(c.gmFiles&&parts.some(s=>s.type==='file'))reasons.push('禁止发送文件');
 if(c.gmImages&&parts.some(s=>s.type==='image'))reasons.push('禁止发送图片');
 if(c.gmMentions&&(parts.some(s=>s.type==='at'&&s.data?.qq==='all')||new Set(parts.filter(s=>s.type==='at').map(s=>String(s.data?.qq))).size>c.gmMentionLimit))reasons.push('过量提及群成员');
 if(c.gmLongText&&[...text].length>c.gmTextLimit)reasons.push('消息文字过长');
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(now));
 if(c.gmQuiet&&c.gmQuietStart!==c.gmQuietEnd&&(c.gmQuietStart<c.gmQuietEnd?hour>=c.gmQuietStart&&hour<c.gmQuietEnd:hour>=c.gmQuietStart||hour<c.gmQuietEnd))reasons.push('群聊安静时段');
 return{reasons,fingerprint};
}
export class GroupModeration{
 constructor(service){this.service=service;this.queue=Promise.resolve();this.history=new Map();this.warningAt=new Map();this.actionTimes=[];this.epoch=0;}
 cancel(){this.epoch++;this.history.clear();this.warningAt.clear();}
 previewNotice(p){return previewNotice(p);}
 enqueue(fn){const epoch=this.epoch,task=this.queue.catch(()=>{}).then(()=>epoch===this.epoch?fn():{skipped:'群管任务已取消'});this.queue=task;return task;}
 supported(){return['napcat','onebot'].includes(this.service.config.connectionMode);}
 context(groupId){const s=this.service,c=moderationConfig(s.config,groupId);if(!c||!this.supported()||!s.started||!s.online||s.connectionState!=='online'||!s.bot)return null;const bot=s.bot,session=s.session,epoch=this.epoch,revision=s.revision;return{c,bot,check:()=>{if(this.epoch!==epoch||s.session!==session||s.bot!==bot||s.revision!==revision||!s.started||!s.online||!moderationConfig(s.config,groupId))throw Error('群管任务已取消：连接或设置已变化');}};}
 async permissions(ctx,groupId,userId){ctx.check();const login=await ctx.bot.call('get_login_info');ctx.check();if(!id(login?.user_id))throw Error('未确认机器人账号');const self=String(login.user_id),own=await ctx.bot.call('get_group_member_info',{group_id:String(groupId),user_id:self,no_cache:true});ctx.check();if(rank(own?.role)<1)throw Error('机器人需要群管理员或群主权限');if(userId){if(String(userId)===self||this.service.config.ownerIds.includes(String(userId))||ctx.c.gmExemptUsers.includes(String(userId)))throw Error('该用户属于群管豁免名单');const member=await ctx.bot.call('get_group_member_info',{group_id:String(groupId),user_id:String(userId),no_cache:true});ctx.check();if(rank(member?.role)!==0)throw Error('群主、管理员或身份未确认的成员不执行处罚');}return self;}
 async record(row){await this.service.store.change(async()=>{const rows=await this.service.store.json('moderation-log.json',[]),old=rows.find(r=>r.id===row.id);if(old)Object.assign(old,row);else rows.push(row);await this.service.store.write('moderation-log.json',rows.slice(-500));});}
 async runAction(ctx,row,name,fn){ctx.check();const now=Date.now();this.actionTimes=this.actionTimes.filter(t=>now-t<60000);if(this.actionTimes.length>=30)throw Error('群管每分钟操作上限30次');this.actionTimes.push(now);row.actions.push({name,status:'pending'});await this.record(row);ctx.check();const action=row.actions.at(-1);try{const result=await fn();action.status='ok';await this.record(row);ctx.check();return result;}catch(error){action.status=unknown(error)?'unknown':'failed';action.reason=error.code||'ACTION_FAILED';await this.record(row);ctx.check();return null;}}
 async snapshot(){return{supported:this.supported(),logs:(await this.service.store.json('moderation-log.json',[])).slice(-100).reverse(),strikes:await this.service.store.json('moderation-strikes.json',{})};}
 reset(p){if(!id(p?.groupId)||!id(p?.userId))throw Error('请填写群号和用户QQ号');return this.service.store.change(async()=>{const strikes=await this.service.store.json('moderation-strikes.json',{});for(const key of Object.keys(strikes))if(key.endsWith(':'+p.groupId+':'+p.userId))delete strikes[key];await this.service.store.write('moderation-strikes.json',strikes);return true;});}
 async strikes(key,windowMinutes,increment=false){return this.service.store.change(async()=>{const state=await this.service.store.json('moderation-strikes.json',{}),now=Date.now(),old=state[key]||{},times=(old.times||[]).filter(t=>now-t<windowMinutes*60000);if(increment)times.push(now);const value={...old,times:times.slice(-1000),updated:now};state[key]=value;await this.service.store.write('moderation-strikes.json',Object.fromEntries(Object.entries(state).filter(([,v])=>now-v.updated<30*86400000).slice(-2000)));return value;});}
 async markPenalty(key,kind,count){await this.service.store.change(async()=>{const state=await this.service.store.json('moderation-strikes.json',{});if(state[key]){state[key][kind]=count;state[key][kind+'At']=Date.now();await this.service.store.write('moderation-strikes.json',state);}});}
 async receive(event){if(Number.isFinite(event.time)&&(Date.now()-event.time*1000>300000||event.time*1000-Date.now()>60000))return null;const c=moderationConfig(this.service.config,event.group_id);if(!c||!this.supported()||!id(event.group_id)||!id(event.user_id)||String(event.user_id)===String(event.self_id))return null;
  if(event.post_type==='notice'&&['group_increase','group_decrease'].includes(event.notice_type))return this.enqueue(()=>this.notice(event));
  if(event.post_type!=='message'||event.message_type!=='group'||!messageId(event.message_id))return null;
  if(c.gmExemptUsers.includes(String(event.user_id))||this.service.config.ownerIds.includes(String(event.user_id)))return null;
  return this.enqueue(async()=>{try{return await this.inspect(event);}catch(error){const row=(await this.service.store.json('moderation-log.json',[])).find(r=>r.id===[event.self_id,event.group_id,event.message_id].join(':'));if(row?.status==='processing'){row.status='partial';row.note=String(error.message).slice(0,200);await this.record(row);}throw error;}});
 }
 async inspect(event){const ctx=this.context(event.group_id);if(!ctx)return null;const {c}=ctx,key=[event.self_id,event.group_id,event.user_id].join(':'),now=Date.now(),history=(this.history.get(key)||[]).filter(r=>now-r.at<300000);if(history.some(r=>r.messageId===String(event.message_id)))return{moderated:true,skipped:'重复群消息事件'};const {reasons,fingerprint}=moderationReasons(event,c,{history,now});history.push({at:now,fingerprint,messageId:String(event.message_id)});this.history.delete(key);this.history.set(key,history.slice(-100));while(this.history.size>2000)this.history.delete(this.history.keys().next().value);if(!reasons.length)return null;
  const row={id:[event.self_id,event.group_id,event.message_id].join(':'),at:now,account:String(event.self_id),groupId:String(event.group_id),userId:String(event.user_id),reasons,actions:[],status:c.gmDryRun?'preview':'processing'};
  const previous=await this.service.store.json('moderation-log.json',[]);if(previous.some(r=>r.id===row.id))return{moderated:true,skipped:'这条消息已有群管处理记录'};
  try{const self=await this.permissions(ctx,event.group_id,event.user_id);if(self!==String(event.self_id))throw Error('消息账号与当前连接不一致');}catch(error){ctx.check();row.status='skipped';row.note=error.message;await this.record(row);return null;}
  await this.record(row);if(c.gmDryRun)return null;
  if(c.gmRecall)await this.runAction(ctx,row,'recall',()=>ctx.bot.call('delete_msg',{message_id:String(event.message_id)}));
  const counted=!c.gmRecall||row.actions.some(a=>a.name==='recall'&&a.status==='ok'),strike=await this.strikes(key,c.gmWindowMinutes,counted),count=strike.times.length;row.count=count;
  if(c.gmWarn&&now-(this.warningAt.get(key)||0)>=c.gmWarningCooldown*1000){this.warningAt.set(key,now);const text=c.gmWarning.replaceAll('{原因}',()=>reasons.join('、')).replaceAll('{次数}',()=>String(count)).replaceAll('{用户}',()=>String(event.user_id));await this.runAction(ctx,row,'warn',()=>ctx.bot.send(event,[{type:'at',data:{qq:String(event.user_id)}},{type:'text',data:{text:' '+text}}]));}
  const since=(kind)=>strike[kind+'At']&&now-strike[kind+'At']<c.gmWindowMinutes*60000;
  if(counted&&c.gmKick&&count>=c.gmKickThreshold&&!since('kick')){await this.permissions(ctx,event.group_id,event.user_id);await this.runAction(ctx,row,'kick',()=>ctx.bot.call('set_group_kick',{group_id:String(event.group_id),user_id:String(event.user_id),reject_add_request:false}));if(['ok','unknown'].includes(row.actions.at(-1)?.status))await this.markPenalty(key,'kick',count);}
  else if(counted&&c.gmMute&&(since('mute')?strike.times.filter(t=>t>strike.muteAt).length:count)>=c.gmThreshold){await this.permissions(ctx,event.group_id,event.user_id);await this.runAction(ctx,row,'mute',()=>ctx.bot.call('set_group_ban',{group_id:String(event.group_id),user_id:String(event.user_id),duration:c.gmMuteSeconds}));if(['ok','unknown'].includes(row.actions.at(-1)?.status))await this.markPenalty(key,'mute',count);}
  row.status=row.actions.some(a=>a.status==='unknown')?'unknown':row.actions.some(a=>a.status==='failed')?'partial':'done';await this.record(row);this.service.log('info','moderation','群管规则已处理',{groupId:row.groupId,userId:row.userId,status:row.status,count});return{moderated:true,skipped:'群管已处理，不再调用聊天模型'};
 }
 async notice(event){
  const ctx=this.context(event.group_id);if(!ctx)return null;
  const {c}=ctx,joining=event.notice_type==='group_increase',kicked=event.sub_type==='kick'||event.sub_type==='kick_me';
  if(!(joining?c.gmWelcome:c.gmFarewell))return null;
  if(!joining&&(c.gmFarewellFilter==='leave'&&event.sub_type!=='leave'||c.gmFarewellFilter==='kick'&&!kicked))return null;
  const row={id:['notice',event.self_id,event.group_id,event.user_id,event.notice_type,event.time].join(':'),at:Date.now(),account:String(event.self_id),groupId:String(event.group_id),userId:String(event.user_id),reasons:[joining?'入群欢迎':kicked?'移出欢送':'退群欢送'],actions:[],status:'processing'};
  if((await this.service.store.json('moderation-log.json',[])).some(r=>r.id===row.id))return{moderated:true};
  const self=await this.permissions(ctx,event.group_id);if(self!==String(event.self_id))throw Error('通知账号与当前连接不一致');
  await this.record(row);
  if(!c.gmDryRun){
   const template=joining?c.gmWelcomeText:kicked&&c.gmKickFarewellText?c.gmKickFarewellText:c.gmFarewellText;
   const metadata=await resolveNoticeMetadata(ctx,event,template);ctx.check();const {segments}=renderNotice(template,event,metadata);
   await this.runAction(ctx,row,joining?'welcome':'farewell',()=>ctx.bot.send({message_type:'group',group_id:event.group_id},segments));
  }
  row.status=c.gmDryRun?'preview':row.actions[0]?.status||'done';await this.record(row);return{moderated:true};
 }

 manual(p){if(!p||!id(p.groupId)||!['mute','unmute','kick','wholeMute','wholeUnmute','recall'].includes(p.action)||typeof p.requestId!=='string'||! /^[\w-]{8,80}$/.test(p.requestId))throw Error('群管操作参数无效');if(['mute','unmute','kick'].includes(p.action)&&!id(p.userId)||p.action==='recall'&&!messageId(p.messageId))throw Error('请填写有效用户QQ号或消息ID');const duration=Number(p.duration);if(p.action==='mute'&&(!Number.isInteger(duration)||duration<60||duration>2592000))throw Error('禁言时长应为60秒～30天');return this.enqueue(async()=>{const ctx=this.context(p.groupId);if(!ctx||!ctx.c.gmManual)throw Error('请开启群管和手动管理，并将目标群加入管理名单');if(ctx.c.gmDryRun)throw Error('观察模式不执行手动管理操作');const self=await this.permissions(ctx,p.groupId,['mute','unmute','kick'].includes(p.action)?p.userId:undefined),row={id:'manual:'+self+':'+p.requestId,at:Date.now(),account:self,groupId:String(p.groupId),userId:String(p.userId||''),reasons:['本机手动管理'],actions:[],status:'processing'};if((await this.service.store.json('moderation-log.json',[])).some(r=>r.id===row.id))throw Error('这条操作已有执行记录，不会重复提交');
  if(p.action==='recall'){const msg=await ctx.bot.call('get_msg',{message_id:String(p.messageId)});ctx.check();if(String(msg?.group_id)!==String(p.groupId)||!id(msg?.sender?.user_id||msg?.user_id))throw Error('消息不属于目标群或无法确认发送者');await this.permissions(ctx,p.groupId,msg.sender?.user_id||msg.user_id);}
  const table={mute:['set_group_ban',{group_id:String(p.groupId),user_id:String(p.userId),duration}],unmute:['set_group_ban',{group_id:String(p.groupId),user_id:String(p.userId),duration:0}],kick:['set_group_kick',{group_id:String(p.groupId),user_id:String(p.userId),reject_add_request:false}],wholeMute:['set_group_whole_ban',{group_id:String(p.groupId),enable:true}],wholeUnmute:['set_group_whole_ban',{group_id:String(p.groupId),enable:false}],recall:['delete_msg',{message_id:String(p.messageId)}]},[action,params]=table[p.action];await this.runAction(ctx,row,p.action,()=>ctx.bot.call(action,params));row.status=row.actions[0]?.status||'failed';await this.record(row);return{status:row.status};});}
}
