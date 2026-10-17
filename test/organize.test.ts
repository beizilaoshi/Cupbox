import { describe, it, expect, afterAll } from 'vitest';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { organize } from '../src/core/organize.js';
import { mkTmpDir, seed, cleanupAll } from './helpers.js';

afterAll(cleanupAll);

async function isDir(p: string): Promise<boolean> {
  return stat(p).then((s) => s.isDirectory(), () => false);
}

describe('organize', () => {
  it('category 模式按类型分目录', async () => {
    const d = await mkTmpDir();
    await seed(d, {
      'a.png': '', 'b.pdf': '', 'c.mp4': '', 'd.zip': '', 'e.xyz': '', 'song.mp3': '',
    });
    const r = await organize({ dir: d, mode: 'category', dryRun: false });
    expect(r.applied).toBe(true);
    expect(await isDir(path.join(d, 'Images'))).toBe(true);
    expect(await isDir(path.join(d, 'Documents'))).toBe(true);
    expect(await isDir(path.join(d, 'Videos'))).toBe(true);
    expect(await isDir(path.join(d, 'Archives'))).toBe(true);
    expect(await isDir(path.join(d, 'Audio'))).toBe(true);
    expect(await isDir(path.join(d, 'Other'))).toBe(true);
    expect(await readdir(path.join(d, 'Images'))).toEqual(['a.png']);
    // 根目录不该再有散落文件
    const rootFiles = (await readdir(d, { withFileTypes: true })).filter((e) => e.isFile());
    expect(rootFiles).toHaveLength(0);
  });

  it('dry-run 预览但不落盘', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'a.png': '' });
    const r = await organize({ dir: d, mode: 'category', dryRun: true });
    expect(r.changes.some((c) => c.to.startsWith('Images'))).toBe(true);
    expect(await isDir(path.join(d, 'Images'))).toBe(false);
    expect(await readdir(d)).toEqual(['a.png']);
  });

  it('已在目标目录的文件被跳过', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'Images/a.png': '' });
    const r = await organize({ dir: d, mode: 'category', dryRun: false });
    expect(r.changes[0].skippedReason).toBe('已在目标目录');
    expect(await readdir(path.join(d, 'Images'))).toEqual(['a.png']);
  });

  it('同名冲突自动改名，不覆盖', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'a.png': 'root', 'Images/a.png': 'existing' });
    const r = await organize({ dir: d, mode: 'category', dryRun: false });
    const moved = r.changes.find((c) => c.from === 'a.png');
    expect(moved?.to).toBe(path.join('Images', 'a (1).png'));
    const names = (await readdir(path.join(d, 'Images'))).sort();
    expect(names).toEqual(['a (1).png', 'a.png']);
  });

  it('regex 模式用捕获组当目录名', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'project-alpha-build.zip': '', 'beta-output.zip': '', 'nomatch.zip': '' });
    const r = await organize({ dir: d, mode: 'regex', pattern: '^([a-z]+)-', dryRun: false });
    expect(await isDir(path.join(d, 'project'))).toBe(true);
    expect(await isDir(path.join(d, 'beta'))).toBe(true);
    const skipped = r.changes.find((c) => c.from === 'nomatch.zip');
    expect(skipped?.skippedReason).toContain('未匹配');
  });

  it('regex 捕获组等于完整文件名时安全跳过（不崩溃）', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'evil-name.zip': '' });
    const r = await organize({ dir: d, mode: 'regex', pattern: '^(.*)$', dryRun: false });
    expect(r.changes[0].applied).toBe(false);
    expect(r.changes[0].skippedReason).toContain('占用');
    expect(await readdir(d)).toEqual(['evil-name.zip']); // 原地不动
  });

  it('date 模式按年-月归档', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'old.txt': '' });
    const r = await organize({ dir: d, mode: 'date', dryRun: false });
    const to = r.changes[0].to;
    expect(to).toMatch(/^\d{4}-\d{2}[\\/]old\.txt$/);
  });

  it('无效正则报错', async () => {
    const d = await mkTmpDir();
    await expect(organize({ dir: d, mode: 'regex', pattern: '([bad' })).rejects.toThrow('无效的正则');
  });

  it('regex 模式缺 pattern 报错', async () => {
    const d = await mkTmpDir();
    await expect(organize({ dir: d, mode: 'regex' })).rejects.toThrow('必须提供 pattern');
  });
});
