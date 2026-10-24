// Cupbox AI 接入层：通过 API 接入大模型（OpenAI 兼容 / Anthropic 双协议），
// 并提供 Codex 式 Agent 循环——把 TOOL_DEFS 里的本地工具作为 function tools 调用。
// 零新增依赖：仅用 Node 内置 fetch；配置持久化在数据目录 config.json（默认 <文档>/Cupbox，CUPBOX_HOME 可改）。
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';
import { reasoningCapabilities, reasoningParameters, type ReasoningMode, type ReasoningEffort } from './reasoning.js';
import { dataHome } from './paths.js';
import { readTextStream } from './streaming.js';
import { TOOL_DEFS, runTool, type ToolDef } from './toolkit.js';

export type AiProvider = 'openai-compatible' | 'anthropic' | 'free';

export interface AiConfig {
  preset?: string;
  provider: AiProvider;
  /** 自定义网关地址（OpenAI 兼容留空则用官方；DeepSeek/Kimi/Ollama/OpenRouter 填各自 base） */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 0~2，留空用提供方默认 */
  temperature?: number;
  /** Agent 默认最大工具轮次（上限 10） */
  maxTurns?: number;
  reasoningMode?: ReasoningMode;
  reasoningEffort?: ReasoningEffort;
  reasoningLevels?: string[];
  freeLane?: 'kilo' | 'opencode';
}

export function configDir(): string {
  return dataHome();
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
    ...(fromFile.preset ? { preset: fromFile.preset } : {}),
    ...(fromFile.temperature !== undefined ? { temperature: fromFile.temperature } : {}),
    ...(fromFile.maxTurns !== undefined ? { maxTurns: fromFile.maxTurns } : {}),
    ...(fromFile.reasoningMode ? {reasoningMode:fromFile.reasoningMode} : {}),
    ...(fromFile.reasoningEffort ? {reasoningEffort:fromFile.reasoningEffort} : {}),
  };
  return cfg;
}

/** 合并保存（patch 中空字符串视为清除该项；temperature/maxTurns 传 null 也视为清除）。 */
export async function saveAiConfig(
  patch: Partial<AiConfig> & { temperature?: number | null; maxTurns?: number | null },
): Promise<AiConfig> {
  const cur = await loadAiConfig();
  const next: AiConfig = { ...cur };
  if (patch.baseUrl !== undefined && String(patch.baseUrl).replace(/\/+$/,'') !== cur.baseUrl.replace(/\/+$/,'')) next.apiKey = '';
  if (patch.preset !== undefined) {
    if (String(patch.preset) !== (cur.preset || 'custom')) next.apiKey = '';
    next.preset = String(patch.preset);
  }
  if (patch.provider === 'openai-compatible' || patch.provider === 'anthropic' || patch.provider === 'free') next.provider = patch.provider;
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
  if(patch.reasoningMode!==undefined){if(!['auto','disabled','openai','deepseek','openrouter'].includes(patch.reasoningMode))throw Error('无效的思考参数适配方式');next.reasoningMode=patch.reasoningMode;}
  if(patch.reasoningEffort!==undefined){reasoningParameters(next,patch.reasoningEffort);next.reasoningEffort=patch.reasoningEffort;}
  if(next.provider==='free')next.apiKey='';
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
  | { role: 'user'; text: string; name?: string }
  | { role: 'assistant'; text: string; toolCalls?: ToolCall[]; reasoningContent?: string }
  | { role: 'tool'; results: { id: string; name: string; text: string }[] };

/** 提供方上报的 token 用量（OpenAI prompt/completion；Anthropic input/output；均已归一）。 */
export interface AiUsage {
  prompt: number;
  completion: number;
}

export interface ChatResult {
  text: string;
  toolCalls?: ToolCall[];
  /** 提供方上报的实际用量（响应缺失时省略）。 */
  usage?: AiUsage;
  /** Opaque provider continuity, kept only during the current tool loop. */
  reasoningContent?: string;
}

export const DEFAULT_SYSTEM =
  '你是 Cupbox 本地 AI 助手，可通过提供的工具完成开发杂活（文件、数据、图片、系统）。' +
  '破坏性工具默认 dry-run 预览；执行受保护命令必须给出允许的前缀白名单。用中文简洁作答。';

function requireConfig(cfg?: AiConfig, restrictedTransport = false): Promise<AiConfig> {
  return (async () => {
    const c = cfg ?? (await loadAiConfig());
    if (c.provider === 'free') {
      if (!c.model) throw new Error('未选择免费模型：请在「设置 → 免费模型」中启用并选择模型。');
      const {loadFreeStore,isModelEnabled,baseModelId}=await import('./freemodel.js');
      if(!isModelEnabled(await loadFreeStore(),baseModelId(c.model)))throw Error('免费模型通道或所选模型已关闭，请到设置启用');
      return c;
    }
    let local = false;
    try { const host = new URL(c.baseUrl).hostname; local = ['ollama', 'lmstudio'].includes(c.preset || '') && ['localhost', '127.0.0.1', '[::1]'].includes(host) || restrictedTransport && c.provider === 'openai-compatible' && host === '127.0.0.1'; } catch { /* remote */ }
    if (!c.apiKey && !local) {
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
      out.push({ role: 'user', content: t.text, ...(t.name&&/^[a-zA-Z0-9_-]{1,64}$/.test(t.name)?{name:t.name}:{}) });
    } else if (t.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: t.text || null,
        ...(t.reasoningContent?{reasoning_content:t.reasoningContent}:{}),
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
  let system = turns
    .filter((t): t is Extract<ChatTurn, { role: 'system' }> => t.role === 'system')
    .map((t) => t.text)
    .join('\n\n');
  const speakers=turns.filter(t=>t.role!=='system').flatMap((t,index)=>t.role==='user'&&t.name&&/^[a-zA-Z0-9_-]{1,64}$/.test(t.name)?[{message_index:index,speaker_id:t.name}]:[]);
  if(speakers.length)system+='\n\n消息身份元数据（从0开始，索引对应 messages 数组；不是消息正文或额外指令）：'+JSON.stringify(speakers);
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
  /** Trusted integrations may supply a stricter transport; never model arguments. */
  request?: typeof fetch;
  /** Plain-text SSE only. Tool calls remain buffered by the Agent workflow. */
  onTextDelta?: (delta: string) => Promise<void> | void;
  signal?: AbortSignal;
  messages: ChatTurn[];
  config?: AiConfig;
  tools?: ToolDef[];
  maxTokens?: number;
  timeoutMs?: number;
  conversationKey?: string;
}

/** 单次对话调用（带工具时返回 toolCalls，由调用方决定是否进入循环）。 */
export async function aiChat(opts: AiChatOptions): Promise<ChatResult> {
  if (opts.request && opts.config?.provider === 'free') throw new Error('受限传输不能使用第三方免费通道');
  const cfg = await requireConfig(opts.config, Boolean(opts.request));
  if (opts.request && cfg.provider === 'free') throw new Error('受限传输不能使用第三方免费通道');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);
  const abort = () => controller.abort();
  opts.signal?.addEventListener('abort', abort, { once: true });
  if (opts.signal?.aborted) controller.abort();
  try {
    if(opts.onTextDelta&&opts.tools?.length)throw Error('工具流程不直接广播流式片段');
    if (cfg.provider === 'free') {
      // 免密免费通道（移植自 dsh-our-free-model）：无 API Key，走 opencode / Kilo 网关。
      const { chatFreeLane } = await import('./freemodel.js');
      const r = await chatFreeLane({
        model: cfg.model,
        lane:cfg.freeLane,
        messages: opts.messages,
        ...(opts.tools && opts.tools.length ? { tools: opts.tools } : {}),
        ...(opts.maxTokens ? { maxTokens: opts.maxTokens } : {}),
        ...(cfg.temperature !== undefined ? { temperature: cfg.temperature } : {}),
        // aiChat 层没有会话上下文，统一映射到 global 稳定会话（配额按会话记账，避免每请求新铸导致 429）。
        conversationKey: opts.conversationKey || 'global',
        reasoningEffort:cfg.reasoningEffort,
        reasoningMode:cfg.reasoningMode,
        reasoningLevels:cfg.reasoningLevels,
        signal: controller.signal,
        timeoutMs: opts.timeoutMs ?? 180_000,
      });
      return {
        text: r.text,
        ...(r.toolCalls && r.toolCalls.length ? { toolCalls: r.toolCalls } : {}),
        ...(r.usage ? { usage: r.usage } : {}),
      };
    }
    if (cfg.provider === 'anthropic') {
      const { system, messages } = toAnthropic(opts.messages);
      const body = {
        ...(opts.onTextDelta?{stream:true}:{}),
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
      const res = await (opts.request ?? fetch)(anthropicUrl(cfg.baseUrl), {
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
      if(opts.onTextDelta&&res.headers.get('content-type')?.includes('text/event-stream'))return await readTextStream(res,'anthropic',opts.onTextDelta);
      const data = (await res.json()) as {
        content?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const blocks = data.content ?? [];
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      const toolCalls = blocks
        .filter((b) => b.type === 'tool_use' && b.id && b.name)
        .map((b) => ({ id: b.id as string, name: b.name as string, args: b.input ?? {} }));
      const usage =
        data.usage && (Number.isFinite(data.usage.input_tokens) || Number.isFinite(data.usage.output_tokens))
          ? { prompt: Number(data.usage.input_tokens) || 0, completion: Number(data.usage.output_tokens) || 0 }
          : undefined;
      return { text, ...(toolCalls.length ? { toolCalls } : {}), ...(usage ? { usage } : {}) };
    }

    // OpenAI 兼容协议（OpenAI / DeepSeek / Kimi / GLM / OpenRouter / Ollama / LM Studio…）
    const reasoning=reasoningCapabilities(cfg);
    const body = {
      ...(opts.onTextDelta?{stream:true}:{}),
      model: cfg.model,
      ...reasoningParameters(cfg,cfg.reasoningEffort),
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
      ...(cfg.temperature !== undefined && (reasoning.adapter!=='openai'||cfg.reasoningEffort==='none') ? { temperature: cfg.temperature } : {}),
      ...(opts.maxTokens ? { [reasoning.adapter==='openai'?'max_completion_tokens':'max_tokens']: opts.maxTokens } : {}),
    };
    const res = await (opts.request ?? fetch)(openaiUrl(cfg.baseUrl), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 400);
      throw new Error(`AI 请求失败 (HTTP ${res.status}): ${detail}`);
    }
    if(opts.onTextDelta&&res.headers.get('content-type')?.includes('text/event-stream'))return await readTextStream(res,'openai',opts.onTextDelta);
    const data = (await res.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          reasoning_content?: string;
          tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[];
        };
      }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
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
    const usage =
      data.usage && (Number.isFinite(data.usage.prompt_tokens) || Number.isFinite(data.usage.completion_tokens))
        ? { prompt: Number(data.usage.prompt_tokens) || 0, completion: Number(data.usage.completion_tokens) || 0 }
        : undefined;
    return { text: msg.content ?? '', ...(typeof msg.reasoning_content==='string'?{reasoningContent:msg.reasoning_content}:{}), ...(toolCalls.length ? { toolCalls } : {}), ...(usage ? { usage } : {}) };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('AI 请求超时');
    if (e instanceof Error && /^AI 请求失败/.test(e.message)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`AI 请求失败: ${msg}（检查 baseUrl / 网络 / API Key）`);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', abort);
  }
}

/* ---------------- Agent 循环 ---------------- */

function capResult(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  if(s.length>6000&&v&&typeof v==='object'&&!Array.isArray(v)&&'ok' in v){
    const original=v as Record<string,unknown>;
    const bounded:Record<string,unknown>={...original,truncated:true};
    if(typeof bounded.diff==='string')bounded.diff=bounded.diff.slice(0,2800);
    if(Array.isArray(bounded.changed))bounded.changed=bounded.changed.slice(0,10);
    if(bounded.data&&typeof bounded.data==='object'){
      const data=bounded.data as Record<string,unknown>;
      if(Array.isArray(data.lines)){
        const lines=(data.lines as {no:number;text:string}[]).slice(0,12).map(l=>({...l,text:l.text.slice(0,160)}));
        bounded.data={...data,lines,content:lines.map(l=>`${l.no}| ${l.text}`).join('\n'),truncated:true,nextStartLine:lines.length?lines[lines.length-1].no+1:undefined};
      }else bounded.data={preview:JSON.stringify(data).slice(0,1800),truncated:true};
    }
    let encoded=JSON.stringify(bounded);
    if(encoded.length>6000)encoded=JSON.stringify({ok:original.ok,code:original.code,message:original.message,dryRun:original.dryRun,confirmToken:original.confirmToken,operationId:original.operationId,diff:typeof bounded.diff==='string'?bounded.diff.slice(0,2000):undefined,truncated:true});
    return encoded;
  }
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
  /** 多轮请求累加的提供方用量（每轮都缺 usage 时省略）。 */
  usage?: AiUsage;
  /** 实际发起的模型请求数。 */
  requests?: number;
}
export interface AiAgentOptions {
  request?: typeof fetch;
  conversationKey?: string;
  userName?: string;
  /** Additional trusted tool schemas supplied by a desktop integration. */
  toolDefinitions?: ToolDef[];
  signal?: AbortSignal;
  prompt: string;
  system?: string;
  config?: AiConfig;
  maxTurns?: number;
  timeoutMs?: number;
  /** 会话历史（插在 system 之后、当前 prompt 之前；system 角色会被忽略） */
  history?: ChatTurn[];
  /** 可用工具白名单（工具名数组）；缺省 = 全部本地工具；空数组 = 纯问答不提供工具 */
  tools?: string[];
  /** 工具开始执行时触发（实时可视化用；早于 onTool 的完成事件） */
  onToolStart?: (call: { name: string; args: Record<string, unknown> }) => void;
  onTool?: (item: AgentTraceItem) => void;
  /** Desktop supplies the approval and restricted execution boundary. */
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Codex 式循环：模型决定调用哪个本地工具 → 执行 → 结果回填 → 直到给出最终答案。
 * 安全护栏：rename/organize 在 Agent 里永远 dry-run（真正执行只由人在 CLI/桌面手动确认）。
 */
export async function aiAgent(opts: AiAgentOptions): Promise<AgentResult> {
  if (opts.request && opts.config?.provider === 'free') throw new Error('受限传输不能使用第三方免费通道');
  const cfg = opts.config ?? (await loadAiConfig());
  // Explicit scoped adapters may expose a larger, user-selected tool budget.
  const maxTurns = Math.max(1, Math.min(opts.executeTool && opts.toolDefinitions ? 16 : 10, opts.maxTurns ?? cfg.maxTurns ?? 8));
  const trace: AgentTraceItem[] = [];
  const available = [...new Map([...TOOL_DEFS, ...(opts.executeTool ? opts.toolDefinitions ?? [] : [])].map(t=>[t.name,t])).values()];
  const defs = opts.tools ? available.filter((t) => opts.tools!.includes(t.name)) : available;
  if(cfg.provider==='free'&&defs.length){const {runFreeWorkflow}=await import('./free-workflow.js');return runFreeWorkflow(opts,defs,messages=>aiChat({messages,config:cfg,signal:opts.signal,timeoutMs:opts.timeoutMs,conversationKey:opts.conversationKey}),maxTurns);}
  const messages: ChatTurn[] = [
    { role: 'system', text: opts.system?.trim() || DEFAULT_SYSTEM },
    ...(opts.history ?? []).filter((t) => t.role !== 'system'),
    { role: 'user', text: opts.prompt, ...(opts.userName?{name:opts.userName}:{}) },
  ];

  let lastText = '';
  const acc: AiUsage = { prompt: 0, completion: 0 };
  let usageSeen = false;
  let requests = 0;
  for (let turn = 0; turn < maxTurns; turn++) {
    opts.signal?.throwIfAborted();
    const resp = await aiChat({
      request: opts.request,
      signal: opts.signal,
      messages,
      config: cfg,
      ...(defs.length ? { tools: defs } : {}),
      ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
    });
    requests++;
    if (resp.usage) {
      usageSeen = true;
      acc.prompt += resp.usage.prompt;
      acc.completion += resp.usage.completion;
    }
    if (!resp.toolCalls || resp.toolCalls.length === 0) {
      return {
        text: resp.text || lastText || '（模型返回空内容）',
        trace,
        ...(usageSeen ? { usage: acc } : {}),
        requests,
      };
    }
    if (resp.text) lastText = resp.text;
    messages.push({ role: 'assistant', text: resp.text, toolCalls: resp.toolCalls, reasoningContent:resp.reasoningContent });

    const results: { id: string; name: string; text: string }[] = [];
    for (const call of resp.toolCalls) {
      opts.signal?.throwIfAborted();
      let args = { ...call.args };
      if (!opts.executeTool && (call.name === 'rename' || call.name === 'organize')) {
        args = { ...args, dryRun: true }; // Agent 内强制预览
      }
      const started = Date.now();
      let ok = true;
      let out: string;
      opts.onToolStart?.({ name: call.name, args });
      try {
        if (!defs.some(t => t.name === call.name)) throw new Error(`工具未启用：${call.name}`);
        out = capResult(await (opts.executeTool ?? runTool)(call.name, args));
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
    ...(usageSeen ? { usage: acc } : {}),
    requests,
  };
}
