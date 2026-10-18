/**
 * 图片像素混淆（obfuscate）——cupbox 第 14 个工具。
 *
 * 算法移植自开源项目「番茄图片混淆 桌面版」的 obfuscate 核心
 * （MIT License, Copyright (c) 2026 3450892121），并与手机版 APK 及
 * pyscramble / PicEncrypt 等生态参考实现交叉验证——同一张图、同一密钥、
 * 同一模式可与它们互相解出相同结果。
 *
 * 六种模式：
 *   gilbert 空间曲线混淆（番茄图，无密钥）
 *   b       方块混淆（32×32 块洗牌，尺寸不足自动补边到 32 的整数倍）
 *   c       像素混淆（行、列各一条 MD5 错位表做两级重排）
 *   c2      行像素混淆（行内横向 MD5 错位）
 *   pe1     兼容 PE 行模式（Logistic 混沌错位，密钥必须 0<k<1）
 *   pe2     兼容 PE 行+列模式（Logistic 混沌错位，加密先行后列，密钥 0<k<1）
 *
 * 方向语义：encrypt = 按映射取源像素写入目标（gather）；
 *           decrypt = 反向写回（scatter）。二者互逆，同一密钥可无损还原。
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

import { uniquePath } from '../util/fsutil.js';

export type ObfMode = 'gilbert' | 'b' | 'c' | 'c2' | 'pe1' | 'pe2';
export type ObfDirection = 'encrypt' | 'decrypt';

export interface ObfModeInfo {
  mode: ObfMode;
  label: string;
  /** none=无密钥; string=任意文本密钥（可为空）; probability=0~1 小数密钥 */
  keyType: 'none' | 'string' | 'probability';
  desc: string;
}

export const OBF_MODES: readonly ObfModeInfo[] = [
  { mode: 'gilbert', label: '空间曲线混淆 (番茄图)', keyType: 'none', desc: 'Gilbert 曲线线性化 + 黄金分割循环移位，无需密钥' },
  { mode: 'b', label: '方块混淆 (B)', keyType: 'string', desc: '32×32 方块级 MD5 洗牌；尺寸不足自动补边到 32 的整数倍' },
  { mode: 'c', label: '像素混淆 (C)', keyType: 'string', desc: '行、列各一条 MD5 错位表，两级重排' },
  { mode: 'c2', label: '行像素混淆 (C2)', keyType: 'string', desc: '每行内部横向 MD5 错位' },
  { mode: 'pe1', label: '兼容 PE 行模式', keyType: 'probability', desc: 'Logistic 混沌序列逐行错位，密钥必须是 0~1 的小数' },
  { mode: 'pe2', label: '兼容 PE 行+列模式', keyType: 'probability', desc: 'Logistic 混沌行列两级错位（加密先行后列），密钥 0~1' },
];

export function isObfMode(v: string): v is ObfMode {
  return OBF_MODES.some((m) => m.mode === v);
}

/** 算法变体默认值（与生态参考实现的默认行为一致）。 */
export interface ObfVariants {
  gilbertRounding: 'trunc' | 'floor';
  blockVariant: 'py' | 'js';
  pe1Chaining: 'single' | 'chained';
}

export const OBF_VARIANTS: ObfVariants = {
  gilbertRounding: 'trunc',
  blockVariant: 'py',
  pe1Chaining: 'single',
};

// ---------------------------------------------------------------------------
// 密钥校验（fail fast，给出可执行的修复提示）
// ---------------------------------------------------------------------------

function modeLabel(mode: ObfMode): string {
  return OBF_MODES.find((m) => m.mode === mode)?.label ?? mode;
}

export function listModesText(): string {
  return OBF_MODES.map(
    (m) => `  ${m.mode.padEnd(8)} ${m.label}  [${m.keyType === 'none' ? '无需密钥' : m.keyType === 'string' ? '任意文本密钥' : '密钥 0~1 小数'}]\n         ${m.desc}`,
  ).join('\n');
}

/** 校验模式与密钥；不合法直接抛出带修复提示的错误。 */
export function validateKey(mode: ObfMode, key: unknown): void {
  if (!isObfMode(mode)) {
    throw new Error(`未知的混淆模式: ${mode}。可用模式: ${OBF_MODES.map((m) => m.mode).join(' / ')}`);
  }
  if (mode === 'gilbert') return; // 无密钥模式

  if (mode === 'pe1' || mode === 'pe2') {
    const k = typeof key === 'string' && key.trim() !== '' ? Number(key) : key;
    if (k === undefined || k === null || k === '') {
      throw new Error(`${mode} 模式需要密钥：--key 0.666（必须是 0 到 1 之间的小数）`);
    }
    if (typeof k !== 'number' || !Number.isFinite(k) || k <= 0 || k >= 1) {
      throw new Error(
        `${mode} 模式的密钥必须是 0 到 1 之间的小数（如 0.666），收到: ${JSON.stringify(key)}`,
      );
    }
    return;
  }

  // b / c / c2：字符串密钥，可以为空但必须是字符串
  if (key === undefined || key === null) {
    throw new Error(`${mode} 模式需要文本密钥：--key 任意文本（与对方工具保持一致即可互解）`);
  }
  if (typeof key !== 'string') {
    throw new Error(`${mode} 模式的密钥必须是字符串，收到: ${typeof key}`);
  }
}

// ---------------------------------------------------------------------------
// MD5 洗牌（B / C / C2 共用）
// ---------------------------------------------------------------------------

function md5Hex(s: string): string {
  return createHash('md5').update(s, 'utf8').digest('hex');
}

/**
 * 生成 0..length-1 的洗牌序列（Fisher-Yates）：
 * 对 i 从 N-1 递减到 1：取 MD5(密钥 + i) 的前 7 位十六进制 → 对 (i+1) 取模 → 与位置 i 交换。
 */
export function shuffleWithKey(length: number, key: string): Int32Array {
  const arr = new Int32Array(length);
  for (let i = 0; i < length; i++) arr[i] = i;
  const prefix = String(key);
  for (let i = length - 1; i > 0; i--) {
    const hex = md5Hex(prefix + i);
    const rand = parseInt(hex.slice(0, 7), 16) % (i + 1);
    const tmp = arr[rand];
    arr[rand] = arr[i];
    arr[i] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Gilbert 空间曲线（gilbert / 番茄图 模式）
// ---------------------------------------------------------------------------

const HALF = {
  trunc: (v: number) => (v / 2) | 0,
  floor: (v: number) => Math.floor(v / 2),
};

/**
 * Gilbert 曲线的像素访问顺序（与开源 gilbert2d 实现一致）。
 * rounding: 'trunc' 与 C++/Rust 整数除法一致（手机版 native 库）；
 *           'floor' 与网页版 JS 实现一致。默认 'trunc'。
 */
export function gilbert2d(width: number, height: number, rounding: 'trunc' | 'floor' = 'trunc'): Int32Array {
  const half = HALF[rounding];
  const points: number[] = [];

  function gen(x: number, y: number, ax: number, ay: number, bx: number, by: number): void {
    const w = Math.abs(ax + ay);
    const h = Math.abs(bx + by);
    const dax = Math.sign(ax);
    const day = Math.sign(ay);
    const dbx = Math.sign(bx);
    const dby = Math.sign(by);

    if (h === 1) {
      for (let i = 0; i < w; i++) {
        points.push(x + y * width);
        x += dax;
        y += day;
      }
      return;
    }
    if (w === 1) {
      for (let i = 0; i < h; i++) {
        points.push(x + y * width);
        x += dbx;
        y += dby;
      }
      return;
    }

    let ax2 = half(ax);
    let ay2 = half(ay);
    let bx2 = half(bx);
    let by2 = half(by);
    const w2 = Math.abs(ax2 + ay2);
    const h2 = Math.abs(bx2 + by2);

    if (2 * w > 3 * h) {
      if ((w2 & 1) === 1 && w > 2) {
        ax2 += dax;
        ay2 += day;
      }
      gen(x, y, ax2, ay2, bx, by);
      gen(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by);
    } else {
      if ((h2 & 1) === 1 && h > 2) {
        bx2 += dbx;
        by2 += dby;
      }
      gen(x, y, bx2, by2, ax2, ay2);
      gen(x + bx2, y + by2, ax, ay, bx - bx2, by - by2);
      gen(
        x + (ax - dax) + (bx2 - dbx),
        y + (ay - day) + (by2 - dby),
        -bx2,
        -by2,
        -(ax - ax2),
        -(ay - ay2),
      );
    }
  }

  if (width >= height) gen(0, 0, width, 0, 0, height);
  else gen(0, 0, 0, height, width, 0);

  return Int32Array.from(points);
}

const GOLDEN = (Math.sqrt(5) - 1) / 2; // 0.6180339887498949

function tomatoScramble(args: {
  pixels: Uint8Array;
  width: number;
  height: number;
  direction: ObfDirection;
  rounding: 'trunc' | 'floor';
}): Uint8Array {
  const { pixels, width, height, direction, rounding } = args;
  const n = width * height;
  const positions = gilbert2d(width, height, rounding);
  if (positions.length !== n) {
    throw new Error(`Gilbert 曲线覆盖异常：访问 ${positions.length} 个点，应为 ${n} 个（${width}x${height}）`);
  }
  const offset = Math.round(GOLDEN * n) % n;
  const out = new Uint8Array(pixels.length);
  for (let c = 0; c < n; c++) {
    const srcIdx = positions[c] * 4;
    const dstIdx = positions[(c + offset) % n] * 4;
    if (direction === 'encrypt') {
      out[dstIdx] = pixels[srcIdx];
      out[dstIdx + 1] = pixels[srcIdx + 1];
      out[dstIdx + 2] = pixels[srcIdx + 2];
      out[dstIdx + 3] = pixels[srcIdx + 3];
    } else {
      out[srcIdx] = pixels[dstIdx];
      out[srcIdx + 1] = pixels[dstIdx + 1];
      out[srcIdx + 2] = pixels[dstIdx + 2];
      out[srcIdx + 3] = pixels[dstIdx + 3];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// MD5 洗牌三模式（b / c / c2）
// ---------------------------------------------------------------------------

function copyPixel(src: Uint8Array, srcIdx: number, dst: Uint8Array, dstIdx: number): void {
  dst[dstIdx] = src[srcIdx];
  dst[dstIdx + 1] = src[srcIdx + 1];
  dst[dstIdx + 2] = src[srcIdx + 2];
  dst[dstIdx + 3] = src[srcIdx + 3];
}

/** 像素混淆 (c)：行、列各一条 MD5 错位表，两级错位。 */
function pixelScramble(pixels: Uint8Array, width: number, height: number, key: string, direction: ObfDirection): Uint8Array {
  const w = width;
  const h = height;
  const xArr = shuffleWithKey(w, key);
  const yArr = shuffleWithKey(h, key);
  const out = new Uint8Array(pixels.length);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const m = xArr[(xArr[j % w] + i) % w];
      const n = yArr[(yArr[m % h] + j) % h];
      const idxA = (i + j * w) * 4;
      const idxB = (m + n * w) * 4;
      if (direction === 'encrypt') copyPixel(pixels, idxB, out, idxA);
      else copyPixel(pixels, idxA, out, idxB);
    }
  }
  return out;
}

/** 行像素混淆 (c2)：只在每行内部横向错位。 */
function rowPixelScramble(pixels: Uint8Array, width: number, height: number, key: string, direction: ObfDirection): Uint8Array {
  const w = width;
  const h = height;
  const xArr = shuffleWithKey(w, key);
  const out = new Uint8Array(pixels.length);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const m = xArr[(xArr[j % w] + i) % w];
      const idxA = (i + j * w) * 4;
      const idxB = (m + j * w) * 4;
      if (direction === 'encrypt') copyPixel(pixels, idxB, out, idxA);
      else copyPixel(pixels, idxA, out, idxB);
    }
  }
  return out;
}

/** 方块混淆 (b)：先补边到 blockSize 的整数倍（补透明黑），再做方块级 MD5 洗牌。 */
function blockScramble(
  pixels: Uint8Array,
  width: number,
  height: number,
  key: string,
  direction: ObfDirection,
  blockSize = 32,
  variant: 'py' | 'js' = OBF_VARIANTS.blockVariant,
): { pixels: Uint8Array; width: number; height: number } {
  const xbc = blockSize;
  const ybc = blockSize;
  const padW = Math.ceil(width / xbc) * xbc;
  const padH = Math.ceil(height / ybc) * ybc;
  const blockW = padW / xbc;
  const blockH = padH / ybc;

  let src = pixels;
  if (padW !== width || padH !== height) {
    src = new Uint8Array(padW * padH * 4);
    for (let j = 0; j < height; j++) {
      src.set(pixels.subarray(j * width * 4, (j + 1) * width * 4), j * padW * 4);
    }
  }

  const xArr = shuffleWithKey(xbc, key);
  const yArr = shuffleWithKey(ybc, key);
  const out = new Uint8Array(padW * padH * 4);

  for (let j = 0; j < padH; j++) {
    for (let i = 0; i < padW; i++) {
      let m: number;
      let n: number;
      if (variant === 'js') {
        // 网页版 ImageMixer 写法
        let r = j;
        let o = i;
        r = (xArr[((o / blockH) | 0) % xbc] * blockW + r) % padW;
        r = xArr[(r / blockW) | 0] * blockW + (r % blockW);
        o = (yArr[((r / blockW) | 0) % ybc] * blockH + o) % padH;
        o = yArr[(o / blockH) | 0] * blockH + (o % blockH);
        m = r;
        n = o;
      } else {
        // Python 参考实现 / pyscramble 写法（默认）
        n = j;
        m = (xArr[((n / blockH) | 0) % xbc] * blockW + i) % padW;
        m = xArr[(m / blockW) | 0] * blockW + (m % blockW);
        n = (yArr[((m / blockW) | 0) % ybc] * blockH + n) % padH;
        n = yArr[(n / blockH) | 0] * blockH + (n % blockH);
      }
      const idxA = (i + j * padW) * 4;
      const idxB = (m + n * padW) * 4;
      if (direction === 'encrypt') copyPixel(src, idxB, out, idxA);
      else copyPixel(src, idxA, out, idxB);
    }
  }
  return { pixels: out, width: padW, height: padH };
}

// ---------------------------------------------------------------------------
// Logistic 混沌序列（pe1 / pe2 模式）
// ---------------------------------------------------------------------------

const MU = 3.9999999;

/** 生成 Logistic 序列并按键值升序给出原始下标（稳定排序）。 */
function logisticPositions(seed: number, n: number): Int32Array {
  const values = new Float64Array(n);
  let x = seed;
  values[0] = x;
  for (let i = 1; i < n; i++) {
    x = MU * x * (1 - x);
    values[i] = x;
  }
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  const sorted = Array.from(idx).sort((a, b) => values[a] - values[b]);
  return Int32Array.from(sorted);
}

/** 推进 n 次得到链式衔接初值：f^(n-1)(seed)。 */
function advanceSeed(seed: number, n: number): number {
  let x = seed;
  for (let i = 1; i < n; i++) {
    x = MU * x * (1 - x);
  }
  return x;
}

/** PE 行模式 (pe1)：single=全图共用一条序列；chained=每行用上一行末值作初值。 */
function rowLogistic(
  pixels: Uint8Array,
  width: number,
  height: number,
  key: number,
  direction: ObfDirection,
  chaining: 'single' | 'chained' = OBF_VARIANTS.pe1Chaining,
): Uint8Array {
  const w = width;
  const h = height;
  const tables: Int32Array[] = new Array(h);
  let seed = key;
  for (let j = 0; j < h; j++) {
    tables[j] = logisticPositions(seed, w);
    if (chaining === 'chained') seed = advanceSeed(seed, w);
  }
  const out = new Uint8Array(pixels.length);
  for (let j = 0; j < h; j++) {
    const pos = tables[j];
    for (let i = 0; i < w; i++) {
      const idxA = (i + j * w) * 4;
      const idxB = (pos[i] + j * w) * 4;
      if (direction === 'encrypt') copyPixel(pixels, idxB, out, idxA);
      else copyPixel(pixels, idxA, out, idxB);
    }
  }
  return out;
}

/** PE 行+列 (pe2)：加密先行后列，解密先列后行（与 PicEncrypt 原版一致）。 */
function rowColumnLogistic(
  pixels: Uint8Array,
  width: number,
  height: number,
  key: number,
  direction: ObfDirection,
): Uint8Array {
  const w = width;
  const h = height;

  const rowTables: Int32Array[] = new Array(h);
  let seed = key;
  for (let j = 0; j < h; j++) {
    rowTables[j] = logisticPositions(seed, w);
    seed = advanceSeed(seed, w);
  }
  const colTables: Int32Array[] = new Array(w);
  seed = key;
  for (let i = 0; i < w; i++) {
    colTables[i] = logisticPositions(seed, h);
    seed = advanceSeed(seed, h);
  }

  function rowPass(src: Uint8Array, dir: ObfDirection): Uint8Array {
    const buf = new Uint8Array(src.length);
    for (let j = 0; j < h; j++) {
      const pos = rowTables[j];
      for (let i = 0; i < w; i++) {
        const idxA = (i + j * w) * 4;
        const idxB = (pos[i] + j * w) * 4;
        if (dir === 'encrypt') copyPixel(src, idxB, buf, idxA);
        else copyPixel(src, idxA, buf, idxB);
      }
    }
    return buf;
  }

  function colPass(src: Uint8Array, dir: ObfDirection): Uint8Array {
    const buf = new Uint8Array(src.length);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const table = colTables[i];
        const idxA = (i + j * w) * 4;
        const idxB = (i + table[j] * w) * 4;
        if (dir === 'encrypt') copyPixel(src, idxB, buf, idxA);
        else copyPixel(src, idxA, buf, idxB);
      }
    }
    return buf;
  }

  if (direction === 'encrypt') {
    const t1 = rowPass(pixels, 'encrypt');
    return colPass(t1, 'encrypt');
  }
  const t1 = colPass(pixels, 'decrypt');
  return rowPass(t1, 'decrypt');
}

// ---------------------------------------------------------------------------
// 统一入口
// ---------------------------------------------------------------------------

export interface ProcessPixelsOptions {
  mode: ObfMode;
  key?: string | number;
  direction: ObfDirection;
  width: number;
  height: number;
  pixels: Uint8Array;
  variants?: Partial<ObfVariants>;
  blockSize?: number;
}

/** b 模式输出尺寸（补边到 blockSize 的整数倍），其余模式原尺寸。 */
export function outputSize(
  mode: ObfMode,
  width: number,
  height: number,
  blockSize = 32,
): { width: number; height: number } {
  if (mode !== 'b') return { width, height };
  return { width: Math.ceil(width / blockSize) * blockSize, height: Math.ceil(height / blockSize) * blockSize };
}

/**
 * 像素级混淆/还原（纯函数，不碰磁盘）。
 * pixels 为 RGBA 8bit 缓冲（长度 = width*height*4）。
 * encrypt 与 decrypt 互逆：decrypt(encrypt(x)) === x（b 模式在补边尺寸上成立）。
 */
export function processPixels(opts: ProcessPixelsOptions): { pixels: Uint8Array; width: number; height: number } {
  const { mode, direction, width, height, pixels } = opts;
  const variants: ObfVariants = { ...OBF_VARIANTS, ...opts.variants };
  validateKey(mode, opts.key);

  if (pixels.length !== width * height * 4) {
    throw new Error(`像素缓冲长度不符：期望 ${width * height * 4}（${width}x${height} RGBA），实际 ${pixels.length}`);
  }

  switch (mode) {
    case 'gilbert':
      return {
        pixels: tomatoScramble({ pixels, width, height, direction, rounding: variants.gilbertRounding }),
        width,
        height,
      };
    case 'b':
      return blockScramble(
        pixels,
        width,
        height,
        String(opts.key),
        direction,
        opts.blockSize ?? 32,
        variants.blockVariant,
      );
    case 'c':
      return { pixels: pixelScramble(pixels, width, height, String(opts.key), direction), width, height };
    case 'c2':
      return { pixels: rowPixelScramble(pixels, width, height, String(opts.key), direction), width, height };
    case 'pe1':
      return { pixels: rowLogistic(pixels, width, height, Number(opts.key), direction, variants.pe1Chaining), width, height };
    case 'pe2':
      return { pixels: rowColumnLogistic(pixels, width, height, Number(opts.key), direction), width, height };
  }
}

// ---------------------------------------------------------------------------
// PNG 文件级 API
// ---------------------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ObfuscateImageOptions {
  input: string;
  /** 输出路径；缺省生成 <名字>.obf.png（混淆）/ <名字>.clear.png（还原） */
  output?: string;
  mode: ObfMode;
  key?: string;
  direction?: ObfDirection;
  blockSize?: number;
  /** 解码前的像素总量上限（防 PNG 解压炸弹），默认 80_000_000（约 8000 万像素） */
  maxPixels?: number;
}

export interface ObfuscateImageResult {
  mode: ObfMode;
  direction: ObfDirection;
  input: string;
  output: string;
  /** 原图尺寸 */
  width: number;
  height: number;
  /** 输出尺寸（b 模式补边后可能更大） */
  outWidth: number;
  outHeight: number;
  /** 输出因重名被自动改名 */
  renamed: boolean;
  outputBytes: number;
  message: string;
}

/** 目标路径存在则生成 `a (1).png` 式的不冲突路径；不存在时原样返回。 */
async function ensureFree(target: string): Promise<string> {
  try {
    await stat(target);
    return uniquePath(target);
  } catch {
    return target;
  }
}

function defaultOutputPath(input: string, direction: ObfDirection): string {
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  return path.join(dir, `${base}.${direction === 'encrypt' ? 'obf' : 'clear'}.png`);
}

/**
 * 读 PNG → 混淆/还原 → 写 PNG。绝不覆盖已有文件（重名自动改名）。
 */
export async function obfuscateImage(opts: ObfuscateImageOptions): Promise<ObfuscateImageResult> {
  const direction: ObfDirection = opts.direction ?? 'encrypt';
  validateKey(opts.mode, opts.key); // 先于 IO 校验（fail fast）

  const input = path.resolve(opts.input);
  let buf: Buffer;
  try {
    buf = await readFile(input);
  } catch (e) {
    throw new Error(`读取图片失败: ${input}（${e instanceof Error ? e.message : String(e)}）`);
  }
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error(`只支持 PNG 图片: ${input}（JPG 等其他格式请先转换为 PNG）`);
  }

  // 解压炸弹防护：解码前先读 IHDR 声明的宽高（8 签名 + 4 长度 + 4 类型 + 4 宽 + 4 高 = 24，
  // 完整 IHDR 块为 33 字节），超限直接拒绝，绝不在超大尺寸上分配内存。
  if (buf.length < 33 || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`PNG 结构异常（缺少 IHDR 头）: ${input}`);
  }
  const ihdrW = buf.readUInt32BE(16);
  const ihdrH = buf.readUInt32BE(20);
  const maxPixels = opts.maxPixels ?? 80_000_000;
  if (ihdrW * ihdrH > maxPixels) {
    throw new Error(
      `PNG 尺寸过大，拒绝解码（疑似解压炸弹）: ${ihdrW}x${ihdrH}（约 ${Math.round((ihdrW * ihdrH) / 1_000_000)} 百万像素，上限 ${maxPixels}）`,
    );
  }

  let png: PNG;
  try {
    png = PNG.sync.read(buf);
  } catch (e) {
    throw new Error(`PNG 解码失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (png.data.length !== png.width * png.height * 4) {
    throw new Error(
      `不支持的 PNG 内部格式（${png.width}x${png.height} 数据长度 ${png.data.length}，期望 ${png.width * png.height * 4}）`,
    );
  }

  const pixels = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength);
  const r = processPixels({
    mode: opts.mode,
    ...(opts.key !== undefined ? { key: opts.key } : {}),
    direction,
    width: png.width,
    height: png.height,
    pixels,
    ...(opts.blockSize !== undefined ? { blockSize: opts.blockSize } : {}),
  });

  const out = new PNG({ width: r.width, height: r.height });
  out.data = Buffer.from(r.pixels.buffer, r.pixels.byteOffset, r.pixels.byteLength);
  const outBuf = PNG.sync.write(out, { colorType: 6 });

  const target = opts.output ? path.resolve(opts.output) : defaultOutputPath(input, direction);
  const free = await ensureFree(target);
  await mkdir(path.dirname(free), { recursive: true });
  await writeFile(free, outBuf);

  const info = OBF_MODES.find((m) => m.mode === opts.mode)!;
  const padNote = opts.mode === 'b' && (r.width !== png.width || r.height !== png.height)
    ? `（b 模式补边到 32 的整数倍）`
    : '';
  const keyNote = opts.mode === 'gilbert' ? '' : `，密钥${direction === 'encrypt' ? '已用' : '已验证'}`;
  const message =
    direction === 'encrypt'
      ? `✅ 已混淆 [${info.label}] ${png.width}x${png.height} → ${r.width}x${r.height}${padNote}${keyNote}: ${free}`
      : `✅ 已还原 [${info.label}] ${png.width}x${png.height} → ${r.width}x${r.height}${padNote}: ${free}`;

  return {
    mode: opts.mode,
    direction,
    input,
    output: free,
    width: png.width,
    height: png.height,
    outWidth: r.width,
    outHeight: r.height,
    renamed: free !== target,
    outputBytes: outBuf.length,
    message,
  };
}
