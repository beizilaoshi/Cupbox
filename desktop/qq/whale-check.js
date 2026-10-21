// JavaScript adaptation of qq-ai-bot/tools/check_persona.py using its unchanged
// MIT-licensed persona_rules.json. See vendor/qq-ai-bot/NOTICE.md.
import {WHALE_RULES,stripWhaleMarkers} from './whale-profile.js';
const regex=pattern=>new RegExp(pattern.replace(/^\(\?m\)/,''),pattern.startsWith('(?m)')?'m':'');
const active=rules=>rules.filter(r=>r.level!=='off').map(r=>({...r,re:regex(r.pattern)}));
const rules=active(WHALE_RULES.rules),density=active(WHALE_RULES.density_rules);
// SequenceMatcher matching-block ratio: same longest-match/tie ordering as the
// upstream Python checker, including popular-character suppression at n >= 200.
export function similarity(left,right){
  const a=[...left],b=[...right],index=new Map();b.forEach((ch,j)=>{if(!index.has(ch))index.set(ch,[]);index.get(ch).push(j);});if(b.length>=200)for(const [ch,positions]of index)if(positions.length>Math.floor(b.length/100)+1)index.delete(ch);
  const stack=[[0,a.length,0,b.length]];let matched=0;
  while(stack.length){const [alo,ahi,blo,bhi]=stack.pop();let besti=alo,bestj=blo,size=0,previous=new Map();
    for(let i=alo;i<ahi;i++){const next=new Map();for(const j of index.get(a[i])||[]){if(j<blo)continue;if(j>=bhi)break;const n=(previous.get(j-1)||0)+1;next.set(j,n);if(n>size){besti=i-n+1;bestj=j-n+1;size=n;}}previous=next;}
    while(besti>alo&&bestj>blo&&a[besti-1]===b[bestj-1]){besti--;bestj--;size++;}while(besti+size<ahi&&bestj+size<bhi&&a[besti+size]===b[bestj+size])size++;
    if(size){matched+=size;if(alo<besti&&blo<bestj)stack.push([alo,besti,blo,bestj]);if(besti+size<ahi&&bestj+size<bhi)stack.push([besti+size,ahi,bestj+size,bhi]);}
  }
  return a.length+b.length?2*matched/(a.length+b.length):1;
}
export function whaleFindings(raw,input,history=[],realIdentity=false){
  const text=stripWhaleMarkers(raw),out=[],limits=WHALE_RULES.limits;
  if(!text)return out;const add=(id,level,desc,hint)=>out.push({id,level,desc,hint});
  for(const r of rules){if(r.id==='R8-leak-markup'||realIdentity&&['R1-assistant-voice','R2-self-label'].includes(r.id))continue;if(r.re.test(text))add(r.id,r.level,r.desc,r.hint);}
  const len=[...text].length;if(len>limits.max_chars_hard)add('R10-too-long','error','超过源规则120字硬上限','一句为主，最多两句');else if(len>limits.max_chars)add('R10-too-long','warn','超过源规则60字软上限','能短则短');
  const sentences=text.split(/[。！？!?…\n]+/).filter(s=>s.trim());if(sentences.length>limits.max_sentences)add('R11-too-many-sentences','warn','超过两句','保留一到两句');
  let faces=(text.match(/[（(][^\u4e00-\u9fff\w]{1,14}[)）]/g)||[]).length;for(const word of ['QAQ','TAT','T_T','orz','OTZ','OvO','owo','QwQ','qwq','owo'])faces+=text.toUpperCase().split(word.toUpperCase()).length-1;if(faces>limits.max_kaomoji)add('R12-kaomoji','warn','颜文字过多','偶尔使用即可');
  const previous=history.filter(t=>t.role==='assistant'&&t.text?.trim()).map(t=>stripWhaleMarkers(t.text));if(previous.some(old=>similarity(text,old)>=limits.max_dedup_similarity))add('R13-repeat','warn','与近期回复重复度过高','换个说法，不复读');
  for(const r of density){const recent=[...previous.slice(-(r.window-1)),text],hits=recent.map(t=>r.re.test(t)),n=hits.filter(Boolean).length;let run=0;for(let i=hits.length-1;i>=0&&hits[i];i--)run++;if(hits.at(-1)&&(n>=r.min_hits&&n/recent.length>r.max_ratio||run>r.max_consecutive))add(r.id,r.level,r.desc,r.hint);}
  for(const r of WHALE_RULES.scene_rules){if(r.level==='off')continue;if(regex(r.trigger).test(input)&&regex(r.bless).test(sentences[0]||'')&&regex(r.rough).test(sentences[0]||''))add(r.id,r.level,r.desc,r.hint);}
  return out;
}
