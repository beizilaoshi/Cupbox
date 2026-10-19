import { describe, it, expect } from 'vitest';
import {
  countChars,
  estimateTokens,
  resolveWindow,
  contextBreakdown,
  pushTrend,
  pushEvent,
  emptySessionContext,
  formatTokens,
  DEFAULT_CONTEXT_WINDOW,
} from '../src/core/context.js';

describe('context 字符统计与 token 估算', () => {
  it('countChars 区分中日韩与其它字符', () => {
    const s = countChars('你好abc');
    expect(s.cjk).toBe(2);
    expect(s.other).toBe(3);
    expect(s.total).toBe(5);
  });

  it('空串为 0，非空至少 1', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('。')).toBe(1);
  });

  it('中文按 1.5 字符/token，英文按 4 字符/token', () => {
    expect(estimateTokens('中'.repeat(15))).toBe(10);
    expect(estimateTokens('a'.repeat(40))).toBe(10);
    expect(estimateTokens('中'.repeat(15) + 'a'.repeat(20))).toBe(15);
  });

  it('resolveWindow：显式 > 环境变量 > 默认 128k', () => {
    expect(resolveWindow(32000)).toBe(32000);
    expect(resolveWindow()).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(resolveWindow(0)).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(resolveWindow(-5)).toBe(DEFAULT_CONTEXT_WINDOW);
  });
});

describe('contextBreakdown 六成分分解', () => {
  it('固定顺序 system → tools → user → injected → assistant → toolResults', () => {
    const b = contextBreakdown({ window: 100000 });
    expect(b.parts.map((p) => p.key)).toEqual([
      'system', 'tools', 'user', 'injected', 'assistant', 'toolResults',
    ]);
    expect(b.parts.every((p) => typeof p.label === 'string' && p.label.length > 0)).toBe(true);
  });

  it('总和 = 各成分之和，占用 = total/window', () => {
    const b = contextBreakdown({
      system: 'x'.repeat(400),   // 100 tokens
      toolSchemas: 'y'.repeat(800), // 200 tokens
      messages: [{ role: 'user', text: '你好'.repeat(15) }], // 30 CJK ≈ 20
      window: 100000,
    });
    const sum = b.parts.reduce((s, p) => s + p.tokens, 0);
    expect(b.total).toBe(sum);
    // system 100 + tools 200 + user（30 CJK ≈ 20 + 消息尾部 \n 计 1）= 321
    expect(b.total).toBe(321);
    expect(b.occupancy).toBeCloseTo(321 / 100000, 10);
    expect(b.window).toBe(100000);
  });

  it('消息按角色归入各自成分，tool 结果归入 toolResults', () => {
    const b = contextBreakdown({
      messages: [
        { role: 'user', text: 'aa'.repeat(20) },          // 40 chars → 10
        { role: 'assistant', text: 'bb'.repeat(40) },     // 80 chars → 20
        { role: 'tool', results: ['cc'.repeat(80)] },     // 80 chars → 20
      ],
      window: 100000,
    });
    // 每条消息/结果尾部会补一个 \n（计入 other 字符）
    const byKey = Object.fromEntries(b.parts.map((p) => [p.key, p.tokens]));
    expect(byKey.user).toBe(11);        // (40+1) 字符 ÷4 → 11
    expect(byKey.assistant).toBe(21);   // (80+1) 字符 ÷4 → 21
    expect(byKey.toolResults).toBe(41); // (160+1) 字符 ÷4 → 41
    expect(byKey.system).toBe(0);
  });
});

describe('趋势与事件', () => {
  it('pushTrend 追加并按容量裁剪', () => {
    let list: ReturnType<typeof pushTrend> = [];
    list = pushTrend(list, { at: 1, tokens: 100 });
    list = pushTrend(list, { at: 2, tokens: 200 });
    expect(list).toHaveLength(2);
    expect(list[1].tokens).toBe(200);
    // cap=3 时超容量裁剪保留最近 3 条
    list = pushTrend(list, { at: 3, tokens: 300 }, 3);
    list = pushTrend(list, { at: 4, tokens: 400 }, 3);
    expect(list).toHaveLength(3);
    expect(list[0].at).toBe(2);
    expect(list[2].tokens).toBe(400);
  });

  it('pushEvent 追加并按容量裁剪', () => {
    let events: ReturnType<typeof pushEvent> = [];
    events = pushEvent(events, { at: 1, kind: 'inject', label: '注入记忆', delta: 500 });
    events = pushEvent(events, { at: 2, kind: 'compact', label: '压缩历史', delta: -1200 });
    expect(events).toHaveLength(2);
    expect(events[1].delta).toBe(-1200);
    events = pushEvent(events, { at: 3, kind: 'switch', label: '切换模型' }, 2);
    expect(events).toHaveLength(2);
    expect(events[1].kind).toBe('switch');
  });

  it('空档案结构完整', () => {
    const e = emptySessionContext(64000);
    expect(e.window).toBe(64000);
    expect(e.last).toBeNull();
    expect(e.trend).toEqual([]);
    expect(e.events).toEqual([]);
    expect(e.totals).toEqual({ requests: 0, prompt: 0, output: 0 });
  });
});

describe('formatTokens 紧凑展示', () => {
  it('千分位与百万缩写', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1234)).toBe('1.2k');
    expect(formatTokens(12345)).toBe('12k');
    expect(formatTokens(1_200_000)).toBe('1.2M');
    expect(formatTokens(-10)).toBe('0');
    expect(formatTokens(Number.NaN)).toBe('0');
  });
});
