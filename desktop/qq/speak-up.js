// Independent implementation inspired by dsh-speak-up's local-first timing design.
export const SPEAK_DEFAULTS={outreachTimingMode:'fixed',outreachTrial:true,outreachRollMinutes:30,outreachChance:20,outreachMissBonus:5,outreachBonusCap:20,outreachRecentMinutes:20,outreachFarMinutes:360};
export function validateSpeak(c){
 if(!['fixed','chance'].includes(c.outreachTimingMode))throw Error('主动开场模式无效');
 for(const [key,min,max]of [['outreachRollMinutes',5,1440],['outreachChance',0,100],['outreachMissBonus',0,20],['outreachBonusCap',0,50],['outreachRecentMinutes',1,180],['outreachFarMinutes',30,1440]])if(!Number.isInteger(c[key])||c[key]<min||c[key]>max)throw Error('主动搭话参数超出范围：'+key);
 if(c.outreachFarMinutes<=c.outreachRecentMinutes)throw Error('久未交谈时长应大于刚聊过的时长');
}
export function speakDecision(c,{now,lastTalk=0,misses=0,random=Math.random}){
 const idleMinutes=lastTalk?Math.max(0,(now-lastTalk)/60000):null,factor=idleMinutes===null?1:idleMinutes<c.outreachRecentMinutes?0.15:idleMinutes>=c.outreachFarMinutes?1.5:1;
 const bonus=Math.min(c.outreachBonusCap,Math.max(0,misses)*c.outreachMissBonus),chance=c.outreachChance===0?0:Math.max(0,Math.min(100,c.outreachChance*factor+bonus)),roll=Math.max(0,Math.min(99.999999,random()*100));
 return{at:now,idleMinutes,factor,base:c.outreachChance,bonus,chance,roll,hit:roll<chance,nextMisses:roll<chance?0:Math.min(1000,misses+1)};
}
