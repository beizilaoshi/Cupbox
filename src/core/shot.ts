import path from 'node:path';
import { isWindows, which, runCommand } from '../util/platform.js';
import { runPowerShell, psStringLiteral } from '../util/ps.js';

export interface ShotOptions {
  /** 输出 PNG 路径，默认当前目录 screenshot-<timestamp>.png */
  outputPath?: string;
  /** 只截主屏（默认 true）；Windows 暂只支持主屏 */
  primaryOnly?: boolean;
}

export interface ShotResult {
  ok: boolean;
  path: string;
  backend: string;
}

export async function screenshot(opts: ShotOptions = {}): Promise<ShotResult> {
  const out = path.resolve(
    opts.outputPath ?? `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
  );
  if (!out.toLowerCase().endsWith('.png')) {
    throw new Error('输出文件名需以 .png 结尾（当前仅支持 PNG）');
  }

  if (isWindows()) {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save(${psStringLiteral(out)}, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ${psStringLiteral(out)}
`;
    const r = await runPowerShell(script, { timeoutMs: 30_000 });
    if (r.code !== 0) throw new Error(`截屏失败: ${(r.stderr + r.stdout).trim().slice(0, 500)}`);
    return { ok: true, path: out, backend: 'windowsforms' };
  }

  if (process.platform === 'darwin') {
    const r = await runCommand('screencapture', ['-x', out], { timeoutMs: 30_000 });
    if (r.code !== 0) throw new Error(`screencapture 失败: ${r.stderr.trim()}`);
    return { ok: true, path: out, backend: 'screencapture' };
  }

  // Linux: 依次探测 gnome-screenshot / scrot / grim / import
  const candidates: Array<{ bin: string; args: string[] }> = [
    { bin: 'gnome-screenshot', args: ['-f', out] },
    { bin: 'scrot', args: ['-o', out] },
    { bin: 'grim', args: [out] },
    { bin: 'import', args: ['-window', 'root', out] },
  ];
  for (const c of candidates) {
    if (await which(c.bin)) {
      const r = await runCommand(c.bin, c.args, { timeoutMs: 30_000 });
      if (r.code === 0) return { ok: true, path: out, backend: c.bin };
    }
  }
  throw new Error('未找到截屏工具（安装 gnome-screenshot / scrot / grim / imagemagick 任一）');
}
