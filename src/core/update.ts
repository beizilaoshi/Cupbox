// 版本检测与更新公告数据源
// 检查顺序：CUPBOX_UPDATE_URL（自定义清单，便于自建源 / 测试）
//          → GitHub Releases（权威下载源）
//          → npm registry（回退；必须校验包名与仓库归属，防撞名误报）
// 隐私：CUPBOX_UPDATE_DISABLE=1 直接返回，不发起任何网络请求。
import { readFileSync } from 'node:fs';

export type UpdateSource = 'custom' | 'github' | 'npm' | 'disabled' | 'none';

export interface UpdateInfo {
  current: string;
  latest: string;
  /** latest 是否高于 current */
  hasUpdate: boolean;
  source: UpdateSource;
  /** 下载 / 发布页地址（GitHub Releases 优先） */
  url: string;
  /** 更新公告正文（GitHub Release body；其余源可能没有） */
  notes?: string;
  /** 所有源都失败时的最后一个错误（hasUpdate=false 且 source='none'） */
  error?: string;
}

export const DEFAULT_REPO = 'beizilaoshi/cupbox';
export const DEFAULT_PACKAGE = 'cupbox';
export const RELEASES_URL = `https://github.com/${DEFAULT_REPO}/releases/latest`;
const CHANGELOG_URL = `https://github.com/${DEFAULT_REPO}/blob/main/CHANGELOG.md`;

/** 当前版本：dist/core 与 src/core 到项目根都是两级目录。 */
export function currentVersion(): string {
  try {
    const url = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(url, 'utf8')) as { version?: string };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * 语义化版本比较：a > b → 1；相等 → 0；a < b → -1。
 * 支持 `v` 前缀与预发布后缀（1.2.3-rc.1 < 1.2.3）。
 */
export function compareVersions(a: string, b: string): number {
  const norm = (v: string): [number[], string] => {
    const s = String(v ?? '').trim().replace(/^[vV]/, '');
    const [main = '', pre = ''] = s.split('-', 2);
    const nums = main.split('.').map((x) => {
      const n = Number.parseInt(x, 10);
      return Number.isFinite(n) ? n : 0;
    });
    return [nums, pre];
  };
  const [an, ap] = norm(a);
  const [bn, bp] = norm(b);
  const len = Math.max(an.length, bn.length);
  for (let i = 0; i < len; i += 1) {
    const x = an[i] ?? 0;
    const y = bn[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  // 数字部分相等：无预发布 > 有预发布；都有则按字典序
  if (ap === bp) return 0;
  if (ap === '') return 1;
  if (bp === '') return -1;
  return ap > bp ? 1 : -1;
}

export function isVersionNewer(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}

async function fetchJson(url: string, headers: Record<string, string>, timeoutMs: number): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'cupbox-update-check', accept: 'application/json', ...headers },
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** 从 npm repository 字段提取 `owner/repo`（不匹配 GitHub 返回空串）。 */
function repoFromNpmRepository(repo: unknown): string {
  const s = typeof repo === 'string' ? repo : typeof repo === 'object' && repo && 'url' in repo ? String((repo as { url: unknown }).url) : '';
  const m = s.match(/github\.com[/:]([^/\s]+\/[^/\s]+?)(?:\.git)?(?:\s|$)/);
  return m ? m[1] : '';
}

function pickVersion(raw: unknown): string {
  const o = (raw ?? {}) as Record<string, unknown>;
  const v = o.version ?? o.latest ?? o.tag_name ?? '';
  return String(v).trim().replace(/^[vV]/, '');
}

export interface CheckOptions {
  currentVersion?: string;
  repo?: string;
  npmPackage?: string;
  timeoutMs?: number;
  /** 注入 fetch，仅测试用 */
  fetchImpl?: typeof fetch;
}

/**
 * 检查更新：逐源尝试，命中即返；全部失败返回 source:'none' 且不抛错。
 * 任何情况下都不会抛出——更新检查永远不该影响主流程。
 */
export async function checkForUpdate(opts: CheckOptions = {}): Promise<UpdateInfo> {
  const current = opts.currentVersion || currentVersion();
  const repo = opts.repo || DEFAULT_REPO;
  const pkg = opts.npmPackage || DEFAULT_PACKAGE;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const doFetch = opts.fetchImpl ?? fetch;
  const releasesUrl = `https://github.com/${repo}/releases/latest`;
  const base: UpdateInfo = { current, latest: current, hasUpdate: false, source: 'none', url: releasesUrl };

  if (process.env.CUPBOX_UPDATE_DISABLE === '1') {
    return { ...base, source: 'disabled' };
  }

  const finish = (source: UpdateSource, latest: string, url: string, notes?: string): UpdateInfo => {
    const clean = latest.replace(/^[vV]/, '');
    return {
      ...base,
      latest: clean || current,
      hasUpdate: clean ? isVersionNewer(clean, current) : false,
      source,
      url: url || releasesUrl,
      ...(notes ? { notes: notes.slice(0, 4000) } : {}),
    };
  };

  const errors: string[] = [];
  const run = (fn: () => Promise<UpdateInfo>): Promise<UpdateInfo | null> =>
    fn().then(
      (r) => (r.source === 'none' ? null : r),
      (e: unknown) => {
        errors.push(e instanceof Error ? e.message : String(e));
        return null;
      },
    );

  const wrapped = (url: string, headers: Record<string, string>, map: (raw: unknown) => UpdateInfo) =>
    run(async () => {
      const raw = await (opts.fetchImpl ?? doFetch)(url, {
        headers: { 'user-agent': 'cupbox-update-check', accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
      const json = (await raw.json()) as unknown;
      return map(json);
    });

  // 1) 自定义清单（自建源 / 测试）：{version, url?, notes?}
  const customUrl = process.env.CUPBOX_UPDATE_URL;
  if (customUrl) {
    const hit = await wrapped(customUrl, {}, (j) => {
      const o = (j ?? {}) as Record<string, unknown>;
      const latest = pickVersion(o);
      if (!latest) throw new Error('清单缺少 version 字段');
      return finish('custom', latest, String(o.url || releasesUrl), typeof o.notes === 'string' ? o.notes : '');
    });
    if (hit) return hit;
  }

  // 2) GitHub Releases（权威下载源）
  const gh = await wrapped(
    `https://api.github.com/repos/${repo}/releases/latest`,
    { accept: 'application/vnd.github+json' },
    (j) => {
      const o = (j ?? {}) as Record<string, unknown>;
      const latest = pickVersion(o);
      if (!latest) throw new Error('Release 缺少 tag_name');
      return finish(
        'github',
        latest,
        typeof o.html_url === 'string' && o.html_url ? o.html_url : releasesUrl,
        typeof o.body === 'string' ? o.body : '',
      );
    },
  );
  if (gh) return gh;

  // 3) npm registry（回退）：校验包名与仓库归属，防撞名误报
  const npm = await wrapped(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {}, (j) => {
    const o = (j ?? {}) as Record<string, unknown>;
    if (o.name !== pkg) throw new Error(`npm 包名不符（返回 ${String(o.name)}），疑似撞名，跳过`);
    const gotRepo = repoFromNpmRepository(o.repository);
    if (!gotRepo) throw new Error('npm 包未声明 GitHub 仓库（repository 缺失），无法验证归属，跳过');
    if (gotRepo.toLowerCase() !== repo.toLowerCase()) {
      throw new Error(`npm 包仓库不匹配（${gotRepo}），跳过`);
    }
    const latest = pickVersion(o);
    if (!latest) throw new Error('npm 清单缺少 version');
    return finish('npm', latest, `https://www.npmjs.com/package/${pkg}`, '');
  });
  if (npm) return npm;

  return { ...base, url: releasesUrl + '（或 ' + CHANGELOG_URL + '）', error: errors.join('; ') || '无可用数据源' };
}
