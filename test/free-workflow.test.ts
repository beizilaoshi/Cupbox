import {describe,it,expect,vi} from 'vitest';
import {runFreeWorkflow} from '../src/core/free-workflow.js';
const defs=[{name:'fs_read',description:'读取经过批准的项目文件',parameters:{type:'object',properties:{path:{type:'string'}},required:['path']}}];
describe('free-model compatible workflow',()=>{
  it('executes only an advertised tool and returns its real outcome to the model',async()=>{
    const executeTool=vi.fn(async()=>({ok:true,text:'真实内容'})),onTool=vi.fn();const chat=vi.fn().mockResolvedValueOnce({text:JSON.stringify({type:'tool',name:'fs_read',arguments:{path:'note.txt'}})}).mockResolvedValueOnce({text:JSON.stringify({type:'final',text:'根据读取内容回答'})});const result=await runFreeWorkflow({prompt:'读取文件',executeTool,onTool},defs,chat,4);expect(executeTool).toHaveBeenCalledWith('fs_read',{path:'note.txt'});expect(result.text).toBe('根据读取内容回答');expect(result.requests).toBe(2);expect(result.trace[0].ok).toBe(true);expect(JSON.stringify(chat.mock.calls[1][0])).toContain('真实内容');
  });
  it('plain text or malformed JSON is never interpreted as a tool command',async()=>{
    const executeTool=vi.fn();for(const text of ['fs_read note.txt','```json\n{"type":"tool"}\n```','{"type":"tool"']){const result=await runFreeWorkflow({prompt:'test',executeTool},defs,async()=>({text}),4);expect(result.text).toMatch(/fs_read note.txt|已停止/);}expect(executeTool).not.toHaveBeenCalled();
  });
  it('unknown tools and invalid argument shapes stop before execution',async()=>{
    const executeTool=vi.fn();for(const value of [{type:'tool',name:'shell',arguments:{cmd:'delete'}},{type:'tool',name:'fs_read',arguments:[]}])await expect(runFreeWorkflow({prompt:'test',executeTool},defs,async()=>({text:JSON.stringify(value)}),4)).rejects.toThrow('未授权');expect(executeTool).not.toHaveBeenCalled();
  });
  it('respects cancellation, approval refusal and hard turn cap without retrying',async()=>{
    const control=new AbortController(),executeTool=vi.fn(async()=>{throw Error('已拒绝');});const chat=vi.fn(async()=>({text:JSON.stringify({type:'tool',name:'fs_read',arguments:{path:'a'}})}));const result=await runFreeWorkflow({prompt:'test',executeTool},defs,chat,2);expect(chat).toHaveBeenCalledTimes(1);expect(executeTool).toHaveBeenCalledTimes(1);expect(result.trace.every(t=>!t.ok)).toBe(true);expect(result.text).toContain('未自动重试');
    const bounded=await runFreeWorkflow({prompt:'test',executeTool:async()=>({ok:true})},defs,chat,2);expect(bounded.requests).toBe(2);expect(bounded.text).toContain('上限');
    await expect(runFreeWorkflow({prompt:'test',signal:control.signal,executeTool},defs,async()=>{control.abort();return{text:JSON.stringify({type:'tool',name:'fs_read',arguments:{}})};},4)).rejects.toThrow();expect(executeTool).toHaveBeenCalledTimes(1);
  });
});
