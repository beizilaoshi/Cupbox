import { describe, it, expect } from 'vitest';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { listProcesses, killProcess, hasTool } from '../src/core/proc.js';

describe('listProcesses', () => {
  it('能列出进程且包含当前 node 进程', async () => {
    const list = await listProcesses({ maxResults: 50 });
    expect(list.length).toBeGreaterThan(5);
    // 测试进程自己就是 node
    expect(list.some((p) => /node/i.test(p.name))).toBe(true);
  }, 15000);

  it('query 过滤生效', async () => {
    const all = await listProcesses({ maxResults: 100000 });
    const target = all.find((p) => p.pid > 0);
    if (!target) return;
    const filtered = await listProcesses({ query: target.name.slice(0, 4) });
    expect(filtered.every((p) => p.name.toLowerCase().includes(target.name.slice(0, 4).toLowerCase()))).toBe(true);
  }, 15000);

  it('kill 拒绝名字不匹配的进程（安全设计）', async () => {
    const r = await killProcess(4, 'no-such-process-name-xyz');
    // PID 4 存在（System/idle）但名字对不上 → 拒绝
    expect(r.killed).toBe(false);
    expect(r.message).toMatch(/不符|不存在/);
  }, 15000);

  it('kill 校验非法 PID 与空名字', async () => {
    await expect(killProcess(-1, 'x')).rejects.toThrow('无效 PID');
    await expect(killProcess(100, '  ')).rejects.toThrow('expectedName');
  });
});

describe('hasTool', () => {
  it('探测系统工具', async () => {
    expect(await hasTool(process.platform === 'win32' ? 'powershell' : 'sh')).toBe(true);
    expect(await hasTool('definitely-not-a-real-tool-xyz')).toBe(false);
  }, 15000);
});
