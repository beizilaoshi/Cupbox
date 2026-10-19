import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { hash, hashText, isSupportedAlgo } from '../src/core/hash.js';
import { mkTmpDir, cleanupAll } from './helpers.js';

afterAll(cleanupAll);

describe('hash', () => {
  it('sha256 文本哈希是标准值', () => {
    // echo -n "hello" | sha256sum
    expect(hashText('hello', 'sha256')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('中文 UTF-8 哈希稳定', () => {
    const a = hashText('中文测试', 'md5');
    const b = hashText('中文测试', 'md5');
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it('一次算多个算法', async () => {
    const r = await hash({ text: 'abc' }, ['md5', 'sha1', 'sha256']);
    expect(Object.keys(r)).toEqual(['md5', 'sha1', 'sha256']);
    expect(r.md5).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(r.sha1).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('文件哈希与文本哈希一致', async () => {
    const dir = await mkTmpDir();
    const f = path.join(dir, 'x.txt');
    await writeFile(f, 'hello', 'utf8');
    const r = await hash({ file: f }, ['sha256']);
    expect(r.sha256).toBe(hashText('hello', 'sha256'));
  });

  it('文件不存在时报错清晰', async () => {
    await expect(hash({ file: 'Z:/不存在.txt' })).rejects.toThrow(/ENOENT|不存在/);
  });

  it('text 和 file 都不给时报错', async () => {
    await expect(hash({})).rejects.toThrow('必须提供 text 或 file');
  });

  it('不支持的算法被拒绝', () => {
    expect(isSupportedAlgo('sha256')).toBe(true);
    expect(isSupportedAlgo('crc32')).toBe(false);
  });
});
