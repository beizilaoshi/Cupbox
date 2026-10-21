import {describe,it,expect,afterAll,beforeAll} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {EventEmitter,once} from 'node:events';
import {classifyTool,needsApproval,sandboxArgs} from '../desktop/execution-policy.js';
import {createToolExecution,restrictedRun} from '../desktop/tool-execution.js';
// 受限沙箱依赖 Node 的 --permission 权限模型（22.x 起可用；18/20 没有该选项）：探测支持性，不支持就跳过相关用例
const hasPermissionModel=spawnSync(process.execPath,['--permission','--eval','process.exit(0)'],{stdio:'ignore'}).status===0;
let home:string,folder:string,outside:string;
beforeAll(async()=>{
  // 归一化真实路径：Windows CI 的临时目录可能是 8.3 短路径（RUNNER~1），与 realpath 结果不一致会导致断言与路径分类错乱
  home=await realpath(await mkdtemp(path.join(tmpdir(),'cupbox-execution-')));folder=path.join(home,'sandbox');outside=path.join(home,'outside.txt');await mkdir(folder);await writeFile(outside,'outside-secret');await writeFile(path.join(folder,'a.txt'),'hello');
});
afterAll(async()=>{await rm(home,{recursive:true,force:true});});
describe('desktop permission decisions',()=>{
  it('requires explicit approval before an agent native command even under full control',async()=>{const sender=new Sender();const runtime=createToolExecution({getPrefs:async()=>({approvalMode:'full',executionEnvironment:'native'}),home:()=>home});let prompted=false;sender.on('execution:approval',r=>{prompted=true;runtime.respond(sender,r.id,false);});await expect(runtime.execute(sender,'run',{command:'echo should-not-run'},'agent')).rejects.toThrow('未批准');expect(prompted).toBe(true);});
  it('agent memory mutations still require human approval under full control, including an empty-profile overwrite',async()=>{
    const sender=new Sender(),seen:any[]=[];const runtime=createToolExecution({getPrefs:async()=>({approvalMode:'full',executionEnvironment:'sandbox'}),home:()=>home});sender.on('execution:approval',request=>{seen.push(request);runtime.respond(sender,request.id,false);});
    for(const [tool,args]of [['memory_profile',{kind:'user',content:''}],['memory_manage',{forget:'all'}],['memory_remember',{text:'不应写入'}]] as const)await expect(runtime.execute(sender,tool,args,'agent')).rejects.toThrow('未批准');expect(seen).toHaveLength(3);
  });
  it('request approval includes reads',()=>expect(needsApproval('ask','hash',{text:'hi'})).toBe(true));
  it('smart permits reads and previews',()=>{for(const [tool,args]of [['hash',{}],['codec',{}],['rename',{dryRun:true}],['organize',{}]])expect(needsApproval('smart',tool,args)).toBe(false);});
  it('smart requests writes and system access',()=>{for(const [tool,args]of [['rename',{dryRun:false}],['organize',{dryRun:false}],['obfuscate',{}],['clip',{action:'read'}],['run',{}],['proc',{action:'kill'}]])expect(needsApproval('smart',tool,args)).toBe(true);});
  it('full bypasses approval without changing runtime',()=>expect(needsApproval('full','proc',{action:'kill'})).toBe(false));
});
describe('sandbox boundaries',()=>{
  it('defaults file operations to the sandbox directory',async()=>expect((await sandboxArgs('search',{},folder)).args.root).toBe(folder));
  it('rejects parent traversal',async()=>{await expect(sandboxArgs('hash',{file:'../outside.txt'},folder)).rejects.toThrow('沙箱');});
  it('rejects absolute paths outside the sandbox',async()=>{await expect(sandboxArgs('hash',{file:outside},folder)).rejects.toThrow('沙箱');});
  it('rejects system tools even with full approval mode',async()=>{await expect(sandboxArgs('run',{command:'echo x'},folder)).rejects.toThrow('本机运行');});
  it('rejects symbolic link escape',async()=>{const linked=path.join(folder,'escape');await symlink(home,linked,'junction');try{await expect(sandboxArgs('hash',{file:path.join(linked,'outside.txt')},folder)).rejects.toThrow('链接');}finally{await rm(linked,{force:true});}});
  it.runIf(hasPermissionModel)('runs a real tool in a permission restricted child',async()=>{const r=await restrictedRun('hash',{text:'hello'},folder);expect(r.sha256).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');});
  it.runIf(hasPermissionModel)('runtime itself denies external file reads',async()=>{await expect(restrictedRun('hash',{file:outside},folder)).rejects.toThrow();});
  it.runIf(hasPermissionModel)('runtime itself denies subprocesses',async()=>{await expect(restrictedRun('run',{command:'echo denied',allowPrefixes:'echo'},folder)).rejects.toThrow();});
});
class Sender extends EventEmitter{id=1;isDestroyed(){return false;}send(name:string,data:unknown){this.emit(name,data);}}
describe('approval enforcement',()=>{
  it('smart native reads outside the workspace require approval',async()=>{
    const sender=new Sender();const runtime=createToolExecution({getPrefs:async()=>({approvalMode:'smart',executionEnvironment:'native',workspace:folder}),home:()=>home});
    const notice=once(sender,'execution:approval');const result=runtime.execute(sender,'hash',{file:outside}).catch(e=>e);
    const [request]=await notice;runtime.respond(sender,request.id,false);expect((await result).message).toContain('未批准');
  });
  it('smart native reads inside the workspace proceed automatically',async()=>{
    const sender=new Sender();let prompted=false;const runtime=createToolExecution({getPrefs:async()=>({approvalMode:'smart',executionEnvironment:'native',workspace:folder}),home:()=>home});
    sender.on('execution:approval',request=>{prompted=true;runtime.respond(sender,request.id,false);});
    expect((await runtime.execute(sender,'hash',{file:'a.txt'})).sha256).toHaveLength(64);expect(prompted).toBe(false);
  });
  it('closing the requester cancels pending approval',async()=>{
    const sender=new Sender();const runtime=createToolExecution({getPrefs:async()=>({approvalMode:'ask',executionEnvironment:'native'}),home:()=>home});
    const notice=once(sender,'execution:approval');const result=runtime.execute(sender,'hash',{text:'hello'}).catch(e=>e);await notice;sender.emit('destroyed');expect((await result).message).toContain('未批准');
  });
  it('denied write never changes a file',async()=>{
    const sender=new Sender();const runtime=createToolExecution({getPrefs:async()=>({approvalMode:'smart',executionEnvironment:'native'}),home:()=>home});
    const notice=once(sender,'execution:approval');const result=runtime.execute(sender,'rename',{dir:folder,template:'changed-{name}',dryRun:false}).catch(e=>e);
    const [request]=await notice;expect(runtime.respond({id:99},request.id,true)).toBe(false);expect(runtime.respond(sender,request.id,false)).toBe(true);
    expect((await result).message).toContain('未批准');expect(await readFile(path.join(folder,'a.txt'),'utf8')).toBe('hello');
  });
  it('one approval only authorizes its exact pending operation',async()=>{
    const sender=new Sender();const runtime=createToolExecution({getPrefs:async()=>({approvalMode:'ask',executionEnvironment:'native'}),home:()=>home});
    const notice=once(sender,'execution:approval');const result=runtime.execute(sender,'hash',{text:'hello'});
    const [request]=await notice;runtime.respond(sender,request.id,true);expect((await result).sha256).toHaveLength(64);expect(runtime.respond(sender,request.id,true)).toBe(false);
  });
  it('disabled tools cannot be called through IPC',async()=>{
    const runtime=createToolExecution({getPrefs:async()=>({approvalMode:'full',executionEnvironment:'native',disabledTools:['hash']}),home:()=>home});await expect(runtime.execute(new Sender(),'hash',{text:'x'})).rejects.toThrow('关闭');
  });
});
