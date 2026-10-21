import { mkdir, readFile, writeFile, rename, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {WHALE_MOODS} from './whale-profile.js';
import {PERSONAS} from './personas.js';
export {PERSONAS} from './personas.js';
export const DEFAULTS={enabled:false,mode:'chat',persona:'companion',customPrompt:'',modelId:'default',visionModelId:'',temperature:0.8,
  reasoningEffort:'auto',groupAt:true,groupKeywords:false,keywords:[],allowedGroups:[],privateEnabled:true,privateMention:false,replyMention:false,
  listenContext:false,contextCount:12,globalMemory:true,searchEnabled:false,visionEnabled:false,emojiEnabled:false,emojiCooldown:60,
  cooldown:5,maxPerMinute:20,ownerIds:[],allowWorkTools:false,groupPolicy:'all',blockedGroups:[],
  whaleSplitLines:true,segmentedStreaming:false,segmentChars:160,segmentDelay:1000,maxSegments:4,segmentMode:'natural',replyStyle:'casual',retainDialogue:true,memoryScope:'conversation',freeWorkflow:false,
  rolePresentation:'character',roleConsistencyCheck:true,naturalConversation:false,mergeMessages:false,mergeDelay:1200,proactiveEnabled:false,proactiveGroups:[],proactiveDelay:8,proactiveBatch:8,proactiveCooldown:120,
  identityName:'',identityPersonality:'',identityRules:'',participationRules:'只在被需要、有新信息或确实能接上话时参与。群友在互相聊天、讨论严肃事情或你没有新增信息时保持安静。',memoryTools:false,romanceMode:'off',romanceRole:'neutral',romanceNickname:'',romanceScenario:'cafe',romancePace:'balanced',romanceInGroups:false};
const ids=value=>[...new Set((Array.isArray(value)?value:String(value||'').split(/[\s,，;；]+/)).map(String).map(x=>x.trim()).filter(Boolean))];
export function validateSettings(input){
  const c={...DEFAULTS};
  for(const key of Object.keys(c))if(key in input)c[key]=input[key];
  if(!('groupPolicy'in input))c.groupPolicy=ids(input.allowedGroups).length?'allow':'all';
  for(const key of Object.keys(DEFAULTS).filter(k=>typeof DEFAULTS[k]==='boolean'))if(typeof c[key]!=='boolean')throw Error('开关设置无效：'+key);
  for(const [k,min,max]of [['temperature',0,2],['contextCount',0,100],['cooldown',1,300],['maxPerMinute',1,60],['emojiCooldown',10,3600],['segmentChars',80,600],['segmentDelay',600,5000],['maxSegments',2,6],['mergeDelay',300,5000],['proactiveDelay',3,60],['proactiveBatch',3,50],['proactiveCooldown',30,3600]]){
    const n=Number(c[k]);if(!Number.isFinite(n)||n<min||n>max)throw Error('参数超出范围：'+k);c[k]=k==='temperature'?n:Math.floor(n);
  }
  if(!['character','assistant'].includes(c.rolePresentation))throw Error('请选择有效的角色交流方式');
  if(!['chat','work'].includes(c.mode)||!Object.hasOwn(PERSONAS,c.persona))throw Error('工作模式或人格无效');
  if(!['all','allow','block'].includes(c.groupPolicy))throw Error('请选择有效的群聊范围');
  if(!['conversation','global'].includes(c.memoryScope))throw Error('请选择有效的记忆范围');
  if(!['natural','fixed','lines'].includes(c.segmentMode)||!['casual','balanced','detailed'].includes(c.replyStyle))throw Error('请选择有效的聊天或分段风格');
  for(const key of ['ownerIds','allowedGroups','blockedGroups','proactiveGroups']){c[key]=ids(c[key]);if(c[key].length>300||c[key].some(v=>!/^\d{5,16}$/.test(v)))throw Error('请填写有效的 QQ 号或群号');}
  if(c.proactiveEnabled&&(!c.naturalConversation||c.mode!=='chat'||!c.listenContext||!c.contextCount||!c.proactiveGroups.length))throw Error('主动插话需要自然聊天、聊天模式、旁听、非零上下文和明确的插话群名单');
  c.keywords=ids(c.keywords);if(c.keywords.length>50||c.keywords.some(v=>v.length>60))throw Error('关键词最多50个，每个不超过60字');
  for(const key of ['modelId','visionModelId','customPrompt','reasoningEffort']){if(typeof c[key]!=='string')throw Error('无效文本设置');}
  if(!['off','sweet','route'].includes(c.romanceMode)||!['neutral','girlfriend','boyfriend'].includes(c.romanceRole)||!['cafe','bookshop','city','fantasy'].includes(c.romanceScenario)||!['slow','balanced','fast'].includes(c.romancePace))throw Error('恋爱玩法设置无效');
  if(typeof c.romanceNickname!=='string'||c.romanceNickname.length>40)throw Error('恋爱称呼最多40字');
  if(c.romanceMode==='route'&&!c.retainDialogue)throw Error('攻略存档需要开启自动聊天记忆；暂停玩法可先选择关闭恋爱玩法');
  if(c.customPrompt.length>12000||c.modelId.length>200||c.visionModelId.length>200)throw Error('设定过长');
  for(const key of ['identityName','identityPersonality','identityRules','participationRules'])if(typeof c[key]!=='string'||c[key].length>(key==='identityName'?60:6000))throw Error('人格或插话设定过长或格式无效');
  if(c.allowWorkTools&&!c.ownerIds.length)throw Error('启用本地工具前，请填写主人 QQ 号');
  if(!['auto','none','minimal','low','medium','high','xhigh','max'].includes(c.reasoningEffort))throw Error('思考深度无效');
  return c;
}
export class BotStore{
  constructor(home){this.home=home;this.root=path.join(home,'qq-bot');this.pending=Promise.resolve();}
  async json(name,fallback){try{return JSON.parse(await readFile(path.join(this.root,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('QQ 配置无法读取，请备份后修复');}}
  async settings(){return validateSettings(await this.json('settings.json',{}));}
  async write(name,value){await mkdir(this.root,{recursive:true});const file=path.join(this.root,name),tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2),{mode:0o600});await rename(tmp,file);}
  change(fn){const task=this.pending.catch(()=>{}).then(fn);this.pending=task;return task;}
  save(patch){return this.change(async()=>{const next=validateSettings({...await this.settings(),...patch});await this.write('settings.json',next);return next;});}
  async emojis(){const list=await this.json('emojis.json',[]),legacy={'cupbox-cat-wave-v1':'开心','cupbox-cat-ok-v1':'得意','cupbox-cat-heart-v1':'卖萌'};return list.map(e=>!Object.hasOwn(e,'mood')&&legacy[e.starterKey]?{...e,mood:legacy[e.starterKey]}:e);}
  async saveEmoji(draft){return this.change(async()=>{
    const list=await this.emojis(),old=list.find(x=>x.id===draft.id);
    if(!old)throw Error('请先导入表情图片');
    const meaning=String(draft.meaning||'').trim(),triggers=ids(draft.triggers);
    if(!meaning||meaning.length>300||(!(draft.selectionMode==='semantic'||(!draft.selectionMode&&old.selectionMode==='semantic'))&&!triggers.length)||triggers.length>20||triggers.some(t=>t.length<1||t.length>40))throw Error('填写含义；关键词模式还需至少一个 1～40 字的触发词');
    const selectionMode=draft.selectionMode||old.selectionMode||'trigger';if(!['trigger','model','semantic'].includes(selectionMode))throw Error('请选择有效的表情发送方式');
    const mood=draft.mood??old.mood??'';if(mood&&!WHALE_MOODS.includes(mood))throw Error('请选择有效的源项目情绪');
    Object.assign(old,{meaning,triggers,selectionMode,mood,enabled:draft.enabled===true});await this.write('emojis.json',list);return list;
  });}
  async emojiFile(item){const file=await realpath(path.join(this.root,'emojis',item.file));const root=await realpath(path.join(this.root,'emojis'));if(path.dirname(file)!==root)throw Error('表情路径无效');return file;}
}
