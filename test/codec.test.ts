import { describe, it, expect } from 'vitest';
import {
  base64Encode, base64Decode, urlEncode, urlDecode,
  htmlEscape, htmlUnescape, jsonFormat, jsonMinify,
} from '../src/core/codec.js';

describe('codec', () => {
  it('base64 编解码往返（含中文与 emoji）', () => {
    const s = '你好，世界！Hello 🎉';
    expect(base64Decode(base64Encode(s))).toBe(s);
  });

  it('base64 解码非法输入时报错', () => {
    expect(() => base64Decode('!!!not-base64!!!')).toThrow('不是合法的 base64');
  });

  it('URL 编解码往返', () => {
    const s = 'a b&c=d?中文';
    expect(urlDecode(urlEncode(s))).toBe(s);
  });

  it('HTML 转义与还原', () => {
    const s = `<div class="x">Tom & Jerry's</div>`;
    const esc = htmlEscape(s);
    expect(esc).not.toContain('<');
    expect(esc).toContain('&amp;');
    expect(htmlUnescape(esc)).toBe(s);
  });

  it('JSON 格式化与压缩', () => {
    const pretty = jsonFormat('{"a":1,"b":[1,2]}');
    expect(pretty).toContain('\n');
    expect(jsonMinify(pretty)).toBe('{"a":1,"b":[1,2]}');
  });

  it('非法 JSON 报错清晰', () => {
    expect(() => jsonFormat('{bad json}')).toThrow('JSON 解析失败');
  });
});
