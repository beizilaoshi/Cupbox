// Cupbox 数据目录（v1.2.0）：默认存在系统「文档」目录（~/Documents/Cupbox），
// 便于用户找到与备份；CUPBOX_HOME 仍可整体覆盖（测试与便携场景）。
// 旧版 ~/.cupbox 首次启动自动迁移（只复制不删除，失败静默、不影响启动）。
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

/** 旧版数据目录（v1.1.x 及以前）：~/.cupbox */
export function legacyHome(): string {
  return path.join(homedir(), '.cupbox');
}

let cachedDocsDir: string | null | undefined;

/**
 * 解析系统「文档」目录本身：
 *   Windows → Known Folder `Personal`（跟随重定向，例如 Documents 被搬到 D:\文件）
 *   其余平台 → ~/Documents
 * 任何失败都回退 ~/Documents；结果缓存（每次进程只探测一次）。
 */
export function systemDocumentsDir(): string {
  if (cachedDocsDir !== undefined && cachedDocsDir !== null) return cachedDocsDir;
  let dir: string | undefined;
  if (process.platform === 'win32') {
    try {
      const r = spawnSync(
        'reg',
        ['query', String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders`, '/v', 'Personal'],
        { encoding: 'buffer', timeout: 3000 },
      );
      if (r.status === 0 && r.stdout?.length) {
        let text = '';
        // reg 输出编码随控制台代码页变化：先按 UTF-8 严格解，失败再按 GB18030
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(r.stdout); }
        catch { try { text = new TextDecoder('gb18030').decode(r.stdout); } catch { text = ''; } }
        const m = text.match(/Personal\s+REG_(?:EXPAND_)?SZ\s+(.+)/);
        if (m) {
          // REG_EXPAND_SZ：展开 %USERPROFILE% 之类变量
          const expanded = m[1].trim().replace(/%([^%]+)%/g, (_s, k) => process.env[k] ?? '');
          if (expanded) dir = expanded;
        }
      }
    } catch { /* 回退 */ }
  }
  if (!dir || !existsSync(dir)) dir = path.join(homedir(), 'Documents');
  cachedDocsDir = dir;
  return dir;
}

/**
 * 解析当前数据目录：
 *   CUPBOX_HOME 有值 → $CUPBOX_HOME/.cupbox（与旧语义一致）
 *   否则 → <Documents>/Cupbox（Windows 按 Known Folder 解析，三形态与桌面 app.getPath('documents') 一致）
 *   Documents 不存在时退回 ~/.cupbox
 * @param documentsDir 可选：系统「文档」目录（桌面端传 app.getPath('documents')）
 */
export function dataHome(documentsDir?: string): string {
  const env = process.env.CUPBOX_HOME;
  if (env && env.trim()) return path.join(env.trim(), '.cupbox');
  const docs = documentsDir ?? systemDocumentsDir();
  return existsSync(docs) ? path.join(docs, 'Cupbox') : legacyHome();
}

/**
 * 一次性迁移：旧 ~/.cupbox 有数据且新目录为空时，整树复制过去。
 * 返回是否发生了迁移。任何失败都吞掉（不阻塞启动、不删旧数据）。
 */
export async function migrateLegacyHome(
  opts: { target?: string; legacy?: string } = {},
): Promise<boolean> {
  // 显式指定 CUPBOX_HOME = 完全隔离（测试/便携），不做迁移
  if (process.env.CUPBOX_HOME?.trim()) return false;
  const target = opts.target ?? dataHome();
  const legacy = opts.legacy ?? legacyHome();
  try {
    if (path.resolve(legacy) === path.resolve(target)) return false;
    if (!existsSync(legacy)) return false;
    if (existsSync(target)) {
      const entries = await readdir(target);
      if (entries.length > 0) return false; // 新目录已有内容，绝不覆盖
    }
    await mkdir(target, { recursive: true });
    for (const e of await readdir(legacy, { withFileTypes: true })) {
      const from = path.join(legacy, e.name);
      const to = path.join(target, e.name);
      if (e.isDirectory()) await copyDir(from, to);
      else if (e.isFile()) {
        await mkdir(path.dirname(to), { recursive: true });
        await copyFile(from, to);
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function copyDir(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true });
  for (const e of await readdir(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    const dst = path.join(to, e.name);
    if (e.isDirectory()) await copyDir(src, dst);
    else if (e.isFile()) await copyFile(src, dst);
  }
}
