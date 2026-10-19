import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { walk, DEFAULT_IGNORE_DIRS } from '../util/fsutil.js';

export interface SearchOptions {
  root: string;
  /** 文件名匹配：子串（默认，不区分大小写）或正则 */
  pattern?: string;
  /** 内容匹配：子串或正则 */
  content?: string;
  /** pattern/content 按正则解释 */
  regex?: boolean;
  /** 扩展名过滤，如 "*.ts" 或 ".ts" */
  glob?: string;
  maxResults?: number;
  includeHidden?: boolean;
  /** 附加忽略目录名 */
  ignoreDirs?: string[];
  /** 最大读取的单文件字节数（内容搜索），默认 2MB */
  maxFileBytes?: number;
  /** 每个文件返回的命中行上限 */
  maxLinesPerFile?: number;
}

export interface ContentHit {
  line: number;
  text: string;
}

export interface SearchHit {
  path: string;
  matches: ContentHit[];
}

export interface SearchOutcome {
  hits: SearchHit[];
  truncated: boolean;
  scannedFiles: number;
}

function buildMatcher(q: string, regex: boolean, caseInsensitive = true): (s: string) => boolean {
  if (regex) {
    const re = new RegExp(q, caseInsensitive ? 'i' : '');
    return (s) => re.test(s);
  }
  const needle = caseInsensitive ? q.toLowerCase() : q;
  return (s) => (caseInsensitive ? s.toLowerCase() : s).includes(needle);
}

function globToRegex(glob: string): RegExp {
  let g = glob.trim();
  if (!g.includes('*') && !g.includes('?')) {
    // 纯扩展名简写："ts" / ".ts" → "*.ts"
    g = g.startsWith('.') ? `*${g}` : `*.${g}`;
  }
  const esc = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${esc}$`, 'i');
}

const TEXT_EXT_HINT =
  /\.(txt|md|markdown|json|jsonc|ya?ml|toml|ini|cfg|conf|xml|html?|css|scss|less|jsx?|tsx?|mjs|cjs|py|rb|go|rs|java|kt|c|cc|cpp|h|hpp|cs|php|sh|bash|zsh|ps1|bat|cmd|sql|csv|tsv|log|env|gitignore|dockerfile|makefile|properties|gradle|svelte|vue|astro|ex|exs|erl|hs|lua|r|m|mm|swift|dart|nim|zig|tf|hcl|proto|graphql|lock|sum|mod|txt\.in)$/i;

/** 简单启发式：跳过明显不是文本的文件。 */
function looksTextual(name: string, size: number): boolean {
  if (size === 0) return true;
  if (TEXT_EXT_HINT.test(name)) return true;
  if (!path.extname(name)) return true; // 无扩展名（Dockerfile、Makefile…）
  return false;
}

export async function search(opts: SearchOptions): Promise<SearchOutcome> {
  if (!opts.pattern && !opts.content) throw new Error('pattern 与 content 至少提供一个');
  const maxResults = opts.maxResults ?? 200;
  const maxFileBytes = opts.maxFileBytes ?? 2 * 1024 * 1024;
  const maxLinesPerFile = opts.maxLinesPerFile ?? 5;

  const nameMatch = opts.pattern ? buildMatcher(opts.pattern, opts.regex ?? false) : null;
  const contentMatcher = opts.content ? buildMatcher(opts.content, opts.regex ?? false) : null;
  const globRe = opts.glob ? globToRegex(opts.glob) : null;

  const ignore = new Set(DEFAULT_IGNORE_DIRS);
  for (const d of opts.ignoreDirs ?? []) ignore.add(d);

  const entries = await walk(opts.root, { ignoreDirs: ignore, includeHidden: opts.includeHidden });
  const hits: SearchHit[] = [];
  let truncated = false;
  let scannedFiles = 0;

  for (const entry of entries) {
    if (!entry.isFile) continue;
    if (globRe && !globRe.test(entry.name)) continue;
    const nameHit = nameMatch ? nameMatch(entry.name) : false;

    // 只按名称搜索时，命中即收；带内容搜索时才读文件
    if (!contentMatcher) {
      if (!nameMatch || !nameHit) continue;
      if (hits.length >= maxResults) {
        truncated = true;
        break;
      }
      hits.push({ path: entry.path, matches: [] });
      continue;
    }

    // 内容搜索：跳过明显二进制或超大文件（除非文件名已命中）
    let size = 0;
    try {
      size = (await stat(entry.path)).size;
    } catch {
      continue;
    }
    if (size > maxFileBytes) {
      if (nameHit) {
        if (hits.length >= maxResults) {
          truncated = true;
          break;
        }
        hits.push({ path: entry.path, matches: [] });
      }
      continue;
    }
    if (!looksTextual(entry.name, size) && !nameHit) continue;

    scannedFiles++;
    let text: string;
    try {
      const buf = await readFile(entry.path);
      // 含 NUL 视为二进制
      if (buf.includes(0) && !nameHit) continue;
      text = buf.toString('utf8');
    } catch {
      continue;
    }

    const matches: ContentHit[] = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (contentMatcher(lines[i])) {
        matches.push({ line: i + 1, text: lines[i].slice(0, 300) });
        if (matches.length >= maxLinesPerFile) break;
      }
    }
    if (matches.length > 0 || nameHit) {
      if (hits.length >= maxResults) {
        truncated = true;
        break;
      }
      hits.push({ path: entry.path, matches });
    }
  }

  return { hits, truncated, scannedFiles };
}
