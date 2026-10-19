// Cupbox 可视化桌面壳 —— preload（沙箱模式，CJS）
// 最小 API 面：工具调用 + 应用信息 + 窗口控制。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cupbox', {
  modelsList:()=>ipcRenderer.invoke('models:list'),
  modelSave:draft=>ipcRenderer.invoke('models:save',draft),
  modelRemove:id=>ipcRenderer.invoke('models:remove',id),
  chatImages:()=>ipcRenderer.invoke('chat:images'),
  chatCancel:()=>ipcRenderer.invoke('chat:cancel'),
  chatExport:id=>ipcRenderer.invoke('chat:export',id),
  onChatProgress:callback=>{const fn=(_e,value)=>callback(value);ipcRenderer.on('chat:progress',fn);return()=>ipcRenderer.removeListener('chat:progress',fn);},
  onChatTool:callback=>{const fn=(_e,value)=>callback(value);ipcRenderer.on('chat:tool',fn);return()=>ipcRenderer.removeListener('chat:tool',fn);},
  onApprovalCanceled:callback=>{const fn=(_e,id)=>callback(id);ipcRenderer.on('execution:approval-canceled',fn);return()=>ipcRenderer.removeListener('execution:approval-canceled',fn);},
  run: (tool, args) => ipcRenderer.invoke('cupbox:tool', tool, args),
  info: () => ipcRenderer.invoke('cupbox:info'),
  aiConfigGet: () => ipcRenderer.invoke('ai:config:get'),
  aiConfigSet: (patch) => ipcRenderer.invoke('ai:config:set', patch),
  aiModels: (draft) => ipcRenderer.invoke('ai:models',draft),
  // 存储管理（数据目录默认 文档/Cupbox）
  storageInfo: () => ipcRenderer.invoke('storage:info'),
  storageOpen: () => ipcRenderer.invoke('storage:open'),
  storageReveal: () => ipcRenderer.invoke('storage:reveal'),
  executionContext:()=>ipcRenderer.invoke('execution:context'),
  executionRespond:(id,allow)=>ipcRenderer.invoke('execution:respond',id,allow),
  onApproval:(callback)=>{const listener=(_e,value)=>callback(value);ipcRenderer.on('execution:approval',listener);return()=>ipcRenderer.removeListener('execution:approval',listener);},
  onExecution:(callback)=>{const listener=(_e,value)=>callback(value);ipcRenderer.on('execution:progress',listener);return()=>ipcRenderer.removeListener('execution:progress',listener);},
  pickToolPath:(kind)=>ipcRenderer.invoke('tool:pick',kind),
  importSandbox:()=>ipcRenderer.invoke('sandbox:import'),
  openSandbox:()=>ipcRenderer.invoke('sandbox:open'),
  // 桌面偏好（主题/强调色/工作区/插件开关）
  prefsGet: () => ipcRenderer.invoke('prefs:get'),
  prefsSet: (patch) => ipcRenderer.invoke('prefs:set', patch),
  pickWallpaper: () => ipcRenderer.invoke('wallpaper:pick'),
  pickStartupMedia: () => ipcRenderer.invoke('startup:pick'),
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
