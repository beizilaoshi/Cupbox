// Cupbox 可视化桌面壳 —— preload（沙箱模式，CJS）
// 最小 API 面：工具调用 + 应用信息 + 窗口控制。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cupbox', {
  run: (tool, args) => ipcRenderer.invoke('cupbox:tool', tool, args),
  info: () => ipcRenderer.invoke('cupbox:info'),
  aiConfigGet: () => ipcRenderer.invoke('ai:config:get'),
  aiConfigSet: (patch) => ipcRenderer.invoke('ai:config:set', patch),
  // 桌面偏好（主题/强调色/工作区/插件开关）
  prefsGet: () => ipcRenderer.invoke('prefs:get'),
  prefsSet: (patch) => ipcRenderer.invoke('prefs:set', patch),
  pickWorkspace: () => ipcRenderer.invoke('ws:pick'),
  // 会话（对话历史）
  sessionsList: () => ipcRenderer.invoke('sessions:list'),
  sessionsRead: (id) => ipcRenderer.invoke('sessions:read', id),
  sessionsDelete: (id) => ipcRenderer.invoke('sessions:delete', id),
  sessionsClear: (id) => ipcRenderer.invoke('sessions:clear', id),
  chatSend: (payload) => ipcRenderer.invoke('chat:send', payload),
  // 版本检测 / 更新公告 / 外链（GitHub 下载源）
  updateCheck: (force) => ipcRenderer.invoke('update:check', Boolean(force)),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  win: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('win:toggle-maximize'),
    close: () => ipcRenderer.invoke('win:close'),
  },
});
