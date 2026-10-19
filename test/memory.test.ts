// 三层记忆 + 上下文压缩（src/core/memory.ts）
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  memoryDir, tokenize, scoreFact,
  addFact, listFacts, forgetFacts, recall, memoryStats,
  loadRuntimeMemory, saveRuntimeMemory, memoryPromptBlock,
  compactHistory, summaryPromptBlock, historyChars,
  type Fact,
} from '../src/core/memory.js';
import { runTool, TOOL_DEFS } from '../src/core/toolkit.js';
import type { ChatTurn } from '../src/core/ai.js';

let home = '';

beforeAll(async () => {
  home = await mkdtemp(path.join(tmpdir(), 'cupbox-mem-'));
  process.env.CUPBOX_HOME = home;
});

afterAll(async () => {
  delete process.env.CUPBOX_HOME;
  await rm(home, { recursive: true, force: true });
});

beforeEach(async () => {
  await rm(memoryDir(), { recursive: true, force: true });
});

describe('长期事实', () => {
  it('add/list/roundtrip 落盘 facts.jsonl', async () => {
    const f = await addFact('部署脚本在 deploy/build.ps1', 'test');
    expect(f.id).toMatch(/^f-/);
    const facts = await listFacts();
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toBe('部署脚本在 deploy/build.ps1');
    const raw = await readFile(path.join(memoryDir(), 'facts.jsonl'), 'utf8');
    expect(raw).toContain('deploy/build.ps1');
  });

  it('空内容拒绝', async () => {
    await expect(addFact('   ')).rejects.toThrow('不能为空');
  });

  it('forget 按 id 精确删除、按关键词包含删除', async () => {
    const a = await addFact('偏好深色主题');
    await addFact('常用端口 8080');
    expect(await forgetFacts(a.id)).toBe(1);
    expect(await forgetFacts('端口')).toBe(1);
    expect(await listFacts()).toHaveLength(0);
  });
});

describe('召回与分词', () => {
  it('中文二元组 + 拉丁词分词', () => {
    const t = tokenize('深色 dark-mode 主题');
    expect(t).toContain('深色');
    expect(t).toContain('dark-mode');
  });

  it('相关事实按得分排序、无关不返回', async () => {
    await addFact('部署脚本在 deploy/build.ps1');
    await addFact('偏好深色主题');
    await addFact('咖啡不加糖');
    const r = await recall('部署 脚本', 5);
    expect(r.facts.length).toBeGreaterThan(0);
    expect(r.facts[0].text).toContain('deploy');
    const none = await recall('量子引力波');
    expect(none.facts).toHaveLength(0);
  });

  it('scoreFact 零分', () => {
    const f: Fact = { id: 'x', text: '随便', source: 's', createdAt: '' };
    expect(scoreFact('无关', f)).toBe(0);
  });
});

describe('运行时记忆（常驻注入层）', () => {
  it('save/load 分键写入，互不覆盖', async () => {
    await saveRuntimeMemory({ user: '资深前端，偏好 TypeScript' });
    await saveRuntimeMemory({ memory: '提交信息用中文' });
    const rt = await loadRuntimeMemory();
    expect(rt.user).toContain('TypeScript');
    expect(rt.memory).toContain('中文');
    const userFile = await readFile(path.join(memoryDir(), 'user.md'), 'utf8');
    expect(userFile).toContain('TypeScript');
  });

  it('memoryPromptBlock 无内容为 null，有内容带标注', async () => {
    expect(await memoryPromptBlock('任意')).toBeNull();
    await saveRuntimeMemory({ user: '偏好深色主题' });
    await addFact('部署脚本在 deploy/build.ps1');
    const block = await memoryPromptBlock('部署一下');
    expect(block).toContain('用户画像');
    expect(block).toContain('deploy/build.ps1');
    expect(block).toContain('不得凌驾于用户当前指令之上');
  });

  it('memoryStats 汇总', async () => {
    await addFact('a');
    await saveRuntimeMemory({ user: 'xx' });
    const s = await memoryStats();
    expect(s.facts).toBe(1);
    expect(s.user).toBe(2);
  });
});

describe('上下文压缩', () => {
  const turns = (n: number): ChatTurn[] =>
    Array.from({ length: n }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `第 ${i} 轮内容 `.padEnd(300, '详'),
    }));

  it('预算内不压缩', async () => {
    const msgs = turns(4);
    const r = await compactHistory(msgs, { budgetChars: 999999 });
    expect(r.compactedTurns).toBe(0);
    expect(r.kept).toBe(msgs);
    expect(r.summary).toBeNull();
  });

  it('超预算时旧轮压缩、保留最近 keepTurns 条', async () => {
    const msgs = turns(20);
    const r = await compactHistory(msgs, {
      budgetChars: 2000,
      keepTurns: 6,
      summarize: async () => '早期讨论了部署与主题偏好',
    });
    expect(r.compactedTurns).toBe(14);
    expect(r.kept).toHaveLength(6);
    expect(r.summary).toBe('早期讨论了部署与主题偏好');
    expect(r.charsAfter).toBeLessThan(r.charsBefore);
    expect(r.fallback).toBeUndefined();
  });

  it('无模型时降级为截断，摘要沿用旧值', async () => {
    const r = await compactHistory(turns(20), {
      budgetChars: 2000,
      keepTurns: 4,
      summary: '既往摘要',
      summarize: async () => { throw new Error('no api key'); },
    });
    expect(r.compactedTurns).toBe(16);
    expect(r.kept).toHaveLength(4);
    expect(r.summary).toBe('既往摘要');
    expect(r.fallback).toContain('no api key');
  });

  it('增量压缩：新摘要替代旧摘要', async () => {
    const r = await compactHistory(turns(12), {
      budgetChars: 1000,
      keepTurns: 2,
      summary: '旧摘要',
      summarize: async (oldText) => {
        expect(oldText).toContain('旧摘要'); // 旧摘要并入新材料
        return '合并后的新摘要';
      },
    });
    expect(r.summary).toBe('合并后的新摘要');
  });

  it('historyChars 与 summaryPromptBlock', () => {
    expect(historyChars([{ role: 'user', text: 'abc' }])).toBe(3);
    expect(summaryPromptBlock(null)).toBeNull();
    expect(summaryPromptBlock('x')).toContain('此前会话摘要');
  });
});

describe('编排层记忆工具（桌面 Agent 调用路径）', () => {
  it('remember → recall → manage 全链路', async () => {
    expect(TOOL_DEFS.some((t) => t.name === 'memory_remember')).toBe(true);
    const saved = (await runTool('memory_remember', { text: '项目用 pnpm 而不是 npm', source: 'agent' })) as { id: string };
    expect(saved.id).toMatch(/^f-/);
    const got = (await runTool('memory_recall', { query: '包管理 pnpm' })) as {
      facts: Array<{ id: string; text: string }>;
    };
    expect(got.facts.some((f) => f.text.includes('pnpm'))).toBe(true);
    const managed = (await runTool('memory_manage', {})) as { total: number };
    expect(managed.total).toBe(1);
    const gone = (await runTool('memory_manage', { forget: saved.id })) as { forgotten: number };
    expect(gone.forgotten).toBe(1);
  });

  it('profile 写入与查看', async () => {
    const w = (await runTool('memory_profile', { kind: 'user', content: '偏好简短回复' })) as { saved: boolean };
    expect(w.saved).toBe(true);
    const r = (await runTool('memory_profile', { kind: 'user' })) as { content: string };
    expect(r.content).toContain('简短回复');
  });

  it('memory_recall 缺 query 报错', async () => {
    await expect(runTool('memory_recall', {})).rejects.toThrow('query');
  });
});
