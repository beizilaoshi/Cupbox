// 免费模型通道 —— 移植自 dsh-our-free-model（MIT，作者 fish-under-sea / Ebony-Vinyl，
// https://github.com/Ebony-Vinyl/dsh-our-free-model），向原项目致谢。
// 两条免密通道（零 API Key）：
//   1) opencode 免密网关：公共凭据 + 客户端指纹头 + 稳定会话 ID（按会话配额记账）+ 四工具指纹门禁；
//   2) Kilo 免费池：OpenAI 兼容网关，isFree 切片，完全无凭据无门禁。
// 原插件为 DSH 专属（peer @deepseek-ai/cordis），无法直接嵌入；本文件按其验证过的线上事实
// （2026-09/10 直连验证）重写为零依赖核心，供 CLI / MCP / 桌面共用。
// 风险提示：免费通道为第三方公共池，上游可能记录提示词用于改进服务；无 SLA，可能限流、
// 区域限制或随时下线；请勿在免费通道上传敏感内容。
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { reasoningParameters, type ReasoningMode } from './reasoning.js';
import { dataHome } from './paths.js';

/** 网关地址（可用环境变量覆盖，便于自建中转与测试）。 */
export const OPENCODE_BASE = (process.env.CUPBOX_FREE_BASE ?? 'https://opencode.ai').replace(/\/+$/, '');
export const KILO_BASE = (process.env.CUPBOX_FREE_KILO_BASE ?? 'https://api.kilo.ai/api/gateway').replace(/\/+$/, '');

/** 网关 UA 检查要求 >= 1.17 的桌面客户端版本号。 */
export const CLIENT_UA = 'opencode/1.18.31';

/** 免费层要求声明的四件套工具名（全小写）。 */
export const FINGERPRINT_TOOLS = ['bash', 'glob', 'grep', 'read'] as const;

/** 槽位捐赠：cupbox 的 shell 工具在 Windows 上叫 pwsh，可顶替 bash 槽。 */
const QUARTET_DONORS: Record<string, string[]> = { bash: ['pwsh'] };

/** 由 /responses 服务的模型（原插件验证）。 */
const RESPONSES_MODELS = new Set(['muse-spark-1.2-contributor-free', 'muse-spark-1.3-contributor-free']);
/** 由 Anthropic 形 /messages 服务的模型。 */
const MESSAGES_MODELS = new Set(['union-alpha']);

export const SESSION_RE = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/;
export const REQUEST_RE = /^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/;

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function base62From(bytes: Buffer): string {
  let out = '';
  for (const byte of bytes) out += BASE62[byte % 62];
  return out;
}

/** 剥掉尾部 "(level)" 思考档后缀，让查找命中基础 id。 */
export function baseModelId(model: string): string {
  return String(model ?? '').replace(/\([^()]+\)\s*$/, '').trim();
}

let lastStamp = 0;
let seq = 0;

/** 铸造网关形态的会话 ID（时间前缀 + 单调计数器 + 随机尾巴）。 */
export function mintSessionId(timestamp = Date.now()): string {
  if (timestamp !== lastStamp) { lastStamp = timestamp; seq = 0 }
  seq += 1;
  const value = ~(BigInt(timestamp) * 1000n + BigInt(seq));
  let hex = '';
  for (let i = 0; i < 6; i += 1) hex += Number((value >> BigInt(40 - 8 * i)) & 0xffn).toString(16).padStart(2, '0');
  return `ses_${hex}${base62From(randomBytes(14))}`;
}

/** 铸造单轮请求 ID。 */
export function mintRequestId(timestamp = Date.now()): string {
  const value = BigInt(timestamp) * 1000n + 1n;
  let hex = '';
  for (let i = 0; i < 6; i += 1) hex += Number((value >> BigInt(40 - 8 * i)) & 0xffn).toString(16).padStart(2, '0');
  return `msg_${hex}${base62From(randomBytes(14))}`;
}

/**
 * 把一个下游会话映射到稳定的上游会话。
 * 免费层配额按会话记账：每请求新铸会话会立刻耗尽配额（429），
 * 用会话摘要做种子则同一对话跨重启复用同一上游会话。
 */
export function sessionForConversation(sessionId?: string): string {
  const seed = typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : 'global';
  const digest = createHash('sha256').update(`our-free-model\0${seed}`).digest();
  return `ses_${digest.subarray(0, 6).toString('hex')}${base62From(digest.subarray(6, 20))}`;
}

/** 稳定的单轮请求 ID：同一轮重试共享。 */
export function requestIdFor(sessionId: string, turnSeed?: string): string {
  if (typeof turnSeed !== 'string' || turnSeed === '') return mintRequestId();
  const digest = createHash('sha256').update(`our-free-model-req\0${sessionId}\0${turnSeed}`).digest();
  const id = `msg_${digest.subarray(0, 6).toString('hex')}${base62From(digest.subarray(6, 20))}`;
  return REQUEST_RE.test(id) ? id : mintRequestId();
}

/** 是否属于免密免费层 id（`-free` 后缀或白名单）。 */
const ALWAYS_FREE = new Set(['union-alpha', 'space-bunny-free']);
export function isFreeLane(modelId: string): boolean {
  const base = baseModelId(modelId);
  if (ALWAYS_FREE.has(base)) return true;
  return /(?:^|[-_])free(?:$|[-_.])/.test(base);
}

export function isResponsesModel(modelId: string): boolean {
  return RESPONSES_MODELS.has(baseModelId(modelId)) || /^muse[-_]?spark(?:$|[-_:.\s])/i.test(baseModelId(modelId));
}
export function isMessagesModel(modelId: string): boolean {
  return MESSAGES_MODELS.has(baseModelId(modelId));
}

/** 网关按模型 id 选端点路径。 */
export function endpointFor(modelId: string): string {
  if (isResponsesModel(modelId)) return '/zen/v1/responses';
  if (isMessagesModel(modelId)) return '/zen/v1/messages';
  return '/zen/v1/chat/completions';
}

/**
 * 网关指纹请求头：`Authorization: Bearer public` 是池化免密凭据，
 * 该通道上没有每用户密钥。
 */
export function gatewayHeaders(session: string, requestId: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'authorization': 'Bearer public',
    'user-agent': CLIENT_UA,
    'x-opencode-client': 'desktop',
    'x-opencode-session': session,
    'x-opencode-request': requestId,
    'x-opencode-project': 'global',
    'accept': '*/*',
  };
}

function toolNameOf(tool: unknown): string {
  const t = tool as { name?: unknown; function?: { name?: unknown } } | null;
  if (!t || typeof t !== 'object') return '';
  if (typeof t.name === 'string' && t.name.trim()) return t.name.trim();
  const fn = t.function;
  if (fn && typeof fn === 'object' && typeof fn.name === 'string') return fn.name.trim();
  return '';
}

/**
 * 满足免费层四工具指纹门禁：大小写变体归一、可顶替槽位晋升真实工具、
 * 缺的槽位补自禁用诱饵（模型不会真的调用）。就地修改 body.tools。
 * 返回「发出名 → 调用方原名」映射，供响应侧还原。
 */
export function applyFingerprint(body: { tools?: unknown[]; tool_choice?: unknown }, style: 'chat' | 'flat' | 'claude'): Map<string, string> {
  const map = new Map<string, string>();
  const tools = Array.isArray(body.tools) ? body.tools : [];
  const hadClientTools = tools.length > 0;
  const seen = new Set<string>();
  const out: unknown[] = [];

  for (const tool of tools) {
    const current = toolNameOf(tool);
    const key = (FINGERPRINT_TOOLS as readonly string[]).includes(current.toLowerCase()) ? current.toLowerCase() : '';
    if (!key) { out.push(tool); continue }
    if (seen.has(key)) continue;
    seen.add(key);
    if (current !== key) {
      map.set(key, current);
      out.push(renameTool(tool, key));
    } else {
      out.push(tool);
    }
  }

  // 缺失槽位：先尝试晋升调用方真实可应答的工具（如 pwsh 顶 bash），再补诱饵。
  const promoted = new Set<string>();
  for (const name of FINGERPRINT_TOOLS) {
    if (seen.has(name)) continue;
    const donors = QUARTET_DONORS[name] ?? [];
    const index = out.findIndex((tool) => {
      const original = toolNameOf(tool);
      if (original === '' || (FINGERPRINT_TOOLS as readonly string[]).includes(original.toLowerCase())) return false;
      const lower = original.toLowerCase();
      return !promoted.has(lower) && donors.includes(lower);
    });
    if (index === -1) continue;
    const original = toolNameOf(out[index]);
    promoted.add(original.toLowerCase());
    map.set(name, original);
    out[index] = renameTool(out[index], name);
    seen.add(name);
  }

  for (const name of FINGERPRINT_TOOLS) {
    if (seen.has(name)) continue;
    const decoy = { name, description: 'This tool is currently unavailable and must not be used.', parameters: { type: 'object', properties: {} } };
    out.push(style === 'claude' ? { ...decoy, input_schema: decoy.parameters }
      : style === 'flat' ? { type: 'function', ...decoy }
      : { type: 'function', function: decoy });
  }

  body.tools = out;
  if (!body.tool_choice) {
    if (style === 'flat') body.tool_choice = 'auto';
    else if (!hadClientTools) body.tool_choice = style === 'claude' ? { type: 'none' } : 'none';
  }
  return map;
}

function renameTool(tool: unknown, name: string): unknown {
  const t = tool as { name?: string; function?: Record<string, unknown> } | null;
  if (t && typeof t === 'object' && t.function && typeof t.function === 'object') {
    return { ...t, function: { ...t.function, name } };
  }
  return { ...(t as object), name };
}

/** 还原调用方原工具名（响应侧）。 */
export function restoreToolName(name: string, map: Map<string, string>): string {
  return map.get(name) ?? name;
}

/* ---------------- 模型目录（本地能力基线，移植自原插件 catalog） ---------------- */

export interface FreeModelEntry {
  id: string;
  name: string;
  lane: 'opencode' | 'kilo';
  wire: 'chat' | 'responses' | 'messages';
  vision: boolean;
  reasoning: boolean;
  reasoningEfforts?: string[];
  contextWindow: number;
  maxOutput: number;
  regionSensitive?: boolean;
  /** 目录来自本地兜底表而非实时列表（上游可能已变动）。 */
  stale?: boolean;
  /** 上游通道已封禁第三方客户端（当前 OpenCode 免费层 403），仅保留展示与说明。 */
  blocked?: boolean;
}

interface CapsRow { match: RegExp; vision: boolean; reasoning: boolean; contextWindow: number; maxOutput: number }

const CAPABILITIES: CapsRow[] = [
  { match: /^mimo.*v2\.6/, vision: true, reasoning: true, contextWindow: 1048576, maxOutput: 131072 },
  { match: /^mimo.*v2\.5/, vision: true, reasoning: true, contextWindow: 1048576, maxOutput: 131072 },
  { match: /^mimo/, vision: true, reasoning: true, contextWindow: 262144, maxOutput: 131072 },
  { match: /^muse.?spark/, vision: true, reasoning: true, contextWindow: 1048576, maxOutput: 131072 },
  { match: /^nemotron/, vision: false, reasoning: true, contextWindow: 128000, maxOutput: 32768 },
  { match: /^ling/, vision: false, reasoning: true, contextWindow: 128000, maxOutput: 32768 },
  { match: /^space.?bunny/, vision: true, reasoning: true, contextWindow: 262144, maxOutput: 65536 },
  { match: /^union/, vision: true, reasoning: false, contextWindow: 262144, maxOutput: 131072 },
  { match: /^deepseek/, vision: false, reasoning: true, contextWindow: 128000, maxOutput: 64000 },
  { match: /^jev/, vision: false, reasoning: false, contextWindow: 32768, maxOutput: 4096 },
];

const DISPLAY_NAMES: Record<string, string> = {
  'mimo-v2.6-flash-free': 'MiMo V2.6 Flash',
  'mimo-v2.5-free': 'MiMo V2.5',
  'muse-spark-1.3-contributor-free': 'Muse Spark 1.3',
  'muse-spark-1.2-contributor-free': 'Muse Spark 1.2',
  'nemotron-3-ultra-free': 'Nemotron 3 Ultra',
  'nemotron-3.5-lightning-free': 'Nemotron 3.5 Lightning',
  'ling-3.0-flash-fin-free': 'Ling 3.0 Flash Fin',
  'space-bunny-free': 'Space Bunny',
  'union-alpha': 'Union Alpha',
  'deepseek-v4-flash-free': 'DeepSeek V4 Flash',
  'jev-1.13-free': 'Jev 1.13',
};

const REGION_SENSITIVE = [/^muse.?spark/];

function capsFor(base: string): CapsRow | undefined {
  return CAPABILITIES.find((row) => row.match.test(base));
}

/** 把裸 id 美化成选择器可展示的名称。 */
export function displayModelName(modelId: string): string {
  const base = baseModelId(modelId);
  const known = DISPLAY_NAMES[base];
  if (known !== undefined) return known;
  return base
    .replace(/[-_.]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (/^\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function wireOf(base: string): FreeModelEntry['wire'] {
  if (isResponsesModel(base)) return 'responses';
  if (isMessagesModel(base)) return 'messages';
  return 'chat';
}

function opencodeEntry(id: string, stale = false): FreeModelEntry {
  const base = baseModelId(id);
  const caps = capsFor(base);
  const region = REGION_SENSITIVE.some((p) => p.test(base));
  return {
    id: base,
    name: displayModelName(base),
    lane: 'opencode',
    wire: wireOf(base),
    vision: caps?.vision ?? false,
    reasoning: caps?.reasoning ?? true,
    contextWindow: caps?.contextWindow ?? 131072,
    maxOutput: caps?.maxOutput ?? 32768,
    ...(region ? { regionSensitive: true } : {}),
    ...(stale ? { stale: true } : {}),
  };
}

/** 解析网关 `{"data":[{"id":…}]}` 列表。 */
export function parseListing(payload: unknown): string[] {
  const p = payload as { data?: unknown[]; models?: unknown[] } | unknown[] | null;
  const rows = Array.isArray(p) ? p : Array.isArray(p?.data) ? p.data : Array.isArray(p?.models) ? p.models : [];
  return rows
    .map((row) => (typeof row === 'string' ? row : (row as { id?: unknown })?.id))
    .filter((id): id is string => typeof id === 'string' && id !== '');
}

/** 由实时列表构建免密目录（只收免费层 id，按基础 id 去重）。 */
export function buildCatalog(ids: string[]): FreeModelEntry[] {
  const seen = new Set<string>();
  const entries: FreeModelEntry[] = [];
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (id === '' || !isFreeLane(id)) continue;
    const base = baseModelId(id);
    if (seen.has(base)) continue;
    seen.add(base);
    entries.push(opencodeEntry(base));
  }
  return entries;
}

/** Kilo 免费池：OpenRouter 风格列表里 isFree=true 的切片。 */
export function isKiloFreeRow(row: unknown): row is { id: string; name?: string; context_length?: number; top_provider?: { context_length?: number; max_completion_tokens?: number }; architecture?: { input_modalities?: string[] } } {
  const r = row as { isFree?: unknown; id?: unknown } | null;
  return r?.isFree === true && typeof r?.id === 'string' && r.id.trim() !== '';
}

export function kiloDisplayName(row: { id: string; name?: string }): string {
  const raw = typeof row.name === 'string' ? row.name.trim() : '';
  const bare = (raw !== '' ? raw : row.id)
    .replace(/^[^:]{1,40}:\s+/, '')
    .replace(/\s*\(free\)\s*$/i, '')
    .trim();
  return bare !== '' ? bare : row.id;
}

export function buildKiloCatalog(rows: unknown[]): FreeModelEntry[] {
  const seen = new Set<string>();
  const entries: FreeModelEntry[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isKiloFreeRow(row)) continue;
    const id = row.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    const modalities = Array.isArray(row.architecture?.input_modalities) ? row.architecture.input_modalities : [];
    entries.push({
      id,
      name: kiloDisplayName(row),
      lane: 'kilo',
      wire: 'chat',
      vision: modalities.includes('image'),
      reasoning: true,
      ...((row as Record<string,unknown>).supported_parameters instanceof Array && ((row as Record<string,unknown>).supported_parameters as string[]).includes('reasoning')?{reasoningEfforts:['none','low','medium','high']}:{}),
      contextWindow: number(row.context_length ?? row.top_provider?.context_length) ?? 131072,
      maxOutput: number(row.top_provider?.max_completion_tokens) ?? 32768,
    });
  }
  return entries;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
}

/** 本地兜底目录：上游不可达时仍能展示（标注 stale）。 */
export function fallbackCatalog(): FreeModelEntry[] {
  return Object.keys(DISPLAY_NAMES).map((id) => opencodeEntry(id, true));
}

/* ---------------- 开关与缓存（freemodel.json） ---------------- */

export interface FreeStore {
  /** 总开关：默认关闭，用户在设置里自主启用。 */
  enabled: boolean;
  /** 按模型 id 的开关（未列出的默认开启=跟随总开关）。 */
  off?: Record<string, boolean>;
  cachedAt?: number;
  opencodeIds?: string[];
  kiloRows?: Array<Record<string, unknown>>;
}

export function freemodelStorePath(): string {
  return path.join(dataHome(), 'freemodel.json');
}

export async function loadFreeStore(): Promise<FreeStore> {
  try {
    const parsed = JSON.parse(await readFile(freemodelStorePath(), 'utf8')) as FreeStore;
    return { enabled: parsed.enabled === true, ...(parsed.off ? { off: parsed.off } : {}), ...(parsed.cachedAt ? { cachedAt: parsed.cachedAt } : {}), ...(parsed.opencodeIds ? { opencodeIds: parsed.opencodeIds } : {}), ...(parsed.kiloRows ? { kiloRows: parsed.kiloRows } : {}) };
  } catch {
    return { enabled: false };
  }
}

let freeStoreQueue:Promise<unknown>=Promise.resolve();
export function saveFreeStore(patch: Partial<FreeStore>): Promise<FreeStore> {
  const result=freeStoreQueue.catch(()=>{}).then(async()=>{const cur=await loadFreeStore();const next:FreeStore={...cur,...patch,...(patch.off?{off:{...cur.off,...patch.off}}:{})};await mkdir(dataHome(),{recursive:true});const file=freemodelStorePath();await writeFile(file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});const {rename}=await import('node:fs/promises');await rename(file+'.tmp',file);return next;});freeStoreQueue=result;return result;
}

/** 某模型在当前开关组合下是否可用。 */
export function isModelEnabled(store: FreeStore, id: string): boolean {
  if (!store.enabled) return false;
  return store.off?.[id] !== true;
}

/* ---------------- 实时目录 ---------------- */

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const signal=init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);
  const res = await fetch(url, { ...init, signal });
  const text = await res.text();
  let payload: unknown = null;
  try { payload = JSON.parse(text) } catch { /* 非 JSON 交上层分类 */ }
  if (!res.ok) {
    const msg = (payload as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(classifyStatus(res.status, msg));
  }
  return payload;
}

/** 把上游状态码分类成不泄漏端点的中文错误。 */
export function classifyStatus(status: number, upstream = ''): string {
  const tail = upstream ? `（${upstream.slice(0, 160)}）` : '';
  if (status === 401) return `免费通道公共凭据失效，等待上游修复${tail}`;
  if (status === 403) return `请求被免费层拒绝：可能是区域限制或未通过指纹门禁${tail}`;
  if (status === 429) return `触发免费层限流，稍后再试${tail}`;
  if (status >= 500) return `上游服务暂不可用（${status}），稍后再试${tail}`;
  return `免费通道请求失败（${status}）${tail}`;
}

export interface ListResult {
  models: FreeModelEntry[];
  cachedAt: number;
  /** 哪些通道是实时拉取成功的。 */
  live: { opencode: boolean; kilo: boolean };
}

/** 实时拉取两条通道的目录；单通道失败用缓存/兜底表补齐。 */
export async function listFreeModels(opts: { refresh?: boolean; offline?: boolean } = {}): Promise<ListResult> {
  const store = await loadFreeStore();
  const fresh = !opts.offline && (opts.refresh === true || !store.cachedAt || Date.now() - store.cachedAt > 24 * 3600_000);
  let opencodeIds = store.opencodeIds ?? [];
  let kiloRows = store.kiloRows ?? [];
  const live = { opencode: false, kilo: false };

  if (fresh) {
    const [oc, kilo] = await Promise.allSettled([
      fetchJson(`${OPENCODE_BASE}/zen/v1/models`, { headers: { 'user-agent': CLIENT_UA, authorization: 'Bearer public', 'x-opencode-client': 'desktop' } }, 15000),
      fetchJson(`${KILO_BASE}/models`, { headers: { accept: 'application/json', 'user-agent': 'cupbox-free-model' } }, 15000),
    ]);
    if (oc.status === 'fulfilled') {
      opencodeIds = parseListing(oc.value);
      live.opencode = true;
    }
    if (kilo.status === 'fulfilled') {
      const rows = (kilo.value as { data?: unknown[] })?.data;
      kiloRows = Array.isArray(rows) ? rows.filter(isKiloFreeRow).map((r) => ({ ...(r as Record<string, unknown>) })) : [];
      live.kilo = true;
    }
    if (live.opencode || live.kilo) {
      await saveFreeStore({ cachedAt: Date.now(), ...(live.opencode ? { opencodeIds } : {}), ...(live.kilo ? { kiloRows } : {}) });
    }
  }

  // 数据优先级：实时拉取 > 上次缓存 > 本地兜底表。
  // Kilo 通道无门禁、可直接使用，排在前面；OpenCode 免费层已封禁第三方客户端（403 FreeTierError），统一标注 blocked 仅作展示。
  let models = [...buildKiloCatalog(kiloRows), ...buildCatalog(opencodeIds).map((m) => ({ ...m, blocked: true }))];
  if (models.length === 0) models = fallbackCatalog().map((m) => ({ ...m, blocked: true }));

  const dedup = new Map<string, FreeModelEntry>();
  for (const m of models) dedup.set(`${m.lane}:${m.id}`, m);
  return { models: [...dedup.values()], cachedAt: live.opencode||live.kilo?Date.now():store.cachedAt||0, live };
}

/* ---------------- 对话调用 ---------------- */

export interface FreeTurn {
  role: 'system' | 'user' | 'assistant' | 'tool';
  text?: string;
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  results?: { id: string; name: string; text: string }[];
}

export interface FreeChatOptions {
  model: string;
  lane?: 'kilo' | 'opencode';
  messages: FreeTurn[];
  tools?: { name: string; description: string; parameters: Record<string, unknown> }[];
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: string;
  reasoningMode?: ReasoningMode;
  reasoningLevels?: string[];
  conversationKey?: string;
  turnSeed?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface FreeChatResult {
  text: string;
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  usage?: { prompt: number; completion: number };
  lane: 'opencode' | 'kilo';
  model: string;
}

function laneOf(modelId: string): 'opencode' | 'kilo' {
  return modelId.includes('/') ? 'kilo' : 'opencode';
}

function toOpenAiMessages(turns: FreeTurn[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const t of turns) {
    if (t.role === 'system') out.push({ role: 'system', content: t.text ?? '' });
    else if (t.role === 'user') out.push({ role: 'user', content: t.text ?? '' });
    else if (t.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: t.text || null,
        ...(t.toolCalls && t.toolCalls.length
          ? { tool_calls: t.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) } })) }
          : {}),
      });
    } else {
      for (const r of t.results ?? []) out.push({ role: 'tool', tool_call_id: r.id, content: r.text });
    }
  }
  return out;
}

function parseChatPayload(payload: unknown, map: Map<string, string>): FreeChatResult['toolCalls'] | undefined {
  const choices = (payload as { choices?: { message?: { content?: unknown; tool_calls?: unknown[] } }[] })?.choices;
  const message = Array.isArray(choices) ? choices[0]?.message : undefined;
  const rawCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  if (!rawCalls.length) return undefined;
  const calls = rawCalls.map((c) => {
    const fn = (c as { function?: { name?: string; arguments?: string } })?.function;
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(fn?.arguments ?? '{}') as Record<string, unknown> } catch { args = {} }
    return { id: String((c as { id?: string })?.id ?? `call_${randomBytes(6).toString('hex')}`), name: restoreToolName(String(fn?.name ?? ''), map), args };
  });
  return calls;
}

/**
 * 免密通道单轮对话（非流式）。
 * opencode 通道按模型走 chat/responses/messages 三种线格式；
 * responses/messages 线暂只支持纯文本（带工具时给出明确错误）。
 */
export async function chatFreeLane(opts: FreeChatOptions): Promise<FreeChatResult> {
  const model = baseModelId(opts.model);
  const lane = opts.lane || laneOf(model);
  const session = sessionForConversation(opts.conversationKey);
  const requestId = requestIdFor(session, opts.turnSeed);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 180_000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  if (opts.signal?.aborted) controller.abort();

  try {
    if (lane === 'kilo') return await kiloChat(model, opts, controller.signal);
    return await opencodeChat(model, opts, session, requestId, controller.signal);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener?.('abort', onAbort);
  }
}

async function opencodeChat(model: string, opts: FreeChatOptions, session: string, requestId: string, signal: AbortSignal): Promise<FreeChatResult> {
  const wire = wireOf(model);
  const url = `${OPENCODE_BASE}${endpointFor(model)}`;
  const headers = gatewayHeaders(session, requestId);
  const maxTokens = Math.max(1, Math.min(131072, opts.maxTokens ?? 4096));
  const systemText = opts.messages.filter((t) => t.role === 'system').map((t) => t.text ?? '').join('\n\n');

  let body: Record<string, unknown>;
  let map = new Map<string, string>();
  if (wire === 'chat') {
    body = {
      model,
      messages: toOpenAiMessages(opts.messages),
      stream: false,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.tools && opts.tools.length
        ? { tools: opts.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) }
        : {}),
    };
    map = applyFingerprint(body as { tools?: unknown[]; tool_choice?: unknown }, 'chat');
  } else if (wire === 'responses') {
    if (opts.tools && opts.tools.length) throw new Error('该模型由 /responses 线服务，当前版本仅支持纯文本对话（不支持工具调用）');
    body = {
      model,
      input: opts.messages
        .filter((t) => t.role !== 'system' && t.role !== 'tool')
        .map((t) => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: [{ type: t.role === 'assistant' ? 'output_text' : 'input_text', text: t.text ?? '' }] })),
      stream: false,
      ...(systemText ? { instructions: systemText } : {}),
    };
    applyFingerprint(body as { tools?: unknown[]; tool_choice?: unknown }, 'flat');
  } else {
    if (opts.tools && opts.tools.length) throw new Error('该模型由 /messages 线服务，当前版本仅支持纯文本对话（不支持工具调用）');
    body = {
      model,
      max_tokens: maxTokens,
      ...(systemText ? { system: systemText } : {}),
      messages: opts.messages
        .filter((t) => t.role === 'user' || (t.role === 'assistant' && (t.text ?? '') !== ''))
        .map((t) => ({ role: t.role, content: t.text ?? '' })),
      stream: false,
    };
    applyFingerprint(body as { tools?: unknown[]; tool_choice?: unknown }, 'claude');
  }

  const payload = await fetchJson(url, { method: 'POST', headers, body: JSON.stringify(body),signal }, opts.timeoutMs ?? 180_000);
  const p = payload as {
    choices?: { message?: { content?: unknown } }[];
    output_text?: string;
    output?: { content?: { text?: string }[]; type?: string }[];
    content?: { text?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number };
  };

  let text = '';
  if (wire === 'chat') {
    const content = p.choices?.[0]?.message?.content;
    text = typeof content === 'string' ? content : Array.isArray(content) ? (content as { text?: string }[]).map((c) => c.text ?? '').join('') : '';
  } else if (wire === 'responses') {
    text = typeof p.output_text === 'string' && p.output_text ? p.output_text
      : (p.output ?? []).filter((item) => item?.type === 'message').flatMap((item) => (item.content ?? []).map((c) => c.text ?? '')).join('');
  } else {
    text = (p.content ?? []).map((c) => c.text ?? '').join('');
  }

  const toolCalls = wire === 'chat' ? parseChatPayload(payload, map) : undefined;
  const usage = number(p.usage?.prompt_tokens ?? p.usage?.input_tokens) !== undefined
    ? { prompt: number(p.usage?.prompt_tokens ?? p.usage?.input_tokens)!, completion: number(p.usage?.completion_tokens ?? p.usage?.output_tokens) ?? 0 }
    : undefined;
  return { text, ...(toolCalls ? { toolCalls } : {}), ...(usage ? { usage } : {}), lane: 'opencode', model };
}

async function kiloChat(model: string, opts: FreeChatOptions, signal: AbortSignal): Promise<FreeChatResult> {
  if (opts.tools && opts.tools.length) throw new Error('Kilo 免费池当前仅支持纯文本对话（不支持工具调用）');
  const body: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(opts.messages),
    ...reasoningParameters({provider:'free',model,reasoningMode:opts.reasoningMode,reasoningLevels:opts.reasoningLevels},opts.reasoningEffort),
    ...(opts.maxTokens?{max_tokens:Math.max(1,Math.min(131072,opts.maxTokens))}:{}),
    stream: false,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };
  const payload = await fetchJson(`${KILO_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'cupbox-free-model' },
    body: JSON.stringify(body),
    signal,
  }, opts.timeoutMs ?? 180_000);
  const p = payload as { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const content = p.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content : '';
  const usage = number(p.usage?.prompt_tokens) !== undefined ? { prompt: number(p.usage?.prompt_tokens)!, completion: number(p.usage?.completion_tokens) ?? 0 } : undefined;
  return { text, ...(usage ? { usage } : {}), lane: 'kilo', model };
}

/** 快速探测某模型可用性（极小对话）。返回延迟毫秒或错误信息。 */
export async function probeFreeModel(model: string): Promise<{ ok: boolean; ms: number; error?: string }> {
  const started = Date.now();
  try {
    const r = await chatFreeLane({
      model,
      messages: [{ role: 'user', text: 'ping' }],
      maxTokens: 16,
      conversationKey: `probe-${model}`,
      timeoutMs: 30000,
    });
    if (!r.text && !r.toolCalls) return { ok: false, ms: Date.now() - started, error: '模型返回为空' };
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}
