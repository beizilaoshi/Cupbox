import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {toolCapabilityPrompt} from '../src/core/capabilities.js';
import {aiAgent} from '../src/core/ai.js';
import {runTool} from '../src/core/toolkit.js';
import {addFact,listFacts} from '../src/core/memory.js';
import {chatWorkspace,workbenchToolEnabled} from '../desktop/chat-capabilities.js';
import {Workbench} from '../desktop/workbench/runtime.js';
import {agentPresetAllowsTool} from '../desktop/agent-presets.js';

let temp:string,home:string,b:any;
beforeEach(async()=>{temp=await mkdtemp(path.join(os.tmpdir(),'cupbox-capability-'));home=path.join(temp,'.cupbox');vi.stubEnv('CUPBOX_HOME',temp);});
afterEach(async()=>{b?.dispose();b=null;vi.restoreAllMocks();vi.unstubAllEnvs();await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:100});});

describe('实际能力与安全工作区',()=>{
  it('最终传给模型的清单和声明一致，问答无工具不会声称能操作本机',async()=>{
    const request=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'ok'}}]})));
    await aiAgent({prompt:'写文件',config:{provider:'openai-compatible',baseUrl:'https://example.test/v1',apiKey:'test',model:'test'},tools:['time']});
    const body=JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body.tools.map((t:any)=>t.function.name)).toEqual(['time']);
    expect(body.messages[0].content).toContain('可调用工具（仅此清单）：time');
    expect(body.messages[0].content).toContain('文件写入：未接入');
    expect(body.messages[0].content).toContain('命令执行：未接入');
    expect(toolCapabilityPrompt([])).toContain('本次没有执行工具');
    expect(toolCapabilityPrompt([{name:'fs_read'},{name:'fs_write'},{name:'run'}])).toContain('文件写入：可用');
  });
  it('空项目使用应用目录，现有项目与文件/命令开关保持有效',()=>{
    const fallback=path.join(home,'sandbox');
    expect(chatWorkspace({executionEnvironment:'native'},null,fallback)).toBe(fallback);
    expect(chatWorkspace({executionEnvironment:'native',workspace:'selected'},null,fallback)).toBe('selected');
    expect(chatWorkspace({executionEnvironment:'native',workspace:'selected'},{workspace:'session'},fallback)).toBe('session');
    expect(chatWorkspace({executionEnvironment:'sandbox',workspace:'selected'},{workspace:'session'},fallback)).toBe(fallback);
    expect(workbenchToolEnabled('fs_write',{executionEnvironment:'native',filesystemTools:false})).toBe(false);
    expect(workbenchToolEnabled('fs_write',{executionEnvironment:'native',disabledTools:['fs_write']})).toBe(false);
    for(const name of ['run','proc','git','pkg','test','pty_spawn','clipboard_image'])expect(workbenchToolEnabled(name,{executionEnvironment:'sandbox'})).toBe(false);
    for(const name of ['run','git','pkg','test','pty_spawn'])expect(agentPresetAllowsTool('standard',name,[],{standard:{'tool-terminal':false}})).toBe(false);
  });
  it('默认目录能真实写读文件，越界、链接、应用凭证与未批准命令仍被拒绝',async()=>{
    const root=chatWorkspace({executionEnvironment:'native'},null,path.join(home,'sandbox'));
    const approve=vi.fn(async()=>false);
    b=await new Workbench({root,home,session:'default',approve,getPrefs:async()=>({approvalMode:'smart',executionEnvironment:'native'})}).init();
    const args={path:'result.txt',content:'本地交付'};
    const preview=await b.call('fs_write',args);
    expect(preview.dryRun).toBe(true);
    await expect(stat(path.join(root,args.path))).rejects.toThrow();
    expect((await b.call('fs_write',{...args,dryRun:false,confirmToken:preview.confirmToken})).code).toBe('E_DENIED');
    approve.mockResolvedValue(true);
    expect((await b.call('fs_write',{...args,dryRun:false,confirmToken:preview.confirmToken})).ok).toBe(true);
    expect((await b.call('fs_read',{path:args.path})).data.content).toContain('本地交付');
    expect(await readFile(path.join(root,args.path),'utf8')).toBe(args.content);
    expect((await b.call('fs_read',{path:'../desktop.json'})).code).toBe('E_PATH_OUTSIDE_ROOT');
    expect((await b.call('fs_write',{path:'../../outside.txt',content:'bad'})).code).toBe('E_PATH_OUTSIDE_ROOT');
    const external=path.join(temp,'external');await mkdir(external);await writeFile(path.join(external,'secret.txt'),'private');await symlink(external,path.join(root,'link'),'junction');
    expect((await b.call('fs_read',{path:'link/secret.txt'})).code).toBe('E_PATH_OUTSIDE_ROOT');
    expect((await b.call('run',{command:'node -v',allowPrefixes:'node'})).code).toBe('E_POLICY');
    await b.policy.save({...b.policy.value,allowPrefixes:['node -v']});
    approve.mockResolvedValue(false);
    expect((await b.call('run',{command:'node -v'})).code).toBe('E_DENIED');
    expect(approve.mock.calls.at(-1)?.[0]?.force).toBe(true);
  });
  it('事实为0时桌面与核心管理/召回都能看见同一画像，不复制事实且不泄漏其他项目',async()=>{
    await mkdir(path.join(home,'memory'),{recursive:true});
    await writeFile(path.join(home,'memory','user.md'),'资深前端，TypeScript，简洁回复');
    b=await new Workbench({root:path.join(temp,'project'),home,session:'memory',approve:async()=>true,getPrefs:async()=>({approvalMode:'smart',executionEnvironment:'native'})}).init();
    const managed=(await b.call('memory_manage',{})).data;
    expect(managed.total).toBe(0);expect(managed.counts.totalEntries).toBe(1);
    expect(managed.runtimeSources.user).toBe('memory/user.md');
    expect((await b.call('memory_recall',{query:'前端'})).data.runtime.user).toBe(managed.runtime.user);
    const core:any=await runTool('memory_manage',{});
    expect(core.runtime.user).toBe(managed.runtime.user);expect(core.counts.facts).toBe(0);
    expect((await runTool('memory_recall',{query:'前端'}) as any).runtime.user).toBe(managed.runtime.user);
    const global=await addFact('通过对话保存的全局事实');
    const local=await addFact('通过对话保存的当前项目事实','test',{projectKey:b.state.key});
    const stranger=await addFact('另一个项目的私有事实','test',{projectKey:'other-project'});
    expect((await b.call('memory_manage',{scope:'global'})).data.facts.map((f:any)=>f.id)).toContain(global.id);
    const projectFacts=(await b.call('memory_manage',{})).data.facts;
    expect(projectFacts.map((f:any)=>f.id)).toEqual([local.id]);
    expect(projectFacts[0].store).toBe('local');
    expect((await b.call('memory_manage',{forget:global.id})).data.removed).toBe(0);
    expect((await b.call('memory_manage',{forget:stranger.id})).data.removed).toBe(0);
    expect((await b.call('memory_manage',{forget:local.id})).data.removed).toBe(1);
    expect((await listFacts()).map(f=>f.id)).toEqual([global.id,stranger.id]);
    await b.call('memory_remember',{text:'当前项目偏好蓝色'});
    const other=await new Workbench({root:path.join(temp,'other'),home,session:'other',approve:async()=>true,getPrefs:b.getPrefs}).init();
    try{const result=(await other.call('memory_recall',{query:'蓝色'})).data;expect(result.facts).toHaveLength(0);expect(result.runtime.user).toBe(managed.runtime.user);}finally{other.dispose();}
  });
});
