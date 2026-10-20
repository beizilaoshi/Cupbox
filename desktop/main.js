// Cupbox 可视化桌面壳 —— Electron 主进程
// 14 个本地工具走统一编排层 dist/core/toolkit.js（与 CLI / MCP 同一套引擎语义），
// AI 问答与 Agent（ai_ask/ai_agent）走 dist/core/ai.js；设置读写 ~/.cupbox/config.json。
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, dialog, shell,clipboard,nativeImage } from 'electron';

import { runTool, TOOL_DEFS } from '../dist/core/toolkit.js';
import { aiChat, aiAgent, loadAiConfig, saveAiConfig, DEFAULT_SYSTEM } from '../dist/core/ai.js';
import { dataHome, migrateLegacyHome } from '../dist/core/paths.js';
import { memoryPromptBlock, summaryPromptBlock, compactHistory } from '../dist/core/memory.js';
import { checkForUpdate } from '../dist/core/update.js';
import {
  contextBreakdown, estimateTokens, pushTrend, pushEvent, emptySessionContext,
} from '../dist/core/context.js';
import { importWallpaper } from './wallpaper.js';
import { importStartupMedia } from './startup-media.js';
import { createToolExecution } from './tool-execution.js';
import { SYSTEM_TOOLS, inside } from './execution-policy.js';
import { copyFile, realpath } from 'node:fs/promises';
import { createChatModels } from './chat-models.js';
import { createModelLibrary, publicModel } from './model-library.js';
import { resolveRoutes, runWorkflow } from './model-workflow.js';
import { randomUUID } from 'node:crypto';
import { ensureMessageIds, feedbackHistory, preferredContext, updateFeedback } from './response-context.js';
import { addFact, forgetFacts } from '../dist/core/memory.js';
import { digest } from './workbench/files.js';
import { ScopedState } from './workbench/state.js';
import { ProjectPolicy } from './workbench/policy.js';
import { Workbench } from './workbench/runtime.js';
import { DEFINITIONS as WORKBENCH_DEFS } from './workbench/definitions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.platform === 'win32') app.setAppUserModelId('Cupbox.Desktop');
// `electron desktop/` 开发时 appPath = desktop/；打包后 resources/app/package.json 在根
const ROOT = path.resolve(__dirname, '..');
const modelLibrary=createModelLibrary(cupboxHome);
const chatModels=createChatModels(modelLibrary);
const activeChats=new Map(),imageAttachments=new Map();
const workbenches=new Map(),watchedBenchSenders=new Set();
async function getWorkbench(sender,session,root){
  const key=sender.id+':'+session;let bench=workbenches.get(key);
  if(bench&&bench.root.toLowerCase()!==path.resolve(root).toLowerCase()){bench.dispose();workbenches.delete(key);bench=null;}
  if(!bench){bench=await new Workbench({root,home:cupboxHome(),session,approve:payload=>execution.authorizeAdvanced(sender,payload),getPrefs:loadPrefs,trash:file=>shell.trashItem(file),clipboard:{read:async()=>clipboard.readImage().toPNG(),write:async file=>{const image=nativeImage.createFromPath(file);if(image.isEmpty())throw Error('无法解码图片');clipboard.writeImage(image);return{written:true};}}}).init();workbenches.set(key,bench);if(!watchedBenchSenders.has(sender.id)){watchedBenchSenders.add(sender.id);sender.once('destroyed',()=>{for(const [id,b]of workbenches)if(id.startsWith(sender.id+':')){b.dispose();workbenches.delete(id);}watchedBenchSenders.delete(sender.id);});}for(const [id,b]of workbenches){if(workbenches.size<=32)break;if(id!==key&&!b.terminals.list().some(t=>!t.exited)){b.dispose();workbenches.delete(id);}}}
  return bench;
}
async function manualBench(event,session='manual'){const p=await loadPrefs();const root=p.executionEnvironment==='native'?p.workspace:execution.sandboxRoot();if(!root)throw Error('先选择工作目录，或切换到沙箱');return getWorkbench(event.sender,String(session),root);}
ipcMain.handle('workbench:list',()=>WORKBENCH_DEFS);
ipcMain.handle('workbench:run',async(event,{name,args,sessionId})=>{try{return await(await manualBench(event,sessionId||'manual')).call(name,args);}catch(e){return{ok:false,code:e.code,message:e.message};}});
ipcMain.handle('workbench:policy:get',async(event,sessionId)=>{const b=await manualBench(event,sessionId||'manual');return{policy:b.policy.value,proposal:await b.policy.proposal(),auditFile:b.policy.auditFile};});
ipcMain.handle('workbench:policy:set',async(event,{policy,sessionId})=>{const b=await manualBench(event,sessionId||'manual');if(!await execution.authorizeAdvanced(event.sender,{tool:'修改项目授权策略',args:policy,risk:'system',force:true,directory:b.root}))return{ok:false,message:'策略变更未批准'};try{return{ok:true,policy:await b.policy.save(policy)};}catch(e){return{ok:false,message:e.message};}});
ipcMain.handle('models:list',async()=> (await modelLibrary.list()).map(publicModel));
ipcMain.handle('models:save',async(_e,draft)=>{try{return{ok:true,models:await modelLibrary.save(draft)};}catch(e){return{ok:false,error:e.message};}});
ipcMain.handle('models:remove',async(_e,id)=>modelLibrary.remove(id));
ipcMain.handle('freemodel:list',async(_e,opts={})=>{const fm=await import('../dist/core/freemodel.js');return fm.listFreeModels(opts.refresh?{refresh:true}:{offline:true});});
ipcMain.handle('chat:models',()=>chatModels.catalog());
ipcMain.handle('freemodel:selectable',(_e,p)=>chatModels.toggleModel(String(p.id),p.enabled===true));
ipcMain.handle('freemodel:probe',(_e,id)=>chatModels.probe(String(id)));
ipcMain.handle('freemodel:toggle',async(_e,{enabled})=>{const fm=await import('../dist/core/freemodel.js');await fm.saveFreeStore({enabled:enabled===true});return{enabled:enabled===true};});
ipcMain.handle('freemodel:get',async()=>{const fm=await import('../dist/core/freemodel.js');return fm.loadFreeStore();});
ipcMain.handle('chat:cancel',event=>{const c=activeChats.get(event.sender.id);if(c){c.abort();execution.cancel(event.sender);}return Boolean(c);});
ipcMain.handle('chat:images',async event=>{
  const r=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:'添加参考图片（发送时上传至所选模型服务）',properties:['openFile','multiSelections'],filters:[{name:'图片',extensions:['png','jpg','jpeg','webp']}]});
  const files=[];for(const file of r.canceled?[]:r.filePaths.slice(0,4)){
    const data=await readFile(file);if(data.length>8*1024*1024)throw Error('单张图片不能超过 8 MB');
    const ext=path.extname(file).toLowerCase(),mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';
    const id=randomUUID(),item={id,name:path.basename(file),mime,data:`data:${mime};base64,${data.toString('base64')}`,sender:event.sender.id};imageAttachments.set(id,item);files.push({id,name:item.name});
  }
  const owned=[...imageAttachments.values()].filter(a=>a.sender===event.sender.id);for(const a of owned.slice(0,Math.max(0,owned.length-8)))imageAttachments.delete(a.id);
  return files;
});
ipcMain.handle('chat:export',async(event,id)=>{
  const s=await readSession(id);if(!s)throw Error('请先完成一次对话');
  const r=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'导出对话',defaultPath:'Cupbox-任务.md',filters:[{name:'Markdown',extensions:['md']}]});
  if(r.canceled)return false;
  await writeFile(r.filePath,`# ${s.title}\n\n`+s.messages.map(m=>`## ${m.role==='user'?'你':'Cupbox'}\n\n${m.text}\n`+(m.tasks||[]).map(t=>`\n### ${t.title} · ${t.status}\n\n${t.text||t.error||''}\n`).join('')+(m.media||[]).map(a=>`\n[${a.name}](${a.url})\n`).join('')).join('\n'),'utf8');return true;
});

/** 桌面专属 AI 入口：mode = ask（单次问答）| agent（Codex 式工具循环）。 */
const execution=createToolExecution({getPrefs:async()=>{await prefsWrite.catch(()=>{});return loadPrefs();},home:cupboxHome,audit:async(tool,args,result,duration)=>{const p=await loadPrefs();await new ProjectPolicy(p.workspace||execution.sandboxRoot(),cupboxHome()).audit(tool,args,result,duration);}});
async function desktopAi(a,sender) {
  const prompt = String(a.prompt ?? '').trim();
  if (!prompt) throw new Error('请输入问题 / 任务内容');
  if ((a.mode ?? 'ask') === 'agent') {
    const p=await loadPrefs(),root=p.executionEnvironment==='native'?p.workspace:execution.sandboxRoot();if(!root)throw Error('请先选择工作目录');const bench=await getWorkbench(sender,'manual',root);
    return aiAgent({
      toolDefinitions:bench.definitions,tools:[...TOOL_DEFS.map(t=>t.name).filter(n=>!['rename','organize','obfuscate','zip'].includes(n)),...bench.definitions.map(t=>t.name)],
      prompt,
      executeTool:(name,args)=>bench.handles(name)?bench.call(name,args).then(r=>{if(!r.ok)throw Error(r.code+': '+r.message);return r;}):execution.execute(sender,name,args,'agent'),
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

ipcMain.handle('cupbox:tool', async (event, tool, args) => {
  try {
    const a = args ?? {};
    const result = tool === 'ai' ? await desktopAi(a,event.sender) : WORKBENCH_DEFS.some(d=>d.name===tool)?await(await manualBench(event)).call(tool,a):await execution.execute(event.sender,tool,a);
    if(result?.ok===false)return{ok:false,error:result.code+': '+result.message,result};
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

function publicConfig(config){const {apiKey,...rest}=config;return {...rest,hasApiKey:Boolean(apiKey)};}
ipcMain.handle('ai:models',async(_event,draft={})=>{
  const current=await loadAiConfig();
  const same=(draft.preset||'custom')===(current.preset||'custom') && String(draft.baseUrl||'').replace(/\/+$/,'')===String(current.baseUrl||'').replace(/\/+$/,'');
  const config={...current,...draft,apiKey:draft.apiKey || (same?current.apiKey:'')};
  try {
    const url=new URL(config.baseUrl || (config.provider==='anthropic'?'https://api.anthropic.com':'https://api.openai.com/v1'));
    if(!['http:','https:'].includes(url.protocol))throw new Error('请输入 HTTP 或 HTTPS 服务地址');
    const base=url.href.replace(/\/+$/,'');
    const endpoint=config.provider==='anthropic'&&!base.endsWith('/v1')?`${base}/v1/models`:`${base}/models`;
    const headers=config.provider==='anthropic'?{'x-api-key':config.apiKey,'anthropic-version':'2023-06-01'}:(config.apiKey?{authorization:`Bearer ${config.apiKey}`} : {});
    const response=await fetch(endpoint,{headers,signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(`连接失败（HTTP ${response.status}），请检查服务地址和密钥`);
    const data=await response.json();
    const models=(data.data||data.models||[]).map(m=>String(m.id||m.name||'')).filter(Boolean).slice(0,1000).sort();
    return {ok:true,models};
  }catch(e){return{ok:false,error:e.name==='TimeoutError'?'连接超时，请检查服务地址':e.message};}
});
ipcMain.handle('execution:respond',(event,id,allow)=>execution.respond(event.sender,id,allow));
ipcMain.handle('execution:context',async()=>({sandbox:execution.sandboxRoot()}));
ipcMain.handle('sandbox:open',async()=>{await mkdir(execution.sandboxRoot(),{recursive:true});return shell.openPath(execution.sandboxRoot());});
async function importFiles(files) {
  const root=execution.sandboxRoot();await mkdir(root,{recursive:true});const copied=[];
  for(const file of files){
    let name=path.basename(file),dest=path.join(root,name),n=1;
    while(true){try{await copyFile(file,dest,1);break;}catch(e){if(e.code!=='EEXIST')throw e;const ext=path.extname(name);dest=path.join(root,`${path.basename(name,ext)} (${n++})${ext}`);}}
    copied.push(dest);
  }return copied;
}
ipcMain.handle('sandbox:import',async()=>{
  const r=await dialog.showOpenDialog(targetWindow(),{title:'导入文件到沙箱（保留原文件）',properties:['openFile','multiSelections']});
  return r.canceled?[]:importFiles(r.filePaths);
});
ipcMain.handle('tool:pick',async(_event,kind)=>{
  if(!['file','directory','save','files'].includes(kind))return '';
  await prefsWrite.catch(()=>{});const p=await loadPrefs();
  const sandbox=p.executionEnvironment!=='native';const root=execution.sandboxRoot();
  if(sandbox)await mkdir(root,{recursive:true});
  const options={defaultPath:sandbox?root:p.workspace||undefined,title:kind==='directory'?'选择文件夹':'选择文件'};
  if(kind==='save'){const r=await dialog.showSaveDialog(targetWindow(),options);return r.canceled?'':r.filePath;}
  const r=await dialog.showOpenDialog(targetWindow(),{...options,properties:kind==='directory'?['openDirectory']:kind==='files'?['openFile','multiSelections']:['openFile']});
  if(r.canceled)return '';
  if(sandbox&&kind==='directory'&&!inside(await realpath(root),await realpath(r.filePaths[0])))throw new Error('沙箱模式请选择沙箱内的目录；可用“打开沙箱”管理文件');
  const files=sandbox&&kind!=='directory'?await importFiles(r.filePaths):r.filePaths;
  return kind==='files'?files.join(','):files[0];
});

// 设置页：与 CLI `cupbox ai config` 读写同一个 ~/.cupbox/config.json
ipcMain.handle('ai:config:get', async () => {
  try {
    return { ok: true, config: publicConfig(await loadAiConfig()) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});
ipcMain.handle('ai:config:set', async (_event, patch) => {
  try {
    const config = await saveAiConfig(patch ?? {});
    return { ok: true, config:publicConfig(config) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

ipcMain.handle('cupbox:info', async () => {
  try {
    const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
    return { version: pkg.version, name: pkg.name, node: process.versions.node, electron: process.versions.electron, tools: TOOL_DEFS.length };
  } catch {
    return { version: '?', name: 'cupbox', node: process.versions.node, electron: process.versions.electron, tools: TOOL_DEFS.length };
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
  // v1.0.2：数据默认存「文档/Cupbox」；CUPBOX_HOME 保持整体覆盖（与 CLI/MCP 同语义）
  return dataHome(app.getPath('documents'));
}
const PREFS_DEFAULT = { multiModel:false,workflow:'direct',parallelTasks:2, approvalMode:'smart',executionEnvironment:'native', theme: 'light', accent: 'aurora', mode: 'ask', workspace: '', disabledTools: [], background: 'sakura', backgroundVeil: 72, backgroundBlur: 0, backgroundFit: 'cover', startupEnabled:true, startupStyle:'orbit', startupDuration:1.6, startupCaption:'让灵感，轻轻启程。' };

async function loadPrefs() {
  try {
    const raw = await readFile(path.join(cupboxHome(), 'desktop.json'), 'utf8');
    return { ...PREFS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...PREFS_DEFAULT };
  }
}
let prefsWrite = Promise.resolve();
function savePrefs(patch) {
  const write = prefsWrite.catch(() => {}).then(() => writePrefs(patch));
  prefsWrite = write;
  return write;
}
async function writePrefs(patch) {
  const next = { ...(await loadPrefs()), ...(patch ?? {}) };
  await mkdir(cupboxHome(), { recursive: true });
  const dest = path.join(cupboxHome(), 'desktop.json');
  await writeFile(`${dest}.tmp`, JSON.stringify(next, null, 2), 'utf8');
  await rename(`${dest}.tmp`, dest);
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
    return ensureMessageIds(JSON.parse(await readFile(path.join(sessionsDir(), `${id}.json`), 'utf8')));
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

ipcMain.handle('prefs:get', async () => { await prefsWrite.catch(() => {}); return loadPrefs(); });
ipcMain.handle('wallpaper:pick', async () => {
  const result = await dialog.showOpenDialog(targetWindow(), {
    title: '选择你的背景图片', properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true };
  try {
    const wallpaper = await importWallpaper(result.filePaths[0], cupboxHome());
    await savePrefs({ customBackground: wallpaper.url, customBackgroundName: wallpaper.name, background: 'custom' });
    return { ok: true, ...wallpaper };
  } catch (error) { return { ok: false, error: error.message }; }
});
ipcMain.handle('startup:pick', async () => {
  const result = await dialog.showOpenDialog(targetWindow(), {
    title:'选择启动动画素材', properties:['openFile'],
    filters:[{name:'动画、视频或图片',extensions:['gif','mp4','webm','png','jpg','jpeg','webp']}],
  });
  if (result.canceled || !result.filePaths[0]) return {ok:true,canceled:true};
  try {
    const media = await importStartupMedia(result.filePaths[0],cupboxHome());
    await savePrefs({startupStyle:'custom',customStartupUrl:media.url,customStartupKind:media.kind,customStartupName:media.name});
    return {ok:true,...media};
  } catch (error) { return {ok:false,error:error.message}; }
});
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

/** 上下文洞察：返回会话的成分分解 / 趋势 / 事件记录（无记录时返回空档案 + Agent 基线）。 */
ipcMain.handle('context:stats', async (_e, id) => {
  let record = emptySessionContext();
  if (id) {
    const s = await readSession(id).catch(() => null);
    if (s && s.context && Array.isArray(s.context.trend)) record = { ...record, ...s.context };
  }
  let baseline = null;
  try {
    baseline = await runTool('context_stats', {});
  } catch { /* 基线仅作参考，失败忽略 */ }
  return { record, baseline };
});

let responseUpdates=Promise.resolve();
function updateResponse(event,p,remember=false){
 const operation=responseUpdates.catch(()=>{}).then(async()=>{
  if(activeChats.has(event.sender.id))throw Error('请在当前任务结束后评价或修改记忆');
  const sess=await readSession(p.sessionId);if(!sess)throw Error('找不到这次对话');
  const message=sess.messages.find(m=>m.id===p.messageId&&m.role==='assistant');if(!message)throw Error('找不到这条回复');
  if(remember){
    const text=String(p.text||'').trim();if(text.length>600)throw Error('记忆内容最多 600 字');if(text&&message.feedback==='down')throw Error('不准确的回复不能保存为记忆');
    if(message.memoryId)await forgetFacts(message.memoryId);
    message.memoryId=text?(await addFact(text,'response:'+sess.id+':'+message.id,{projectKey:digest(path.resolve(sess.workspace||'').toLowerCase())})).id:undefined;message.memoryText=text||undefined;
  }else{
    updateFeedback(sess,p.messageId,p.value);
    if(p.value==='down'&&message.memoryId){await forgetFacts(message.memoryId);delete message.memoryId;delete message.memoryText;}
  }
  sess.summary=null;await writeSession(sess);return{ok:true,message};
 });responseUpdates=operation;return operation.catch(e=>({ok:false,error:e.message}));
}
ipcMain.handle('response:feedback',(event,p)=>updateResponse(event,p));
ipcMain.handle('response:remember',(event,p)=>updateResponse(event,p,true));

/* ---------- 对话（ask = 多轮历史直连；agent = 工具循环） ---------- */

ipcMain.handle('chat:send', async (event, payload) => {
  const p = payload ?? {};
  const text = String(p.text ?? '').trim();
  if (!text) return { ok: false, error: '消息不能为空' };
  if(activeChats.has(event.sender.id))return{ok:false,error:'当前任务仍在运行'};
  const controller=new AbortController();activeChats.set(event.sender.id,controller);
  let filesystem=null;
  const close=()=>{controller.abort();execution.cancel(event.sender);};event.sender.once('destroyed',close);
  try {
    await responseUpdates.catch(()=>{});
    const prefs = await loadPrefs();
    let sess = p.sessionId ? await readSession(p.sessionId) : null;
    const workspace = prefs.executionEnvironment === 'native' ? ((sess && sess.workspace) || prefs.workspace || '') : execution.sandboxRoot();
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
    let system = [
      DEFAULT_SYSTEM,
      workspace ? `当前工作区：${workspace}。涉及文件 / 目录的任务优先在该目录下进行；引用路径时一律使用绝对路径。` : '',
      p.system ? String(p.system) : '',
    ].filter(Boolean).join('\n');
    const baseSystem = system; // 成分分解：系统提示词与注入块分开计量
    let injectedText = '';     // 注入上下文（历史摘要 + 记忆块）
    let history = feedbackHistory(sess);
    const preferred=preferredContext(sess);if(preferred){system+=`\n${preferred}`;injectedText+=preferred;}
    // 上下文压缩：历史过长时把旧轮次浓缩为摘要，只保留最近几轮原文（设计参考 dsh-mnemon）
    const chatChoices=await chatModels.select(p.routes||{},p.reasoningEfforts||{});
    const configFor=id=>id==='default'?chatChoices.legacy:chatChoices.models.find(m=>m.id===id);
    const aiCfg = chatChoices.apply(configFor(p.routes?.text||Object.values(p.routes||{})[0])||chatChoices.legacy);
    if(p.mode==='agent'&&aiCfg.provider==='free')throw Error('免费通道当前只支持问答，请切换到“问一问”或选择支持工具的模型');
    const compacted = await compactHistory(history, { config: aiCfg, summary: sess.summary ?? null,signal:controller.signal });
    if (compacted.compactedTurns > 0) {
      sess.summary = compacted.summary;
      history = compacted.kept;
    }
    const sb = summaryPromptBlock(compacted.summary);
    if(sb){system+=`\n${sb}`;injectedText+=`${sb}\n`;}
    // 记忆注入：运行时记忆（用户画像/协作约定）常驻 + 按本条消息召回相关长期事实
    const projectKey=digest(path.resolve(workspace||'').toLowerCase());
    const memBlock = await memoryPromptBlock(text,projectKey);
    if (memBlock) { system += `\n${memBlock}`; injectedText += `${memBlock}\n`; }
    if(workspace){const state=new ScopedState(workspace,cupboxHome());const scoped=await state.memory('memory_recall',{query:text,scope:'project'});if(scoped.facts.length){const block='\n【当前项目记忆】\n'+scoped.facts.map(f=>f.text).join('\n');system+=block;injectedText+=block;}}
    const mode = p.mode === 'agent' ? 'agent' : 'ask';
    if(mode==='agent'&&aiCfg.provider==='free')throw Error('免费通道当前只支持问答，请切换到“问一问”或选择支持工具的模型');
    let result;
    const signal=controller.signal;
    const disabled=Array.isArray(prefs.disabledTools)?prefs.disabledTools:[];
    let tools=TOOL_DEFS.map(t=>t.name).filter(n=>!disabled.includes(n)&&(prefs.executionEnvironment==='native'||!SYSTEM_TOOLS.has(n)));
    if(mode==='agent'&&workspace){
      filesystem=await getWorkbench(event.sender,sess.id,workspace);
      tools=tools.filter(n=>!['rename','organize','obfuscate','zip'].includes(n));tools.push(...filesystem.definitions.filter(t=>!disabled.includes(t.name)&&(prefs.filesystemTools!==false||!t.name.startsWith('fs_'))).map(t=>t.name));tools=[...new Set(tools)];
      system+='\n开发工具已连接。必须先 fs_read/fs_stat 读取再修改。所有修改工具默认 dryRun，收到 confirmToken 后用完全相同参数加 dryRun:false、confirmToken 才执行。预览不是完成。写入后读取验证。http 域名需要批准，shell 与终端输入每次人工批准；项目策略文件不能自行放宽授权。项目记忆使用 scope:project。';
    }
    if(mode==='agent'&&!workspace)tools=tools.filter(n=>!['run','proc','rename','organize','zip','obfuscate'].includes(n));
    const integrate=(prompt,config,scope)=> {config=chatChoices.apply(config);if(mode==='agent'&&config.provider==='free')throw Error('免费通道不支持执行任务');return mode==='agent'?aiAgent({prompt,system,history,config,signal,tools:scope?tools.filter(n=>n.startsWith('fs_')):tools,toolDefinitions:filesystem?.definitions||[],executeTool:(name,args)=>{const def=filesystem?.definitions.find(t=>t.name===name);return def?filesystem.call(name,args,scope,signal).then(r=>{if(!r.ok)throw Error(r.code+': '+r.message);return r;}):execution.execute(event.sender,name,args,'agent',signal);},onToolStart:call=>{if(!event.sender.isDestroyed())event.sender.send('chat:tool',{runId:p.runId,phase:'start',call});},onTool:item=>{if(!event.sender.isDestroyed())event.sender.send('chat:tool',{runId:p.runId,phase:'done',item});}}):aiChat({messages:[{role:'system',text:system},...history,{role:'user',text:prompt}],config,signal,conversationKey:sess.id});};
    if(p.capabilities?.length || (prefs.multiModel&&p.workflow&&p.workflow!=='direct')) {
      const selected=resolveRoutes({models:chatChoices.models,legacy:chatChoices.legacy,capabilities:p.capabilities,routes:p.routes,multiModel:prefs.multiModel===true});
      for(const route of selected)if(route.cap==='text')route.model=chatChoices.apply(route.model);
      const attachments=(p.attachments||[]).map(id=>imageAttachments.get(id)).filter(a=>a?.sender===event.sender.id);
      if((p.attachments||[]).length!==attachments.length)throw Error('参考图片已失效，请重新添加');
      if(attachments.length&&!selected.some(r=>r.cap==='vision'||r.cap==='video'))throw Error('添加图片后，请勾选视觉或视频能力');
      const workflow=prefs.multiModel&&['direct','project','plan','review','auto'].includes(p.workflow)?p.workflow:'direct';
      if(p.reviewerId&&workflow==='review'){
        const reviewer=(await modelLibrary.list()).find(m=>m.id===p.reviewerId&&m.enabled&&m.capabilities.includes('text'));
        if(!reviewer)throw Error('审阅模型不可用');selected.push({cap:'text',model:chatChoices.apply(reviewer)});
      }
      if(workflow==='direct'&&selected.length===1&&selected[0].cap==='text')result=await integrate(text,selected[0].model);
      else {result=await runWorkflow({selected,workerModels:(await modelLibrary.list()).filter(m=>prefs.multiModel&&m.enabled&&m.capabilities.includes('text')&&(prefs.projectWorkers||[]).includes(m.id)).map(chatChoices.apply),workflow,scene:p.scene||'auto',criteria:String(p.criteria||'').slice(0,1000),quality:p.quality||'balanced',workRoot:workspace,executeText:mode==='agent'?(task,model)=>integrate(task.prompt,model,task.outputDir):undefined,parallel:Math.min(3,Math.max(1,Number(prefs.parallelTasks)||2)),prompt:text,system,history,attachments,signal,home:cupboxHome,emit:task=>{if(!event.sender.isDestroyed())event.sender.send('chat:progress',{runId:p.runId,task});},integrate});
        if(mode==='agent'&&['direct','review'].includes(workflow)&&selected.some(r=>r.cap==='text')&&!signal.aborted){
          const merged=await integrate('原始目标：'+text+'\n各模型交付：'+result.text+'\n媒体文件：'+(result.media||[]).map(m=>m.url).join('\n')+'\n请整合交付并按需使用本地工具落实。',selected.find(r=>r.cap==='text').model);
          result={...result,text:merged.text,trace:[...(result.trace||[]),...(merged.trace||[])]};
        }
      }
    }else result=await integrate(text,aiCfg);
    delete result.reasoningContent;
    // 成功后才落盘（失败不污染历史）
    const prevMode = sess.mode; // 模式切换检测（记录事件用）
    sess.messages.push({ id:randomUUID(),role: 'user', text });
    const assistantMessage={ id:randomUUID(),role:'assistant',text:result.text, ...(result.trace ? { trace: result.trace } : {}), ...(result.tasks?{tasks:result.tasks}:{}), ...(result.media?{media:result.media}:{}) };sess.messages.push(assistantMessage);result={...result,messageId:assistantMessage.id};
    sess.chatSelection={routes:p.routes||{},reasoningEfforts:p.reasoningEfforts||{},capabilities:p.capabilities||['text']};
    sess.mode = mode;
    sess.updatedAt = new Date().toISOString();
    if (!sess.workspace && workspace) sess.workspace = workspace;
    // ---- 上下文洞察：本次请求后的六成分快照 + 趋势点 + 事件 ----
    {
      const ctx = sess.context && Array.isArray(sess.context.trend) ? sess.context : emptySessionContext();
      const toolSchemas = mode === 'agent' && tools.length
        ? JSON.stringify([...TOOL_DEFS,...(filesystem?.definitions||[])].filter(t => tools.includes(t.name)))
        : '';
      const bd = contextBreakdown({
        system: baseSystem,
        toolSchemas,
        injected: injectedText,
        messages: feedbackHistory(sess),
      });
      ctx.window = bd.window;
      ctx.last = bd;
      const usage = result.usage;
      const now = Date.now();
      ctx.trend = pushTrend(ctx.trend, {
        at: now,
        tokens: bd.total,
        ...(usage ? { prompt: usage.prompt, completion: usage.completion } : {}),
        label: text.slice(0, 24),
      });
      ctx.totals = {
        requests: ctx.totals.requests + (result.requests ?? 1),
        prompt: ctx.totals.prompt + (usage?.prompt ?? 0),
        output: ctx.totals.output + (usage?.completion ?? 0),
      };
      // 事件1：注入块 token 变化（记忆/摘要内容变了才报，避免每轮重复）
      const injectTokens = estimateTokens(injectedText);
      if (injectTokens > 0 && injectTokens !== (ctx.lastInjectTokens ?? 0)) {
        ctx.events = pushEvent(ctx.events, {
          at: now, kind: 'inject',
          label: injectTokens > (ctx.lastInjectTokens ?? 0) ? '记忆 / 摘要注入' : '注入内容更新',
          delta: injectTokens - (ctx.lastInjectTokens ?? 0),
        });
        ctx.lastInjectTokens = injectTokens;
      }
      // 事件2：上下文压缩（记录回收量为负 delta）
      if (compacted.compactedTurns > 0) {
        const freed = Math.max(0, Math.round((compacted.charsBefore - compacted.charsAfter) / 4));
        ctx.events = pushEvent(ctx.events, {
          at: now, kind: 'compact',
          label: `压缩 ${compacted.compactedTurns} 轮历史`,
          delta: -freed,
        });
      }
      // 事件3：模型切换
      const model = aiCfg?.model || '';
      if (model && ctx.model && ctx.model !== model) {
        ctx.events = pushEvent(ctx.events, { at: now, kind: 'switch', label: `${ctx.model} → ${model}` });
      }
      if (model) ctx.model = model;
      // 事件4：模式切换 ask ↔ agent
      if (prevMode && prevMode !== mode) {
        ctx.events = pushEvent(ctx.events, {
          at: now, kind: 'mode',
          label: `${prevMode === 'agent' ? 'Agent' : '问答'} → ${mode === 'agent' ? 'Agent' : '问答'}`,
        });
      }
      sess.context = ctx;
    }
    await writeSession(sess);
    if (compacted.compactedTurns > 0) {
      result = { ...result, compaction: { turns: compacted.compactedTurns, charsBefore: compacted.charsBefore, charsAfter: compacted.charsAfter, ...(compacted.fallback ? { fallback: compacted.fallback } : {}) } };
    }
    return { ok: true, sessionId: sess.id, title: sess.title, result };
  } catch (e) {
    return { ok: false, error: controller.signal.aborted?'任务已停止；已开始的本地操作会完成，服务端生成任务可能继续运行':e.message };
  } finally {await filesystem?.close();activeChats.delete(event.sender.id);event.sender.removeListener('destroyed',close);}

});

// 自绘窗口控制（titleBarStyle: 'hidden' 后由页面按钮驱动）
function targetWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}
ipcMain.handle('win:minimize', event => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
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
    backgroundColor: '#f9faff',
    title: 'Cupbox 可视化',
    icon: path.join(__dirname, 'ui', 'assets', process.platform === 'win32' ? 'cupbox-logo.ico' : 'cupbox-logo.png'),
    titleBarStyle: 'hidden', // 去掉系统标题栏，窗口控制按钮由页面自绘（保留原生阴影）
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
          await new Promise((r) => setTimeout(r, 700));
          await capture(`${base}-context${ext}`); // 上下文洞察面板（渲染端 10.0s 打开）
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

app.whenReady().then(async () => {
  // 旧版 ~/.cupbox 首次启动迁移到「文档/Cupbox」（静默、不覆盖、失败不影响）
  await migrateLegacyHome({ target: cupboxHome() }).catch(() => false);
  await createWindow();
});

/* ---------- 存储管理（v1.0.2：数据默认在 文档/Cupbox） ---------- */
ipcMain.handle('storage:info', () => ({
  home: cupboxHome(),
  legacy: path.join(app.getPath('home'), '.cupbox'),
  envOverride: Boolean(process.env.CUPBOX_HOME && process.env.CUPBOX_HOME.trim()),
}));
ipcMain.handle('storage:open', async () => {
  await mkdir(cupboxHome(), { recursive: true });
  return shell.openPath(cupboxHome());
});
ipcMain.handle('storage:reveal', () => {
  shell.showItemInFolder(path.join(cupboxHome(), 'config.json'));
  return true;
});
app.on('window-all-closed', () => app.quit());
