// Cupbox 可视化 —— 极简打包器（复用「番茄图片混淆」验证过的思路：
// electron 运行时整树复制 → 应用本体放进 resources/app → electron.exe 改名为产品 exe）
// 产物: release/Cupbox可视化/Cupbox可视化.exe （绿色便携，双击即用）
import { cp, mkdir, rm, rename, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'release', 'Cupbox可视化');
const APP = path.join(OUT, 'resources', 'app');
const EXE_NAME = 'Cupbox可视化.exe';

// 0) 清场
await rm(path.join(ROOT, 'release'), { recursive: true, force: true });

// 1) Electron 运行时整树复制（含 DLL/locales/resources）
const dist = path.join(ROOT, 'node_modules', 'electron', 'dist');
await cp(dist, OUT, { recursive: true });
console.log('[1/4] electron runtime copied');

// 2) 应用本体 → resources/app
await mkdir(APP, { recursive: true });
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
await writeFile(
  path.join(APP, 'package.json'),
  JSON.stringify(
    { name: 'cupbox', version: pkg.version, description: 'Cupbox 可视化桌面版', main: 'desktop/main.js', type: 'module', private: true },
    null,
    2,
  ),
);
await cp(path.join(ROOT, 'desktop'), path.join(APP, 'desktop'), { recursive: true });
await cp(path.join(ROOT, 'dist'), path.join(APP, 'dist'), { recursive: true });
// 运行时依赖：dist 里只有 obfuscate 引 pngjs（mcp.js 的 sdk/zod 桌面壳不加载）
await mkdir(path.join(APP, 'node_modules'), { recursive: true });
await cp(path.join(ROOT, 'node_modules', 'pngjs'), path.join(APP, 'node_modules', 'pngjs'), { recursive: true });
console.log('[2/4] app body copied (desktop + dist + pngjs)');

// 3) exe 改名
await rename(path.join(OUT, 'electron.exe'), path.join(OUT, EXE_NAME));
console.log(`[3/4] exe renamed -> ${EXE_NAME}`);

// 4) 自检
const exePath = path.join(OUT, EXE_NAME);
const { stat } = await import('node:fs/promises');
const s = await stat(exePath);
console.log(`[4/4] packed: ${exePath} (${(s.size / 1024 / 1024).toFixed(1)} MB)`);
