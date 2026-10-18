// 版本检测：语义化比较 + 三数据源（自定义清单 / GitHub / npm）+ 关闭开关
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkForUpdate,
  compareVersions,
  isVersionNewer,
  currentVersion,
  RELEASES_URL,
} from '../src/core/update.js';

const ENV_KEYS = ['CUPBOX_UPDATE_URL', 'CUPBOX_UPDATE_DISABLE'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/** 构造 fetch 替身：routes 里有前缀则返回 JSON；'reject' 则断网。 */
function stubFetch(routes: Record<string, unknown | 'reject'>): typeof fetch {
  return (async (input: unknown) => {
    const url = String(typeof input === 'string' ? input : (input as { url?: string }).url ?? '');
    for (const [prefix, payload] of Object.entries(routes)) {
      if (url.startsWith(prefix)) {
        if (payload === 'reject') throw new Error('network disabled in tests');
        return { ok: true, status: 200, json: async () => payload } as Response;
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe('compareVersions / isVersionNewer', () => {
  it('数字位按大小比较（1.10.0 大于 1.2.0）', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('1.10.0', '1.2.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
  it('容忍 v 前缀', () => {
    expect(compareVersions('v1.5.0', '1.5.0')).toBe(0);
    expect(isVersionNewer('V2.0.0', '1.9.9')).toBe(true);
  });
  it('预发布低于正式版；补位按 0 处理', () => {
    expect(compareVersions('1.2.3-rc.1', '1.2.3')).toBe(-1);
    expect(isVersionNewer('1.2.3', '1.2.3-rc.1')).toBe(true);
    expect(isVersionNewer('1.0.1', '1.0')).toBe(true);
  });
});

describe('checkForUpdate', () => {
  it('读取当前版本（来自 package.json）', () => {
    expect(currentVersion()).toMatch(/^\d+\.\d+\.\d+/);
    expect(RELEASES_URL).toContain('github.com/beizilaoshi/cupbox/releases/latest');
  });

  it('自定义清单：发现新版本 + 更新公告 + 下载源', async () => {
    process.env.CUPBOX_UPDATE_URL =
      'data:application/json,' +
      encodeURIComponent(JSON.stringify({ version: '9.9.9', url: 'https://example.com/dl', notes: '新版本亮点：测试公告' }));
    const info = await checkForUpdate({ currentVersion: '1.0.0' });
    expect(info.source).toBe('custom');
    expect(info.hasUpdate).toBe(true);
    expect(info.latest).toBe('9.9.9');
    expect(info.url).toBe('https://example.com/dl');
    expect(info.notes).toContain('测试公告');
  });

  it('自定义清单版本更低 → 不提示更新', async () => {
    process.env.CUPBOX_UPDATE_URL = 'data:application/json,' + encodeURIComponent(JSON.stringify({ version: '0.1.0' }));
    const info = await checkForUpdate({ currentVersion: '1.0.0' });
    expect(info.source).toBe('custom');
    expect(info.hasUpdate).toBe(false);
  });

  it('CUPBOX_UPDATE_DISABLE=1 → 直接返回 disabled，不发起任何请求', async () => {
    process.env.CUPBOX_UPDATE_DISABLE = '1';
    process.env.CUPBOX_UPDATE_URL = 'data:application/json,{"version":"9.9.9"}';
    const info = await checkForUpdate({
      currentVersion: '1.0.0',
      fetchImpl: (async () => {
        throw new Error('不该被调用');
      }) as unknown as typeof fetch,
    });
    expect(info.source).toBe('disabled');
    expect(info.hasUpdate).toBe(false);
  });

  it('GitHub Releases：tag_name 带 v 前缀也能解析', async () => {
    const info = await checkForUpdate({
      currentVersion: '1.0.0',
      fetchImpl: stubFetch({
        'https://api.github.com/repos/': { tag_name: 'v2.1.0', html_url: 'https://github.com/beizilaoshi/cupbox/releases/tag/v2.1.0', body: '发布公告正文' },
      }),
    });
    expect(info.source).toBe('github');
    expect(info.hasUpdate).toBe(true);
    expect(info.latest).toBe('2.1.0');
    expect(info.url).toContain('releases/tag/v2.1.0');
    expect(info.notes).toBe('发布公告正文');
  });

  it('GitHub 不可用 → 回退 npm（校验包名与仓库归属）', async () => {
    const info = await checkForUpdate({
      currentVersion: '1.0.0',
      fetchImpl: stubFetch({
        'https://api.github.com/': 'reject',
        'https://registry.npmjs.org/': { name: 'cupbox', version: '3.0.0', repository: { url: 'git+https://github.com/beizilaoshi/cupbox.git' } },
      }),
    });
    expect(info.source).toBe('npm');
    expect(info.hasUpdate).toBe(true);
    expect(info.latest).toBe('3.0.0');
  });

  it('npm 撞名（仓库不匹配）→ 拒绝误报，回到 none', async () => {
    const info = await checkForUpdate({
      currentVersion: '1.0.0',
      fetchImpl: stubFetch({
        'https://api.github.com/': 'reject',
        'https://registry.npmjs.org/': { name: 'cupbox', version: '99.0.0', repository: { url: 'https://github.com/someone-else/other.git' } },
      }),
    });
    expect(info.source).toBe('none');
    expect(info.hasUpdate).toBe(false);
    expect(info.error).toContain('不匹配');
  });

  it('npm 包未声明 repository → 无法验证归属，同样拒绝（防撞名放行）', async () => {
    const info = await checkForUpdate({
      currentVersion: '1.0.0',
      fetchImpl: stubFetch({
        'https://api.github.com/': 'reject',
        'https://registry.npmjs.org/': { name: 'cupbox', version: '99.0.0' },
      }),
    });
    expect(info.source).toBe('none');
    expect(info.hasUpdate).toBe(false);
    expect(info.error).toContain('未声明 GitHub 仓库');
  });

  it('所有数据源失败 → 不抛错，返回 none + 错误信息', async () => {
    const info = await checkForUpdate({
      currentVersion: '1.0.0',
      fetchImpl: stubFetch({
        'https://api.github.com/': 'reject',
        'https://registry.npmjs.org/': 'reject',
      }),
    });
    expect(info.source).toBe('none');
    expect(info.hasUpdate).toBe(false);
    expect(info.error).toContain('network disabled in tests');
    expect(info.url).toContain('github.com');
  });
});
