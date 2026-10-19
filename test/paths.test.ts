import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dataHome, legacyHome, migrateLegacyHome, systemDocumentsDir } from '../src/core/paths.js';

/** v1.2.0 存储目录：默认「文档/Cupbox」，CUPBOX_HOME 覆盖，旧 ~/.cupbox 自动迁移。 */

let tmpRoot: string;
const envSnapshot: string | undefined = process.env.CUPBOX_HOME;

beforeAll(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), 'cupbox-paths-'));
});

afterAll(async () => {
  if (envSnapshot === undefined) delete process.env.CUPBOX_HOME;
  else process.env.CUPBOX_HOME = envSnapshot;
});

describe('数据目录解析', () => {
  it('CUPBOX_HOME 有值 → $CUPBOX_HOME/.cupbox（与旧语义一致，测试隔离靠它）', () => {
    process.env.CUPBOX_HOME = tmpRoot;
    expect(dataHome()).toBe(path.join(tmpRoot, '.cupbox'));
    delete process.env.CUPBOX_HOME;
  });

  it('无覆盖 → 指定的 Documents 目录下 Cupbox（Documents 存在时）', async () => {
    delete process.env.CUPBOX_HOME;
    const docs = path.join(tmpRoot, 'Documents');
    await mkdir(docs, { recursive: true });
    expect(dataHome(docs)).toBe(path.join(docs, 'Cupbox'));
  });

  it('Documents 不存在 → 退回 ~/.cupbox（不凭空造目录）', () => {
    delete process.env.CUPBOX_HOME;
    expect(dataHome(path.join(tmpRoot, 'no-such-docs'))).toBe(legacyHome());
  });

  it('legacyHome = ~/.cupbox（迁移源）', () => {
    expect(legacyHome()).toContain('.cupbox');
  });

  it('未显式传 Documents → 解析系统「文档」目录（Windows 跟随重定向）', () => {
    delete process.env.CUPBOX_HOME;
    const docs = systemDocumentsDir();
    expect(existsSync(docs)).toBe(true); // 系统文档目录必须存在
    // 与桌面端 app.getPath('documents') 同源：文档存在 → 文档/Cupbox，否则回退 ~/.cupbox
    expect(dataHome()).toBe(existsSync(docs) ? path.join(docs, 'Cupbox') : legacyHome());
    expect(dataHome().endsWith('Cupbox')).toBe(true);
  });
});

describe('旧目录迁移', () => {
  it('新目录为空 + 旧目录有数据 → 整树复制，且不删除旧数据', async () => {
    const legacy = path.join(tmpRoot, 'legacy-a');
    const target = path.join(tmpRoot, 'target-a');
    await mkdir(path.join(legacy, 'memory'), { recursive: true });
    await writeFile(path.join(legacy, 'config.json'), '{"model":"m1"}', 'utf8');
    await writeFile(path.join(legacy, 'memory', 'facts.jsonl'), '{"id":"f1"}\n', 'utf8');

    const migrated = await migrateLegacyHome({ target, legacy });
    expect(migrated).toBe(true);
    expect(JSON.parse(await readFile(path.join(target, 'config.json'), 'utf8')).model).toBe('m1');
    expect(existsSync(path.join(target, 'memory', 'facts.jsonl'))).toBe(true);
    expect(existsSync(path.join(legacy, 'config.json'))).toBe(true); // 旧数据保留
  });

  it('新目录已有内容 → 绝不覆盖', async () => {
    const legacy = path.join(tmpRoot, 'legacy-b');
    const target = path.join(tmpRoot, 'target-b');
    await mkdir(legacy, { recursive: true });
    await writeFile(path.join(legacy, 'config.json'), '{"model":"old"}', 'utf8');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'config.json'), '{"model":"new"}', 'utf8');

    expect(await migrateLegacyHome({ target, legacy })).toBe(false);
    expect(JSON.parse(await readFile(path.join(target, 'config.json'), 'utf8')).model).toBe('new');
  });

  it('CUPBOX_HOME 显式覆盖时不做迁移（便携/测试隔离）', async () => {
    process.env.CUPBOX_HOME = tmpRoot;
    try {
      expect(await migrateLegacyHome({ target: path.join(tmpRoot, 't-c'), legacy: path.join(tmpRoot, 'l-c') })).toBe(false);
    } finally {
      delete process.env.CUPBOX_HOME;
    }
  });

  it('旧目录不存在 → 静默返回 false', async () => {
    expect(await migrateLegacyHome({ target: path.join(tmpRoot, 't-d'), legacy: path.join(tmpRoot, 'missing') })).toBe(false);
  });
});
