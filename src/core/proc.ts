import { runCommand, which, isWindows } from '../util/platform.js';

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu?: string;
  mem?: string;
}

export interface ProcessListOptions {
  /** 过滤关键字（匹配进程名，不区分大小写） */
  query?: string;
  maxResults?: number;
}

export async function listProcesses(opts: ProcessListOptions = {}): Promise<ProcessInfo[]> {
  const max = opts.maxResults ?? 100;
  let list: ProcessInfo[] = [];

  if (isWindows()) {
    const r = await runCommand('tasklist', ['/FO', 'CSV', '/NH'], { timeoutMs: 15000 });
    if (r.code !== 0) throw new Error(`tasklist 失败: ${r.stderr.trim()}`);
    for (const line of r.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      // "name","pid","session","session#","mem" —— 全字段带引号，内存列含逗号须按引号切
      const fields = [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
      if (fields.length >= 5 && /^\d+$/.test(fields[1])) {
        list.push({ pid: Number(fields[1]), name: fields[0], mem: fields[4] });
      }
    }
  } else {
    const r = await runCommand('ps', ['-eo', 'pid,comm,%cpu,%mem'], { timeoutMs: 15000 });
    if (r.code !== 0) throw new Error(`ps 失败: ${r.stderr.trim()}`);
    const lines = r.stdout.split(/\r?\n/).slice(1);
    for (const line of lines) {
      const m = line.trim().match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)/);
      if (m) list.push({ pid: Number(m[1]), name: m[2], cpu: m[3], mem: m[4] });
    }
  }

  // 内存占用降序（任务管理器式）：tasklist 默认按 PID 排序，窗口截断会把高占用进程挤出列表
  const memValue = (p: ProcessInfo): number => {
    const n = Number(String(p.mem ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  list.sort((a, b) => memValue(b) - memValue(a));

  if (opts.query) {
    const q = opts.query.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  return list.slice(0, max);
}

export interface KillResult {
  killed: boolean;
  pid: number;
  expectedName: string;
  message: string;
}

/**
 * 结束进程：pid 必须与预期进程名同时匹配（防止 AI/用户误杀）。
 * 名称匹配大小写不敏感、子串匹配。
 */
export async function killProcess(pid: number, expectedName: string): Promise<KillResult> {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error(`无效 PID: ${pid}`);
  if (!expectedName?.trim()) throw new Error('必须提供 expectedName（进程名片段）以二次确认');

  const all = await listProcesses({ maxResults: 100000 });
  const target = all.find((p) => p.pid === pid);
  if (!target) {
    return { killed: false, pid, expectedName, message: `PID ${pid} 不存在（可能已退出）` };
  }
  if (!target.name.toLowerCase().includes(expectedName.trim().toLowerCase())) {
    return {
      killed: false,
      pid,
      expectedName,
      message: `拒绝执行：PID ${pid} 实际是 “${target.name}”，与预期 “${expectedName}” 不符`,
    };
  }

  if (isWindows()) {
    const r = await runCommand('taskkill', ['/PID', String(pid), '/F'], { timeoutMs: 10000 });
    return { killed: r.code === 0, pid, expectedName, message: r.code === 0 ? `已结束 ${target.name} (${pid})` : r.stderr.trim() };
  }
  const r = await runCommand('kill', ['-9', String(pid)], { timeoutMs: 10000 });
  return { killed: r.code === 0, pid, expectedName, message: r.code === 0 ? `已结束 ${target.name} (${pid})` : r.stderr.trim() };
}

/** 判断某个工具是否在 PATH 上（供平台能力探测用）。 */
export async function hasTool(name: string): Promise<boolean> {
  return (await which(name)) !== null;
}
