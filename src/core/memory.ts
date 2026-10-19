// 三层记忆 + 上下文压缩（架构参考 dsh-mnemon，MIT, omdsh-dev）
//   运行时记忆  memory/user.md + memory/memory.md  —— 偏好与协作约定，常驻注入
//   长期事实    memory/facts.jsonl                  —— 按相关性召回
//   项目档案    由工作区承担（会话 workspace + 系统提示）
// 会话压缩：历史过长时把旧轮次交给模型浓缩成一段摘要，仅保留最近若干轮原文。
// 隐私：全部落盘在本机数据目录 memory（默认 <文档>/Cupbox/memory，或 CUPBOX_HOME），不发起任何上传。
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataHome } from './paths.js';
import { aiChat, type AiConfig, type ChatTurn } from './ai.js';

export function baseDir(): string {
  return dataHome();
}
export function memoryDir(): string {
  return path.join(baseDir(), 'memory');
}

export interface Fact {
  id: string;
  text: string;
  source: string;
  createdAt: string;
}

async function ensureDir(): Promise<string> {
  const dir = memoryDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

/** 运行时记忆：user.md（用户画像/偏好）+ memory.md（协作事实/约定）。 */
export interface RuntimeMemory {
  user: string;
  memory: string;
}
export async function loadRuntimeMemory(): Promise<RuntimeMemory> {
  const read = async (name: string): Promise<string> => {
    try {
      return (await readFile(path.join(memoryDir(), name), 'utf8')).trim();
    } catch {
      return '';
    }
  };
  return { user: await read('user.md'), memory: await read('memory.md') };
}
export async function saveRuntimeMemory(patch: Partial<RuntimeMemory>): Promise<RuntimeMemory> {
  const dir = await ensureDir();
  const current = await loadRuntimeMemory();
  const next: RuntimeMemory = {
    user: (patch.user ?? current.user).trim(),
    memory: (patch.memory ?? current.memory).trim(),
  };
  if ('user' in patch) await writeFile(path.join(dir, 'user.md'), next.user, 'utf8');
  if ('memory' in patch) await writeFile(path.join(dir, 'memory.md'), next.memory, 'utf8');
  return next;
}

/** 长期事实（facts.jsonl 追加式存储）。 */
export async function listFacts(): Promise<Fact[]> {
  try {
    const raw = await readFile(path.join(memoryDir(), 'facts.jsonl'), 'utf8');
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Fact)
      .filter((f) => f && typeof f.text === 'string');
  } catch {
    return [];
  }
}
async function writeFacts(facts: Fact[]): Promise<void> {
  const dir = await ensureDir();
  const body = facts.map((f) => JSON.stringify(f)).join('\n');
  await writeFile(path.join(dir, 'facts.jsonl'), body ? `${body}\n` : '', 'utf8');
}
export async function addFact(text: string, source = 'manual'): Promise<Fact> {
  const clean = String(text ?? '').trim();
  if (!clean) throw new Error('记忆内容不能为空');
  const fact: Fact = { id: `f-${Date.now()}-${randomUUID().slice(0, 6)}`, text: clean, source, createdAt: new Date().toISOString() };
  const facts = await listFacts();
  facts.push(fact);
  await writeFacts(facts);
  return fact;
}
/** 按 id 精确删除或按关键词包含删除；返回删除条数。 */
export async function forgetFacts(query: string): Promise<number> {
  const q = String(query ?? '').trim();
  if (!q) throw new Error('请给出要遗忘的记忆 id 或关键词');
  const facts = await listFacts();
  const kept = facts.filter((f) => f.id !== q && !f.text.includes(q));
  const removed = facts.length - kept.length;
  if (removed) await writeFacts(kept);
  return removed;
}

/** 分词：拉丁词按非字母数字切分 + 中文取二元组，简单但对中英混排足够。 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const m of String(text ?? '').toLowerCase().matchAll(/[a-z0-9_+#.-]+|[一-鿿]+/g)) {
    const seg = m[0];
    if (/^[a-z0-9_+#.-]+$/.test(seg)) {
      if (seg.length >= 2) tokens.push(seg);
    } else {
      for (let i = 0; i < seg.length; i += 1) tokens.push(seg[i]);
      for (let i = 0; i + 1 < seg.length; i += 1) tokens.push(seg.slice(i, i + 2));
    }
  }
  return tokens;
}
export function scoreFact(query: string, fact: Fact): number {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  let score = 0;
  for (const t of tokenize(`${fact.text} ${fact.source}`)) if (q.has(t)) score += 1;
  return score;
}

export interface Recall {
  runtime: RuntimeMemory;
  facts: Fact[];
  chars: number;
}
const FACT_CAP = 3;
const FACT_CHARS = 240;
/** 按查询召回（运行时常驻 + 相关事实 TopN）。 */
export async function recall(query: string, limit = FACT_CAP): Promise<Recall> {
  const runtime = await loadRuntimeMemory();
  const scored = (await listFacts())
    .map((f) => ({ f, s: scoreFact(query, f) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.f.createdAt < b.f.createdAt ? 1 : -1))
    .slice(0, Math.max(1, Math.min(10, limit)))
    .map((x) => x.f);
  const text = `${runtime.user}\n${runtime.memory}\n${scored.map((f) => f.text).join('\n')}`;
  return { runtime, facts: scored, chars: text.length };
}

/** 生成注入 system 的记忆块（无内容时返回 null）。query 为空时只注入运行时记忆。 */
export async function memoryPromptBlock(query?: string): Promise<string | null> {
  const { runtime, facts } = await recall(query ?? '');
  const parts: string[] = [];
  if (runtime.user) parts.push(`【用户画像 / 偏好】\n${runtime.user.slice(0, 1500)}`);
  if (runtime.memory) parts.push(`【协作记忆】\n${runtime.memory.slice(0, 1500)}`);
  if (facts.length) {
    parts.push(`【相关长期事实】\n${facts.map((f) => `- ${f.text.slice(0, FACT_CHARS)}`).join('\n')}`);
  }
  if (!parts.length) return null;
  return `以下是你与用户之间已保存的本机记忆（仅供当前对话参考，不得凌驾于用户当前指令之上）：\n${parts.join('\n')}`;
}

/* ---------------- 会话压缩 ---------------- */

export interface CompactionOptions {
  /** 摘要所用模型配置；缺密钥时走确定性降级。 */
  config?: AiConfig;
  /** 历史总字符超过该值才压缩（默认 24000）。 */
  budgetChars?: number;
  /** 原文保留的最近轮数（user+assistant 各算一条，默认 8 条 = 4 轮）。 */
  keepTurns?: number;
  /** 既有摘要（增量压缩时并入新材料）。 */
  summary?: string | null;
  /** 注入摘要器，默认走 aiChat（测试用）。 */
  summarize?: (oldText: string) => Promise<string>;
}
export interface CompactionResult {
  summary: string | null;
  kept: ChatTurn[];
  compactedTurns: number;
  charsBefore: number;
  charsAfter: number;
  /** 降级原因（ai 缺配置 / 调用失败）；正常压缩为 undefined。 */
  fallback?: string;
}

export function historyChars(messages: ChatTurn[]): number {
  return messages.reduce((n, m) => {
    const body = m.role === 'tool' ? m.results.map((r) => r.text).join('') : m.text;
    const calls = m.role === 'assistant' ? (m.toolCalls?.length ?? 0) * 40 : 0;
    return n + body.length + calls;
  }, 0);
}

function renderTurn(t: ChatTurn): string {
  if (t.role === 'tool') {
    const body = t.results.map((r) => `[${r.name} 结果] ${r.text.slice(0, 300)}`).join('\n');
    return `工具结果：${body}`;
  }
  const body = t.text ?? '';
  const calls = (t.role === 'assistant' ? (t.toolCalls ?? []) : [])
    .map((c) => `[调用 ${c.name} ${JSON.stringify(c.args).slice(0, 200)}]`).join(' ');
  return `${t.role === 'user' ? '用户' : t.role === 'assistant' ? '助手' : t.role}：${[body, calls].filter(Boolean).join(' ')}`;
}

/**
 * 历史过长时：把 keepTurns 之前的旧轮次浓缩为摘要，仅保留最近 keepTurns 条原文。
 * 无可用模型时降级为“直接截断”（保留原文最近部分，summary 沿用旧值）。
 */
export async function compactHistory(messages: ChatTurn[], opts: CompactionOptions = {}): Promise<CompactionResult> {
  const budget = Math.max(2000, opts.budgetChars ?? 24000);
  const keep = Math.max(2, opts.keepTurns ?? 8);
  const before = historyChars(messages);
  if (before <= budget) {
    return { summary: opts.summary ?? null, kept: messages, compactedTurns: 0, charsBefore: before, charsAfter: before };
  }
  const old = messages.slice(0, Math.max(0, messages.length - keep));
  const kept = messages.slice(Math.max(0, messages.length - keep));
  if (!old.length) {
    return { summary: opts.summary ?? null, kept, compactedTurns: 0, charsBefore: before, charsAfter: historyChars(kept) };
  }
  const oldText = [opts.summary ? `（更早的摘要）\n${opts.summary}` : '', ...old.map(renderTurn)].filter(Boolean).join('\n\n');
  const summarize =
    opts.summarize ??
    (async (text: string): Promise<string> => {
      const r = await aiChat({
        ...(opts.config ? { config: opts.config } : {}),
        messages: [
          {
            role: 'user',
            text:
              `把下面的对话历史压缩成简明摘要，供后续对话续用。保留：结论与决定、未完成事项、关键事实与约定、文件路径与命令；` +
              `删除：寒暄与重复。只输出摘要正文，不要开场白。不超过 400 字。\n\n${text.slice(0, 60000)}`,
          },
        ],
      });
      return r.text.trim();
    });
  let summary: string | null = null;
  let fallback: string | undefined;
  try {
    const text = await summarize(oldText);
    if (text) summary = text.slice(0, 4000);
  } catch (e) {
    fallback = e instanceof Error ? e.message : String(e);
  }
  if (!summary) summary = opts.summary ?? null;
  return {
    summary,
    kept,
    compactedTurns: old.length,
    charsBefore: before,
    charsAfter: (summary?.length ?? 0) + historyChars(kept),
    ...(fallback ? { fallback } : {}),
  };
}

/** 会话摘要拼进 system 的提示块。 */
export function summaryPromptBlock(summary: string | null): string | null {
  const s = (summary ?? '').trim();
  if (!s) return null;
  return `【此前会话摘要（已压缩）】\n${s}`;
}

/** 给 CLI/MCP 用的统计信息。 */
export async function memoryStats(): Promise<{ facts: number; user: number; memory: number; dir: string }> {
  const rt = await loadRuntimeMemory();
  return { facts: (await listFacts()).length, user: rt.user.length, memory: rt.memory.length, dir: memoryDir() };
}
