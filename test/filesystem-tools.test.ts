import { describe,it,expect,afterAll } from 'vitest';
import { mkdtemp,rm,mkdir,readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { openFilesystem } from '../desktop/filesystem-tools.js';
import { createToolExecution } from '../desktop/tool-execution.js';
const dirs:string[]=[];
afterAll(async()=>{for(const dir of dirs)await rm(dir,{recursive:true,force:true});});
describe('官方 MCP Filesystem 集成',()=>{
  it('受限进程发现十项工具，真实读写和精确编辑，拒绝越界',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'cupbox-mcp-files-'));dirs.push(root);const fs=await openFilesystem({directory:root});
    try{
      expect(fs.definitions).toHaveLength(10);await fs.call('fs_write_file',{path:'hello.txt',content:'Hello world'});expect(await fs.call('fs_read_text_file',{path:'hello.txt'})).toBe('Hello world');
      await fs.call('fs_edit_file',{path:'hello.txt',edits:[{oldText:'world',newText:'Cupbox'}],dryRun:true});expect(await readFile(path.join(root,'hello.txt'),'utf8')).toBe('Hello world');
      await fs.call('fs_edit_file',{path:'hello.txt',edits:[{oldText:'world',newText:'Cupbox'}]});expect(await readFile(path.join(root,'hello.txt'),'utf8')).toBe('Hello Cupbox');
      await expect(fs.call('fs_read_text_file',{path:path.join(root,'..','outside.txt')})).rejects.toThrow();
      const scoped=path.join(root,'worker');await mkdir(scoped);await fs.call('fs_write_file',{path:path.join(scoped,'ok.txt'),content:'task'},scoped);
      await expect(fs.call('fs_write_file',{path:'other.txt',content:'escape'},scoped)).rejects.toThrow('子项目只能');
    }finally{await fs.close();}
  });
  it('写入仍经批准，拒绝不会调用，批准后才运行',async()=>{
    const sender:any=new EventEmitter();sender.id=17;sender.isDestroyed=()=>false;let allow=false,calls=0;
    const execution=createToolExecution({getPrefs:async()=>({approvalMode:'smart',executionEnvironment:'sandbox'}),home:()=>os.tmpdir()});
    sender.send=(channel,payload)=>{if(channel==='execution:approval')setTimeout(()=>execution.respond(sender,payload.id,allow),0);};
    const def={name:'fs_write_file',readOnly:false};
    await expect(execution.executeFilesystem(sender,def,{},async()=>calls++,undefined,'root')).rejects.toThrow('未批准');expect(calls).toBe(0);
    allow=true;await execution.executeFilesystem(sender,def,{},async()=>calls++,undefined,'root');expect(calls).toBe(1);
  });
  it('启用开关和取消信号均阻止执行',async()=>{
    const sender:any=new EventEmitter();sender.id=1;sender.isDestroyed=()=>false;sender.send=()=>{};
    const execution=createToolExecution({getPrefs:async()=>({filesystemTools:false}),home:()=>os.tmpdir()});
    await expect(execution.executeFilesystem(sender,{name:'fs_read_text_file'}, {},async()=>{},undefined,'root')).rejects.toThrow('关闭');
    const controller=new AbortController();controller.abort();await expect(openFilesystem({directory:os.tmpdir(),signal:controller.signal})).rejects.toThrow();
  });
});
