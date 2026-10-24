// Local-only companion progress. Model responses never update these values.
const HOUR=3600000,DAY_LIMIT=.20;
export const CARE_ACTIONS=Object.freeze([
 {id:'feed',name:'小鱼饭',description:'饱食 +25 · 好感 +0.03',pose:'eating',icon:'fish',cooldown:1800000,group:'food',affection:.03,satiety:25,mood:3,energy:0},
 {id:'treat',name:'小点心',description:'饱食 +10 · 心情 +8 · 好感 +0.02',pose:'eating',icon:'cake',cooldown:1800000,group:'food',affection:.02,satiety:10,mood:8,energy:0},
 {id:'play',name:'一起玩耍',description:'碰三下毛线球 · 好感 +0.06',pose:'success',icon:'yarn',cooldown:60000,group:'play',affection:.06,satiety:-3,mood:15,energy:-8},
 {id:'groom',name:'梳梳毛',description:'心情 +10 · 好感 +0.02',pose:'thankyou',icon:'brush',cooldown:45000,group:'groom',affection:.02,satiety:0,mood:10,energy:0},
 {id:'nap',name:'休息片刻',description:'精力 +18 · 好感 +0.01',pose:'yawn',icon:'moon',cooldown:600000,group:'nap',affection:.01,satiety:0,mood:3,energy:18}
]);
const stages=[{min:0,name:'初次相遇'},{min:50,name:'渐渐熟悉'},{min:150,name:'好朋友'},{min:350,name:'默契搭档'},{min:650,name:'亲密陪伴'},{min:1000,name:'心有灵犀'}];
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const number=(v,fallback,min,max)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,min,max):fallback;
const score=v=>Math.round(v*100)/100;
const day=now=>{const d=new Date(now);return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
export function normalizeCare(input,now=Date.now()){
 const s=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const currentDay=day(now),dailyDay=typeof s.dailyDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.dailyDay)?s.dailyDay:currentDay;
 const cooldowns={};for(const group of ['food','play','groom','nap'])cooldowns[group]=number(s.cooldowns?.[group],0,0,now+(group==='food'?1800000:600000));
 const history=Array.isArray(s.history)?s.history.filter(e=>e&&CARE_ACTIONS.some(a=>a.id===e.action)&&Number.isSafeInteger(e.at)&&e.at>=0&&e.at<=now+60000).slice(-20).map(e=>({action:e.action,at:e.at,gain:score(number(e.gain,0,0,6))})):[];
 if(s.version!==2){const lastFood=history.filter(e=>['feed','treat'].includes(e.action)).reduce((at,e)=>Math.max(at,e.at),0);if(lastFood)cooldowns.food=Math.max(cooldowns.food,Math.min(now+1800000,lastFood+1800000));}
 return{version:2,affection:score(number(s.affection,0,0,1000)),satiety:number(s.satiety,75,0,100),energy:number(s.energy,80,0,100),mood:number(s.mood,80,0,100),updatedAt:number(s.updatedAt,now,0,now),dailyDay,dailyPoints:currentDay>dailyDay?0:score(number(s.dailyPoints,0,0,DAY_LIMIT)),cooldowns,history};
}
export function projectCare(input,now=Date.now()){
 const s=normalizeCare(input,now),elapsed=Math.min(6,Math.max(0,(now-s.updatedAt)/HOUR));
 return{...s,satiety:clamp(s.satiety-elapsed*3,0,100),energy:clamp(s.energy+elapsed*6,0,100),mood:clamp(s.mood-elapsed,0,100),updatedAt:now,dailyDay:day(now)>s.dailyDay?day(now):s.dailyDay};
}
function blocked(s,a,now){
 if(s.cooldowns[a.group]>now)return a.group==='food'?'吃饭需要间隔30分钟，等肚子消化一下吧。':'稍等一下，再来陪我吧。';
 if(a.group==='food'&&s.satiety>=95)return'已经吃饱啦，晚点再吃。';
 if(a.id==='play'&&s.energy<15)return'有点困啦，先休息一下再玩吧。';
 if(a.id==='play'&&s.satiety<15)return'肚子咕咕叫啦，先吃点东西吧。';
 if(a.id==='nap'&&s.energy>=95)return'精神满满，暂时不困哦。';
 return'';
}
export function careView(input,now=Date.now()){
 const s=projectCare(input,now),stage=[...stages].reverse().find(t=>s.affection>=t.min),next=stages.find(t=>t.min>s.affection);
 return{affection:s.affection,maxAffection:1000,stage:stage.name,nextStage:next?.name||null,untilNext:next?score(next.min-s.affection):0,progress:next?(s.affection-stage.min)/(next.min-stage.min):1,satiety:Math.round(s.satiety),energy:Math.round(s.energy),mood:Math.round(s.mood),dailyPoints:s.dailyPoints,dailyLimit:DAY_LIMIT,serverTime:now,
  actions:CARE_ACTIONS.map(a=>({id:a.id,name:a.name,description:a.description,icon:a.icon,retryAt:s.cooldowns[a.group],reason:blocked(s,a,now),cooling:s.cooldowns[a.group]>now})),
  history:s.history.map(e=>({...e,name:CARE_ACTIONS.find(a=>a.id===e.action).name}))};
}
export function applyCare(input,action,now=Date.now()){
 const a=CARE_ACTIONS.find(item=>item.id===action);if(!a)throw Error('未知的陪伴互动');
 const s=projectCare(input,now),reason=blocked(s,a,now);if(reason)return{accepted:false,state:s,message:reason,gain:0};
 const gain=score(Math.min(a.affection,Math.max(0,DAY_LIMIT-s.dailyPoints),1000-s.affection));
 const state={...s,affection:score(s.affection+gain),dailyPoints:score(s.dailyPoints+gain),satiety:clamp(s.satiety+a.satiety,0,100),energy:clamp(s.energy+a.energy,0,100),mood:clamp(s.mood+a.mood,0,100),cooldowns:{...s.cooldowns,[a.group]:now+a.cooldown},history:[...s.history,{action,at:now,gain}].slice(-20)};
 const messages={feed:'小鱼饭吃到啦，香香的！',treat:'点心收到，心情也甜了一点。',play:'三下都碰到啦！和你玩好开心。',groom:'毛毛梳顺啦，耳朵也舒服了。',nap:'眯一小会儿，又有精神陪你啦。'};
 return{accepted:true,state,gain,pose:a.pose,message:messages[action]};
}
