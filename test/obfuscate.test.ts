import { describe, it, expect, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';

import {
  processPixels,
  obfuscateImage,
  validateKey,
  outputSize,
  OBF_MODES,
  listModesText,
  isObfMode,
  type ObfMode,
  type ObfDirection,
} from '../src/core/obfuscate.js';
import { mkTmpDir, cleanupAll } from './helpers.js';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'dist', 'index.js');
const built = existsSync(cli);

afterAll(cleanupAll);

// ---------------- 测试数据 ----------------

/** 与金标样本一致的确定性伪随机 RGBA 缓冲。 */
function makePixels(w: number, h: number): Uint8Array {
  const buf = new Uint8Array(w * h * 4);
  let s = 12345;
  for (let i = 0; i < buf.length; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    buf[i] = s & 255;
  }
  return buf;
}

/** 按 b 模式规则补边（行跨度 padW，补透明黑）。 */
function padTo(src: Uint8Array, w: number, h: number, pw: number, ph: number): Uint8Array {
  const out = new Uint8Array(pw * ph * 4);
  for (let j = 0; j < h; j++) out.set(src.subarray(j * w * 4, (j + 1) * w * 4), j * pw * 4);
  return out;
}

function sha256hex(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

const CASES: Array<{ mode: ObfMode; key?: string | number }> = [
  { mode: 'gilbert' },
  { mode: 'b', key: 'k1' },
  { mode: 'c', key: 'k1' },
  { mode: 'c2', key: '密钥123' },
  { mode: 'pe1', key: '0.666' },
  { mode: 'pe2', key: '0.666' },
  { mode: 'pe1', key: 0.31415926 },
];

// 金标：由「番茄图片混淆 桌面版」原版引擎（MIT）与 cupbox 引擎逐字节对拍产生，
// 37x19 确定性样本。任何一次算法改动都会打破这些值 → 兼容性回归会被立刻抓住。
const GOLDEN: Record<string, string> = {
  'gilbert:undefined:encrypt': 'b52ed4ba5a77bade52178f1fc635dad84c6a56312c008337550aebc0b12901d1',
  'gilbert:undefined:decrypt': 'c7a6431a4a25c9f57e679803d1ade7ce366b5849ae1ad75c367cc305a162abb0',
  'b:k1:encrypt': '85f3fc404dcbe1a8ca9bc990a751dc65f637013e23d98dfc9fa56ef9aa819c7b',
  'b:k1:decrypt': 'dffedc7514c43e24cc3e9e373960f9219486f92ff1df8edcc0e268fc59e11865',
  'c:k1:encrypt': 'e9fdc6f7629cc8fdd39cc29ce288104fc02c40a62a9fdb4943d6b900328a41aa',
  'c:k1:decrypt': '9f91873929fbaae111483363f2fc3588c5763215911f0aa27e9be19fb3720d55',
  'c2:密钥123:encrypt': '1d057d17ccc16b4fd2053fdb7041811ea76e2dd817aca0fdf5d2067cd1cd84d7',
  'c2:密钥123:decrypt': '618219540f44fe6cad351ebd4d4ecce413a19737b54735ab826fa3c498b75910',
  'pe1:0.666:encrypt': 'd2cb77a8a0caa3dd77c6b5e30e82f9d8045a5b0195194fc0eb81c1ae4c50c7de',
  'pe1:0.666:decrypt': '5309ca379adc02aaf9ceba4c75aacff35de846cd537cfdaef7e9de6c96a4a4e4',
  'pe2:0.666:encrypt': '3a2765039afd01d2cef1ac2ab534fd4eeb0fe921d252ff89d651b9ed677164fc',
  'pe2:0.666:decrypt': '887336cf2bee30d57f0ecc1a135b822940d5651f4f8f76d708b22079d2ca1ea7',
  'pe1:0.31415926:encrypt': '3c7a4346fcb6021346f7e841acfa9b63c51bf45226da10a3d476dfce94f38d56',
  'pe1:0.31415926:decrypt': '8d72e45fb8251ac996919c6d71b41b25106dd2e3fafd74e14ae0858745f33e48',
};

// ---------------- 像素级 ----------------

describe('六模式像素级往返', () => {
  const sizes: Array<[number, number]> = [
    [37, 19], // 非 32 倍数（触发 b 模式补边）
    [32, 32], // 正好整块
    [64, 32],
    [8, 5],
    [1, 1],
  ];

  for (const c of CASES) {
    for (const [w, h] of sizes) {
      it(`${c.mode} [key=${JSON.stringify(c.key)}] ${w}x${h} 加密→解密无损还原`, () => {
        const src = makePixels(w, h);
        const enc = processPixels({
          mode: c.mode,
          ...(c.key !== undefined ? { key: c.key } : {}),
          direction: 'encrypt',
          width: w,
          height: h,
          pixels: new Uint8Array(src),
        });
        const dec = processPixels({
          mode: c.mode,
          ...(c.key !== undefined ? { key: c.key } : {}),
          direction: 'decrypt',
          width: enc.width,
          height: enc.height,
          pixels: new Uint8Array(enc.pixels),
        });
        expect(dec.width).toBe(enc.width);
        expect(dec.height).toBe(enc.height);
        const expected =
          c.mode === 'b' ? padTo(src, w, h, enc.width, enc.height) : src;
        expect(Buffer.from(dec.pixels).equals(Buffer.from(expected))).toBe(true);
      });
    }
  }

  it('同一输入同一密钥两次结果完全一致（确定性）', () => {
    const src = makePixels(20, 10);
    const run = () =>
      processPixels({ mode: 'c', key: 'k', direction: 'encrypt', width: 20, height: 10, pixels: new Uint8Array(src) });
    expect(Buffer.from(run().pixels).equals(Buffer.from(run().pixels))).toBe(true);
  });

  it('密钥不同，输出必然不同', () => {
    const src = makePixels(20, 10);
    const a = processPixels({ mode: 'c', key: 'key-A', direction: 'encrypt', width: 20, height: 10, pixels: new Uint8Array(src) });
    const b = processPixels({ mode: 'c', key: 'key-B', direction: 'encrypt', width: 20, height: 10, pixels: new Uint8Array(src) });
    expect(Buffer.from(a.pixels).equals(Buffer.from(b.pixels))).toBe(false);
  });
});

describe('金标：与「番茄图片混淆」原版引擎逐字节一致', () => {
  const w = 37;
  const h = 19;
  const src = makePixels(w, h);

  for (const c of CASES) {
    for (const dir of ['encrypt', 'decrypt'] as ObfDirection[]) {
      it(`${c.mode} ${dir} [key=${JSON.stringify(c.key)}]`, () => {
        const r = processPixels({
          mode: c.mode,
          ...(c.key !== undefined ? { key: c.key } : {}),
          direction: dir,
          width: w,
          height: h,
          pixels: new Uint8Array(src),
        });
        const key = `${c.mode}:${String(c.key)}:${dir}`;
        expect(sha256hex(r.pixels), `金标不匹配: ${key}`).toBe(GOLDEN[key]);
      });
    }
  }
});

describe('模式与密钥校验', () => {
  it('未知模式给出可用列表', () => {
    expect(() => validateKey('nope' as ObfMode, undefined)).toThrow(/未知的混淆模式/);
    expect(() => validateKey('nope' as ObfMode, undefined)).toThrow(/gilbert/);
    expect(isObfMode('b')).toBe(true);
    expect(isObfMode('nope')).toBe(false);
  });

  it('pe1/pe2 密钥必须 0~1 小数', () => {
    expect(() => validateKey('pe1', '0.666')).not.toThrow();
    expect(() => validateKey('pe1', 0.5)).not.toThrow();
    expect(() => validateKey('pe1', 'abc')).toThrow(/0 到 1/);
    expect(() => validateKey('pe2', '1.5')).toThrow(/0 到 1/);
    expect(() => validateKey('pe1', '-0.1')).toThrow(/0 到 1/);
    expect(() => validateKey('pe1', undefined)).toThrow(/需要密钥/);
  });

  it('b/c/c2 需要文本密钥；gilbert 无需密钥', () => {
    expect(() => validateKey('c', '任意文本')).not.toThrow();
    expect(() => validateKey('c', '')).not.toThrow(); // 空字符串是合法密钥（与生态一致）
    expect(() => validateKey('c', undefined)).toThrow(/需要文本密钥/);
    expect(() => validateKey('c', 123 as unknown as string)).toThrow(/字符串/);
    expect(() => validateKey('gilbert', undefined)).not.toThrow();
    expect(() => validateKey('gilbert', '带密钥也忽略')).not.toThrow();
  });

  it('像素缓冲长度不符直接报错', () => {
    expect(() =>
      processPixels({ mode: 'c', key: 'k', direction: 'encrypt', width: 10, height: 10, pixels: new Uint8Array(5) }),
    ).toThrow(/像素缓冲长度不符/);
  });

  it('b 模式输出尺寸补边到 32 倍数，其余原样', () => {
    expect(outputSize('b', 37, 19)).toEqual({ width: 64, height: 32 });
    expect(outputSize('b', 64, 32)).toEqual({ width: 64, height: 32 });
    expect(outputSize('c', 37, 19)).toEqual({ width: 37, height: 19 });
    expect(outputSize('b', 37, 19, 16)).toEqual({ width: 48, height: 32 });
  });

  it('模式表覆盖六种模式且可读', () => {
    expect(OBF_MODES).toHaveLength(6);
    const text = listModesText();
    for (const m of OBF_MODES) expect(text).toContain(m.mode);
  });
});

// ---------------- 文件级 ----------------

async function writePng(file: string, w: number, h: number, pixels: Uint8Array): Promise<void> {
  const png = new PNG({ width: w, height: h });
  png.data = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  await writeFile(file, PNG.sync.write(png));
}

async function readPng(file: string): Promise<{ width: number; height: number; data: Buffer }> {
  const png = PNG.sync.read(await readFile(file));
  return { width: png.width, height: png.height, data: png.data };
}

describe('PNG 文件级 API', () => {
  const W = 37;
  const H = 19;

  it('混淆→还原往返无损，自动命名 .obf.png / .clear.png', async () => {
    const dir = await mkTmpDir();
    const input = path.join(dir, 'photo.png');
    const src = makePixels(W, H);
    await writePng(input, W, H, src);

    const enc = await obfuscateImage({ input, mode: 'c', key: 'k' });
    expect(enc.output).toBe(path.join(dir, 'photo.obf.png'));
    expect(enc.renamed).toBe(false);
    expect(enc.width).toBe(W);
    expect(enc.message).toContain('已混淆');
    const encPng = await readPng(enc.output);
    expect(encPng.width).toBe(W);
    // 混淆后的图与原图不同
    expect(encPng.data.equals(Buffer.from(src))).toBe(false);

    const dec = await obfuscateImage({ input: enc.output, mode: 'c', key: 'k', direction: 'decrypt' });
    expect(dec.output).toBe(path.join(dir, 'photo.obf.clear.png'));
    expect(dec.message).toContain('已还原');
    const back = await readPng(dec.output);
    expect(back.data.equals(Buffer.from(src))).toBe(true);
  });

  it('输出重名自动加 (1)，绝不覆盖已有文件', async () => {
    const dir = await mkTmpDir();
    const input = path.join(dir, 'pic.png');
    await writePng(input, W, H, makePixels(W, H));
    const first = await obfuscateImage({ input, mode: 'c', key: 'k' });
    const firstBytes = await readFile(first.output);
    const second = await obfuscateImage({ input, mode: 'c', key: 'k' });
    expect(second.renamed).toBe(true);
    expect(second.output).toBe(path.join(dir, 'pic.obf (1).png'));
    // 原产出未被覆盖
    expect((await readFile(first.output)).equals(firstBytes)).toBe(true);
  });

  it('显式 -o/--out 输出到指定路径', async () => {
    const dir = await mkTmpDir();
    const input = path.join(dir, 'a.png');
    await writePng(input, W, H, makePixels(W, H));
    const out = path.join(dir, 'sub', 'named.png');
    const r = await obfuscateImage({ input, mode: 'gilbert', output: out });
    expect(r.output).toBe(out);
    expect(existsSync(out)).toBe(true);
  });

  it('b 模式文件输出补边尺寸并如实报告', async () => {
    const dir = await mkTmpDir();
    const input = path.join(dir, 'b.png');
    await writePng(input, W, H, makePixels(W, H));
    const r = await obfuscateImage({ input, mode: 'b', key: 'k' });
    expect(r.outWidth).toBe(64);
    expect(r.outHeight).toBe(32);
    const png = await readPng(r.output);
    expect(png.width).toBe(64);
    expect(png.height).toBe(32);
    expect(r.message).toContain('补边');
  });

  it('非 PNG 输入给出明确错误', async () => {
    const dir = await mkTmpDir();
    const fake = path.join(dir, 'fake.png');
    await writeFile(fake, '这不是图片');
    await expect(obfuscateImage({ input: fake, mode: 'c', key: 'k' })).rejects.toThrow(/只支持 PNG/);
  });

  it('文件不存在给出明确错误', async () => {
    await expect(obfuscateImage({ input: path.join(root, 'definitely-missing.png'), mode: 'c', key: 'k' })).rejects.toThrow(
      /读取图片失败/,
    );
  });

  it('密钥非法时在读文件之前就 fail fast', async () => {
    const dir = await mkTmpDir();
    await expect(
      obfuscateImage({ input: path.join(dir, 'nope.png'), mode: 'pe1', key: 'bad' }),
    ).rejects.toThrow(/0 到 1/);
  });
});

// ---------------- CLI ----------------

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cli, ...args], {
      cwd: root,
      windowsHide: true,
      timeout: 60000,
    });
    return { stdout, stderr, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.code ?? 1 };
  }
}

describe.skipIf(!built)('CLI obfuscate', () => {
  const W = 37;
  const H = 19;

  it('不带参数打印模式表与用法', async () => {
    const r = await runCli(['obfuscate']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('gilbert');
    expect(r.stdout).toContain('pe2');
    expect(r.stdout).toContain('用法');
  });

  it('混淆 → 还原完整往返（--json）', async () => {
    const dir = await mkTmpDir();
    const input = path.join(dir, 'shot.png');
    const src = makePixels(W, H);
    await writePng(input, W, H, src);

    const enc = await runCli(['obfuscate', input, '--mode', 'c', '--key', '密钥', '--json']);
    expect(enc.code).toBe(0);
    const encJson = JSON.parse(enc.stdout) as { output: string; outWidth: number; direction: string };
    expect(encJson.direction).toBe('encrypt');
    expect(encJson.outWidth).toBe(W);
    expect(existsSync(encJson.output)).toBe(true);

    const dec = await runCli([
      'obfuscate', encJson.output, '--mode', 'c', '--key', '密钥', '--decrypt', '-o',
      path.join(dir, 'back.png'), '--json',
    ]);
    expect(dec.code).toBe(0);
    const back = await readPng(path.join(dir, 'back.png'));
    expect(back.data.equals(Buffer.from(src))).toBe(true);
  }, 60000);

  it('gilbert 模式无需密钥', async () => {
    const dir = await mkTmpDir();
    const input = path.join(dir, 'g.png');
    await writePng(input, 20, 12, makePixels(20, 12));
    const r = await runCli(['obfuscate', input, '--mode', 'gilbert', '--json']);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.stdout) as { output: string };
    expect(existsSync(j.output)).toBe(true);
  });

  it('缺少 --mode 报错并提示', async () => {
    const dir = await mkTmpDir();
    const input = path.join(dir, 'x.png');
    await writePng(input, 8, 8, makePixels(8, 8));
    const r = await runCli(['obfuscate', input]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('--mode');
  });

  it('非法模式 / 非法密钥都拦得住', async () => {
    const dir = await mkTmpDir();
    const input = path.join(dir, 'x.png');
    await writePng(input, 8, 8, makePixels(8, 8));
    const badMode = await runCli(['obfuscate', input, '--mode', 'wat']);
    expect(badMode.code).toBe(1);
    expect(badMode.stderr).toContain('无效 --mode');

    const badKey = await runCli(['obfuscate', input, '--mode', 'pe1', '--key', 'abc']);
    expect(badKey.code).toBe(1);
    expect(badKey.stderr).toContain('0 到 1');

    const noKey = await runCli(['obfuscate', input, '--mode', 'c']);
    expect(noKey.code).toBe(1);
    expect(noKey.stderr).toContain('需要文本密钥');
  });
});

describe('解压炸弹防护', () => {
  it('IHDR 声明超大尺寸时拒绝解码（超限直接抛错，不进解码器）', async () => {
    const dir = await mkTmpDir();
    const bomb = path.join(dir, 'bomb.png');
    const buf = Buffer.alloc(40);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buf, 0);
    buf.write('IHDR', 12, 'ascii');
    buf.writeUInt32BE(65535, 16);
    buf.writeUInt32BE(65535, 20);
    await writeFile(bomb, buf);
    await expect(obfuscateImage({ input: bomb, mode: 'gilbert' })).rejects.toThrow('解压炸弹');
  });

  it('缺少 IHDR 头的伪 PNG 报结构异常', async () => {
    const dir = await mkTmpDir();
    const bad = path.join(dir, 'bad.png');
    const buf = Buffer.alloc(40);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buf, 0);
    buf.write('XXXX', 12, 'ascii');
    await writeFile(bad, buf);
    await expect(obfuscateImage({ input: bad, mode: 'gilbert' })).rejects.toThrow('IHDR');
  });
});
