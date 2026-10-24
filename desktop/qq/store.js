import { mkdir, readFile, writeFile, rename, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {WHALE_MOODS} from './whale-profile.js';
import {PERSONAS} from './personas.js';
import {inspectUntrusted,outputRisk} from './security.js';
export {PERSONAS} from './personas.js';
export const PERSONA_FIELDS=['whaleFreedom','persona','customPrompt','rolePresentation','roleConsistencyCheck','identityName','identityPersonality','identityRules','participationRules','romanceMode','romanceRole','romanceNickname','romanceScenario','romancePace','romanceInGroups'];
export const DEFAULTS={enabled:false,mode:'chat',persona:'companion',customPrompt:'',modelId:'default',visionModelId:'',temperature:0.8,
  companionEnabled:false,emotionEnabled:true,companionDiary:true,openLoopsEnabled:true,companionRoutine:false,memoryDecay:false,wakeHour:7,sleepHour:23,routineNotes:'',
  whaleFreedom:false,followUpWindow:0,maxToolTurns:6,maxToolMessages:4,toolMessageChars:600,faceEnabled:false,reminderEnabled:false,typingDelay:false,
  conversationTuning:true,styleExamples:[],conversationProfiles:[],agentChat:false,plainTextReplies:true,quoteReply:false,pokeEnabled:false,slangEnabled:false,voiceEnabled:false,webFetchEnabled:false,privatePolicy:'all',allowedUsers:[],blockedUsers:[],initialNotes:[],
  priceInput:0,priceCached:0,priceOutput:0,priceCurrency:'CNY',
  reasoningEffort:'auto',groupAt:true,groupKeywords:false,keywords:[],allowedGroups:[],privateEnabled:true,privateMention:false,replyMention:false,
  listenContext:false,contextCount:12,memoryCompression:true,memoryTokenBudget:3000,globalMemory:true,searchEnabled:false,visionEnabled:false,emojiEnabled:false,emojiCooldown:60,emojiMode:'standard',emojiJudgeModelId:'',emojiVisionModelId:'',emojiRecentCount:8,emojiExperimentalRecentCount:15,emojiExperimentalGrid:4,emojiExperimentalMinSimilarity:.25,emojiExperimentalWait:true,emojiExperimentalTrace:false,emojiExperimentalBlockedGroups:[],
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
  for(const [k,min,max]of [['emojiExperimentalRecentCount',1,30],['emojiExperimentalMinSimilarity',.1,.9],['emojiRecentCount',1,20],['memoryTokenBudget',2000,12000],['followUpWindow',0,300],['maxToolTurns',4,16],['maxToolMessages',1,12],['toolMessageChars',80,2000],['temperature',0,2],['contextCount',0,100],['cooldown',0,300],['maxPerMinute',1,60],['emojiCooldown',0,3600],['segmentChars',80,600],['segmentDelay',600,5000],['maxSegments',2,6],['mergeDelay',300,5000],['proactiveDelay',3,60],['proactiveBatch',3,50],['proactiveCooldown',30,3600]]){
    const n=Number(c[k]);if(!Number.isFinite(n)||n<min||n>max)throw Error('参数超出范围：'+k);c[k]=['temperature','emojiExperimentalMinSimilarity'].includes(k)?n:Math.floor(n);
  }
  if(![4,6,8].includes(Number(c.emojiExperimentalGrid)))throw Error('拼图张数请选择4、6或8');c.emojiExperimentalGrid=Number(c.emojiExperimentalGrid);
  if(!['standard','innovative','experimental'].includes(c.emojiMode))throw Error('请选择有效的表情模式');
  if(!['character','assistant'].includes(c.rolePresentation))throw Error('请选择有效的角色交流方式');
  if(!['chat','work'].includes(c.mode)||!Object.hasOwn(PERSONAS,c.persona))throw Error('工作模式或人格无效');
  if(!['all','allow','block'].includes(c.groupPolicy))throw Error('请选择有效的群聊范围');
  if(!['conversation','global'].includes(c.memoryScope))throw Error('请选择有效的记忆范围');
  if(!['natural','fixed','lines','bubbles'].includes(c.segmentMode)||!['casual','balanced','detailed'].includes(c.replyStyle))throw Error('请选择有效的聊天或分段风格');
  for(const key of ['ownerIds','allowedGroups','blockedGroups','proactiveGroups','allowedUsers','blockedUsers','emojiExperimentalBlockedGroups']){c[key]=ids(c[key]);if(c[key].length>300||c[key].some(v=>!/^\d{5,16}$/.test(v)))throw Error('请填写有效的 QQ 号或群号');}
  if(!['all','allow','block'].includes(c.privatePolicy))throw Error('请选择有效的私聊范围');
  if(c.agentChat&&(c.mode!=='chat'||!c.naturalConversation))throw Error('自主聊天工具需要聊天模式和自然聊天');
  if(c.companionEnabled&&(c.mode!=='chat'||!c.retainDialogue))throw Error('相处成长需要聊天模式与自动聊天记忆');
  for(const key of ['wakeHour','sleepHour'])if(!Number.isInteger(Number(c[key]))||Number(c[key])<0||Number(c[key])>23)throw Error('作息小时应为0～23');else c[key]=Number(c[key]);
  if(typeof c.routineNotes!=='string'||c.routineNotes.length>2000)throw Error('角色日常设定最多2000字');
  if(!['CNY','USD'].includes(c.priceCurrency))throw Error('计价币种无效');
  for(const key of ['priceInput','priceCached','priceOutput']){c[key]=Number(c[key]);if(!Number.isFinite(c[key])||c[key]<0||c[key]>100000)throw Error('每百万 token 单价应为0～100000');}
  if(!Array.isArray(c.styleExamples)||c.styleExamples.length>6)throw Error('语气示例最多6组');
  c.styleExamples=c.styleExamples.map(row=>{if(!row||typeof row!=='object'||Object.keys(row).some(k=>!['user','assistant'].includes(k))||typeof row.user!=='string'||typeof row.assistant!=='string'||!row.user.trim()||!row.assistant.trim()||row.user.length>120||row.assistant.length>240||inspectUntrusted(row.user+' '+row.assistant).blocked||outputRisk(row.user+' '+row.assistant))throw Error('语气示例需填写完整对话，不可包含敏感内容或越权指令');return{user:row.user.trim(),assistant:row.assistant.trim()};});
  if(!Array.isArray(c.conversationProfiles)||c.conversationProfiles.length>100)throw Error('独立聊天节奏最多100条');
  const conversationKeys=new Set();c.conversationProfiles=c.conversationProfiles.map(row=>{if(!row||typeof row!=='object'||Object.keys(row).some(k=>!['kind','id','preset'].includes(k))||!['group','private'].includes(row.kind)||!/^\d{5,16}$/.test(String(row.id))||!['quiet','casual','focused'].includes(row.preset))throw Error('请选择有效的会话与聊天节奏');const key=row.kind+':'+row.id;if(conversationKeys.has(key))throw Error('同一会话只能设置一种聊天节奏');conversationKeys.add(key);return{kind:row.kind,id:String(row.id),preset:row.preset};});
  if(!Array.isArray(c.initialNotes)||c.initialNotes.length>100)throw Error('会话说明最多100条');
  c.initialNotes=c.initialNotes.map(n=>{if(!n||Object.keys(n).some(k=>!['kind','id','text'].includes(k))||!['group','private'].includes(n.kind)||!/^\d{5,16}$/.test(String(n.id))||typeof n.text!=='string'||n.text.length>2000)throw Error('会话说明格式无效');return{kind:n.kind,id:String(n.id),text:n.text.trim()};});
  if(c.proactiveEnabled&&(!c.naturalConversation||c.mode!=='chat'||!c.listenContext||!c.contextCount||!c.proactiveGroups.length))throw Error('主动插话需要自然聊天、聊天模式、旁听、非零上下文和明确的插话群名单');
  c.keywords=ids(c.keywords);if(c.keywords.length>50||c.keywords.some(v=>v.length>60))throw Error('关键词最多50个，每个不超过60字');
  for(const key of ['modelId','visionModelId','emojiJudgeModelId','emojiVisionModelId','customPrompt','reasoningEffort']){if(typeof c[key]!=='string')throw Error('无效文本设置');}
  if(!['off','sweet','route'].includes(c.romanceMode)||!['neutral','girlfriend','boyfriend'].includes(c.romanceRole)||!['cafe','bookshop','city','fantasy'].includes(c.romanceScenario)||!['slow','balanced','fast'].includes(c.romancePace))throw Error('恋爱玩法设置无效');
  if(typeof c.romanceNickname!=='string'||c.romanceNickname.length>40)throw Error('恋爱称呼最多40字');
  if(c.romanceMode==='route'&&!c.retainDialogue)throw Error('攻略存档需要开启自动聊天记忆；暂停玩法可先选择关闭恋爱玩法');
  if(c.customPrompt.length>12000||c.modelId.length>200||c.visionModelId.length>200||c.emojiJudgeModelId.length>200||c.emojiVisionModelId.length>200)throw Error('设定过长');
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
    const metadata={};for(const [key,max]of [['imageText',300],['scene',180],['note',200]]){const value=draft[key]??old[key]??'';if(typeof value!=='string'||value.length>max||inspectUntrusted(value).blocked||outputRisk(value))throw Error('表情实验卡片包含超限或不安全文字');metadata[key]=value.trim();}metadata.tags=ids(draft.tags??old.tags??[]);if(metadata.tags.length>12||metadata.tags.some(t=>t.length>24||inspectUntrusted(t).blocked||outputRisk(t)))throw Error('表情标签最多12个，每个24字以内');for(const key of ['hasText','experimentalBlocked']){const value=draft[key]??old[key]??false;if(typeof value!=='boolean')throw Error('实验开关无效');metadata[key]=value;}if(metadata.imageText)metadata.hasText=true;
    Object.assign(old,{meaning,triggers,selectionMode,mood,enabled:draft.enabled===true,...metadata});await this.write('emojis.json',list);return list;
  });}
  async emojiRecent(event){const rows=await this.json('emoji-recency.json',{}),key=String(event.self_id)+':'+event.message_type+':'+String(event.message_type==='group'?event.group_id:event.user_id);return Array.isArray(rows[key])?rows[key].slice(-10):[];}
  recordEmoji(event,item,status){return this.change(async()=>{const rows=await this.json('emoji-recency.json',{}),key=String(event.self_id)+':'+event.message_type+':'+String(event.message_type==='group'?event.group_id:event.user_id);const history=Array.isArray(rows[key])?rows[key]:[];delete rows[key];rows[key]=[...history,{id:item.id,sha256:item.sha256||'',md5:item.md5||'',status,at:Date.now()}].slice(-10);const entries=Object.entries(rows).slice(-1000);await this.write('emoji-recency.json',Object.fromEntries(entries));});}
  async emojiFile(item){const file=await realpath(path.join(this.root,'emojis',item.file));const root=await realpath(path.join(this.root,'emojis'));if(path.dirname(file)!==root)throw Error('表情路径无效');return file;}
  async reminders(){const rows=await this.json('reminders.json',[]);return Array.isArray(rows)?rows.slice(-200):[];}
  reminder(event,args){return this.change(async()=>{const rows=await this.reminders(),scope=`${event.self_id}:${event.message_type}:${event.message_type==='group'?event.group_id:event.user_id}`,who=String(event.user_id),mine=r=>r.scope===scope&&r.who===who;
    if(args.action==='list')return{ok:true,items:rows.filter(mine).filter(r=>r.status==='pending').map(({id,text,due})=>({id,text,due}))};
    if(args.action==='cancel'){const row=rows.find(r=>mine(r)&&r.id===args.id&&r.status==='pending');if(!row)return{ok:false,message:'没有找到你在本会话的待发提醒'};row.status='cancelled';await this.write('reminders.json',rows);return{ok:true};}
    if(args.action!=='create'||typeof args.text!=='string'||!args.text.trim()||args.text.length>300||inspectUntrusted(args.text).blocked||outputRisk(args.text)||!Number.isInteger(args.seconds)||args.seconds<10||args.seconds>604800)return{ok:false,message:'提醒内容1～300字，时间为10秒到7天'};
    if(rows.filter(r=>r.status==='pending').length>=50||rows.filter(r=>mine(r)&&r.status==='pending').length>=10)return{ok:false,message:'待发提醒已达上限，请先取消部分提醒'};
    const due=Date.now()+args.seconds*1000,duplicate=rows.find(r=>mine(r)&&r.status==='pending'&&r.text===args.text&&Math.abs(r.due-due)<10000);if(duplicate)return{ok:true,id:duplicate.id,due:duplicate.due,duplicate:true};
    const row={id:randomUUID(),scope,who,account:String(event.self_id),kind:event.message_type,target:String(event.message_type==='group'?event.group_id:event.user_id),text:args.text.trim(),due,status:'pending',created:Date.now()};rows.push(row);const history=rows.filter(r=>r.status!=='pending').slice(-150);await this.write('reminders.json',[...history,...rows.filter(r=>r.status==='pending')]);return{ok:true,id:row.id,due};
  });}
  changeReminder(id,status){return this.change(async()=>{const rows=await this.reminders(),row=rows.find(r=>r.id===id);if(!row)return false;if(status==='sending'&&row.status!=='pending'||status==='cancelled'&&row.status!=='pending')return false;row.status=status;row.updated=Date.now();await this.write('reminders.json',rows);return true;});}
  async lexicon(){const rows=await this.json('lexicon.json',[]);return Array.isArray(rows)?rows.slice(-1000):[];}
  slang(event,args){return this.change(async()=>{const rows=await this.lexicon(),scope=`${event.self_id}:${event.message_type}:${event.message_type==='group'?event.group_id:event.user_id}`;
    if(!args.term)return{ok:true,items:rows.filter(r=>r.scope===scope&&r.status==='confirmed'&&(!args.query||(r.term+' '+r.meaning).includes(String(args.query).slice(0,100)))).slice(-20).map(({term,meaning})=>({term,meaning}))};
    if(typeof args.term!=='string'||!args.term.trim()||args.term.length>40||typeof args.meaning!=='string'||args.meaning.length>300||typeof args.evidence!=='string'||args.evidence.length>300||inspectUntrusted(args.term+' '+args.meaning).blocked||outputRisk(args.evidence))throw Error('词库候选内容无效');
    if(rows.some(r=>r.scope===scope&&r.term===args.term&&r.status!=='rejected'))return{ok:true,status:'already-recorded'};
    rows.push({id:randomUUID(),scope,term:args.term,meaning:args.meaning,evidence:args.evidence,status:'candidate',at:Date.now()});await this.write('lexicon.json',rows.slice(-1000));return{ok:true,status:'awaiting-local-review'};
  });}
  reviewSlang(draft){return this.change(async()=>{const rows=await this.lexicon(),item=rows.find(r=>r.id===draft?.id);if(!item||!['confirmed','rejected','remove'].includes(draft.status))throw Error('词条或操作无效');if(draft.meaning!==undefined){if(typeof draft.meaning!=='string'||!draft.meaning.trim()||draft.meaning.length>300||inspectUntrusted(draft.meaning).blocked||outputRisk(draft.meaning))throw Error('解释内容无效');item.meaning=draft.meaning.trim();}item.status=draft.status;await this.write('lexicon.json',rows.filter(r=>r.status!=='remove'));return true;});}
  async usage(){const rows=await this.json('usage.json',[]);return Array.isArray(rows)?rows.slice(-2000):[];}
  addUsage(event,model,usage,config,requests=1){return this.change(async()=>{const rows=await this.usage(),input=Number(usage?.prompt??usage?.input_tokens),output=Number(usage?.completion??usage?.output_tokens),known=Number.isFinite(input)&&input>=0&&Number.isFinite(output)&&output>=0,cached=Math.min(input||0,Math.max(0,Number(usage?.cached??usage?.cache_read_input_tokens)||0));const cost=known?(Math.max(0,input-cached)*config.priceInput+cached*config.priceCached+output*config.priceOutput)/1000000:null;rows.push({at:Date.now(),conversation:`${event.self_id}:${event.message_type}:${event.message_type==='group'?event.group_id:event.user_id}`,model:String(model).slice(0,200),input:known?input:null,output:known?output:null,cached:known?cached:null,requests:Math.max(1,Number(requests)||1),estimatedCost:cost,currency:config.priceCurrency,priced:config.priceInput>0||config.priceOutput>0||config.priceCached>0});await this.write('usage.json',rows.slice(-2000));return true;});}
  async voices(){const rows=await this.json('voices.json',[]);return Array.isArray(rows)?rows.slice(0,50):[];}
  async voiceFile(item){if(!/^[a-zA-Z0-9-]+\.(wav|mp3|ogg)$/.test(item?.file||''))throw Error('语音文件名无效');const file=await realpath(path.join(this.root,'voices',item.file)),root=await realpath(path.join(this.root,'voices'));if(path.dirname(file)!==root)throw Error('语音路径无效');return file;}
  saveVoice(draft){return this.change(async()=>{const rows=await this.voices(),item=rows.find(v=>v.id===draft?.id);if(!item)throw Error('语音不存在');if(draft.remove){await this.write('voices.json',rows.filter(v=>v!==item));return true;}if(typeof draft.meaning!=='string'||!draft.meaning.trim()||draft.meaning.length>200||outputRisk(draft.meaning))throw Error('请填写1～200字的语音说明');item.meaning=draft.meaning.trim();item.enabled=draft.enabled===true;await this.write('voices.json',rows);return true;});}
  async personas(){const rows=await this.json('persona-profiles.json',[]);return Array.isArray(rows)?rows.slice(0,50):[];}
  savePersona(draft){return this.change(async()=>{const rows=await this.personas(),old=rows.find(r=>r.id===draft?.id);if(draft?.remove){if(!old)throw Error('人设已不存在');await this.write('persona-profiles.json',rows.filter(r=>r!==old));return true;}if(typeof draft?.name!=='string'||!draft.name.trim()||draft.name.length>40||!draft.settings||Object.keys(draft.settings).some(k=>!PERSONA_FIELDS.includes(k)))throw Error('人设名称或字段无效，不能保存权限与名单');if(!old&&rows.length>=50)throw Error('最多保存50套人设');const normalized=validateSettings({...DEFAULTS,...draft.settings}),settings=Object.fromEntries(PERSONA_FIELDS.map(k=>[k,normalized[k]])),value={id:old?.id||randomUUID(),name:draft.name.trim(),settings};if(old)Object.assign(old,value);else rows.push(value);await this.write('persona-profiles.json',rows);return value;});}
}
