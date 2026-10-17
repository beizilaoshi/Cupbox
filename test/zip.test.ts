import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { zipCreate, zipExtract, zipList } from '../src/core/zip.js';
import { mkTmpDir, seed, cleanupAll } from './helpers.js';

afterAll(cleanupAll);

describe('zip', () => {
  it('打包目录 → 清单 → 解压，文件齐全（含中文名）', async () => {
    const d = await mkTmpDir();
    await seed(d, {
      'src/说明文档.txt': '你好 zip',
      'src/app.js': 'console.log(1)',
      'readme.md': '# hi',
    });
    const zipPath = path.join(d, 'out.zip');
    const created = await zipCreate({ sources: [path.join(d, 'src'), path.join(d, 'readme.md')], output: zipPath });
    expect(created.ok).toBe(true);

    const entries = await zipList(zipPath);
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.some((e) => e.includes('说明文档.txt'))).toBe(true);

    const dest = path.join(d, 'unzipped');
    const extracted = await zipExtract(zipPath, dest);
    expect(extracted.ok).toBe(true);

    const { readFile } = await import('node:fs/promises');
    // bsdtar 打包时保留传入路径的结构
    const found = await findFile(dest, '说明文档.txt');
    expect(found).toBeTruthy();
    expect(await readFile(found!, 'utf8')).toBe('你好 zip');
  }, 60000);

  it('源不存在时报错', async () => {
    const d = await mkTmpDir();
    await expect(
      zipCreate({ sources: [path.join(d, 'nope.txt')], output: path.join(d, 'x.zip') }),
    ).rejects.toThrow('源不存在');
  });

  it('输出不是 .zip 时拒绝', async () => {
    const d = await mkTmpDir();
    await expect(zipCreate({ sources: [d], output: path.join(d, 'x.rar') })).rejects.toThrow('.zip');
  });

  it('解压不存在的包时报错', async () => {
    const d = await mkTmpDir();
    await expect(zipExtract(path.join(d, 'no.zip'), d)).rejects.toThrow('压缩包不存在');
  });
});

async function findFile(root: string, basename: string): Promise<string | null> {
  const { readdir: rd } = await import('node:fs/promises');
  const entries = await rd(root, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      const found = await findFile(full, basename);
      if (found) return found;
    } else if (e.name === basename) {
      return full;
    }
  }
  return null;
}
