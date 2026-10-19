import { describe, it, expect } from 'vitest';
import { clipRead, clipWrite } from '../src/core/clip.js';

const isWin = process.platform === 'win32';

/**
 * 系统集成测试：剪贴板在无头/CI 环境可能不可用，
 * 环境限制类错误（权限/锁/无显示）按跳过处理，真正的逻辑错误才会失败。
 */
describe.skipIf(!isWin)('clip (Windows)', () => {
  it('写入后读回一致', async () => {
    const payload = `cupbox-clip-test-${Date.now()} 中文 🎯`;
    try {
      await clipWrite(payload);
    } catch (e) {
      const msg = String(e);
      if (/拒绝访问|被另一个|锁|剪贴板|denied|Another/i.test(msg)) {
        console.warn('[skip] 剪贴板环境不可用:', msg.slice(0, 200));
        return;
      }
      throw e;
    }
    const r = await clipRead();
    expect(r.ok).toBe(true);
    expect(r.content).toBe(payload);
  });

  it('读取返回结构完整', async () => {
    try {
      const r = await clipRead();
      expect(r.ok).toBe(true);
      expect(typeof r.content).toBe('string');
      expect(r.backend).toBe('powershell');
    } catch (e) {
      if (/拒绝访问|被另一个|锁|denied/i.test(String(e))) return;
      throw e;
    }
  });
});
