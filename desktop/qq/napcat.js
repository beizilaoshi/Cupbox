// Independent client of NapCat's published WebUI / OneBot APIs. No upstream code embedded.
import { mkdir, readFile, writeFile, access, rename, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import yauzl from 'yauzl';
import QRCode from 'qrcode';
export const RUNTIME={version:'v4.18.38',name:'NapCat.Shell.Windows.Node.zip',bytes:124079600,sha256:'b88007a373a30deefb387e7cf17911752ff900bce22c534b3da6b644f5c6d0ae'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function availablePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
export async function extractZip(file,dest){
  await mkdir(dest,{recursive:true});
  await new Promise((resolve,reject)=>yauzl.open(file,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
    if(error)return reject(error);let size=0,count=0;const fail=e=>{zip.close();reject(e);};zip.on('error',fail);zip.on('end',resolve);
    zip.on('entry',async entry=>{try{
      if(++count>40000||(size+=entry.uncompressedSize)>900*1024*1024)throw Error('运行时 ZIP 超过展开上限');
      const target=path.resolve(dest,entry.fileName),relative=path.relative(dest,target);
      if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||entry.fileName.includes('\\')||entry.fileName.includes(':')||((entry.externalFileAttributes>>>16)&0xf000)===0xa000)throw Error('运行时 ZIP 包含不安全路径');
      if(entry.fileName.endsWith('/')){await mkdir(target,{recursive:true});zip.readEntry();return;}
      await mkdir(path.dirname(target),{recursive:true});zip.openReadStream(entry,async(err,stream)=>{if(err)return fail(err);try{await pipeline(stream,createWriteStream(target,{flags:'wx'}));zip.readEntry();}catch(e){fail(e);}});
    }catch(e){fail(e);}});zip.readEntry();
  }));
}
export function onebotConfig(port,token){return{network:{httpServers:[],httpClients:[],websocketServers:[{name:'cupbox-local',enable:true,host:'127.0.0.1',port,messagePostFormat:'array',reportSelfMessage:false,token,heartInterval:15000}],websocketClients:[]},musicSignUrl:'',enableLocalFile2Url:false,parseMultMsg:false};}
export class NapCatManager{
  constructor(home,notify=()=>{}){this.root=path.join(home,'qq-bot','napcat');this.notify=notify;this.credential='';this.state='stopped';}
  async installed(){try{const v=JSON.parse(await readFile(path.join(this.root,'runtime.json'),'utf8'));await access(path.join(this.root,'runtime','node.exe'));return v.version===RUNTIME.version;}catch{return false;}}
  install(){if(this.installing)return this.installing;this.installing=this.deploy().finally(()=>{this.installing=null;});return this.installing;}
  async deploy(){
    if(process.platform!=='win32'||process.arch!=='x64')throw Error('自动部署目前支持 Windows x64');
    if(await this.installed())return;
    await mkdir(this.root,{recursive:true});this.state='downloading';this.notify({phase:this.state,progress:0});
    const file=path.join(this.root,'runtime.zip');
    let cached=false;try{cached=createHash('sha256').update(await readFile(file)).digest('hex')===RUNTIME.sha256;}catch{}
    if(!cached){const signal=AbortSignal.any([this.abortController?.signal||new AbortController().signal,AbortSignal.timeout(300000)]);const response=await fetch(`https://github.com/NapNeko/NapCatQQ/releases/download/${RUNTIME.version}/${RUNTIME.name}`,{signal});if(!response.ok)throw Error('NapCat 官方下载失败（'+response.status+'）');
      const hash=createHash('sha256');let size=0,last=-1;const notify=this.notify;
      await pipeline(async function*(){for await(const chunk of response.body){signal.throwIfAborted();size+=chunk.length;if(size>RUNTIME.bytes+1024)throw Error('运行时下载大小异常');hash.update(chunk);const progress=Math.floor(size/RUNTIME.bytes*100);if(progress!==last){last=progress;notify({phase:'downloading',progress});}yield chunk;}}(),createWriteStream(file+'.part'),{signal});
      if(hash.digest('hex')!==RUNTIME.sha256)throw Error('NapCat SHA256 校验失败');await rename(file+'.part',file);
    }
    this.notify({phase:'extracting',progress:100});const temp=path.join(this.root,'stage-'+randomBytes(5).toString('hex'));await extractZip(file,temp);
    // Only move a newly created staging directory into the dedicated runtime location.
    try{await access(path.join(this.root,'runtime'));throw Error('运行时目录已存在且版本不匹配，请保留配置后检查');}catch(e){if(e.code!=='ENOENT')throw e;}
    await rename(temp,path.join(this.root,'runtime'));await writeFile(path.join(this.root,'runtime.json'),JSON.stringify({version:RUNTIME.version,sha256:RUNTIME.sha256}));this.notify({phase:'ready',progress:100});
  }
  async start(){
    if(this.child)return this.connection;
    this.abortController=new AbortController();
    if(!await this.installed())await this.install();
    this.abortController.signal.throwIfAborted();
    const runtime=path.join(this.root,'runtime'),config=path.join(runtime,'napcat','config'),profile=path.join(this.root,'qq-profile');await mkdir(config,{recursive:true});
    for(const dir of [profile,path.join(profile,'AppData','Roaming'),path.join(profile,'AppData','Local')])await mkdir(dir,{recursive:true});
    this.webPort=await availablePort();do{this.botPort=await availablePort();}while(this.botPort===this.webPort);
    this.webToken=randomBytes(32).toString('hex');this.botToken=randomBytes(32).toString('hex');
    await writeFile(path.join(config,'webui.json'),JSON.stringify({host:'127.0.0.1',port:this.webPort,token:this.webToken,loginRate:30}),{mode:0o600});
    await writeFile(path.join(config,'onebot11.json'),JSON.stringify(onebotConfig(this.botPort,this.botToken)),{mode:0o600});
    await writeFile(path.join(config,'napcat.json'),JSON.stringify({fileLog:false,consoleLog:false,fileLogLevel:'error',consoleLogLevel:'error'}),{mode:0o600});
    // This runtime is private to Cupbox. Keep any existing account-specific config in sync.
    for(const name of await readdir(config))if(/^onebot11_\d+\.json$/.test(name))await writeFile(path.join(config,name),JSON.stringify(onebotConfig(this.botPort,this.botToken)),{mode:0o600});
    for(const name of await readdir(config))if(/^napcat_\d+\.json$/.test(name))await writeFile(path.join(config,name),JSON.stringify({fileLog:false,consoleLog:false,fileLogLevel:'error',consoleLogLevel:'error'}),{mode:0o600});
    this.state='starting';this.notify({phase:this.state});
    const env={};for(const key of ['SYSTEMROOT','SystemRoot','WINDIR','PATH','Path','TEMP','TMP','COMSPEC','SystemDrive','PROGRAMDATA','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE'])if(process.env[key])env[key]=process.env[key];
    Object.assign(env,{USERPROFILE:profile,HOME:profile,APPDATA:path.join(profile,'AppData','Roaming'),LOCALAPPDATA:path.join(profile,'AppData','Local'),NAPCAT_WORKDIR:path.join(runtime,'napcat'),NAPCAT_WEBUI_SECRET_KEY:this.webToken,NAPCAT_WEBUI_PREFERRED_PORT:String(this.webPort),NAPCAT_DISABLE_MULTI_PROCESS:'1'});
    this.child=spawn(path.join(runtime,'node.exe'),[path.join(runtime,'index.js')],{cwd:runtime,windowsHide:true,stdio:['ignore','pipe','pipe'],env});
    // Drain logs; never forward login tokens, QR URLs or QQ session data to renderer/log files.
    this.child.stdout.resume();this.child.stderr.resume();this.child.on('error',()=>this.notify({phase:'error',error:'NapCat 进程无法启动'}));this.child.on('exit',()=>{this.child=null;this.credential='';this.notify({phase:'stopped'});});
    for(let n=0;n<90;n++){this.abortController.signal.throwIfAborted();if(!this.child)throw Error('NapCat 启动失败，请检查 Windows 运行环境');try{await this.login();this.connection={url:`ws://127.0.0.1:${this.botPort}`,token:this.botToken};return this.connection;}catch{await sleep(1000);}}
    this.stop();throw Error('NapCat 启动超时，可重试；不会占用已安装 QQ');
  }
  async api(route,body={},retry=true){
    const response=await fetch(`http://127.0.0.1:${this.webPort}/api/${route}`,{method:'POST',redirect:'error',signal:AbortSignal.any([this.abortController?.signal||new AbortController().signal,AbortSignal.timeout(6000)]),headers:{'content-type':'application/json',...(this.credential?{authorization:'Bearer '+this.credential}:{})},body:JSON.stringify(body)});
    const value=await response.json();if(response.status===401||value.code!==0){if(retry&&route!=='auth/login'){await this.login();return this.api(route,body,false);}throw Error('NapCat 接口暂不可用');}return value.data;
  }
  async login(){const data=await this.api('auth/login',{hash:createHash('sha256').update(this.webToken+'.napcat').digest('hex')},false);if(!data?.Credential||data.require2FA)throw Error('NapCat 身份验证未完成');this.credential=data.Credential;}
  async status(){const state=await this.api('QQLogin/CheckLoginStatus');const link=state.qrcodeurl;let qr='';if(!state.isLogin&&typeof link==='string'&&link.trim()&&link.length<10000)qr=await QRCode.toDataURL(link,{width:240,margin:2,errorCorrectionLevel:'M'});return{loggedIn:state.isLogin===true,offline:state.isOffline===true,loginPhase:state.loginPhase,qr,error:state.loginError?'QQ 登录服务报告错误，请刷新二维码或在手机确认':''};}
  async refreshQR(){await this.api('QQLogin/RefreshQRcode');return this.status();}
  async configure(){await this.api('OB11Config/SetConfig',{config:JSON.stringify(onebotConfig(this.botPort,this.botToken))});}
  stop(){this.abortController?.abort();this.child?.kill();this.credential='';this.connection=null;}
}
