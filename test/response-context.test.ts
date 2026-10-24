import { describe,it,expect } from 'vitest';
import { ensureMessageIds,feedbackHistory,pendingHistory,preferredContext,updateFeedback } from '../desktop/response-context.js';
describe('评价对上下文的影响',()=>{
  it('summary cursor prevents resubmitting compacted turns and feedback rebuilds the context',()=>{
    const s:any={summary:'早期计划',summaryThrough:2,messages:[{id:'a',role:'user',text:'旧计划'},{id:'b',role:'assistant',text:'旧答复'},{id:'c',role:'user',text:'接着做'}]};
    expect(pendingHistory(s)).toEqual([{role:'user',text:'接着做'}]);expect(s.messages).toHaveLength(3);
    updateFeedback(s,'b','down');expect(s.summaryThrough).toBe(0);expect(pendingHistory(s)).toEqual([{role:'user',text:'旧计划'},{role:'user',text:'接着做'}]);
    s.summary='旧格式摘要';s.summaryThrough=999;expect(pendingHistory(s)).toEqual(feedbackHistory(s));
  });
  it('旧对话生成稳定 ID，差评会清除摘要并排除答复',()=>{
    const s:any={summary:'可能含错误结论',messages:[{role:'user',text:'问题'},{role:'assistant',text:'错误答案'}]};ensureMessageIds(s);const id=s.messages[1].id;ensureMessageIds(s);expect(s.messages[1].id).toBe(id);
    updateFeedback(s,id,'down');expect(s.summary).toBeNull();expect(feedbackHistory(s)).toEqual([{role:'user',text:'问题'}]);
    updateFeedback(s,id,'none');expect(feedbackHistory(s)).toHaveLength(2);
  });
  it('好评仅优先保留参考，不自动创建事实；参考块长度有上限',()=>{
    const s:any={messages:Array.from({length:5},(_,i)=>({id:String(i),role:'assistant',text:String(i).repeat(2000),feedback:'up'}))};
    const block=preferredContext(s);expect(block).toContain('当前指令优先');expect(block).not.toContain('00000');expect(block.length).toBeLessThan(3800);expect(s.messages.every(m=>!m.memoryId)).toBe(true);
  });
  it('拒绝未知评价和不存在的回复',()=>{
    expect(()=>updateFeedback({messages:[]},'x','up')).toThrow('找不到');expect(()=>updateFeedback({messages:[]},'x','wrong')).toThrow('无效');
  });
});
