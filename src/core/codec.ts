/** 编解码工具：base64（UTF-8 安全）、URL、HTML 实体、JSON 格式化。 */

export function base64Encode(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

export function base64Decode(b64: string): string {
  const buf = Buffer.from(b64.trim(), 'base64');
  // round-trip 校验，避免静默产出乱码
  if (buf.toString('base64').replace(/=+$/, '') !== b64.trim().replace(/=+$/, '')) {
    throw new Error('不是合法的 base64 字符串');
  }
  return buf.toString('utf8');
}

export function urlEncode(text: string): string {
  return encodeURIComponent(text);
}

export function urlDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    throw new Error('URL 编码不合法');
  }
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function htmlEscape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function htmlUnescape(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function jsonFormat(text: string, indent = 2): string {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${(e as Error).message}`);
  }
  return JSON.stringify(v, null, indent);
}

export function jsonMinify(text: string): string {
  return jsonFormat(text, 0);
}
