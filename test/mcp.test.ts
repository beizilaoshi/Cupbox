import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/mcp.js';
import { mkTmpDir, seed, cleanupAll } from './helpers.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

let server: McpServer;
let client: Client;
let closed = false;

beforeAll(async () => {
  delete process.env.CUPBOX_DISABLE_TOOLS;
  server = buildServer();
  client = new Client({ name: 'cupbox-test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  if (!closed) {
    await client?.close().catch(() => {});
    await server?.close().catch(() => {});
  }
  await cleanupAll();
});

function textOf(result: unknown): string {
  const r = result as { content?: Array<{ type: string; text?: string }> };
  return (r.content ?? []).map((c) => c.text ?? '').join('\n');
}

describe('MCP 冒烟', () => {
  it('握手成功并暴露 13 个工具', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(13);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'batch_rename',
      'clipboard',
      'codec',
      'convert_csv_json',
      'hash',
      'ocr_image',
      'organize_files',
      'process',
      'run_command',
      'search_files',
      'take_screenshot',
      'time_convert',
      'zip',
    ]);
    // 每个工具都要有中英说明和输入 schema（AI 靠它理解怎么用）
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema).toBeTruthy();
      expect(t.annotations).toBeTruthy();
    }
  });

  it('hash 工具调用', async () => {
    const r = await client.callTool({ name: 'hash', arguments: { text: 'hello', algos: ['sha256'] } });
    expect(r.isError).toBeFalsy();
    expect(textOf(r)).toContain('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('time_convert 自动识别秒/毫秒', async () => {
    const r = await client.callTool({ name: 'time_convert', arguments: { input: '1700000000000' } });
    expect(textOf(r)).toContain('2023-11-14T22:13:20.000Z');
  });

  it('codec 工具调用', async () => {
    const r = await client.callTool({
      name: 'codec',
      arguments: { operation: 'base64_encode', text: '你好' },
    });
    expect(textOf(r).trim()).toBe(Buffer.from('你好', 'utf8').toString('base64'));
  });

  it('handler 内部异常变成 isError 结果而非崩溃', async () => {
    const r = await client.callTool({
      name: 'codec',
      arguments: { operation: 'json_format', text: '{broken' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('JSON 解析失败');
    // 服务器仍然活着
    const ping = await client.callTool({ name: 'time_convert', arguments: { input: '1700000000' } });
    expect(ping.isError).toBeFalsy();
  });

  it('schema 校验：缺必填参数被拒绝', async () => {
    // SDK 把 -32602 参数校验错误包装成 isError 结果回给 AI（不抛异常崩会话）
    const r = await client.callTool({ name: 'time_convert', arguments: {} });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('Input validation error');
  });

  it('batch_rename 默认 dry-run：只预览不落盘', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'a.txt': '', 'b.txt': '' });
    const r = await client.callTool({
      name: 'batch_rename',
      arguments: { dir: d, template: '{n}-{name}' },
    });
    const text = textOf(r);
    expect(text).toContain('预览');
    expect(text).toContain('01-a.txt');
    expect(await readdir(d)).toEqual(['a.txt', 'b.txt']); // 没动

    // 显式 dryRun:false 才执行
    const r2 = await client.callTool({
      name: 'batch_rename',
      arguments: { dir: d, template: '{n}-{name}', dryRun: false },
    });
    expect(textOf(r2)).toContain('已执行');
    expect((await readdir(d)).sort()).toEqual(['01-a.txt', '02-b.txt']);
  });

  it('organize_files 默认 dry-run', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'x.png': '' });
    const r = await client.callTool({ name: 'organize_files', arguments: { dir: d, mode: 'category' } });
    expect(textOf(r)).toContain('预览');
    expect(await readdir(d)).toEqual(['x.png']);
  });

  it('search_files 返回命中与行号', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'f.ts': 'line1\nneedle here' });
    const r = await client.callTool({ name: 'search_files', arguments: { root: d, content: 'needle' } });
    expect(textOf(r)).toContain('f.ts');
    expect(textOf(r)).toContain('L2:');
  });

  it('convert_csv_json 往返', async () => {
    const r = await client.callTool({
      name: 'convert_csv_json',
      arguments: { direction: 'csv_to_json', text: 'a,b\n1,2' },
    });
    expect(JSON.parse(textOf(r))).toEqual([{ a: '1', b: '2' }]);
  });

  it('run_command 受保护执行 + 白名单拒绝', async () => {
    const r = await client.callTool({ name: 'run_command', arguments: { command: 'node -e "console.log(7*6)"' } });
    expect(textOf(r)).toContain('42');
    const denied = await client.callTool({
      name: 'run_command',
      arguments: { command: 'node -e "1"', allowPrefixes: ['npm'] },
    });
    expect(denied.isError).toBe(true);
    expect(textOf(denied)).toContain('允许列表');
  });

  it('process list 可用', async () => {
    const r = await client.callTool({ name: 'process', arguments: { action: 'list', query: 'node' } });
    expect(r.isError).toBeFalsy();
    expect(textOf(r)).toMatch(/\d+\s+node/i);
  });

  it('zip create/list/extract 全链路', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'in/文档.txt': '内容' });
    const zipPath = path.join(d, 'pkg.zip');
    const created = await client.callTool({
      name: 'zip',
      arguments: { action: 'create', sources: [path.join(d, 'in')], zipPath },
    });
    expect(created.isError).toBeFalsy();
    const listed = await client.callTool({ name: 'zip', arguments: { action: 'list', zipPath } });
    expect(textOf(listed)).toContain('文档.txt');
    const dest = path.join(d, 'out');
    const extracted = await client.callTool({
      name: 'zip',
      arguments: { action: 'extract', zipPath, destDir: dest },
    });
    expect(extracted.isError).toBeFalsy();
    const found = await readFile(path.join(dest, 'in', '文档.txt'), 'utf8');
    expect(found).toBe('内容');
  }, 60000);
});
