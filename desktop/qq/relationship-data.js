import {createHash} from 'node:crypto';
import {safeMemoryText} from './security.js';
import {negativeMemories} from './negative-memory.js';
import {sharedMemories} from './natural-companion.js';

export const RELATIONSHIP_FIELDS=['score','trust','familiarity','committed','userLabel','botLabel','relationshipNote','companionArc','userBio','userPreferences','userBoundaries','botPersonality','botRules','relationshipTitle','createdAt','affectionLocked','negativeMemories','botLikes','botDislikes','speechHabits','familiarAddress','warmth','humor','replyRhythm','sharedMemories'];

export const relationshipRevision=row=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
export function relationshipPatch(patch){
  const allowed=RELATIONSHIP_FIELDS;
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('关系数据包含不支持的字段');
  for(const key of ['score','trust','familiarity'])if(key in patch&&(typeof patch[key]!=='number'||!Number.isFinite(patch[key])||patch[key]<(key==='familiarity'?0:-100)||patch[key]>100))throw Error(key==='familiarity'?'熟悉度必须在 0～100 之间':(key==='score'?'好感度':'信任度')+'必须在 −100～100 之间');
  if('committed'in patch&&typeof patch.committed!=='boolean')throw Error('关系确认状态无效');
  for(const key of ['userLabel','botLabel','relationshipNote'])if(key in patch&&(typeof patch[key]!=='string'||patch[key].length>(key==='relationshipNote'?1000:80)||!safeMemoryText(patch[key])))throw Error('备注过长或包含敏感内容、权限指令');
  if('companionArc'in patch&&!['normal','hurt','repairing'].includes(patch.companionArc))throw Error('心情阶段无效');
  for(const key of ['userBio','userPreferences','userBoundaries','botPersonality','botRules','relationshipTitle','botLikes','botDislikes','speechHabits','familiarAddress'])if(key in patch&&(typeof patch[key]!=='string'||patch[key].length>(['relationshipTitle','familiarAddress'].includes(key)?80:2000)||!safeMemoryText(patch[key])))throw Error('自定义资料过长或包含敏感内容、权限指令');
  if('createdAt'in patch&&(typeof patch.createdAt!=='number'||!Number.isFinite(patch.createdAt)||patch.createdAt<Date.UTC(2000,0,1)||patch.createdAt>Date.now()))throw Error('相识日期应在2000年至今天之间');
  if('affectionLocked'in patch&&typeof patch.affectionLocked!=='boolean')throw Error('好感锁定状态无效');
  for(const key of ['warmth','humor'])if(key in patch&&(typeof patch[key]!=='number'||!Number.isFinite(patch[key])||patch[key]<0||patch[key]>100))throw Error('语气温度与幽默程度必须在0～100之间');
  if('replyRhythm'in patch&&!['auto','brief','expressive'].includes(patch.replyRhythm))throw Error('表达节奏无效');
  if('sharedMemories'in patch&&(!Array.isArray(patch.sharedMemories)||patch.sharedMemories.length>20||sharedMemories(patch.sharedMemories).length!==patch.sharedMemories.length||new Set(patch.sharedMemories.map(m=>m.id)).size!==patch.sharedMemories.length))throw Error('共同回忆最多20条，每条需有效内容、时间和独立标识');
  if('negativeMemories'in patch){
    if(!Array.isArray(patch.negativeMemories)||patch.negativeMemories.length>30||patch.negativeMemories.some(m=>!m||!['active','repairing','resolved'].includes(m.status)||typeof m.evidence!=='string'||!m.evidence.trim()||typeof m.id!=='string'||m.id.length>100)||negativeMemories(patch.negativeMemories).length!==patch.negativeMemories.length||new Set(patch.negativeMemories.map(m=>m.id)).size!==patch.negativeMemories.length)throw Error('负面记忆最多30条，每条需要有效内容、时间与独立标识');
  }
  return {...patch,...('sharedMemories'in patch?{sharedMemories:sharedMemories(patch.sharedMemories)}:{}),...('negativeMemories'in patch?{negativeMemories:negativeMemories(patch.negativeMemories)}:{})};
}
export function requireRevision(row,revision){
  if(typeof revision!=='string'||revision!==relationshipRevision(row))throw Error('关系数据刚刚发生变化，请先载入最新数据后再保存');
}
export function removeSpeakerTurns(turns,who){
  let speaker='';
  return turns.filter(turn=>{
    if(turn.role==='user')speaker=turn.name||'';
    return (turn.subject|| (turn.role==='user'?turn.name:speaker))!==who;
  });
}
