export const BACKGROUND_DEFAULTS={
 outreachEnabled:false,outreachUsers:[],outreachIdle:false,outreachIdleMinutes:120,outreachFrom:'09:00',outreachUntil:'21:00',outreachDailyLimit:4,outreachGap:60,
 outreachMorning:false,outreachMorningTime:'08:00',outreachEvening:false,outreachEveningTime:'21:00',outreachSleep:false,outreachSleepTime:'23:00',outreachSleepActiveOnly:true,outreachShare:false,outreachShareTime:'15:00',outreachShareTopics:'音乐、读到的小故事、季节里的小发现、今天的一个小念头',
 outreachQuietFrom:'23:30',outreachQuietUntil:'07:30',ownerStoryEnabled:false,ownerStoryUsers:[],ownerStoryGroups:[],ownerStoryTime:'20:30',
 qqDiaryEnabled:false,qqDiaryGroups:[],qqDiaryUsers:[],qqDiaryTime:'23:15',qqDiaryModelId:'',
};
export const minuteOf=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
export function withinTime(now,from,until){const a=minuteOf(from),b=minuteOf(until);return a===b||a<b&&now>=a&&now<b||a>b&&(now>=a||now<b);}
export function validateBackground(c){
 for(const key of ['outreachUsers','ownerStoryUsers','ownerStoryGroups','qqDiaryGroups','qqDiaryUsers']){if(!Array.isArray(c[key])&&typeof c[key]!=='string')throw Error('主动陪伴名单格式无效');c[key]=[...new Set((Array.isArray(c[key])?c[key]:c[key].split(/[\s,，;；]+/)).map(String).map(s=>s.trim()).filter(Boolean))];if(c[key].length>(['outreachUsers','ownerStoryUsers'].includes(key)?20:100)||c[key].some(v=>!/^\d{5,16}$/.test(v)))throw Error('主动陪伴名单需填写有效 QQ 号或群号，接收者最多20人');}
 for(const key of Object.keys(BACKGROUND_DEFAULTS).filter(k=>k.endsWith('Time')||['outreachFrom','outreachUntil','outreachQuietFrom','outreachQuietUntil'].includes(k)))if(typeof c[key]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c[key]))throw Error('主动陪伴时间请按 HH:mm 填写');
 for(const [key,min,max]of [['outreachIdleMinutes',30,1440],['outreachDailyLimit',1,8],['outreachGap',15,1440]]){const n=Number(c[key]);if(!Number.isInteger(n)||n<min||n>max)throw Error('主动陪伴参数超出范围：'+key);c[key]=n;}
 if(typeof c.outreachShareTopics!=='string'||c.outreachShareTopics.length>2000||typeof c.qqDiaryModelId!=='string'||c.qqDiaryModelId.length>200)throw Error('日常话题或日记模型设置无效');
 if(c.outreachEnabled&&!c.outreachUsers.length)throw Error('请填写允许主动私聊的用户');
 if(c.ownerStoryEnabled&&(!c.ownerStoryUsers.length||!c.ownerStoryGroups.length))throw Error('请填写告状接收者和允许分享趣事的群');
 if(c.qqDiaryEnabled&&!c.qqDiaryGroups.length&&!c.qqDiaryUsers.length)throw Error('请指定可以用于 AI 日记的群聊或私聊');
}
