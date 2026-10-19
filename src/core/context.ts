// 上下文洞察（Context Insights）：token 估算、成分分解、趋势与事件。
// 设计参考 dsh-context（https://github.com/bowenliang123/dsh-context, Apache-2.0）的
// 「六成分分解 + 每请求趋势 + 上下文事件」思路，为 Cupbox 零依赖重写。
// 全部为固定密度启发式估算（≈，非精确 tokenizer 计数），不引入任何运行时依赖。

/** 默认上下文窗口（DeepSeek/GPT/Claude 主流档 128k；可用 CUPBOX_CONTEXT_WINDOW 覆盖）。 */
export const DEFAULT_CONTEXT_WINDOW = 128_000;

/** 密度常量：CJK 每 1.5 字 ≈ 1 token；其余字符每 4 个 ≈ 1 token（保守估算，宁可略高估）。 */
const CJK_CHARS_PER_TOKEN = 1.5;
const OTHER_CHARS_PER_TOKEN = 4;

const CJK_RE =
  /[　-〿㐀-䶿一-鿿豈-﫿-﫿＀-￯぀-ヿ]/;

export interface CharStats {
  cjk: number;
  other: number;
  total: number;
}

/** 统计 CJK / 其他字符数（按码点遍历）。 */
export function countChars(text: string): CharStats {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK_RE.test(ch)) cjk++;
    else other++;
  }
  return { cjk, other, total: cjk + other };
}

/** 估算 token 数（固定密度启发式，≈）。空串为 0；非空至少 1。 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const { cjk, other } = countChars(text);
  const n = Math.ceil(cjk / CJK_CHARS_PER_TOKEN + other / OTHER_CHARS_PER_TOKEN);
  return Math.max(1, n);
}

/* ---------------- 六成分分解（system / tools / user / injected / assistant / toolResults） ---------------- */

export type ContextPartKey =
  | 'system'
  | 'tools'
  | 'user'
  | 'injected'
  | 'assistant'
  | 'toolResults';

export interface ContextPart {
  key: ContextPartKey;
  label: string;
  tokens: number;
  chars: number;
}

export interface ContextMessageInput {
  role: 'system' | 'user' | 'assistant' | 'tool';
  text?: string;
  /** role=tool 时的结果文本列表（Agent 循环回填的工具输出）。 */
  results?: readonly string[];
}

export interface ContextBreakdown {
  /** 固定顺序：system → tools → user → injected → assistant → toolResults。 */
  parts: ContextPart[];
  total: number;
  window: number;
  /** total / window（0~1+）。 */
  occupancy: number;
  at: number;
}

const PART_LABELS: Record<ContextPartKey, string> = {
  system: '系统提示词',
  tools: '工具 Schema',
  user: '用户消息',
  injected: '注入上下文',
  assistant: '助手回复',
  toolResults: '工具结果',
};
const PART_ORDER: ContextPartKey[] = [
  'system',
  'tools',
  'user',
  'injected',
  'assistant',
  'toolResults',
];

/** 解析上下文窗口：显式值 → 环境变量 CUPBOX_CONTEXT_WINDOW → 128k。 */
export function resolveWindow(explicit?: number): number {
  if (explicit && Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  const env = Number(process.env.CUPBOX_CONTEXT_WINDOW);
  if (Number.isFinite(env) && env > 0) return Math.floor(env);
  return DEFAULT_CONTEXT_WINDOW;
}

/**
 * 把一次请求的原料（系统提示词 / 工具 Schema / 消息历史 / 注入块）分解为六成分。
 * total = 各成分之和；occupancy = total / window。
 */
export function contextBreakdown(input: {
  system?: string;
  toolSchemas?: string;
  injected?: string;
  messages?: readonly ContextMessageInput[];
  window?: number;
}): ContextBreakdown {
  const raw: Record<ContextPartKey, string> = {
    system: input.system ?? '',
    tools: input.toolSchemas ?? '',
    user: '',
    injected: input.injected ?? '',
    assistant: '',
    toolResults: '',
  };
  for (const m of input.messages ?? []) {
    if (m.role === 'user') raw.user += `${m.text ?? ''}\n`;
    else if (m.role === 'assistant') raw.assistant += `${m.text ?? ''}\n`;
    else if (m.role === 'system') raw.system += `${m.text ?? ''}\n`;
    else if (m.role === 'tool') {
      for (const r of m.results ?? []) raw.toolResults += `${r}\n`;
    }
  }
  const parts: ContextPart[] = PART_ORDER.map((key) => ({
    key,
    label: PART_LABELS[key],
    tokens: estimateTokens(raw[key]),
    chars: raw[key].length,
  }));
  const total = parts.reduce((s, p) => s + p.tokens, 0);
  const window = resolveWindow(input.window);
  return { parts, total, window, occupancy: window ? total / window : 0, at: Date.now() };
}

/* ---------------- 趋势与事件 ---------------- */

export interface ContextTrendPoint {
  at: number;
  /** 本请求上下文的估算总 token（六成分合计）。 */
  tokens: number;
  /** 提供方上报的实际输入 token（有 usage 时才有）。 */
  prompt?: number;
  /** 提供方上报的实际输出 token。 */
  output?: number;
  /** 触发该请求的用户消息摘要（前 24 字）。 */
  label?: string;
}

export type ContextEventKind = 'inject' | 'compact' | 'switch' | 'mode';

export interface ContextEvent {
  at: number;
  kind: ContextEventKind;
  label: string;
  /** token 变化量（压缩为负、注入为正；可省略）。 */
  delta?: number;
}

export const CONTEXT_EVENT_LABELS: Record<ContextEventKind, string> = {
  inject: '注入',
  compact: '压缩',
  switch: '切换',
  mode: '模式',
};

/** 追加趋势点并按容量裁剪（保留最近 cap 条，cap<=0 不裁剪）。 */
export function pushTrend(
  list: readonly ContextTrendPoint[] | undefined,
  point: ContextTrendPoint,
  cap = 200,
): ContextTrendPoint[] {
  const next = [...(list ?? []), point];
  return cap > 0 && next.length > cap ? next.slice(next.length - cap) : next;
}

/** 追加事件并按容量裁剪（保留最近 cap 条）。 */
export function pushEvent(
  list: readonly ContextEvent[] | undefined,
  event: ContextEvent,
  cap = 100,
): ContextEvent[] {
  const next = [...(list ?? []), event];
  return cap > 0 && next.length > cap ? next.slice(next.length - cap) : next;
}

/** 会话级上下文记录（持久化在会话 JSON 的 context 字段）。 */
export interface SessionContextRecord {
  window: number;
  /** 最近一次请求后的构成快照（六成分）。 */
  last: ContextBreakdown | null;
  trend: ContextTrendPoint[];
  events: ContextEvent[];
  totals: {
    requests: number;
    prompt: number;
    output: number;
  };
  /** 最近一次注入块的 token 数（去重，避免每轮重复报注入事件）。 */
  lastInjectTokens?: number;
  /** 最近一次使用的模型（检测模型切换）。 */
  model?: string;
}

export function emptySessionContext(window?: number): SessionContextRecord {
  return {
    window: resolveWindow(window),
    last: null,
    trend: [],
    events: [],
    totals: { requests: 0, prompt: 0, output: 0 },
    lastInjectTokens: 0,
  };
}

/* ---------------- 展示辅助 ---------------- */

/** 紧凑 token 展示：1234 → "1.2k"，1234567 → "1.2M"。 */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const v = Math.max(0, Math.round(n));
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}
