import { describe, it, expect } from 'vitest';
import {
  baseModelId,
  isResponsesModel,
  isMessagesModel,
  endpointFor,
  applyFingerprint,
  restoreToolName,
  displayModelName,
  parseListing,
  buildCatalog,
  isKiloFreeRow,
  classifyStatus,
  FINGERPRINT_TOOLS,
} from '../src/core/freemodel.js';

describe('freemodel 工具函数', () => {
  it('baseModelId 剥掉尾部 (level) 后缀', () => {
    expect(baseModelId('deepseek-v4-flash-free (high)')).toBe('deepseek-v4-flash-free');
    expect(baseModelId('plain-model')).toBe('plain-model');
  });

  it('isResponsesModel / isMessagesModel 按模型 ID 判定', () => {
    expect(isResponsesModel('muse-spark-1.3-contributor-free')).toBe(true);
    expect(isMessagesModel('union-alpha')).toBe(true);
    expect(isResponsesModel('deepseek-v4-flash-free')).toBe(false);
  });

  it('endpointFor 返回完整路径', () => {
    expect(endpointFor('muse-spark-1.3-contributor-free')).toBe('/zen/v1/responses');
    expect(endpointFor('union-alpha')).toBe('/zen/v1/messages');
    expect(endpointFor('deepseek-v4-flash-free')).toBe('/zen/v1/chat/completions');
  });

  it('displayModelName 美化已知名', () => {
    expect(displayModelName('deepseek-v4-flash-free')).toBe('DeepSeek V4 Flash');
    expect(displayModelName('mimo-v2.6-flash-free')).toBe('MiMo V2.6 Flash');
  });

  it('parseListing 解析 {"data":[{"id":...}]} 结构', () => {
    const payload = { data: [{ id: 'model-a' }, { id: 'model-b' }] };
    expect(parseListing(payload)).toEqual(['model-a', 'model-b']);
  });

  it('buildCatalog 只收 isFreeLane 命中的 id', () => {
    const entries = buildCatalog(['deepseek-v4-flash-free', 'unknown-model', 'mimo-v2.6-flash-free']);
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('deepseek-v4-flash-free');
    expect(entries[0].name).toBe('DeepSeek V4 Flash');
    expect(entries[1].id).toBe('mimo-v2.6-flash-free');
  });

  it('isKiloFreeRow 只看 isFree=true + id 非空', () => {
    expect(isKiloFreeRow({ id: 'minimax/minimax-m3.1-flash:free', isFree: true })).toBe(true);
    expect(isKiloFreeRow({ id: 'openai/gpt-4o', isFree: true })).toBe(true); // 不检查后缀
    expect(isKiloFreeRow({ id: 'x', isFree: false })).toBe(false);
    expect(isKiloFreeRow({ isFree: true })).toBe(false);
    expect(isKiloFreeRow(null)).toBe(false);
  });

  it('classifyStatus 翻译状态码', () => {
    expect(classifyStatus(401, '')).toContain('凭据');
    expect(classifyStatus(403, '')).toContain('拒绝');
    expect(classifyStatus(429, '')).toContain('限流');
    expect(classifyStatus(500, '')).toContain('不可用');
    expect(classifyStatus(400, '')).toContain('失败');
  });
});

describe('applyFingerprint 工具指纹门禁', () => {
  it('补齐缺失的 quartet 工具（chat 形）', () => {
    const body = { model: 'x', messages: [], tools: [{ type: 'function', function: { name: 'weather', parameters: {} } }] };
    applyFingerprint(body, 'chat');
    const names = body.tools!.map((t: any) => t.function.name);
    for (const q of FINGERPRINT_TOOLS) expect(names).toContain(q);
  });

  it('保留客户端已有工具，不重复', () => {
    const body = { model: 'x', messages: [], tools: [{ type: 'function', function: { name: 'bash', parameters: {} } }] };
    applyFingerprint(body, 'chat');
    const bashCount = body.tools!.filter((t: any) => t.function.name === 'bash').length;
    expect(bashCount).toBe(1);
  });

  it('restoreToolName 还原被改名的工具', () => {
    const map = new Map([['bash', 'pwsh']]);
    expect(restoreToolName('bash', map)).toBe('pwsh');
    expect(restoreToolName('unknown', map)).toBe('unknown');
  });
});
