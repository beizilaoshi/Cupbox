import path from 'node:path';
import { stat } from 'node:fs/promises';
import { isWindows, which, runCommand } from '../util/platform.js';
import { runPowerShell, psStringLiteral } from '../util/ps.js';

export interface OcrOptions {
  /** 图片绝对/相对路径（png/jpg/bmp/gif/tiff） */
  imagePath: string;
  /** BCP-47 语言标签，如 zh-Hans、zh-Hant、en；默认用系统用户语言 */
  lang?: string;
  /** 引擎：auto（默认）| windows（Windows.Media.Ocr）| tesseract（需安装 tesseract-ocr） */
  engine?: 'auto' | 'windows' | 'tesseract';
}

export interface OcrResult {
  text: string;
  engine: string;
  lang?: string;
}

/** Windows 原生 OCR（支持简体中文/繁体/英文等系统语言包）。 */
async function ocrWindows(imagePath: string, lang?: string): Promise<OcrResult> {
  const abs = path.resolve(imagePath);
  const st = await stat(abs).catch(() => null);
  if (!st) throw new Error(`图片不存在: ${abs}`);

  const langExpr = lang ? psStringLiteral(lang) : "''";
  const script = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType=WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]
function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
$Path = ${psStringLiteral(abs)}
$langCode = ${langExpr}
$eng = $null
if ($langCode) {
  try { $langObj = [Windows.Globalization.Language]::new($langCode); $eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($langObj) } catch { }
}
if (-not $eng) { $eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $eng) {
  $avail = ([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag }) -join ', '
  if (-not $avail) { throw '系统未安装任何 OCR 语言包：设置 > 时间和语言 > 语言 中安装“中文/English 语言包（含光学字符识别）”' }
  $eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new(($avail -split ', ')[0]))
}
if (-not $eng) { throw '没有可用的 OCR 引擎，请安装 OCR 语言包或指定 -lang' }
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$result = Await ($eng.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
Write-Output ('LANG:' + $eng.RecognizerLanguage.LanguageTag)
Write-Output 'TEXT:'
Write-Output $result.Text
`;

  const r = await runPowerShell(script, { timeoutMs: 120_000 });
  if (r.code !== 0) {
    const err = (r.stderr + r.stdout).trim();
    throw new Error(`Windows OCR 失败: ${err.slice(0, 800)}`);
  }
  const out = r.stdout;
  const langM = out.match(/LANG:(\S+)/);
  const textIdx = out.indexOf('TEXT:');
  const text = textIdx >= 0 ? out.slice(textIdx + 5).replace(/^\r?\n/, '').trimEnd() : out.trim();
  return { text, engine: 'windows', ...(langM ? { lang: langM[1] } : {}) };
}

async function ocrTesseract(imagePath: string, lang?: string): Promise<OcrResult> {
  const abs = path.resolve(imagePath);
  const st = await stat(abs).catch(() => null);
  if (!st) throw new Error(`图片不存在: ${abs}`);
  const langs = lang ?? 'chi_sim+eng';
  let r = await runCommand('tesseract', [abs, 'stdout', '-l', langs], { timeoutMs: 120_000 });
  if (r.code !== 0 && !lang) {
    // 语言包缺失时退回 tesseract 默认语言
    r = await runCommand('tesseract', [abs, 'stdout'], { timeoutMs: 120_000 });
  }
  if (r.code !== 0) throw new Error(`tesseract 识别失败: ${r.stderr.trim().slice(0, 500)}`);
  return { text: r.stdout.trim(), engine: 'tesseract', lang: langs };
}

export async function ocr(opts: OcrOptions): Promise<OcrResult> {
  const engine = opts.engine ?? 'auto';

  if (engine === 'windows') {
    if (!isWindows()) throw new Error('windows 引擎只能在 Windows 上使用');
    return ocrWindows(opts.imagePath, opts.lang);
  }
  if (engine === 'tesseract') {
    if (!(await which('tesseract'))) {
      throw new Error('未找到 tesseract（安装: Windows `winget install UB-Mannheim.TesseractOCR` / mac `brew install tesseract` / linux `apt install tesseract-ocr`）');
    }
    return ocrTesseract(opts.imagePath, opts.lang);
  }

  // auto
  if (isWindows()) {
    try {
      return await ocrWindows(opts.imagePath, opts.lang);
    } catch (e) {
      if (await which('tesseract')) return ocrTesseract(opts.imagePath, opts.lang);
      throw e;
    }
  }
  if (await which('tesseract')) return ocrTesseract(opts.imagePath, opts.lang);
  throw new Error(
    isWindows()
      ? 'OCR 不可用（Windows.Media.Ocr 失败且未安装 tesseract）'
      : '未找到 tesseract（mac: `brew install tesseract tesseract-lang` / linux: `apt install tesseract-ocr`）',
  );
}
