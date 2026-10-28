// Cupbox 开屏公告 —— 从 GitHub 仓库拉取 announcement.json。
// 设计：任何异常都不抛给调用方；正文一律按纯文本返回，渲染端用 textContent 呈现。
import { createHash } from 'node:crypto';

export const DEFAULT_ANNOUNCEMENT_URL =
  'https://raw.githubusercontent.com/beizilaoshi/cupbox/main/announcement.json';

const LIMITS = { id: 120, title: 200, body: 8000, publishedAt: 40, url: 400 };
const TIMEOUT_MS = 4000;

function plain(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/**
 * 把 announcement.json 的文本解析成公告对象。
 * version 由 id + 正文内容共同决定：改标题/正文/日期都会触发「有新公告」。
 * 缺 id 时用正文哈希兜底，因此 id 并非必填。
 */
export function parseAnnouncement(raw) {
  let data;
  try {
    data = JSON.parse(String(raw ?? '').replace(/^\uFEFF/, ''));
  } catch (e) {
    throw new Error(`公告文件不是合法 JSON：${e instanceof Error ? e.message : String(e)}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('公告文件根节点必须是对象');
  const title = plain(data.title, LIMITS.title);
  const body = plain(data.body, LIMITS.body);
  if (!title || !body) throw new Error('公告缺少 title 或 body');
  const id = plain(data.id, LIMITS.id) || hash(`${title}\n${body}`);
  const publishedAt = plain(data.publishedAt, LIMITS.publishedAt);
  const rawUrl = plain(data.url, LIMITS.url);
  const url = /^https:\/\//i.test(rawUrl) ? rawUrl : '';
  return {
    id,
    version: `${id}:${hash(`${title}\n${body}\n${publishedAt}`)}`,
    title,
    body,
    publishedAt,
    url,
  };
}

/**
 * 拉取并解析公告。返回 { ok:true, announcement, source } 或 { ok:false, error }。
 * - CUPBOX_ANNOUNCEMENT_URL：自定义公告地址（测试用本地 http 服务）。
 * - CUPBOX_ANNOUNCEMENT_DISABLE=1：完全关闭检查。
 */
export async function fetchAnnouncement({
  url = process.env.CUPBOX_ANNOUNCEMENT_URL || DEFAULT_ANNOUNCEMENT_URL,
  timeoutMs = TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (process.env.CUPBOX_ANNOUNCEMENT_DISABLE === '1') {
    return { ok: false, disabled: true, error: '公告检查已关闭（CUPBOX_ANNOUNCEMENT_DISABLE=1）' };
  }
  if (typeof fetchImpl !== 'function') return { ok: false, error: '当前环境不支持网络请求' };

  let target;
  try {
    target = new URL(String(url));
    if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error('仅支持 http(s) 地址');
  } catch (e) {
    return { ok: false, error: `公告地址无效：${e instanceof Error ? e.message : String(e)}` };
  }
  // GitHub raw 的 CDN 有缓存：加时间戳参数绕过，确保每次启动拿到最新文件。
  target.searchParams.set('_', String(Date.now()));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, Number(timeoutMs) || TIMEOUT_MS));
  try {
    const res = await fetchImpl(target.toString(), {
      signal: controller.signal,
      headers: { accept: 'application/json', 'cache-control': 'no-cache', pragma: 'no-cache' },
    });
    if (!res.ok) return { ok: false, error: `公告地址返回 HTTP ${res.status}` };
    const text = await res.text();
    return { ok: true, announcement: parseAnnouncement(text), source: target.hostname };
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || e.code === 'ABORT_ERR');
    return { ok: false, error: aborted ? '公告请求超时' : e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 启动时的显示决策（纯函数，便于单测）：
 * - 版本变了 → 一定显示（即使之前勾过「不再提示」）；
 * - 版本没变 → 勾过「不再提示」就不显示，否则显示。
 */
export function shouldShowAnnouncement(announcement, prefs = {}) {
  if (!announcement || !announcement.version) return false;
  const seen = String(prefs.announcementSeenVersion ?? '');
  const muted = prefs.announcementMuted === true;
  if (seen !== announcement.version) return true;
  return !muted;
}
