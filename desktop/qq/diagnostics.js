import path from 'node:path';
import {mkdir,lstat,readFile,appendFile,rename,unlink} from 'node:fs/promises';
import {BotLogger} from './logger.js';
const LIMIT=1024*1024;
export class DiagnosticArchive{
  constructor(root){this.root=root;this.file=path.join(root,'diagnostics.jsonl');this.previous=path.join(root,'diagnostics.previous.jsonl');this.pending=Promise.resolve();this.error='';this.scrubber=new BotLogger(()=>{},1);this.suspended=false;}
  safe(entry){const clean=this.scrubber.add(entry.level,entry.stage,entry.message,entry.details);return{...clean,at:Number.isFinite(entry.at)?entry.at:clean.at};}
  async check(file){try{const info=await lstat(file);if(info.isSymbolicLink()||file!==this.root&&!info.isFile())throw Error('诊断存储路径类型无效');return info;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  append(entry){if(this.suspended)return this.pending;entry=this.safe(entry);const run=this.pending.catch(()=>{}).then(async()=>{
    await mkdir(this.root,{recursive:true});await this.check(this.root);const info=await this.check(this.file);if(info&&info.size>=LIMIT){await this.check(this.previous);await unlink(this.previous).catch(e=>{if(e.code!=='ENOENT')throw e;});await rename(this.file,this.previous);}
    await appendFile(this.file,JSON.stringify(entry)+'\n',{mode:0o600});this.error='';
  });this.pending=run.catch(()=>{this.error='本地诊断记录写入失败，实时日志仍可查看';});return this.pending;}
  async recent(){await this.pending;const rows=[];for(const file of [this.previous,this.file]){const info=await this.check(file);if(!info)continue;if(info.size>LIMIT+65536)throw Error('诊断文件过大，请先备份检查');const text=await readFile(file,'utf8');for(const line of text.split('\n')){try{const row=JSON.parse(line);if(row&&typeof row.message==='string'&&typeof row.stage==='string'&&Number.isFinite(row.at))rows.push(this.safe(row));}catch{}}}return rows.slice(-1000);}
}
export function diagnosticSummary(entries){
  const stages={},codes={};for(const e of entries){stages[e.stage]=(stages[e.stage]||0)+1;if(e.details?.code)codes[e.details.code]=(codes[e.details.code]||0)+1;}
  const errors=entries.filter(e=>['warn','error'].includes(e.level)).slice(-20),suggestions=[];
  if(Object.keys(codes).some(c=>/ONEBOT_(DISCONNECTED|OFFLINE|TIMEOUT)/.test(c))||entries.some(e=>e.stage==='connection'&&/离线|断开|心跳/.test(e.message)))suggestions.push('存在离线、心跳或接口超时记录：先核对QQ客户端登录和协议端连接；发送结果未知时先查QQ消息，不自动重发。');
  if(Object.keys(codes).some(c=>/^OFFICIAL_/.test(c)))suggestions.push('官方接入有异常：核对AppID、AppSecret、沙箱测试成员、出口IP白名单、发布状态与消息配额。过期回复需等待用户重新发消息，不主动补发。');
  if(entries.some(e=>e.stage==='asr'&&e.level==='warn'))suggestions.push('语音识别有失败记录：检查音频模型连接、get_record转码、时长与频率限制。');
  if(entries.some(e=>e.stage==='security'||e.stage==='plugin'&&e.level==='warn'))suggestions.push('存在输入或输出拦截：查看对应规则；被拦截不等于模型未返回。');
  return{stages,codes,errors,suggestions,recentDecisions:entries.filter(e=>['engine','send','asr','model','connection','scheduler'].includes(e.stage)).slice(-40)};
}
