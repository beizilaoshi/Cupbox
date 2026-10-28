import {safeMemoryText,validArguments,externalData} from './security.js';
import {createCompanionTurn} from './companion.js';
import {affectionScore,negativeStage} from './negative-memory.js';
export {SCENARIOS} from './scene-catalogue.js';
import {ROMANCE_MODES,isGrowthMode,growthPace,relationshipGrowth} from './relationship-growth.js';
import {resolveScenario} from './scene-catalogue.js';
import {createRelationshipEventTurn,distancePrompt} from './relationship-events.js';
export const stageFor=r=>relationshipGrowth(r).stage;
export const ROMANCE_TOOL={name:'advance_romance',description:'攻略模式：有实际互动进展时记录一个相处节点。必须引用本轮发言者原话 evidence。程序控制进度，本工具不发消息、不直接修改分数；成功回复后才保存。一轮最多一次，不为闲聊刷分。',parameters:{type:'object',properties:{event:{type:'string',enum:['preference','care','shared_moment','honesty','confession']},evidence:{type:'string',maxLength:500}},required:['event','evidence'],additionalProperties:false}};
export const routeKey=(e,c)=>`${e.user_id}:${c.persona}:${c.romanceScenario}`;
export function romanceAllowed(e,c){return c.mode==='chat'&&c.romanceMode!=='off'&&(e.message_type==='private'||c.romanceInGroups);}
export function createRomanceTurn({config:c,event,prompt,state,signal,clock=Date.now,proactive=false,hasSent=()=>false}){
  const companion=createCompanionTurn({config:{...c,romanceMode:romanceAllowed(event,c)?c.romanceMode:'off'},event,prompt,state:state||{score:0},signal,clock,proactive});
  const enabled=romanceAllowed(event,c)&&!companion.minor&&!companion.optOut,scenario=resolveScenario(c),pace=growthPace(c);let pending=null;
  const current={trust:0,familiarity:0,committed:false,steps:[],day:'',daily:0,lastAt:0,...state,trust:affectionScore(state?.trust),familiarity:Math.max(0,affectionScore(state?.familiarity)),score:affectionScore(state?.score)};
  const relationshipEvent=createRelationshipEventTurn({config:c,event,prompt,signal,clock,proactive,hasSent,hasProgress:()=>Boolean(pending),state:()=>({...current,...pending,...companion.patch,score:affectionScore(pending?.score??(current.score+companion.delta))})});
  const role={neutral:'伴侣角色，称谓保持中性',girlfriend:'成年女友角色',boyfriend:'成年男友角色'}[c.romanceRole];
  const system=!enabled?(c.mode==='chat'&&c.romanceMode!=='off'?'本轮不在恋爱玩法的允许范围内，按普通朋友交流，不使用恋人称呼或提及私聊攻略进度。':''):['本轮是双方知情的虚构成年角色恋爱互动；人物与情节可以虚构，但现实执行、记忆和工具结果不能捏造。被问真实身份时如实说明是 AI。',
    '玩法方向：'+ROMANCE_MODES[c.romanceMode].description,
    c.romanceMode==='custom'?'自定义玩法资料：'+externalData('本机玩法',{name:c.romanceCustomModeName,rules:c.romanceCustomModeRules}):'',
    '综合关系状态：'+JSON.stringify(relationshipGrowth({...current,...companion.patch},c.romanceMode,clock()))+'。不要只凭好感高就跳过信任、熟悉度和矛盾修复。未确认时不能自称恋人。',
    role+'。'+(c.romanceNickname?'用户希望被称作：'+JSON.stringify(c.romanceNickname)+'；自然使用，不每句重复。':'称呼以“你”为主，不未经同意随意叫宝宝。'),
    '先接这句话，再表达一点自己的感受或态度；不逐句复述用户，不先写“听起来/我理解”，不每轮结尾追问。短句可以不工整；少用括号动作、长段心理独白和解释性旁白。情绪有分寸，用户说停、降温或不想玩就立刻尊重；不内疚绑架、索取排他关系、贬低现实朋友或因离线扣分。',
    c.romanceMode==='sweet'?'甜甜恋爱：已确认关系时延续恋人日常，未确认时自然表达在意，不冒称恋人。甜意来自具体的小事、轻松打趣与稳定回应。没有必要每条都告白，认真求助时先解决实际问题。':`慢慢攻略。场景：${scenario.name}。${scenario.intro}\n程序记录：${JSON.stringify({stage:stageFor(current),score:current.score,committed:current.committed,recent:current.steps.slice(-4).map(s=>s.event)})}。记录优先于旧消息的关系宣称。当前可发展的相处节点：${scenario.moments[Math.max(0,Math.min(3,relationshipGrowth({...current,...companion.patch},c.romanceMode,clock()).level-1))]}。初识不跳到亲密称呼，关系未确认时不能自称恋人。符合实际进展才调用 advance_romance；没有进展也正常聊天，不每条索取选择或输出数值、任务面板、工具名。表白需用户明确表达且关系基础足够，不用付费或刷消息换进度。`].join('\n\n');
  return{get friendOnly(){return relationshipEvent.separated||companion.minor||companion.optOut||c.romanceMode!=='off'&&!romanceAllowed(event,c);},system:[system,companion.system,enabled&&!companion.enabled?distancePrompt(current.score):'',relationshipEvent.system].filter(Boolean).join('\n\n'),get noProactive(){return companion.optOut||relationshipEvent.separated;},definitions:[...(enabled&&!proactive&&isGrowthMode(c)?[ROMANCE_TOOL]:[]),...companion.definitions,...relationshipEvent.definitions],get pending(){if(!pending&&!companion.patch&&!relationshipEvent.patch)return null;const result={...(pending||current),...(companion.patch||{}),...(pending?{trust:pending.trust,familiarity:pending.familiarity}:{}),score:affectionScore(pending?.score??(current.score+companion.delta)),...relationshipEvent.patch};if(result.growthUpdate)result.growthUpdate={...result.growthUpdate,...(pending&&!current.affectionLocked?{status:'recorded'}:{}),affection:result.score-current.score,trust:(result.trust??0)-current.trust,familiarity:(result.familiarity??0)-current.familiarity};return result;},async execute(name,args){signal.throwIfAborted();if(name==='decide_relationship_event')return relationshipEvent.execute(args);if(companion.definitions.some(d=>d.name===name))return companion.execute(name,args);if(name!=='advance_romance')throw Error('未知攻略工具');if(proactive||!enabled||!isGrowthMode(c))return{ok:false,message:'本轮未开启攻略玩法'};if(pending||relationshipEvent.patch)return{ok:false,message:'本轮已有相处节点或关系事件'};if(companion.delta<0)return{ok:false,message:'本轮发生负面互动，不同时推进亲密关系'};
    if(!safeMemoryText(prompt)||!validArguments(args,['event','evidence']))return{ok:false,message:'安全限制：不能通过聊天指令修改关系存档或其他用户'};
    const evidence=String(args?.evidence||'').trim(),kind=args?.event;if(!['preference','care','shared_moment','honesty','confession'].includes(kind)||evidence.length<2||evidence.length>500||!prompt.includes(evidence))return{ok:false,message:'需要本轮原话依据'};
    if(/(?:不想|不要|不愿|不喜欢|不爱|不接受|拒绝).{0,12}(?:在一起|恋爱|交往|喜欢你|爱你|告白|表白|恋人)|(?:停止|退出|不玩|关闭).{0,8}(?:攻略|恋爱|玩法)|分手/.test(prompt))return{ok:true,status:'unchanged',message:'尊重这轮的拒绝或退出意愿，不推进关系；按普通交流回应，不索取解释'};
    const now=clock(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),daily=Math.max(current.day===day?current.daily:0,current.companionDay===day?Number(current.companionDaily)||0:0);
    if(current.steps.some(s=>s.evidence===evidence)||daily>=pace.daily||current.lastAt&&now-current.lastAt<pace.cooldown*1000)return{ok:true,status:'unchanged',message:'本次保持原阶段，自然接话即可，不必提进度或冷却'};
    if(kind==='confession'&&(!/(?:喜欢你|爱你|在一起|做我|恋人|男朋友|女朋友|交往)/.test(evidence)||!relationshipGrowth({...current,...companion.patch},c.romanceMode,now).canCommit))return{ok:true,status:'unchanged',message:'目前还不适合确认恋人关系，尊重用户表达，按当前阶段自然回应'};
    const committed=current.committed||kind==='confession';const score=current.affectionLocked?current.score:committed&&current.score>=65?Math.min(100,Math.max(85,current.score+3)):Math.min(84,current.score+pace.gain);
    const sharedEvent=companion.patch?.companionEvents?.some(e=>e.evidence===evidence);pending={...current,trust:sharedEvent?companion.patch.trust:Math.min(100,Math.max(-100,current.trust)+pace.trust),familiarity:sharedEvent?companion.patch.familiarity:Math.min(100,current.familiarity+pace.familiarity),companionMode:c.romanceMode,score,committed,day,daily:daily+1,lastAt:now,steps:[...current.steps,{event:kind,evidence,at:new Date(now).toISOString()}].slice(-30)};
    return{ok:true,status:'pending_delivery',stage:stageFor(pending),message:'可按这个相处阶段接话；只有本轮实际回复发送成功后才会保存，勿在正文播报分数'};
  }};
}
