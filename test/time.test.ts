import { describe, it, expect } from 'vitest';
import { fromTimestamp, fromDateString, detectScale, nowInfo, relativeFrom } from '../src/core/time.js';

describe('time', () => {
  it('识别秒级与毫秒级时间戳', () => {
    expect(detectScale(1700000000)).toBe('seconds');
    expect(detectScale('1700000000000')).toBe('milliseconds');
    expect(detectScale('1700000000')).toBe('seconds');
  });

  it('秒级时间戳转日期', () => {
    const r = fromTimestamp(1700000000);
    expect(r.iso).toBe('2023-11-14T22:13:20.000Z');
    expect(r.unixMilliseconds).toBe(1700000000000);
    expect(r.cst).toBeTruthy();
  });

  it('毫秒级时间戳与秒级等价', () => {
    expect(fromTimestamp(1700000000000).iso).toBe(fromTimestamp(1700000000).iso);
  });

  it('日期字符串转时间戳', () => {
    const r = fromDateString('2024-01-01T00:00:00Z');
    expect(r.unixSeconds).toBe(1704067200);
  });

  it('非法输入报错', () => {
    expect(() => fromTimestamp('不是时间')).toThrow('无法解析为数字');
    expect(() => fromDateString('随便写点什么')).toThrow('无法解析日期');
  });

  it('当前时间非空', () => {
    const n = nowInfo();
    expect(n.unixSeconds).toBeGreaterThan(1700000000);
    expect(n.relative).toBeTruthy();
  });

  it('相对时间是人类可读短语', () => {
    const past = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 小时前
    const s = relativeFrom(past);
    expect(s).toMatch(/前|后|现在|秒|分钟|小时|天|周|月|年/);
    expect(s).toContain('3');
  });
});
