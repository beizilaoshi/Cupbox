// Use-It Agent 本地引擎客户端。引擎是独立的 Python 进程（默认 127.0.0.1:8324），
// 通过 COM 实时操作已打开的 PowerPoint / Word / Excel / AutoCAD，以及桌面 GUI。
import { fail } from './files.js';

const DEFAULT_ENGINE = 'http://127.0.0.1:8324';
const APPS = { ppt: '/api/v1/ppt', word: '/api/v1/word', excel: '/api/v1/excel', autocad: '/api/v1/autocad/v2' };
const SETUP = [
  'Use-It 本地引擎未运行。它需要 Windows + Python 3.11+，并通过 COM 操作已安装的 Office / AutoCAD。',
  '安装（PowerShell，路径换成你解压后的源码目录）：',
  '  py -3.13 -m pip install -e "D:\\下载\\useit-src\\use-it-agent-main[local-engine]"',
  '启动：',
  '  py -3.13 "D:\\下载\\useit-src\\use-it-agent-main\\src\\local_engine\\main.py"',
  '默认地址 http://127.0.0.1:8324；改端口时设置 LOCAL_ENGINE_PORT，并在工具参数 engineUrl 填写同一地址。',
].join('\n');

export function useitEngineBase(a = {}) {
  const raw = String(a.engineUrl || process.env.CUPBOX_USEIT_ENGINE_URL || DEFAULT_ENGINE).trim();
  let url;
  try { url = new URL(raw); } catch { fail('E_USEIT_URL', 'Use-It 引擎地址无效：' + raw); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') fail('E_USEIT_URL', 'Use-It 引擎地址必须是 http(s)：' + raw);
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname.toLowerCase()))
    fail('E_USEIT_URL', 'Use-It 引擎只允许本机回环地址（当前：' + url.hostname + '）。');
  return url.origin + url.pathname.replace(/\/+$/, '');
}

async function request(base, path, { method = 'GET', body, timeoutMs = 60000, signal } = {}) {
  const controller = new AbortController();
  const ms = Math.max(500, Number(timeoutMs) || 60000);
  const timer = setTimeout(() => controller.abort(), ms);
  const abort = () => controller.abort();
  if (signal) signal.addEventListener('abort', abort, { once: true });
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const cause = e?.cause?.code || e?.code || '';
    if (controller.signal.aborted && !signal?.aborted) fail('E_USEIT_TIMEOUT', `Use-It 引擎在 ${ms}ms 内没有响应（${path}）。`);
    if (cause === 'ECONNREFUSED' || cause === 'ECONNRESET' || /fetch failed/i.test(String(e?.message)))
      fail('E_USEIT_OFFLINE', `无法连接 Use-It 引擎 ${base}。\n\n${SETUP}`);
    fail('E_USEIT_NETWORK', `Use-It 引擎请求失败（${path}）：${e?.message || e}`);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
  const text = await res.text();
  let data = {};
  if (text) { try { data = JSON.parse(text); } catch { data = { text: text.slice(0, 4000) }; } }
  if (!res.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : JSON.stringify(data).slice(0, 1500);
    fail('E_USEIT_HTTP', `Use-It 引擎返回 HTTP ${res.status}（${path}）：${detail}`);
  }
  return data;
}

const IMAGE_KEY = /^(screenshot|screenshot_base64|image|image_base64|imageBase64|dataUrl|data_url|png|jpeg)$/i;

// 去掉截图 base64 等大字段，避免把几 MB 的字符串塞进模型上下文。
export function sanitizeUseitData(value, depth = 0) {
  if (depth > 10) return '[层级过深已截断]';
  if (typeof value === 'string') {
    if (/^data:image\//i.test(value)) return { omitted: true, kind: 'image', chars: value.length };
    if (value.length > 200000) return { omitted: true, chars: value.length, head: value.slice(0, 4000) };
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 200).map(v => sanitizeUseitData(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (IMAGE_KEY.test(k) && typeof v === 'string' && v.length > 1000) {
        out[k] = { omitted: true, chars: v.length, note: '截图/图像数据已省略' };
        continue;
      }
      out[k] = sanitizeUseitData(v, depth + 1);
    }
    return out;
  }
  return value;
}

function parseActions(input) {
  let list = input;
  if (typeof input === 'string') {
    if (!input.trim()) fail('E_ARGS', 'action=actions 需要 actions 参数（JSON 字符串或对象数组）。');
    try { list = JSON.parse(input); } catch { fail('E_ARGS', 'actions 不是合法 JSON：' + input.slice(0, 200)); }
  }
  if (list === undefined) fail('E_ARGS', 'action=actions 需要 actions 参数（JSON 字符串或对象数组）。');
  if (!Array.isArray(list)) fail('E_ARGS', 'actions 必须是数组。');
  if (list.length > 100) fail('E_ARGS', 'actions 一次最多 100 个。');
  if (!list.every(x => x && typeof x === 'object' && !Array.isArray(x))) fail('E_ARGS', 'actions 的每一项必须是对象。');
  return list;
}

function parseData(input) {
  if (input === undefined) fail('E_ARGS', 'action=step 且 stepAction=draw_from_json 时需要 data。');
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { fail('E_ARGS', 'data 不是合法 JSON。'); }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('E_ARGS', 'data 必须是对象。');
  return input;
}

function timeoutOf(a) { return Math.max(500, Number(a.timeoutMs) || 60000); }

async function appCall(base, app, a, signal) {
  const route = APPS[app];
  const t = timeoutOf(a);
  switch (a.action) {
    case 'status':
      return request(base, route + '/status', { timeoutMs: t, signal });
    case 'open': {
      if (!a.filePath) fail('E_ARGS', 'action=open 需要 filePath。');
      return request(base, route + '/open', { method: 'POST', timeoutMs: t, body: { file_path: String(a.filePath), read_only: a.readOnly === true }, signal });
    }
    case 'close':
      return request(base, route + '/close', { method: 'POST', timeoutMs: t, body: { save: a.save === true }, signal });
    case 'snapshot': {
      const body = { include_content: a.includeContent !== false, include_screenshot: a.includeScreenshot === true };
      if (app === 'ppt') {
        if (a.maxSlides) body.max_slides = Number(a.maxSlides);
        if (a.currentSlideOnly !== undefined) body.current_slide_only = a.currentSlideOnly === true;
      }
      if (app === 'autocad') {
        if (a.onlyVisible !== undefined) body.only_visible = a.onlyVisible === true;
        if (a.maxEntities) body.max_entities = Number(a.maxEntities);
      }
      return request(base, route + '/snapshot', { method: 'POST', timeoutMs: t, body, signal });
    }
    case 'actions': {
      if (app !== 'ppt') fail('E_ARGS', '结构化动作目前只有 PowerPoint 支持；Word / Excel 请改用 action=code。');
      const body = { actions: parseActions(a.actions), return_screenshot: a.returnScreenshot === true, timeout: Number(a.timeout) || 120 };
      if (a.currentSlideOnly !== undefined) body.current_slide_only = a.currentSlideOnly === true;
      return request(base, route + '/step', { method: 'POST', timeoutMs: t, body, signal });
    }
    case 'code': {
      const code = String(a.code || '');
      if (!code.trim()) fail('E_ARGS', 'action=code 需要 code。');
      const body = { code, language: a.language || 'PowerShell', timeout: Number(a.timeout) || 120, return_screenshot: a.returnScreenshot === true };
      return request(base, route + '/step', { method: 'POST', timeoutMs: t, body, signal });
    }
    case 'launch':
      return request(base, route + '/launch', { method: 'POST', timeoutMs: t, body: {}, signal });
    case 'activate': {
      const body = {};
      if (a.drawingName !== undefined) body.name = String(a.drawingName);
      if (a.index !== undefined) body.index = Number(a.index);
      if (!Object.keys(body).length) fail('E_ARGS', 'action=activate 需要 drawingName 或 index。');
      return request(base, route + '/activate', { method: 'POST', timeoutMs: t, body, signal });
    }
    case 'step': {
      const step = a.stepAction || 'draw_from_json';
      const body = { action: step, timeout: Number(a.timeout) || 120, return_screenshot: a.returnScreenshot === true };
      if (step === 'draw_from_json') body.data = parseData(a.data);
      else {
        if (!String(a.code || '').trim()) fail('E_ARGS', 'stepAction=execute_python_com 需要 code。');
        body.code = String(a.code);
      }
      return request(base, route + '/step', { method: 'POST', timeoutMs: t, body, signal });
    }
    default:
      fail('E_ARGS', `未知的 action：${a.action}（${app}）。`);
  }
}

async function runApp(base, app, a, signal) {
  const data = await appCall(base, app, a, signal);
  return { ok: true, engine: base, app, action: a.action, data: sanitizeUseitData(data) };
}

async function status(base, a, signal) {
  const labels = ['engine', ...Object.keys(APPS)];
  const jobs = [
    request(base, '/api/v1/health', { timeoutMs: Math.min(timeoutOf(a), 5000), signal }),
    ...Object.keys(APPS).map(app => request(base, APPS[app] + '/status', { timeoutMs: Math.min(timeoutOf(a), 5000), signal })),
  ];
  const results = await Promise.allSettled(jobs);
  const apps = {};
  let reachable = false;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      apps[labels[i]] = { ok: true, data: sanitizeUseitData(r.value) };
      if (i === 0) reachable = true;
    } else {
      apps[labels[i]] = { ok: false, error: r.reason?.message || String(r.reason) };
    }
  });
  return { ok: true, reachable, engine: base, apps, setup: reachable ? undefined : SETUP };
}

async function computer(base, a, signal) {
  const t = timeoutOf(a);
  let data;
  if (a.action === 'screenshot') {
    data = await request(base, '/api/v1/computer/screenshot', { method: 'POST', timeoutMs: t, body: { resize: a.resize !== false }, signal });
  } else if (a.action === 'actions') {
    data = await request(base, '/api/v1/computer/step', { method: 'POST', timeoutMs: t, body: { actions: parseActions(a.actions), return_screenshot: a.returnScreenshot === true }, signal });
  } else fail('E_ARGS', `未知的 action：${a.action}（桌面 GUI）。`);
  return { ok: true, engine: base, app: 'computer', action: a.action, data: sanitizeUseitData(data) };
}

export async function useitTool(engine, name, a = {}, scope, signal) {
  const base = useitEngineBase(a);
  if (name === 'useit_status') return status(base, a, signal);
  if (name === 'useit_catalog') {
    const data = await request(base, '/api/v1/capabilities', { timeoutMs: timeoutOf(a), signal });
    return { ok: true, engine: base, catalog: sanitizeUseitData(data) };
  }
  if (name === 'useit_computer') return computer(base, a, signal);
  const app = name.replace(/^useit_/, '');
  if (!APPS[app]) fail('E_TOOL', '未知的 Use-It 工具：' + name);
  return runApp(base, app, a, signal);
}
