import { readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_IGNORE_DIRS } from '../util/fsutil.js';

export interface RenameOptions {
  dir: string;
  /** 要查找的内容：正则（byRegex=true）或字面子串 */
  find?: string;
  /** 替换为；正则模式下支持 $1 引用 */
  replace?: string;
  byRegex?: boolean;
  /**
   * 模板命名模式，优先于 find/replace：
   * {n} 序号、{name} 原名（不含扩展名）、{ext} 扩展名、{date} 修改日期 YYYYMMDD
   * 例: "{n}-{name}" → "01-photo.jpg"；模板不含 {ext} 时自动保留原扩展名
   */
  template?: string;
  /** 序号起始，默认 1 */
  startAt?: number;
  /** 序号补零位数，默认 2 */
  pad?: number;
  recursive?: boolean;
  dryRun?: boolean;
  /** 只处理这些扩展名，如 "*.jpg" 或 "*.png,*.jpeg" */
  includeExt?: string;
}

export interface RenameChange {
  from: string; // 相对目录的路径
  to: string;
  applied: boolean;
  skippedReason?: string;
}

export interface RenameOutcome {
  changes: RenameChange[];
  applied: boolean;
}

function extAllowed(name: string, includeExt?: string): boolean {
  if (!includeExt) return true;
  const ext = path.extname(name).toLowerCase();
  return includeExt
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((pat) => {
      const p = (pat.startsWith('*') ? pat.slice(1) : pat.startsWith('.') ? pat : `.${pat}`).toLowerCase();
      return ext === p;
    });
}

async function collectFiles(dir: string, recursive: boolean): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isFile()) {
      out.push(full);
    } else if (e.isDirectory() && recursive && !DEFAULT_IGNORE_DIRS.has(e.name)) {
      out.push(...(await collectFiles(full, true)));
    }
  }
  return out.sort();
}

export async function batchRename(opts: RenameOptions): Promise<RenameOutcome> {
  const pad = opts.pad ?? 2;
  const startAt = opts.startAt ?? 1;

  let re: RegExp | null = null;
  if (opts.template) {
    // template 模式下忽略 find/replace
  } else if (opts.find !== undefined) {
    if (opts.byRegex) {
      try {
        re = new RegExp(opts.find, 'g');
      } catch (e) {
        throw new Error(`无效的正则表达式: ${(e as Error).message}`);
      }
    }
  } else {
    throw new Error('必须提供 find 或 template 之一');
  }

  const st = await stat(opts.dir).catch(() => null);
  if (!st) throw new Error(`目录不存在: ${opts.dir}`);
  if (!st.isDirectory()) throw new Error(`不是目录: ${opts.dir}`);

  const files = await collectFiles(opts.dir, opts.recursive ?? false);

  const changes: RenameChange[] = [];
  const claimed = new Set<string>(); // 本轮已占用的目标绝对路径（小写，兼容 Windows）
  let seq = startAt;

  for (const full of files) {
    const name = path.basename(full);
    if (!extAllowed(name, opts.includeExt)) continue;
    const ext = path.extname(name);
    const base = name.slice(0, name.length - ext.length);
    const rel = path.relative(opts.dir, full);

    let newName: string;
    if (opts.template) {
      const d = new Date();
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      let newBase = opts.template
        .replace(/\{n\}/g, String(seq).padStart(pad, '0'))
        .replace(/\{name\}/g, base)
        .replace(/\{date\}/g, ymd)
        .replace(/\{ext\}/g, ext.replace(/^\./, ''));
      seq++;
      if (!/\{ext\}/.test(opts.template)) newBase += ext;
      newName = newBase;
    } else if (re) {
      newName = `${base.replace(re, opts.replace ?? '')}${ext}`;
    } else {
      // 字面替换作用于完整文件名（含扩展名），支持直接改扩展名（如 txt → md）
      newName = name.split(opts.find!).join(opts.replace ?? '');
    }

    if (newName === name) {
      changes.push({ from: rel, to: rel, applied: false, skippedReason: '无需改名' });
      continue;
    }

    const newPath = path.join(path.dirname(full), newName);
    const newPathKey = newPath.toLowerCase();
    const exists = await stat(newPath).then(
      () => true,
      () => false,
    );
    if (exists || claimed.has(newPathKey)) {
      changes.push({ from: rel, to: newName, applied: false, skippedReason: '与现有文件重名，已跳过（可加序号模板解决）' });
      continue;
    }
    claimed.add(newPathKey);

    if (opts.dryRun) {
      changes.push({ from: rel, to: newName, applied: false });
    } else {
      await rename(full, newPath);
      changes.push({ from: rel, to: newName, applied: true });
    }
  }

  return { changes, applied: !opts.dryRun && changes.some((c) => c.applied) };
}
