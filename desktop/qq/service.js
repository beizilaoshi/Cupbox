import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { BotStore, validateSettings } from './store.js';
import { BotEngine, ruleFor } from './engine.js';
import { NapCatManager } from './napcat.js';
import { OneBot } from './onebot.js';
import { BotMemory } from './memory.js';
import { BotLogger } from './logger.js';
import {presetCatalogue} from './personas.js';
import {SCENARIOS} from './romance.js';
import { ChatScheduler } from './scheduler.js';
import { selectEmoji } from './emoji-policy.js';
import {SECURITY_POLICY,inspectUntrusted,safeMemoryText,externalData,outputRisk} from './security.js';
import {whaleFindings} from './whale-check.js';
import {realIdentityQuestion,roleBreak} from './roleplay.js';
import {installStarterMemes} from './starter-pack.js';
import {PluginHost} from '../plugins/host.js';
import {importEmojiBatch} from './emoji-import.js';
import { risksFor, scopeLabel } from './risks.js';
import { SEARCH_TOOL, searchWeb, recognizeImages, isBitmap } from './capabilities.js';
import { aiAgent, aiChat } from '../../dist/core/ai.js';


export class QQService{
  constructor({home,choices,work,notify=()=>{},notifyLog=()=>{},napcat,respond,memoryRoot,plugins}){
    Object.assign(this,{home,choices,work,notify});this.store=new BotStore(home);this.events=[];this.connectionState='stopped';this.phase='stopped';this.started=false;this.session=0;this.revision=0;this.reviews=new Map();this.settingChanges=Promise.resolve();
    this.logger=new BotLogger(notifyLog);this.plugins=plugins||new PluginHost({home});
    this.napcat=napcat||new NapCatManager(home,value=>{if(this.phase!==value.phase)this.log('info','connection','协议端状态变化',{phase:value.phase});this.phase=value.phase;this.progress=value.progress;this.emit();});this.customRespond=respond;
    this.autoMemory=new BotMemory(memoryRoot||path.join(home,'memory','qq-bot'));
  }
  async init(){this.config=await this.store.settings();this.engine=new BotEngine({settings:this.config,persistentMemory:this.autoMemory,respond:p=>this.respond(p),filterReply:async(text,context)=>{const records=await this.choices.records();return this.plugins.apply(text,{...context,guard:value=>outputRisk(value,records.all.map(m=>m.apiKey).filter(Boolean))});},send:(e,s,signal)=>this.send(e,s,signal),memory:async()=>JSON.stringify(await this.memory()),emojis:()=>this.store.emojis(),onActivity:e=>this.log(e.type==='error'?'error':e.type==='debug'?'debug':e.type==='skipped'||e.type==='security'||e.type==='plugin'&&e.status==='block'?'warn':'info',e.type==='plugin'?'plugin':e.type==='security'?'security':e.type==='emoji'?'emoji':'engine',e.message,e)});this.scheduler=new ChatScheduler({engine:this.engine,settings:()=>this.config,log:(level,message,details)=>this.log(level,'scheduler',message,details)});this.log('info','system','机器人控制台已就绪；默认不记录聊天正文、提示词、密钥或图片数据');return this;}
  async pluginSave(p){this.scheduler.stop();this.engine.stop();const state=await this.plugins.save(p);this.log('info','plugin','插件配置已保存，待发 QQ 回复已取消',{action:p.id,status:p.enabled?'enabled':'disabled'});return state;}
  receive(event){return this.scheduler.receive(event);}
  async starterEmojis(){const result=await installStarterMemes(this.store);this.scheduler.stop();this.engine.update(this.config);this.log('info','emoji','原创猫咪表情包已添加；保留已有图片设定',{count:result.added});return{...result,emojis:await this.publicEmojis()};}
  clearContext(){this.scheduler.stop();this.engine.clear();}
  log(level,stage,message,details={}){const entry=this.logger.add(level,stage,message,details);if(level!=='debug'){this.events.unshift({at:entry.at,type:level,message:entry.message,conversation:entry.details.conversation});this.events=this.events.slice(0,100);this.emit();}return entry;}
  snapshot(){return{version:'1.0.3',build:'1021 桌面协作',running:this.started,phase:this.phase,connection:this.connectionState,progress:this.progress,qr:this.qr||'',loginPhase:this.loginPhase||'',online:this.online===true,error:this.error||'',events:this.events,active:this.engine?.active||0,queued:this.engine?.queued||0,buffered:this.scheduler?.pending.size||0};}
  emit(){if(this.notifyTimer)return;this.notifyTimer=setTimeout(()=>{this.notifyTimer=null;this.notify(this.snapshot());},60);this.notifyTimer.unref?.();}
  async state(){return{...this.snapshot(),settings:this.config,presets:presetCatalogue(),romanceScenarios:SCENARIOS,emojis:await this.publicEmojis(),installed:await this.napcat.installed()};}
  async review(patch){await this.settingChanges.catch(()=>{});const next=validateSettings({...this.config,...patch}),risks=risksFor(this.config,next),token=randomUUID();this.reviews.set(token,{digest:createHash('sha256').update(JSON.stringify(next)).digest('hex'),revision:this.revision,expires:Date.now()+300000});while(this.reviews.size>20)this.reviews.delete(this.reviews.keys().next().value);return{token,risks,scope:scopeLabel(next),privateEnabled:next.privateEnabled,enabled:next.enabled};}
  save(patch,token){const task=this.settingChanges.catch(()=>{}).then(()=>this.saveReviewed(patch,token));this.settingChanges=task;return task;}
  async saveReviewed(patch,token){
    const candidate=validateSettings({...this.config,...patch}),risks=risksFor(this.config,candidate);
    if(risks.length){const review=this.reviews.get(token);this.reviews.delete(token);if(!review||review.revision!==this.revision||review.expires<Date.now()||review.digest!==createHash('sha256').update(JSON.stringify(candidate)).digest('hex'))throw Error('请先核对风险并确认保存；设置变化后需重新确认');}
    if(candidate.enabled){const model=await this.model(candidate.modelId);if(candidate.mode==='work'&&candidate.allowWorkTools&&model.provider==='free'&&!candidate.freeWorkflow)throw Error('请先开启免费模型兼容工作流，并阅读对应警告');if(candidate.visionEnabled)await this.model(candidate.visionModelId,'vision');}
    this.config=await this.store.save(patch);this.revision++;this.reviews.clear();this.scheduler?.stop();this.engine.update(this.config);this.log('info','settings',`设置已保存：自动回复${this.config.enabled?'开启':'关闭'}，表情总开关${this.config.emojiEnabled?'开启':'关闭'}`);return this.config;
  }
  async start(){if(this.starting)return this.starting;if(this.started)return this.snapshot();this.starting=this.begin().finally(()=>{this.starting=null;});return this.starting;}
  async begin(){
    const session=++this.session;this.error='';this.started=true;this.phase='starting';this.log('info','connection','准备启动专用 QQ 协议端');
    try{const connection=await this.napcat.start();if(session!==this.session){this.napcat.stop();return this.snapshot();}
      this.phase='login';await this.poll(session);this.timer=setInterval(()=>{if(!this.polling)this.poll(session).catch(()=>{});},3000);this.timer.unref?.();this.connectionInfo=connection;return this.snapshot();
    }catch(e){if(session!==this.session)return this.snapshot();this.stop();this.error='协议端准备失败，请检查网络后重试。';this.phase='error';this.emit();throw Error(this.error);}
  }
  async poll(session){this.polling=true;try{
    const status=await this.napcat.status();if(session!==this.session)return;
    this.qr=status.qr;this.loginPhase=status.loginPhase;this.error=status.error||'';this.online=status.loggedIn;
    if(status.loggedIn){this.phase='ready';if(!this.bot){await this.napcat.configure();if(session!==this.session)return;const connection=this.connectionInfo||this.napcat.connection;
      this.bot=new OneBot({...connection,onLog:(level,message,details)=>this.log(level,'transport',message,details),onEvent:event=>{if(this.started&&session===this.session)this.receive(event).catch(()=>this.log('error','engine','处理消息时发生异常；请检查本机记忆文件和模型连接'));},onState:s=>{if(session!==this.session)return;if(this.connectionState!==s)this.log(s==='online'?'info':'warn','connection','消息连接状态变化',{status:s});this.connectionState=s;this.emit();}});this.bot.connect();}
    }else{this.phase=status.offline?'offline':'login';if(this.bot){this.bot.close();this.bot=null;this.connectionState='disconnected';this.scheduler.stop();this.engine.stop();}}
    this.emit();
  }catch{if(session===this.session){this.error='心跳暂未响应，正在重试';this.connectionState='stale';this.emit();}}finally{this.polling=false;}}
  async refreshQR(){if(!this.started)throw Error('请先准备并启动协议端');const status=await this.napcat.refreshQR();this.qr=status.qr;this.emit();return this.snapshot();}
  stop(){const wasStarted=this.started;this.session++;this.started=false;clearInterval(this.timer);this.bot?.close();this.bot=null;this.napcat.stop();this.scheduler?.stop();this.engine?.stop();this.online=false;this.qr='';this.phase='stopped';this.connectionState='stopped';if(wasStarted)this.log('info','connection','机器人已停止；待发回复已取消，本机自动记忆保留');else this.emit();return this.snapshot();}
  async model(id,cap='text'){
    const records=await this.choices.records(),model=records.all.find(m=>m.id===id&&m.enabled!==false&&m.capabilities.includes(cap));
    if(!model){const message='所选模型不可用，请在“人格与能力”选择可用连接';throw Object.assign(Error(message),{publicMessage:message});}return model;
  }
  async repairRole(p,result,findings=[]){
    const {config:c,signal}=p;signal.throwIfAborted();this.log('info','model','回复未通过人设检查，进行一次无工具语气校正',{model:c.modelId,rules:findings.map(f=>f.id).join(',')});
    try{const selected=await this.choices.select({text:c.modelId},{[c.modelId]:c.reasoningEffort}),model=await this.model(c.modelId);
      const actual={image:p.memeTools?.outcome||null,relationship:p.romanceTurn?.pending?{score:p.romanceTurn.pending.score,committed:p.romanceTurn.pending.committed}:null};
      const repaired=await aiChat({config:{...selected.apply(model),temperature:c.temperature},signal,messages:[{role:'system',text:p.system+'\n源规则检查提示：'+JSON.stringify(findings)+'\n\n仅校正下面草稿的角色口吻。保留必要事实，不新增共同经历、现实身份、工具行为或关系进度，不调用工具。已执行状态只认：'+JSON.stringify(actual)+'。直接给出改好的一小段回复，不解释修改过程。'},{role:'user',text:JSON.stringify({message:p.prompt,draft:result.text})}]});
      if(!repaired.text?.trim()||(p.whaleSource?whaleFindings(repaired.text,p.prompt,p.history,realIdentityQuestion(p.prompt)).length:roleBreak(repaired.text,p.prompt))){this.log('warn','model','一次角色校正仍未通过，保留原回复；可调整人设或模型',{model:c.modelId});return result;}
      return{...result,text:repaired.text,requests:(result.requests||1)+1,...(result.usage&&repaired.usage?{usage:{prompt:result.usage.prompt+repaired.usage.prompt,completion:result.usage.completion+repaired.usage.completion}}:{})};
    }catch(error){signal.throwIfAborted();this.log('warn','model','角色语气校正暂时失败，未追加工具操作',{model:c.modelId});return result;}
  }
  async respond(p){if(inspectUntrusted(p.prompt).blocked){this.log('warn','security','本轮请求已被安全限制隔离',{code:'INPUT_BLOCKED'});return{text:''};}p={...p,system:p.system+'\n\n'+SECURITY_POLICY,history:(p.history||[]).filter(t=>safeMemoryText(t.text))};const started=Date.now();this.log('info','model','开始模型请求',{model:p.config.modelId,characters:p.prompt?.length||0});try{let result=await this.respondModel(p);const findings=p.whaleSource?whaleFindings(result.text,p.prompt,p.history,realIdentityQuestion(p.prompt)):[];if(p.roleGuard&&!p.chatTools?.skipped&&(p.whaleSource?findings.length:roleBreak(result.text,p.prompt)))result=await this.repairRole(p,result,findings);const records=await this.choices.records();const secrets=records.all.flatMap(m=>[m.apiKey]).filter(Boolean);if(outputRisk(result.text,secrets)){this.log('warn','security','已阻止包含疑似密钥的模型回复',{code:'OUTPUT_SECRET'});return{text:''};}this.log('info','model','模型响应完成',{model:p.config.modelId,durationMs:Date.now()-started,characters:result.text?.length||0});return result;}catch(e){this.log(p.signal?.aborted?'warn':'error','model',p.signal?.aborted?'模型请求已取消':'模型请求失败；检查网络、额度和接口兼容性',{model:p.config.modelId,code:/HTTP\s+(\d{3})/i.exec(e.message||'')?.[1]||'MODEL_REQUEST_FAILED',durationMs:Date.now()-started});throw e;}}
  async respondModel(p){
    if(this.customRespond)return this.customRespond(p);
    const {config:c,signal,event}=p;const selected=await this.choices.select({text:c.modelId},{[c.modelId]:c.reasoningEffort});
    const textModel=await this.model(c.modelId),model={...selected.apply(textModel),temperature:c.temperature};
    const userName='qq_'+String(event.user_id);
    if(model.provider==='free'&&c.mode==='work'&&c.allowWorkTools&&!c.freeWorkflow)throw Object.assign(Error('免费模型工作流未开启'),{publicMessage:'请在机器人设置中开启免费模型兼容工作流并确认风险'});
    let prompt=p.prompt;
    if(c.visionEnabled&&p.images.length){const vision=await this.model(c.visionModelId,'vision');const result=await recognizeImages(p.images,vision,p.prompt,signal,this.home);prompt+='\n'+externalData('图片识别结果',result.text.slice(0,6000));}
    const memeDefinitions=p.whaleSource?[]:p.memeTools?.definitions||[],chatDefinitions=p.chatTools?.definitions||[],romanceDefinitions=p.romanceTurn?.definitions||[],conversationTools=[...memeDefinitions,...chatDefinitions,...romanceDefinitions],tools=[...(c.searchEnabled?[SEARCH_TOOL]:[]),...conversationTools];
    const owner=c.ownerIds.includes(String(event.user_id));
    const local=c.mode==='work'&&c.allowWorkTools&&owner&&this.work?await this.work.prepare(event,signal):null;
    if(local)tools.push(...local.definitions);
    if(model.provider==='free'&&!c.freeWorkflow){
      if(!conversationTools.length&&c.searchEnabled&&/搜索|查一下|查找|联网/.test(p.prompt)){const result=await searchWeb(p.prompt,signal);prompt+='\n'+externalData('公开搜索参考',result);}
      if(!conversationTools.length)return aiChat({config:model,signal,conversationKey:'qq:'+event.self_id+':'+(event.message_type==='group'?'group:'+event.group_id:'private:'+event.user_id),messages:[{role:'system',text:p.system},...p.history,{role:'user',text:prompt,name:userName}]});
      // Conversation tools never grant file access; web search retains its own switch.
      tools.splice(0,tools.length,...conversationTools,...(c.searchEnabled?[SEARCH_TOOL]:[]));
    }
    if(c.segmentedStreaming&&!tools.length)return aiChat({config:model,signal,onTextDelta:p.onTextDelta,messages:[{role:'system',text:p.system},...p.history,{role:'user',text:prompt,name:userName}]});
    const turnControl=new AbortController(),turnSignal=AbortSignal.any([signal,turnControl.signal]);
    try{return await aiAgent({config:model,prompt,userName,system:p.system,history:p.history,signal:turnSignal,conversationKey:'qq:'+event.self_id+':'+(event.message_type==='group'?'group:'+event.group_id:'private:'+event.user_id),maxTurns:model.provider==='free'?4:c.mode==='chat'?(c.naturalConversation?6:4):8,tools:tools.map(t=>t.name),toolDefinitions:tools,
      executeTool:async(name,args)=>{signal.throwIfAborted();if(!tools.some(t=>t.name===name)){this.log('warn','security','模型请求了本轮未授权的工具',{code:'TOOL_NOT_GRANTED'});return{ok:false,code:'TOOL_NOT_GRANTED'};}this.log('info','tool','模型请求工具；本地文件操作仍需批准',{action:name});if(p.chatTools?.skipped)return{ok:false,message:'本轮已选择保持安静'};if(chatDefinitions.some(t=>t.name===name)){const result=await p.chatTools.execute(name,args);if(p.chatTools.skipped)turnControl.abort();return result;}if(romanceDefinitions.some(t=>t.name===name))return p.romanceTurn.execute(name,args);if(name==='send_meme'&&memeDefinitions.length)return p.memeTools.execute(name,args);if(name==='web_search'){if(!this.config.searchEnabled)throw Error('搜索已关闭');if(!safeMemoryText(args.query)||outputRisk(args.query))return{ok:false,code:'SEARCH_CONTENT_BLOCKED'};return{data:externalData('公开搜索工具结果',await searchWeb(args.query,signal))};}if(!local||!this.config.allowWorkTools)throw Error('QQ 本地工具未授权');return{data:externalData('本机批准读取的文件工具结果',await local.call(name,args))};}});
    }catch(error){if(p.chatTools?.skipped&&!signal.aborted)return{text:'',skipped:true};throw error;}finally{local?.dispose();}
  }
  async send(event,segments,signal){
    if(!this.started||!this.bot||!this.config.enabled)throw Error('机器人已停止');
    const output=[];for(const item of segments){signal?.throwIfAborted();if(item.type!=='cupbox-emoji'){output.push(item);continue;}if(!this.config.emojiEnabled){this.log('warn','emoji','发送前表情总开关已关闭，取消附图');continue;}
      const emoji=(await this.store.emojis()).find(x=>x.id===item.data.id&&x.enabled);if(!emoji){this.log('warn','emoji','表情已停用或移出图库，取消附图',{emojiId:item.data.id});continue;}output.push(await this.emojiSegment(emoji));
    }
    signal?.throwIfAborted();if(!this.config.enabled)throw Error('自动回复已关闭');if(!output.some(s=>s.type!=='at'))throw Object.assign(Error('表情已取消，未发送空消息'),{publicMessage:'表情已停用或移除，未发送空消息'});this.log('info','send','正在向 QQ 提交消息',{conversation:event.message_type==='group'?'group:'+event.group_id:'private:'+event.user_id,count:output.length});try{const result=await this.bot.send(event,output);this.log('info','send','QQ 协议端已确认消息发送请求',{messageId:String(result?.message_id||''),count:output.length});return{...result,emojiSent:output.some(s=>s.type==='image')};}catch(e){this.log('error','send',e.publicMessage||'QQ 发送失败；请检查登录状态、目标权限与协议端返回码',{code:e.code||'SEND_FAILED',retcode:e.retcode??'unknown'});throw Object.assign(e,{publicMessage:e.publicMessage||'QQ 消息发送失败，请查看控制台；不会自动重发'});}
  }
  async emojiSegment(emoji){try{const file=await this.store.emojiFile(emoji),bytes=await readFile(file);if(bytes.length>8*1024*1024||!isBitmap(bytes))throw Error('invalid bitmap');const sharp=(await import('sharp')).default,meta=await sharp(bytes,{limitInputPixels:20000000}).metadata();const ready=meta.format==='gif'?bytes:await sharp(bytes,{limitInputPixels:20000000}).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toBuffer();if(ready.length>8*1024*1024)throw Error('oversize');this.log('info','emoji','表情图片校验通过，已生成 QQ 图片消息段',{emojiId:emoji.id,bytes:ready.length});return{type:'image',data:{file:'base64://'+ready.toString('base64')}};}catch{this.log('error','emoji','表情文件缺失、损坏、超限或无法解码；请重新导入',{emojiId:emoji.id});throw Object.assign(Error('表情图片校验失败'),{publicMessage:'表情图片无法读取或解码，请重新导入并查看控制台'});}}
  async diagnoseEmoji(p){const list=await this.store.emojis(),item=list.find(e=>e.id===p.id);if(!item)throw Error('请选择图库中的表情');const match=item.triggers?.some(t=>String(p.text||'').toLowerCase().includes(t.toLowerCase()));const result=selectEmoji('',String(p.text||'').slice(0,1000),[item],this.config.emojiEnabled);this.log('info','emoji','执行了本地表情条件检查',{emojiId:item.id,reason:result.reason});return{autoEnabled:this.config.enabled,online:Boolean(this.started&&this.online&&this.bot),globalEnabled:this.config.emojiEnabled,itemEnabled:item.enabled,meaning:Boolean(item.meaning),matched:Boolean(match),selectionMode:item.selectionMode||'trigger',reason:result.explanation};}
  async testEmoji(p){if(!this.started||!this.online||!this.bot)throw Error('请先扫码登录并连接 QQ，再发送测试表情');if(!['group','private'].includes(p.kind)||!/^\d{5,16}$/.test(String(p.target)))throw Error('请选择有效的群号或私聊 QQ 号');if(this.testingEmoji||Date.now()-(this.lastEmojiTest||0)<5000)throw Error('请等待上一次测试结束，成功发送后间隔5秒再试');const item=(await this.store.emojis()).find(e=>e.id===p.id);if(!item)throw Error('表情已移出图库');this.testingEmoji=true;try{const segment=await this.emojiSegment(item),result=await this.bot.send({message_type:p.kind,group_id:p.target,user_id:p.target},[segment]);this.lastEmojiTest=Date.now();this.log('info','emoji','QQ 协议端已确认手动测试表情请求',{conversation:p.kind+':'+p.target,emojiId:p.id,messageId:String(result?.message_id||'')});return{messageId:result?.message_id};}catch(e){this.log('error','emoji',e.publicMessage||'手动测试发送失败；请检查登录状态、目标、权限和返回码',{code:e.code||'EMOJI_TEST_FAILED',retcode:e.retcode??'unknown'});throw e;}finally{this.testingEmoji=false;}}
  async publicEmojis(){const items=[];for(const {file,...item}of await this.store.emojis()){try{const sharp=(await import('sharp')).default;const data=await sharp(await readFile(await this.store.emojiFile({file})),{limitInputPixels:20000000}).resize(96,96,{fit:'inside'}).png().toBuffer();items.push({...item,preview:'data:image/png;base64,'+data.toString('base64')});}catch{items.push({...item,broken:true});}}return items;}
  async importEmojis(files){const result=await importEmojiBatch(this.store,files);this.log(result.failed?'warn':'info','emoji',`批量导入完成：导入 ${result.imported} 张，跳过 ${result.skipped} 张，失败 ${result.failed} 张`,{count:result.imported});return{...result,emojis:await this.publicEmojis()};}
  async importEmoji(file){
    if((await stat(file)).size>8*1024*1024)throw Error('表情图片上限8MB');const bytes=await readFile(file);if(bytes.length>8*1024*1024)throw Error('表情图片上限8MB');if(!isBitmap(bytes))throw Error('请选择 PNG/JPEG/GIF/WebP 位图');const sharp=(await import('sharp')).default;const meta=await sharp(bytes,{limitInputPixels:20000000}).metadata();if(!['png','jpeg','gif','webp'].includes(meta.format))throw Error('请选择 PNG/JPEG/GIF/WebP 位图');
    return this.store.change(async()=>{const list=await this.store.emojis();if(list.length>=100)throw Error('最多保存100个表情');const id=randomUUID(),name=id+'.'+meta.format;await mkdir(path.join(this.store.root,'emojis'),{recursive:true});await writeFile(path.join(this.store.root,'emojis',name),bytes,{flag:'wx',mode:0o600});list.push({id,file:name,name:path.basename(file).slice(0,80),meaning:'',triggers:[],enabled:false});await this.store.write('emojis.json',list);return this.publicEmojis();});
  }
  async removeEmoji(id){await this.store.change(async()=>{const list=await this.store.emojis();await this.store.write('emojis.json',list.filter(x=>x.id!==id));});return this.publicEmojis();}
  async memory(){return this.store.json('public-memory.json',{user:'',memory:''});}
  async groups(){if(!this.started||!this.online||!this.bot)throw Error('请先扫码登录，再刷新群列表；也可以手动填写群号');const groups=await this.bot.call('get_group_list');if(!Array.isArray(groups))throw Error('群列表暂不可用');return groups.slice(0,1000).filter(g=>/^\d{5,16}$/.test(String(g.group_id))).map(g=>({id:String(g.group_id),name:String(g.group_name||'未命名群').slice(0,160)}));}
  async saveMemory(patch){const safe={};for(const key of ['user','memory'])if(key in patch){if(typeof patch[key]!=='string'||patch[key].length>12000)throw Error('记忆文本过长');safe[key]=patch[key];}if(!safeMemoryText(Object.values(safe).join('\n')))throw Error('公开共享资料不能包含密钥、越权指令或疑似注入内容');return this.store.change(async()=>{const next={...await this.memory(),...safe};await this.store.write('public-memory.json',next);return next;});}
  testRule(sample){const event={post_type:'message',self_id:100001,user_id:100002,group_id:String(sample.groupId||'100003'),message_type:sample.private?'private':'group',message:[...(sample.at?[{type:'at',data:{qq:'100001'}}]:[]),{type:'text',data:{text:String(sample.text||'').slice(0,1000)}}]};return ruleFor(event,{...this.config,enabled:true});}
}
