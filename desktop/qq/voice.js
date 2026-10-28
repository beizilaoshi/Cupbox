import {existsSync} from 'node:fs';

export const VOICE_DEFAULTS={ttsEnabled:false,ttsLanguage:'auto',ttsEndpoint:'http://127.0.0.1:9880/tts',ttsJaEndpoint:'http://127.0.0.1:9881/tts',ttsRefsDir:'',ttsJaRefsDir:'',ttsPrompt:'你的选择创造了我，所以我的存在本身就是你的善意。',ttsJaPrompt:'これは儀式でもあるの。君に私の存在を感じてもらうための儀式ね。',ttsEmotion:false,ttsSpeed:1,ttsMaxChars:500,ttsTimeout:60};
export function validateVoice(c){
  if(!['auto','zh','ja'].includes(c.ttsLanguage))throw Error('语音语言无效');
  for(const key of ['ttsEndpoint','ttsJaEndpoint']){if(typeof c[key]!=='string')throw Error('Invalid TTS endpoint');let u;try{u=new URL(c[key]);}catch{throw Error('语音接口地址无效');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||c[key].length>500)throw Error('语音接口需为不带凭据、查询参数的 HTTP/HTTPS 地址');}
  for(const key of ['ttsRefsDir','ttsJaRefsDir','ttsPrompt','ttsJaPrompt'])if(typeof c[key]!=='string'||c[key].length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(c[key]))throw Error('参考音目录或对应台词无效');
  for(const [key,min,max]of [['ttsSpeed',.5,2],['ttsMaxChars',50,2000],['ttsTimeout',5,90]]){const n=Number(c[key]);if(!Number.isFinite(n)||n<min||n>max||key!=='ttsSpeed'&&!Number.isInteger(n))throw Error('语音参数超出范围：'+key);c[key]=n;}
  if(c.ttsEnabled){for(const lang of c.ttsLanguage==='auto'?['zh','ja']:[c.ttsLanguage])if(!(lang==='ja'?c.ttsJaRefsDir:c.ttsRefsDir).trim()||!(lang==='ja'?c.ttsJaPrompt:c.ttsPrompt).trim())throw Error('请填写所选语言的参考音目录及对应台词；只有中文音色时请选择中文');}
}
export function speechText(text){return String(text).replace(/```[\s\S]*?```/g,' ').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/gi,' ').replace(/\[(?:表情|生图|语音|record)[^\]]*\]/gi,' ').replace(/<[^>]*>/g,' ').replace(/[`*_#>~|]/g,' ').replace(/\s+/g,' ').trim();}
export function voiceLanguage(text,c){return c.ttsLanguage==='auto'?(/[\u3040-\u30ff]/u.test(text)?'ja':'zh'):c.ttsLanguage;}
export function voiceStyle(text){if(/晚安|想睡|困了|sleepy|good night|眠い|寝る/i.test(text))return'sleepy';if(/生气|讨厌|难过|伤心|害怕|委屈|孤单|sad|angry|lonely/i.test(text))return'wronged';if(/开心|喜欢|谢谢|可爱|happy|love|thank|嬉しい/i.test(text))return'excited';return'calm';}
const MAX_BYTES=8*1024*1024;
export function assertVoiceWav(bytes){
  if(bytes.length<44||bytes.length>MAX_BYTES||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('语音服务未返回有效 WAV（上限8MB）');
  let fmt=false,data=false;for(let offset=12;offset+8<=bytes.length;){const name=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4);if(offset+8+size>bytes.length)throw Error('WAV 音频不完整');if(name==='fmt '&&size>=16)fmt=bytes.readUInt16LE(offset+8)===1&&bytes.readUInt16LE(offset+10)>0&&bytes.readUInt32LE(offset+12)>0;if(name==='data'&&size>0)data=true;offset+=8+size+(size%2);}if(!fmt||!data)throw Error('语音服务需返回非空 PCM WAV');
}
export async function synthesizeVoice(text,c,{signal,userText='',fetcher=fetch}={}){
  const spoken=speechText(text);if(!spoken)throw Error('没有可朗读的文字');if([...spoken].length>c.ttsMaxChars)throw Error('本轮文字超过语音字数上限，保留完整文字、不截断朗读');
  const language=voiceLanguage(spoken,c),endpoint=language==='ja'?c.ttsJaEndpoint:c.ttsEndpoint,dir=(language==='ja'?c.ttsJaRefsDir:c.ttsRefsDir).trim(),prompt=(language==='ja'?c.ttsJaPrompt:c.ttsPrompt).trim();if(!dir||!prompt)throw Error('请先配置参考音目录和对应台词');
  // These paths are interpreted by the configured TTS server, never by the model.
  const join=(file)=>dir.replace(/[\\/]+$/,'')+(dir.includes('\\')?'\\':'/')+file,local=['127.0.0.1','localhost','[::1]'].includes(new URL(endpoint).hostname),reference=join('calm-reference.wav'),aux=[];
  if(local&&!existsSync(reference))throw Error('未找到主参考音 calm-reference.wav，请检查目录');
  const style=c.ttsEmotion?voiceStyle(userText+'\n'+spoken):'calm',extra=style!=='calm'?join(style+'-reference.wav'):language==='ja'?join('calm-aux-reference.wav'):null;
  if(extra&&local&&existsSync(extra))aux.push(extra);
  // Remote references cannot be checked locally. Emotion refs are explicitly enabled by the user.
  if(extra&&!local&&c.ttsEmotion&&style!=='calm')aux.push(extra);
  const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(c.ttsTimeout*1000)]):AbortSignal.timeout(c.ttsTimeout*1000);combined.throwIfAborted();
  let response;try{response=await fetcher(endpoint,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({text:spoken,text_lang:language,ref_audio_path:reference,aux_ref_audio_paths:aux,prompt_lang:language,prompt_text:prompt,text_split_method:'cut0',batch_size:1,media_type:'wav',streaming_mode:false,seed:42,speed_factor:c.ttsSpeed}),signal:combined});}catch(e){if(combined.aborted)throw Error('语音生成已取消或超时');throw Error('无法连接语音服务，请确认 GPT-SoVITS api_v2 已启动');}
  if(!response.ok){await response.body?.cancel();throw Error('语音服务返回 HTTP '+response.status+'，请检查模型及参考音配置');}
  if(Number(response.headers.get('content-length'))>MAX_BYTES){await response.body?.cancel();throw Error('语音超过8MB');}
  const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){combined.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw Error('语音超过8MB');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}
  const bytes=Buffer.concat(chunks);assertVoiceWav(bytes);return{bytes,language,style,characters:[...spoken].length};
}
