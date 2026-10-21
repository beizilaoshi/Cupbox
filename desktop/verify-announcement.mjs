// 开屏公告验证：本地 HTTP 提供 announcement.json，隔离目录启动真实主进程，驱动真实弹窗。
// 运行：npx electron --no-sandbox desktop/verify-announcement.mjs
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const home = path.join(process.env.TEMP || '.', 'cupbox-announcement-' + Date.now());
await mkdir(home, { recursive: true });
process.env.CUPBOX_HOME = home;
delete process.env.CUPBOX_ANNOUNCEMENT_DISABLE;
app.setPath('userData', path.join(home, 'profile'));
app.disableHardwareAcceleration();

// 公告内容由本地服务提供，换 state 即模拟仓库文件更新
const state = {
  id: '2026-10-21-welcome',
  title: '欢迎使用 Cupbox 工具箱',
  body: '欢迎使用 Cupbox 工具箱！\n\n· 左侧工具栏：哈希、编码、时间戳\n· 对话区：问一问 / 执行任务\n· QQ 机器人：设置里启用',
  publishedAt: '2026-10-21',
  url: 'https://github.com/beizilaoshi/cupbox',
};
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(state));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
process.env.CUPBOX_ANNOUNCEMENT_URL = `http://127.0.0.1:${server.address().port}/announcement.json`;

// 跳过启动动画，让验证更快更稳（公告在动画结束后才出现）
// CUPBOX_HOME 的数据目录是 <home>/.cupbox（见 src/core/paths.ts:dataHome）
const dataDir = path.join(home, '.cupbox');
await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, 'desktop.json'), JSON.stringify({ startupEnabled: false, startupDuration: 0.8 }), 'utf8');

const rendererErrors = [];
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('console-message', details => {
    if (details.level === 'error') rendererErrors.push(details.message);
  });
});

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await pause(50);
  }
  throw Error('等待超时：' + label);
}
async function readPrefs() {
  try { return JSON.parse(await readFile(path.join(dataDir, 'desktop.json'), 'utf8')); } catch { return {}; }
}
async function waitPrefs(check, label) {
  return waitFor(async () => { const p = await readPrefs(); return check(p) ? p : null; }, label);
}

const CHECKBOX_AND_CLOSE = `(() => {
  document.getElementById('ann-mute').checked = true;
  document.getElementById('btn-ann-ok').click();
  return true;
})()`;

void (async () => {
  let win;
  try {
    await import('./main.js');
    win = await waitFor(() => BrowserWindow.getAllWindows()[0], '主窗口创建');
    await waitFor(() => !win.webContents.isLoading(), '页面加载完成');
    win.show();
    const js = code => win.webContents.executeJavaScript(code, true);
    const modalVisible = () => js(`(() => { const m = document.getElementById('ann-modal'); return !m.hidden && m.classList.contains('open'); })()`);
    const modalHidden = () => js(`document.getElementById('ann-modal').hidden === true`);

    // ① 首次启动：弹出公告，标题 / 正文 / 日期正确，复选框未勾选
    await waitFor(() => js('window.cupboxReady === true'), '页面启动完成');
    await waitFor(modalVisible, '公告弹窗出现');
    await pause(450); // 等 0.18s 的淡入动画结束，截图才有内容
    const first = await js(`({
      title: document.getElementById('ann-title').textContent,
      body: document.getElementById('ann-body').textContent,
      date: document.getElementById('ann-date').textContent,
      dateShown: !document.getElementById('ann-date').hidden,
      source: document.getElementById('ann-source').textContent,
      muted: document.getElementById('ann-mute').checked,
      github: !document.getElementById('btn-ann-github').hidden,
      bodyLeaves: document.getElementById('ann-body').children.length,
    })`);
    if (first.title !== '欢迎使用 Cupbox 工具箱') throw Error('标题不对：' + first.title);
    if (!first.body.includes('欢迎使用 Cupbox 工具箱')) throw Error('正文不对：' + first.body.slice(0, 60));
    if (!first.dateShown || first.date !== '2026-10-21') throw Error('日期徽标不对');
    if (!first.source) throw Error('来源徽标为空');
    if (first.muted) throw Error('首次弹出时复选框不应勾选');
    if (!first.github) throw Error('公告带 url 时应显示 GitHub 按钮');
    if (first.bodyLeaves !== 0) throw Error('正文必须是纯文本节点');
    const shot = path.join(home, 'announcement.png');
    await writeFile(shot, (await win.webContents.capturePage()).toPNG());
    console.log('PASS 启动后弹出公告，标题/正文/日期/来源正确，正文为纯文本');
    console.log('SHOT ' + shot);

    // ② 勾选「不再提示」并关闭 → 偏好落盘（静音 + 已读版本）
    await js(CHECKBOX_AND_CLOSE);
    await waitFor(modalHidden, '关闭后弹窗隐藏');
    const saved = await waitPrefs(p => p.announcementMuted === true && Boolean(p.announcementSeenVersion), '偏好写入静音与已读版本');
    if (!/^2026-10-21-welcome:/.test(saved.announcementSeenVersion)) throw Error('已读版本格式不对：' + saved.announcementSeenVersion);
    console.log('PASS 勾选「不再提示」后写入 announcementMuted=true 与已读版本');

    // ③ 同版本再次启动（刷新页面模拟）→ 不再显示
    const loaded = () => new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    let next = loaded(); win.webContents.reload(); await next;
    await waitFor(() => js('window.cupboxReady === true'), '第二次启动完成');
    await pause(1200);
    if (!(await modalHidden())) throw Error('同版本且已勾「不再提示」，公告仍出现');
    console.log('PASS 内容未更新且已勾「不再提示」时，再次启动不显示公告');

    // ④ 仓库公告更新（改正文）→ 即使静音也再次显示，且仍为纯文本
    state.body = '<b>不是标签</b> 新公告内容：修复了若干问题。';
    state.publishedAt = '2026-10-22';
    next = loaded(); win.webContents.reload(); await next;
    await waitFor(() => js('window.cupboxReady === true'), '第三次启动完成');
    await waitFor(modalVisible, '更新后公告出现');
    const updated = await js(`({
      body: document.getElementById('ann-body').textContent,
      leaves: document.getElementById('ann-body').children.length,
    })`);
    if (!updated.body.includes('<b>不是标签</b>')) throw Error('更新后的正文没显示：' + updated.body);
    if (updated.leaves !== 0) throw Error('HTML 标记被解析成了元素，存在注入风险');
    console.log('PASS 公告内容更新后再次显示（覆盖「不再提示」），HTML 按纯文本渲染');

    // ⑤ 关闭并保持静音：写入新的已读版本
    await js(CHECKBOX_AND_CLOSE);
    await waitFor(modalHidden, '更新公告关闭');
    const seen2 = await waitPrefs(p => /^2026-10-21-welcome:/.test(p.announcementSeenVersion) && p.announcementMuted === true && p.announcementSeenVersion !== saved.announcementSeenVersion, '写入新版本已读');
    console.log('PASS 关闭后记录新版本：' + seen2.announcementSeenVersion.slice(0, 24) + '…');

    if (rendererErrors.length) throw Error('渲染端错误：' + rendererErrors.join(' | '));
    console.log('PASS 无渲染端错误');
    console.log('OK 全部公告验证通过');
    server.close();
    app.exit(0);
  } catch (error) {
    console.error('FAIL', error);
    try { server.close(); } catch {}
    app.exit(1);
  }
})();
