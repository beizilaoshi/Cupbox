import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { mkTmpDir, seed, cleanupAll } from './helpers.js';
import {
  loadAiConfig, saveAiConfig, maskKey, aiChat, aiAgent, configPath, DEFAULT_SYSTEM,
} from '../src/core/ai.js';
import { TOOL_DEFS, runTool } from '../src/core/toolkit.js';

/** 临时配置目录 + 环境变量快照（保证「未配置」路径确定性，不读本机真实 ~/.cupbox）。 */
let tmpHome: string;
const envSnapshot: Record<string, string | undefined> = {};
const ENV_KEYS = ['CUPBOX_HOME', 'CUPBOX_AI_PROVIDER', 'CUPBOX_AI_BASE_URL', 'CUPBOX_AI_API_KEY', 'CUPBOX_AI_MODEL'];

beforeAll(async () => {
  tmpHome = await mkTmpDir();
  for (const k of ENV_KEYS) {
    envSnapshot[k] = process.env[k];
    delete process.env[k];
  }
  process.env.CUPBOX_HOME = tmpHome;
});

afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (envSnapshot[k] === undefined) delete process.env[k];
    else process.env[k] = envSnapshot[k]!;
  }
  await cleanupAll();
});

describe('ai 配置存取', () => {
  it('空配置默认值 + maskKey', async () => {
    const cfg = await loadAiConfig();
    expect(cfg.provider).toBe('openai-compatible');
    expect(cfg.apiKey).toBe('');
    expect(maskKey('')).toBe('(未配置)');
    expect(maskKey('sk-abcdef123456')).toContain('3456');
    expect(maskKey('sk-abcdef123456')).not.toContain('abcdef');
  });

  it('save → load 往返，文件落在 CUPBOX_HOME/.cupbox/config.json', async () => {
    await saveAiConfig({
      provider: 'anthropic',
      baseUrl: 'https://example.test/v1',
      model: 'demo-model',
      apiKey: 'sk-test-1234567890',
      temperature: 0.7,
      maxTurns: 5,
    });
    const cfg = await loadAiConfig();
    expect(cfg.provider).toBe('anthropic');
    expect(cfg.baseUrl).toBe('https://example.test/v1');
    expect(cfg.model).toBe('demo-model');
    expect(cfg.apiKey).toBe('sk-test-1234567890');
    expect(cfg.temperature).toBe(0.7);
    expect(cfg.maxTurns).toBe(5);
    const onDisk = JSON.parse(await readFile(configPath(), 'utf8'));
    expect(onDisk.apiKey).toBe('sk-test-1234567890');
  });

  it('temperature/maxTurns 传 null 会清除（回到提供方默认）', async () => {
    await saveAiConfig({ temperature: null, maxTurns: null });
    const cfg = await loadAiConfig();
    expect(cfg.temperature).toBeUndefined();
    expect(cfg.maxTurns).toBeUndefined();
    // 其余字段不受影响
    expect(cfg.model).toBe('demo-model');
  });

  it('未配置 Key 时 aiChat / aiAgent 给配置指引而不是发请求', async () => {
    await saveAiConfig({ apiKey: '' }); // 上个用例存过 key，先清空
    await expect(
      aiChat({ messages: [{ role: 'user', text: 'hi' }] }),
    ).rejects.toThrow('未配置 AI API Key');
    await expect(aiAgent({ prompt: 'hello' })).rejects.toThrow('未配置 AI API Key');
  });

  it('DEFAULT_SYSTEM 是中文系统提示', () => {
    expect(DEFAULT_SYSTEM).toContain('工具');
  });
});

describe('toolkit 统一编排层', () => {
  it('TOOL_DEFS 14 项：名字唯一、说明与 schema 齐全', () => {
    expect(TOOL_DEFS).toHaveLength(14);
    const names = new Set(TOOL_DEFS.map((t) => t.name));
    expect(names.size).toBe(14);
    for (const t of TOOL_DEFS) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.parameters).toBeTruthy();
    }
  });

  it('runTool hash：与 CLI/MCP 同引擎语义', async () => {
    const r = (await runTool('hash', { text: 'hello', algo: 'sha256' })) as Record<string, string>;
    expect(r.sha256).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('runTool rename 默认 dry-run：只预览不落盘', async () => {
    const d = await mkTmpDir();
    await seed(d, { 'a.txt': '', 'b.txt': '' });
    const r = (await runTool('rename', { dir: d, template: '{n}-{name}' })) as {
      changes: Array<{ from: string; to: string; applied: boolean }>;
    };
    expect(r.changes.length).toBeGreaterThan(0);
    expect(r.changes.every((c) => !c.applied)).toBe(true);
    expect(existsSync(`${d}/a.txt`)).toBe(true);
    expect(existsSync(`${d}/b.txt`)).toBe(true);
  });

  it('runTool run 无白名单默认拒绝', async () => {
    await expect(runTool('run', { command: 'echo pwn' })).rejects.toThrow('出于安全默认拒绝');
  });

  it('runTool 未知工具报错', async () => {
    await expect(runTool('nope', {})).rejects.toThrow('未知工具');
  });
});
