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
import { obfuscateImage, OBF_MODES, isObfMode, listModesText } from './core/obfuscate.js';
import { checkForUpdate, RELEASES_URL } from './core/update.js';
import {
  aiChat, aiAgent, loadAiConfig, saveAiConfig, maskKey, configPath, DEFAULT_SYSTEM,
  type AiProvider,
} from './core/ai.js';
import { VERSION } from './version.js';
import { runTool } from './core/toolkit.js';
import {
  addFact, listFacts, forgetFacts, recall,
  loadRuntimeMemory, saveRuntimeMemory, memoryStats,
} from './core/memory.js';

/**
 * 按词加 shell 引号（POSIX）：命令经 shell 执行时，括号/引号/重定向等
 * 元字符会被 sh 解析（如 `console.log(40+2)` 在 sh 中是语法错误）。
 * Windows cmd 保持原样（现有行为已在测试中验证）。
 */
function quoteShellWord(word: string): string {
  if (/^[A-Za-z0-9_\-./:=,@%+]+$/.test(word)) return word;
  // 带空格/括号/元字符的词必须加引号，否则重建出的命令会被 shell 重新分词甚至语法报错
  if (isWindows()) return `"${word.replace(/"/g, '""')}"`;
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
  context  [--text 文本] [--file 路径] [--window 128000]
                     估算上下文 token 占用（缺省 = Agent 基线开销）

图片杂活:
  obfuscate <图片.png> --mode 模式 [--key 密钥] [-o 输出] [--decrypt]
                     图片像素混淆/还原（gilbert|b|c|c2|pe1|pe2 六种模式；不带参数看模式表）

系统杂活:
  ocr      <图片> [--lang zh-Hans] [--engine auto|windows|tesseract]
  clip     [read | write 文本]                             读/写剪贴板
  shot     [--out 路径.png]                                截屏
  run      [--timeout 60000] [--cwd 目录] [--allow 前缀] -- <命令...>
                                                           受保护地执行命令
  proc     [list] [--query 关键字] | kill --pid N --name 名字

AI 接入:
  ai       [ask] <问题> [--system ...]   通过 API 一次问答（OpenAI 兼容/Anthropic）
           agent <任务> [--max-turns N]  Codex 式 Agent 循环，自动调用本地工具
           config [--provider p --base url --model m --key sk-…]
                                          查看/写入 AI 配置（存于 文档/Cupbox/config.json）
  freemodel list [--refresh]              列出匿名免费文本模型
           chat <模型id> <问题>            免 API Key 直接对话
           probe <模型id>                  探测模型可用性与延迟
           on | off                        启用/关闭免费模型总开关
  mcp      启动 MCP 服务器（stdio），供 Claude Desktop / Cursor / Cline 使用

记忆（本机 文档/Cupbox/memory，供 AI 记住与回忆）:
  memory   add <内容> [--source 标签]     记住一条长期事实
           search <关键词>                按相关性召回
           list | stats                   列出全部 / 存储统计
           forget <id或关键词>            遗忘（可多条，空格分隔）
           user [内容] | collab [内容]    查看/写入用户画像与协作约定（常驻注入）

其他:
  help     显示帮助      version 显示版本
  update   检查更新（GitHub Releases → npm；CUPBOX_UPDATE_DISABLE=1 关闭）
  全部命令支持 --json 输出（机器可读）

示例:
  cupbox organize ~/Downloads --mode category --dry-run
  cupbox rename ./photos --template "{n}-{name}" --ext *.jpg --dry-run
  cupbox ocr ./截图.png --lang zh-Hans
  cupbox obfuscate ./图.png --mode c --key 我的密钥
  cupbox time 1700000000
  cupbox ai config --model deepseek-chat --key sk-xxx
  cupbox ai ask "1718000000 是几点"
  cupbox ai agent "搜索项目里所有 TODO 并汇总" --max-turns 6
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

  // 旧版 ~/.cupbox 首次运行迁移到「文档/Cupbox」（静默、不覆盖、失败不影响）
  const { migrateLegacyHome } = await import('./core/paths.js');
  await migrateLegacyHome().catch(() => false);

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

    // ---------------- context（上下文占用估算） ----------------
    case 'context': {
      const { values, positionals } = parse(rest, {
        text: _string(), file: _string(), window: _string(), json: _boolean(),
      });
      const win = toInt(values.window, '--window');
      let text = values.text;
      if (text === undefined && values.file) {
        text = await readFile(relOrAbs(values.file), 'utf8').catch((e) => die(`读取失败: ${e.message}`));
      }
      if (text === undefined && positionals.length) text = positionals.join(' ');
      const r = (await runTool('context_stats', {
        ...(text !== undefined ? { text } : {}),
        ...(win !== undefined ? { window: win } : {}),
      })) as Record<string, unknown>;
      if (values.json) {
        console.log(JSON.stringify(r, null, 2));
        return;
      }
      if (r.kind === 'text') {
        console.log(`文本: ${r.chars} 字符 ≈ ${r.tokens} tokens`);
        console.log(`窗口: ${r.window} tokens · 占用 ${((Number(r.occupancy) * 100).toFixed(2))}%`);
      } else {
        const sys = r.system as { tokens: number };
        const tools = r.tools as { count: number; tokens: number };
        console.log(`Agent 基线开销 ≈ ${r.total} tokens（窗口 ${r.window}，占用 ${((Number(r.occupancy) * 100).toFixed(2))}%）`);
        console.log(`  系统提示词: ${sys.tokens} tokens`);
        console.log(`  工具 Schema: ${tools.tokens} tokens（${tools.count} 个工具）`);
      }
      console.log(String(r.note ?? ''));
      return;
    }

    // ---------------- obfuscate ----------------
    case 'obfuscate': {
      const { values, positionals } = parse(rest, {
        mode: _string(), key: _string(), o: _string(), out: _string(),
        decrypt: _boolean(), json: _boolean(), blocksize: _string(),
      });
      const img = positionals[0];
      if (!img) {
        console.log(
          `图片像素混淆（obfuscate）— 与「番茄图片混淆」生态实现互通，同一模式+密钥可互相还原。\n\n模式:\n${listModesText()}\n\n用法: cupbox obfuscate <图片.png> --mode <模式> [--key 密钥] [-o 输出.png] [--decrypt] [--json]\n  --decrypt   还原（需要与混淆时相同的 mode + key）\n  --blocksize 仅 b 模式：方块边长，默认 32\n\n示例:\n  cupbox obfuscate ./图.png --mode c --key 我的密钥\n  cupbox obfuscate ./图.obf.png --mode c --key 我的密钥 --decrypt -o 还原.png`,
        );
        return;
      }
      if (!values.mode) {
        die(`需要 --mode（可用: ${OBF_MODES.map((m) => m.mode).join(' | ')}）；先运行 cupbox obfuscate 查看模式说明`);
      }
      if (!isObfMode(values.mode)) die(`无效 --mode: ${values.mode}。可用: ${OBF_MODES.map((m) => m.mode).join(' | ')}`);
      const out = values.o ?? values.out;
      const blocksize = toInt(values.blocksize, '--blocksize');
      const r = await obfuscateImage({
        input: relOrAbs(img),
        mode: values.mode,
        ...(out ? { output: relOrAbs(out) } : {}),
        ...(values.key !== undefined ? { key: values.key } : {}),
        ...(values.decrypt ? { direction: 'decrypt' as const } : {}),
        ...(blocksize !== undefined ? { blockSize: blocksize } : {}),
      });
      if (values.json) console.log(JSON.stringify(r, null, 2));
      else console.log(r.message + (r.renamed ? '（重名已自动改名）' : ''));
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

    // ---------------- ai ----------------
    case 'ai': {
      const sub = rest[0] ?? 'config';
      if (sub === 'config') {
        const { values } = parse(rest.slice(1), {
          provider: _string(), base: _string(), model: _string(), key: _string(),
          temperature: _string(), 'max-turns': _string(), json: _boolean(),
        });
        const hasPatch = Boolean(
          values.provider ?? values.base ?? values.model ?? values.key ?? values.temperature ?? values['max-turns'],
        );
        if (hasPatch) {
          if (values.provider && values.provider !== 'openai-compatible' && values.provider !== 'anthropic') {
            die('--provider 只支持 openai-compatible 或 anthropic');
          }
          const saved = await saveAiConfig({
            ...(values.provider ? { provider: values.provider as AiProvider } : {}),
            ...(values.base !== undefined ? { baseUrl: values.base } : {}),
            ...(values.model !== undefined ? { model: values.model } : {}),
            ...(values.key !== undefined ? { apiKey: values.key } : {}),
            ...(values.temperature !== undefined ? { temperature: Number(values.temperature) } : {}),
            ...(values['max-turns'] !== undefined ? { maxTurns: Number(values['max-turns']) } : {}),
          });
          console.log(`✅ 已保存到 ${configPath()}`);
          if (values.json) console.log(JSON.stringify(saved, null, 2));
          else console.log(`  provider=${saved.provider} model=${saved.model || '(未配置)'} key=${maskKey(saved.apiKey)}`);
          return;
        }
        const cur = await loadAiConfig();
        if (values.json) {
          console.log(JSON.stringify({ ...cur, apiKey: maskKey(cur.apiKey), configPath: configPath() }, null, 2));
          return;
        }
        console.log(`AI 配置（${configPath()}）`);
        console.log(`  provider   ${cur.provider}`);
        console.log(`  baseUrl    ${cur.baseUrl || '(官方默认)'}`);
        console.log(`  model      ${cur.model || '(未配置)'}`);
        console.log(`  apiKey     ${maskKey(cur.apiKey)}`);
        console.log(`  temperature${cur.temperature !== undefined ? ` ${cur.temperature}` : ' (默认)'}`);
        console.log(`  maxTurns   ${cur.maxTurns ?? 8}`);
        console.log('环境变量 CUPBOX_AI_* 优先于该文件；桌面版「设置」写入的就是这个文件。');
        return;
      }

      if (sub === 'ask' || sub === 'agent') {
        const { values, positionals } = parse(rest.slice(1), {
          system: _string(), json: _boolean(), 'max-turns': _string(),
        });
        const prompt = positionals.join(' ').trim();
        if (!prompt) die(`用法: cupbox ai ${sub} <问题或任务描述> [--system 提示] [--json]`);
        if (sub === 'ask') {
          const r = await aiChat({
            messages: [
              { role: 'system', text: values.system?.trim() || DEFAULT_SYSTEM },
              { role: 'user', text: prompt },
            ],
          });
          if (values.json) console.log(JSON.stringify({ text: r.text }, null, 2));
          else console.log(r.text);
          return;
        }
        const t0 = Date.now();
        const r = await aiAgent({
          prompt,
          ...(values.system?.trim() ? { system: values.system.trim() } : {}),
          ...(values['max-turns'] ? { maxTurns: Number(values['max-turns']) } : {}),
          onTool: (it) => {
            if (!values.json) console.error(`  ⚙ ${it.name} ${it.ok ? '✅' : '❌'} ${it.durationMs}ms`);
          },
        });
        if (values.json) console.log(JSON.stringify(r, null, 2));
        else {
          console.log(r.text);
          console.error(`[工具调用 ${r.trace.length} 次 · 总耗时 ${Date.now() - t0}ms]`);
        }
        return;
      }
      die('用法: cupbox ai [ask|agent] <内容> [--json] | cupbox ai config [--provider … --model … --key …]');
      return;
    }

    // ---------------- update ----------------
    case 'update': {
      const { values } = parse(rest, { json: _boolean() });
      const info = await checkForUpdate({ currentVersion: VERSION });
      if (values.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }
      console.log(`当前版本   v${VERSION}`);
      if (info.source === 'disabled') {
        console.log('更新检查已关闭（CUPBOX_UPDATE_DISABLE=1）');
        return;
      }
      if (info.source === 'none') {
        console.log(`检查更新失败: ${info.error}`);
        console.log(`发布页      ${RELEASES_URL}`);
        process.exitCode = 1;
        return;
      }
      const fromName = info.source === 'github' ? 'GitHub Releases' : info.source === 'npm' ? 'npm registry' : '自定义清单';
      if (info.hasUpdate) {
        console.log(`发现新版本   v${info.latest}（来源 ${fromName}）`);
        console.log(`下载 / 更新  ${info.url}`);
        if (info.notes) {
          const notes = info.notes.length > 600 ? `${info.notes.slice(0, 600)}…` : info.notes;
          console.log(`\n—— 更新公告 ——\n${notes}`);
        }
      } else {
        console.log(`✅ 已是最新（数据源 ${fromName}）`);
      }
      return;
    }

    // ---------------- freemodel ----------------
    case 'freemodel': {
      const sub = rest[0];
      const args = rest.slice(1);
      const json = args.includes('--json');
      const pos = args.filter((a) => !a.startsWith('--'));
      const fm = await import('./core/freemodel.js');
      if (!sub) die('用法: cupbox freemodel list|chat|probe|on|off …（详见 help）');
      if (sub === 'list') {
        const r = await fm.listFreeModels({ refresh: args.includes('--refresh') });
        const store = await fm.loadFreeStore();
        if (json) {
          console.log(JSON.stringify({ enabled: store.enabled, models: r.models, live: r.live }, null, 2));
          return;
        }
        console.log(`免费模型总开关：${store.enabled ? '✅ 已启用' : '⭕ 未启用（cupbox freemodel on 启用）'}`);
        if (!r.live.opencode && !r.live.kilo && !r.live.vireonix) console.log('⚠️ 在线目录拉取失败，以下为本地缓存/兜底表（可能已过时）');
        const okCount = r.models.filter((m) => !m.blocked).length;
        console.log(`\n可用免费模型（${okCount} 个可用 / 共 ${r.models.length} 个，免 API Key）：`);
        for (const m of r.models) {
          const tags = [m.lane, m.wire, m.vision ? '视觉' : '', m.reasoning ? '思考' : '', m.blocked ? '⛔ 通道已封禁' : '', m.regionSensitive ? '区域敏感' : '', m.stale ? '兜底表' : ''].filter(Boolean).join(' · ');
          console.log(`  ${m.blocked ? '⛔' : fm.isModelEnabled(store, m.id) ? '✅' : '  '} ${m.id.padEnd(38)} ${m.name}  [${tags}]`);
        }
        console.log('\n⚠️ 风险提示：免费通道为第三方公共池，无 SLA、可能限流或区域限制，上游可能记录提示词，请勿发送敏感内容。');
        return;
      }
      if (sub === 'chat') {
        const model = pos[0];
        const prompt = pos.slice(1).join(' ').trim();
        if (!model || !prompt) die('用法: cupbox freemodel chat <模型id> <问题>');
        const r = await fm.chatFreeLane({ model, messages: [{ role: 'user', text: prompt }] });
        if (json) {
          console.log(JSON.stringify(r, null, 2));
          return;
        }
        console.log(r.text);
        return;
      }
      if (sub === 'probe') {
        const model = pos[0];
        if (!model) die('用法: cupbox freemodel probe <模型id>');
        const r = await fm.probeFreeModel(model);
        if (json) {
          console.log(JSON.stringify({ model, ...r }, null, 2));
          return;
        }
        console.log(r.ok ? `✅ ${model} 可用（${r.ms}ms）` : `❌ ${model} 不可用：${r.error}`);
        return;
      }
      if (sub === 'on' || sub === 'off') {
        await fm.saveFreeStore({ enabled: sub === 'on' });
        console.log(sub === 'on' ? '✅ 免费模型已启用（设置 → 免费模型 可选具体模型）' : '⭕ 免费模型已关闭');
        return;
      }
      die(`未知子命令: ${sub}（可用 list / chat / probe / on / off）`);
    }

    // ---------------- memory ----------------
    case 'memory': {
      const sub = rest[0];
      const args = rest.slice(1);
      if (!sub) die('用法: cupbox memory add|search|list|stats|forget|user|collab …（详见 help）');
      if (sub === 'add') {
        const si = args.indexOf('--source');
        const source = si >= 0 && args[si + 1] ? args[si + 1] : 'manual';
        const textArgs = si >= 0 ? [...args.slice(0, si), ...args.slice(si + 2)] : args;
        const text = textArgs.join(' ').trim();
        if (!text) die('用法: cupbox memory add <内容> [--source 标签]');
        const fact = await addFact(text, source);
        console.log(`✅ 已记住 [${fact.id}] ${fact.text.slice(0, 60)}`);
        return;
      }
      if (sub === 'search') {
        const query = args.filter((a) => !a.startsWith('--')).join(' ').trim();
        if (!query) die('用法: cupbox memory search <关键词>');
        const { runtime, facts } = await recall(query, 10);
        console.log(`运行时记忆: 用户画像 ${runtime.user.length} 字 · 协作约定 ${runtime.memory.length} 字`);
        if (!facts.length) {
          console.log('（无相关长期事实，可用 `cupbox memory add <内容>` 记一条）');
          return;
        }
        console.log(`相关长期事实（${facts.length} 条）:`);
        for (const f of facts) console.log(`  - [${f.id}] ${f.text}`);
        return;
      }
      if (sub === 'list') {
        const facts = await listFacts();
        if (!facts.length) {
          console.log('（记忆为空）');
          return;
        }
        console.log(`长期事实（${facts.length} 条）:`);
        for (const f of facts) console.log(`  - [${f.id}] ${f.text}  ←${f.source}`);
        return;
      }
      if (sub === 'stats') {
        const s = await memoryStats();
        console.log(`目录     ${s.dir}`);
        console.log(`用户画像 ${s.user} 字`);
        console.log(`协作约定 ${s.memory} 字`);
        console.log(`长期事实 ${s.facts} 条`);
        return;
      }
      if (sub === 'forget') {
        const query = args.filter((a) => !a.startsWith('--')).join(' ').trim();
        if (!query) die('用法: cupbox memory forget <id或关键词> [更多…]');
        let total = 0;
        for (const q of query.split(/\s+/)) total += await forgetFacts(q);
        console.log(total ? `✅ 已遗忘 ${total} 条` : '（没有匹配的记忆）');
        return;
      }
      if (sub === 'user' || sub === 'collab') {
        const key = sub === 'user' ? 'user' : 'memory';
        const content = args.join(' ').trim();
        if (content) {
          await saveRuntimeMemory({ [key]: content });
          console.log(`✅ 已写入${sub === 'user' ? '用户画像' : '协作约定'}（${content.length} 字，将常驻注入 AI 对话）`);
          return;
        }
        const rt = await loadRuntimeMemory();
        console.log(rt[key] || '（为空）');
        return;
      }
      die('用法: cupbox memory add|search|list|stats|forget|user|collab …');
      return;
    }

    default:
      die(`未知命令: ${cmd}\n\n${HELP}`, 2);
  }
}

main().catch((e) => {
  die(e instanceof Error ? e.message : String(e));
});
