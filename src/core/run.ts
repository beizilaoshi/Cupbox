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
