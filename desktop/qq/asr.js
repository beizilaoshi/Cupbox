import path from 'node:path';
import {realpath,stat,readFile} from 'node:fs/promises';
import {assertVoiceWav} from './voice.js';
import {inspectUntrusted,outputRisk} from './security.js';
import {requestHTTP} from '../workbench/http.js';

export const ASR_DEFAULTS={asrEnabled:false,asrModelId:'',asrLanguage:'auto',asrTimeout:20,asrMaxSeconds:120,asrMaxPerMinute:8};
export function validateASR(c){
  if(typeof c.asrModelId!=='string'||c.asrModelId.length>200||c.asrEnabled&&!c.asrModelId.trim())throw Error('请为语音识别选择音频模型连接');
  if(!['auto','zh','en','ja','ko'].includes(c.asrLanguage))throw Error('语音识别语言无效');
  for(const [key,min,max]of [['asrTimeout',5,60],['asrMaxSeconds',10,180],['asrMaxPerMinute',1,30]])if(!Number.isInteger(c[key])||c[key]<min||c[key]>max)throw Error('语音识别参数超出范围：'+key);
}
const MAX=8*1024*1024;
export function audioDuration(bytes){assertVoiceWav(bytes);let rate=0,size=0;for(let pos=12;pos+8<=bytes.length;){const kind=bytes.toString('ascii',pos,pos+4),n=bytes.readUInt32LE(pos+4);if(kind==='fmt '){const channels=bytes.readUInt16LE(pos+10),sampleRate=bytes.readUInt32LE(pos+12),bits=bytes.readUInt16LE(pos+22),block=bytes.readUInt16LE(pos+20);rate=bytes.readUInt32LE(pos+16);if(![8,16,24,32].includes(bits)||channels>8||sampleRate<8000||sampleRate>192000||block!==channels*bits/8||rate!==sampleRate*block)throw Error('语音PCM速率参数无效');}if(kind==='data')size+=n;pos+=8+n+(n%2);}if(!rate||!size)throw Error('语音长度无法确认');return size/rate;}
export async function recordBytes(record,{mediaRoot,signal,download=requestHTTP}={}){
  signal?.throwIfAborted();
  if(typeof record?.base64==='string'){
    const value=record.base64.replace(/^base64:\/\//,'');if(value.length>Math.ceil(MAX/3)*4||!value||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('语音数据无效或超过8MB');
    return Buffer.from(value,'base64');
  }
  if(typeof record?.file==='string'&&path.isAbsolute(record.file)){
    if(!mediaRoot)throw Error('未配置受信任的协议端媒体目录');
    const root=await realpath(mediaRoot),file=await realpath(record.file),relative=path.relative(root,file);
    if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||path.extname(file).toLowerCase()!=='.wav')throw Error('语音路径不在协议端媒体目录内');
    const info=await stat(file);if(!info.isFile()||info.size>MAX)throw Error('语音文件无效或超过8MB');
    const bytes=await readFile(file);if(bytes.length>MAX)throw Error('语音超过8MB');return bytes;
  }
  if(typeof record?.url==='string'){
    const result=await download({url:record.url,responseType:'binary',maxBytes:MAX,timeoutMs:12000},{signal});
    if(result.status!==200||result.truncated||!result.bytes||result.bytes.length>MAX)throw Error('语音下载失败或超过8MB');return result.bytes;
  }
  throw Error('协议端没有提供可读取的 WAV；请检查 get_record 转码能力');
}
export async function transcribeAudio(bytes,model,c,{signal,fetcher=fetch}={}){
  const duration=audioDuration(bytes);if(duration>c.asrMaxSeconds)throw Error('语音超过设置的识别时长');
  if(!model||model.provider!=='openai-compatible'||!model.capabilities?.includes('audio'))throw Error('语音识别需要 OpenAI 兼容的音频模型连接');
  const url=new URL(model.baseUrl.replace(/\/+$/,'')+'/audio/transcriptions');if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('语音识别接口地址无效');
  const form=new FormData();form.set('model',model.model);form.set('response_format','json');form.set('file',new Blob([bytes],{type:'audio/wav'}),'qq-message.wav');if(c.asrLanguage!=='auto')form.set('language',c.asrLanguage);
  const response=await fetcher(url.href,{method:'POST',redirect:'error',headers:model.apiKey?{authorization:'Bearer '+model.apiKey}:{},body:form,signal});
  if(!response.ok){await response.body?.cancel();throw Object.assign(Error('语音识别服务返回 HTTP '+response.status),{code:'ASR_HTTP_'+response.status});}
  const parts=[];let size=0;for await(const chunk of response.body){signal?.throwIfAborted();size+=chunk.length;if(size>65536){await response.body.cancel().catch(()=>{});throw Error('语音识别结果过长');}parts.push(chunk);}
  let data;try{data=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Error('语音识别服务没有返回有效 JSON');}
  const text=typeof data.text==='string'?data.text.trim():'';if(!text||text.length>6000)throw Error('语音未识别到有效文字或结果过长');
  if(inspectUntrusted(text).blocked||outputRisk(text))throw Object.assign(Error('语音转写命中输入保护，不进入模型或记忆'),{code:'ASR_INPUT_BLOCKED'});
  return{text,duration};
}
export class SpeechRecognizer{
  constructor({clock=Date.now}={}){this.clock=clock;this.controllers=new Set();this.pending=new Map();this.rate=[];this.last=new Map();this.generation=0;}
  cancel(){this.generation++;for(const controller of this.controllers)controller.abort();this.controllers.clear();this.pending.clear();}
  async recognize(event,c,{bot,model,mediaRoot,fetcher,download}={}){
    const records=(Array.isArray(event.message)?event.message:[]).filter(s=>s.type==='record');if(!records.length)return event;
    if(records.length>2)throw Error('每条消息最多识别两段语音');
    const key=[event.self_id,event.message_type,event.group_id||event.user_id,event.user_id,event.message_id??records.map(r=>r.data?.file).join('|')].join(':');
    const now=this.clock(),room=[event.self_id,event.message_type,event.group_id||event.user_id].join(':');
    for(const [id,p]of this.pending)if(p.expires<now)this.pending.delete(id);
    if(this.pending.has(key))return this.pending.get(key).promise;
    this.rate=this.rate.filter(at=>now-at<60000);if(this.controllers.size>=2||this.rate.length+records.length>c.asrMaxPerMinute||now-(this.last.get(room)||0)<c.cooldown*1000)throw Error('语音识别频率已达上限，请稍后再发');
    const controller=new AbortController(),generation=this.generation,signal=AbortSignal.any([controller.signal,AbortSignal.timeout(c.asrTimeout*1000)]);this.controllers.add(controller);this.rate.push(...records.map(()=>now));this.last.set(room,now);while(this.last.size>1000)this.last.delete(this.last.keys().next().value);
    const promise=(async()=>{const message=[];for(const segment of event.message){if(segment.type!=='record'){message.push(segment);continue;}const file=segment.data?.file;if(typeof file!=='string'||!file||file.length>200||!/^[\w.{}-]+$/.test(file)||file.includes('..'))throw Error('本轮语音编号无效');
      signal.throwIfAborted();const record=await bot.call('get_record',{file,out_format:'wav'});signal.throwIfAborted();const bytes=await recordBytes(record,{mediaRoot,signal,download});if(generation!==this.generation)throw Error('语音识别已取消');
      const result=await transcribeAudio(bytes,model,c,{signal,fetcher});signal.throwIfAborted();message.push({type:'text',data:{text:'\n[语音转写] '+result.text}});
    }return{...event,message};})().finally(()=>this.controllers.delete(controller));
    this.pending.set(key,{promise,expires:now+120000});while(this.pending.size>200)this.pending.delete(this.pending.keys().next().value);return promise;
  }
}
