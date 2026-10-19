import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { safeMove, type CollisionPolicy } from '../util/fsutil.js';

export interface OrganizeOptions {
  dir: string;
  /** category=按文件类型分类; date=按修改年月归档; regex=自定义正则捕获子目录 */
  mode: 'category' | 'date' | 'regex';
  /** date 模式取哪个时间，默认 modified */
  dateField?: 'created' | 'modified';
  /** regex 模式：匹配文件名，第 1 个捕获组作为子目录名 */
  pattern?: string;
  /** category 模式：folderMap 可覆盖默认分类 */
  folderMap?: Record<string, string>;
  /** 空目录是否在整理后删除，默认 false */
  cleanupEmptyDirs?: boolean;
  collision?: CollisionPolicy;
  dryRun?: boolean;
  /** 递归处理子目录中的文件（文件本身仍移动到 dir 下的分类目录），默认 false */
  recursive?: boolean;
}

export interface OrganizeChange {
  from: string; // 相对 dir
  to: string; // 相对 dir
  applied: boolean;
  skippedReason?: string;
}

export interface OrganizeOutcome {
  changes: OrganizeChange[];
  applied: boolean;
}

/** 扩展名 → 分类目录（英文目录名，跨平台友好）。 */
export const DEFAULT_CATEGORY_MAP: Record<string, string> = {
  // 文档
  '.pdf': 'Documents', '.doc': 'Documents', '.docx': 'Documents', '.xls': 'Documents',
  '.xlsx': 'Documents', '.ppt': 'Documents', '.pptx': 'Documents', '.txt': 'Documents',
  '.md': 'Documents', '.markdown': 'Documents', '.rtf': 'Documents', '.epub': 'Documents',
  // 图片
  '.png': 'Images', '.jpg': 'Images', '.jpeg': 'Images', '.gif': 'Images', '.webp': 'Images',
  '.bmp': 'Images', '.svg': 'Images', '.ico': 'Images', '.heic': 'Images', '.avif': 'Images',
  '.psd': 'Images', '.raw': 'Images',
  // 视频
  '.mp4': 'Videos', '.mkv': 'Videos', '.avi': 'Videos', '.mov': 'Videos', '.wmv': 'Videos',
  '.flv': 'Videos', '.webm': 'Videos', '.m4v': 'Videos', '.mpg': 'Videos', '.mpeg': 'Videos',
  // 音频
  '.mp3': 'Audio', '.wav': 'Audio', '.flac': 'Audio', '.aac': 'Audio', '.ogg': 'Audio',
  '.m4a': 'Audio', '.wma': 'Audio', '.opus': 'Audio',
  // 压缩包
  '.zip': 'Archives', '.rar': 'Archives', '.7z': 'Archives', '.tar': 'Archives',
  '.gz': 'Archives', '.tgz': 'Archives', '.bz2': 'Archives', '.xz': 'Archives', '.iso': 'Archives',
  // 代码
  '.js': 'Code', '.ts': 'Code', '.jsx': 'Code', '.tsx': 'Code', '.py': 'Code', '.java': 'Code',
  '.c': 'Code', '.cpp': 'Code', '.h': 'Code', '.hpp': 'Code', '.cs': 'Code', '.go': 'Code',
  '.rs': 'Code', '.rb': 'Code', '.php': 'Code', '.swift': 'Code', '.kt': 'Code', '.scala': 'Code',
  '.sh': 'Code', '.ps1': 'Code', '.bat': 'Code', '.sql': 'Code', '.html': 'Code', '.css': 'Code',
  '.vue': 'Code', '.svelte': 'Code', '.lua': 'Code', '.r': 'Code', '.m': 'Code', '.dart': 'Code',
  // 数据
  '.json': 'Data', '.yaml': 'Data', '.yml': 'Data', '.toml': 'Data', '.xml': 'Data',
  '.csv': 'Data', '.tsv': 'Data', '.db': 'Data', '.sqlite': 'Data', '.parquet': 'Data',
  '.env': 'Data',
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export async function organize(opts: OrganizeOptions): Promise<OrganizeOutcome> {
  const st = await stat(opts.dir).catch(() => null);
  if (!st) throw new Error(`目录不存在: ${opts.dir}`);
  if (!st.isDirectory()) throw new Error(`不是目录: ${opts.dir}`);

  let re: RegExp | null = null;
  if (opts.mode === 'regex') {
    if (!opts.pattern) throw new Error('mode=regex 时必须提供 pattern');
    try {
      re = new RegExp(opts.pattern);
    } catch (e) {
      throw new Error(`无效的正则表达式: ${(e as Error).message}`);
    }
  }

  const dateField = opts.dateField ?? 'modified';
  const folderMap: Record<string, string> = { ...DEFAULT_CATEGORY_MAP, ...(opts.folderMap ?? {}) };

  // 收集待整理文件（只看直接子文件，除非 recursive；且不进入目标分类目录）
  const categoryFolders = new Set(Object.values({ ...DEFAULT_CATEGORY_MAP }));
  const entries = await readdir(opts.dir, { withFileTypes: true });
  const targets: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(opts.dir, e.name);
    if (e.isFile()) {
      targets.push(full);
    } else if (e.isDirectory() && (opts.recursive || categoryFolders.has(e.name))) {
      // 分类目录本身也扫（让“已在目标目录”可见）；其余子目录仅 recursive 时扫
      const sub = await readdir(full, { withFileTypes: true });
      for (const s of sub) {
        if (s.isFile() && !s.name.startsWith('.')) targets.push(path.join(full, s.name));
      }
    }
  }

  const changes: OrganizeChange[] = [];
  for (const full of targets) {
    const name = path.basename(full);
    const ext = path.extname(name).toLowerCase();
    let sub: string | null = null;

    if (opts.mode === 'category') {
      sub = folderMap[ext] ?? 'Other';
    } else if (opts.mode === 'date') {
      try {
        const s = await stat(full);
        const d = dateField === 'created' ? s.birthtime : s.mtime;
        if (Number.isNaN(d.getTime()) || d.getFullYear() < 1971) {
          sub = `${d.getFullYear()}`; // 无法取创建时间时兜底
        } else {
          sub = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
        }
      } catch {
        changes.push({ from: path.relative(opts.dir, full), to: '(无法读取时间)', applied: false, skippedReason: 'stat 失败' });
        continue;
      }
    } else {
      const m = re!.exec(name);
      if (!m || !m[1]) {
        changes.push({ from: path.relative(opts.dir, full), to: '(未匹配)', applied: false, skippedReason: '正则未匹配或缺少捕获组' });
        continue;
      }
      sub = m[1].trim();
      if (!sub || /[\\/]/.test(sub)) {
        changes.push({ from: path.relative(opts.dir, full), to: '(非法)', applied: false, skippedReason: '捕获组含路径分隔符，不安全' });
        continue;
      }
    }

    const destDir = path.join(opts.dir, sub);
    const dest = path.join(destDir, name);
    // 目标目录位置被同名文件占用（如捕获组=完整文件名）→ 安全跳过，绝不 mkdir 崩溃
    const dirStat = await stat(destDir).catch(() => null);
    if (dirStat && !dirStat.isDirectory()) {
      changes.push({ from: path.relative(opts.dir, full), to: '(不可用)', applied: false, skippedReason: '目标目录位置被同名文件占用，已跳过' });
      continue;
    }
    // 已经在正确分类目录里的文件跳过
    if (path.dirname(full).toLowerCase() === destDir.toLowerCase()) {
      changes.push({ from: path.relative(opts.dir, full), to: path.relative(opts.dir, dest), applied: false, skippedReason: '已在目标目录' });
      continue;
    }

    if (!opts.dryRun) {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(destDir, { recursive: true });
    }
    const result = await safeMove(full, dest, opts.collision ?? 'rename', opts.dryRun ?? false);
    changes.push({
      from: path.relative(opts.dir, result.from),
      to: path.relative(opts.dir, result.to),
      applied: result.applied,
      skippedReason: result.skippedReason,
    });
  }

  if (opts.cleanupEmptyDirs && !opts.dryRun) {
    const { rm } = await import('node:fs/promises');
    for (const e of entries) {
      if (!e.isDirectory() || categoryFolders.has(e.name)) continue;
      const sub = path.join(opts.dir, e.name);
      try {
        const left = await readdir(sub);
        if (left.length === 0) await rm(sub, { recursive: false });
      } catch {
        /* 忽略 */
      }
    }
  }

  return { changes, applied: !opts.dryRun && changes.some((c) => c.applied) };
}
