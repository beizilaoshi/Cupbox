import { describe, it, expect } from 'vitest';
import { csvParse, csvStringify, csvToJson, jsonToCsv } from '../src/core/csv.js';

describe('csv', () => {
  it('解析带引号、逗号与换行的字段', () => {
    const text = 'name,note\n"张三","包含,逗号"\n"李四","包含\n换行"';
    const rows = csvParse(text) as Array<Record<string, string>>;
    expect(rows).toHaveLength(2);
    expect(rows[0].note).toBe('包含,逗号');
    expect(rows[1].note).toBe('包含\n换行');
  });

  it('转义双引号（RFC 4180）', () => {
    const rows = csvParse('a\n"say ""hi"""') as Array<Record<string, string>>;
    expect(rows[0].a).toBe('say "hi"');
    expect(csvStringify([{ a: 'say "hi"' }])).toBe('a\n"say ""hi"""');
  });

  it('自动识别制表符分隔', () => {
    const rows = csvParse('col1\tcol2\nv1\tv2', {}) as Array<Record<string, string>>;
    expect(rows[0].col2).toBe('v2');
  });

  it('无表头模式返回二维数组', () => {
    const rows = csvParse('a,b\n1,2', { header: false }) as string[][];
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('对象数组序列化为 CSV，键的并集做表头', () => {
    const csv = csvStringify([
      { id: '1', name: '甲' },
      { id: '2', extra: 'x' },
    ]);
    expect(csv.split('\n')[0]).toBe('id,name,extra');
    expect(csv.split('\n')[1]).toBe('1,甲,');
  });

  it('CSV → JSON → CSV 往返一致', () => {
    const src = 'id,name\n1,hello\n2,world';
    const json = csvToJson(src);
    const back = jsonToCsv(json);
    expect(back).toBe(src);
  });

  it('非法 JSON 报错', () => {
    expect(() => jsonToCsv('nope')).toThrow('JSON 解析失败');
  });

  it('JSON 顶层数组以外报错', () => {
    expect(() => jsonToCsv('{"a":1}')).toThrow('顶层必须是数组');
  });
});
