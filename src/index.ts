#!/usr/bin/env node
/**
 * cupbox CLI 入口：把杂活儿交给命令行。
 * 用法见 `cupbox help`。
 */
import { parseArgs } from 'node:util';
import path from 'node:path';
import { stat, readFile, writeFile } from 'node:fs/promises';

import { hash, isSupportedAlgo, type HashAlgo } from './core/hash.js';
import { fromTimestamp, fromDateString, nowInfo } from './core/time.js';
import {
  base64Encode, base64Decode, urlEncode, urlDecode,
  htmlEscape, htmlUnescape, jsonFormat, jsonMinify,
} from './core/codec.js';
import { search } from './core/search.js';
import { batchRename } from './core/rename.js';
import { organize } from './core/organize.js';
import { csvToJson, jsonToCsv } from './core/csv.js';
import { ocr } from './core/ocr.js';
import { clipRead, clipWrite } from './core/clip.js';
import { screenshot } from './core/shot.js';
import { zipCreate, zipExtract, zipList } from './core/zip.js';
import { safeRun } from './core/run.js';
import { isWindows } from './util/platform.js';
import { listProcesses, killProcess } from './core/proc.js';
import { VERSION } from './version.js';

/**
 * 按词加 shell 引号（POSIX）：命令经 shell 执行时，括号/引号/重定向等
 * 元字符会被 sh 解析（如 `console.log(40+2)` 在 sh 中是语法错误）。
 * Windows cmd 保持原样（现有行为已在测试中验证）。
 */
function quoteShellWord(word: string): string {
  if (isWindows()) return word;
  if (/^[A-Za-z0-9_\-./:=,@%+]+$/.test(word)) return word;
  return `'${word.replace(/'/g, `'\\''`)}'`;
}

const HELP = `cupbox v${VERSION} — 把杂活儿交给命令行和 AI

用法: cupbox <命令> [参数]

文件杂活:
  search   <目录> -p 文件名 [-c 内容] [--glob *.ts] [--regex] [--max 200]
                     搜索文件名/内容（跳过 node_modules/.git）
  rename   <目录> --find 查找 --replace 替换 [--regex] [--template "{n}-{name}"]
                     [--ext *.jpg] [--recursive] [--dry-run] 批量重命名
  organize <目录> [--mode category|date|regex] [--pattern 正则] [--dry-run]
                     [--cleanup] 按类型/日期/正则整理文件夹

数据杂活:
  hash     --text 文本 | --file 路径 [--algo sha256,md5]   计算哈希
  time     [时间戳或日期]                                  时间转换（缺省=当前）
  codec    <操作> 文本                                     b64e/b64d/urle/urlde/
                                                           html-esc/html-unesc/json/json-min
  csv      <文件.csv|.json> [-o 输出] [--to json|csv]       CSV ↔ JSON
  zip      create <out.zip> <文件...> | extract <zip> [目录] | list <zip>

系统杂活:
  ocr      <图片> [--lang zh-Hans] [--engine auto|windows|tesseract]
  clip     [read | write 文本]                             读/写剪贴板
  shot     [--out 路径.png]                                截屏
  run      [--timeout 60000] [--cwd 目录] [--allow 前缀] -- <命令...>
                                                           受保护地执行命令
  proc     [list] [--query 关键字] | kill --pid N --name 名字

AI 接入:
  mcp      启动 MCP 服务器（stdio），供 Claude Desktop / Cursor / Cline 使用

其他:
  help     显示帮助      version 显示版本
  全部命令支持 --json 输出（机器可读）

示例:
  cupbox organize ~/Downloads --mode category --dry-run
  cupbox rename ./photos --template "{n}-{name}" --ext *.jpg --dry-run
  cupbox ocr ./截图.png --lang zh-Hans
  cupbox time 1700000000
  cupbox mcp
`;

function die(msg: string, code = 1): never {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

type Opts = Record<string, boolean | string | string[] | undefined>;

/** parseArgs 的类型安全包装：按 spec 的字面量类型精确推断 values。 */
function parse<T extends Record<string, { type: 'boolean' | 'string' }>>(
  rest: string[],
  spec: T,
): {
  values: { [K in keyof T]: T[K]['type'] extends 'boolean' ? boolean | undefined : string | undefined };
  positionals: string[];
} {
  try {
    return parseArgs({ args: rest, allowPositionals: true, options: spec }) as unknown as {
      values: { [K in keyof T]: T[K]['type'] extends 'boolean' ? boolean | undefined : string | undefined };
      positionals: string[];
    };
  } catch (e) {
    die(`参数错误: ${(e as Error).message}\n\n${HELP}`, 2);
  }
}
// 便捷 schema 构造（保持类型推断简单）
function _boolean() {
  return { type: 'boolean' as const };
}
function _string() {
  return { type: 'string' as const };
}
function _number() {
  return { type: 'string' as const }; // parseArgs number 类型较新，统一按 string 解析再转换
}

function toInt(v: string | undefined, name: string, def?: number): number | undefined {
  if (v === undefined) return def;
  const n = Number(v);
  if (!Number.isInteger(n)) die(`${name} 必须是整数，收到: ${v}`);
  return n;
}

function relOrAbs(p: string): string {
  return path.resolve(p);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return;
  }
  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    console.log(VERSION);
    return;
  }
  if (cmd === 'mcp') {
    const { startMcpServer } = await import('./mcp.js');
    await startMcpServer();
    return;
  }

  switch (cmd) {
    // ---------------- hash ----------------
    case 'hash': {
      const { values } = parse(rest, { text: _string(), file: _string(), algo: _string(), json: _boolean() });
      const algos = (values.algo ?? 'sha256').split(',').map((s) => s.trim()).filter(Boolean);
      for (const a of algos) if (!isSupportedAlgo(a)) die(`不支持的算法: ${a}（支持 md5/sha1/sha256/sha512）`);
      if (!values.text && !values.file) die('需要 --text 或 --file');
      const r = await hash(
        { ...(values.text !== undefined ? { text: values.text } : {}), ...(values.file ? { file: relOrAbs(values.file) } : {}) },
        algos as HashAlgo[],
      );
      if (values.json) console.log(JSON.stringify(r, null, 2));
      else for (const [k, v] of Object.entries(r)) console.log(`${k}: ${v}`);
      return;
    }

    // ---------------- time ----------------
    case 'time': {
      const { values, positionals } = parse(rest, { json: _boolean() });
      const input = positionals.join(' ').trim();
      const r = !input
        ? nowInfo()
        : /^-?\d+$/.test(input)
          ? fromTimestamp(input)
          : fromDateString(input);
      if (values.json) {
        console.log(JSON.stringify(r, null, 2));
      } else {
        console.log(`Unix 秒:    ${r.unixSeconds}`);
        console.log(`Unix 毫秒:  ${r.unixMilliseconds}`);
        console.log(`ISO 8601:   ${r.iso}`);
        console.log(`UTC:        ${r.utc}`);
        console.log(`北京时间:   ${r.cst}`);
        console.log(`相对时间:   ${r.relative}`);
      }
      return;
    }

    // ---------------- codec ----------------
    case 'codec': {
      const { positionals } = parse(rest, {});
      const [op, ...textParts] = positionals;
      if (!op || textParts.length === 0) {
        die('用法: cupbox codec <b64e|b64d|urle|urlde|html-esc|html-unesc|json|json-min> <文本>');
      }
      const text = textParts.join(' ');
      const map: Record<string, (s: string) => string> = {
        b64e: base64Encode, b64d: base64Decode,
        urle: urlEncode, urlde: urlDecode,
        'html-esc': htmlEscape, 'html-unesc': htmlUnescape,
        json: jsonFormat, 'json-min': jsonMinify,
      };
      const fn = map[op];
      if (!fn) die(`未知操作: ${op}（可选 ${Object.keys(map).join('/')}）`);
      console.log(fn(text));
      return;
    }

    // ---------------- search ----------------
    case 'search': {
      const { values, positionals } = parse(rest, {
        p: _string(), pattern: _string(),
        c: _string(), content: _string(),
        glob: _string(), regex: _boolean(), max: _string(),
        hidden: _boolean(), json: _boolean(),
      });
      const root = positionals[0];
      if (!root) die('用法: cupbox search <目录> [-p 文件名] [-c 内容] [--glob *.ts] [--regex]');
      const pattern = values.p ?? values.pattern;
      const content = values.c ?? values.content;
      const r = await search({
        root: relOrAbs(root),
        ...(pattern ? { pattern } : {}),
        ...(content ? { content } : {}),
        ...(values.glob ? { glob: values.glob } : {}),
        ...(values.regex ? { regex: true } : {}),
        ...(values.max ? { maxResults: Number(values.max) } : {}),
        ...(values.hidden ? { includeHidden: true } : {}),
      });
      if (values.json) {
        console.log(JSON.stringify(r, null, 2));
        return;
      }
      if (r.hits.length === 0) {
        console.log(`没有找到匹配（已扫描 ${r.scannedFiles} 个文件）`);
        return;
      }
      console.log(`找到 ${r.hits.length} 个文件${r.truncated ? '（已截断）' : ''}，扫描 ${r.scannedFiles} 个：\n`);
      for (const h of r.hits) {
        console.log(h.path);
        for (const m of h.matches) console.log(`  L${m.line}: ${m.text.trim()}`);
      }
      return;
    }

    // ---------------- rename ----------------
    case 'rename': {
      const { values, positionals } = parse(rest, {
        find: _string(), replace: _string(), regex: _boolean(),
        template: _string(), pad: _string(), start: _string(),
        recursive: _boolean(), ext: _string(),
        'dry-run': _boolean(), json: _boolean(),
      });
      const dir = positionals[0];
      if (!dir) die('用法: cupbox rename <目录> --find 查找 --replace 替换 [--dry-run]（详见 help）');
      const dryRun = values['dry-run'] ?? false;
      const r = await batchRename({
        dir: relOrAbs(dir),
        ...(values.find !== undefined ? { find: values.find } : {}),
        ...(values.replace !== undefined ? { replace: values.replace } : {}),
        ...(values.regex ? { byRegex: true } : {}),
        ...(values.template ? { template: values.template } : {}),
        ...(toInt(values.pad, '--pad') ? { pad: toInt(values.pad, '--pad')! } : {}),
        ...(toInt(values.start, '--start') ? { startAt: toInt(values.start, '--start')! } : {}),
        ...(values.recursive ? { recursive: true } : {}),
        ...(values.ext ? { includeExt: values.ext } : {}),
        dryRun,
      });
      if (values.json) {
        console.log(JSON.stringify(r, null, 2));
        return;
      }
      for (const c of r.changes) {
        const tag = c.applied ? '✅' : c.skippedReason ? '⏭️' : '📋';
        console.log(`${tag} ${c.from}  →  ${c.to}${c.skippedReason ? `  [${c.skippedReason}]` : ''}`);
      }
      const changed = r.changes.filter((c) => c.to !== c.from).length;
      console.log(dryRun ? `\n📋 预览完毕（未执行），共 ${changed} 项将改名。去掉 --dry-run 执行。` : `\n✅ 完成，共 ${changed} 项改名。`);
      return;
    }

    // ---------------- organize ----------------
    case 'organize': {
      const { values, positionals } = parse(rest, {
        mode: _string(), pattern: _string(), date: _string(),
        recursive: _boolean(), cleanup: _boolean(),
        'dry-run': _boolean(), json: _boolean(),
      });
      const dir = positionals[0];
      if (!dir) die('用法: cupbox organize <目录> [--mode category|date|regex] [--dry-run]');
      const mode = (values.mode ?? 'category') as 'category' | 'date' | 'regex';
      if (!['category', 'date', 'regex'].includes(mode)) die(`无效 --mode: ${mode}`);
      const dryRun = values['dry-run'] ?? false;
      const r = await organize({
        dir: relOrAbs(dir),
        mode,
        ...(values.pattern ? { pattern: values.pattern } : {}),
        ...(values.date === 'created' || values.date === 'modified' ? { dateField: values.date } : {}),
        ...(values.recursive ? { recursive: true } : {}),
        ...(values.cleanup ? { cleanupEmptyDirs: true } : {}),
        dryRun,
      });
      if (values.json) {
        console.log(JSON.stringify(r, null, 2));
        return;
      }
      for (const c of r.changes) {
        const tag = c.applied ? '✅' : c.skippedReason ? '⏭️' : '📋';
        console.log(`${tag} ${c.from}  →  ${c.to}${c.skippedReason ? `  [${c.skippedReason}]` : ''}`);
      }
      const moved = r.changes.filter((c) => c.skippedReason === undefined).length;
      console.log(dryRun ? `\n📋 预览完毕（未执行），共 ${moved} 项将移动。去掉 --dry-run 执行。` : `\n✅ 整理完成，共 ${moved} 项移动。`);
      return;
    }

    // ---------------- csv ----------------
    case 'csv': {
      const { values, positionals } = parse(rest, {
        to: _string(), o: _string(), out: _string(),
        delimiter: _string(), 'no-header': _boolean(),
      });
      const file = positionals[0];
      if (!file) die('用法: cupbox csv <文件.csv|.json> [-o 输出] [--to json|csv]');
      const abs = relOrAbs(file);
      const text = await readFile(abs, 'utf8').catch((e) => die(`读取失败: ${e.message}`));
      const to = values.to ?? (abs.toLowerCase().endsWith('.json') ? 'csv' : 'json');
      const opts = {
        ...(values.delimiter ? { delimiter: values.delimiter } : {}),
        ...values['no-header'] ? { header: false } : {},
      };
      const result = to === 'json' ? csvToJson(text, opts) : jsonToCsv(text, opts);
      const outPath = values.o ?? values.out;
      if (outPath) {
        await writeFile(relOrAbs(outPath), result, 'utf8');
        console.log(`✅ 已写入 ${relOrAbs(outPath)}`);
      } else {
        console.log(result);
      }
      return;
    }

    // ---------------- ocr ----------------
    case 'ocr': {
      const { values, positionals } = parse(rest, {
        lang: _string(), engine: _string(), json: _boolean(),
      });
      const img = positionals[0];
      if (!img) die('用法: cupbox ocr <图片> [--lang zh-Hans] [--engine auto|windows|tesseract]');
      const engine = values.engine as 'auto' | 'windows' | 'tesseract' | undefined;
      if (engine && !['auto', 'windows', 'tesseract'].includes(engine)) die(`无效 --engine: ${engine}`);
      const r = await ocr({
        imagePath: relOrAbs(img),
        ...(values.lang ? { lang: values.lang } : {}),
        ...(engine ? { engine } : {}),
      });
      if (values.json) {
        console.log(JSON.stringify(r, null, 2));
      } else {
        if (r.lang) console.error(`（引擎: ${r.engine}, 语言: ${r.lang}）`);
        console.log(r.text);
      }
      return;
    }

    // ---------------- clip ----------------
    case 'clip': {
      const { positionals } = parse(rest, {});
      const action = positionals[0] ?? 'read';
      if (action === 'read') {
        const r = await clipRead();
        console.log(r.content ?? '');
        return;
      }
      if (action === 'write') {
        const text = positionals.slice(1).join(' ');
        if (!text) die('用法: cupbox clip write <文本>');
        const r = await clipWrite(text);
        console.log(`✅ ${r.message ?? '已写入'}`);
        return;
      }
      die('用法: cupbox clip [read|write <文本>]');
      return;
    }

    // ---------------- shot ----------------
    case 'shot': {
      const { values } = parse(rest, { out: _string() });
      const r = await screenshot(values.out ? { outputPath: values.out } : {});
      console.log(`✅ 截屏已保存: ${r.path}`);
      return;
    }

    // ---------------- zip ----------------
    case 'zip': {
      const sub = rest[0];
      if (sub === 'create') {
        const { positionals } = parse(rest.slice(1), {});
        const [out, ...sources] = positionals;
        if (!out || sources.length === 0) die('用法: cupbox zip create <out.zip> <文件或目录...>');
        const r = await zipCreate({ output: relOrAbs(out), sources: sources.map(relOrAbs) });
        console.log(`✅ ${r.message}: ${r.output}`);
        return;
      }
      if (sub === 'extract') {
        const { positionals } = parse(rest.slice(1), {});
        const [zipFile, dest] = positionals;
        if (!zipFile) die('用法: cupbox zip extract <zip文件> [目标目录]');
        const r = await zipExtract(relOrAbs(zipFile), relOrAbs(dest ?? '.'));
        console.log(`✅ ${r.message}: ${r.output}`);
        return;
      }
      if (sub === 'list') {
        const { positionals } = parse(rest.slice(1), {});
        if (!positionals[0]) die('用法: cupbox zip list <zip文件>');
        const entries = await zipList(relOrAbs(positionals[0]));
        console.log(`共 ${entries.length} 项：`);
        for (const e of entries.slice(0, 500)) console.log(e);
        return;
      }
      die('用法: cupbox zip create|extract|list ...');
      return;
    }

    // ---------------- run ----------------
    case 'run': {
      let commandWords: string[];
      let timeoutMs: number | undefined;
      let cwd: string | undefined;
      let allow: string[] | undefined;

      if (rest[0] === '--') {
        commandWords = rest.slice(1);
      } else {
        const parsed = parseArgs({
          args: rest,
          allowPositionals: true,
          stopAtPositional: true,
          options: { timeout: _string(), cwd: _string(), allow: _string() },
        });
        commandWords = parsed.positionals;
        timeoutMs = toInt(parsed.values.timeout as string | undefined, '--timeout');
        cwd = parsed.values.cwd as string | undefined;
        allow = (parsed.values.allow as string | undefined)?.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (commandWords.length === 0) die('用法: cupbox run [--timeout 60000] [--allow npm,git] -- <命令...>');
      const r = await safeRun(commandWords.map(quoteShellWord).join(' '), {
        ...(timeoutMs ? { timeoutMs } : {}),
        ...(cwd ? { cwd: relOrAbs(cwd) } : {}),
        ...(allow ? { allowPrefixes: allow } : {}),
      });
      if (r.stdout) process.stdout.write(r.stdout.endsWith('\n') ? r.stdout : r.stdout + '\n');
      if (r.stderr) process.stderr.write(r.stderr.endsWith('\n') ? r.stderr : r.stderr + '\n');
      const flags = [
        `exit=${r.exitCode}`,
        `${r.durationMs}ms`,
        ...(r.timedOut ? ['⏰超时'] : []),
        ...(r.truncated ? ['✂️截断'] : []),
      ].join(' ');
      console.error(`[${flags}]`);
      process.exit(r.exitCode === 0 ? 0 : 1);
      return;
    }

    // ---------------- proc ----------------
    case 'proc': {
      const sub = rest[0];
      if (!sub || sub === 'list') {
        const { values } = parse(rest.slice(sub ? 1 : 0), { query: _string(), json: _boolean() });
        const list = await listProcesses({ ...(values.query ? { query: values.query } : {}) });
        if (values.json) {
          console.log(JSON.stringify(list, null, 2));
          return;
        }
        const pidW = Math.max(4, ...list.map((p) => String(p.pid).length));
        console.log(`${'PID'.padEnd(pidW)}  ${'NAME'}`);
        for (const p of list) console.log(`${String(p.pid).padEnd(pidW)}  ${p.name}`);
        console.log(`\n共 ${list.length} 个进程${values.query ? `（过滤: ${values.query}）` : ''}`);
        return;
      }
      if (sub === 'kill') {
        const { values } = parse(rest.slice(1), { pid: _string(), name: _string() });
        if (!values.pid || !values.name) die('用法: cupbox proc kill --pid <PID> --name <进程名片段>');
        const r = await killProcess(Number(values.pid), values.name);
        console.log(`${r.killed ? '✅' : '⚠️'} ${r.message}`);
        if (!r.killed) process.exit(1);
        return;
      }
      die('用法: cupbox proc [list] [--query x] | kill --pid N --name X');
      return;
    }

    default:
      die(`未知命令: ${cmd}\n\n${HELP}`, 2);
  }
}

main().catch((e) => {
  die(e instanceof Error ? e.message : String(e));
});
