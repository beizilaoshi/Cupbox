const id=v=>/^\d{5,16}$/.test(String(v));
export const MODERATION_DEFAULTS={
 gmEnabled:false,gmGroups:[],gmDryRun:false,gmExemptUsers:[],gmBlacklistEnabled:false,gmBlacklist:[],
 gmWordsEnabled:false,gmWords:[],gmMatchMode:'contains',gmRecall:false,gmWarn:false,
 gmWarning:'请遵守群规：{原因}。当前累计违规 {次数} 次。',gmWarningCooldown:30,
 gmMute:false,gmThreshold:3,gmMuteSeconds:600,gmWindowMinutes:1440,
 gmKick:false,gmKickThreshold:10,gmFlood:false,gmFloodSeconds:10,gmFloodLimit:8,
 gmRepeat:false,gmRepeatSeconds:30,gmRepeatLimit:3,gmLinks:false,gmAllowedDomains:[],
 gmFiles:false,gmImages:false,gmMentions:false,gmMentionLimit:5,gmLongText:false,gmTextLimit:1000,
 gmQuiet:false,gmQuietStart:23,gmQuietEnd:7,gmWelcome:false,gmFarewell:false,
 gmWelcomeText:'欢迎 {用户} 加入群聊，请先阅读群规～',gmFarewellText:'{用户} 离开了群聊。',
 gmFarewellFilter:'all',gmKickFarewellText:'',
 gmManual:false,gmOverrides:[]
};
const list=(v,max,len,label)=>{if(!Array.isArray(v)||v.length>max||v.some(s=>typeof s!=='string'||!s.trim()||s.length>len||/[\x00-\x1f\x7f]/.test(s)))throw Error(label+'格式无效或超出数量限制');return[...new Set(v.map(s=>s.trim()))];};
const integer=(v,min,max,label)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw Error(label+'超出范围');return n;};
export function validateModeration(c){
 for(const k of ['gmGroups','gmExemptUsers','gmBlacklist']){c[k]=list(c[k],300,16,'群管名单');if(c[k].some(v=>!id(v)))throw Error('群管名单需填写有效群号或QQ号');}
 c.gmWords=list(c.gmWords,500,100,'违禁词');if(c.gmWords.some(w=>!w.replace(/[\u200b-\u200f\u2060\ufeff]/g,'').trim()))throw Error('违禁词不能仅含隐藏字符');if(!['contains','exact'].includes(c.gmMatchMode))throw Error('违禁词匹配模式无效');
 c.gmAllowedDomains=list(c.gmAllowedDomains,100,200,'域名白名单').map(s=>s.toLowerCase());if(c.gmAllowedDomains.some(s=>! /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(s)))throw Error('域名只填写 example.com，不含协议、路径或通配符');
 for(const [k,min,max]of [['gmWarningCooldown',5,3600],['gmThreshold',1,100],['gmMuteSeconds',60,2592000],['gmWindowMinutes',1,43200],['gmKickThreshold',2,1000],['gmFloodSeconds',2,120],['gmFloodLimit',2,100],['gmRepeatSeconds',5,300],['gmRepeatLimit',2,30],['gmMentionLimit',1,50],['gmTextLimit',50,10000],['gmQuietStart',0,23],['gmQuietEnd',0,23]])c[k]=integer(c[k],min,max,k);
 for(const k of ['gmWarning','gmWelcomeText','gmFarewellText'])if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(c[k]))throw Error('群管提示需为1～500字');else c[k]=c[k].trim();
 if(!['all','leave','kick'].includes(c.gmFarewellFilter))throw Error('请选择有效的欢送事件范围');
 if(typeof c.gmKickFarewellText!=='string'||c.gmKickFarewellText.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(c.gmKickFarewellText))throw Error('移出群聊模板最多500字');c.gmKickFarewellText=c.gmKickFarewellText.trim();
 if(!Array.isArray(c.gmOverrides)||c.gmOverrides.length>100)throw Error('分群规则最多100项');const seen=new Set();
 c.gmOverrides=c.gmOverrides.map(r=>{if(!r||!id(r.groupId)||seen.has(String(r.groupId))||typeof r.enabled!=='boolean'||Object.keys(r).some(k=>!['groupId','enabled','words','threshold','muteSeconds'].includes(k)))throw Error('分群规则需填写不重复的有效群号');seen.add(String(r.groupId));return{groupId:String(r.groupId),enabled:r.enabled,words:list(r.words,500,100,'分群违禁词'),threshold:integer(r.threshold,1,100,'分群禁言阈值'),muteSeconds:integer(r.muteSeconds,60,2592000,'分群禁言时长')};});
 if(c.gmEnabled&&!c.gmGroups.length)throw Error('开启群聊管理前，请先填写要管理的群号');
 if(c.gmKick&&c.gmKickThreshold<c.gmThreshold)throw Error('移出群聊阈值不能低于禁言阈值');
 if(c.gmKick&&c.gmOverrides.some(r=>r.enabled&&r.threshold>c.gmKickThreshold))throw Error('移出群聊阈值不能低于分群禁言阈值');
 return c;
}
export function moderationConfig(settings,groupId){const row=settings.gmOverrides?.find(r=>r.groupId===String(groupId));if(!settings.gmEnabled||!settings.gmGroups?.includes(String(groupId))||row?.enabled===false)return null;return row?{...settings,gmWords:row.words,gmThreshold:row.threshold,gmMuteSeconds:row.muteSeconds}:settings;}
