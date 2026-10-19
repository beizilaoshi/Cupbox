import { describe, it, expect, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { mkTmpDir, seed, cleanupAll } from './helpers.js';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'dist', 'index.js');
const built = existsSync(cli);

afterAll(cleanupAll);

/** 跑 CLI 并返回 {stdout, stderr, code}；进程非零退出不抛异常。 */
async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cli, ...args], {
      cwd: root,
      windowsHide: true,
      timeout: 60000,
    });
    return { stdout, stderr, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.code ?? 1 };
  }
}

describe.skipIf(!built)('CLI 冒烟', () => {
  it('version 输出语义化版本', async () => {
    const r = await runCli(['version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('help 列出所有命令', async () => {
    const r = await runCli(['help']);
    expect(r.code).toBe(0);
    for (const c of ['search', 'rename', 'organize', 'ocr', 'clip', 'mcp']) {
      expect(r.stdout).toContain(c);
    }
  });

  it('hash --text --json', async () => {
    const r = await runCli(['hash', '--text', 'hello', '--json', '--algo', 'sha256,md5']);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.sha256).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    expect(j.md5).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('time 秒级时间戳', async () => {
    const r = await runCli(['time', '1700000000', '--json']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).iso).toBe('2023-11-14T22:13:20.000Z');
  });

  it('codec base64 编码中文', async () => {
    const r = await runCli(['codec', 'b64e', '你好']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(Buffer.from('你好', 'utf8').toString('base64'));
  });

  it('search 内容命中', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'a.txt': 'keyword-alpha\nline2', 'b/c.md': 'nothing here' });
    const r = await runCli(['search', d, '-c', 'keyword-alpha', '--json']);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.hits).toHaveLength(1);
    expect(j.hits[0].matches[0].line).toBe(1);
  });

  it('organize 默认执行、--dry-run 只预览', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'pic.png': '' });
    const dry = await runCli(['organize', d, '--dry-run']);
    expect(dry.code).toBe(0);
    expect(dry.stdout).toContain('📋');
    expect(await readdir(d)).toEqual(['pic.png']); // 没动

    const real = await runCli(['organize', d]);
    expect(real.code).toBe(0);
    expect(await readdir(d)).toContain('Images');
  });

  it('rename 模板 + dry-run', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'a.txt': '', 'b.txt': '' });
    const r = await runCli(['rename', d, '--template', '{n}-{name}', '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('01-a.txt');
    expect(await readdir(d)).toEqual(['a.txt', 'b.txt']);
  });

  it('未知命令退出码 2', async () => {
    const r = await runCli(['definitely-not-a-command']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('未知命令');
  });

  it('run 子命令执行并透传退出码', async () => {
    // 注意：命令经 shell 执行，表达式里避免引号（Windows cmd 引号规则不同）
    const ok = await runCli(['run', '--', 'node', '-e', 'console.log(40+2)']);
    expect(ok.stdout).toContain('42');
    const bad = await runCli(['run', '--', 'node', '-e', 'process.exit(7)']);
    expect(bad.code).not.toBe(0);
  });
});
