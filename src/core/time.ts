/** 时间戳 / 日期时间互转工具。 */

export interface TimeConvertResult {
  unixSeconds: number;
  unixMilliseconds: number;
  iso: string;
  utc: string;
  cst: string; // Asia/Shanghai 常用展示
  relative: string; // 人类可读相对时间
}

function toInt(v: string | number): number {
  const n = typeof v === 'number' ? v : Number(v.trim());
  if (!Number.isFinite(n)) throw new Error(`无法解析为数字: ${v}`);
  return Math.trunc(n);
}

/** 自动识别秒/毫秒级时间戳。 */
export function detectScale(v: string | number): 'seconds' | 'milliseconds' {
  const n = toInt(v);
  // 1e12 ms ≈ 2001-09；小于它当作秒（秒级到 2286 年才到 1e10）
  return Math.abs(n) >= 1e12 ? 'milliseconds' : 'seconds';
}

export function fromTimestamp(v: string | number): TimeConvertResult {
  const scale = detectScale(v);
  const ms = scale === 'seconds' ? toInt(v) * 1000 : toInt(v);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) throw new Error(`无效时间戳: ${v}`);
  return {
    unixSeconds: Math.trunc(ms / 1000),
    unixMilliseconds: ms,
    iso: d.toISOString(),
    utc: d.toUTCString(),
    cst: d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
    relative: relativeFrom(d),
  };
}

export function fromDateString(input: string): TimeConvertResult {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error(`无法解析日期: ${input}`);
  return fromTimestamp(d.getTime());
}

/** 人类可读相对时间，如 “3 分钟前” / “in 2 days”。 */
export function relativeFrom(d: Date, now: Date = new Date()): string {
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.35],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
  ];
  let value = diffSec;
  for (const [unit, size] of units) {
    if (Math.abs(value) < size) {
      return new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(Math.round(value), unit);
    }
    value = value / size;
  }
  return String(value);
}

/** 当前时间信息。 */
export function nowInfo(): TimeConvertResult {
  return fromTimestamp(Date.now());
}
