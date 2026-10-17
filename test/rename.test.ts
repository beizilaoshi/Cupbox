import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { batchRename } from '../src/core/rename.js';
import { mkTmpDir, seed, cleanupAll } from './helpers.js';

let dir: string;

beforeAll(async () => {
  dir = await mkTmpDir();
  await seed(dir, {
    'IMG_0001.jpg': '',
    'IMG_0002.jpg': '',
    'photo.png': '',
    'report final.docx': '',
    'sub/nested.txt': '',
  });
});

afterAll(cleanupAll);

describe('batchRename', () => {
  it('字面替换 + dry-run 不落盘', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'foo-bar.txt': '', 'foo-baz.txt': '' });
    const r = await batchRename({ dir: d, find: 'foo', replace: 'qux', dryRun: true });
    expect(r.changes.filter((c) => c.to !== c.from)).toHaveLength(2);
    expect(r.applied).toBe(false);
    const names = await readdir(d);
    expect(names).toContain('foo-bar.txt'); // 没真的改
  });

  it('真正执行改名', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'foo-bar.txt': '' });
    const r = await batchRename({ dir: d, find: 'foo', replace: 'qux', dryRun: false });
    expect(r.applied).toBe(true);
    const names = await readdir(d);
    expect(names).toEqual(['qux-bar.txt']);
  });

  it('正则与 $1 引用', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'report-2024-final.docx': '' });
    const r = await batchRename({
      dir: d,
      find: '^(\\w+)-(\\d{4})-(\\w+)$',
      replace: '$3_$2',
      byRegex: true,
      dryRun: false,
    });
    expect(r.changes[0].to).toBe('final_2024.docx');
  });

  it('模板序号命名，保留扩展名', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'a.jpg': '', 'b.jpg': '', 'c.jpg': '' });
    const r = await batchRename({ dir: d, template: '{n}-{name}', dryRun: false });
    const names = (await readdir(d)).sort();
    expect(names).toEqual(['01-a.jpg', '02-b.jpg', '03-c.jpg']);
  });

  it('模板与现有文件重名时跳过不覆盖', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'keep.txt': '', 'old.txt': '' });
    const r = await batchRename({ dir: d, template: 'keep', dryRun: false });
    const keep = r.changes.find((c) => c.from === 'old.txt');
    expect(keep?.skippedReason).toContain('重名');
    const names = await readdir(d);
    expect(names.sort()).toEqual(['keep.txt', 'old.txt']); // 两个都还在
  });

  it('includeExt 过滤只改指定扩展名', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'x.jpg': '', 'y.txt': '' });
    const r = await batchRename({ dir: d, find: 'x', replace: 'z', includeExt: '*.jpg', dryRun: false });
    expect(r.changes).toHaveLength(1);
    const names = await readdir(d);
    expect(names.sort()).toEqual(['y.txt', 'z.jpg']);
  });

  it('递归模式连子目录一起改', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'top.txt': '', 'sub/deep.txt': '' });
    const r = await batchRename({ dir: d, find: 'txt', replace: 'md', recursive: true, dryRun: false });
    expect(r.changes.filter((c) => c.applied)).toHaveLength(2);
  });

  it('目录不存在时报错', async () => {
    await expect(batchRename({ dir: 'Z:/不存在目录', find: 'a', replace: 'b' })).rejects.toThrow('目录不存在');
  });

  it('find 和 template 都缺省时报错', async () => {
    await expect(batchRename({ dir })).rejects.toThrow('find 或 template');
  });

  it('无效正则报错清晰', async () => {
    await expect(batchRename({ dir, find: '([bad', replace: 'x', byRegex: true })).rejects.toThrow('无效的正则');
  });
});
