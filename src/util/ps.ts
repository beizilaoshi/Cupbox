import { runCommand, type RunResult } from './platform.js';

/** 把字符串转成 PowerShell -EncodedCommand 需要的 UTF-16LE Base64（彻底避开引号转义坑）。 */
export function toPsEncoded(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

/** 把任意字符串安全嵌入 PowerShell 脚本（Base64 往返，无转义问题）。 */
export function psStringLiteral(s: string): string {
  return `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(s, 'utf8').toString('base64')}'))`;
}

/** 以指定编码写好控制台输出编码，保证中文不乱码。 */
export const PS_UTF8_HEADER = "$OutputEncoding=[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;";

/** 执行一段 PowerShell 脚本（-EncodedCommand 方式，无引号/空格/中文转义问题）。 */
export async function runPowerShell(
  script: string,
  opts: { timeoutMs?: number } = {},
): Promise<RunResult> {
  const encoded = toPsEncoded(`${PS_UTF8_HEADER}\n${script}`);
  return runCommand('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    timeoutMs: opts.timeoutMs ?? 60_000,
  });
}
