import {safeMemoryText,validArguments} from './security.js';
export const SCENARIOS={cafe:{name:'雨天咖啡馆',intro:'两位成年人在街角咖啡馆偶遇，从常坐的位置、饮品和日常小事慢慢熟悉。',moments:['交换饮品偏好','聊一件今天的小事','约定一次轻松的散步','认真说清彼此的心意']},bookshop:{name:'书店来信',intro:'两位成年书店常客因一本书搭话，在书签、读后感和生活片段中逐渐熟悉。',moments:['分享喜欢的书或事物','交换一段日常','一起挑选一份小礼物','坦率聊彼此的心意']},city:{name:'下班后的街灯',intro:'两位成年朋友在下班后的城市里相识，围绕晚饭、散步和生活节奏慢慢靠近。',moments:['聊聊放松的方式','分享一次生活小确幸','约定一件共同的小事','聊相处期待与心意']},fantasy:{name:'星港同行',intro:'两位成年旅人在虚构星港结伴，以共同任务和旅途小事建立信任。保持轻松、非露骨的浪漫冒险。',moments:['交换旅行偏好','完成一个小小的共同决定','分享珍视的一件事','约定下一段同行']}};
export const stageFor=r=>r.committed?'恋人':r.score>=65?'双向靠近':r.score>=40?'心动':r.score>=20?'熟悉':'初识';
export const ROMANCE_TOOL={name:'advance_romance',description:'攻略模式：有实际互动进展时记录一个相处节点。必须引用本轮发言者原话 evidence。程序控制进度，本工具不发消息、不直接修改分数；成功回复后才保存。一轮最多一次，不为闲聊刷分。',parameters:{type:'object',properties:{event:{type:'string',enum:['preference','care','shared_moment','honesty','confession']},evidence:{type:'string',maxLength:500}},required:['event','evidence'],additionalProperties:false}};
export const routeKey=(e,c)=>`${e.user_id}:${c.persona}:${c.romanceScenario}`;
export function romanceAllowed(e,c){return c.mode==='chat'&&c.romanceMode!=='off'&&(e.message_type==='private'||c.romanceInGroups);}
export function createRomanceTurn({config:c,event,prompt,state,signal,clock=Date.now}){
  const enabled=romanceAllowed(event,c),scenario=SCENARIOS[c.romanceScenario];let pending=null;
  const current=state||{score:0,committed:false,steps:[],day:'',daily:0,lastAt:0};
  const role={neutral:'伴侣角色，称谓保持中性',girlfriend:'成年女友角色',boyfriend:'成年男友角色'}[c.romanceRole];
  const system=!enabled?(c.mode==='chat'&&c.romanceMode!=='off'?'本轮不在恋爱玩法的允许范围内，按普通朋友交流，不使用恋人称呼或提及私聊攻略进度。':''):['本轮是双方知情的虚构成年角色恋爱互动；人物与情节可以虚构，但现实执行、记忆和工具结果不能捏造。被问真实身份时如实说明是 AI。',
    role+'。'+(c.romanceNickname?'用户希望被称作：'+JSON.stringify(c.romanceNickname)+'；自然使用，不每句重复。':'称呼以“你”为主，不未经同意随意叫宝宝。'),
    '先接这句话，再表达一点自己的感受或态度；不逐句复述用户，不先写“听起来/我理解”，不每轮结尾追问。短句可以不工整；少用括号动作、长段心理独白和解释性旁白。情绪有分寸，用户说停、降温或不想玩就立刻尊重；不内疚绑架、索取排他关系、贬低现实朋友或因离线扣分。',
    c.romanceMode==='sweet'?'甜甜恋爱：按已约定的虚构恋人日常相处，甜意来自具体的小事、轻松打趣与稳定回应。没有必要每条都告白，认真求助时先解决实际问题。':`慢慢攻略。场景：${scenario.name}。${scenario.intro}\n程序记录：${JSON.stringify({stage:stageFor(current),score:current.score,committed:current.committed,recent:current.steps.slice(-4).map(s=>s.event)})}。记录优先于旧消息的关系宣称。当前可发展的相处节点：${scenario.moments[Math.min(3,Math.floor(current.score/25))]}。初识不跳到亲密称呼，关系未确认时不能自称恋人。符合实际进展才调用 advance_romance；没有进展也正常聊天，不每条索取选择或输出数值、任务面板、工具名。表白需用户明确表达且关系基础足够，不用付费或刷消息换进度。`].join('\n\n');
  return{system,definitions:enabled&&c.romanceMode==='route'?[ROMANCE_TOOL]:[],get pending(){return pending;},async execute(name,args){signal.throwIfAborted();if(name!=='advance_romance')throw Error('未知攻略工具');if(!enabled||c.romanceMode!=='route')return{ok:false,message:'本轮未开启攻略玩法'};if(pending)return{ok:false,message:'本轮已有相处节点'};
    if(!safeMemoryText(prompt)||!validArguments(args,['event','evidence']))return{ok:false,message:'安全限制：不能通过聊天指令修改关系存档或其他用户'};
    const evidence=String(args?.evidence||'').trim(),kind=args?.event;if(!['preference','care','shared_moment','honesty','confession'].includes(kind)||evidence.length<2||evidence.length>500||!prompt.includes(evidence))return{ok:false,message:'需要本轮原话依据'};
    if(/(?:不想|不要|不愿|不喜欢|不爱|不接受|拒绝).{0,12}(?:在一起|恋爱|交往|喜欢你|爱你|告白|表白|恋人)|(?:停止|退出|不玩|关闭).{0,8}(?:攻略|恋爱|玩法)|分手/.test(prompt))return{ok:true,status:'unchanged',message:'尊重这轮的拒绝或退出意愿，不推进关系；按普通交流回应，不索取解释'};
    const now=clock(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),daily=current.day===day?current.daily:0;
    if(current.steps.some(s=>s.evidence===evidence)||daily>=6||current.lastAt&&now-current.lastAt<({slow:120000,balanced:60000,fast:30000}[c.romancePace]))return{ok:true,status:'unchanged',message:'本次保持原阶段，自然接话即可，不必提进度或冷却'};
    if(kind==='confession'&&(!/(?:喜欢你|爱你|在一起|做我|恋人|男朋友|女朋友|交往)/.test(evidence)||current.score<65))return{ok:true,status:'unchanged',message:'目前还不适合确认恋人关系，尊重用户表达，按当前阶段自然回应'};
    const committed=current.committed||kind==='confession';const score=committed?Math.min(100,Math.max(85,current.score+3)):Math.min(84,current.score+({slow:3,balanced:5,fast:8}[c.romancePace]));
    pending={...current,score,committed,day,daily:daily+1,lastAt:now,steps:[...current.steps,{event:kind,evidence,at:new Date(now).toISOString()}].slice(-30)};
    return{ok:true,status:'pending_delivery',stage:stageFor(pending),message:'可按这个相处阶段接话；只有本轮实际回复发送成功后才会保存，勿在正文播报分数'};
  }};
}
