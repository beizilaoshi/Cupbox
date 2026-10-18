// Cupbox 可视化桌面壳 —— Electron 主进程
// 14 个本地工具走统一编排层 dist/core/toolkit.js（与 CLI / MCP 同一套引擎语义），
// AI 问答与 Agent（ai_ask/ai_agent）走 dist/core/ai.js；设置读写 ~/.cupbox/config.json。
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';

import { runTool, TOOL_DEFS } from '../dist/core/toolkit.js';
import { aiChat, aiAgent, loadAiConfig, saveAiConfig, DEFAULT_SYSTEM } from '../dist/core/ai.js';
import { checkForUpdate } from '../dist/core/update.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// `electron desktop/` 开发时 appPath = desktop/；打包后 resources/app/package.json 在根
const ROOT = path.resolve(__dirname, '..');

/** 桌面专属 AI 入口：mode = ask（单次问答）| agent（Codex 式工具循环）。 */
async function desktopAi(a) {
  const prompt = String(a.prompt ?? '').trim();
  if (!prompt) throw new Error('请输入问题 / 任务内容');
  if ((a.mode ?? 'ask') === 'agent') {
    return aiAgent({
      prompt,
      ...(a.system ? { system: String(a.system) } : {}),
      ...(a.maxTurns ? { maxTurns: Number(a.maxTurns) } : {}),
    });
  }
  const base = await loadAiConfig();
  const r = await aiChat({
    messages: [
      { role: 'system', text: a.system ? String(a.system) : DEFAULT_SYSTEM },
      { role: 'user', text: prompt },
    ],
    config: base,
  });
  return { text: r.text };
}

ipcMain.handle('cupbox:tool', async (_event, tool, args) => {
  try {
    const a = args ?? {};
    const result = tool === 'ai' ? await desktopAi(a) : await runTool(tool, a);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

// 设置页：与 CLI `cupbox ai config` 读写同一个 ~/.cupbox/config.json
ipcMain.handle('ai:config:get', async () => {
  try {
    return { ok: true, config: await loadAiConfig() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});
ipcMain.handle('ai:config:set', async (_event, patch) => {
  try {
    const config = await saveAiConfig(patch ?? {});
    return { ok: true, config };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

ipcMain.handle('cupbox:info', async () => {
  try {
    const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
    return { version: pkg.version, name: pkg.name, node: process.versions.node, electron: process.versions.electron };
  } catch {
    return { version: '?', name: 'cupbox', node: process.versions.node, electron: process.versions.electron };
  }
});

/* ---------- 版本检测与更新（5 分钟缓存；关闭开关在 core 层短路） ---------- */

let updateCache = null; // { at: number, info: UpdateInfo }

ipcMain.handle('update:check', async (_event, force) => {
  if (!force && updateCache && Date.now() - updateCache.at < 300_000) return updateCache.info;
  try {
    const info = await checkForUpdate({});
    updateCache = { at: Date.now(), info };
    return info;
  } catch (e) {
    // core 层承诺不抛错，这里兜底
    return { current: '?', latest: '?', hasUpdate: false, source: 'none', url: '', error: e instanceof Error ? e.message : String(e) };
  }
});

ipcMain.handle('open:external', async (_event, url) => {
  const u = String(url ?? '');
  if (!/^https:\/\//i.test(u)) return false; // 只放行 https：拒绝 file:///javascript: 等注入面
  try {
    await shell.openExternal(u);
    return true;
  } catch {
    return false;
  }
});

/* ---------- 桌面偏好（~/.cupbox/desktop.json，与 core 配置同目录） ---------- */

function cupboxHome() {
  return process.env.CUPBOX_HOME
    ? path.join(process.env.CUPBOX_HOME, '.cupbox')
    : path.join(app.getPath('home'), '.cupbox');
}
const PREFS_DEFAULT = { theme: 'dark', accent: 'aurora', mode: 'ask', workspace: '', disabledTools: [] };

async function loadPrefs() {
  try {
    const raw = await readFile(path.join(cupboxHome(), 'desktop.json'), 'utf8');
    return { ...PREFS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...PREFS_DEFAULT };
  }
}
async function savePrefs(patch) {
  const next = { ...(await loadPrefs()), ...(patch ?? {}) };
  await mkdir(cupboxHome(), { recursive: true });
  await writeFile(path.join(cupboxHome(), 'desktop.json'), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/* ---------- 会话（~/.cupbox/sessions/<id>.json） ---------- */

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/i; // 防路径穿越：ID 只允许安全字符
function sessionsDir() {
  return path.join(cupboxHome(), 'sessions');
}
async function listSessions() {
  try {
    const files = await readdir(sessionsDir());
    const out = [];
    for (const f of files) {
      if (!f.endsWith('.json') || !SAFE_ID.test(f.slice(0, -5))) continue;
      try {
        const s = JSON.parse(await readFile(path.join(sessionsDir(), f), 'utf8'));
        out.push({
          id: s.id,
          title: s.title || '(未命名会话)',
          updatedAt: s.updatedAt || '',
          workspace: s.workspace || '',
          mode: s.mode === 'agent' ? 'agent' : 'ask',
          count: (s.messages ?? []).length,
        });
      } catch { /* 跳过损坏文件 */ }
    }
    out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return out;
  } catch {
    return [];
  }
}
async function readSession(id) {
  if (!SAFE_ID.test(String(id ?? ''))) throw new Error('非法会话 ID');
  try {
    return JSON.parse(await readFile(path.join(sessionsDir(), `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}
async function writeSession(s) {
  await mkdir(sessionsDir(), { recursive: true });
  await writeFile(path.join(sessionsDir(), `${s.id}.json`), JSON.stringify(s, null, 2), 'utf8');
}
async function removeSession(id) {
  if (!SAFE_ID.test(String(id ?? ''))) throw new Error('非法会话 ID');
  await unlink(path.join(sessionsDir(), `${id}.json`)).catch(() => {});
}

ipcMain.handle('prefs:get', async () => loadPrefs());
ipcMain.handle('prefs:set', async (_e, patch) => {
  try {
    return { ok: true, prefs: await savePrefs(patch) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});
ipcMain.handle('ws:pick', async () => {
  const prefs = await loadPrefs();
  const r = await dialog.showOpenDialog({
    title: '选择工作区目录',
    defaultPath: prefs.workspace || app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  });
  const p = !r.canceled && r.filePaths[0] ? r.filePaths[0] : '';
  if (p) await savePrefs({ workspace: p });
  return p;
});

ipcMain.handle('sessions:list', async () => listSessions());
ipcMain.handle('sessions:read', async (_e, id) => readSession(id));
ipcMain.handle('sessions:delete', async (_e, id) => {
  await removeSession(id);
  return listSessions();
});
ipcMain.handle('sessions:clear', async (_e, id) => {
  const s = await readSession(id);
  if (s) {
    s.messages = [];
    s.updatedAt = new Date().toISOString();
    await writeSession(s);
  }
  return s;
});

/* ---------- 对话（ask = 多轮历史直连；agent = 工具循环） ---------- */

ipcMain.handle('chat:send', async (_e, payload) => {
  const p = payload ?? {};
  const text = String(p.text ?? '').trim();
  if (!text) return { ok: false, error: '消息不能为空' };
  try {
    const prefs = await loadPrefs();
    let sess = p.sessionId ? await readSession(p.sessionId) : null;
    const workspace = (sess && sess.workspace) || prefs.workspace || '';
    if (!sess) {
      sess = {
        id: `s-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        title: text.slice(0, 42),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workspace,
        mode: p.mode === 'agent' ? 'agent' : 'ask',
        messages: [],
      };
    }
    const system = [
      DEFAULT_SYSTEM,
      workspace ? `当前工作区：${workspace}。涉及文件 / 目录的任务优先在该目录下进行；引用路径时一律使用绝对路径。` : '',
      p.system ? String(p.system) : '',
    ].filter(Boolean).join('\n');
    const history = (sess.messages ?? []).filter(
      (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string',
    );
    const mode = p.mode === 'agent' ? 'agent' : 'ask';
    let result;
    if (mode === 'agent') {
      const disabled = Array.isArray(prefs.disabledTools) ? prefs.disabledTools : [];
      const tools = TOOL_DEFS.map((t) => t.name).filter((n) => !disabled.includes(n));
      result = await aiAgent({
        prompt: text,
        system,
        history,
        tools,
        ...(p.maxTurns ? { maxTurns: Number(p.maxTurns) } : {}),
      });
    } else {
      const r = await aiChat({
        messages: [{ role: 'system', text: system }, ...history, { role: 'user', text }],
      });
      result = { text: r.text };
    }
    // 成功后才落盘（失败不污染历史）
    sess.messages.push({ role: 'user', text });
    sess.messages.push({ role: 'assistant', text: result.text, ...(result.trace ? { trace: result.trace } : {}) });
    sess.mode = mode;
    sess.updatedAt = new Date().toISOString();
    if (!sess.workspace && workspace) sess.workspace = workspace;
    await writeSession(sess);
    return { ok: true, sessionId: sess.id, title: sess.title, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

// 自绘窗口控制（titleBarStyle: 'hidden' 后由页面按钮驱动）
function targetWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}
ipcMain.handle('win:minimize', () => {
  targetWindow()?.minimize();
  return true;
});
ipcMain.handle('win:toggle-maximize', () => {
  const w = targetWindow();
  if (!w) return false;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
  return w.isMaximized();
});
ipcMain.handle('win:close', () => {
  targetWindow()?.close();
  return true;
});

function smokeTarget() {
  const arg = process.argv.find((s) => s.startsWith('--smoke'));
  if (!arg) return null;
  const eq = arg.indexOf('=');
  return eq > 0 ? arg.slice(eq + 1) : path.join(ROOT, 'desktop-smoke.png');
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#0a0e18',
    title: 'Cupbox 可视化',
    titleBarStyle: 'hidden', // 去掉系统标题栏，窗口控制按钮由页面自绘（保留原生阴影）
    backgroundMaterial: 'acrylic', // Windows 11 亚克力玻璃；不支持的系统自动忽略
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenu(null);
  const smoke = smokeTarget();
  const htmlPath = path.join(__dirname, 'ui', 'index.html');
  if (smoke) {
    // 四帧取证：① 开启动画 ② 对话主区 ③ 工具抽屉（含真实运行结果） ④ 设置弹窗，随后退出
    const ext = path.extname(smoke);
    const base = ext ? smoke.slice(0, -ext.length) : smoke;
    const capture = async (p) => {
      const image = await win.webContents.capturePage();
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, image.toPNG());
      console.log(`[smoke] screenshot -> ${p}`);
    };
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => capture(`${base}-splash${ext}`).catch((e) => console.error('[smoke] splash failed:', e)), 2000);
      setTimeout(() => capture(`${base}${ext}`).catch((e) => console.error('[smoke] chat failed:', e)), 4400);
      setTimeout(() => capture(`${base}-drawer${ext}`).catch((e) => console.error('[smoke] drawer failed:', e)), 6400);
      setTimeout(async () => {
        try {
          await capture(`${base}-settings${ext}`);
          await new Promise((r) => setTimeout(r, 850));
          await capture(`${base}-light${ext}`);
          await new Promise((r) => setTimeout(r, 950));
          await capture(`${base}-update${ext}`); // 更新公告弹窗（冒烟注入假更新源时才有内容）
        } catch (e) {
          console.error('[smoke] settings failed:', e);
        }
        app.quit();
      }, 8100);
    });
    await win.loadFile(htmlPath, { query: { smoke: '1' } });
  } else {
    await win.loadFile(htmlPath);
  }
  return win;
}

app.whenReady().then(() => createWindow());
app.on('window-all-closed', () => app.quit());
