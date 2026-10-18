/**
 * cupbox MCP 服务器入口：把工具箱暴露给 Claude Desktop / Cursor / Cline 等 AI 客户端。
 * 启动方式：`cupbox mcp` 或 `node dist/mcp.js`（stdio 传输）。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';

import { hash } from './core/hash.js';
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
import { listProcesses, killProcess } from './core/proc.js';
import { obfuscateImage } from './core/obfuscate.js';
import { aiChat, aiAgent, loadAiConfig, DEFAULT_SYSTEM } from './core/ai.js';
import { VERSION } from './version.js';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });
const fail = (message: string): ToolResult => ({ content: [{ type: 'text', text: `❌ ${message}` }], isError: true });

/** 包装处理器：异常统一转成 AI 友好的错误结果，不让服务器崩溃。 */
function guard<A>(fn: (args: A) => Promise<string> | string) {
  return async (args: unknown): Promise<ToolResult> => {
    try {
      const text = await fn(args as A);
      return ok(text ?? '');
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  };
}

/** 环境变量：逗号分隔，禁用指定工具（如 CUPBOX_DISABLE_TOOLS=take_screenshot,run_command）。 */
function disabledTools(): Set<string> {
  const v = process.env.CUPBOX_DISABLE_TOOLS ?? '';
  return new Set(v.split(',').map((s) => s.trim()).filter(Boolean));
}

type Args<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>;

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'cupbox', version: VERSION });
  const off = disabledTools();
  const reg = <T extends z.ZodRawShape>(
    name: string,
    meta: {
      title: string;
      description: string;
      inputSchema: T;
      readOnly?: boolean;
      destructive?: boolean;
    },
    fn: (args: Args<T>) => Promise<string> | string,
  ) => {
    if (off.has(name)) return;
    server.registerTool(
      name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: meta.inputSchema,
        annotations: {
          readOnlyHint: meta.readOnly ?? false,
          destructiveHint: meta.destructive ?? false,
          idempotentHint: meta.readOnly ?? false,
        },
      },
      // 边界断言：SDK 回调类型随版本演进，内部已由 Args<T> 约束
      guard(fn) as never,
    );
  };

  // ---------- 哈希 ----------
  reg(
    'hash',
    {
      title: '计算哈希',
      description:
        'Compute MD5/SHA-1/SHA-256/SHA-512 hex digest of a UTF-8 text string or a file. 支持一次算多个算法。',
      inputSchema: {
        text: z.string().optional().describe('要哈希的文本（与 file 二选一）'),
        file: z.string().optional().describe('要哈希的文件路径（与 text 二选一）'),
        algos: z
          .array(z.enum(['md5', 'sha1', 'sha256', 'sha512']))
          .optional()
          .describe('算法列表，默认 ["sha256"]'),
      },
      readOnly: true,
    },
    async (a) => {
      const r = await hash(
        { ...(a.text !== undefined ? { text: a.text } : {}), ...(a.file ? { file: a.file } : {}) },
        a.algos ?? ['sha256'],
      );
      return JSON.stringify(r, null, 2);
    },
  );

  // ---------- 时间 ----------
  reg(
    'time_convert',
    {
      title: '时间转换',
      description:
        'Unix 时间戳(秒/毫秒自动识别)与日期互转，输出 ISO/UTC/北京时间/相对时间。Convert timestamps ↔ datetimes.',
      inputSchema: {
        input: z.string().describe('Unix 时间戳（如 1700000000 或 1700000000000）或日期字符串（如 2024-01-01 12:00 或 ISO 8601）；留空返回当前时间'),
      },
      readOnly: true,
    },
    (a) => {
      const s = a.input.trim();
      const r = !s
        ? nowInfo()
        : /^-?\d+$/.test(s)
          ? fromTimestamp(s)
          : fromDateString(s);
      return JSON.stringify(r, null, 2);
    },
  );

  // ---------- 编解码 ----------
  reg(
    'codec',
    {
      title: '编解码与 JSON 格式化',
      description:
        'Encode/decode: base64(UTF-8 safe)、URL encode/decode、HTML escape/unescape、JSON pretty/minify。',
      inputSchema: {
        operation: z
          .enum(['base64_encode', 'base64_decode', 'url_encode', 'url_decode', 'html_escape', 'html_unescape', 'json_format', 'json_minify'])
          .describe('操作类型'),
        text: z.string().describe('输入文本'),
      },
      readOnly: true,
    },
    (a) => {
      const map: Record<typeof a.operation, (s: string) => string> = {
        base64_encode: base64Encode,
        base64_decode: base64Decode,
        url_encode: urlEncode,
        url_decode: urlDecode,
        html_escape: htmlEscape,
        html_unescape: htmlUnescape,
        json_format: jsonFormat,
        json_minify: jsonMinify,
      };
      return map[a.operation](a.text);
    },
  );

  // ---------- 文件搜索 ----------
  reg(
    'search_files',
    {
      title: '搜索文件',
      description:
        '按文件名和/或内容关键词搜索目录树（自动跳过 node_modules/.git 等），返回命中文件与行号。Search files by name and content.',
      inputSchema: {
        root: z.string().describe('搜索根目录（绝对路径）'),
        pattern: z.string().optional().describe('文件名匹配（子串，regex=true 时为正则）'),
        content: z.string().optional().describe('内容匹配（子串，regex=true 时为正则）'),
        glob: z.string().optional().describe('扩展名过滤，如 "*.ts"'),
        regex: z.boolean().optional().describe('pattern/content 按正则解释，默认 false'),
        maxResults: z.number().int().positive().max(1000).optional().describe('最大返回条数，默认 200'),
        includeHidden: z.boolean().optional().describe('是否包含隐藏文件/目录，默认 false'),
      },
      readOnly: true,
    },
    async (a) => {
      if (!a.pattern && !a.content) throw new Error('pattern 与 content 至少给一个');
      const r = await search({
        root: a.root,
        ...(a.pattern ? { pattern: a.pattern } : {}),
        ...(a.content ? { content: a.content } : {}),
        ...(a.glob ? { glob: a.glob } : {}),
        ...(a.regex !== undefined ? { regex: a.regex } : {}),
        ...(a.maxResults ? { maxResults: a.maxResults } : {}),
        ...(a.includeHidden !== undefined ? { includeHidden: a.includeHidden } : {}),
      });
      if (r.hits.length === 0) return `没有找到匹配（已扫描 ${r.scannedFiles} 个文件）`;
      const lines = r.hits.map((h) => {
        const rel = h.path;
        if (h.matches.length === 0) return rel;
        return `${rel}\n${h.matches.map((m) => `  L${m.line}: ${m.text.trim()}`).join('\n')}`;
      });
      const head = `找到 ${r.hits.length} 个文件${r.truncated ? '（已截断）' : ''}，扫描 ${r.scannedFiles} 个：\n`;
      return head + lines.join('\n');
    },
  );

  // ---------- 批量重命名 ----------
  reg(
    'batch_rename',
    {
      title: '批量重命名',
      description:
        '批量重命名：正则/字面替换或序号模板（{n} {name} {date} {ext}）。默认 dryRun=true 只返回预览，确认无误后再传 dryRun=false 真正执行。绝不覆盖同名文件。',
      inputSchema: {
        dir: z.string().describe('目标目录（绝对路径）'),
        find: z.string().optional().describe('要查找的内容（字面子串；byRegex=true 时为正则）'),
        replace: z.string().optional().describe('替换为（正则支持 $1 引用）'),
        byRegex: z.boolean().optional().describe('按正则解释 find，默认 false'),
        template: z.string().optional().describe('模板模式（优先于 find/replace），如 "{n}-{name}"'),
        pad: z.number().int().positive().max(10).optional().describe('序号位数，默认 2'),
        startAt: z.number().int().optional().describe('序号起始，默认 1'),
        recursive: z.boolean().optional().describe('递归子目录，默认 false'),
        includeExt: z.string().optional().describe('只处理指定扩展名，如 "*.jpg,*.png"'),
        dryRun: z.boolean().optional().describe('true=只预览不执行（默认 true）'),
      },
      destructive: true,
    },
    async (a) => {
      const dryRun = a.dryRun ?? true;
      const r = await batchRename({
        dir: a.dir,
        ...(a.find !== undefined ? { find: a.find } : {}),
        ...(a.replace !== undefined ? { replace: a.replace } : {}),
        ...(a.byRegex !== undefined ? { byRegex: a.byRegex } : {}),
        ...(a.template ? { template: a.template } : {}),
        ...(a.pad ? { pad: a.pad } : {}),
        ...(a.startAt !== undefined ? { startAt: a.startAt } : {}),
        ...(a.recursive !== undefined ? { recursive: a.recursive } : {}),
        ...(a.includeExt ? { includeExt: a.includeExt } : {}),
        dryRun,
      });
      const preview = r.changes
        .map((c) => `${c.from}  →  ${c.to}${c.applied ? '  [已执行]' : c.skippedReason ? `  [${c.skippedReason}]` : dryRun ? '  [预览]' : ''}`)
        .join('\n');
      const header = dryRun
        ? `📋 预览（未执行，共 ${r.changes.length} 项）。确认后传 dryRun=false 执行：\n`
        : `✅ 已执行，共 ${r.changes.length} 项：\n`;
      return header + (preview || '（没有需要改名的文件）');
    },
  );

  // ---------- 文件夹整理 ----------
  reg(
    'organize_files',
    {
      title: '文件夹自动整理',
      description:
        '整理目录：mode=category 按类型分到 Documents/Images/Videos/Audio/Archives/Code/Data/Other；mode=regex 按文件名正则捕获组分子目录；mode=date 按年月归档。默认 dryRun=true 只预览。',
      inputSchema: {
        dir: z.string().describe('要整理的目录（绝对路径）'),
        mode: z.enum(['category', 'date', 'regex']).describe('整理模式'),
        pattern: z.string().optional().describe('mode=regex 时的正则，第 1 个捕获组作为子目录名'),
        dateField: z.enum(['created', 'modified']).optional().describe('mode=date 取哪个时间，默认 modified'),
        recursive: z.boolean().optional().describe('连子目录内的文件一起整理，默认 false'),
        dryRun: z.boolean().optional().describe('true=只预览不执行（默认 true）'),
      },
      destructive: true,
    },
    async (a) => {
      const dryRun = a.dryRun ?? true;
      const r = await organize({
        dir: a.dir,
        mode: a.mode,
        ...(a.pattern ? { pattern: a.pattern } : {}),
        ...(a.dateField ? { dateField: a.dateField } : {}),
        ...(a.recursive !== undefined ? { recursive: a.recursive } : {}),
        dryRun,
      });
      const moves = r.changes.filter((c) => c.skippedReason === undefined || c.to !== '(未匹配)');
      const preview = r.changes
        .map((c) => `${c.from}  →  ${c.to}${c.applied ? '  [已执行]' : c.skippedReason ? `  [${c.skippedReason}]` : dryRun ? '  [预览]' : ''}`)
        .join('\n');
      void moves;
      const header = dryRun
        ? `📋 整理预览（未执行，共 ${r.changes.length} 项）。确认后传 dryRun=false 执行：\n`
        : `✅ 整理完成，共 ${r.changes.length} 项：\n`;
      return header + (preview || '（没有需要移动的文件）');
    },
  );

  // ---------- CSV ↔ JSON ----------
  reg(
    'convert_csv_json',
    {
      title: 'CSV 与 JSON 互转',
      description: 'CSV → JSON 或 JSON(数组) → CSV。自动识别逗号/制表符/分号分隔符，正确处理引号与内嵌换行。',
      inputSchema: {
        direction: z.enum(['csv_to_json', 'json_to_csv']).describe('转换方向'),
        text: z.string().optional().describe('输入内容（与 filePath 二选一）'),
        filePath: z.string().optional().describe('输入文件路径（与 text 二选一）'),
        delimiter: z.string().optional().describe('指定分隔符；默认自动检测'),
        header: z.boolean().optional().describe('CSV 首行是否为表头，默认 true'),
      },
      readOnly: true,
    },
    async (a) => {
      let input = a.text;
      if (input === undefined) {
        if (!a.filePath) throw new Error('text 与 filePath 至少给一个');
        const { readFile } = await import('node:fs/promises');
        input = await readFile(a.filePath, 'utf8');
      }
      const opts = {
        ...(a.delimiter ? { delimiter: a.delimiter } : {}),
        ...(a.header !== undefined ? { header: a.header } : {}),
      };
      return a.direction === 'csv_to_json' ? csvToJson(input, opts) : jsonToCsv(input, opts);
    },
  );

  // ---------- OCR ----------
  reg(
    'ocr_image',
    {
      title: '图片文字识别 (OCR)',
      description:
        '识别图片中的文字并返回纯文本（支持中文/英文等）。Windows 用系统原生 OCR，其他平台用 tesseract（需安装）。',
      inputSchema: {
        imagePath: z.string().describe('图片路径（png/jpg/bmp/tiff）'),
        lang: z.string().optional().describe('BCP-47 语言，如 zh-Hans、en；默认系统语言'),
        engine: z.enum(['auto', 'windows', 'tesseract']).optional().describe('默认 auto'),
      },
      readOnly: true,
    },
    async (a) => {
      const r = await ocr({
        imagePath: a.imagePath,
        ...(a.lang ? { lang: a.lang } : {}),
        ...(a.engine ? { engine: a.engine } : {}),
      });
      return `（引擎: ${r.engine}${r.lang ? `, 语言: ${r.lang}` : ''}）\n${r.text || '（未识别出文字）'}`;
    },
  );

  // ---------- 剪贴板 ----------
  reg(
    'clipboard',
    {
      title: '剪贴板读写',
      description: 'action=read 读取剪贴板文本；action=write 把 text 写入剪贴板。',
      inputSchema: {
        action: z.enum(['read', 'write']).describe('读还是写'),
        text: z.string().optional().describe('action=write 时要写入的文本'),
      },
    },
    async (a) => {
      if (a.action === 'read') {
        const r = await clipRead();
        return r.content ?? '（剪贴板为空或非文本内容）';
      }
      if (a.text === undefined) throw new Error('action=write 需要提供 text');
      const r = await clipWrite(a.text);
      return r.message ?? '已写入';
    },
  );

  // ---------- 截屏 ----------
  reg(
    'take_screenshot',
    {
      title: '截屏',
      description: '截取主屏幕保存为 PNG，返回文件路径。可配合 ocr_image 识别截图中的文字。',
      inputSchema: {
        outputPath: z.string().optional().describe('输出 PNG 路径，默认当前目录 screenshot-<时间戳>.png'),
      },
      destructive: true,
    },
    async (a) => {
      const r = await screenshot(a.outputPath ? { outputPath: a.outputPath } : {});
      return `✅ 截屏已保存: ${r.path}（backend: ${r.backend}）`;
    },
  );

  // ---------- 图片像素混淆 ----------
  reg(
    'obfuscate_image',
    {
      title: '图片像素混淆 / 还原',
      description:
        'Pixel-scramble a PNG image (6 modes: gilbert/b/c/c2/pe1/pe2) or restore it losslessly. 图片像素混淆与还原：防内容识别、隐私打码；encrypt 只写新文件绝不覆盖，decrypt 需相同 mode+key，与「番茄图片混淆」生态实现互通。',
      inputSchema: {
        input: z.string().describe('输入 PNG 图片路径'),
        mode: z
          .enum(['gilbert', 'b', 'c', 'c2', 'pe1', 'pe2'])
          .describe('混淆模式：gilbert 无密钥；b/c/c2 任意文本密钥；pe1/pe2 密钥须为 0~1 小数（如 0.666）'),
        key: z.string().optional().describe('密钥（gilbert 不需要；其余模式必填；解密必须用同一密钥）'),
        direction: z.enum(['encrypt', 'decrypt']).optional().describe('encrypt=混淆（默认）；decrypt=还原'),
        output: z
          .string()
          .optional()
          .describe('输出 PNG 路径；默认在输入旁生成 <名字>.obf.png / <名字>.clear.png，重名自动加 (1)'),
        blockSize: z.number().optional().describe('仅 b 模式有效：方块边长，默认 32（与生态实现一致）'),
      },
      destructive: false, // 只写新文件，绝不覆盖已有文件
    },
    async (a) => {
      const r = await obfuscateImage({
        input: a.input,
        mode: a.mode,
        ...(a.key !== undefined ? { key: a.key } : {}),
        ...(a.direction ? { direction: a.direction } : {}),
        ...(a.output ? { output: a.output } : {}),
        ...(a.blockSize ? { blockSize: a.blockSize } : {}),
      });
      return JSON.stringify(r, null, 2);
    },
  );

  // ---------- 压缩 ----------
  reg(
    'zip',
    {
      title: '压缩 / 解压 zip',
      description: 'create=打包文件/目录为 zip；extract=解压 zip 到目录；list=列出 zip 内容。使用系统自带工具，支持中文文件名。',
      inputSchema: {
        action: z.enum(['create', 'extract', 'list']).describe('动作'),
        sources: z.array(z.string()).optional().describe('create: 要打包的文件/目录列表'),
        zipPath: z.string().optional().describe('zip 文件路径（create 时为输出路径）'),
        destDir: z.string().optional().describe('extract: 解压目标目录'),
      },
      destructive: true,
    },
    async (a) => {
      if (a.action === 'create') {
        if (!a.sources?.length) throw new Error('create 需要 sources');
        if (!a.zipPath) throw new Error('create 需要 zipPath（输出路径）');
        const r = await zipCreate({ sources: a.sources, output: a.zipPath });
        return `✅ ${r.message}: ${r.output}`;
      }
      if (a.action === 'extract') {
        if (!a.zipPath) throw new Error('extract 需要 zipPath');
        const r = await zipExtract(a.zipPath, a.destDir ?? '.');
        return `✅ ${r.message}: ${r.output}`;
      }
      if (!a.zipPath) throw new Error('list 需要 zipPath');
      const entries = await zipList(a.zipPath);
      return `共 ${entries.length} 项：\n${entries.slice(0, 500).join('\n')}`;
    },
  );

  // ---------- 安全执行命令 ----------
  reg(
    'run_command',
    {
      title: '执行命令（受保护）',
      description:
        'Run a shell command with timeout and output truncation. 超时默认 60s（上限 600s），输出截断 100KB。安全默认：必须提供 allowPrefixes 白名单（或管理员预设环境变量 CUPBOX_RUN_ALLOW），白名单模式下拒绝 shell 元字符防注入。高风险环境可设置 CUPBOX_DISABLE_TOOLS=run_command 完全禁用。',
      inputSchema: {
        command: z.string().describe('完整 shell 命令字符串'),
        timeoutMs: z.number().int().positive().max(600000).optional().describe('超时毫秒，默认 60000'),
        cwd: z.string().optional().describe('工作目录'),
        allowPrefixes: z.array(z.string()).optional().describe('命令前缀白名单，如 ["npm", "git status"]；给定则只允许匹配的命令'),
      },
      destructive: true,
    },
    async (a) => {
      // 安全默认：AI 侧命令执行必须有显式白名单——调用时给 allowPrefixes，
      // 或管理员在启动 MCP 前设置环境变量 CUPBOX_RUN_ALLOW（逗号分隔前缀）。
      const envAllow = (process.env.CUPBOX_RUN_ALLOW ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const allow = a.allowPrefixes?.length ? a.allowPrefixes : envAllow;
      if (!allow.length) {
        throw new Error(
          'run_command 默认拒绝执行任意命令（安全设计）。请提供 allowPrefixes（如 ["npm","git status"]），或由管理员设置环境变量 CUPBOX_RUN_ALLOW=npm,git；需要完全禁用本工具时设置 CUPBOX_DISABLE_TOOLS=run_command。',
        );
      }
      const r = await safeRun(a.command, {
        ...(a.timeoutMs ? { timeoutMs: a.timeoutMs } : {}),
        ...(a.cwd ? { cwd: a.cwd } : {}),
        allowPrefixes: allow,
      });
      const flags = [
        `exit=${r.exitCode}`,
        `${r.durationMs}ms`,
        ...(r.timedOut ? ['⏰ 超时'] : []),
        ...(r.truncated ? ['✂️ 已截断'] : []),
      ].join(' ');
      return `$ ${r.command}\n[${flags}]\n${r.stdout}${r.stderr ? `\n--- stderr ---\n${r.stderr}` : ''}`;
    },
  );

  // ---------- 进程 ----------
  reg(
    'process',
    {
      title: '进程查看 / 结束',
      description:
        'action=list 列出进程（可按关键字过滤）；action=kill 结束进程——必须同时给出 pid 和 name，且 name 与实际进程名匹配才执行（防误杀）。',
      inputSchema: {
        action: z.enum(['list', 'kill']).describe('动作'),
        query: z.string().optional().describe('list: 进程名过滤关键字'),
        pid: z.number().int().positive().optional().describe('kill: 目标 PID'),
        name: z.string().optional().describe('kill: 预期进程名片段（必须与实际匹配）'),
      },
      destructive: true,
    },
    async (a) => {
      if (a.action === 'list') {
        const list = await listProcesses({
          ...(a.query ? { query: a.query } : {}),
          maxResults: 200,
        });
        if (list.length === 0) return '没有匹配的进程';
        return list.map((p) => `${p.pid}\t${p.name}${p.mem ? `\t${p.mem}` : ''}`).join('\n');
      }
      if (a.pid === undefined || !a.name) throw new Error('kill 需要同时提供 pid 和 name');
      const r = await killProcess(a.pid, a.name);
      return `${r.killed ? '✅' : '⚠️'} ${r.message}`;
    },
  );

  // ---------- AI 接入 ----------
  reg(
    'ai_ask',
    {
      title: 'AI 问答（API）',
      description:
        '通过已配置的 AI API 发起一次问答（OpenAI 兼容或 Anthropic 协议）。密钥在桌面版「设置」或环境变量 CUPBOX_AI_API_KEY 配置；未配置时会返回配置指引，不会发起请求。',
      inputSchema: {
        prompt: z.string().describe('用户问题'),
        system: z.string().optional().describe('可选系统提示词'),
        model: z.string().optional().describe('可选临时覆盖模型名'),
      },
      readOnly: true,
    },
    async (a) => {
      const base = await loadAiConfig();
      const config = a.model ? { ...base, model: a.model } : base;
      const r = await aiChat({
        messages: [
          { role: 'system', text: a.system?.trim() || DEFAULT_SYSTEM },
          { role: 'user', text: a.prompt },
        ],
        config,
      });
      return r.text || '（模型返回空内容）';
    },
  );

  reg(
    'ai_agent',
    {
      title: 'AI Agent（本地工具循环）',
      description:
        'Codex 式多轮 Agent：模型自动选择并调用本服务器的本地工具（文件/数据/图片/受保护命令），拿到结果后继续推理，最终给出总结。rename/organize 在 Agent 内永远 dry-run 预览。maxTurns 上限 10。',
      inputSchema: {
        prompt: z.string().describe('任务描述'),
        system: z.string().optional().describe('可选系统提示词'),
        maxTurns: z.number().int().min(1).max(10).optional().describe('最大工具轮次，默认 8'),
      },
      destructive: true,
    },
    async (a) => {
      const r = await aiAgent({
        prompt: a.prompt,
        ...(a.system?.trim() ? { system: a.system.trim() } : {}),
        ...(a.maxTurns ? { maxTurns: a.maxTurns } : {}),
      });
      if (r.trace.length === 0) return r.text;
      const trace = r.trace
        .map((t, i) => `${i + 1}. ${t.name} ${t.ok ? '✅' : '❌'} ${t.durationMs}ms`)
        .join('\n');
      return `${r.text}\n\n—— 工具轨迹（${r.trace.length} 次）——\n${trace}`;
    },
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout 是 MCP 协议通道，日志一律走 stderr
  console.error(`cupbox MCP server v${VERSION} 已启动 (stdio)`);
}

// 直接 `node dist/mcp.js` 运行时启动
const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, '/');
if (invokedDirectly) {
  startMcpServer().catch((e) => {
    console.error('启动失败:', e);
    process.exit(1);
  });
}
