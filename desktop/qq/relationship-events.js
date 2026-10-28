import {randomUUID} from 'node:crypto';
import {affectionScore,negativeMemories} from './negative-memory.js';
import {relationshipGrowth} from './relationship-growth.js';
import {safeMemoryText,validArguments,externalData} from './security.js';

export const RELATIONSHIP_EVENT_DEFAULTS={emotionLowEnabled:false,emotionLowStartDate:'',emotionLowCycleDays:28,emotionLowDurationDays:5,breakupEventsEnabled:true};
const DAY=86400000;
export function validCycleDate(value){const ms=Date.parse(value+'T00:00:00+08:00');return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(ms)&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(ms)===value;}
export function validateRelationshipEvents(c){
  for(const [key,min,max]of [['emotionLowCycleDays',14,60],['emotionLowDurationDays',1,14]])if(!Number.isInteger(c[key])||c[key]<min||c[key]>max)throw Error('低谷期周期应为14～60天，持续时间为1～14天');
  if(c.emotionLowDurationDays>=c.emotionLowCycleDays)throw Error('低谷期持续时间必须短于周期');
  if(typeof c.emotionLowStartDate!=='string'||c.emotionLowStartDate&&!validCycleDate(c.emotionLowStartDate))throw Error('请选择有效的低谷期开始日期');
  if(c.emotionLowEnabled&&!c.emotionLowStartDate)throw Error('开启低谷期前请选择开始日期');
}
export function emotionalCycle(c,now=Date.now()){
  const enabled=c.emotionLowEnabled===true&&validCycleDate(c.emotionLowStartDate)&&Number.isInteger(c.emotionLowCycleDays)&&c.emotionLowCycleDays>=14&&c.emotionLowCycleDays<=60&&Number.isInteger(c.emotionLowDurationDays)&&c.emotionLowDurationDays>=1&&c.emotionLowDurationDays<c.emotionLowCycleDays;
  if(!enabled)return{enabled:false,active:false};
  const start=Date.parse(c.emotionLowStartDate+'T00:00:00+08:00'),today=Date.parse(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)+'T00:00:00+08:00');
  const elapsed=Math.floor((today-start)/DAY),offset=elapsed>=0?elapsed%c.emotionLowCycleDays:-1;
  return{enabled:true,active:offset>=0&&offset<c.emotionLowDurationDays,day:offset<0?0:offset+1,remaining:offset>=0&&offset<c.emotionLowDurationDays?c.emotionLowDurationDays-offset:0,startDate:c.emotionLowStartDate,cycleDays:c.emotionLowCycleDays,durationDays:c.emotionLowDurationDays};
}
export function savedCycle(state,now=Date.now()){const v=state.emotionCycle||{};return emotionalCycle({emotionLowEnabled:v.enabled,emotionLowStartDate:v.startDate,emotionLowCycleDays:v.cycleDays,emotionLowDurationDays:v.durationDays},now);}
export function relationshipEvents(value){return(Array.isArray(value)?value:[]).filter(e=>e&&typeof e.id==='string'&&['breakup','reconcile'].includes(e.type)&&typeof e.evidence==='string'&&e.evidence.length<=500&&typeof e.reason==='string'&&e.reason.length<=300&&safeMemoryText(e.evidence+' '+e.reason)&&Number.isFinite(Date.parse(e.at))).slice(-30);}
const quoted=text=>/[“”「」『』"`]|(?:他说|她说|举例|引用|假如|例如|如果|台词|剧情里)/.test(text);
export const explicitBreakup=text=>!quoted(text)&&!/分手(?:吗|么|？|\?)|要不要.{0,4}分手/.test(text)&&(/(?:我们|咱们).{0,5}分手|(?:我想|我要|我决定|还是|就此).{0,5}分手|分手吧|结束(?:这段|我们的|恋人|恋爱)关系|别再当.{0,4}(?:恋人|情侣)/.test(text)||/^(?:分手|分手吧)[。！!]?\s*$/.test(text.trim()))&&!/(?:不(?:想|要|愿)?|别).{0,4}分手/.test(text);
export const explicitReconcile=text=>!quoted(text)&&/(?:我们|我想|我愿意|想和你|和你).{0,8}(?:复合|重新在一起|重新交往)|复合吧/.test(text)&&!/(?:不(?:想|要|愿)?|拒绝|别).{0,8}(?:复合|重新在一起|重新交往)/.test(text);
export function distancePrompt(score){return affectionScore(score)<0?'负好感优先冷处理：保持距离、减少亲昵称呼和主动示好，语气可以简短、克制、有保留，必要时明确说需要空间。先冷淡观察，不因为一个负数自动分手；不要一声道歉就恢复热恋。仍回应实际问题，不以长期故意不回、羞辱、威胁或索取服从来惩罚对方。':'';}
const EVENT_TOOL={name:'decide_relationship_event',description:'AI判断当前双方的虚构恋爱关系是否分手或复合。需引用本轮本人原话 evidence，结合好感、信任和未修复矛盾说明 reason；负好感优先冷淡观察，不自动分手。只更新当前人的存档，成功发送回复后保存。',parameters:{type:'object',properties:{action:{type:'string',enum:['breakup','reconcile']},evidence:{type:'string',maxLength:500},reason:{type:'string',maxLength:300}},required:['action','evidence','reason'],additionalProperties:false}};
export function createRelationshipEventTurn({config:c,event,prompt,state,signal,clock=Date.now,proactive=false,hasProgress=()=>false,hasSent=()=>false}){
  let patch=null;
  const now=clock(),minor=state().safeMinor||/(?:^|[。！？\n])我(?:今年)?(?:[1-9]|1[0-7])岁|(?:^|[。！？\n])我(?:是|还)(?:未成年|小学生|初中生)/.test(prompt);
  const enabled=c.mode==='chat'&&c.breakupEventsEnabled&&c.romanceMode!=='off'&&(state().committed||state().relationshipStatus==='separated')&&(event.message_type==='private'||c.romanceInGroups)&&!minor;
  const separated=()=> (patch||state()).relationshipStatus==='separated';
  return{get patch(){return patch;},get separated(){return separated();},definitions:enabled&&!proactive?[EVENT_TOOL]:[],system:!enabled?'':[
    '关系事件由你根据这轮实际互动判断，调用 decide_relationship_event 才会记录，正文口头说分手不等于已保存事件。负好感优先冷淡观察；综合信任、负面记忆、近期矛盾及当前原话，确实不愿继续时才提出分手。不能因沉默、离线、拒绝亲密或周期性心情低落制造分手。',
    separated()?'程序记录：已经分手，不能继续自称恋人或沿用亲密称呼；正常回应，尊重距离，不主动追问。复合需要本人本轮明确意愿及已修复的关系基础，不能自动复合。':'只有已确认的恋人关系才能记录分手，未交往的人不能被记成前任。本人明确提出分手时尊重意愿，调用工具记录，不反复挽留。',
    '本段关系事件资料：'+externalData('当前关系事件',relationshipEvents(state().relationshipEvents).slice(-5)),
  ].join('\n'),async execute(args){
    signal.throwIfAborted();if(hasSent())return{ok:false,message:'关系事件必须在发送本轮任何消息之前决定，不能事后补记未告知的分手或复合'};if(!enabled||proactive)return{ok:false,message:'本轮没有恋爱关系事件权限'};
    if(patch||hasProgress())return{ok:false,message:'一轮只处理一次关系进展，不同时告白、分手或复合'};
    if(!validArguments(args,['action','evidence','reason'])||!safeMemoryText(prompt))return{ok:false,message:'只能判断当前发言者的关系事件'};
    const {action,evidence,reason}=args;
    if(!['breakup','reconcile'].includes(action)||typeof evidence!=='string'||evidence.trim().length<2||evidence.length>500||!prompt.includes(evidence)||typeof reason!=='string'||!reason.trim()||reason.length>300||!safeMemoryText(evidence+' '+reason))return{ok:false,message:'需要本轮真实原话与有效的判断理由，不能自定数值或编造证据'};
    const current=state(),score=affectionScore(current.score),trust=affectionScore(current.trust),unresolved=negativeMemories(current.negativeMemories).filter(m=>m.status!=='resolved').length;
    if(action==='breakup'){
      if(!current.committed||separated())return{ok:false,message:'当前并非已确认的恋人关系'};
      if(quoted(prompt))return{ok:false,message:'引用、假设或他人的分手经历不能改变本人关系'};
      if(!(score<0||trust<0||unresolved||explicitBreakup(prompt)))return{ok:false,message:'当前没有负面关系依据或本人明确分手意愿，保持原关系'};
      patch={committed:false,relationshipStatus:'separated',breakupAt:now,breakupReason:reason.trim()};
    }else{
      if(!separated()||current.safeMinor||current.companionOptOut||!explicitReconcile(prompt)||!explicitReconcile(evidence))return{ok:false,message:'复合需要当前本人明确、非否定的意愿'};
      if(!relationshipGrowth({...current,relationshipStatus:undefined},c.romanceMode,now).canCommit)return{ok:false,message:'信任与关系基础尚未修复，先保持距离，不能用一句话恢复关系'};
      patch={committed:true,relationshipStatus:'together',reconciledAt:now};
    }
    patch.relationshipEvents=[...relationshipEvents(current.relationshipEvents),{id:randomUUID(),type:action,evidence,reason:reason.trim(),at:new Date(now).toISOString()}].slice(-30);
    return{ok:true,status:'pending_delivery',relationshipStatus:patch.relationshipStatus,message:'按这项决定自然回应；实际发送成功后保存。分手后不用恋人称呼，不播报数值，不虚构对方行为。'};
  }};
}
