import path from 'node:path';
import { createHash,randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import iconv from 'iconv-lite';
import safeRegex from 'safe-regex2';
import { createTwoFilesPatch,parsePatch,applyPatch,reversePatch } from 'diff';
import { inside } from '../execution-policy.js';

export class ToolError extends Error{constructor(code,message,data){super(message);this.code=code;this.data=data;}}
export const fail=(code,message,data)=>{throw new ToolError(code,message,data);};
export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const workspaceQueues=new Map();
function serialize(root,fn){const key=root.toLowerCase(),run=(workspaceQueues.get(key)||Promise.resolve()).catch(()=>{}).then(fn);workspaceQueues.set(key,run);const cleanup=()=>{if(workspaceQueues.get(key)===run)workspaceQueues.delete(key);};run.then(cleanup,cleanup);return run;}
export function decode(bytes,encoding){
  let name=encoding,bom='';
  if(bytes.subarray(0,3).equals(Buffer.from([239,187,191]))){bom='utf8bom';name ||= 'utf8bom';}
  else if(bytes.subarray(0,2).equals(Buffer.from([255,254]))){bom='utf16le';name ||= 'utf16le';}
  if(!name){if(bytes.includes(0))return{isBinary:true,encoding:'binary',text:null,eol:null};try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);name='utf8';}catch{fail('E_ENCODING','编码不确定，请显式指定 gbk 或 utf16le；不会猜测覆盖原文件');}}
  if(name==='binary')return{isBinary:true,encoding:'binary',text:bytes.toString('base64'),eol:null};
  if(!['utf8','utf8bom','utf16le','gbk'].includes(name))fail('E_ENCODING','不支持的编码');
  let text=iconv.decode(bytes,name==='utf8bom'?'utf8':name).replace(/^\uFEFF/,'');
  if(text.includes('\uFFFD'))fail('E_ENCODING','解码出现无效字符，拒绝继续');
  const encoded=iconv.encode(text,name==='utf8bom'?'utf8':name),raw=bom==='utf8bom'?bytes.subarray(3):bom==='utf16le'?bytes.subarray(2):bytes;
  if(!encoded.equals(raw))fail('E_ENCODING','编码无法无损往返，请指定正确编码');
  return{isBinary:false,encoding:name,bom,eol:text.includes('\r\n')?'crlf':'lf',text};
}
export function encode(text,name='utf8',eol,bom){
  if(eol&&eol!=='preserve')text=text.replace(/\r?\n/g,eol==='crlf'?'\r\n':'\n');
  const buffer=iconv.encode(text,name==='utf8bom'?'utf8':name);
  if(iconv.decode(buffer,name==='utf8bom'?'utf8':name)!==text)fail('E_ENCODING','目标编码不能表示全部字符');
  return name==='utf8bom'?Buffer.concat([Buffer.from([239,187,191]),buffer]):name==='utf16le'&&bom!==''?Buffer.concat([Buffer.from([255,254]),buffer]):buffer;
}
async function retry(fn){for(let n=0;;n++){try{return await fn();}catch(e){if(!['EBUSY','EPERM'].includes(e.code)||n>=3)throw e;await delay(40*2**n);}}}
export class FileEngine{
  constructor(root,home,session){this.root=path.resolve(root);this.home=home;this.session=session;this.tokens=new Map();this.queue=Promise.resolve();}
  async init(){await fs.mkdir(this.root,{recursive:true});this.root=await fs.realpath(this.root);return this;}
  async resolve(value='.',write=false){
    if(typeof value!=='string'||value.includes('\0'))fail('E_PATH_OUTSIDE_ROOT','无效路径');
    const target=path.resolve(this.root,value);if(/(?:^|[\\/])(?:\.cupbox)(?:[\\/]|$)/i.test(path.relative(this.root,target))&&write)fail('E_PATH_OUTSIDE_ROOT','工具不能修改项目策略目录');if(!inside(this.root,target))fail('E_PATH_OUTSIDE_ROOT','路径不在工作目录内');
    if(target.length>250)fail('E_PATH_TOO_LONG','路径超过安全长度 250 字符，请缩短目录或文件名');
    for(const part of path.relative(this.root,target).split(path.sep))if(/^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(part.replace(/[ .]+(?=\.)/g,''))||/[<>:"|?*]/.test(part)||/[ .]$/.test(part))fail('E_RESERVED_NAME','Windows 保留名或无效文件名：'+part);
    const canonicalRoot=await fs.realpath(this.root);if(canonicalRoot.toLowerCase()!==this.root.toLowerCase())fail('E_CONFLICT','工作目录已发生变化');
    let cursor=target;while(true){try{const info=await fs.lstat(cursor);if(info.isSymbolicLink())fail('E_PATH_OUTSIDE_ROOT','不允许通过符号链接或 junction 操作文件');const real=await fs.realpath(cursor);if(!inside(this.root,real))fail('E_PATH_OUTSIDE_ROOT','链接解析后路径越界');break;}catch(e){if(e.code!=='ENOENT')throw e;cursor=path.dirname(cursor);}}
    // Check each component as well: a link followed by a normal file must not bypass lstat(target).
    let current=this.root;for(const part of path.relative(this.root,target).split(path.sep).filter(Boolean)){current=path.join(current,part);try{if((await fs.lstat(current)).isSymbolicLink())fail('E_PATH_OUTSIDE_ROOT','路径包含符号链接或 junction');}catch(e){if(e.code!=='ENOENT')throw e;}}
    await this.guard?.(target,write);return target;
  }
  async snapshot(value){const file=await this.resolve(value);try{const info=await fs.stat(file);if(info.isDirectory())fail('E_IS_DIR','需要文件而不是目录');if(info.size>64*1024*1024)fail('E_TOO_LARGE','文件超过 64 MB 修改上限');const bytes=await fs.readFile(file);return{file,bytes,hash:digest(bytes),mode:info.mode};}catch(e){if(e.code==='ENOENT')return{file,bytes:null,hash:null};throw e;}}
  async atomic(file,bytes,mode){await this.resolve(file,true);await fs.mkdir(path.dirname(file),{recursive:true});await this.resolve(file,true);const temp=path.join(path.dirname(file),'.cupbox-tmp-'+randomUUID());try{await fs.writeFile(temp,bytes,{flag:'wx',mode});await retry(()=>fs.rename(temp,file));}catch(e){await fs.unlink(temp).catch(()=>{});if(['EPERM','EBUSY'].includes(e.code))fail('E_LOCKED','文件被占用，未使用非原子的覆盖方式');throw e;}}
  async stat(a){const file=await this.resolve(a.path),s=await fs.lstat(file);let hash=null;if(s.isFile()){const stream=createReadStream(file),h=createHash('sha256');for await(const chunk of stream){this.signal?.throwIfAborted();h.update(chunk);}hash=h.digest('hex');}let text={};if(s.isFile()){const handle=await fs.open(file,'r');try{const b=Buffer.alloc(Math.min(s.size,65536));await handle.read(b,0,b.length,0);try{text=decode(b,a.encoding);}catch{text={encoding:'unknown'};}}finally{await handle.close();}}return{type:s.isDirectory()?'directory':'file',size:s.size,mtime:s.mtime.toISOString(),hash,isSymlink:s.isSymbolicLink(),realpath:await fs.realpath(file),encoding:text.encoding,eol:text.eol};}
  async read(a){
    const file=await this.resolve(a.path),s=await fs.stat(file);if(!s.isFile())fail('E_IS_DIR','需要文件');
    const cap=Math.min(2*1024*1024,Math.max(1,Number(a.maxBytes)||262144));
    if(a.encoding==='binary'){const h=await fs.open(file,'r');try{const b=Buffer.alloc(Math.min(s.size,cap));await h.read(b,0,b.length,0);return{content:b.toString('base64'),lines:[],totalLines:null,encoding:'binary',isBinary:true,truncated:s.size>b.length};}finally{await h.close();}}
    const handle=await fs.open(file,'r');let probe;try{const b=Buffer.alloc(Math.min(s.size,65536));await handle.read(b,0,b.length,0);probe=b;}finally{await handle.close();}
    const encoding=a.encoding||(probe.subarray(0,3).equals(Buffer.from([239,187,191]))?'utf8bom':probe.subarray(0,2).equals(Buffer.from([255,254]))?'utf16le':null);
    if(!encoding&&probe.includes(0))fail('E_BINARY','二进制文件，请使用 encoding:binary');
    const decoder=iconv.getDecoder(encoding==='utf8bom'?'utf8':encoding||'utf8');
    let carry='',line=0,retained=0,truncated=false,eol='lf';const output=[],before=[],afterIndices=new Set(),context=Math.min(50,Math.max(0,a.context??3));
    if(a.pattern&&!safeRegex(a.pattern))fail('E_PATTERN','正则表达式过于复杂');const matcher=a.pattern?new RegExp(a.pattern):null;
    const consume=text=>{line++;const clean=text.replace(/\r$/,'');if(text.endsWith('\r'))eol='crlf';if(line===1&&clean.charCodeAt(0)===0xFEFF)text=clean.slice(1);else text=clean;
      if(text.includes('\uFFFD'))fail('E_ENCODING','解码失败，请显式指定 gbk 或 utf16le');
      const item={no:line,text},inRange=line>=Math.max(1,a.startLine||1)&&line<=(a.endLine||Infinity),match=inRange&&(!matcher||matcher.test(text));
      if(match&&matcher){for(const old of before)if(!output.some(x=>x.no===old.no)&&retained+Buffer.byteLength(old.text)<cap){output.push(old);retained+=Buffer.byteLength(old.text);}for(let n=line+1;n<=line+context;n++)afterIndices.add(n);}
      if(inRange&&(match||afterIndices.has(line))){const bytes=Buffer.byteLength(text);if(retained+bytes<=cap){output.push(item);retained+=bytes;}else truncated=true;}
      before.push(item);if(before.length>context)before.shift();
    };
    for await(const chunk of createReadStream(file,{highWaterMark:65536})){this.signal?.throwIfAborted();carry+=decoder.write(chunk);let index;while((index=carry.indexOf('\n'))>=0){consume(carry.slice(0,index));carry=carry.slice(index+1);}if(carry.length>2*1024*1024){truncated=true;carry=carry.slice(-65536);}}
    carry+=decoder.end();if(carry||s.size===0)consume(carry);
    return{content:output.map(x=>a.withLineNumbers===false?x.text:`${x.no}| ${x.text}`).join('\n'),lines:output,totalLines:line,encoding:encoding||'utf8',eol,isBinary:false,truncated};
  }
  async preview(tool,args,changes,scope){
    const clean={...args};delete clean.confirmToken;delete clean.dryRun;
    const prepared=[];
    for(const c of changes){await this.resolve(c.path,true);const old=await this.snapshot(c.path);if(scope&&!inside(scope,old.file))fail('E_PATH_OUTSIDE_ROOT','子项目写入必须位于自己的交付目录');const bytes=c.bytes===null?null:Buffer.isBuffer(c.bytes)?c.bytes:Buffer.from(c.bytes);if(old.bytes!==null&&bytes!==null&&old.bytes.equals(bytes)||old.bytes===null&&bytes===null)continue;
      const before=old.bytes?.length||0,after=bytes?.length||0;
      let diff;try{diff=createTwoFilesPatch(c.path,c.path,old.bytes?decode(old.bytes,args.encoding).text||'[binary]':'',bytes?decode(bytes,args.encoding).text||'[binary]':'','before','after',{context:3});}catch{diff=`Binary change ${c.path}: ${before} → ${after} bytes`;}
      prepared.push({...old,path:c.path,next:bytes,diff});
    }
    if(!prepared.length)return{ok:true,data:{unchanged:true},diff:'',changed:[]};
    if(prepared.reduce((n,c)=>n+(c.bytes?.length||0)+(c.next?.length||0),0)>64*1024*1024)fail('E_TOO_LARGE','一次事务最多缓存 64 MB');
    const diff=prepared.map(c=>c.diff).join('\n');
    if(args.dryRun!==false){const token=randomUUID();while(this.tokens.size>=4)this.tokens.delete(this.tokens.keys().next().value);this.tokens.set(token,{tool,argsHash:digest(clean),prepared,expires:Date.now()+300000,scope});for(const [id,p]of this.tokens)if(p.expires<Date.now())this.tokens.delete(id);return{ok:true,dryRun:true,diff:diff.slice(0,100000),truncated:diff.length>100000,changed:prepared.map(c=>({path:c.path,bytesBefore:c.bytes?.length||0,bytesAfter:c.next?.length||0})),confirmToken:token};}
    const transaction=this.tokens.get(args.confirmToken);if(!transaction||transaction.tool!==tool||transaction.argsHash!==digest(clean)||transaction.expires<Date.now()||transaction.scope!==scope)fail('E_CONFLICT','缺少、过期或参数不一致的预览令牌，请重新 dryRun');
    this.tokens.delete(args.confirmToken);
    const run=serialize(this.root,async()=>{
      for(const c of transaction.prepared){const now=await this.snapshot(c.path);if(now.hash!==c.hash)fail('E_CONFLICT','预览后文件发生变化：'+c.path);await this.resolve(c.path,true);}
      const id=randomUUID(),dir=path.join(this.home,'operations',id);await fs.mkdir(dir,{recursive:true});
      const manifest={id,root:this.root,session:this.session,at:new Date().toISOString(),tool,files:[]};
      for(let n=0;n<transaction.prepared.length;n++){const c=transaction.prepared[n];if(c.bytes!==null)await fs.writeFile(path.join(dir,String(n)),c.bytes);manifest.files.push({path:c.path,backup:c.bytes===null?null:String(n),before:c.hash,after:c.next===null?null:digest(c.next),mode:c.mode});}
      await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest));
      let count=0;try{for(const c of transaction.prepared){this.signal?.throwIfAborted();await this.resolve(c.path,true);if(c.next===null)await retry(()=>fs.unlink(c.file));else await this.atomic(c.file,c.next,c.mode);count++;}}
      catch(e){for(let n=count-1;n>=0;n--){const c=transaction.prepared[n];if(c.bytes===null)await fs.unlink(c.file).catch(()=>{});else await this.atomic(c.file,c.bytes,c.mode);}throw e;}
      return{ok:true,operationId:id,changed:transaction.prepared.map(c=>({path:c.path,bytesBefore:c.bytes?.length||0,bytesAfter:c.next?.length||0})),diff:diff.slice(0,100000),truncated:diff.length>100000};
    });this.queue=run;return run;
  }
  async write(a,scope){if(Buffer.byteLength(String(a.content||''))>8*1024*1024)fail('E_TOO_LARGE','一次写入最多 8 MB');const old=await this.snapshot(a.path);if(a.createParents===false)await fs.stat(path.dirname(old.file));if(a.mode==='createOnly'&&old.bytes!==null)fail('E_CONFLICT','文件已存在');if(a.encoding==='binary'){const bytes=Buffer.from(String(a.content),'base64');if(bytes.toString('base64')!==a.content)fail('E_ENCODING','binary 写入需要标准 base64');return this.preview('fs_write',a,[{path:a.path,bytes}],scope);}const meta=old.bytes?decode(old.bytes,a.encoding):{text:'',encoding:a.encoding||'utf8',eol:'lf'};if(meta.isBinary)fail('E_BINARY','文本写入不能覆盖二进制文件');const input=String(a.content??'');const text=a.mode==='append'?meta.text+input:a.mode==='prepend'?input+meta.text:input;return this.preview('fs_write',a,[{path:a.path,bytes:encode(text,a.encoding||meta.encoding,a.eol==='preserve'||!a.eol?meta.eol:a.eol,meta.bom)}],scope);}
  async edit(a,scope){const old=await this.snapshot(a.path);if(old.bytes===null)fail('E_NOT_FOUND','文件不存在');const meta=decode(old.bytes,a.encoding);if(meta.isBinary)fail('E_BINARY','不能编辑二进制文件');let text=meta.text,needle=String(a.oldText??'');if(!needle)fail('E_AMBIGUOUS_MATCH','oldText 不能为空');
    if(needle.length>65536)fail('E_TOO_LARGE','一次编辑匹配文本最多 64 KB');
    if(a.fuzzy){const escaped=needle.replace(/\r\n/g,'\n').split('\n').map(l=>l.replace(/[ \t]+$/,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[ \\t]*').join('\\r?\\n');const regex=new RegExp(escaped,'g'),matches=[...text.matchAll(regex)];if(!matches.length||!a.replaceAll&&matches.length!==1)fail('E_AMBIGUOUS_MATCH',`模糊匹配 ${matches.length} 处，需要唯一命中`,{locations:matches.slice(0,20).map(m=>({line:text.slice(0,m.index).split('\n').length,context:m[0]}))});const next=a.replaceAll?text.replace(regex,()=>String(a.newText)):text.slice(0,matches[0].index)+String(a.newText)+text.slice(matches[0].index+matches[0][0].length);return this.preview('fs_edit',a,[{path:a.path,bytes:encode(next,meta.encoding,a.eol==='preserve'||!a.eol?meta.eol:a.eol,meta.bom)}],scope);}
    const normalize=t=>t.replace(/\r\n/g,'\n').split('\n').map(x=>x.replace(/[ \t]+$/,'')).join('\n');const source=a.fuzzy?normalize(text):text,find=a.fuzzy?normalize(needle):needle;let positions=[],i=0;while((i=source.indexOf(find,i))>=0){positions.push(i);i+=find.length;}
    if(!positions.length||!a.replaceAll&&positions.length!==1)fail('E_AMBIGUOUS_MATCH',`精确匹配 ${positions.length} 处，需要唯一命中或显式 replaceAll`,{locations:positions.slice(0,20).map(p=>({line:source.slice(0,p).split('\n').length,context:source.slice(Math.max(0,p-80),p+find.length+80)}))});
    text=a.replaceAll?source.split(find).join(String(a.newText??'')):source.slice(0,positions[0])+String(a.newText??'')+source.slice(positions[0]+find.length);return this.preview('fs_edit',a,[{path:a.path,bytes:encode(text,meta.encoding,a.eol==='preserve'||!a.eol?meta.eol:a.eol,meta.bom)}],scope);
  }
  async patch(a,scope){if(a.allowPartial)fail('E_CONFLICT','安全模式不允许部分补丁写入');const changes=[];for(let p of parsePatch(String(a.patch))){if(a.reverse)p=reversePatch(p);const oldPath=p.oldFileName?.replace(/^a\//,''),newPath=p.newFileName?.replace(/^b\//,'');if(oldPath!==newPath&&oldPath!=='/dev/null'&&newPath!=='/dev/null')fail('E_CONFLICT','重命名补丁请改用 fs_mv');const name=newPath==='/dev/null'?oldPath:newPath,old=await this.snapshot(name),meta=old.bytes?decode(old.bytes,a.encoding):{text:'',encoding:a.encoding||'utf8',eol:'lf'};if(meta.isBinary)fail('E_BINARY','不能应用文本补丁');const result=applyPatch(meta.text,p,{fuzzFactor:Math.min(2,Math.max(0,a.fuzz||0))});if(result===false)fail('E_CONFLICT','补丁上下文不匹配：'+name);changes.push({path:name,bytes:newPath==='/dev/null'?null:encode(result,meta.encoding,a.eol==='preserve'||!a.eol?meta.eol:a.eol,meta.bom)});}if(!changes.length)fail('E_CONFLICT','补丁为空');return this.preview('fs_patch',a,changes,scope);}
  async walk(value='.',limit=3000,all=false){const folder=await this.resolve(value);const result=[];const visit=async dir=>{for(const item of await fs.readdir(dir,{withFileTypes:true})){if(result.length>=limit)fail('E_TOO_LARGE','目录条目过多，请缩小范围');const file=await this.resolve(path.join(dir,item.name));if(item.isDirectory()){if(!all&&['node_modules','.git','.cupbox','.cupbox-deliveries'].includes(item.name))continue;await visit(file);}else result.push(file);}};await visit(folder);return result;}
  async treeState(file){try{const info=await fs.stat(file);if(info.isFile())return{type:'file',hash:(await this.snapshot(file)).hash};const files=await this.walk(file,3000,true),state=[];let total=0;for(const child of files){const snap=await this.snapshot(child);total+=snap.bytes.length;if(total>100*1024*1024)fail('E_TOO_LARGE','一次目录操作最多 100 MB');state.push([path.relative(file,child),snap.hash]);}return{type:'directory',mtime:info.mtimeMs,files:state};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  async action(tool,a,scope,file,state,apply){const clean={...a};delete clean.confirmToken;delete clean.dryRun;await this.resolve(file,true);if(scope&&!inside(scope,file))fail('E_PATH_OUTSIDE_ROOT','子项目目录越界');if(a.dryRun!==false){const token=randomUUID();while(this.tokens.size>=4)this.tokens.delete(this.tokens.keys().next().value);this.tokens.set(token,{tool,argsHash:digest(clean),state:digest(state),expires:Date.now()+300000,scope});return{ok:true,dryRun:true,diff:`${tool}: ${file}\n${state===null?'create':'change existing '+state.type}`,confirmToken:token};}const plan=this.tokens.get(a.confirmToken);if(!plan||plan.tool!==tool||plan.argsHash!==digest(clean)||plan.scope!==scope||plan.expires<Date.now())fail('E_CONFLICT','目录操作缺少有效预览令牌');this.tokens.delete(a.confirmToken);const run=this.queue.catch(()=>{}).then(async()=>{await this.resolve(file,true);if(digest(await this.treeState(file))!==plan.state)fail('E_CONFLICT','目录预览后发生变化');return apply();});this.queue=run;return run;}
  async mkdir(a,scope){const file=await this.resolve(a.path,true),state=await this.treeState(file);if(state){if(state.type==='directory')return{ok:true,data:{unchanged:true},diff:''};fail('E_CONFLICT','目标存在同名文件');}return this.action('fs_mkdir',a,scope,file,state,async()=>{await fs.mkdir(file,{recursive:a.recursive!==false});return{ok:true,data:{path:file,created:true}};});}
  async transfer(tool,a,scope){const from=await this.resolve(a.from),to=await this.resolve(a.to,true);if(path.relative(this.root,from)===''||inside(from,to))fail('E_CONFLICT','不能移动根目录或把目标放在源目录内');const s=await fs.stat(from),files=s.isDirectory()?await this.walk(from,3000,true):[from];if(s.isDirectory()&&!a.recursive)fail('E_IS_DIR','目录复制或移动需 recursive:true');const sourceFingerprint=digest(await this.treeState(from));if(a.dryRun===false&&this.tokens.get(a.confirmToken)?.sourceFingerprint!==sourceFingerprint)fail('E_CONFLICT','复制/移动源在预览后发生变化');
    if(s.isDirectory()&&!files.length){const result=await this.action(tool,a,scope,to,await this.treeState(to),async()=>{await fs.mkdir(to,{recursive:true});if(tool==='fs_mv'){await this.resolve(from,true);await fs.rmdir(from);}return{ok:true,data:{from,to}};});if(result.confirmToken)this.tokens.get(result.confirmToken).sourceFingerprint=sourceFingerprint;return result;}
    const changes=[];for(const file of files){const target=s.isDirectory()?path.join(to,path.relative(from,file)):to;const current=await this.snapshot(target);if(current.bytes!==null&&!a.overwrite)fail('E_CONFLICT','目标已存在：'+target);changes.push({path:target,bytes:await fs.readFile(file)});if(tool==='fs_mv')changes.push({path:file,bytes:null});}const result=await this.preview(tool,a,changes,scope);if(result.confirmToken)this.tokens.get(result.confirmToken).sourceFingerprint=sourceFingerprint;
    if(result.ok&&!result.dryRun&&tool==='fs_mv'&&s.isDirectory()){const clean=async dir=>{await this.resolve(dir,true);for(const item of await fs.readdir(dir,{withFileTypes:true}))if(item.isDirectory())await clean(path.join(dir,item.name));try{await fs.rmdir(dir);}catch(e){if(e.code!=='ENOTEMPTY')throw e;}};await clean(from);}return result;
  }
  async remove(a,scope){const file=await this.resolve(a.path,true);if(path.relative(this.root,file)==='')fail('E_PATH_OUTSIDE_ROOT','不能删除工作目录根');const state=await this.treeState(file);if(!state)fail('E_NOT_FOUND','目标不存在');if(state.type==='directory'&&!a.recursive)fail('E_IS_DIR','目录删除需 recursive:true');if(a.toRecycleBin===false)fail('E_CONFLICT','不提供永久删除；内容进入回收站或可恢复隔离区');return this.action('fs_rm',a,scope,file,state,async()=>{const id=randomUUID(),dir=path.join(this.home,'operations',id);await fs.mkdir(dir,{recursive:true});await fs.cp(file,path.join(dir,'tree'),{recursive:true,errorOnExist:true});if(digest(await this.treeState(file))!==digest(state))fail('E_CONFLICT','备份期间目标已变化');const manifest={id,root:this.root,session:this.session,action:'remove',source:file,at:new Date().toISOString()};await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest));await this.resolve(file,true);if(this.trash)await this.trash(file);else{try{await fs.rename(file,path.join(dir,'quarantine'));}catch(e){if(e.code!=='EXDEV')throw e;await this.resolve(file,true);await fs.rm(file,{recursive:true,force:false});}}return{ok:true,operationId:id,data:{path:file,recoverable:true,recycleBin:Boolean(this.trash)}};});}
  async rollback(a,scope){if(!/^[a-f0-9-]{36}$/.test(a.operationId||''))fail('E_NOT_FOUND','无效操作 ID');const dir=path.join(this.home,'operations',a.operationId),m=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));if(m.root!==this.root||m.session!==this.session)fail('E_PATH_OUTSIDE_ROOT','不能跨工作目录或会话回滚');if(m.action==='remove'){const file=await this.resolve(m.source,true);if(await this.treeState(file))fail('E_CONFLICT','原路径已被其他内容占用');return this.action('fs_rollback',a,scope,file,null,async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.cp(path.join(dir,'tree'),file,{recursive:true,errorOnExist:true,force:false});return{ok:true,data:{restored:file}};});}const changes=[];for(const c of m.files){const current=await this.snapshot(c.path);if(current.hash!==c.after)fail('E_CONFLICT','回滚目标在该操作后又被修改：'+c.path);changes.push({path:c.path,bytes:c.backup===null?null:await fs.readFile(path.join(dir,c.backup))});}return this.preview('fs_rollback',a,changes,scope);}
}
