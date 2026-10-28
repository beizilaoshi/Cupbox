import {createHash,randomUUID} from 'node:crypto';
import {safeMemoryText} from './security.js';
export const MEMORY_LIMITS={facts:1000,perPerson:200};
export const pendingArchive=Symbol('pending-memory-archive');
export function boundedSources(sources){const kept=[];let bytes=2;for(const source of sources.slice(-30).reverse()){const row={text:String(source.text||'').slice(0,300),evidence:String(source.evidence||'').slice(0,600),at:source.at};const size=Buffer.byteLength(JSON.stringify(row))+1;if(bytes+size>4096)continue;kept.unshift(row);bytes+=size;}return kept;}
const archive=(facts,row,reason)=>{facts[pendingArchive]||=[];facts[pendingArchive].push({...row,id:factId(row),archivedAt:new Date().toISOString(),archiveReason:reason});};
export const memoryRevision=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
export function canonicalFact(text){
  return String(text).normalize('NFKC').toLowerCase().replace(/[\s，。！？、；：,.!?;:'"“”「」]/g,(ch,index,whole)=>ch==='.'&&/\d/.test(whole[index-1]||'')&&/\d/.test(whole[index+1]||'')?'.':'')
    .replace(/^我(?:比较|非常|真的|很)?(?=喜欢|不喜欢|爱喝|不爱喝|爱吃|不爱吃)/,'我')
    .replace(/^我不爱喝/,'我不喜欢喝').replace(/^我爱喝/,'我喜欢喝').replace(/^我不爱吃/,'我不喜欢吃').replace(/^我爱吃/,'我喜欢吃');
}
export const factId=f=>f.id||'legacy-'+memoryRevision([f.who,f.text,f.evidence,f.at]).slice(0,24);
export function mergeFacts(facts,groups){
  if(!Array.isArray(groups)||groups.length>100)throw Error('记忆合并分组无效');
  const map=new Map(facts.map(f=>[factId(f),f])),removed=new Set(),used=new Set();
  const copies=new Map();
  for(const group of groups){
    if(!group||Object.keys(group).some(k=>!['keep','duplicates','reason'].includes(k))||typeof group.keep!=='string'||!Array.isArray(group.duplicates)||!group.duplicates.length||group.duplicates.length>100||typeof group.reason!=='string'||group.reason.length>300||!safeMemoryText(group.reason))throw Error('记忆合并候选格式无效');
    const keep=map.get(group.keep),members=group.duplicates.map(id=>map.get(id));
    if(!keep||members.some(f=>!f||f.who!==keep.who||factId(f)===group.keep)||new Set([group.keep,...group.duplicates]).size!==group.duplicates.length+1)throw Error('不能合并其他用户或不存在的记忆');
    if([group.keep,...group.duplicates].some(id=>used.has(id)))throw Error('同一条记忆不能重复参加合并');
    if(members.some(f=>f.locked))throw Error('置顶记忆不能作为重复项移除');
    const signature=f=>JSON.stringify({negative:/不|讨厌|拒绝|没有|从未/.test(f.text),numbers:f.text.match(/\d+(?:\.\d+)?/g)||[]});
    if(members.some(f=>signature(f)!==signature(keep)))throw Error('肯定/否定或数字信息不同，不能当作重复记忆合并');
    [group.keep,...group.duplicates].forEach(id=>used.add(id));group.duplicates.forEach(id=>removed.add(id));
    const evidence=boundedSources([...(keep.sources||[]),...members.flatMap(f=>[{text:f.text,evidence:f.evidence,at:f.at},...(f.sources||[])])]);
    copies.set(group.keep,{...keep,id:factId(keep),sources:evidence,mergedCount:(keep.mergedCount||0)+members.reduce((n,f)=>n+1+(f.mergedCount||0),0)});
  }
  return facts.filter(f=>!removed.has(factId(f))).map(f=>copies.get(factId(f))||f);
}
export function localMergeGroups(facts){
  const groups=new Map();for(const f of facts){const key=f.who+':'+canonicalFact(f.text);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
  return [...groups.values()].filter(rows=>rows.length>1).flatMap(rows=>{
    const keep=rows.find(f=>f.locked)||rows.at(-1),duplicates=rows.filter(f=>f!==keep&&!f.locked).map(factId);return duplicates.length?[{keep:factId(keep),duplicates,reason:'同一人的规范化等价表述，保留原话依据；否定与肯定不会归为一组。'}]:[];
  }).slice(0,100);
}
export function insertFact(facts,who,fact,now=new Date().toISOString()){
  const key=canonicalFact(fact.text),existing=facts.find(f=>f.who===who&&canonicalFact(f.text)===key);
  if(existing){const sources=existing.sources||[];if(existing.evidence!==fact.evidence&&!sources.some(s=>s.evidence===fact.evidence))existing.sources=boundedSources([...sources,{text:fact.text,evidence:fact.evidence,at:now}]);existing.lastConfirmedAt=now;existing.confirmations=(existing.confirmations||1)+1;return{ok:true,duplicate:true,fact:existing,archived:0};}
  const row={id:randomUUID(),who,text:fact.text.slice(0,300),evidence:fact.evidence.slice(0,600),at:now,...(fact.type?{type:fact.type}:{})};let archived=0;
  while(facts.length>=MEMORY_LIMITS.facts||facts.filter(f=>f.who===who).length>=MEMORY_LIMITS.perPerson){
    const personal=facts.filter(f=>f.who===who).length>=MEMORY_LIMITS.perPerson;
    const candidates=facts.filter(f=>!f.locked&&(!personal||f.who===who)).sort((a,b)=>Number(/allergy|restriction/.test(a.type||''))-Number(/allergy|restriction/.test(b.type||''))||(Date.parse(a.lastConfirmedAt||a.at)||0)-(Date.parse(b.lastConfirmedAt||b.at)||0)||(Number(a.recallCount)||0)-(Number(b.recallCount)||0));
    if(!candidates.length){archive(facts,row,'全部置顶，新内容进入归档');return{ok:true,duplicate:false,fact:row,archived:1,archivedOnly:true};}
    const victim=candidates[0];facts.splice(facts.indexOf(victim),1);archive(facts,victim,'容量淘汰');archived++;
  }
  facts.push(row);return{ok:true,duplicate:false,fact:row,archived};
}
