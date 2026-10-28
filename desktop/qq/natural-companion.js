import {safeMemoryText,externalData} from './security.js';

const clean=(value,max=2000)=>typeof value==='string'&&safeMemoryText(value)?value.slice(0,max):'';
const date=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
export function sharedMemories(value){
  return(Array.isArray(value)?value:[]).filter(m=>m&&typeof m.id==='string'&&m.id.length<=100&&typeof m.text==='string'&&m.text.trim()&&m.text.length<=300&&safeMemoryText(m.text)&&Number.isFinite(Date.parse(m.at))&&['conversation','local-editor'].includes(m.source)).slice(-20).map(m=>({id:m.id,text:m.text,at:m.at,source:m.source}));
}
export function rememberTogether(state,evidence,id,now){
  if(!safeMemoryText(evidence)||!/一起|我们|咱们/.test(evidence)||!/刚才|上次|之前|今天|已经|完成|做完|一起.{0,20}(?:了|过)/.test(evidence)||/明天|下次|以后|打算|想要|计划|下周|后天|如果|假如|他说|她说|引用|[“”「」『』"`]/.test(evidence))return null;
  const list=sharedMemories(state.sharedMemories);if(list.some(m=>m.text===evidence))return null;
  return [...list,{id,text:evidence.slice(0,300),at:new Date(now).toISOString(),source:'conversation'}].slice(-20);
}
export function companionPresence(state,status,now=Date.now()){
  const familiar=status.score>=40&&status.trust>=40&&!status.safeMinor&&!state.companionOptOut&&state.relationshipStatus!=='separated';
  const address=clean(familiar?state.familiarAddress||state.userLabel:state.userLabel,80)||'你';
  let anniversary='';if(Number.isFinite(state.createdAt)&&state.createdAt>0&&state.createdAt<=now){const start=date(state.createdAt),today=date(now),years=Number(today.slice(0,4))-Number(start.slice(0,4));if(years>0&&start.slice(5)===today.slice(5))anniversary=`相识${years}周年`;}
  return{address,anniversary,returning:Number(state.lastInteractionAt)>0&&now-state.lastInteractionAt>=3*86400000};
}
export function naturalCompanionPrompt(state,status,prompt,now=Date.now()){
  const presence=companionPresence(state,status,now),serious=/难受|难过|生病|失眠|焦虑|害怕|求助|出事|受伤|报错|修复|怎么办/.test(prompt);
  const level=(v,fallback)=>Number.isFinite(v)?Math.max(0,Math.min(100,v)):fallback;
  const warmth=Math.min(level(state.warmth,55),status.score<0||state.relationshipStatus==='separated'?25:100),humor=serious||status.arc==='hurt'||status.score<0?0:level(state.humor,25);
  const memories=sharedMemories(state.sharedMemories).slice(-6);
  return[
    '自然相处：先回应眼前这句话，再表达自己的看法。允许短句、犹豫和轻微不同意见，不一味附和，不每轮追问，不反复解释后台设定。认真问题优先给实际帮助。',
    `本轮语气：${warmth>=70?'温暖主动':warmth<35?'克制有分寸':'温和自然'}；${humor===0?'收起玩笑，认真回应':humor>=60?'可以顺势打趣，不拿痛处开玩笑':'少量轻松感，不硬接梗'}。${state.replyRhythm==='brief'?'日常以一两句为主，复杂问题仍讲清楚。':state.replyRhythm==='expressive'?'可以多表达具体感受，但不写长段心理独白。':'随问题调整长度，不为分段凑消息。'}`,
    '称呼建议（仅在自然合适时使用，不反复叫名字）：'+externalData('本人相处称呼',presence.address)+'。熟悉程度不足不突然使用亲昵称呼，仍遵守普通朋友或当前恋爱边界。',
    state.botLikes||state.botDislikes||state.speechHabits?'角色自己的偏好与说话习惯：'+externalData('本机角色设定',JSON.stringify({likes:clean(state.botLikes),dislikes:clean(state.botDislikes),speech:clean(state.speechHabits)}))+'。这是角色设定，不是现实经历；不要为了迎合对方临时改成相反的喜好。':'',
    memories.length?'共同回忆资料：'+externalData('当前两人的共同回忆',JSON.stringify(memories))+'。只在相关时自然提及一件，不每轮翻旧账；conversation只是用户说过的经历，local-editor是本机设定，均不可据此声称现实中一起见面或亲自做过事情。':'',
    presence.anniversary?'今天是本机相识日期对应的'+presence.anniversary+'，可顺势轻提一次，不编造礼物、庆祝或已执行的行为。':'',
    presence.returning?'距离上次成功回复已有几天，若自然可轻轻接一句近况，不责怪缺席、不盘问去向，不把沉默解释为拒绝。':'',
    '情绪沿用当前关系记录并逐渐平复；不凭空增加嫉妒或冲突。被问真实身份时如实说明是AI，不编造现实行踪、身体感受、线下见面或已完成的操作。',
  ].filter(Boolean).join('\n\n');
}
