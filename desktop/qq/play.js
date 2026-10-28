import {createHash,randomInt,randomUUID} from 'node:crypto';
import {ruleFor} from './engine.js';
import {backgroundTime} from './background.js';
import {sleeping} from './sleep.js';
import {inspectUntrusted,outputRisk} from './security.js';
import {MORE_FEATURES,initMoreState,trimMoreState,executeMore,moreHelp} from './play-more.js';

const FEATURES={玩法帮助:null,签到:'playCheckin',积分:'playCheckin',签到榜:'playCheckin',今日运势:'playFortune',掷骰:'playDice',帮我选:'playChoice',发起投票:'playPoll',投票:'playPoll',查看投票:'playPoll',结束投票:'playPoll'};
Object.assign(FEATURES,MORE_FEATURES);
export function parsePlay(event,c){
 const parts=Array.isArray(event.message)?event.message:[],text=parts.filter(s=>s.type==='text').map(s=>s.data?.text||'').join('').trim();
 if(parts.some(s=>!['text','at','reply'].includes(s.type)||s.type==='at'&&String(s.data?.qq)!==String(event.self_id)))return null;
 if(!text.startsWith(c.playPrefix))return null;
 const input=text.slice(c.playPrefix.length).trim(),match=/^(\S+)(?:\s+([\s\S]*))?$/.exec(input);
 if(!match||!Object.hasOwn(FEATURES,match[1]))return null;
 return{command:match[1],args:(match[2]||'').trim(),mentioned:parts.some(s=>s.type==='at'&&String(s.data?.qq)===String(event.self_id))};
}
const textOK=s=>Boolean(s.trim())&&s.length<=400&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s)&&!inspectUntrusted(s).blocked&&!outputRisk(s);
const digest=s=>createHash('sha256').update(s).digest();
const fresh=()=>({version:1,checkins:[],polls:[],seen:[]});
const short=s=>String(s).slice(0,60);
const pollText=p=>`${p.closed?'投票已结束':'进行中的投票'}：${p.title}\n${p.options.map((s,i)=>`${i+1}. ${s} · ${Object.values(p.votes).filter(v=>v===i+1).length} 票`).join('\n')}\n共 ${Object.keys(p.votes).length} 人参与 · 截止 ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(p.endsAt)}（北京时间）`;

// These explicit commands never invoke the chat model. Data stays in this account's local store.
export class QQPlay{
 constructor(service,{clock=Date.now,roll=randomInt}={}){Object.assign(this,{service,clock,roll});this.cooldowns=new Map();}
 async receive(event){
  const s=this.service,c=s.config;if(!c.playEnabled||event.post_type!=='message')return null;
  const p=parsePlay(event,c);if(!p)return null;
  if(!s.started||!s.online||s.connectionState!=='online')return{skipped:'机器人尚未在线'};
  if(FEATURES[p.command]&&!c[FEATURES[p.command]])return{skipped:'此互动玩法未开启'};
  if(event.message_type==='group'&&c.playRequireMention&&!p.mentioned)return{skipped:'互动玩法需要 @ 机器人'};
  const scoped={...event,message:[...event.message,{type:'at',data:{qq:String(event.self_id)}}]};
  if(!ruleFor(scoped,{...c,groupAt:true}).reply||sleeping(c,this.clock()))return{skipped:'当前会话或时段不允许互动玩法'};
  if(p.args.length>600||inspectUntrusted(p.args).blocked||outputRisk(p.args))return{skipped:'玩法参数过长或不适合处理'};
  const room=[event.self_id,event.message_type,event.message_type==='group'?event.group_id:event.user_id].join(':'),user=String(event.user_id),cooldown=room+':'+user;
  if(this.clock()-(this.cooldowns.get(cooldown)??-Infinity)<c.playCooldown*1000)return{skipped:'互动玩法冷却中'};
  this.cooldowns.delete(cooldown);this.cooldowns.set(cooldown,this.clock());while(this.cooldowns.size>2000)this.cooldowns.delete(this.cooldowns.keys().next().value);
  try{return await s.extras.operation(async({signal,check})=>{
   const body=await s.store.change(async()=>{
    check();const state=await s.store.json('play-data.json',fresh());
    if(state?.version!==1||!['checkins','polls','seen'].every(key=>Array.isArray(state[key])))throw Error('玩法数据格式异常');
    initMoreState(state);
    const now=this.clock(),key=event.message_id===undefined?null:room+':'+event.message_id;
    state.seen=state.seen.filter(row=>now-row.at<86400000).slice(-999);
    if(key&&state.seen.some(row=>row.key===key))return null;
    // Reserve a shared delivery slot before modifying persistent game state.
    s.extras.rate();
    const result=this.execute(p,state,{event,c,room,user,now});
    if(key)state.seen.push({key,at:now});
    state.checkins=state.checkins.slice(-5000);state.polls=state.polls.slice(-200);trimMoreState(state);check();await s.store.write('play-data.json',state);return result;
   });
   if(!body)return{skipped:'重复玩法事件'};
   const filtered=await s.extras.filtered(body,signal);check();
   await s.send(event,[...(event.message_type==='group'?[{type:'at',data:{qq:user}},{type:'text',data:{text:'\n'}}]:[]),{type:'text',data:{text:filtered}}],signal);
   s.log('info','play','互动玩法已回复',{command:p.command,conversation:room});return{sent:true,play:true};
  });}catch(error){s.log('warn','play','互动玩法处理未完成，不自动重发',{code:error.code||'PLAY_FAILED',reason:error.publicMessage||error.message});return{skipped:'互动玩法未完成，请查看运行日志'};}
 }
 execute({command,args},state,{event,c,room,user,now}){
  const prefix=c.playPrefix,date=backgroundTime(now).date;
  if(command==='玩法帮助')return '互动玩法（群聊'+(c.playRequireMention?'需 @ 机器人':'可直接发送')+'）\n'+[
   c.playCheckin&&`${prefix}签到 / ${prefix}积分 / ${prefix}签到榜`,c.playFortune&&`${prefix}今日运势`,c.playDice&&`${prefix}掷骰 2d6`,c.playChoice&&`${prefix}帮我选 米饭 | 面条`,c.playPoll&&`${prefix}发起投票 午饭吃什么 | 米饭 | 面条\n${prefix}投票 1 / ${prefix}查看投票 / ${prefix}结束投票`,...moreHelp(c)
  ].filter(Boolean).join('\n')+'\n签到与投票按账号、会话保存，积分不会改变好感度。';
  if(Object.hasOwn(MORE_FEATURES,command))return executeMore({command,args},state,{event,c,room,user,now},{roll:this.roll,textOK});
  if(['签到','积分','签到榜'].includes(command)){
   let record=state.checkins.find(r=>r.room===room&&r.user===user);
   if(command==='签到榜'){
    const rows=state.checkins.filter(r=>r.room===room).sort((a,b)=>b.points-a.points).slice(0,10);
    return rows.length?'本会话签到榜\n'+rows.map((r,i)=>`${i+1}. ${r.name} · ${r.points} 积分 · ${r.total} 天`).join('\n'):'本会话还没有签到记录。';
   }
   if(command==='积分')return record?`本会话积分：${record.points}\n累计签到 ${record.total} 天，连续 ${record.streak} 天。`:'本会话还没有签到记录，发送“'+prefix+'签到”开始吧。';
   if(record?.date===date)return`今天已经签到啦，获得 ${record.award} 积分。\n总积分 ${record.points}，连续 ${record.streak} 天。`;
   const yesterday=backgroundTime(now-86400000).date,streak=record?.date===yesterday?record.streak+1:1,award=5+digest(`${event.self_id}:${user}:${date}:checkin`)[0]%11;
   if(!record){record={room,user,points:0,total:0};state.checkins.push(record);}
   const name=short(event.sender?.card||event.sender?.nickname||'用户'+user.slice(-4));
   Object.assign(record,{date,streak,award,name:textOK(name)?name:'用户'+user.slice(-4),points:record.points+award,total:record.total+1});
   return`签到成功！+${award} 积分\n连续 ${streak} 天，累计 ${record.total} 天，总积分 ${record.points}。`;
  }
  if(command==='今日运势'){
   const bytes=digest(`${event.self_id}:${user}:${date}:fortune`),score=bytes[0]%101;
   const tips=['给自己留一点休息时间','试着完成一件小事','和熟悉的人聊两句','整理一下桌面','听一首喜欢的歌','做一点喜欢的事情'];
   return`${date} · 今日运势 ${score}/100\n幸运色：${['晴空蓝','薄荷绿','樱花粉','暖阳橙','月光白','薰衣草紫'][bytes[1]%6]}\n今日小建议：${tips[bytes[2]%tips.length]}。\n仅供娱乐，同一账号下今天的结果固定。`;
  }
  if(command==='掷骰'){
   const match=/^(\d{1,2})d(\d{1,4})$/i.exec(args||'1d6');if(!match)return`用法：${prefix}掷骰 2d6（1～10枚、每枚2～1000面）`;
   const count=Number(match[1]),sides=Number(match[2]);if(count<1||count>10||sides<2||sides>1000)return'骰子范围：1～10枚，每枚2～1000面。';
   const values=Array.from({length:count},()=>this.roll(1,sides+1));return`${count}d${sides} → ${values.join(' + ')} = ${values.reduce((a,b)=>a+b,0)}`;
  }
  if(command==='帮我选'){
   const options=[...new Set(args.split(/[|｜]/).map(x=>x.trim()).filter(Boolean))];
   if(options.length<2||options.length>20||options.some(x=>x.length>80||!textOK(x)))return`用法：${prefix}帮我选 米饭 | 面条（2～20个不同选项，每项最多80字）`;
   return'我抽到的是：'+options[this.roll(0,options.length)]+'\n随机选择，仅供参考。';
  }
  if(event.message_type!=='group')return'投票功能在群聊中使用。';
  let poll=state.polls.find(r=>r.room===room);if(poll&&!poll.closed&&now>=poll.endsAt)poll.closed=true;
  if(command==='发起投票'){
   if(poll&&!poll.closed)return'本群已有进行中的投票，请先结束或等待到期。\n'+pollText(poll);
   const [title,...options]=args.split(/[|｜]/).map(x=>x.trim());
   if(!title||title.length>100||!textOK(title)||options.length<2||options.length>8||new Set(options).size!==options.length||options.some(x=>!textOK(x)||x.length>60))return`用法：${prefix}发起投票 主题 | 选项一 | 选项二（2～8个不同选项）`;
   poll={id:randomUUID(),room,creator:user,title,options,votes:{},endsAt:now+c.playPollMinutes*60000,closed:false};state.polls=state.polls.filter(r=>r.room!==room);state.polls.push(poll);
   return pollText(poll)+`\n发送“${prefix}投票 1”参与，每人一票，再次投票可修改。`;
  }
  if(!poll)return'本群还没有投票，发送“'+prefix+'发起投票 主题 | 选项一 | 选项二”创建。';
  if(command==='投票'){
   if(poll.closed)return pollText(poll);
   if(!/^[1-8]$/.test(args)||Number(args)>poll.options.length)return'请填写有效选项编号，例如“'+prefix+'投票 1”。';
   if(!Object.hasOwn(poll.votes,user)&&Object.keys(poll.votes).length>=2000)return'本次投票已达到2000人上限。';
   const previous=poll.votes[user];poll.votes[user]=Number(args);return(previous?'已修改投票':'投票成功')+'。\n'+pollText(poll);
  }
  if(command==='结束投票'&&!poll.closed){
   if(user!==poll.creator&&!c.ownerIds.includes(user)&&!['owner','admin'].includes(event.sender?.role))return'只有发起人、群主、管理员或机器人主人可以结束投票。';
   poll.closed=true;
  }
  return pollText(poll);
 }
}
