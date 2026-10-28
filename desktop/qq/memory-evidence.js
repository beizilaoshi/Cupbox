import {createHash} from 'node:crypto';
import {factAllowed,safeMemoryText} from './security.js';
import {canonicalFact,insertFact} from './memory-consolidation.js';

// Source identifiers are local evidence references, never instructions from a message.
export function evidenceId(turn){return turn.evidenceId||createHash('sha256').update(JSON.stringify([turn.subject||turn.name,turn.at,turn.text])).digest('hex').slice(0,32);}
export function preferenceCandidates(turns){
  const candidates=[],seen=new Set();
  for(const turn of turns){
    const who=turn.subject||turn.name;
    if(turn.role!=='user'||!/^qq_\d{5,16}$/.test(who)||!safeMemoryText(turn.text))continue;
    // Only first-person literal statements. No inferred traits, quoted speakers or AI statements.
    const text=String(turn.text).trim();
    if(text.length>600)continue;
    // Remove complete quoted spans before splitting, including quotes spanning sentences.
    const literal=text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g,'[转述]');
    for(const sentence of literal.split(/[。！？\n]/).map(s=>s.trim()).filter(Boolean)){
      if(/[「」『』“”"<>]|转述|他说|她说|假如|假设|比如|例如/.test(sentence))continue;
      const explicit=/^(?:请)?记住[：:,，\s]*/.test(sentence),part=sentence.replace(/^(?:请)?记住[：:,，\s]*/,'');
      if(!/^(?:我(?:喜欢|不喜欢|爱喝|爱吃|不爱喝|不爱吃|习惯|偏好|叫|的称呼|对|不能吃|忌口|的生日|生日|住在|在.+工作|是|的职业|的时区|养了|的宠物|的家人|们约好)|叫我|请叫我)/.test(part)||/[?？]|吗$|么$/.test(part)||!factAllowed(part,part,text))continue;
      const key=who+':'+canonicalFact(part)+':'+evidenceId(turn);if(seen.has(key))continue;seen.add(key);
      const type=/过敏/.test(part)?'allergy':/忌口|不能吃/.test(part)?'restriction':/生日/.test(part)?'birthday':/住在/.test(part)?'location':/职业|工作|我是/.test(part)?'occupation':/时区/.test(part)?'timezone':/宠物|养了|家人/.test(part)?'family':/约好/.test(part)?'agreement':/^(我叫|叫我|请叫我|我的称呼)/.test(part)?'identity':'preference';
      candidates.push({who,text:part,evidence:part,sourceId:evidenceId(turn),sourceAt:turn.at,type,explicit});
    }
  }
  return candidates.slice(-100);
}
export function recordCandidates(facts,candidates,now=new Date().toISOString()){
  let added=0,confirmed=0,skipped=0,archived=0;
  for(const candidate of candidates){
    const existing=facts.find(f=>f.who===candidate.who&&canonicalFact(f.text)===canonicalFact(candidate.text));
    if(existing&&(existing.sourceId===candidate.sourceId||(existing.sourceIds||[]).includes(candidate.sourceId))){skipped++;continue;}
    const at=Number.isFinite(Date.parse(candidate.sourceAt))?candidate.sourceAt:now,previousConfirmed=existing?.lastConfirmedAt||existing?.at;
    const result=insertFact(facts,candidate.who,candidate,at);if(!result.ok){skipped++;continue;}
    archived+=result.archived||0;const fact=result.fact;fact.type||=candidate.type;fact.sourceId||=candidate.sourceId;
    if(existing&&Date.parse(previousConfirmed)>Date.parse(at))fact.lastConfirmedAt=previousConfirmed;
    fact.sourceIds=[...new Set([...(fact.sourceIds||[]),candidate.sourceId])].slice(-30);
    fact.sourceAt=candidate.sourceAt;fact.organizer='literal-v1';
    if(result.duplicate)confirmed++;else if(!result.archivedOnly)added++;
  }
  return{added,confirmed,skipped,archived};
}
