import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { search } from '../src/core/search.js';
import { mkTmpDir, seed, cleanupAll } from './helpers.js';

let dir: string;

beforeAll(async () => {
  dir = await mkTmpDir();
  await seed(dir, {
    'src/app.ts': 'const needle = 1;\nconsole.log("hello world");\n// TODO needle again\n',
    'src/util.ts': 'export function helper() { return 42; }\n',
    'docs/readme.md': '# 项目说明\n这里提到 needle 关键词\n',
    'data/values.json': '{"needle": true}',
    'node_modules/pkg/index.js': 'needle in node_modules should be ignored',
    '.hidden/secret.txt': 'needle hidden',
    'assets/logo.png': 'not really text but has needle bytes',
  });
});

afterAll(cleanupAll);

describe('search', () => {
  it('按文件名搜索（不区分大小写）', async () => {
    const r = await search({ root: dir, pattern: 'APP' });
    expect(r.hits.map((h) => path.basename(h.path))).toContain('app.ts');
  });

  it('按内容搜索并返回行号', async () => {
    const r = await search({ root: dir, content: 'needle' });
    const app = r.hits.find((h) => h.path.endsWith('app.ts'));
    expect(app).toBeTruthy();
    expect(app!.matches.map((m) => m.line)).toEqual([1, 3]);
    // node_modules 被跳过
    expect(r.hits.some((h) => h.path.includes('node_modules'))).toBe(false);
    // 隐藏目录默认跳过
    expect(r.hits.some((h) => h.path.includes('.hidden'))).toBe(false);
  });

  it('glob 扩展名过滤', async () => {
    const r = await search({ root: dir, content: 'needle', glob: '*.md' });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].path.endsWith('readme.md')).toBe(true);
  });

  it('正则模式', async () => {
    const r = await search({ root: dir, pattern: 'val.*\\.json', regex: true });
    expect(r.hits.map((h) => path.basename(h.path))).toContain('values.json');
  });

  it('maxResults 截断标记', async () => {
    const r = await search({ root: dir, content: 'needle', maxResults: 1 });
    expect(r.hits).toHaveLength(1);
    expect(r.truncated).toBe(true);
  });

  it('pattern 和 content 都缺省时报错', async () => {
    await expect(search({ root: dir })).rejects.toThrow('至少提供一个');
  });

  it('中英文混合内容可搜索', async () => {
    const r = await search({ root: dir, content: '项目说明' });
    expect(r.hits.some((h) => h.path.endsWith('readme.md'))).toBe(true);
  });
});
