// Cupbox 统一工具编排层：14 个本地工具的 JSON Schema 与执行器。
// 消费方：AI Agent 循环（ai.ts）、桌面壳（desktop/main.js）。
// MCP 层保持既有注册实现不动（双入口行为一致，由测试保证）。
import { hash, isSupportedAlgo, type HashAlgo } from './hash.js';
import { nowInfo, fromTimestamp, fromDateString } from './time.js';
import {
  base64Encode, base64Decode, urlEncode, urlDecode,
  htmlEscape, htmlUnescape, jsonFormat, jsonMinify,
} from './codec.js';
import { search } from './search.js';
import { batchRename } from './rename.js';
import { organize } from './organize.js';
import { csvToJson, jsonToCsv } from './csv.js';
import { zipCreate, zipExtract, zipList } from './zip.js';
import { obfuscateImage, listModesText, OBF_MODES, isObfMode } from './obfuscate.js';
import { ocr } from './ocr.js';
import { clipRead, clipWrite } from './clip.js';
import { screenshot } from './shot.js';
import { safeRun } from './run.js';
import { listProcesses, killProcess } from './proc.js';

const CODEC_MAP: Record<string, (s: string) => string> = {
  b64e: base64Encode, b64d: base64Decode,
  urle: urlEncode, urlde: urlDecode,
  'html-esc': htmlEscape, 'html-unesc': htmlUnescape,
  json: jsonFormat, 'json-min': jsonMinify,
};

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema（draft-07 子集），兼容 OpenAI tools 与 Anthropic input_schema */
  parameters: Record<string, unknown>;
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'hash',
    description: '计算文本或文件的哈希（md5/sha1/sha256/sha512）。text 与 file 二选一。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要哈希的文本' },
        file: { type: 'string', description: '要哈希的文件路径' },
        algo: { type: 'string', description: '逗号分隔算法，默认 sha256' },
      },
    },
  },
  {
    name: 'time',
    description: '时间信息与转换：留空返回当前时间；可传秒/毫秒时间戳或日期字符串，返回 ISO/UTC/北京时间/相对时间。',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: '时间戳或日期字符串，可省略' },
      },
    },
  },
  {
    name: 'codec',
    description: '文本编解码：b64e/b64d/urle/urlde/html-esc/html-unesc/json(美化)/json-min(压缩)。',
    parameters: {
      type: 'object',
      properties: {
        op: {
          type: 'string',
          enum: ['b64e', 'b64d', 'urle', 'urlde', 'html-esc', 'html-unesc', 'json', 'json-min'],
        },
        text: { type: 'string', description: '输入文本' },
      },
      required: ['op', 'text'],
    },
  },
  {
    name: 'search',
    description: '在目录中按文件名与内容搜索（自动跳过 node_modules/.git 等噪音目录）。',
    parameters: {
      type: 'object',
      properties: {
        root: { type: 'string', description: '搜索根目录' },
        pattern: { type: 'string', description: '文件名包含的子串' },
        content: { type: 'string', description: '文件内容包含的子串' },
        glob: { type: 'string', description: 'glob 过滤，如 *.ts' },
        regex: { type: 'boolean', description: 'pattern/content 按正则解释' },
        max: { type: 'number', description: '最大结果数' },
      },
      required: ['root'],
    },
  },
  {
    name: 'rename',
    description: '批量重命名（查找替换或模板）。安全默认 dry-run 预览：不传 dryRun:false 永不改名，且绝不覆盖重名文件。',
    parameters: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: '目标目录' },
        find: { type: 'string', description: '查找文本' },
        replace: { type: 'string', description: '替换为' },
        byRegex: { type: 'boolean', description: 'find 按正则解释' },
        template: { type: 'string', description: '模板 {n}/{name}/{date}/{ext}' },
        recursive: { type: 'boolean', description: '含子目录' },
        ext: { type: 'string', description: '扩展名过滤，如 *.jpg' },
        dryRun: { type: 'boolean', description: 'true=仅预览（默认）；false=真正执行' },
      },
      required: ['dir'],
    },
  },
  {
    name: 'organize',
    description: '把目录文件归类到子目录（按扩展名/日期/正则捕获组）。安全默认 dry-run 预览。',
    parameters: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: '目标目录' },
        mode: { type: 'string', enum: ['category', 'date', 'regex'], description: '默认 category' },
        pattern: { type: 'string', description: 'regex 模式：捕获组1作为子目录名' },
        recursive: { type: 'boolean', description: '含子目录' },
        cleanup: { type: 'boolean', description: '清理整理后的空目录' },
        dryRun: { type: 'boolean', description: 'true=仅预览（默认）；false=真正移动' },
      },
      required: ['dir'],
    },
  },
  {
    name: 'csv',
    description: 'CSV 与 JSON 互转（RFC 4180，自动识别逗号/制表符/分号分隔）。',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', enum: ['json', 'csv'], description: '目标格式，默认 json' },
        text: { type: 'string', description: '粘贴的 CSV 或 JSON 文本' },
      },
      required: ['text'],
    },
  },
  {
    name: 'zip',
    description: '压缩包操作：create(创建)/extract(解压)/list(列清单)。解压前自动做 zip-slip 与覆盖预检。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'extract', 'list'] },
        output: { type: 'string', description: 'create=输出 zip 路径；extract/list=输入 zip 路径' },
        sources: { type: 'string', description: 'create：逗号分隔的源文件/目录' },
        destDir: { type: 'string', description: 'extract：解压目标目录' },
        zipPath: { type: 'string', description: 'extract/list 时也可直接用此字段指定 zip' },
      },
      required: ['action'],
    },
  },
  {
    name: 'obfuscate',
    description: 'PNG 图片像素混淆/还原（gilbert/b/c/c2/pe1/pe2 六模式，与“番茄图片混淆”生态互通）。密钥错误在读文件前即拒绝。',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: '输入 PNG 路径' },
        mode: { type: 'string', enum: OBF_MODES.map((m) => m.mode) },
        key: { type: 'string', description: '密钥；pe1/pe2 必须是 0~1 小数' },
        decrypt: { type: 'boolean', description: 'true=还原' },
        output: { type: 'string', description: '输出路径，留空自动命名' },
        blockSize: { type: 'number', description: 'b 模式块大小，默认 32' },
      },
      required: ['input', 'mode'],
    },
  },
  {
    name: 'ocr',
    description: '识别图片中的文字（Windows 原生 OCR 或 tesseract），支持中文。',
    parameters: {
      type: 'object',
      properties: {
        imagePath: { type: 'string', description: '图片路径' },
        lang: { type: 'string', description: '语言，默认 zh-Hans' },
        engine: { type: 'string', enum: ['auto', 'windows', 'tesseract'] },
      },
      required: ['imagePath'],
    },
  },
  {
    name: 'clip',
    description: '读取或写入系统剪贴板。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['read', 'write'] },
        text: { type: 'string', description: 'write 时要写入的文本' },
      },
      required: ['action'],
    },
  },
  {
    name: 'shot',
    description: '系统原生截屏，输出 PNG 文件路径。',
    parameters: {
      type: 'object',
      properties: {
        outputPath: { type: 'string', description: '输出 PNG 路径，留空自动命名' },
      },
    },
  },
  {
    name: 'run',
    description: '受保护地执行 shell 命令：必须提供 allowPrefixes 白名单前缀（逗号分隔），白名单模式下拒绝 shell 元字符（防注入），带超时与输出截断。',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '完整命令，如 npm test' },
        allowPrefixes: { type: 'string', description: '允许的命令前缀，逗号分隔，如 npm,git status' },
        cwd: { type: 'string', description: '工作目录' },
        timeoutMs: { type: 'number', description: '超时毫秒，默认 60000，上限 600000' },
      },
      required: ['command', 'allowPrefixes'],
    },
  },
  {
    name: 'proc',
    description: '列出或结束进程。list 按关键字过滤；kill 必须同时给出 pid 与 name 且两者与实际匹配才执行（防误杀）。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'kill'] },
        query: { type: 'string', description: 'list：进程名过滤' },
        pid: { type: 'number', description: 'kill：目标 PID' },
        name: { type: 'string', description: 'kill：预期进程名片段' },
      },
      required: ['action'],
    },
  },
];

function str(v: unknown): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
}

/** 统一执行器：与 CLI / MCP / 桌面壳同一套引擎语义。 */
export async function runTool(tool: string, a: Record<string, unknown>): Promise<unknown> {
  switch (tool) {
    case 'hash': {
      const algos = a.algo
        ? str(a.algo)
            .split(',')
            .map((s) => s.trim())
            .filter((s): s is HashAlgo => isSupportedAlgo(s))
        : undefined;
      return hash(
        { ...(a.text ? { text: str(a.text) } : {}), ...(a.file ? { file: str(a.file) } : {}) },
        algos,
      );
    }
    case 'time': {
      const input = str(a.input).trim();
      if (!input) return nowInfo();
      const asNum = Number(input);
      return Number.isFinite(asNum) && input !== ''
        ? fromTimestamp(input)
        : fromDateString(input);
    }
    case 'codec': {
      const fn = CODEC_MAP[str(a.op)];
      if (!fn) throw new Error(`未知操作: ${str(a.op)}（可选 ${Object.keys(CODEC_MAP).join('/')}）`);
      if (typeof a.text !== 'string' || a.text === '') throw new Error('需要文本内容');
      return fn(a.text);
    }
    case 'search':
      return search({
        root: str(a.root),
        ...(a.pattern ? { pattern: str(a.pattern) } : {}),
        ...(a.content ? { content: str(a.content) } : {}),
        ...(a.glob ? { glob: str(a.glob) } : {}),
        ...(a.regex ? { regex: true } : {}),
        ...(a.max ? { maxResults: Number(a.max) } : {}),
      });
    case 'rename':
      return batchRename({
        dir: str(a.dir),
        ...(a.find !== undefined && a.find !== '' ? { find: str(a.find) } : {}),
        ...(a.replace !== undefined ? { replace: str(a.replace) } : {}),
        ...(a.byRegex ? { byRegex: true } : {}),
        ...(a.template ? { template: str(a.template) } : {}),
        ...(a.recursive ? { recursive: true } : {}),
        ...(a.ext ? { includeExt: str(a.ext) } : {}),
        dryRun: a.dryRun !== false,
      });
    case 'organize':
      return organize({
        dir: str(a.dir),
        mode: (a.mode as 'category' | 'date' | 'regex') ?? 'category',
        ...(a.pattern ? { pattern: str(a.pattern) } : {}),
        ...(a.recursive ? { recursive: true } : {}),
        ...(a.cleanup ? { cleanupEmptyDirs: true } : {}),
        dryRun: a.dryRun !== false,
      });
    case 'csv': {
      if (typeof a.text !== 'string' || a.text === '') throw new Error('需要粘贴 CSV/JSON 文本');
      return (a.to ?? 'json') === 'json' ? csvToJson(a.text, {}) : jsonToCsv(a.text, {});
    }
    case 'zip': {
      const action = str(a.action);
      const zipFile = str(a.zipPath) || str(a.output);
      if (action === 'list') return zipList(zipFile);
      if (action === 'extract') return zipExtract(zipFile, str(a.destDir) || '.');
      const sources = str(a.sources).split(',').map((s) => s.trim()).filter(Boolean);
      if (!a.output || sources.length === 0) {
        throw new Error('create 需要输出 zip 路径与至少一个源（逗号分隔）');
      }
      return zipCreate({ output: str(a.output), sources });
    }
    case 'obfuscate': {
      if (!a.input) throw new Error('需要输入图片路径');
      const mode = str(a.mode);
      if (!isObfMode(mode)) {
        throw new Error(
          `无效模式: ${mode}。可用: ${OBF_MODES.map((m) => m.mode).join(' | ')}\n${listModesText()}`,
        );
      }
      return obfuscateImage({
        input: str(a.input),
        mode,
        ...(a.output ? { output: str(a.output) } : {}),
        ...(a.key !== undefined && a.key !== '' ? { key: str(a.key) } : {}),
        ...(a.decrypt ? { direction: 'decrypt' as const } : {}),
        ...(a.blockSize ? { blockSize: Number(a.blockSize) } : {}),
      });
    }
    case 'ocr':
      return ocr({
        imagePath: str(a.imagePath),
        ...(a.lang ? { lang: str(a.lang) } : {}),
        ...(a.engine ? { engine: str(a.engine) as 'auto' | 'windows' | 'tesseract' } : {}),
      });
    case 'clip':
      return str(a.action) === 'write'
        ? (a.text ? clipWrite(str(a.text)) : Promise.reject(new Error('clip write 需要文本')))
        : clipRead();
    case 'shot':
      return screenshot(a.outputPath ? { outputPath: str(a.outputPath) } : {});
    case 'run': {
      // 与 MCP 相同的安全默认：白名单必填，防注入扫描由 safeRun 兜底
      const allow = str(a.allowPrefixes).split(',').map((s) => s.trim()).filter(Boolean);
      if (!allow.length) {
        throw new Error('出于安全默认拒绝：请提供允许的命令前缀白名单（逗号分隔，如 npm,git status）');
      }
      if (!a.command) throw new Error('需要命令');
      return safeRun(str(a.command), {
        allowPrefixes: allow,
        ...(a.timeoutMs ? { timeoutMs: Number(a.timeoutMs) } : {}),
        ...(a.cwd ? { cwd: str(a.cwd) } : {}),
      });
    }
    case 'proc': {
      if (str(a.action) === 'kill') {
        if (!a.pid || !a.name) throw new Error('kill 需要同时给出 PID 与预期进程名');
        return killProcess(Number(a.pid), str(a.name));
      }
      return listProcesses(a.query ? { query: str(a.query) } : {});
    }
    default:
      throw new Error(`未知工具: ${tool}`);
  }
}
