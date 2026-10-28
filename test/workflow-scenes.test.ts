import { vi,describe,it,expect,beforeEach,afterAll } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
vi.mock('../desktop/model-workflow.js',()=>({invokeCapability:vi.fn()}));
import { invokeCapability } from '../desktop/model-workflow.js';
import { runWorkflow } from '../desktop/workflow-runner.js';
import { validatePlan,resolveScene } from '../desktop/workflow-scenes.js';
const dirs:string[]=[];
const model={id:'coordinator',name:'协调',model:'m'};
const args=()=>({selected:[{cap:'text',model}],workflow:'project',parallel:3,prompt:'制作完整应用',system:'系统',history:[],signal:new AbortController().signal,home:()=>'',emit:vi.fn(),integrate:vi.fn(async()=>({text:'整合完成'}))});
const plan=(tasks:any[])=>({text:JSON.stringify({tasks})});
beforeEach(()=>vi.mocked(invokeCapability).mockReset());
describe('Office workflow scenes',()=>{
 it('detects Office deliverables and supplies executable scene requirements to workers',async()=>{
  expect(resolveScene('auto','制作项目汇报.pptx')).toBe('office_ppt');expect(resolveScene('auto','读取原始数据.xlsx')).toBe('office_excel');expect(resolveScene('auto','制作 Word 报告')).toBe('office_word');
  const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-office-flow-'));dirs.push(dir);
  vi.mocked(invokeCapability).mockResolvedValueOnce(plan([{id:'read',title:'核对资料',prompt:'读取输入',cap:'text'},{id:'write',title:'制作文档',prompt:'编写报告',cap:'text',dependsOn:['read']}]) as any);
  const calls:any[]=[];const r=await runWorkflow({...args(),scene:'office_word',workRoot:dir,executeText:async t=>{calls.push(t.prompt);return{text:'已按本地工具结果处理'};}});
  expect(r.scene).toBe('office_word');expect(calls).toHaveLength(2);expect(calls.every(p=>p.includes('word_create')&&p.includes('word_read')&&p.includes('批准'))).toBe(true);expect(calls[1]).toContain('核对资料 的交付');
 });
});
afterAll(async()=>{for(const dir of dirs)await rm(dir,{recursive:true,force:true});});
describe('场景、依赖、验收工作流',()=>{
  it('识别不同场景并校验依赖，拒绝循环和未选择能力',()=>{
    expect(resolveScene('auto','修复网站代码')).toBe('coding');expect(resolveScene('auto','分析数据 CSV')).toBe('data');expect(resolveScene('auto','海报与配音')).toBe('creative');
    expect(()=>validatePlan({tasks:[{id:'a',title:'A',prompt:'p',cap:'video'}]},['text'])).toThrow();
    expect(()=>validatePlan({tasks:[{id:'a',title:'A',prompt:'p',cap:'text',dependsOn:['b']},{id:'b',title:'B',prompt:'p',cap:'text',dependsOn:['a']}]},['text'])).toThrow('循环');
  });
  it('等待真实上游完成，再向下游传递结果，并行只发生在就绪任务间',async()=>{
    vi.mocked(invokeCapability).mockResolvedValueOnce(plan([{id:'a',title:'接口',prompt:'约定',cap:'text'},{id:'b',title:'页面',prompt:'开发',cap:'text',dependsOn:['a']},{id:'c',title:'测试',prompt:'测试',cap:'text',dependsOn:['a']}]) as any);
    const order:string[]=[],a=args();let active=0,peak=0;
    const result=await runWorkflow({...a,executeText:async task=>{if(task.id!=='a')expect(task.prompt).toContain('接口交付');order.push(task.id);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,20));active--;return{text:task.id==='a'?'接口交付':'完成'};}});
    expect(order[0]).toBe('a');expect(peak).toBe(2);expect(result.tasks.every(t=>t.status==='done')).toBe(true);
  });
  it('失败会阻断依赖任务，保留独立任务结果',async()=>{
    vi.mocked(invokeCapability).mockResolvedValueOnce(plan([{id:'a',title:'前置',prompt:'p',cap:'text'},{id:'b',title:'依赖',prompt:'p',cap:'text',dependsOn:['a']},{id:'c',title:'独立',prompt:'p',cap:'text'}]) as any);
    const run=vi.fn(async task=>{if(task.id==='a')throw Error('真实失败');return{text:'独立完成'};});
    const result=await runWorkflow({...args(),executeText:run});expect(result.tasks.map(t=>t.status)).toEqual(['error','blocked','done']);expect(run).toHaveBeenCalledTimes(2);expect(result.text).toContain('整合');
  });
  it('执行子项目获得不同的真实目录与汇总工具轨迹',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'cupbox-delivery-'));dirs.push(dir);
    vi.mocked(invokeCapability).mockResolvedValueOnce(plan([{id:'a',title:'A',prompt:'p',cap:'text'},{id:'b',title:'B',prompt:'p',cap:'text'}]) as any);
    const result=await runWorkflow({...args(),workRoot:dir,executeText:async task=>{expect(task.outputDir.startsWith(dir)).toBe(true);expect(task.prompt).toContain(task.outputDir);return{text:'文件交付',trace:[{name:'fs_write_file',ok:true}]};}});
    expect(new Set(result.tasks.map(t=>t.outputDir)).size).toBe(2);expect(result.trace).toHaveLength(2);
  });
  it('严格模式根据验收意见修正一次并重新检查',async()=>{
    vi.mocked(invokeCapability).mockResolvedValueOnce(plan([{id:'a',title:'初稿',prompt:'p',cap:'text'}]) as any).mockResolvedValueOnce({text:JSON.stringify({passed:false,issues:['缺少结论']})} as any).mockResolvedValueOnce({text:JSON.stringify({passed:true,issues:[]})} as any);
    const a=args(),result=await runWorkflow({...a,criteria:'必须有结论',quality:'thorough',executeText:async()=>({text:'初稿'})});
    expect(a.integrate).toHaveBeenCalledTimes(2);expect(a.integrate.mock.calls[1][0]).toContain('缺少结论');expect(result.verification.passed).toBe(true);expect(a.emit.mock.calls.some(c=>c[0].id==='repair')).toBe(true);
  });
  it('验收解析失败会标明未完成，不伪造通过',async()=>{
    vi.mocked(invokeCapability).mockResolvedValueOnce(plan([{id:'a',title:'A',prompt:'p',cap:'text'}]) as any).mockResolvedValueOnce({text:'不是合法 JSON'} as any);
    const result=await runWorkflow({...args(),quality:'balanced',executeText:async()=>({text:'完成'})});expect(result.verification.passed).toBe(false);expect(result.text).toContain('验收未完成');
  });
  it('简单问题自动选择直接处理，减少额外调用',async()=>{
    vi.mocked(invokeCapability).mockResolvedValue({text:'简单答复'} as any);
    const result=await runWorkflow({...args(),workflow:'auto',prompt:'你好'});expect(result.workflow).toBe('direct');expect(invokeCapability).toHaveBeenCalledTimes(1);
  });
});
