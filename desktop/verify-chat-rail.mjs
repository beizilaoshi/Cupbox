// 对话定位条与历史折叠的 Electron 验收：固定 10px 间距刻度、悬停预览、折叠只保留最近 40 条。
import { app, BrowserWindow } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = path.resolve('output/chat-rail', String(Date.now()));
const home = path.join(out, 'home');
await mkdir(path.join(home, '.cupbox', 'sessions'), { recursive: true });
const messages = [];
for (let turn = 0; turn < 60; turn += 1) {
  messages.push({ role: 'user', text: `第 ${turn + 1} 个问题：这是一段用于生成历史记录的用户消息。` });
  messages.push({ role: 'assistant', text: `第 ${turn + 1} 个回答：这里是配套的助手回复，内容足够短以便快速渲染。` });
}
await writeFile(path.join(home, '.cupbox', 'sessions', 'rail-session.json'), JSON.stringify({
  id: 'rail-session', title: '定位条验收', mode: 'ask', updatedAt: new Date().toISOString(), messages,
}));
await writeFile(path.join(home, '.cupbox', 'desktop.json'), JSON.stringify({ startupEnabled: false, petEnabled: false, musicEnabled: false, workspace: out }));
await writeFile(path.join(home, '.cupbox', 'config.json'), JSON.stringify({ model: 'fixture', provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'isolated-test-key' }));
process.env.CUPBOX_HOME = home;
process.env.CUPBOX_UPDATE_DISABLE = '1';
process.env.CUPBOX_ANNOUNCEMENT_DISABLE = '1';
app.setPath('userData', path.join(out, 'profile'));
app.disableHardwareAcceleration();

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const wait = async (fn, label, tries = 400) => {
  for (let i = 0; i < tries; i += 1) { if (await fn()) return; await pause(50); }
  throw new Error(label);
};
const check = (ok, label) => { if (!ok) throw new Error(label); console.log(`PASS ${label}`); };

void (async () => {
  try {
    await import(pathToFileURL(path.resolve('desktop/main.js')).href);
    await wait(() => BrowserWindow.getAllWindows().length, 'main window');
    const win = BrowserWindow.getAllWindows()[0];
    win.show = () => {};
    win.webContents.setBackgroundThrottling(false);
    const js = (source) => win.webContents.executeJavaScript(source);
    const count = (selector) => js(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
    await wait(() => js('Boolean(window.cupboxReady)').catch(() => false), 'renderer ready');

    await js(`document.querySelector('#sess-list .sess-item').click();true`);
    await wait(() => js(`document.querySelectorAll('#chat-scroll > .msg').length === 40`), 'folded session renders last 40');
    check(await js(`document.getElementById('chat-fold')?.textContent.includes('更早的 80 条消息')`), 'fold bar reports 80 hidden messages');
    check(await count('#chat-rail .chat-rail-mark') === 60, 'rail lists all 60 user turns');
    check(await count('#chat-rail .chat-rail-mark.folded') === 40, 'rail dims turns inside the folded range');
    check(await js(`!document.getElementById('chat-rail').hidden`), 'rail is visible for a long conversation');
    check(await js(`document.querySelector('#chat-rail .chat-rail-mark').offsetTop === 6`), 'rail marks use a fixed 10px pitch');
    check(await js(`document.querySelector('#chat-rail .chat-rail-mark').style.top === '6px' && document.querySelectorAll('#chat-rail .chat-rail-mark')[1].style.top === '16px'`), 'rail marks stack at 6px and 16px');

    const preview = await js(`(()=>{try{const m=document.querySelector('#chat-rail .chat-rail-mark[data-index="40"]');m.dispatchEvent(new Event('pointerenter'));const p=document.querySelector('#chat-rail .chat-rail-preview');return {ok:Boolean(p)&& !p.hidden, err:'', text:p?p.textContent:''}}catch(e){return {ok:false,err:String(e)}}})()`);
    if (!preview.ok) console.error('preview debug', JSON.stringify(preview));
    check(preview.ok, 'hovering a mark opens the preview');
    check(await js(`document.querySelector('#chat-rail .chat-rail-preview-prompt').textContent.includes('第 41 个问题')`), 'preview carries that turn prompt');

    const before = await js(`document.getElementById('chat-scroll').scrollTop`);
    await js(`document.querySelector('#chat-rail .chat-rail-mark[data-index="40"]').click();true`);
    await pause(700);
    const after = await js(`document.getElementById('chat-scroll').scrollTop`);
    check(after < before, 'clicking a rail mark jumps to that message');
    check(await js(`Boolean(document.querySelector('#chat-scroll > .msg.msg-jump'))`), 'jumped message is highlighted');

    await js(`document.querySelector('#chat-fold .chat-fold-btn').click();true`);
    await wait(() => js(`document.querySelectorAll('#chat-scroll > .msg').length === 70`), 'first expand renders 30 older messages');
    check(await js(`document.getElementById('chat-fold').textContent.includes('更早的 50 条消息')`), 'fold bar counts down after expanding');

    await js(`document.querySelector('#chat-rail .chat-rail-mark[data-index="0"]').click();true`);
    await wait(() => js(`document.querySelectorAll('#chat-scroll > .msg').length === 120`), 'clicking a folded mark pages all history in');
    check(await js(`!document.getElementById('chat-fold')`), 'fold bar disappears once everything is rendered');
    await wait(() => js(`document.getElementById('chat-scroll').scrollTop < 300`), 'folded mark settles on the first turn');
    check(true, 'folded mark lands on the first turn');
    check(await count('#chat-rail .chat-rail-mark.folded') === 0, 'rail marks every turn as loaded');
    check(await js(`document.getElementById('chat-scroll').scrollHeight > document.getElementById('chat-scroll').clientHeight`), 'expanded history still scrolls');

    const shot = await win.webContents.capturePage();
    await writeFile(path.join(out, 'chat-rail.png'), shot.toPNG());
    await js(`document.getElementById('btn-new-chat').click();true`);
    await wait(() => js(`document.getElementById('chat-rail').hidden`), 'new task hides the rail');
    console.log('PASS new task hides the rail');
    console.log(`OUTPUT ${out}`);
    app.exit(0);
  } catch (error) {
    console.error('FAIL', error.stack || error);
    const state = await BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript(`({msg:document.querySelectorAll('#chat-scroll > .msg').length,fold:document.getElementById('chat-fold')?.textContent,marks:document.querySelectorAll('#chat-rail .chat-rail-mark').length,folded:document.querySelectorAll('#chat-rail .chat-rail-mark.folded').length})`).catch(() => null);
    console.error(JSON.stringify(state));
    app.exit(1);
  }
})();
