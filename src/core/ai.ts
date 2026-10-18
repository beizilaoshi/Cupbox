// Cupbox AI 接入层：通过 API 接入大模型（OpenAI 兼容 / Anthropic 双协议），
// 并提供 Codex 式 Agent 循环——把 TOOL_DEFS 里的本地工具作为 function tools 调用。
// 零新增依赖：仅用 Node 内置 fetch；配置持久化在 ~/.cupbox/config.json（CUPBOX_HOME 可改）。
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { TOOL_DEFS, runTool, type ToolDef } from './toolkit.js';

export type AiProvider = 'openai-compatible' | 'anthropic';

export interface AiConfig {
  provider: AiProvider;
  /** 自定义网关地址（OpenAI 兼容留空则用官方；DeepSeek/Kimi/Ollama/OpenRouter 填各自 base） */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 0~2，留空用提供方默认 */
  temperature?: number;
  /** Agent 默认最大工具轮次（上限 10） */
  maxTurns?: number;
}

export function configDir(): string {
  const home = process.env.CUPBOX_HOME;
  return home && home.trim() ? path.join(home.trim(), '.cupbox') : path.join(homedir(), '.cupbox');
}
export function configPath(): string {
  return path.join(configDir(), 'config.json');
}

/** 读取配置：文件 + 环境变量（CUPBOX_AI_*，非空才覆盖）。 */
export async function loadAiConfig(): Promise<AiConfig> {
  let fromFile: Partial<AiConfig> = {};
  try {
    fromFile = JSON.parse(await readFile(configPath(), 'utf8')) as Partial<AiConfig>;
  } catch {
    // 首次运行没有配置文件，属正常
  }
  const env = (k: string): string | undefined => {
    const v = process.env[k];
    return v && v.trim() ? v.trim() : undefined;
  };
  const cfg: AiConfig = {
    provider:
      (env('CUPBOX_AI_PROVIDER') as AiProvider | undefined) ??
      (fromFile.provider as AiProvider | undefined) ??
      'openai-compatible',
    baseUrl: env('CUPBOX_AI_BASE_URL') ?? fromFile.baseUrl ?? '',
    apiKey: env('CUPBOX_AI_API_KEY') ?? fromFile.apiKey ?? '',
    model: env('CUPBOX_AI_MODEL') ?? fromFile.model ?? '',
    ...(fromFile.temperature !== undefined ? { temperature: fromFile.temperature } : {}),
    ...(fromFile.maxTurns !== undefined ? { maxTurns: fromFile.maxTurns } : {}),
  };
  return cfg;
}

/** 合并保存（patch 中空字符串视为清除该项；temperature/maxTurns 传 null 也视为清除）。 */
export async function saveAiConfig(
  patch: Partial<AiConfig> & { temperature?: number | null; maxTurns?: number | null },
): Promise<AiConfig> {
  const cur = await loadAiConfig();
  const next: AiConfig = { ...cur };
  if (patch.provider === 'openai-compatible' || patch.provider === 'anthropic') next.provider = patch.provider;
  for (const k of ['baseUrl', 'apiKey', 'model'] as const) {
    if (patch[k] !== undefined) next[k] = String(patch[k]);
  }
  if (patch.temperature === null) {
    delete next.temperature;
  } else if (patch.temperature !== undefined) {
    const t = Number(patch.temperature);
    if (Number.isFinite(t) && t >= 0) next.temperature = t;
    else delete next.temperature;
  }
  if (patch.maxTurns === null) {
    delete next.maxTurns;
  } else if (patch.maxTurns !== undefined) {
    const n = Math.max(1, Math.min(10, Number(patch.maxTurns) || 1));
    next.maxTurns = n;
  }
  await mkdir(configDir(), { recursive: true });
  await writeFile(configPath(), JSON.stringify(next, null, 2), 'utf8');
  try {
    await chmod(configPath(), 0o600); // Windows 忽略，类 Unix 上仅本人可读
  } catch {
    /* best effort */
  }
  return next;
}

export function maskKey(key: string): string {
  if (!key) return '(未配置)';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

/* ---------------- 对话消息（中立模型，按协议转换） ---------------- */

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}
export type ChatTurn =
  | { role: 'system'; text: string }
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; results: { id: string; name: string; text: string }[] };

export interface ChatResult {
  text: string;
  toolCalls?: ToolCall[];
}

export const DEFAULT_SYSTEM =
  '你是 Cupbox 本地 AI 助手，可通过提供的工具完成开发杂活（文件、数据、图片、系统）。' +
  '破坏性工具默认 dry-run 预览；执行受保护命令必须给出允许的前缀白名单。用中文简洁作答。';

function requireConfig(cfg?: AiConfig): Promise<AiConfig> {
  return (async () => {
    const c = cfg ?? (await loadAiConfig());
    if (!c.apiKey) {
      throw new Error(
        '未配置 AI API Key：请在桌面版「设置」中填写，或设置环境变量 CUPBOX_AI_API_KEY（可选 CUPBOX_AI_BASE_URL / CUPBOX_AI_MODEL）。',
      );
    }
    if (!c.model) {
      throw new Error('未配置模型：请在「设置」或环境变量 CUPBOX_AI_MODEL 中指定，如 gpt-5.2 / deepseek-chat / claude-sonnet-4-5。');
    }
    return c;
  })();
}

const OPENAI_DEFAULT = 'https://api.openai.com/v1';
const ANTHROPIC_DEFAULT = 'https://api.anthropic.com';

function openaiUrl(base: string): string {
  const b = (base || OPENAI_DEFAULT).replace(/\/+$/, '');
  return `${b}/chat/completions`;
}
function anthropicUrl(base: string): string {
  const b = (base || ANTHROPIC_DEFAULT).replace(/\/+$/, '');
  return b.endsWith('/v1') ? `${b}/messages` : `${b}/v1/messages`;
}

function toOpenAI(turns: ChatTurn[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const t of turns) {
    if (t.role === 'system') {
      out.push({ role: 'system', content: t.text });
    } else if (t.role === 'user') {
      out.push({ role: 'user', content: t.text });
    } else if (t.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: t.text || null,
        ...(t.toolCalls && t.toolCalls.length
          ? {
              tool_calls: t.toolCalls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
              })),
            }
          : {}),
      });
    } else {
      for (const r of t.results) {
        out.push({ role: 'tool', tool_call_id: r.id, content: r.text });
      }
    }
  }
  return out;
}

function toAnthropic(turns: ChatTurn[]): {
  system: string;
  messages: Record<string, unknown>[];
} {
  const system = turns
    .filter((t): t is Extract<ChatTurn, { role: 'system' }> => t.role === 'system')
    .map((t) => t.text)
    .join('\n\n');
  const messages: Record<string, unknown>[] = [];
  for (const t of turns) {
    if (t.role === 'system') continue;
    if (t.role === 'user') {
      messages.push({ role: 'user', content: t.text });
    } else if (t.role === 'assistant') {
      const content: Record<string, unknown>[] = [];
      if (t.text) content.push({ type: 'text', text: t.text });
      for (const c of t.toolCalls ?? []) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args ?? {} });
      messages.push({ role: 'assistant', content });
    } else {
      messages.push({
        role: 'user',
        content: t.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.text })),
      });
    }
  }
  return { system, messages };
}

export interface AiChatOptions {
  messages: ChatTurn[];
  config?: AiConfig;
  tools?: ToolDef[];
  maxTokens?: number;
  timeoutMs?: number;
}

/** 单次对话调用（带工具时返回 toolCalls，由调用方决定是否进入循环）。 */
export async function aiChat(opts: AiChatOptions): Promise<ChatResult> {
  const cfg = await requireConfig(opts.config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);
  try {
    if (cfg.provider === 'anthropic') {
      const { system, messages } = toAnthropic(opts.messages);
      const body = {
        model: cfg.model,
        max_tokens: opts.maxTokens ?? 4096,
        ...(system ? { system } : {}),
        messages,
        ...(opts.tools && opts.tools.length
          ? {
              tools: opts.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters,
              })),
            }
          : {}),
        ...(cfg.temperature !== undefined ? { temperature: cfg.temperature } : {}),
      };
      const res = await fetch(anthropicUrl(cfg.baseUrl), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 400);
        throw new Error(`AI 请求失败 (HTTP ${res.status}): ${detail}`);
      }
      const data = (await res.json()) as {
        content?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
      };
      const blocks = data.content ?? [];
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      const toolCalls = blocks
        .filter((b) => b.type === 'tool_use' && b.id && b.name)
        .map((b) => ({ id: b.id as string, name: b.name as string, args: b.input ?? {} }));
      return { text, ...(toolCalls.length ? { toolCalls } : {}) };
    }

    // OpenAI 兼容协议（OpenAI / DeepSeek / Kimi / GLM / OpenRouter / Ollama / LM Studio…）
    const body = {
      model: cfg.model,
      messages: toOpenAI(opts.messages),
      ...(opts.tools && opts.tools.length
        ? {
            tools: opts.tools.map((t) => ({
              type: 'function',
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
            tool_choice: 'auto',
          }
        : {}),
      ...(cfg.temperature !== undefined ? { temperature: cfg.temperature } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    };
    const res = await fetch(openaiUrl(cfg.baseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 400);
      throw new Error(`AI 请求失败 (HTTP ${res.status}): ${detail}`);
    }
    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[];
        };
      }[];
    };
    const msg = data.choices?.[0]?.message ?? {};
    const toolCalls = (msg.tool_calls ?? [])
      .filter((tc) => tc.function?.name)
      .map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}') as Record<string, unknown>;
        } catch {
          args = {};
        }
        return { id: tc.id, name: tc.function?.name as string, args };
      });
    return { text: msg.content ?? '', ...(toolCalls.length ? { toolCalls } : {}) };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('AI 请求超时');
    if (e instanceof Error && /^AI 请求失败/.test(e.message)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`AI 请求失败: ${msg}（检查 baseUrl / 网络 / API Key）`);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- Agent 循环 ---------------- */

function capResult(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  return s.length > 6000 ? `${s.slice(0, 6000)}…（结果已截断）` : s;
}

export interface AgentTraceItem {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
  result: string;
  durationMs: number;
}
export interface AgentResult {
  text: string;
  trace: AgentTraceItem[];
}
export interface AiAgentOptions {
  prompt: string;
  system?: string;
  config?: AiConfig;
  maxTurns?: number;
  timeoutMs?: number;
  /** 会话历史（插在 system 之后、当前 prompt 之前；system 角色会被忽略） */
  history?: ChatTurn[];
  /** 可用工具白名单（工具名数组）；缺省 = 全部本地工具；空数组 = 纯问答不提供工具 */
  tools?: string[];
  onTool?: (item: AgentTraceItem) => void;
}

/**
 * Codex 式循环：模型决定调用哪个本地工具 → 执行 → 结果回填 → 直到给出最终答案。
 * 安全护栏：rename/organize 在 Agent 里永远 dry-run（真正执行只由人在 CLI/桌面手动确认）。
 */
export async function aiAgent(opts: AiAgentOptions): Promise<AgentResult> {
  const cfg = opts.config ?? (await loadAiConfig());
  const maxTurns = Math.max(1, Math.min(10, opts.maxTurns ?? cfg.maxTurns ?? 8));
  const trace: AgentTraceItem[] = [];
  const defs = opts.tools ? TOOL_DEFS.filter((t) => opts.tools!.includes(t.name)) : TOOL_DEFS;
  const messages: ChatTurn[] = [
    { role: 'system', text: opts.system?.trim() || DEFAULT_SYSTEM },
    ...(opts.history ?? []).filter((t) => t.role !== 'system'),
    { role: 'user', text: opts.prompt },
  ];

  let lastText = '';
  for (let turn = 0; turn < maxTurns; turn++) {
    const resp = await aiChat({
      messages,
      config: cfg,
      ...(defs.length ? { tools: defs } : {}),
      ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
    });
    if (!resp.toolCalls || resp.toolCalls.length === 0) {
      return { text: resp.text || lastText || '（模型返回空内容）', trace };
    }
    if (resp.text) lastText = resp.text;
    messages.push({ role: 'assistant', text: resp.text, toolCalls: resp.toolCalls });

    const results: { id: string; name: string; text: string }[] = [];
    for (const call of resp.toolCalls) {
      let args = { ...call.args };
      if (call.name === 'rename' || call.name === 'organize') {
        args = { ...args, dryRun: true }; // Agent 内强制预览
      }
      const started = Date.now();
      let ok = true;
      let out: string;
      try {
        out = capResult(await runTool(call.name, args));
      } catch (e) {
        ok = false;
        out = `错误: ${e instanceof Error ? e.message : String(e)}`;
      }
      const item: AgentTraceItem = {
        name: call.name,
        args,
        ok,
        result: out,
        durationMs: Date.now() - started,
      };
      trace.push(item);
      opts.onTool?.(item);
      results.push({ id: call.id, name: call.name, text: out });
    }
    messages.push({ role: 'tool', results });
  }
  return {
    text: `${lastText ? `${lastText}\n\n` : ''}（已达到最大工具轮次 ${maxTurns}，停止调用）`,
    trace,
  };
}
