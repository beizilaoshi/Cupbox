import {randomUUID} from 'node:crypto';
export const ALERT_TYPES={
 'qq-offline':'QQ／平台持续离线','task-error':'任务异常或交付不完整',model:'模型连续失败',send:'消息连续发送失败',disk:'磁盘空间不足',queue:'回复队列积压',archive:'诊断保存失败',loop:'机器人互刷保护',
};
export const SMTP_PRESETS=[
 {id:'qq',name:'QQ 邮箱',host:'smtp.qq.com',port:465,tls:'tls'},
 {id:'163',name:'网易 163',host:'smtp.163.com',port:465,tls:'tls'},
 {id:'126',name:'网易 126',host:'smtp.126.com',port:465,tls:'tls'},
 {id:'qqex',name:'腾讯企业邮箱',host:'smtp.exmail.qq.com',port:465,tls:'tls'},
 {id:'aliyun',name:'阿里云邮箱',host:'smtp.aliyun.com',port:465,tls:'tls'},
 {id:'gmail',name:'Gmail',host:'smtp.gmail.com',port:465,tls:'tls'},
 {id:'icloud',name:'iCloud',host:'smtp.mail.me.com',port:587,tls:'starttls'},
 {id:'custom',name:'自定义 SMTP',host:'',port:587,tls:'starttls'},
];
export const defaultAlerts=()=>({enabled:false,recovery:true,cooldownMinutes:30,offlineSeconds:60,maxPerHour:20,profiles:[],revision:0});
const clean=(value,max,label)=>{if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f]/.test(value))throw Error(label+'格式无效');return value.trim();};
const address=value=>{const v=clean(value,254,'邮箱地址');if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(v))throw Error('请填写不带显示名称的完整邮箱地址');return v;};
export function validateAlerts(input,previous=defaultAlerts()){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('邮件设置无效');
 const c=defaultAlerts();for(const key of ['enabled','recovery']){c[key]=input[key];if(typeof c[key]!=='boolean')throw Error('邮件开关无效');}
 for(const [key,min,max]of [['cooldownMinutes',1,1440],['offlineSeconds',30,3600],['maxPerHour',1,120]]){c[key]=Number(input[key]);if(!Number.isInteger(c[key])||c[key]<min||c[key]>max)throw Error('邮件参数超出范围：'+key);}
 if(!Array.isArray(input.profiles)||input.profiles.length>10)throw Error('最多保存10套发信邮箱');
 const ids=new Set();c.profiles=input.profiles.map(p=>{
  const old=previous.profiles.find(row=>row.id===p.id),id=p.id||randomUUID();
  if(!/^[a-z0-9-]{1,80}$/i.test(id)||ids.has(id)||p.id&&!old)throw Error('邮箱配置标识无效');ids.add(id);
  if(typeof p.enabled!=='boolean')throw Error('邮箱启用状态无效');
  const name=clean(p.name,60,'邮箱名称'),host=clean(p.host,253,'SMTP服务器');
  if(!name||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(host))throw Error('请填写邮箱名称与 SMTP 主机名，不要填写网址或路径');
  const port=Number(p.port);if(!Number.isInteger(port)||port<1||port>65535||!['tls','starttls'].includes(p.tls))throw Error('SMTP端口或加密方式无效');
  const user=clean(p.user,320,'SMTP账号'),from=address(p.from),fromName=clean(p.fromName||'Cupbox',60,'发件人名称');
  if(!user)throw Error('请填写SMTP登录账号');
  if(p.password!==undefined&&(typeof p.password!=='string'||p.password.length>1024||/[\x00-\x1f\x7f]/.test(p.password)))throw Error('邮箱授权码格式无效');
  const changedConnection=old&&(old.host!==host||old.user!==user||old.port!==port||old.tls!==p.tls||old.from!==from);
  if(changedConnection&&!p.password)throw Error('修改服务器、端口、加密、账号或发件地址时，请重新输入授权码');
  const password=p.password||old?.password;if(!password)throw Error('请填写邮箱SMTP授权码或应用专用密码');
  const to=[...new Set((Array.isArray(p.to)?p.to:String(p.to||'').split(/[,;，；\s]+/)).filter(Boolean).map(address))];if(!to.length||to.length>20)throw Error('每套邮箱需填写1～20个收件人');
  if(!Array.isArray(p.events)||p.events.some(t=>!Object.hasOwn(ALERT_TYPES,t))||!p.events.length)throw Error('每套邮箱至少选择一种告警');
  return{id,name,enabled:p.enabled,host,port,tls:p.tls,user,password,from,fromName,to,events:[...new Set(p.events)]};
 });
 if(c.enabled&&!c.profiles.some(p=>p.enabled))throw Error('开启邮件通知前，至少启用一套发信邮箱');
 c.revision=(previous.revision||0)+1;return c;
}
export function publicAlerts(c){return{...c,profiles:c.profiles.map(({password,...p})=>({...p,passwordSet:!!password}))};}
