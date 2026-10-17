import { platform } from 'node:os';

export type Platform = 'win32' | 'darwin' | 'linux' | 'other';

export function currentPlatform(): Platform {
  const p = platform();
  if (p === 'win32' || p === 'darwin' || p === 'linux') return p;
  return 'other';
}

export function isWindows(): boolean {
  return currentPlatform() === 'win32';
}

export function isMac(): boolean {
  return currentPlatform() === 'darwin';
}

export function isLinux(): boolean {
  return currentPlatform() === 'linux';
}

/** Run a command and capture stdout/stderr. Never throws on non-zero exit. */
export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export async function runCommand(
  cmd: string,
  args: string[],
  opts: { input?: string; timeoutMs?: number; shell?: boolean; cwd?: string } = {},
): Promise<RunResult> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      shell: opts.shell ?? false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(opts.cwd ? { cwd: opts.cwd } : {}),
    });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let timedOut = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          if (isWindows() && child.pid !== undefined) {
            // Windows 上必须杀整棵进程树，否则孙进程持有管道导致挂起
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {});
          } else {
            child.kill('SIGTERM');
            const force = setTimeout(() => child.kill('SIGKILL'), 2000);
            force.unref?.();
          }
        }, opts.timeoutMs)
      : null;
    child.stdout.on('data', (d: Buffer) => outChunks.push(d));
    child.stderr.on('data', (d: Buffer) => errChunks.push(d));
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout: decodeOut(outChunks), stderr: decodeOut(errChunks), timedOut });
    });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: -1, stdout: decodeOut(outChunks), stderr: String(err), timedOut });
    });
    if (opts.input !== undefined) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}

/**
 * 输出解码：UTF-8 优先；Windows 上解出替换符（U+FFFD）时按系统代码页（中文 Windows 为 GBK）兜底重解。
 * tasklist、tar 等系统自带工具在中文 Windows 上按控制台代码页输出非 ASCII 文件名/进程名。
 */
function decodeOut(chunks: Buffer[]): string {
  if (chunks.length === 0) return '';
  const buf = Buffer.concat(chunks);
  const utf8 = buf.toString('utf8');
  if (isWindows() && utf8.includes('\uFFFD')) {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

/** Check whether a command exists on PATH (returns the resolved path or null). */
export async function which(cmd: string): Promise<string | null> {
  const probe = isWindows() ? 'where' : 'which';
  const r = await runCommand(probe, [cmd], { timeoutMs: 5000 });
  if (r.code === 0 && r.stdout.trim()) return r.stdout.trim().split(/\r?\n/)[0];
  return null;
}
