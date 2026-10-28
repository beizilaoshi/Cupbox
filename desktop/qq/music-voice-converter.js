import path from 'node:path';
import {mkdir,mkdtemp,writeFile,unlink,rmdir,lstat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {Worker} from 'node:worker_threads';
import {requestHTTP} from '../workbench/http.js';
import {echoMusicAudioFile,musicURL} from './echo-music.js';
import {resolvePublicMusic,publicMusicURL} from './public-music.js';
import {musicPublicLookup} from './music-dns.js';
const MAX_SOURCE=10*1024*1024,MAX_PCM=600*24000*2;
export function audioFormat(bytes){
 if(bytes.length<12)throw Error('获取的音频文件为空或不完整');
 if(bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&224)===224&&(bytes[1]&6)!==0)return'mp3';
 if(bytes[0]===255&&(bytes[1]&246)===240)return'aac';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE')return'wav';
 if(bytes.toString('ascii',0,4)==='fLaC')return'flac';
 if(bytes.toString('ascii',0,4)==='OggS')return'ogg';
 if(bytes.toString('ascii',4,8)==='ftyp')return'mov';
 throw Error('音源不是可识别的音频文件，可能无播放权限或返回了加密内容');
}
export async function decodeMusicPCM(file,format,signal){
 signal?.throwIfAborted();const {default:ffmpeg}=await import('ffmpeg-static');if(!ffmpeg)throw Error('本机音频转换组件不可用');
 return new Promise((resolve,reject)=>{
  const child=spawn(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-threads','1','-protocol_whitelist','file,pipe','-f',format,'-i',file,'-vn','-ac','1','-ar','24000','-c:a','pcm_s16le','-f','s16le','pipe:1'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const chunks=[];let size=0,failure;const abort=()=>{failure=signal?.reason||Error('音频转换已取消');child.kill();},timer=setTimeout(()=>{failure=Error('音频解码超时');child.kill();},60000);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();child.stderr.resume();
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>MAX_PCM){failure=Error('歌曲超过10分钟，暂不作为QQ语音发送');child.kill();}else chunks.push(chunk);});
  child.on('error',()=>{failure=Error('无法启动本机音频转换组件');});
  child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(failure)return reject(failure);if(code!==0||!size||size%2)return reject(Error('音频文件无法解码，请检查音源格式与播放权限'));resolve(Buffer.concat(chunks));});
 });
}
export async function encodeMusicSilk(pcm,signal){
 signal?.throwIfAborted();return new Promise((resolve,reject)=>{
  const data=Uint8Array.from(pcm),worker=new Worker(new URL('./music-silk-worker.cjs',import.meta.url),{workerData:{pcm:data.buffer},transferList:[data.buffer]});let done=false;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();error?reject(error):resolve(value);},abort=()=>finish(signal?.reason||Error('语音编码已取消')),timer=setTimeout(()=>finish(Error('QQ语音编码超时')),60000);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  worker.on('message',r=>{const bytes=Buffer.from(r?.data||[]),header=bytes.indexOf(Buffer.from('#!SILK_V3'));if(!r?.ok||header<0||header>1||bytes.length>8*1024*1024)return finish(Error('QQ语音编码失败'));finish(null,{bytes,duration:r.duration});});worker.on('error',()=>finish(Error('QQ语音编码组件不可用')));worker.on('exit',()=>{if(!done)finish(Error('QQ语音编码中断'));});
 });
}
export async function prepareMusicVoice(song,{root,signal,request,resolveAudio=resolvePublicMusic,download=requestHTTP,decode=decodeMusicPCM,encode=encodeMusicSilk,onStage=()=>{}}={}){
 const audio=song.source==='meting'?await resolveAudio(song,{signal}):await echoMusicAudioFile(song,{signal,...(request?{request}:{})});signal?.throwIfAborted();onStage('download');
 const response=await download({url:audio.data.file,timeoutMs:45000,maxBytes:MAX_SOURCE,responseType:'binary'},{signal,lookup:musicPublicLookup,authorize:url=>{if(url.protocol!=='https:'||!(song.source==='meting'?publicMusicURL(url.href,song.provider):musicURL(url.href)))throw Error('音频下载跳转不属于当前平台受信任音源');}});
 signal?.throwIfAborted();if(response.status!==200||response.truncated||!response.bytes?.length||response.bytes.length>MAX_SOURCE)throw Error('音频文件获取失败或超过10MB');
 const bytes=Buffer.from(response.bytes),format=audioFormat(bytes),parent=path.resolve(root,'music-voice-temp');await mkdir(parent,{recursive:true});if((await lstat(parent)).isSymbolicLink())throw Error('临时音频目录不能是符号链接');const directory=await mkdtemp(path.join(parent,'song-')),input=path.join(directory,'source.audio');
 try{await writeFile(input,bytes,{flag:'wx',mode:0o600});signal?.throwIfAborted();onStage('decode');const pcm=await decode(input,format,signal);signal?.throwIfAborted();if(!pcm?.length||pcm.length>MAX_PCM||pcm.length%2)throw Error('解码后的音频为空或超过10分钟');onStage('encode');const result=await encode(pcm,signal);signal?.throwIfAborted();onStage('ready');return{segment:{type:'record',data:{file:'base64://'+result.bytes.toString('base64')}},durationMs:result.duration};}
 finally{await unlink(input).catch(()=>{});await rmdir(directory).catch(()=>{});}
}
