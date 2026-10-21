import {setPromptResponse} from './prompt-test-driver.mjs';
// 关闭询问 + 托盘行为验证：隔离目录启动真实主进程，替身对话框驱动三条分支。
// 运行：npx electron desktop/verify-tray-close.mjs
import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const home = path.join(process.env.TEMP || '.', 'cupbox-tray-close-' + Date.now());
await mkdir(home, { recursive: true });
process.env.CUPBOX_HOME = home;
app.setPath('userData', path.join(home, 'profile'));
app.disableHardwareAcceleration();

// 替身对话框：记录每个问题，按脚本返回按钮下标，避免自动化被原生弹窗阻塞
const dialogs = [];
const script = [];
setPromptResponse(options=>{dialogs.push(options);return script.length?script.shift():0;});

const rendererErrors = [];
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('console-message', details => {
    if (details.level === 'error') rendererErrors.push(details.message);
  });
});

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, label, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = check();
    if (value) return value;
    await pause(40);
  }
  throw Error('等待超时：' + label);
}

// 入口模块不能停在顶层 await 上，否则 Electron 不会发出 ready 事件
void (async () => {
try {
  await import('./main.js');
  const win = await waitFor(() => BrowserWindow.getAllWindows()[0], '主窗口创建');
  await waitFor(() => !win.webContents.isLoading(), '页面加载完成');
  win.show();
  await pause(250);

  // ① 点 × 弹三选一，文案说明托盘与 QQ 机器人联动
  win.close();
  const ask = await waitFor(() => dialogs[0], '关闭询问对话框');
  if (ask.buttons.join('|') !== '隐藏到托盘|关闭程序|取消') throw Error('按钮不对：' + ask.buttons.join('|'));
  if (!/隐藏到托盘/.test(ask.message) || !/同步关闭 QQ 机器人/.test(ask.detail)) throw Error('文案缺少托盘/QQ 机器人说明：' + ask.detail);
  if (ask.cancelId !== 2) throw Error('默认/取消按钮不对');
  console.log('PASS 点关闭弹出「隐藏到托盘 / 关闭程序 / 取消」，并说明关闭会同步关闭 QQ 机器人');

  // ② 选择隐藏：窗口隐藏、进程存活（托盘不可用时会弹二次警告并保持可见）
  await waitFor(() => !win.isVisible(), '选择隐藏后窗口不可见');
  if (win.isDestroyed()) throw Error('隐藏后窗口被销毁');
  console.log('PASS 选择隐藏到托盘后主窗口隐藏，程序仍在后台运行');

  // ③ 再次关闭并选择「关闭程序」：应用真正退出
  win.show();
  script.push(1);
  let willQuit = false;
  app.once('will-quit', event => { event.preventDefault(); willQuit = true; });
  win.close();
  const confirm = await waitFor(() => dialogs[1], '第二次关闭询问');
  if (!confirm.message.includes('隐藏到托盘')) throw Error('第二次询问复用了错误文案');
  await waitFor(() => willQuit, '应用退出');
  console.log('PASS 选择关闭程序后应用退出');

  if (rendererErrors.length) throw Error('渲染端错误：' + rendererErrors.join(' | '));
  console.log('PASS 无渲染端错误');
  app.exit(0);
} catch (error) {
  console.error('FAIL', error);
  app.exit(1);
}
})();
