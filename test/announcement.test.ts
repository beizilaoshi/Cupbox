import { describe, it, expect, afterEach } from 'vitest';
import {
  parseAnnouncement,
  fetchAnnouncement,
  shouldShowAnnouncement,
  DEFAULT_ANNOUNCEMENT_URL,
} from '../desktop/announcement.js';

/** 开屏公告：解析、版本判定与静音策略（desktop/announcement.js）。 */

const sample = (patch: Record<string, unknown> = {}) => JSON.stringify({
  id: '2026-10-21-welcome',
  title: '欢迎使用 Cupbox 工具箱',
  body: '欢迎使用 Cupbox 工具箱！\n\n· 左侧工具栏',
  publishedAt: '2026-10-21',
  url: 'https://github.com/beizilaoshi/cupbox',
  ...patch,
});

afterEach(() => {
  delete process.env.CUPBOX_ANNOUNCEMENT_DISABLE;
});

describe('parseAnnouncement', () => {
  it('保留标题、正文、日期与 https 链接，版本带 id 前缀', () => {
    const a = parseAnnouncement(sample());
    expect(a.title).toBe('欢迎使用 Cupbox 工具箱');
    expect(a.body).toContain('左侧工具栏');
    expect(a.publishedAt).toBe('2026-10-21');
    expect(a.url).toBe('https://github.com/beizilaoshi/cupbox');
    expect(a.version).toMatch(/^2026-10-21-welcome:[0-9a-f]{12}$/);
  });

  it('拒绝非 https 链接，缺 id 时用正文哈希兜底', () => {
    const a = parseAnnouncement(sample({ url: 'javascript:alert(1)', id: '' }));
    expect(a.url).toBe('');
    expect(a.id).toMatch(/^[0-9a-f]{12}$/);
  });

  it('正文按纯文本保存，不解析 HTML', () => {
    const a = parseAnnouncement(sample({ body: '<img src=x onerror=alert(1)>' }));
    expect(a.body).toBe('<img src=x onerror=alert(1)>');
  });

  it('缺 title / body 或 JSON 非法时抛错', () => {
    expect(() => parseAnnouncement(sample({ title: '' }))).toThrow(/title/);
    expect(() => parseAnnouncement(sample({ body: '  ' }))).toThrow(/title 或 body/);
    expect(() => parseAnnouncement('{not json')).toThrow(/JSON/);
    expect(() => parseAnnouncement('[]')).toThrow(/根节点/);
  });

  it('内容变化会改变版本，内容不变版本稳定', () => {
    const a = parseAnnouncement(sample());
    const b = parseAnnouncement(sample());
    const c = parseAnnouncement(sample({ body: '新的公告正文' }));
    expect(b.version).toBe(a.version);
    expect(c.version).not.toBe(a.version);
  });
});

describe('shouldShowAnnouncement', () => {
  const a = parseAnnouncement(sample());

  it('首次启动（无已读记录）显示', () => {
    expect(shouldShowAnnouncement(a, {})).toBe(true);
  });

  it('同版本未勾选「不再提示」时继续显示', () => {
    expect(shouldShowAnnouncement(a, { announcementSeenVersion: a.version, announcementMuted: false })).toBe(true);
  });

  it('同版本勾选后不再显示', () => {
    expect(shouldShowAnnouncement(a, { announcementSeenVersion: a.version, announcementMuted: true })).toBe(false);
  });

  it('内容更新后即使勾选也显示', () => {
    expect(shouldShowAnnouncement(a, { announcementSeenVersion: 'old:000000000000', announcementMuted: true })).toBe(true);
  });
});

describe('fetchAnnouncement', () => {
  it('成功时返回公告与来源，并带时间戳绕过 CDN 缓存', async () => {
    let seen = '';
    const result = await fetchAnnouncement({
      url: 'https://raw.example.com/announcement.json',
      fetchImpl: async (url: string) => { seen = url; return new Response(sample(), { status: 200 }); },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.announcement.title).toBe('欢迎使用 Cupbox 工具箱');
    expect(result.source).toBe('raw.example.com');
    expect(seen).toMatch(/^https:\/\/raw\.example\.com\/announcement\.json\?_=\d+$/);
  });

  it('HTTP 错误、网络异常与超时都返回 ok:false，不抛出', async () => {
    const bad = await fetchAnnouncement({ url: 'https://x.test/a.json', fetchImpl: async () => new Response('nope', { status: 404 }) });
    expect(bad.ok).toBe(false);
    const boom = await fetchAnnouncement({ url: 'https://x.test/a.json', fetchImpl: async () => { throw new Error('offline'); } });
    expect(boom.ok).toBe(false);
    const timeout = await fetchAnnouncement({
      url: 'https://x.test/a.json',
      timeoutMs: 500,
      fetchImpl: async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; },
    });
    expect(timeout).toMatchObject({ ok: false, error: '公告请求超时' });
  });

  it('非法地址直接失败', async () => {
    const r = await fetchAnnouncement({ url: 'file:///etc/passwd', fetchImpl: async () => new Response('') });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('公告地址无效');
  });

  it('CUPBOX_ANNOUNCEMENT_DISABLE=1 时短路', async () => {
    process.env.CUPBOX_ANNOUNCEMENT_DISABLE = '1';
    const r = await fetchAnnouncement({ fetchImpl: async () => new Response(sample()) });
    expect(r).toMatchObject({ ok: false, disabled: true });
    expect(DEFAULT_ANNOUNCEMENT_URL).toContain('beizilaoshi/cupbox');
  });
});
