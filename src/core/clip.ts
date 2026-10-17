import { isWindows, which, runCommand } from '../util/platform.js';
import { runPowerShell, psStringLiteral } from '../util/ps.js';

export interface ClipResult {
  ok: boolean;
  content?: string;
  backend: string;
  message?: string;
}

async function linuxBackend(): Promise<{ write: string[]; read: string[] } | null> {
  if (await which('wl-copy')) {
    return { write: ['wl-copy'], read: ['wl-paste', '--no-newline'] };
  }
  if (await which('xclip')) {
    return { write: ['xclip', '-selection', 'clipboard', '-in'], read: ['xclip', '-selection', 'clipboard', '-out'] };
  }
  if (await which('xsel')) {
    return { write: ['xsel', '--input', '--clipboard'], read: ['xsel', '--output', '--clipboard'] };
  }
  return null;
}

/** 读取剪贴板文本。 */
export async function clipRead(): Promise<ClipResult> {
  if (isWindows()) {
    const r = await runPowerShell('Get-Clipboard -Raw', { timeoutMs: 10_000 });
    if (r.code !== 0) throw new Error(`读取剪贴板失败: ${r.stderr.trim()}`);
    // PowerShell 输出末尾常带 CRLF
    return { ok: true, content: r.stdout.replace(/\r\n$/, '').replace(/\n$/, ''), backend: 'powershell' };
  }
  if (process.platform === 'darwin') {
    const r = await runCommand('pbpaste', [], { timeoutMs: 10_000 });
    if (r.code !== 0) throw new Error(`pbpaste 失败: ${r.stderr.trim()}`);
    return { ok: true, content: r.stdout, backend: 'pbpaste' };
  }
  const b = await linuxBackend();
  if (!b) throw new Error('未找到剪贴板工具（安装 wl-clipboard 或 xclip/xsel）');
  const [cmd, ...args] = b.read;
  const r = await runCommand(cmd, args, { timeoutMs: 10_000 });
  if (r.code !== 0) throw new Error(`${cmd} 读取失败: ${r.stderr.trim()}`);
  return { ok: true, content: r.stdout, backend: cmd };
}

/** 写入剪贴板文本。 */
export async function clipWrite(text: string): Promise<ClipResult> {
  if (isWindows()) {
    const script = `Set-Clipboard -Value ${psStringLiteral(text)}`;
    const r = await runPowerShell(script, { timeoutMs: 10_000 });
    if (r.code !== 0) throw new Error(`写入剪贴板失败: ${r.stderr.trim()}`);
    return { ok: true, backend: 'powershell', message: `已写入 ${text.length} 字符` };
  }
  if (process.platform === 'darwin') {
    const r = await runCommand('pbcopy', [], { timeoutMs: 10_000, input: text });
    if (r.code !== 0) throw new Error(`pbcopy 失败: ${r.stderr.trim()}`);
    return { ok: true, backend: 'pbcopy', message: `已写入 ${text.length} 字符` };
  }
  const b = await linuxBackend();
  if (!b) throw new Error('未找到剪贴板工具（安装 wl-clipboard 或 xclip/xsel）');
  const [cmd, ...args] = b.write;
  const r = await runCommand(cmd, args, { timeoutMs: 10_000, input: text });
  if (r.code !== 0) throw new Error(`${cmd} 写入失败: ${r.stderr.trim()}`);
  return { ok: true, backend: cmd, message: `已写入 ${text.length} 字符` };
}
