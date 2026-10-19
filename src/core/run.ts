import { runCommand } from '../util/platform.js';

export interface SafeRunOptions {
  /** 允许的命令前缀白名单；为空表示不限制（仍受超时/输出截断保护） */
  allowPrefixes?: string[];
  /** 超时毫秒，默认 60_000，上限 600_000 */
  timeoutMs?: number;
  cwd?: string;
  /** 最大捕获输出字符数，默认 100_000 */
  maxOutputChars?: number;
}

export interface SafeRunResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
  timedOut: boolean;
  durationMs: number;
}

function splitCommand(cmd: string): { head: string; rest: string } {
  const t = cmd.trim();
  const m = t.match(/^"?([^"\s]+)"?\s*/);
  if (!m) return { head: t, rest: '' };
  return { head: m[1].replace(/\\/g, '\\\\'), rest: t.slice(m[0].length) };
}

/**
 * 白名单模式专用的注入扫描（带引号状态机）：
 * 拒绝命令中的 shell 元字符，否则 `npm i; rm -rf /` 只要首 token 是 `npm`
 * 就能通过前缀白名单、却由 shell 执行整串。
 * 返回首个危险字符；引号不配对返回 'unbalanced-quote'；安全返回 null。
 */
export function findUnsafeShellChars(cmd: string): string | null {
  let quote: 'none' | 'single' | 'double' = 'none';
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote === 'single') {
      if (ch === "'") quote = 'none';
      continue; // 单引号内一律字面量
    }
    if (quote === 'double') {
      if (ch === '"') {
        quote = 'none';
        continue;
      }
      if (ch === '`' || ch === '$') return ch; // 双引号内仍会做命令替换 / 变量展开
      continue;
    }
    if (ch === "'") {
      quote = 'single';
      continue;
    }
    if (ch === '"') {
      quote = 'double';
      continue;
    }
    if (';|&<>`$()\n\r'.includes(ch)) return ch;
    if (ch === '%') {
      // cmd.exe 变量展开 %VAR%（单个 % 是字面量，如 URL 里的 %20）
      if (/^[A-Za-z_][A-Za-z0-9_]*%/.test(cmd.slice(i + 1))) return ch;
    }
  }
  return quote === 'none' ? null : 'unbalanced-quote';
}

/**
 * 受保护的命令执行：白名单前缀 + 超时 + 输出截断。
 * 设计目标是给 AI agent 用——防失控、防刷屏。
 */
export async function safeRun(command: string, opts: SafeRunOptions = {}): Promise<SafeRunResult> {
  const trimmed = command.trim();
  if (!trimmed) throw new Error('command 不能为空');

  const prefixes = (opts.allowPrefixes ?? []).map((p) => p.trim()).filter(Boolean);
  if (prefixes.length > 0) {
    const { head, rest } = splitCommand(trimmed);
    const ok = prefixes.some((p) => {
      const ph = splitCommand(p);
      if (ph.head.toLowerCase() !== head.toLowerCase()) return false;
      if (!ph.rest) return true;
      return rest.startsWith(ph.rest);
    });
    if (!ok) {
      throw new Error(
        `命令不在允许列表内。允许的前缀: ${prefixes.join(' | ')}；收到: ${trimmed}`,
      );
    }
    // 白名单生效时追加防注入扫描（白名单只匹配首 token，整串仍交给 shell 执行）
    const unsafe = findUnsafeShellChars(trimmed);
    if (unsafe) {
      throw new Error(
        unsafe === 'unbalanced-quote'
          ? `白名单模式下命令引号不配对，拒绝执行: ${trimmed}`
          : `白名单模式下禁止 shell 元字符（防注入）: 发现“${unsafe}”，拒绝执行: ${trimmed}。如需管道或重定向，请由人工在 CLI 不加白名单运行。`,
      );
    }
  }

  const timeoutMs = Math.min(opts.timeoutMs ?? 60_000, 600_000);
  const maxChars = opts.maxOutputChars ?? 100_000;
  const started = Date.now();
  const r = await runCommand(trimmed, [], { shell: true, timeoutMs, ...(opts.cwd ? { cwd: opts.cwd } : {}) });

  let stdout = r.stdout;
  let stderr = r.stderr;
  let truncated = false;
  if (stdout.length > maxChars) {
    stdout = stdout.slice(0, maxChars) + `\n…（输出已截断，原长 ${r.stdout.length} 字符）`;
    truncated = true;
  }
  if (stderr.length > maxChars) {
    stderr = stderr.slice(0, maxChars) + `\n…（错误输出已截断，原长 ${r.stderr.length} 字符）`;
    truncated = true;
  }

  return {
    command: trimmed,
    exitCode: r.code,
    stdout,
    stderr,
    truncated,
    timedOut: r.timedOut,
    durationMs: Date.now() - started,
  };
}
