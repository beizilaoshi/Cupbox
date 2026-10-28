const id=v=>/^\d{5,16}$/.test(String(v));
const clean=(value,fallback='')=>String(value??fallback).replace(/[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,80)||fallback;
export const NOTICE_PLACEHOLDERS=[
 ['用户','用户 QQ 号（兼容旧模板）'],['QQ','用户 QQ 号'],['昵称','用户昵称，获取失败时显示 QQ 号'],['群名片','群名片，无名片时显示昵称或 QQ 号'],['@用户','入群时真实 @，离群时显示昵称和 QQ 号'],['群号','事件所在群号'],['群名','群名称，获取失败时显示群号'],['群人数','协议返回的当前人数，获取不到显示未知'],['操作者','邀请者或移出者的昵称，无信息时显示未知'],['操作者QQ','邀请者或移出者的 QQ，无信息时显示未知'],['机器人','机器人昵称，获取失败时显示机器人 QQ'],['机器人QQ','当前机器人 QQ 号'],['日期','事件日期（北京时间）'],['时间','事件时间，时:分:秒（北京时间）'],['星期','事件星期'],['事件','入群 / 主动退群 / 被移出群聊'],['入群方式','管理员批准 / 邀请入群 / 入群'],['离群原因','主动退群 / 被移出群聊 / 离群']
].map(([key,description])=>({token:'{'+key+'}',key,description}));
const supported=new Set(NOTICE_PLACEHOLDERS.map(p=>p.key));
export const noticeKind=event=>event.notice_type==='group_increase'?'入群':event.sub_type==='kick'||event.sub_type==='kick_me'?'被移出群聊':event.sub_type==='leave'?'主动退群':'离群';
export function noticeValues(event,metadata={},now=Date.now()){
 const user=String(event.user_id),group=String(event.group_id),self=String(event.self_id),operator=id(event.operator_id)?String(event.operator_id):'未知',kind=noticeKind(event);
 const time=Number.isFinite(event.time)?event.time*1000:now;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(time).map(p=>[p.type,p.value]));
 const nickname=clean(metadata.nickname,user),card=clean(metadata.card,nickname);
 return{用户:user,QQ:user,昵称:nickname,群名片:card,'@用户':`${card}（${user}）`,群号:group,群名:clean(metadata.groupName,group),群人数:Number.isInteger(metadata.memberCount)&&metadata.memberCount>=0?String(metadata.memberCount):'未知',操作者:clean(metadata.operatorName,operator),操作者QQ:operator,机器人:clean(metadata.botName,self),机器人QQ:self,日期:`${parts.year}-${parts.month}-${parts.day}`,时间:`${parts.hour}:${parts.minute}:${parts.second}`,星期:new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',weekday:'long'}).format(time),事件:kind,入群方式:event.notice_type==='group_increase'?({approve:'管理员批准',invite:'邀请入群'}[event.sub_type]||'入群'):'不适用',离群原因:event.notice_type==='group_decrease'?kind:'不适用'};
}
// Parse once: placeholders occurring in nicknames/group names stay literal and never become segments.
export function renderNotice(template,event,metadata={},now=Date.now()){
 if(typeof template!=='string'||template.length>500)throw Error('欢迎/欢送模板最多500字');
 const values=noticeValues(event,metadata,now),segments=[],unknown=[];let offset=0;
 const text=value=>{if(!value)return;const prior=segments.at(-1);if(prior?.type==='text')prior.data.text+=value;else segments.push({type:'text',data:{text:value}});};
 for(const match of template.matchAll(/\{([^{}\n]{1,30})\}/g)){
  text(template.slice(offset,match.index));const key=match[1];
  if(key==='@用户'&&event.notice_type==='group_increase'&&id(event.user_id))segments.push({type:'at',data:{qq:String(event.user_id)}});
  else if(supported.has(key))text(values[key]);else{unknown.push(match[0]);text(match[0]);}
  offset=match.index+match[0].length;
 }
 text(template.slice(offset));const rendered=segments.map(s=>s.type==='at'?`@${values.群名片}（${event.user_id}）`:s.data.text).join('');if(rendered.length>4000)throw Error('占位符展开后超过4000字，请缩短模板');return{segments,unknown:[...new Set(unknown)],text:rendered};
}
export function previewNotice(p){
 if(!p||!['welcome','farewell','kick'].includes(p.kind)||typeof p.template!=='string'||p.template.length>500)throw Error('模板预览参数无效');
 const event={self_id:'123456',user_id:'654321',group_id:'1005188752',operator_id:'777777',notice_type:p.kind==='welcome'?'group_increase':'group_decrease',sub_type:p.kind==='welcome'?'invite':p.kind==='kick'?'kick':'leave'};
 return{...renderNotice(p.template,event,{nickname:'小梦',card:'小梦同学',groupName:'Cupbox 交流群',memberCount:128,operatorName:'群管理员',botName:'筑梦喵'}),placeholders:NOTICE_PLACEHOLDERS};
}
export async function resolveNoticeMetadata(ctx,event,template){
 const needs=keys=>keys.some(key=>template.includes('{'+key+'}')),metadata={},jobs=[];
 const get=(action,params,apply)=>jobs.push((async()=>{try{ctx.check();const value=await ctx.bot.call(action,params,{timeoutMs:12000});ctx.check();if(value)apply(value);}catch(error){ctx.check();}})());
 if(needs(['昵称','群名片','@用户']))get('get_group_member_info',{group_id:String(event.group_id),user_id:String(event.user_id),no_cache:true},v=>{metadata.nickname=v.nickname;metadata.card=v.card;});
 if(needs(['群名','群人数']))get('get_group_info',{group_id:String(event.group_id)},v=>{metadata.groupName=v.group_name;metadata.memberCount=v.member_count;});
 if(needs(['操作者'])&&id(event.operator_id))get('get_group_member_info',{group_id:String(event.group_id),user_id:String(event.operator_id),no_cache:true},v=>{metadata.operatorName=v.card||v.nickname;});
 if(needs(['机器人']))get('get_group_member_info',{group_id:String(event.group_id),user_id:String(event.self_id),no_cache:true},v=>{metadata.botName=v.card||v.nickname;});
 await Promise.all(jobs);ctx.check();return metadata;
}
