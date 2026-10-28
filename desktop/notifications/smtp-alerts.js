import path from 'node:path';
import {mkdir,readFile,writeFile,rename,unlink,lstat} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
import {ALERT_TYPES,SMTP_PRESETS,defaultAlerts,validateAlerts,publicAlerts} from './smtp-settings.js';
const codeOf=e=>e?.code==='EAUTH'?'SMTP_AUTH':e?.code==='ETIMEDOUT'?'SMTP_TIMEOUT':/TLS|CERT|SSL|certificate|self.signed/i.test(String(e?.code||'')+' '+String(e?.cause?.code||'')+' '+String(e?.message||''))?'SMTP_TLS':e?.code==='EENVELOPE'?'SMTP_RECIPIENT':'SMTP_FAILED';
export const SMTP_ERRORS={SMTP_AUTH:'认证失败，请检查SMTP是否启用、账号和授权码。',SMTP_TIMEOUT:'连接或发送超时，请检查网络、端口；发送结果可能未知，不自动重试。',SMTP_TLS:'加密连接或证书验证失败，请检查主机名、端口、加密方式与系统时间。',SMTP_RECIPIENT:'发件人或收件人被服务器拒绝，请检查邮箱地址与发信权限。',SMTP_FAILED:'邮件操作失败，请检查SMTP服务、网络与邮箱发信限制；发送结果可能未知，不自动重试。'};
export class SMTPAlerts{
 constructor({home,encrypt,decrypt,createTransport=options=>nodemailer.createTransport(options),clock=Date.now}){
  Object.assign(this,{home,encrypt,decrypt,createTransport,clock});this.root=path.join(home,'notifications');this.config=defaultAlerts();this.ledger={claims:{},history:[]};this.pending=Promise.resolve();this.delivery=Promise.resolve();this.stopped=false;
 }
 change(fn){const task=this.pending.catch(()=>{}).then(fn);this.pending=task;return task;}
 async check(file){for(const p of [this.home,this.root,path.join(this.root,file)])try{if((await lstat(p)).isSymbolicLink())throw Error('邮件通知目录不能使用符号链接');}catch(e){if(e.code!=='ENOENT')throw e;}}
 async read(file,fallback){await this.check(file);try{const text=await readFile(path.join(this.root,file),'utf8');if(text.length>1000000)throw Error('SIZE');return JSON.parse(text);}catch(e){if(e.code==='ENOENT')return fallback;throw Error('邮件通知文件无法读取，请先备份并修复');}}
 async write(file,value){await mkdir(this.root,{recursive:true});await this.check(file);const dest=path.join(this.root,file),temp=dest+'.'+randomUUID()+'.tmp';try{await writeFile(temp,JSON.stringify(value),{flag:'wx',mode:0o600});await rename(temp,dest);}finally{await unlink(temp).catch(()=>{});}}
 init(){return this.ready||=this.change(async()=>{
  const record=await this.read('smtp.json',null);if(record){try{if(record.version!==1||typeof record.encrypted!=='string')throw Error('FORMAT');const config=JSON.parse(this.decrypt(Buffer.from(record.encrypted,'base64')));this.config=validateAlerts({...config,profiles:config.profiles.map(p=>({...p,password:p.password}))},config);this.config.revision=config.revision;}catch{throw Error('本机无法解密邮件配置，请检查系统加密服务或恢复原用户环境');}}
  const ledger=await this.read('delivery.json',{claims:{},history:[]});if(!ledger||typeof ledger.claims!=='object'||!ledger.claims||!Array.isArray(ledger.history))throw Error('邮件通知投递记录异常');this.ledger={...ledger,rates:Array.isArray(ledger.rates)?ledger.rates:[],running:ledger.running||{}};
 });}
 async state(){await this.init();await this.pending.catch(()=>{});return{settings:publicAlerts(this.config),presets:SMTP_PRESETS,events:ALERT_TYPES,history:this.ledger.history.slice(0,60),pending:this.queued||0};}
 async save(input){await this.init();return this.change(async()=>{const config=validateAlerts(input,this.config);let encrypted;try{encrypted=this.encrypt(JSON.stringify(config));if(!Buffer.isBuffer(encrypted)||!encrypted.length)throw Error('EMPTY');}catch{throw Error('系统加密不可用，无法保存邮箱授权码；不会保存明文');}await this.write('smtp.json',{version:1,encrypted:encrypted.toString('base64')});this.config=config;return{settings:publicAlerts(config)};});}
 options(p){return{host:p.host,port:p.port,secure:p.tls==='tls',requireTLS:p.tls==='starttls',auth:{user:p.user,pass:p.password},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,pool:false,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true};}
 async transport(p,fn){const t=this.createTransport(this.options(p));let timer;try{return await Promise.race([fn(t),new Promise((_,reject)=>{timer=setTimeout(()=>{t.close?.();reject(Object.assign(Error('SMTP_TIMEOUT'),{code:'ETIMEDOUT'}));},25000);})]);}finally{clearTimeout(timer);t.close?.();}}
 async verify(id){await this.init();const p=this.config.profiles.find(p=>p.id===id);if(!p)throw Error('请先保存邮箱配置');try{await this.transport(p,t=>t.verify());return{ok:true,message:'SMTP连接与认证通过；这不保证收件人一定能收到邮件。'};}catch(e){const code=codeOf(e);return{ok:false,code,message:SMTP_ERRORS[code]};}}
 async history(row){await this.change(async()=>{this.ledger.history.unshift({...row,at:this.clock()});this.ledger.history=this.ledger.history.slice(0,100);await this.write('delivery.json',this.ledger);});}
 async event({type,key,status='active',source='Cupbox'}){
  if(!Object.hasOwn(ALERT_TYPES,type)||!['active','resolved','clear'].includes(status))return{queued:0};await this.init();const jobs=await this.change(async()=>{
   const c=this.config;if(this.stopped||!c.enabled)return[];const jobs=[],now=this.clock(),scope=createHash('sha256').update(String(key||type)).digest('hex').slice(0,32);
   for(const p of c.profiles.filter(p=>p.enabled&&p.events.includes(type))){if((this.queued||0)+jobs.length>=50)break;const id=p.id+':'+type+':'+scope,old=this.ledger.claims[id];
    if(status!=='active'){
     if(!old)continue;old.active=false;old.silent=status==='clear';if(status==='clear'||!c.recovery||!old.notified||old.recoveryClaimed)continue;
    }else{
     if(old?.lastAt!==undefined&&now-old.lastAt<c.cooldownMinutes*60000)continue;
    }
    this.ledger.rates=this.ledger.rates.filter(r=>now-r.at<3600000);const attempts=this.ledger.rates.filter(r=>r.profileId===p.id).length;
    if(attempts>=c.maxPerHour)continue;
    const claim=status==='active'?{profileId:p.id,lastAt:now,active:true,notified:false,attempts:[...(old?.attempts||[]).filter(at=>now-at<3600000),now]}:{...old,attempts:[...(old.attempts||[]).filter(at=>now-at<3600000),now]};this.ledger.claims[id]=claim;
    if(status==='resolved')claim.recoveryClaimed=true;this.ledger.rates.push({profileId:p.id,at:now});
    jobs.push({id,eventKey:String(key||type),profileId:p.id,revision:c.revision,type,status,source:/^QQ:[a-z0-9-]{1,80}$/i.test(source)?source:'Cupbox',createdAt:now});
   }
   this.ledger.claims=Object.fromEntries(Object.entries(this.ledger.claims).sort((a,b)=>b[1].lastAt-a[1].lastAt).slice(0,1000));await this.write('delivery.json',this.ledger);return jobs;
  });for(const job of jobs)this.enqueue(job).catch(()=>{});return{queued:jobs.length};
 }
 enqueue(job){if((this.queued||0)>=50)return Promise.reject(Error('邮件队列已满，请稍后再试'));this.queued=(this.queued||0)+1;const task=this.delivery.catch(()=>{}).then(()=>this.deliver(job)).finally(()=>{this.queued--;});this.delivery=task.catch(()=>{});return task;}
 async deliver(job){
  const c=this.config,p=c.profiles.find(p=>p.id===job.profileId),claim=this.ledger.claims[job.id];if(this.stopped||!p||c.revision!==job.revision||!job.test&&(!c.enabled||!p.enabled||job.status==='active'&&!claim?.active))return{ok:false,message:'配置或故障状态已变化，已取消待发邮件'};
  const recovered=job.status==='resolved',subject=job.test?'[Cupbox] SMTP测试邮件':`[Cupbox${recovered?' 已恢复':' 告警'}] ${ALERT_TYPES[job.type]}`;
  const text=job.test?'这是一封由你在本机手动触发的测试邮件。':`${recovered?'故障已恢复':'检测到运行异常'}：${ALERT_TYPES[job.type]}\n来源：${job.source}\n时间：${new Date(job.createdAt).toLocaleString('zh-CN')}\n请在 Cupbox 的运行体检、控制台或对应任务中查看详情。`;
  let result;try{const sent=await this.transport(p,t=>t.sendMail({from:{name:p.fromName,address:p.from},bcc:p.to,subject,text:text+'\n\n邮件未附带聊天正文、任务内容、凭证或错误堆栈。',disableFileAccess:true,disableUrlAccess:true}));const accepted=sent.accepted?.length||0;if(!accepted)throw Object.assign(Error('REJECTED'),{code:'EENVELOPE'});result={ok:true,code:sent.rejected?.length?'SMTP_PARTIAL':'SMTP_ACCEPTED',message:sent.rejected?.length?'部分收件人被拒绝，其他地址已被服务器接受。':'SMTP服务器已接受邮件，请检查收件箱或垃圾邮件。'};}catch(e){const code=codeOf(e);result={ok:false,code,message:SMTP_ERRORS[code]};}
  let recoveredDuringSend=false;await this.change(async()=>{const row=this.ledger.claims[job.id];if(row&&job.status==='active'&&row.lastAt===job.createdAt){row.notified=result.ok;recoveredDuringSend=result.ok&&!row.active&&!row.silent&&!row.recoveryClaimed;}this.ledger.history.unshift({profileId:p.id,type:job.test?'test':job.type,status:job.status,at:this.clock(),code:result.code,ok:result.ok});this.ledger.history=this.ledger.history.slice(0,100);await this.write('delivery.json',this.ledger);});if(recoveredDuringSend)await this.event({type:job.type,key:job.eventKey,status:'resolved',source:job.source});return result;
 }
 async test(id){await this.init();if(!this.config.profiles.some(p=>p.id===id))throw Error('请先保存邮箱配置');const now=this.clock();this.testTimes||=new Map();if(this.testTimes.has(id)&&now-this.testTimes.get(id)<30000)throw Error('测试邮件请间隔30秒发送');this.testTimes.set(id,now);return this.enqueue({test:true,profileId:id,revision:this.config.revision,status:'test',createdAt:now});}
 async beginTask(id){await this.init();return this.change(async()=>{if(!this.config.enabled||!this.config.profiles.some(p=>p.enabled&&p.events.includes('task-error')))return;this.ledger.running[id]={id,at:this.clock()};await this.write('delivery.json',this.ledger);});}
 async finishTask(id,failed=false){await this.init();await this.change(async()=>{if(this.ledger.running[id]){delete this.ledger.running[id];await this.write('delivery.json',this.ledger);}});if(failed)return this.event({type:'task-error',key:id});}
 async recoverInterrupted(){await this.init();const ids=await this.change(async()=>{const ids=Object.keys(this.ledger.running);this.ledger.running={};if(ids.length)await this.write('delivery.json',this.ledger);return ids;});for(const id of ids)await this.event({type:'task-error',key:id});return ids.length;}
 stop(){this.stopped=true;}
 async shutdown(){this.stop();await this.init();await this.change(async()=>{this.ledger.running={};for(const row of Object.values(this.ledger.claims)){row.active=false;row.silent=true;}await this.write('delivery.json',this.ledger);});}
}
