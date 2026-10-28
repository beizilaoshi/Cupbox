import {safeMemoryText,outputRisk} from './security.js';

export const SLEEP_DEFAULTS={sleepReplyEnabled:false,sleepReplyTemplate:'{model}睡着了，明天再找吧。'};
export function validateSleep(c){
  if(typeof c.sleepReplyTemplate!=='string'||!c.sleepReplyTemplate.trim()||c.sleepReplyTemplate.length>500||!safeMemoryText(c.sleepReplyTemplate)||outputRisk(c.sleepReplyTemplate))throw Error('睡眠回复需为1～500字，不可包含敏感内容或权限指令');
  if(c.sleepReplyEnabled&&Number(c.sleepHour)===Number(c.wakeHour))throw Error('入睡和起床时间不能相同');
}
export function sleeping(c,now=Date.now()){
  if(c.sleepReplyEnabled!==true)return false;
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'numeric',hourCycle:'h23'}).format(now));
  const from=Number(c.sleepHour),until=Number(c.wakeHour);
  return from>until?hour>=from||hour<until:from<until&&hour>=from&&hour<until;
}
export function sleepReply(c,modelName='AI'){
  const model=String(modelName||'AI').trim().slice(0,100)||'AI',wake=String(c.wakeHour).padStart(2,'0')+':00';
  return c.sleepReplyTemplate.replace(/\{model\}|\{wake\}/g,key=>key==='{model}'?model:wake).trim();
}
