import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import { safeRun } from '../src/core/run.js';
import { mkTmpDir, cleanupAll } from './helpers.js';

afterAll(cleanupAll);

describe('safeRun', () => {
  it('执行命令并捕获 stdout', async () => {
    const r = await safeRun('node -e "console.log(1+1)"');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('2');
    expect(r.timedOut).toBe(false);
  });

  it('非零退出码透传', async () => {
    const r = await safeRun('node -e "process.exit(3)"');
    expect(r.exitCode).toBe(3);
  });

  it('白名单放行匹配的命令', async () => {
    const r = await safeRun('node -e "console.log(\'ok\')"', {
      allowPrefixes: ['node -e', 'npm'],
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('ok');
  });

  it('白名单拒绝不匹配的命令', async () => {
    await expect(
      safeRun('node -e "console.log(1)"', { allowPrefixes: ['npm', 'git'] }),
    ).rejects.toThrow('不在允许列表');
  });

  it('超时被终止', async () => {
    const r = await safeRun('node -e "setTimeout(()=>{},10000)"', { timeoutMs: 800 });
    expect(r.timedOut).toBe(true);
    expect(r.durationMs).toBeLessThan(8000);
  }, 20000);

  it('超长输出被截断', async () => {
    const r = await safeRun('node -e "console.log(\'x\'.repeat(500000))"', { maxOutputChars: 1000 });
    expect(r.truncated).toBe(true);
    expect(r.stdout).toContain('已截断');
    expect(r.stdout.length).toBeLessThan(2000);
  });

  it('空命令报错', async () => {
    await expect(safeRun('   ')).rejects.toThrow('不能为空');
  });

  it('cwd 生效', async () => {
    const d = await mkTmpDir();
    const r = await safeRun('node -e "console.log(process.cwd())"', { cwd: d });
    expect(r.stdout.trim().toLowerCase()).toContain(path.basename(d).toLowerCase());
  });
});
