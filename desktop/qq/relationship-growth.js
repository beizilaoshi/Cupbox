import {affectionScore,negativeStage,negativeMemories} from './negative-memory.js';
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):0));
export const ROMANCE_MODES={
 off:{name:'关闭 · 普通聊天',growth:false,description:'按普通聊天相处，不推进恋爱关系。'},
 sweet:{name:'甜甜恋爱 · 日常相处',growth:false,description:'轻松表达在意，甜意落在日常小事上；称呼仍尊重实际确认状态。'},
 route:{name:'慢热攻略 · 从初识发展',growth:true,description:'依据真实互动推进节点，综合好感、信任和熟悉度判断关系。'},
 slowburn:{name:'细水长流 · 慢慢心动',growth:true,description:'不急于告白，先建立信任和熟悉感，给日常细节留空间。'},
 friends:{name:'从朋友到恋人',growth:true,description:'先像朋友一样自在交流，关系基础足够后再回应彼此心意。'},
 story:{name:'剧情共创 · 一起推进故事',growth:true,description:'围绕所选场景和共同经历展开虚构故事，节点由真实对话提供依据。'},
 repair:{name:'和好练习 · 重建信任',growth:true,description:'优先表达边界、理解与修复，不用一声道歉跳过旧矛盾或催促亲密。'},
 steady:{name:'稳定相伴 · 经营日常',growth:true,description:'重视兑现约定、分享日常与默契；已确认关系保持延续，尚未确认时不冒称恋人。'},
 custom:{name:'自定义恋爱玩法',growth:true,description:'使用自己填写的玩法名称与相处规则，成长和确认仍由综合状态控制。'},
};
export const ROMANCE_PACES={
 veryslow:{name:'循序渐进 · 很慢很稳',gain:1,trust:1,familiarity:1,companion:0.5,cooldown:300,daily:3},
 slow:{name:'慢热 · 多一点铺垫',gain:3,trust:2,familiarity:1,companion:1,cooldown:120,daily:6},
 balanced:{name:'自然 · 慢慢靠近',gain:5,trust:2,familiarity:1,companion:2,cooldown:60,daily:6},
 fast:{name:'轻快 · 更快熟悉',gain:8,trust:2,familiarity:1,companion:3,cooldown:30,daily:6},
 trust:{name:'信任优先 · 先安心再亲近',gain:2,trust:3,familiarity:1,companion:1,cooldown:120,daily:5},
 everyday:{name:'日常积累 · 先熟悉彼此',gain:3,trust:2,familiarity:3,companion:1,cooldown:90,daily:6},
 story:{name:'故事节点 · 少而有分量',gain:6,trust:2,familiarity:2,companion:2,cooldown:180,daily:3},
 custom:{name:'自定义发展节奏',gain:5,trust:2,familiarity:1,companion:2,cooldown:60,daily:6},
};
export const isGrowthMode=c=>Boolean(ROMANCE_MODES[c.romanceMode]?.growth);
export function growthPace(c){if(c.romancePace!=='custom'){const value=ROMANCE_PACES[c.romancePace]||ROMANCE_PACES.balanced;return{...value,companionCooldown:['slow','balanced','fast'].includes(c.romancePace)?30:value.cooldown};}return{gain:c.romanceCustomGain??5,trust:c.romanceCustomTrustGain??2,familiarity:c.romanceCustomFamiliarityGain??1,companion:Math.min(3,(c.romanceCustomGain??5)/2.5),companionCooldown:c.romanceCustomCooldown??60,cooldown:c.romanceCustomCooldown??60,daily:c.romanceCustomDailyLimit??6};}
export function relationshipGrowth(state={},mode='route',now=Date.now()){
 const score=affectionScore(state.score),trust=clamp(state.trust,-100),familiarity=clamp(state.familiarity),friend=mode==='friend'||state.safeMinor||state.companionOptOut;
 const memories=negativeMemories(state.negativeMemories),unresolved=memories.filter(m=>m.status!=='resolved').length;
 const events=[...(Array.isArray(state.steps)?state.steps:[]),...(Array.isArray(state.companionEvents)?state.companionEvents:[])].filter(e=>e&&typeof e.evidence==='string'&&e.evidence.trim());
 const experiences=new Set([...events.map(e=>e.evidence),...(Array.isArray(state.sharedMemories)?state.sharedMemories.filter(m=>m?.text).map(m=>m.text):[])]).size;
 const arc=state.emotionActive===false||now-(Number(state.conflictAt)||0)>=86400000?'normal':['hurt','repairing'].includes(state.companionArc)?state.companionArc:'normal';
 const bond=Math.round(clamp(Math.max(0,score)*.4+Math.max(0,trust)*.35+familiarity*.25-Math.min(20,unresolved*3)));
 let level=0;if(bond>=10&&familiarity>=8)level=1;if(score>=20&&trust>=10&&familiarity>=15)level=2;if(score>=40&&trust>=25&&familiarity>=30)level=3;if(score>=65&&trust>=50&&familiarity>=50&&experiences>=3)level=4;if(score>=80&&trust>=65&&familiarity>=70&&experiences>=6)level=5;
 if(score<0||trust<0)level=0;
 if(unresolved>=3)level=Math.min(level,2);if(arc!=='normal')level=Math.min(level,2);
 const labels=friend?['初识','点头之交','熟悉','亲近','默契','知心搭档']:['初识','渐渐在意','熟悉','心动','双向靠近','心意相通'];
 const condition=state.relationshipStatus==='separated'?'关系已结束，保留距离':score<0||trust<0?'需要重建信任':arc==='hurt'?'有待磨合':arc==='repairing'?'正在修复':unresolved?'仍有心结':bond>=70?'相处安稳':'慢慢了解';
 const stage=state.relationshipStatus==='separated'?'已分手':negativeStage(score)||(trust<0?(trust<=-20?'戒备':'保留距离'):state.committed&&!friend?'恋人':labels[level]);
 const requirements=[['好感基础',score>=65],['相互信任',trust>=40],['足够熟悉',familiarity>=35],['相处经历',experiences>=3],['矛盾已缓和',arc==='normal'&&unresolved===0],['双方边界允许',!friend]];
 const blocking=requirements.filter(([,ok])=>!ok).map(([name])=>name);if(state.relationshipStatus==='separated')blocking.push('已分手，需双方明确复合');const canCommit=!friend&&!blocking.length;
 const insights=[trust<0?'信任为负，优先尊重边界和重建可靠感。':trust<25?'信任仍在建立，亲近表达宜克制。':'已有一定信任，可更自然地表达看法。',familiarity<30?'彼此还不够熟悉，从具体喜好和日常开始。':'已有熟悉感，可自然延续共同话题。',unresolved?'旧矛盾尚未完全释怀，道歉后也需要持续修复。':'没有尚未修复的负面记忆。'];
 return{stage,level,bond,condition,canCommit,blocking,insights,experiences,unresolved,arc,dimensions:{affection:score,trust,familiarity},milestones:requirements.map(([name,achieved])=>({name,achieved:Boolean(achieved)}))};
}
