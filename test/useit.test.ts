import { describe, it, expect, vi, afterEach } from 'vitest';
import { useitEngineBase, useitTool, sanitizeUseitData } from '../desktop/workbench/useit.js';
import { DEFINITIONS } from '../desktop/workbench/definitions.js';
import { USEIT_NAMES } from '../desktop/workbench/useit-definitions.js';

const ok = (body: any) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; vi.restoreAllMocks(); });

describe('Use-It 引擎地址与结果清洗', () => {
  it('工具箱与 Agent 定义都包含全部 Use-It 工具', () => {
    for (const name of USEIT_NAMES) {
      const def: any = DEFINITIONS.find(d => d.name === name);
      expect(def, name).toBeTruthy();
      expect(def.parameters.type).toBe('object');
      expect(def.parameters.additionalProperties).toBe(false);
      for (const key of def.parameters.required || []) expect(def.parameters.properties[key], `${name}.${key}`).toBeTruthy();
    }
  });
  it('只允许本机回环地址', () => {
    expect(useitEngineBase({ engineUrl: 'http://127.0.0.1:8324' })).toBe('http://127.0.0.1:8324');
    expect(() => useitEngineBase({ engineUrl: 'http://192.168.1.20:8324' })).toThrow(/本机回环/);
    expect(() => useitEngineBase({ engineUrl: 'not a url' })).toThrow(/无效/);
  });
  it('省略截图 base64 与超长字符串', () => {
    const data = sanitizeUseitData({ screenshot: 'data:image/png;base64,' + 'A'.repeat(5000), note: 'ok', list: [1, 2] });
    expect((data.screenshot as any).omitted).toBe(true);
    expect(data.note).toBe('ok');
    expect(data.list).toEqual([1, 2]);
  });
});

describe('Use-It 引擎调用', () => {
  it('status 汇总 health 与各应用状态', async () => {
    globalThis.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.endsWith('/api/v1/health')) return ok({ status: 'ok', version: '1.0' });
      if (u.endsWith('/ppt/status')) return ok({ connected: true });
      return ok({ connected: false });
    }) as any;
    const r: any = await useitTool(null as any, 'useit_status', {});
    expect(r.reachable).toBe(true);
    expect(r.apps.engine.ok).toBe(true);
    expect(r.apps.ppt.data.connected).toBe(true);
    expect(r.setup).toBeUndefined();
  });

  it('离线时返回安装提示而不是抛错', async () => {
    globalThis.fetch = vi.fn(async () => { const e: any = new TypeError('fetch failed'); e.cause = { code: 'ECONNREFUSED' }; throw e; }) as any;
    const r: any = await useitTool(null as any, 'useit_status', {});
    expect(r.reachable).toBe(false);
    expect(r.setup).toMatch(/pip install/);
  });

  it('catalog 读取引擎能力清单', async () => {
    let url = '';
    globalThis.fetch = vi.fn(async (u: any) => { url = String(u); return ok({ ppt: ['add_slide'], excel: ['code'] }); }) as any;
    const r: any = await useitTool(null as any, 'useit_catalog', {});
    expect(url).toBe('http://127.0.0.1:8324/api/v1/capabilities');
    expect(r.catalog.ppt).toEqual(['add_slide']);
  });

  it('open 透传到 /open 并带 file_path/read_only', async () => {
    let captured: any;
    globalThis.fetch = vi.fn(async (url: any, init: any) => { captured = { url: String(url), body: JSON.parse(init.body) }; return ok({ opened: true }); }) as any;
    const r: any = await useitTool(null as any, 'useit_ppt', { action: 'open', filePath: 'C:/deck.pptx', readOnly: true });
    expect(captured.url).toBe('http://127.0.0.1:8324/api/v1/ppt/open');
    expect(captured.body).toEqual({ file_path: 'C:/deck.pptx', read_only: true });
    expect(r.app).toBe('ppt');
  });

  it('PowerPoint actions 接受 JSON 字符串并拒绝非数组', async () => {
    let captured: any;
    globalThis.fetch = vi.fn(async (url: any, init: any) => { captured = { url: String(url), body: JSON.parse(init.body) }; return ok({ executed: 1 }); }) as any;
    await useitTool(null as any, 'useit_ppt', { action: 'actions', actions: '[{"action":"add_slide"}]' });
    expect(captured.url).toBe('http://127.0.0.1:8324/api/v1/ppt/step');
    expect(captured.body.actions).toEqual([{ action: 'add_slide' }]);
    await expect(useitTool(null as any, 'useit_ppt', { action: 'actions', actions: '{"a":1}' })).rejects.toThrow(/必须是数组/);
  });

  it('Word 拒绝结构化动作，脚本走 /step', async () => {
    globalThis.fetch = vi.fn(async (url: any, init: any) => ok({ url: String(url), body: JSON.parse(init.body) })) as any;
    await expect(useitTool(null as any, 'useit_word', { action: 'actions', actions: '[]' })).rejects.toThrow(/只有 PowerPoint/);
    const r: any = await useitTool(null as any, 'useit_word', { action: 'code', code: 'Get-Date' });
    expect(r.data.url).toBe('http://127.0.0.1:8324/api/v1/word/step');
    expect(r.data.body.language).toBe('PowerShell');
  });

  it('AutoCAD 使用 v2 路由与 action/data', async () => {
    let captured: any;
    globalThis.fetch = vi.fn(async (url: any, init: any) => { captured = { url: String(url), body: JSON.parse(init.body) }; return ok({ ok: true }); }) as any;
    await useitTool(null as any, 'useit_autocad', { action: 'step', stepAction: 'draw_from_json', data: { entities: [] } });
    expect(captured.url).toBe('http://127.0.0.1:8324/api/v1/autocad/v2/step');
    expect(captured.body.action).toBe('draw_from_json');
    expect(captured.body.data).toEqual({ entities: [] });
  });

  it('桌面截图走 /computer/screenshot', async () => {
    let captured: any;
    globalThis.fetch = vi.fn(async (url: any, init: any) => { captured = { url: String(url), body: JSON.parse(init.body) }; return ok({ image_base64: 'data:image/png;base64,' + 'A'.repeat(2000) }); }) as any;
    const r: any = await useitTool(null as any, 'useit_computer', { action: 'screenshot', resize: false });
    expect(captured.url).toBe('http://127.0.0.1:8324/api/v1/computer/screenshot');
    expect(captured.body).toEqual({ resize: false });
    expect(r.data.image_base64.omitted).toBe(true);
  });
});
