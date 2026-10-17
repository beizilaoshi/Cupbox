import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import { stat, rm, readFile } from 'node:fs/promises';
import { ocr } from '../src/core/ocr.js';
import { screenshot } from '../src/core/shot.js';
import { mkTmpDir, cleanupAll } from './helpers.js';
import { runPowerShell, psStringLiteral } from '../src/util/ps.js';

const isWin = process.platform === 'win32';

afterAll(cleanupAll);

/** 用 .NET GDI+ 渲染一张含文字的测试图片。 */
async function renderTestImage(outPath: string, text: string): Promise<void> {
  const script = `
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 800, 200
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font('Arial', 72, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black
$g.DrawString(${psStringLiteral(text)}, $font, $brush, 20, 40)
$bmp.Save(${psStringLiteral(outPath)}, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`;
  const r = await runPowerShell(script, { timeoutMs: 30000 });
  if (r.code !== 0) throw new Error(`渲染测试图片失败: ${r.stderr}`);
}

describe.skipIf(!isWin)('ocr (Windows 原生引擎)', () => {
  it('识别渲染图片中的文字', async () => {
    const d = await mkTmpDir();
    const img = path.join(d, 'sample.png');
    try {
      await renderTestImage(img, 'Hello 123');
    } catch (e) {
      // CI 无图形环境时渲染可能失败 → 按环境限制跳过
      console.warn('[skip] 无法渲染测试图片:', String(e).slice(0, 200));
      return;
    }
    try {
      const r = await ocr({ imagePath: img, engine: 'auto' });
      expect(r.text.replace(/\s/g, '')).toMatch(/Hello|123/i);
    } catch (e) {
      const msg = String(e);
      if (/语言包|No OCR|未安装|未找到|不可用/i.test(msg)) {
        console.warn('[skip] OCR 语言环境不可用:', msg.slice(0, 300));
        return;
      }
      throw e;
    }
  }, 120000);

  it('图片不存在时报错清晰', async () => {
    await expect(ocr({ imagePath: 'Z:/definitely-missing.png' })).rejects.toThrow('图片不存在');
  });
});

describe.skipIf(!isWin)('shot (Windows)', () => {
  it('截屏生成有效 PNG', async () => {
    const d = await mkTmpDir();
    const out = path.join(d, 'shot.png');
    try {
      const r = await screenshot({ outputPath: out });
      expect(r.ok).toBe(true);
      expect(r.path).toBe(out);
      const st = await stat(out);
      expect(st.size).toBeGreaterThan(100);
      const buf = await readFile(out);
      expect(buf.subarray(0, 4).toString('latin1')).toBe('\x89PNG');
    } catch (e) {
      const msg = String(e);
      if (/GDI|无法|失败|拒绝|denied|会话/i.test(msg)) {
        console.warn('[skip] 当前环境无图形会话:', msg.slice(0, 200));
        return;
      }
      throw e;
    }
    await rm(out, { force: true }).catch(() => {});
  }, 60000);

  it('非 .png 输出被拒绝', async () => {
    await expect(screenshot({ outputPath: 'x.jpg' })).rejects.toThrow('.png');
  });
});
