import {estimateTokens} from '../../dist/core/context.js';
import {tokenClip} from './context.js';
const segmenter=new Intl.Segmenter('zh-CN',{granularity:'word'});
const stop=new Set(['我','你','他','她','的','了','是','在','有','吗','呢','吧','什么','怎么','这个','那个','记得','记住','之前','现在','一下','还是','还有']);
const normalized=s=>String(s||'').normalize('NFKC').toLowerCase();
const groups=[['喝','饮料','饮品','茶','乌龙茶','红茶','绿茶','奶茶','咖啡','可可','可乐','果汁'],['吃','食物','口味','饭','面','饺子','火锅','辣','甜食','海鲜'],['爱好','兴趣','喜欢做','画画','绘画','画图','音乐','听歌','唱歌','游戏','读书','看书'],['名字','称呼','叫我','昵称','怎么称呼'],['安排','计划','约定','待办','见面','出游','旅行','周末']];
export function memoryTokens(value){
 const s=normalized(value).slice(0,1800),tokens=[];
 for(const word of segmenter.segment(s))if(word.isWordLike&&!stop.has(word.segment))tokens.push(word.segment);
 for(const part of s.match(/[\p{Script=Han}]+/gu)||[])for(let i=0;i<part.length-1;i++){const pair=part.slice(i,i+2);if(!stop.has(pair))tokens.push(pair);}
 return tokens;
}
export const selfMemoryQuery=query=>/(?:记得我|了解我|关于我|我的(?:偏好|喜好|习惯|名字|称呼)|我.{0,5}(?:喜欢什么|爱喝什么|爱吃什么|叫什么|什么名字|什么口味|有什么爱好)|what.*(?:about me|my favorite)|my (?:name|preferences|hobbies))/i.test(query);
function preference(row){
 const match=/^(?:我)?(?:现在|已经)?(不喜欢|不爱喝|不爱吃|喜欢|爱喝|爱吃)([^。！？\n]{1,30})[。！]?$/u.exec(row.text.trim());
 if(!match)return null;const object=match[2].replace(/^(?:喝|吃)/,'').replace(/了$/,'').trim();return object?{key:(row.who||row.subject)+':'+object,negative:match[1].startsWith('不'),at:Date.parse(row.lastConfirmedAt||row.at||'')}:null;
}
export function rankMemories(rows,query,{speaker,decay=false,now=Date.now()}={}){
 const q=normalized(query),tokens=[...new Set(memoryTokens(q))],selfOnly=selfMemoryQuery(q),categories=groups.filter(g=>g.some(word=>q.includes(word)));
 const followup=/^(?:继续吧?|接着(?:说|聊)?|然后呢?|刚才呢?|还记得吗)[。？！!?.\s]*$/.test(q);
 const docs=rows.map(row=>{const tokens=memoryTokens(row.text+' '+(row.evidence||'')),tf=new Map();for(const term of tokens)tf.set(term,(tf.get(term)||0)+1);return{row,tf,length:Math.max(1,tokens.length)};});
 const average=docs.reduce((n,d)=>n+d.length,0)/Math.max(1,docs.length),df=new Map(tokens.map(t=>[t,docs.filter(d=>d.tf.has(t)).length]));
 const ranked=[];
 const latest=new Map();for(const row of rows){const p=preference(row);if(p&&Number.isFinite(p.at)&&(!latest.has(p.key)||latest.get(p.key).at<p.at))latest.set(p.key,p);}
 for(const {row,tf,length}of docs){
  const own=(row.who||row.subject)===speaker,local=row.who==='local-editor';if(selfOnly&&!own&&!local)continue;
  let lexical=0;for(const token of tokens){const count=tf.get(token)||0;if(count)lexical+=Math.log(1+(docs.length-(df.get(token)||0)+.5)/((df.get(token)||0)+.5))*count*2.2/(count+1.2*(.25+.75*length/average));}
  const body=normalized(row.text+' '+(row.evidence||'')),category=categories.filter(g=>g.some(word=>body.includes(word))).length;
  const exact=q.trim().length>=2&&body.includes(q.trim())?3:0,single=q.trim().length===1&&body.includes(q.trim())?1:0;
  const stable=row.kind==='fact'&&(own||local),pin=row.locked&&(own||local),profile=selfOnly&&(own||local)&&/喜欢|不喜欢|爱喝|爱吃|偏好|习惯|叫我|称呼|我叫/.test(row.text);
  if(!lexical&&!category&&!exact&&!single&&!stable&&!pin&&!profile&&!(followup&&row.kind==='recent'))continue;
  const reasons=[lexical>0&&'词项匹配',category>0&&'主题扩展',exact>0&&'完整短语',own&&'当前用户',pin&&'置顶',stable&&'长期偏好',profile&&'个人档案问题'].filter(Boolean);
  const at=Date.parse(row.at||''),age=Number.isFinite(at)?Math.max(0,now-at)/86400000:365,recency=.35/(1+age/30);
  const lexicalNormalized=lexical/(1+lexical),usage=Math.min(.45,Math.log1p(Math.max(0,Number(row.recallCount)||0))*.08),critical=stable&&/allergy|restriction/.test(row.type||'');
  if(usage)reasons.push('曾经召回');if(critical)reasons.push('过敏或禁忌');
  let score=lexicalNormalized*2+category*1.3+exact+single+(own? .7:0)+(stable?1.4:0)+(profile?2:0)+recency+usage+(critical?1:0);
  if(pin)score*=1.6;
  const preferenceValue=preference(row),newer=preferenceValue&&latest.get(preferenceValue.key),possiblyOutdated=Boolean(newer&&newer.at>preferenceValue.at&&newer.negative!==preferenceValue.negative);if(possiblyOutdated&&!pin){score*=.25;reasons.push('存在较新相反表述');}
  if(row.kind==='recent')score*=.7;
  if(decay&&!pin&&!local)score*=.6+.4/(1+age/(row.kind==='fact'?365:60));
  ranked.push({...row,...(possiblyOutdated?{possiblyOutdated:true}:{}),score:Number(score.toFixed(4)),reasons});
 }
 return ranked.sort((a,b)=>b.score-a.score||String(b.at||'').localeCompare(String(a.at||'')));
}
const publicRow=row=>({text:row.text,speaker_id:row.who,source:row.source,recorded_at:row.at,...(row.possiblyOutdated?{status:'存在较新相反表述，请核对时间'}:{}),...(row.subject?{subject:row.subject}:{}),...(row.role?{role:row.role}:{}),...(row.kind==='fact'?{evidence:row.evidence,locked:row.locked===true}:{})});
export function packMemories(ranked,budget=600){
 const selected=[],seen=new Set(),counts={fact:0,note:0,recent:0},limits={fact:4,note:6,recent:2};
 const serialize=rows=>JSON.stringify({说明:'历史资料，按speaker_id和来源区分；偏好有变化时参考最近原话，不替代当前消息。',记录:rows.map(row=>({type:row.kind,...publicRow(row)}))});
 for(const candidate of ranked){
  if(counts[candidate.kind]>=limits[candidate.kind])continue;
  const key=[candidate.who,normalized(candidate.text).replace(/^我/,'').replace(/[\s，。！？]/g,'')].join(':');if(seen.has(key))continue;
  let row={...candidate,text:tokenClip(candidate.text,180),...(candidate.evidence?{evidence:tokenClip(candidate.evidence,80)}:{})};
  if(estimateTokens(serialize([...selected,row]))>budget){if(selected.length)continue;row={...row,text:tokenClip(row.text,60),...(row.evidence?{evidence:tokenClip(row.evidence,30)}:{})};if(estimateTokens(serialize([row]))>budget)continue;}
  selected.push(row);counts[row.kind]++;seen.add(key);
 }
 return{memory:selected.length?serialize(selected):'',selected,estimatedTokens:selected.length?estimateTokens(serialize(selected)):0};
}
