import { readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';

/** 常见噪音目录，遍历时默认跳过。 */
export const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.idea',
  '.vscode',
  '__pycache__',
  '.venv',
  'venv',
  'dist',
  'build',
  '.next',
  '.cache',
  '.turbo',
]);

export interface WalkEntry {
  path: string;
  name: string;
  isFile: boolean;
  isDir: boolean;
}

/** 递归遍历目录（不进入符号链接，跳过噪音目录）。 */
export async function walk(
  root: string,
  opts: { ignoreDirs?: Set<string>; includeHidden?: boolean; maxDepth?: number } = {},
): Promise<WalkEntry[]> {
  const ignore = opts.ignoreDirs ?? DEFAULT_IGNORE_DIRS;
  const out: WalkEntry[] = [];

  async function go(dir: string, depth: number): Promise<void> {
    if (opts.maxDepth !== undefined && depth > opts.maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // 无权限/不存在的目录静默跳过
    }
    for (const e of entries) {
      if (!opts.includeHidden && e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (ignore.has(e.name)) continue;
        out.push({ path: full, name: e.name, isFile: false, isDir: true });
        await go(full, depth + 1);
      } else if (e.isFile() || e.isSymbolicLink()) {
        out.push({ path: full, name: e.name, isFile: true, isDir: false });
      }
    }
  }

  await go(root, 0);
  return out;
}

export type CollisionPolicy = 'rename' | 'skip' | 'overwrite';

export interface MoveResult {
  from: string;
  to: string;
  applied: boolean;
  skippedReason?: string;
}

/** 生成不冲突的目标路径：`a.txt` → `a (1).txt`。 */
export async function uniquePath(target: string): Promise<string> {
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  for (let i = 1; i < 10000; i++) {
    const candidate = path.join(dir, `${base} (${i})${ext}`);
    try {
      await stat(candidate);
    } catch {
      return candidate;
    }
  }
  throw new Error('同名文件过多，放弃生成新名字');
}

/**
 * 移动文件并按策略处理同名冲突。绝不静默覆盖（除非显式 overwrite）。
 */
export async function safeMove(
  from: string,
  to: string,
  policy: CollisionPolicy = 'rename',
  dryRun = false,
): Promise<MoveResult> {
  let finalTo = to;
  try {
    const st = await stat(to);
    if (st.isFile() || st.isDirectory()) {
      if (policy === 'skip') {
        return { from, to, applied: false, skippedReason: '目标已存在' };
      }
      if (policy === 'rename') {
        finalTo = await uniquePath(to);
      }
      // overwrite: 直接覆盖
    }
  } catch {
    // 目标不存在，直接移动
  }
  if (from === finalTo) {
    return { from, to: finalTo, applied: false, skippedReason: '源与目标相同' };
  }
  if (dryRun) {
    return { from, to: finalTo, applied: false };
  }
  await rename(from, finalTo);
  return { from, to: finalTo, applied: true };
}
