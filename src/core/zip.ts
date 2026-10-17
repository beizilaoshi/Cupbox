import path from 'node:path';
import { access, mkdir, stat, open, rm } from 'node:fs/promises';
import { runCommand, which, isWindows } from '../util/platform.js';

export interface ZipCreateOptions {
  /** 要打包的目录或文件（可多个） */
  sources: string[];
  /** 输出 zip 路径 */
  output: string;
  /** 打包进 zip 时的根目录名（可选，不给则平铺源内容） */
  chdir?: string;
}

export interface ZipResult {
  ok: boolean;
  output: string;
  message: string;
}

async function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false,
  );
}

/**
 * 创建 zip：优先用系统自带的 tar（Windows 10+/macOS 自带 bsdtar，支持 UTF-8 文件名），
 * 其次 PowerShell Compress-Archive（Windows），最后 zip 命令（Linux/macOS）。
 */
export async function zipCreate(opts: ZipCreateOptions): Promise<ZipResult> {
  for (const s of opts.sources) {
    if (!(await exists(s))) throw new Error(`源不存在: ${s}`);
  }
  const out = path.resolve(opts.output);
  if (!out.toLowerCase().endsWith('.zip')) throw new Error('输出文件名需以 .zip 结尾');

  // Windows：优先 PowerShell/.NET（写 UTF-8 文件名 + Unicode 标志位）。
  // 系统自带 tar 按本机 ANSI 代码页编码文件名——中文 Windows 上是 GBK，
  // 英文系统（CP1252）上非 ASCII 全变 '?'，且不设 UTF-8 标志，跨语言环境必坏。
  if (isWindows() && !opts.chdir) {
    const psSources = opts.sources.map((s) => `'${path.resolve(s).replace(/'/g, "''")}'`).join(',');
    const script = `$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; Compress-Archive -Force -Path ${psSources} -DestinationPath '${out.replace(/'/g, "''")}'`;
    const r = await runCommand('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeoutMs: 120000,
    });
    if (r.code === 0) return { ok: true, output: out, message: 'Compress-Archive 打包完成' };
    throw new Error(`打包失败: ${r.stderr.trim() || r.stdout.trim()}`);
  }

  // 公共基准目录：让包内是干净相对路径（不含盘符/绝对路径前缀）
  let base: string | null = null;
  let rels: string[] = [];
  if (!opts.chdir) {
    const abs = opts.sources.map((s) => path.resolve(s));
    const dirs = abs.map((a) => path.dirname(a));
    const segsList = dirs.map((d) => d.split(/[\\/]+/).filter(Boolean));
    let common = segsList[0];
    for (const segs of segsList.slice(1)) {
      let i = 0;
      while (i < common.length && i < segs.length && segs[i].toLowerCase() === common[i].toLowerCase()) i++;
      common = common.slice(0, i);
    }
    let candidate: string | null = common.length ? common.join(path.sep) : null;
    if (candidate !== null && /^[A-Za-z]:$/.test(candidate)) candidate += path.sep; // 'C:' → 'C:\'
    else if (candidate !== null && dirs[0].startsWith(path.sep)) candidate = path.sep + candidate; // POSIX 根
    if (candidate !== null) {
      const rs = abs.map((a) => path.relative(candidate!, a));
      if (rs.every((r) => r && !r.startsWith('..') && !path.isAbsolute(r))) {
        base = candidate;
        rels = rs;
      }
    }
    if (base === null) rels = abs; // 跨盘符等无法相对化 → 退回绝对路径
  }

  const tar = await which('tar');
  if (tar) {
    const args = ['-a', '-cf', out];
    if (opts.chdir) args.push('-C', path.resolve(opts.chdir), ...opts.sources);
    else if (base) args.push('-C', base, ...rels);
    else args.push(...rels);
    const r = await runCommand('tar', args, { timeoutMs: 120000 });
    if (r.code === 0 && (await hasZipMagic(out))) return { ok: true, output: out, message: 'tar 打包完成' };
    // GNU tar 不认 .zip（可能产出非 zip 或直接失败）→ 清掉产物，落到下面的 fallback
    await rm(out, { force: true }).catch(() => {});
  }

  if (isWindows()) {
    const psSources = opts.sources.map((s) => `'${path.resolve(s).replace(/'/g, "''")}'`).join(',');
    const script = `$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; Compress-Archive -Force -Path ${psSources} -DestinationPath '${out.replace(/'/g, "''")}'`;
    const r = await runCommand('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeoutMs: 120000,
    });
    if (r.code === 0) return { ok: true, output: out, message: 'Compress-Archive 打包完成' };
    throw new Error(`打包失败: ${r.stderr.trim() || r.stdout.trim()}`);
  }

  const zipBin = await which('zip');
  if (!zipBin) throw new Error('未找到可用的打包工具（tar / zip / Compress-Archive）');
  const zipCwd = opts.chdir ? path.resolve(opts.chdir) : base ?? undefined;
  const operands = opts.chdir ? opts.sources : rels;
  const r = await runCommand('zip', ['-r', out, ...operands], { timeoutMs: 120000, cwd: zipCwd });
  if (r.code !== 0) throw new Error(`zip 打包失败: ${r.stderr.trim()}`);
  return { ok: true, output: out, message: 'zip 打包完成' };
}

/** 读文件头判断是否真 zip（'PK' 魔数）。 */
async function hasZipMagic(p: string): Promise<boolean> {
  try {
    const fh = await open(p, 'r');
    try {
      const buf = Buffer.alloc(4);
      const { bytesRead } = await fh.read(buf, 0, 4, 0);
      return bytesRead >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }
}

/** 解压 zip 到目标目录（tar -x 跨平台可用，天然支持 UTF-8 文件名）。 */
export async function zipExtract(zipFile: string, destDir: string): Promise<ZipResult> {
  if (!(await exists(zipFile))) throw new Error(`压缩包不存在: ${zipFile}`);
  await mkdir(destDir, { recursive: true });
  const absZip = path.resolve(zipFile);
  const absDest = path.resolve(destDir);

  // Windows：优先 .NET 解压（读 UTF-8 标志位文件名），与 zipCreate 保持一致
  if (isWindows()) {
    const script = `Expand-Archive -Force -Path '${absZip.replace(/'/g, "''")}' -DestinationPath '${absDest.replace(/'/g, "''")}'`;
    const r = await runCommand('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeoutMs: 120000,
    });
    if (r.code === 0) return { ok: true, output: absDest, message: '解压完成' };
    throw new Error(`解压失败: ${r.stderr.trim() || r.stdout.trim()}`);
  }

  const tar = await which('tar');
  if (tar) {
    const r = await runCommand('tar', ['-xf', absZip, '-C', absDest], { timeoutMs: 120000 });
    if (r.code === 0) return { ok: true, output: absDest, message: '解压完成' };
  }

  const unzipBin = await which('unzip');
  if (!unzipBin) throw new Error('未找到 tar 或 unzip，无法解压');
  const r = await runCommand('unzip', ['-o', absZip, '-d', absDest], { timeoutMs: 120000 });
  if (r.code !== 0) throw new Error(`解压失败: ${r.stderr.trim()}`);
  return { ok: true, output: absDest, message: '解压完成' };
}

/** 列出 zip 内容清单。 */
export async function zipList(zipFile: string): Promise<string[]> {
  if (!(await exists(zipFile))) throw new Error(`压缩包不存在: ${zipFile}`);
  const absZip = path.resolve(zipFile);

  // Windows：.NET 读条目名（按 UTF-8 标志位），并强制控制台输出 UTF-8，
  // 否则系统 tar 输出走本机 ANSI 代码页，中文文件名在英文系统上变 '?'。
  if (isWindows()) {
    const script = `$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue; [IO.Compression.ZipFile]::OpenRead('${absZip.replace(/'/g, "''")}').Entries | ForEach-Object { $_.FullName }`;
    const r = await runCommand('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeoutMs: 60000,
    });
    if (r.code !== 0) throw new Error(`读取清单失败: ${r.stderr.trim()}`);
    return r.stdout.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  }

  const tar = await which('tar');
  if (tar) {
    const r = await runCommand('tar', ['-tf', absZip], { timeoutMs: 60000 });
    if (r.code === 0) return r.stdout.split(/\r?\n/).filter(Boolean);
  }
  {
    // GNU tar 不认 zip → unzip 的 zipinfo 模式（-Z1：每行一个条目名）
    const unzipBin = await which('unzip');
    if (unzipBin) {
      const r = await runCommand('unzip', ['-Z1', absZip], { timeoutMs: 60000 });
      if (r.code === 0) return r.stdout.split(/\r?\n/).filter(Boolean);
    }
    throw new Error('读取清单失败：tar / unzip 均不可用');
  }
}
