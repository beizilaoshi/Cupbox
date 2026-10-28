import {describe,it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createMarchWorkflow,marchArgs,normalizeMarchConfig} from '../desktop/march7th-workflow.js';
import {enforceSingleInstance} from '../desktop/single-instance.js';

describe('Cupbox 单实例',()=>{
  it('重复实例立即退出，不注册唤起监听',()=>{
    const app={requestSingleInstanceLock:()=>false,exit:vi.fn(),on:vi.fn()};
    expect(enforceSingleInstance(app,vi.fn())).toBe(false);expect(app.exit).toHaveBeenCalledWith(0);expect(app.on).not.toHaveBeenCalled();
  });
  it('首次启动持有锁，重复启动唤起已有窗口',()=>{
    const app=Object.assign(new EventEmitter(),{requestSingleInstanceLock:()=>true}),show=vi.fn();
    expect(enforceSingleInstance(app,show)).toBe(true);app.emit('second-instance');expect(show).toHaveBeenCalledOnce();
  });
});
describe('三月七工作流',()=>{
  it('任务白名单与自定义名称通过独立参数传递',()=>{
    expect(marchArgs('daily')).toEqual(['daily']);expect(marchArgs('custom',' 日常 & 周常 ')).toEqual(['--workflow-name','日常 & 周常']);
    expect(()=>marchArgs('--help')).toThrow();expect(()=>marchArgs('custom',' ')).toThrow();expect(()=>marchArgs('toString')).toThrow();expect(()=>marchArgs(['daily'])).toThrow();
  });
  it('启动时防止并发、收集中文日志并停止进程树，退出后可重跑',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-march-'));
    try{
      const exe=path.join(dir,'March7th Assistant.exe');await writeFile(exe,'fixture');
      const child=Object.assign(new EventEmitter(),{pid:1234,stdout:new PassThrough(),stderr:new PassThrough()});
      const killer=new EventEmitter();const launch=vi.fn().mockReturnValueOnce(child).mockReturnValueOnce(killer).mockReturnValueOnce(child);
      const workflow=createMarchWorkflow({launch,platform:'win32'}),config={executable:exe,task:'daily'};
      const first=workflow.start(config);await expect(workflow.start(config)).rejects.toThrow('已在运行');await first;
      expect(launch.mock.calls[0][1]).toEqual(['daily']);expect(launch.mock.calls[0][2]).toMatchObject({shell:false,windowsHide:true,cwd:dir});
      const bytes=Buffer.from('中文日志');child.stdout.write(bytes.subarray(0,2));child.stdout.write(bytes.subarray(2));expect(workflow.snapshot().log).toContain('中文日志');
      await expect(workflow.start(config)).rejects.toThrow('已在运行');
      const stopping=workflow.stop();expect(launch.mock.calls[1][1]).toEqual(['/PID','1234','/T','/F']);child.emit('close',1);killer.emit('close',0);await stopping;
      expect(workflow.snapshot()).toMatchObject({running:false,status:'stopped'});
      await workflow.start(config);child.emit('close',0);expect(workflow.snapshot().status).toBe('done');
    } finally {await rm(dir,{recursive:true,force:true});}
  });
  it('路径失败释放启动锁，异步启动错误反馈到日志',async()=>{
    const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough()});
    const workflow=createMarchWorkflow({launch:()=>child});
    await expect(workflow.start({executable:'bad.cmd',task:'main'})).rejects.toThrow('请选择');
    expect(workflow.snapshot().running).toBe(false);
    const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-march-error-'));
    try {const exe=path.join(dir,'March7th Assistant.exe');await writeFile(exe,'fixture');await workflow.start({executable:exe,task:'main'});child.emit('error',Error('权限不足'));expect(workflow.snapshot()).toMatchObject({running:false,status:'error'});expect(workflow.snapshot().log).toContain('权限不足');}
    finally {await rm(dir,{recursive:true,force:true});}
  });
  it('只接受小助手程序及白名单配置，不接受 Launcher、其他 exe 或控制字符',()=>{
    const executable=path.join(os.tmpdir(),'March7th Assistant.exe');
    expect(normalizeMarchConfig({executable,task:'custom',workflowName:' 周常 & 日常 '})).toMatchObject({workflowName:'周常 & 日常'});
    for(const file of ['March7th Launcher.exe','powershell.exe'])expect(()=>normalizeMarchConfig({executable:path.join(os.tmpdir(),file),task:'daily'})).toThrow('请选择');
    expect(()=>normalizeMarchConfig({executable,task:'daily',command:'bad'})).toThrow('参数');expect(()=>marchArgs('custom','a\nb')).toThrow('控制字符');
  });
  it('停止会取消仍在准备中的启动，不会随后冒出新进程',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-march-cancel-'));try{
      const exe=path.join(dir,'March7th Assistant.exe');await writeFile(exe,'fixture');const launch=vi.fn(),w=createMarchWorkflow({launch});
      const start=w.start({executable:exe,task:'daily'});const stopped=w.stop();await expect(start).rejects.toThrow('取消');await stopped;expect(launch).not.toHaveBeenCalled();expect(w.snapshot().running).toBe(false);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('停止超时恢复运行状态，可重试，不无限卡住退出',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-march-timeout-'));try{
      const exe=path.join(dir,'March7th Assistant.exe');await writeFile(exe,'fixture');const child=Object.assign(new EventEmitter(),{pid:12,stdout:new PassThrough(),stderr:new PassThrough()}),killer=new EventEmitter();const launch=vi.fn().mockReturnValueOnce(child).mockReturnValueOnce(killer);const w=createMarchWorkflow({launch,platform:'win32',stopTimeoutMs:20});await w.start({executable:exe,task:'daily'});await expect(w.stop()).rejects.toThrow('停止超时');expect(w.snapshot()).toMatchObject({running:true,status:'running'});child.emit('close',0);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('旧进程的延迟关闭和日志不会污染重新运行的状态',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-march-old-'));try{
      const exe=path.join(dir,'March7th Assistant.exe');await writeFile(exe,'fixture');const child=()=>Object.assign(new EventEmitter(),{pid:12,stdout:new PassThrough(),stderr:new PassThrough()});const old=child(),next=child();const w=createMarchWorkflow({launch:vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(next)});await w.start({executable:exe,task:'daily'});old.emit('error',Error('fixture'));await w.start({executable:exe,task:'power'});old.stdout.write('old private log');old.emit('close',1);expect(w.snapshot()).toMatchObject({running:true,status:'running',task:'power'});expect(w.snapshot().log).not.toContain('old private log');next.emit('close',0);
    }finally{await rm(dir,{recursive:true,force:true});}
  });
  it('并发停止复用一次进程树终止并返回一致状态',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-march-stop-'));try{
      const exe=path.join(dir,'March7th Assistant.exe');await writeFile(exe,'fixture');const child=Object.assign(new EventEmitter(),{pid:12,stdout:new PassThrough(),stderr:new PassThrough()}),killer=new EventEmitter();const launch=vi.fn().mockReturnValueOnce(child).mockReturnValueOnce(killer);const w=createMarchWorkflow({launch,platform:'win32'});await w.start({executable:exe,task:'daily'});const first=w.stop(),second=w.stop();expect(launch).toHaveBeenCalledTimes(2);child.emit('close',0);killer.emit('close',0);expect(await first).toMatchObject({running:false,status:'stopped'});expect(await second).toMatchObject({status:'stopped'});
    }finally{await rm(dir,{recursive:true,force:true});}
  });
});
