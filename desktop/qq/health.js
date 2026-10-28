import {sleeping} from './sleep.js';
import {readDiskUsage} from './disk-health.js';
export class BotHealth{
 constructor(service,{clock=Date.now,diskReader=readDiskUsage}={}){this.service=service;this.clock=clock;this.diskReader=diskReader;this.disk=null;this.diskGeneration=0;this.issues=new Map();this.history=[];this.generatedAt=0;this.offlineSince=0;}
 async refreshDisk(){
  if(!this.service.store?.home)return;
  if(this.diskPending)return this.diskPending;
  const generation=this.diskGeneration;
  const task=(async()=>{try{const disk=await this.diskReader(this.service.store.home);if(generation===this.diskGeneration)this.disk={...disk,error:false};}catch{if(generation===this.diskGeneration)this.disk={error:true,checkedAt:this.clock()};}})();
  this.diskPending=task;try{await task;}finally{if(this.diskPending===task)this.diskPending=null;}
 }
 start(){if(this.timer)return;this.sample();void this.refreshDisk().then(()=>{if(this.timer){this.sample();this.service.emit();}});this.timer=setInterval(()=>{void this.refreshDisk().then(()=>{if(this.timer){this.sample();this.service.emit();}});},30000);this.timer.unref?.();}
 stop(){for(const row of this.issues.values())this.alert(row,'clear');clearInterval(this.timer);this.timer=null;this.offlineSince=0;this.diskGeneration++;this.diskPending=null;}
 sample(){
  const s=this.service,now=this.clock(),found=new Map(),issue=(id,title,detail,page)=>found.set(id,{id,title,detail,page,level:'warn'});
  if(this.disk?.error)issue('disk-read','无法读取磁盘余量','请检查数据目录所在磁盘的可用空间；本次未取得有效磁盘信息。','health');
  else if(this.disk?.usedPercent>=85){issue('disk','数据磁盘空间不足',`数据目录所在磁盘已用 ${this.disk.usedPercent.toFixed(1)}%，可用 ${(this.disk.availableBytes/1024**3).toFixed(2)} GB。${this.disk.usedPercent>=92?'请尽快备份并清理无关文件，避免记忆、日记或配置写入失败。':'建议预留足够空间供记忆、日志和媒体使用。'}应用不会自动删除文件。`,'health');if(this.disk.usedPercent>=92)found.get('disk').level='error';}
  if(s.started&&!s.online){this.offlineSince||=now;if(now-this.offlineSince>=(s.alertOfflineAfterMs?.()||60000))issue('offline','连接持续未就绪','已超过设置的持续离线时长，请检查扫码、QQ登录状态或平台凭证。','overview');}else this.offlineSince=0;
  for(const [stage,title]of [['model','模型连续失败'],['send','消息连续发送失败']]){const entries=(s.logger?.entries||[]).filter(e=>e.stage===stage&&now-e.at<300000),lastSuccess=Math.max(0,...entries.filter(e=>e.level==='info'&&/响应完成|确认消息/.test(e.message)).map(e=>e.at)),failures=entries.filter(e=>e.level==='error'&&e.at>=lastSuccess);if(failures.length>=3)issue(stage,title,'最近5分钟至少3次失败，请检查连接、模型额度和运行日志；不会自动重发结果未知的消息。',stage==='model'?'models':'console');}
  if((s.engine?.queued||0)>=20)issue('queue','待回复队列积压','排队已达到20条，请检查模型延迟和发送节奏。','chat');
  const latestModel=(s.logger?.entries||[]).filter(e=>e.stage==='model'&&now-e.at<180000&&Number(e.details?.durationMs)>0&&/响应完成|请求失败/.test(e.message)).at(-1);
  if(latestModel?.details.durationMs>=15000)issue('model-latency','模型响应较慢','最近一次模型请求耗时约'+Math.round(latestModel.details.durationMs/1000)+'秒；此为模型接口耗时，后续消息可能排队。可在模型与能力中选择延迟更低的连接。','models');
  if(s.diagnosticArchive?.error)issue('archive','本机诊断保存失败','实时日志仍可查看，请检查磁盘空间和目录写入权限。','console');
  if(s.loopGuard?.status().pauses.length)issue('loop','已触发互刷刹车','只暂停触发循环的用户会话，其他用户继续正常聊天；可等待2分钟或手动解除。','health');
  for(const [id,row]of found){const old=this.issues.get(id);row.since=old?.since||now;if(!old||old.level!==row.level){this.history.unshift({...row,at:now,status:'active'});this.alert(row,'active');s.log(row.level,'health',row.title,{code:'HEALTH_'+id.toUpperCase(),reason:row.detail});}}
  for(const [id,row]of this.issues)if(!found.has(id)){this.history.unshift({...row,at:now,status:'resolved'});this.alert(row,id==='offline'&&!s.online?'clear':'resolved');s.log('info','health',row.title+'：已恢复',{code:'HEALTH_RECOVERED'});}
  this.issues=found;this.history=this.history.slice(0,50);this.generatedAt=now;return this.snapshot();
 }
 alert(row,status){const type=({offline:'qq-offline',model:'model',send:'send',disk:'disk',queue:'queue',archive:'archive',loop:'loop'})[row.id];if(type)try{Promise.resolve(this.service.onAlert?.({type,key:row.id,status})).catch(()=>{});}catch{}}
 snapshot(){return{generatedAt:this.generatedAt,disk:this.disk,issues:[...this.issues.values()],history:this.history,guard:this.service.loopGuard?.status()||{blocked:0,pauses:[]}};}
 async report(){
  await this.refreshDisk();this.sample();const s=this.service,c=s.config,[models,emojis,memories]=await Promise.all([s.choices.records(),s.store.emojis(),s.autoMemory.inventory()]);
  const model=models.all.find(m=>m.id===c.modelId&&m.enabled!==false),check=(id,title,status,detail,page)=>({id,title,status,detail,page});
  const checks=[check('connection','平台连接',s.online?'ok':s.started?'warn':'idle',s.online?'当前消息通道在线':s.started?'等待通道就绪':'尚未启动，当前不会自动回复','overview'),check('replies','自动回复',c.enabled?'ok':'idle',c.enabled?'已开启，沿用当前回复范围':'已暂停；可先完成配置','rules'),check('model','聊天模型',model?'ok':'warn',model?'已选择可用模型；本次体检不发起付费请求':'未找到已启用的模型，请检查模型选择','models'),check('memory','长期记忆与去重',c.retainDialogue?'ok':'idle',`已有 ${memories.length} 份会话档案；支持本地去重与AI去重预览`,'memory'),check('diary','AI 日记',c.qqDiaryEnabled?'ok':'idle',c.qqDiaryEnabled?'后台日记已开启，写入本机':'默认关闭，可在主动陪伴中开启','background'),check('outreach','主动聊天',c.outreachEnabled||c.proactiveEnabled?'ok':'idle','支持主动私聊、群聊参与、问候与催睡；按指定名单和额度执行','background'),check('music','点歌语音',c.qqMusicEnabled?'ok':'idle',c.qqMusicSource==='echo'?'Meting多平台公开曲库，先获取音频文件再转换为QQ语音发送':'当前使用本机常听歌曲','music'),check('emoji','表情库',c.emojiEnabled&&emojis.some(e=>e.enabled)?'ok':'idle',`${emojis.length} 张已导入，${emojis.filter(e=>e.enabled).length} 张可使用；容量1000张，不把容量当作现有素材数`,'emoji'),check('guard','多账号互刷刹车',c.loopGuardEnabled?'ok':'warn',c.loopGuardEnabled?'自动识别本机QQ机器人，重复问答仅暂停对应会话':'互刷保护已关闭','health'),check('sleep','睡眠回复',sleeping(c)?'idle':'ok',sleeping(c)?'当前处于睡眠时段，按预设回复，不请求AI':'当前不在睡眠时段','chat')];
  return{...this.snapshot(),checks,generatedAt:this.clock(),notice:'体检只读本机状态，不测试外部模型、不发送QQ消息；未启用的可选功能不是故障。'};
 }
}
