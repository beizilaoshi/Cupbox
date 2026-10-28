// Cupbox AI 工作台 —— 渲染层（会话 / 工具抽屉 / 设置弹窗；纯静态、无外部依赖）
"use strict";

/* ---------------- 本地工具表（原主界面已折叠进「工具箱」抽屉） ---------------- */

const TOOLS = [
  { id: "hash", name: "哈希计算", group: "数据", hint: "md5 / sha1 / sha256 / sha512。文本与文件二选一。",
    fields: [
      { k: "text", label: "文本", type: "text", ph: "hello world" },
      { k: "file", label: "或：文件路径", type: "text", ph: "C:/path/file.txt" },
      { k: "algo", label: "算法（逗号分隔）", type: "text", value: "sha256" },
    ] },
  { id: "time", name: "时间转换", group: "数据", hint: "秒/毫秒时间戳或日期字符串 → ISO / UTC / 北京时间 / 相对时间。",
    fields: [
      { k: "input", label: "时间戳或日期（留空 = 当前时间）", type: "text", ph: "1718000000 或 2026-10-18 10:00" },
    ] },
  { id: "codec", name: "编解码", group: "数据", hint: "base64 / URL / HTML / JSON 互转，带合法性校验。",
    fields: [
      { k: "op", label: "操作", type: "select", options: ["b64e", "b64d", "urle", "urlde", "html-esc", "html-unesc", "json", "json-min"], value: "b64e" },
      { k: "text", label: "文本", type: "textarea", ph: "输入内容" },
    ] },
  { id: "csv", name: "CSV ↔ JSON", group: "数据", hint: "RFC 4180：引号、转行、转义全支持；自动识别常见分隔符。",
    fields: [
      { k: "to", label: "转换为", type: "select", options: ["json", "csv"], value: "json" },
      { k: "text", label: "粘贴 CSV / JSON 文本", type: "textarea", ph: "name,age\nalice,30\nbob,25" },
    ] },
  { id: "search", name: "搜索", group: "文件", hint: "文件名 + 内容双搜索；自动跳过 node_modules/.git 等噪音目录。",
    fields: [
      { k: "root", label: "目录", type: "text", ph: "E:/project" },
      { k: "pattern", label: "文件名包含", type: "text" },
      { k: "content", label: "内容包含", type: "text" },
      { k: "glob", label: "glob 过滤", type: "text", ph: "*.ts" },
      { k: "regex", label: "按正则匹配", type: "checkbox" },
    ] },
  { id: "rename", name: "批量重命名", group: "文件", warn: "破坏性工具 · 默认 dry-run 预览",
    fields: [
      { k: "dir", label: "目录", type: "text" },
      { k: "find", label: "查找", type: "text" },
      { k: "replace", label: "替换为", type: "text" },
      { k: "template", label: "或：模板（{n} 序号 {name} 原名 {date} 日期）", type: "text", ph: "{n}-{name}" },
      { k: "ext", label: "扩展名过滤", type: "text", ph: "*.jpg" },
      { k: "recursive", label: "含子目录", type: "checkbox" },
      { k: "dryRun", label: "dry-run 预览（关掉才会真正改名）", type: "checkbox", value: true },
    ] },
  { id: "organize", name: "文件整理", group: "文件", warn: "破坏性工具 · 默认 dry-run 预览",
    fields: [
      { k: "dir", label: "目录", type: "text" },
      { k: "mode", label: "模式", type: "select", options: ["category", "date", "regex"], value: "category" },
      { k: "pattern", label: "regex 捕获组 1 = 子目录（regex 模式用）", type: "text", ph: "^(\\d{4})-" },
      { k: "recursive", label: "含子目录", type: "checkbox" },
      { k: "cleanup", label: "清理整理后空目录", type: "checkbox" },
      { k: "dryRun", label: "dry-run 预览（关掉才会移动文件）", type: "checkbox", value: true },
    ] },
  { id: "zip", name: "压缩 / 解压", group: "文件", hint: "解压前自动预检：zip-slip 路径穿越拒绝、覆盖已有文件拒绝。",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["create", "extract", "list"], value: "create" },
      { k: "output", label: "zip 路径（create = 输出；extract / list = 输入）", type: "text" },
      { k: "sources", label: "源文件或目录（create 用，逗号分隔）", type: "text" },
      { k: "destDir", label: "解压目标目录（extract 用）", type: "text" },
    ] },
  { id: "obfuscate", name: "图片像素混淆", group: "图片", hint: "gilbert / b / c / c2 / pe1 / pe2 六模式；与「番茄图片混淆」生态互通。",
    fields: [
      { k: "input", label: "输入 PNG 路径", type: "text" },
      { k: "mode", label: "模式", type: "select", options: ["gilbert", "b", "c", "c2", "pe1", "pe2"], value: "c" },
      { k: "key", label: "密钥（pe1/pe2 必须是 0~1 小数，如 0.666）", type: "text" },
      { k: "decrypt", label: "还原（decrypt，需与混淆时相同模式与密钥）", type: "checkbox" },
      { k: "output", label: "输出路径（留空自动命名）", type: "text" },
    ] },
  { id: "ocr", name: "OCR 文字识别", group: "图片", hint: "Windows 原生 OCR（需系统语言包）或 tesseract。",
    fields: [
      { k: "imagePath", label: "图片路径", type: "text" },
      { k: "lang", label: "语言", type: "text", value: "zh-Hans" },
      { k: "engine", label: "引擎", type: "select", options: ["auto", "windows", "tesseract"], value: "auto" },
    ] },
  { id: "clip", name: "剪贴板", group: "系统",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["read", "write"], value: "read" },
      { k: "text", label: "写入文本（write 时使用）", type: "textarea" },
    ] },
  { id: "shot", name: "截屏", group: "系统", hint: "系统原生截屏，输出 PNG。",
    fields: [
      { k: "outputPath", label: "输出 PNG 路径（留空自动命名）", type: "text" },
    ] },
  { id: "run", name: "受保护命令执行", group: "系统", warn: "安全默认：白名单必填 · 元字符拦截",
    fields: [
      { k: "command", label: "命令", type: "text", ph: "npm test" },
      { k: "mode", label: "执行方式", type: "select", options: ["whitelist", "shell"], value: "whitelist" },
      { k: "cwd", label: "工作目录（可选）", type: "text" },
      { k: "timeoutMs", label: "超时毫秒（≤ 600000）", type: "text", value: "60000" },
    ] },
  { id: "proc", name: "进程查看 / 结束", group: "系统", warn: "kill 需 PID + 进程名双匹配",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["list", "kill"], value: "list" },
      { k: "query", label: "list：进程名过滤", type: "text" },
      { k: "pid", label: "kill：PID", type: "text" },
      { k: "name", label: "kill：预期进程名（必须与实际匹配）", type: "text" },
    ] },
];

const USEIT_CARDS = [
  { id: "useit_status", name: "Use-It 引擎", group: "系统", hint: "检查 Use-It 本地引擎与 Office / AutoCAD 的连接状态；未启动时给出安装命令。",
    fields: [{ k: "engineUrl", label: "引擎地址（留空 = 127.0.0.1:8324）", type: "text", ph: "http://127.0.0.1:8324" }] },
  { id: "useit_catalog", name: "Use-It 动作清单", group: "系统", hint: "列出引擎当前支持的控制器与动作名，编写 actions 或脚本前先看这里。",
    fields: [{ k: "engineUrl", label: "引擎地址（留空 = 127.0.0.1:8324）", type: "text", ph: "http://127.0.0.1:8324" }] },
  { id: "useit_ppt", name: "PowerPoint 实时操作", group: "办公", hint: "通过 Use-It 引擎用 COM 操作已打开的 PPT：读取结构、执行动作数组或脚本。会实时改动文档。",
    warn: "需要本机引擎与已安装的 PowerPoint；写入前请求批准",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["status", "snapshot", "open", "close", "actions", "code"], value: "snapshot" },
      { k: "filePath", label: "打开文件（action=open）", type: "text", ph: "C:/path/deck.pptx" },
      { k: "readOnly", label: "只读打开", type: "checkbox" },
      { k: "save", label: "关闭时保存", type: "checkbox" },
      { k: "actions", label: "动作数组 JSON（action=actions）", type: "textarea", ph: '[{"action":"add_slide","layout_index":1}]' },
      { k: "code", label: "脚本（action=code）", type: "textarea", ph: "PowerShell 或 Python 脚本" },
      { k: "language", label: "脚本语言", type: "select", options: ["PowerShell", "Python"], value: "PowerShell" },
      { k: "returnScreenshot", label: "返回截图信息", type: "checkbox" },
    ] },
  { id: "useit_word", name: "Word 实时操作", group: "办公", hint: "通过 Use-It 引擎操作已打开的 Word：读取结构或执行脚本（引擎暂不支持结构化动作）。",
    warn: "需要本机引擎与已安装的 Word；写入前请求批准",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["status", "snapshot", "open", "close", "code"], value: "snapshot" },
      { k: "filePath", label: "打开文件（action=open）", type: "text", ph: "C:/path/doc.docx" },
      { k: "readOnly", label: "只读打开", type: "checkbox" },
      { k: "save", label: "关闭时保存", type: "checkbox" },
      { k: "code", label: "脚本（action=code）", type: "textarea", ph: "PowerShell 或 Python 脚本" },
      { k: "language", label: "脚本语言", type: "select", options: ["PowerShell", "Python"], value: "PowerShell" },
    ] },
  { id: "useit_excel", name: "Excel 实时操作", group: "办公", hint: "通过 Use-It 引擎操作已打开的 Excel：读取结构或执行脚本（引擎只接受脚本模式）。",
    warn: "需要本机引擎与已安装的 Excel；写入前请求批准",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["status", "snapshot", "open", "close", "code"], value: "snapshot" },
      { k: "filePath", label: "打开文件（action=open）", type: "text", ph: "C:/path/book.xlsx" },
      { k: "readOnly", label: "只读打开", type: "checkbox" },
      { k: "save", label: "关闭时保存", type: "checkbox" },
      { k: "code", label: "脚本（action=code）", type: "textarea", ph: "PowerShell 或 Python 脚本" },
      { k: "language", label: "脚本语言", type: "select", options: ["PowerShell", "Python"], value: "PowerShell" },
    ] },
  { id: "useit_autocad", name: "AutoCAD 实时操作", group: "系统", hint: "通过 Use-It 引擎连接 AutoCAD：查看状态、打开/激活图纸、读取实体、按 JSON 或 Python 绘图。",
    warn: "需要本机引擎与已安装的 AutoCAD；写入前请求批准",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["status", "snapshot", "launch", "open", "close", "activate", "step"], value: "status" },
      { k: "filePath", label: "图纸路径（open）", type: "text", ph: "C:/path/drawing.dwg" },
      { k: "drawingName", label: "激活图纸名（activate）", type: "text" },
      { k: "index", label: "或：图纸序号（activate）", type: "text", ph: "0" },
      { k: "stepAction", label: "step 方式", type: "select", options: ["draw_from_json", "execute_python_com"], value: "draw_from_json" },
      { k: "data", label: "绘图 JSON（draw_from_json）", type: "textarea", ph: '{"entities":[]}' },
      { k: "code", label: "Python 脚本（execute_python_com）", type: "textarea" },
    ] },
  { id: "useit_computer", name: "桌面 GUI 自动化", group: "系统", hint: "通过 Use-It 引擎截屏，或执行鼠标/键盘动作数组；会影响当前桌面。",
    warn: "操作真实桌面，执行前请求批准",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["screenshot", "actions"], value: "screenshot" },
      { k: "actions", label: "动作数组 JSON（action=actions）", type: "textarea", ph: '[{"type":"click","x":100,"y":200}]' },
      { k: "resize", label: "截图缩放到 1920x1080", type: "checkbox", value: true },
    ] },
];
TOOLS.push(...(window.CupboxComputerTools||[]),...(window.CupboxOfficeLocal?.tools||[]),...USEIT_CARDS);
const GROUP_ORDER = ["办公", "数据", "文件", "图片", "系统"];
const OPTION_LABELS = {sakura:"樱花蓝紫",ink:"墨染青绿",minimal:"极简灰蓝", whitelist:"已批准的项目白名单", shell:"Shell · 每次请求批准", b64e: "Base64 编码", b64d: "Base64 解码", urle: "URL 编码", urlde: "URL 解码", "html-esc": "HTML 转义", "html-unesc": "HTML 还原", json: "JSON 格式化", "json-min": "JSON 压缩", category: "按文件类型", date: "按日期", regex: "按正则规则", create: "创建压缩包", extract: "解压文件", list: "查看列表", read: "读取剪贴板", write: "写入剪贴板", kill: "结束进程", auto: "自动选择", windows: "Windows 原生识别" };
TOOLS.find(t=>t.id==="run").hint="白名单在设置 → 开发与授权 → 项目策略中维护；未授权命令可选择 Shell 逐次请求批准。";
for (const t of TOOLS) {
  if (["organize", "rename"].includes(t.id)) {
    t.warn = "文件变更默认先预览";
    t.fields.find(f => f.k === "dryRun").label = "仅预览变更（关闭后实际执行）";
  }
}
const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const api = window.cupbox || {};
let prefs = { theme: "light", accent: "aurora", mode: "ask", workspace: "", disabledTools: [], dismissedVersion: "", background: "sakura", backgroundVeil: 72, backgroundBlur: 0, backgroundFit: "cover", startupEnabled:true, startupStyle:'orbit', startupDuration:5, startupCaption:'让灵感，轻轻启程。', announcementSeenVersion:"", announcementMuted:false };
const toolDrafts = new Map();
const toolResults = new Map();
let toolRunning = false;
let sessionFilter = "";
let modelReady = false;
let apiFillSequence=0;
let restoreFocus = null;
let current = TOOLS[0];
let toolIndex = 0;
let bootstrapped = false;
let sessionId = null;   // 当前会话（null = 尚未落盘的新会话）
let sending = false;
let drawerOpen = false;
let modalOpen = false;
let updOpen = false;    // 更新公告弹窗
let annOpen = false;    // 开屏公告弹窗
let announcement = null; // 当前展示的公告
let homeDashboardCleanup = null;
let ctxOpen = false;    // 上下文洞察弹窗
let updateInfo = null;  // 最近一次检测结果（UpdateInfo）

const SMOKE = new URLSearchParams(location.search).get("smoke");
const RELEASES_URL = "https://github.com/beizilaoshi/cupbox/releases/latest";
const CHANGELOG_URL = "https://github.com/beizilaoshi/cupbox/blob/main/CHANGELOG.md";

/* ---------------- 外观 / 偏好 ---------------- */

function applyTheme(themePref, accent) {
  const resolved =
    themePref === "system"
      ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : themePref === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePref = themePref;
  if (accent) document.documentElement.dataset.accent = accent;
  document.querySelectorAll("#seg-theme .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === themePref);
  });
  document.querySelectorAll("#swatches .swatch").forEach((b) => {
    b.classList.toggle("active", b.dataset.accent === accent);
    b.setAttribute("aria-pressed", String(b.dataset.accent === accent));
  });
  window.CupboxTheme.apply(prefs);
}

async function savePrefs(patch) {
  const previous=prefs;
  prefs = { ...prefs, ...patch };
  try {
    const r = await api.prefsSet?.(patch);
    if (r && !r.ok) throw new Error(r.error || '请稍后重试');
    return true;
  } catch(e) { const restored={...prefs}; for(const key of Object.keys(patch))if(restored[key]===patch[key])restored[key]=previous[key];prefs=restored;toast('设置保存失败：'+e.message);return false; }
}

window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
  if (prefs.theme === "system") applyTheme("system", prefs.accent);
});

function setMode(mode, persist) {
  if (sending) return;
  if(mode==="agent"&&persist!==false&&window.CupboxHarness){void window.CupboxHarness.selectWork();return;}
  window.CupboxHarness?.setMode?.(mode==="agent"?"native-work":"normal");
  prefs.mode = mode === "agent" ? "agent" : "ask";
  document.querySelectorAll("#mode-toggle .mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === prefs.mode);
  });
  if (persist !== false) void savePrefs({ mode: prefs.mode });
  $("mode-description").textContent = prefs.mode === "agent" ? "AI 自动选择工具 · 重要操作由你批准" : "一起理清思路，找到答案";
}

/* ---------------- 工具抽屉 ---------------- */

function visibleTools() {
  const dis = Array.isArray(prefs.disabledTools) ? prefs.disabledTools : [];
  return TOOLS.filter((t) => !dis.includes(t.id));
}

function renderDrawerTools() {
  const box = $("drawer-tools");
  box.innerHTML = "";
  const query = ($("tool-search")?.value || "").trim().toLowerCase();
  const tools = visibleTools().filter(t => `${t.name} ${t.id} ${t.group}`.toLowerCase().includes(query));
  if (!tools.length) box.innerHTML = '<div class="sess-empty">没有可用的匹配工具。可修改搜索词或在设置中启用工具。</div>';
  let idx = 0;
  for (const g of GROUP_ORDER) {
    const items = tools.filter((t) => t.group === g);
    if (!items.length) continue;
    const title = document.createElement("div");
    title.className = "group-title";
    title.style.gridColumn = "1 / -1";
    title.textContent = g;
    box.appendChild(title);
    for (const t of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tool-item";
      b.dataset.id = t.id;
      b.style.setProperty("--i", String(idx));
      const icon = document.createElement("span");
      icon.className = "t-icon";
      icon.innerHTML = CupboxIcons.html(t.id);
      const name = document.createElement("span");
      name.textContent = t.name;
      b.appendChild(icon);
      b.appendChild(name);
      if (t.warn) {
        const badge = document.createElement("span");
        badge.className = "t-badge";
        badge.textContent = "需留意";
        b.appendChild(badge);
      }
      b.addEventListener("click", () => selectTool(t.id));
      box.appendChild(b);
      idx += 1;
    }
  }
}

function openDrawer() {
  if (drawerOpen) return;
  drawerOpen = true;
  restoreFocus = document.activeElement;
  const scrim = $("drawer-scrim");
  const d = $("drawer");
  scrim.hidden = true;
  d.hidden = false;
  $("stage").hidden=true;
  $("btn-drawer").classList.add('active');
  requestAnimationFrame(() => {
    scrim.classList.add("open");
    d.classList.add("open");
    (d.dataset.view==='library'?$("library-search"):$("tool-search"))?.focus();
  });
}

function closeDrawer() {
  if (!drawerOpen) return;
  drawerOpen = false;
  $("stage").hidden=false;
  $("btn-drawer").classList.remove('active');
  restoreFocus?.focus();
  const scrim = $("drawer-scrim");
  const d = $("drawer");
  scrim.classList.remove("open");
  d.classList.remove("open");
  setTimeout(() => {
    if (!drawerOpen) { scrim.hidden = true; d.hidden = true; }
  }, 320);
}

function selectTool(id, instant) {
  const nextIdx = visibleTools().findIndex((t) => t.id === id);
  if (nextIdx < 0) return;
  const same = bootstrapped && TOOLS[toolIndex]?.id === id && $("tool-form").childElementCount > 0;
  if (same) return;
  if (bootstrapped) toolDrafts.set(current.id, collect());
  const target = TOOLS.findIndex((t) => t.id === id);
  const swap = () => {
    toolIndex = target;
    current = TOOLS[toolIndex];
    applyTool();
  };
  if (!bootstrapped || instant || REDUCED) {
    bootstrapped = true;
    swap();
    return;
  }
  swap();
  bootstrapped = true;
  // 表单区弹性换场（Web Animations，免加 CSS）
  const panel = $("form-panel");
  if (panel && panel.animate) {
    panel.animate(
      [
        { opacity: 0.25, transform: "translateY(7px) scale(0.994)", filter: "blur(6px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" },
      ],
      { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" },
    );
  }
}

function applyTool() {
  CupboxToolWorkspace.editor();
  document.querySelectorAll("#drawer-tools .tool-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === current.id);
  });
  $("tool-title").innerHTML = `${CupboxIcons.html(current.id)} <span>${current.name}</span>`;
  $("btn-run").disabled = toolRunning;
  const warn = $("tool-warn");
  warn.hidden = !current.warn;
  if (current.warn) warn.textContent = current.warn;
  const hint = $("tool-hint");
  hint.hidden = !current.hint;
  if (current.hint) hint.textContent = current.hint;
  renderForm();
  CupboxToolWorkspace.availability(current.id);
  if(toolResults.has(current.id)){const cached=toolResults.get(current.id);renderResult(cached.res,cached.ms);return;}
  const status = $("result-status");
  status.textContent = "待运行";
  status.className = "chip";
  status.style.color = "";
  const body = $("result-body");
  body.innerHTML = '<div class="placeholder">填参数 → 运行。<br />结果与安全提示都会显示在这里；破坏性工具默认 dry-run 预览。</div>';
}

/* ---------------- 表单 ---------------- */

function renderForm() {
  const form = $("tool-form");
  form.innerHTML = "";
  current.fields.forEach((f, i) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.setProperty("--i", String(i));

    if (f.type === "checkbox") {
      const sw = document.createElement("label");
      sw.className = "switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.key = f.k;
      if (f.value) input.checked = true;
      const saved = toolDrafts.get(current.id);
      if (saved && f.k in saved) input.checked = saved[f.k];
      const track = document.createElement("span");
      track.className = "track";
      const thumb = document.createElement("span");
      thumb.className = "thumb";
      track.appendChild(thumb);
      const lab = document.createElement("span");
      lab.className = "switch-label";
      lab.textContent = f.label;
      sw.appendChild(input);
      sw.appendChild(track);
      sw.appendChild(lab);
      wrap.appendChild(sw);
      form.appendChild(wrap);
      return;
    }

    const label = document.createElement("label");
    label.className = "f-label";
    label.htmlFor = `tool-field-${f.k}`;
    label.textContent = f.label;
    wrap.appendChild(label);

    let input;
    if (f.type === "textarea") {
      input = document.createElement("textarea");
      if (f.ph) input.placeholder = f.ph;
      if (f.value) input.value = f.value;
    } else if (f.type === "select") {
      input = document.createElement("select");
      for (const o of f.options) {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = (current.id === "proc" && o === "list") ? "查看进程" : (current.id === "csv" ? o.toUpperCase() : OPTION_LABELS[o] || o);
        input.appendChild(opt);
      }
      if (f.value) input.value = f.value;
    } else {
      input = document.createElement("input");
      input.type = f.type === "password" ? "password" : "text";
      if (f.ph) input.placeholder = f.ph;
      if (f.value) input.value = f.value;
    }
    input.dataset.key = f.k;
    input.id = `tool-field-${f.k}`;
    const saved = toolDrafts.get(current.id);
    if (saved && f.k in saved) input.value = saved[f.k];
    else if (["dir", "root", "cwd"].includes(f.k)) input.value = prefs.executionEnvironment==='native'?(prefs.workspace||''):(CupboxExecution.context().sandbox||'');
    wrap.appendChild(input);
    form.appendChild(wrap);
  });
  const updateFields = () => {
    const args = collect();
    const rules = current.id === "zip" ? { sources: args.action === "create", destDir: args.action === "extract" }
      : current.id === "proc" ? { query: args.action === "list", pid: args.action === "kill", name: args.action === "kill" }
      : current.id === "clip" ? { text: args.action === "write" }
      : current.id === "organize" ? { pattern: args.mode === "regex" }
      : current.id === "obfuscate" ? { key: ["pe1", "pe2"].includes(args.mode) } : {};
    Object.entries(rules).forEach(([key, show]) => { form.querySelector(`[data-key="${key}"]`).closest(".field").hidden = !show; });
  };
  form.querySelectorAll("select").forEach(el => el.addEventListener("change", updateFields));
  updateFields();
  CupboxToolWorkspace.form();
}

function collect() {
  const args = {};
  for (const el of $("tool-form").querySelectorAll("[data-key]")) {
    const k = el.dataset.key;
    if (el.type === "checkbox") args[k] = el.checked;
    else args[k] = current.id.startsWith('desktop_')&&['x','y','steps'].includes(k)?Number(el.value):el.value;
  }
  return args;
}

/* ---------------- 结果渲染 ---------------- */

function highlightJSON(obj) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const json = esc(JSON.stringify(obj, null, 2));
  return json
    .replace(/"([^"\n]+)"(\s*:)/g, '<span class="jk">"$1"</span>$2')
    .replace(/: "([^"\n]*)"/g, ': <span class="js">"$1"</span>')
    .replace(/: (-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi, ': <span class="jn">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="jb">$1</span>');
}

function setStatus(text, cls) {
  const status = $("result-status");
  status.textContent = text;
  status.className = "chip";
  void status.offsetWidth;
  if (cls) status.classList.add(cls);
  status.classList.add("pop");
}

function renderResult(res, ms) {
  const body = $("result-body");
  body.innerHTML = "";
  const meta = document.createElement("div");
  meta.className = "result-meta";
  meta.textContent = `耗时 ${ms} ms`;
  body.appendChild(meta);

  if (!res.ok) {
    setStatus("失败", "chip-red");
    const div = document.createElement("div");
    div.className = "err-block";
    div.textContent = res.error;
    body.appendChild(div);
    return;
  }
  setStatus("完成", "chip-green");

  const r = res.result;
  const copy = document.createElement("button");
  copy.className = "ghost-btn copy-result";
  copy.textContent = "复制结果";
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(typeof r === "string" ? r : JSON.stringify(r, null, 2)); toast("结果已复制"); }
    catch { toast("无法复制，可选中结果后按 Ctrl+C"); }
  });
  meta.appendChild(copy);
  const pre = document.createElement("div");
  pre.className = "ok-block";
  if (window.CupboxOfficeLocal?.result(r,body)||CupboxToolWorkspace.result(r,body)) {
    // Tables and file lists include an expandable raw JSON view.
  } else if (typeof r === "string") {
    pre.textContent = r;
    body.appendChild(pre);
  } else if (r && typeof r === "object" && typeof r.text === "string") {
    pre.textContent = r.text;
    body.appendChild(pre);
  } else {
    pre.innerHTML = highlightJSON(r);
    body.appendChild(pre);
  }

  const imgPath = r && typeof r === "object" ? (r.output || r.path || "") : "";
  if (typeof imgPath === "string" && /\.png$/i.test(imgPath)) {
    const img = document.createElement("img");
    img.className = "result-img";
    const clean=imgPath.replace(/\\/g,'/');
    img.src='file://'+(clean.startsWith('/')?'':'/')+clean.split('/').map((part,i)=>i===0&&/^[a-z]:$/i.test(part)?part:encodeURIComponent(part)).join('/');
    body.appendChild(img);
  }
}

/* ---------------- 工具运行 ---------------- */

async function run(options={}) {
  if (toolRunning || !visibleTools().some(t => t.id === current.id)) return;
  toolRunning = true;
  const btn = $("btn-run");
  const label = btn.querySelector(".btn-label");
  btn.disabled = true;
  btn.classList.add("loading");
  if (label) label.textContent = "运行中";
  setStatus("运行中…", "chip-amber");
  const t0 = performance.now();
  const runningId=current.id;
  try {
    const raw=collect(),office=window.CupboxOfficeLocal?.handles(runningId);const args=office?CupboxOfficeLocal.request(runningId,raw,options.officeCommit===true):raw;
    const res = await api.run(runningId,args);if(office)CupboxOfficeLocal.remember(runningId,raw,res.ok?res.result:null);
    const ms=Math.round(performance.now()-t0);toolResults.set(runningId,{res,ms});
    if(current.id===runningId)renderResult(res,ms);
    toast(res.ok?(res.result?.dryRun?"预览已准备好，文件尚未写入":"工具处理完成，可在结果区查看"):"工具执行失败："+(res.error||"请检查参数"));
  } catch (e) {
    const res={ ok: false, error: String((e && e.message) || e) };const ms=Math.round(performance.now()-t0);toolResults.set(runningId,{res,ms});if(current.id===runningId)renderResult(res,ms);toast("工具执行失败："+res.error);
  } finally {
    toolRunning = false;
    btn.disabled = false;
    btn.classList.remove("loading");
    if (label) label.textContent = "运行";
    CupboxToolWorkspace.availability(current.id);
  }
}

/* ---------------- 对话 ---------------- */

function chatTime() {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

/* 只有用户本来就在底部时才跟随输出；一旦上翻阅读，流式内容不再把视角拽回去。
   .chat-scroll 带 scroll-behavior:smooth，每帧赋 scrollTop 会被平滑动画拖成“追着跑”，
   所以程序化跟随用 instant 直接落底。 */
let followChat = true;
const CHAT_FOLLOW_SLACK = 48;
function chatNearBottom(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < CHAT_FOLLOW_SLACK;
}
function scrollChat(force = false) {
  const el = $("chat-scroll");
  if (!el || (!force && !followChat)) return;
  try { el.scrollTo({ top: el.scrollHeight, behavior: "instant" }); }
  catch { el.scrollTop = el.scrollHeight; }
}
$("chat-scroll")?.addEventListener("scroll", () => {
  const el = $("chat-scroll");
  if (el) followChat = chatNearBottom(el);
  syncChatRail();
}, { passive: true });

/* ---- 右侧消息定位条 + 历史折叠：长对话只渲染最近一部分，其余按需展开 ---- */
const CHAT_FOLD_KEEP = 40;
const CHAT_FOLD_CHUNK = 30;
const CHAT_LIVE_FOLD_AT = 80;
const CHAT_LIVE_FOLD_COUNT = 20;
let chatFold = { messages: [], nodes: [] };
let chatBatch = false;
let chatRailFrame = 0;

function chatFoldCount() {
  return chatFold.messages.length + chatFold.nodes.length;
}

function ensureChatFoldBar() {
  let bar = $("chat-fold");
  if (bar) return bar;
  bar = document.createElement("div");
  bar.id = "chat-fold";
  bar.className = "chat-fold";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chat-fold-btn";
  button.innerHTML = `<span class="chat-fold-count"></span><small>展开</small>`;
  button.addEventListener("click", expandChatFold);
  bar.append(button);
  return bar;
}

function updateChatFold() {
  const scroll = $("chat-scroll");
  if (!scroll) return;
  const total = chatFoldCount();
  if (!total) { $("chat-fold")?.remove(); return; }
  const bar = ensureChatFoldBar();
  bar.querySelector(".chat-fold-count").textContent = `更早的 ${total} 条消息`;
  const anchor = [...scroll.children].find((el) => el.classList.contains("msg") && !el.classList.contains("streaming-response"));
  scroll.insertBefore(bar, anchor || null);
}

function expandChatFold() {
  const scroll = $("chat-scroll");
  if (!scroll) return;
  const before = scroll.scrollHeight;
  const anchor = [...scroll.children].find((el) => el.classList.contains("msg") && !el.classList.contains("streaming-response")) || null;
  let made = 0;
  if (chatFold.messages.length) {
    const take = chatFold.messages.splice(-CHAT_FOLD_CHUNK);
    const fragment = document.createDocumentFragment();
    chatBatch = true;
    for (const m of take) {
      const kind = m.role === "user" ? "user" : "assistant";
      fragment.append(buildMessage(kind, { text: m.text, trace: m.trace, tasks: m.tasks, media: m.media, messageId: m.id, feedback: m.feedback, memoryId: m.memoryId, memoryText: m.memoryText, time: "" }));
    }
    chatBatch = false;
    scroll.insertBefore(fragment, anchor);
    made = take.length;
  } else if (chatFold.nodes.length) {
    const take = chatFold.nodes.splice(-CHAT_FOLD_CHUNK);
    for (const entry of take) { scroll.insertBefore(entry.node, anchor); made += 1; }
  }
  if (made) scroll.scrollTo({ top: scroll.scrollTop + (scroll.scrollHeight - before), behavior: "instant" });
  updateChatFold();
  renderChatRail();
}

function flashChatFold() {
  updateChatFold();
  const bar = $("chat-fold");
  if (!bar) return;
  bar.classList.remove("flash");
  void bar.offsetWidth;
  bar.classList.add("flash");
  bar.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(() => bar.classList.remove("flash"), 1600);
}

function autoFoldChat() {
  if (chatBatch || !followChat) return;
  const scroll = $("chat-scroll");
  if (!scroll) return;
  const messages = [...scroll.querySelectorAll(".msg:not(.streaming-response)")];
  if (messages.length <= CHAT_LIVE_FOLD_AT) return;
  for (const node of messages.slice(0, CHAT_LIVE_FOLD_COUNT)) {
    chatFold.nodes.push({
      kind: node.classList.contains("user") ? "user" : "assistant",
      text: node.dataset.preview || "",
      node,
    });
    node.remove();
  }
}

function chatRailTurns() {
  const turns = [];
  const clean = (text, max) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
  const messages = chatFold.messages;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i].role !== "user") continue;
    let response = "";
    for (let j = i + 1; j < messages.length && messages[j].role !== "user"; j += 1) {
      if (messages[j].role === "assistant") response = messages[j].text || "";
    }
    turns.push({ prompt: clean(messages[i].text, 60), response: clean(response, 120), node: null });
  }
  const nodes = chatFold.nodes;
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i].kind !== "user") continue;
    let response = "";
    for (let j = i + 1; j < nodes.length && nodes[j].kind !== "user"; j += 1) {
      if (nodes[j].kind === "assistant") response = nodes[j].node?.textContent || "";
    }
    turns.push({ prompt: clean(nodes[i].text, 60), response: clean(response, 120), node: nodes[i].node });
  }
  const scroll = $("chat-scroll");
  for (const el of scroll?.querySelectorAll(":scope > .msg.user") || []) {
    let response = "";
    let next = el.nextElementSibling;
    while (next) {
      if (next.classList.contains("msg.user")) break;
      if (next.classList.contains("msg.assistant")) { response = next.textContent || ""; break; }
      next = next.nextElementSibling;
    }
    turns.push({ prompt: clean(el.dataset.preview || "", 60), response: clean(response, 120), node: el });
  }
  return turns;
}

function positionChatRail() {
  const rail = $("chat-rail"), scroll = $("chat-scroll"), stage = $("stage");
  if (!rail || rail.hidden || !scroll || !stage) return;
  const chat = scroll.getBoundingClientRect(), host = stage.getBoundingClientRect();
  rail.style.top = `${chat.top - host.top + chat.height / 2}px`;
  rail.style.maxHeight = `${Math.max(80, Math.min(420, chat.height - 80))}px`;
}

function showRailPreview(tick, turn) {
  const rail = $("chat-rail");
  const preview = rail?.querySelector(".chat-rail-preview");
  const scroller = rail?.querySelector(".chat-rail-scroller");
  if (!preview || !scroller || !turn) return;
  preview.replaceChildren();
  const head = document.createElement("div");
  head.className = "chat-rail-preview-prompt";
  head.textContent = turn.prompt || "消息";
  preview.append(head);
  if (turn.response) {
    const body = document.createElement("div");
    body.className = "chat-rail-preview-response";
    body.textContent = turn.response;
    preview.append(body);
  }
  const height = scroller.clientHeight || 1;
  const center = tick.offsetTop + tick.offsetHeight / 2 - scroller.scrollTop;
  const top = Math.max(6, Math.min(height - 108, center - 50));
  preview.style.top = `${top}px`;
  preview.hidden = false;
}

function hideRailPreview() {
  const preview = $("chat-rail")?.querySelector(".chat-rail-preview");
  if (preview) preview.hidden = true;
}

function centerChatRail(behavior = "smooth") {
  const rail = $("chat-rail");
  const scroller = rail?.querySelector(".chat-rail-scroller");
  const active = scroller?.querySelector(".chat-rail-mark.active");
  if (!scroller || !active) return;
  const height = scroller.clientHeight || 1;
  const center = active.offsetTop + active.offsetHeight / 2 - scroller.scrollTop;
  if (center >= 28 && center <= height - 28) return;
  scroller.scrollTo({ top: Math.max(0, active.offsetTop + active.offsetHeight / 2 - height / 2), behavior });
}

function renderChatRail() {
  const rail = $("chat-rail"), scroll = $("chat-scroll");
  if (!rail || !scroll) return;
  if (window.CupboxHarness?.mode?.() === "harness") { rail.hidden = true; rail.replaceChildren(); return; }
  const turns = chatRailTurns();
  if (turns.length < 2) { rail.hidden = true; rail.replaceChildren(); return; }
  const previous = rail.querySelector(".chat-rail-mark.active")?.dataset.index;
  rail.hidden = false;
  rail.replaceChildren();
  rail._turns = turns;

  const preview = document.createElement("div");
  preview.className = "chat-rail-preview";
  preview.hidden = true;
  preview.setAttribute("role", "tooltip");

  const scroller = document.createElement("div");
  scroller.className = "chat-rail-scroller";
  const marks = document.createElement("div");
  marks.className = "chat-rail-marks";
  const pitch = 10;
  marks.style.height = `${turns.length * pitch + 12}px`;
  turns.forEach((turn, index) => {
    const tick = document.createElement("button");
    tick.type = "button";
    tick.className = "chat-rail-mark";
    tick.dataset.index = String(index);
    tick.style.top = `${6 + index * pitch}px`;
    tick.setAttribute("aria-label", `${turn.node ? "跳到" : "展开并跳到"}第 ${index + 1} 轮：${turn.prompt || "消息"}`);
    if (!turn.node) tick.classList.add("folded");
    tick._turn = turn;
    tick.addEventListener("pointerenter", () => showRailPreview(tick, turn));
    tick.addEventListener("pointermove", () => showRailPreview(tick, turn));
    tick.addEventListener("focus", () => showRailPreview(tick, turn));
    tick.addEventListener("blur", hideRailPreview);
    tick.addEventListener("click", () => {
      if (turn.node) { jumpToMessage(turn.node); return; }
      revealRailTurn(index);
    });
    marks.append(tick);
  });
  scroller.append(marks);
  scroller.addEventListener("scroll", () => {
    scroller.classList.toggle("fade-top", scroller.scrollTop > 1);
    scroller.classList.toggle("fade-bottom", scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 1);
    hideRailPreview();
  }, { passive: true });
  rail.onpointerleave = hideRailPreview;
  rail.append(scroller, preview);
  if (previous !== undefined) {
    const tick = marks.querySelector(`.chat-rail-mark[data-index="${previous}"]`);
    if (tick) tick.classList.add("active");
  }
  positionChatRail();
  scroller.classList.toggle("fade-bottom", scroller.scrollHeight > scroller.clientHeight + 1);
  syncChatRail();
}

function revealRailTurn(index) {
  let turns = chatRailTurns();
  while (index < turns.length && !turns[index]?.node && chatFoldCount()) {
    expandChatFold();
    turns = chatRailTurns();
  }
  const node = turns[index]?.node;
  if (node) jumpToMessage(node);
  else flashChatFold();
}

function syncChatRail() {
  if (chatRailFrame) return;
  chatRailFrame = requestAnimationFrame(() => {
    chatRailFrame = 0;
    const rail = $("chat-rail"), scroll = $("chat-scroll");
    if (!rail || rail.hidden || !scroll) return;
    const threshold = scroll.getBoundingClientRect().top + 84;
    let active = null;
    rail.querySelectorAll(".chat-rail-mark").forEach((tick) => {
      const node = tick._turn?.node;
      if (!node || !node.isConnected) return;
      if (node.getBoundingClientRect().top <= threshold) active = tick;
    });
    rail.querySelectorAll(".chat-rail-mark.active").forEach((tick) => tick.classList.remove("active"));
    if (active) {
      active.classList.add("active");
      const changed = rail._activeIndex !== active.dataset.index;
      rail._activeIndex = active.dataset.index;
      if (changed) centerChatRail();
    }
  });
}

function jumpToMessage(node) {
  const scroll = $("chat-scroll");
  if (!scroll || !node) return;
  const top = scroll.scrollTop + node.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 12;
  scroll.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  node.classList.remove("msg-jump");
  void node.offsetWidth;
  node.classList.add("msg-jump");
  setTimeout(() => node.classList.remove("msg-jump"), 1600);
}

window.addEventListener("resize", () => { positionChatRail(); });

function buildMessage(kind, payload) {
  const div = payload.flow?.el || document.createElement("div");
  div.className = `msg ${kind}${payload.err ? " err" : ""}`;
  if (payload.messageId) div.dataset.messageId = payload.messageId;
  if (kind === "user") div.dataset.preview = String(payload.text || "").replace(/\s+/g, " ").slice(0, 90);

  if (payload.err) {
    div.textContent = payload.text;
    return div;
  }

  if (payload.flow) payload.flow.finish(payload.text);
  else if (payload.text) {
    if (kind === "assistant") div.append(CupboxResponse.render(payload.text));
    else div.textContent = payload.text;
  }

  if (payload.compaction && payload.compaction.turns > 0) {
    const c = document.createElement("div");
    c.className = "msg-compaction";
    c.textContent = `已压缩 ${payload.compaction.turns} 条早前消息为摘要（${payload.compaction.charsBefore} → ${payload.compaction.charsAfter} 字符）`;
    div.appendChild(c);
  }

  if (Array.isArray(payload.trace) && payload.trace.length) {
    div.append(CupboxTranscript.history(payload.trace));
  }

  if (kind === "assistant") CupboxResponse.attach(div, payload);
  CupboxModels.drawMedia(div, payload.media);
  CupboxModels.renderTasks(div, payload.tasks);
  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.textContent = payload.time || chatTime();
  div.appendChild(meta);
  return div;
}

function pushMsg(kind, payload) {
  const scroll = $("chat-scroll");
  if (!scroll) return null;
  $("chat-empty")?.remove();
  const div = buildMessage(kind, payload);
  scroll.appendChild(div);
  if (!chatBatch) {
    // 自己发出去的消息一定落到视野内；助手回复则只在用户停在底部时跟随
    scrollChat(kind === "user");
    autoFoldChat();
    updateChatFold();
    renderChatRail();
  }
  return div;
}

function showTyping() {
  const t = document.createElement("div");
  t.className = "typing";
  t.id = "typing";
  t.innerHTML = "<i></i><i></i><i></i>";
  $("chat-scroll").appendChild(t);
  scrollChat();
  return t;
}

/* ---- 工具调用实时可视化（agent 执行时逐条展示，像执行任务的现场直播） ---- */
let liveTrace = null;      // { el, runId, pending: Map<toolName, HTMLElement[]> }
function startLiveTrace(runId) {
  stopLiveTrace();
  $("chat-empty")?.remove();
  const el = document.createElement("div");
  el.className = "msg live-trace";
  el.innerHTML = `<div class="lt-head"><span class="lt-pulse"></span><b>正在执行任务</b><span class="lt-sub">工具调用实时过程</span></div><div class="lt-rows"></div>`;
  $("chat-scroll").appendChild(el);
  liveTrace = { el, runId, pending: new Map() };
  scrollChat();
  return el;
}
function liveToolEvent(ev) {
  if (!liveTrace || !ev || ev.runId !== liveTrace.runId) return;
  const rows = liveTrace.el.querySelector(".lt-rows");
  if (!rows) return;
  if (ev.phase === "start" && ev.call) {
    const item=CupboxTranscript.row(ev.call);rows.append(item.el);
    const key=ev.call.id||ev.call.name,list=liveTrace.pending.get(key)||[];list.push(item);liveTrace.pending.set(key,list);
    scrollChat();
  } else if(ev.phase==='done'&&ev.item){
    const list=liveTrace.pending.get(ev.item.id||ev.item.name),row=list?.shift();
    if(row)row.finish(ev.item);scrollChat();
  }
}
function stopLiveTrace(finalized) {
  if (!liveTrace) return;
  const el = liveTrace.el;
  liveTrace = null;
  if (finalized) el.remove(); // 最终消息自带完整工具轨迹，直播卡片退役
  else el.remove();
}

async function sendChat(options = {}) {

  if (sending) return;
  const ta = $("chat-text");
  const text = options.retry?.prompt || ta.value.trim();
  if (!text) return;
  if (!modelReady) { toast("先配置一个 AI 模型，就可以开始对话了"); openModal("api"); return; }

  let selection;
  try { selection=CupboxModels.payload(options.retry); } catch(e) { toast(e.message); return; }
  CupboxModels.setBusy(true);
  sending = true;
  const btn = $("btn-send");
  btn.disabled = true;
  btn.classList.add("loading");
  ta.value = "";
  ta.style.height = "auto";
  ta.disabled = true;
  $("btn-new-chat").disabled = true;
  $("btn-clear").disabled = true;

  const userMessage = pushMsg("user", { text });
  const typing = showTyping();
  const t0 = performance.now();
  // agent 模式：开一条工具调用直播轨道（chat:tool 事件实时逐条渲染）
  const flow=new CupboxTranscript.TextFlow({parent:$("chat-scroll"),onPaint:()=>scrollChat()});
  const offText=api.onChatText?.(ev=>{if(ev?.runId!==selection.runId)return;typing.remove();flow.append(ev.delta);});
  let offTool = null;
  if (prefs.mode === "agent" && selection.runId && api.onChatTool) {
    startLiveTrace(selection.runId);
    offTool = api.onChatTool(liveToolEvent);
  }

  try {
    const r = await api.chatSend({
      text,
      sessionId,
      mode: prefs.mode,
      ...selection,...CupboxChatPicker.payload(),
    });
    typing.remove();
    stopLiveTrace(true);
    if (r && r.ok) {
      sessionId = r.sessionId;
      pushMsg("assistant", {
        text: r.result && typeof r.result.text === "string" ? r.result.text : "（空回复）",flow,
        trace: r.result ? r.result.trace : null,
        tasks:r.result?.tasks,media:r.result?.media,
        messageId:r.result?.messageId,sessionId,
        compaction: r.result?.compaction,
        time: `${chatTime()} · ${Math.round(performance.now() - t0)} ms`,
      });
      $("chat-title").textContent = r.title || "会话";
      CupboxModels.finished(true);
      await refreshSessions(sessionId);
    } else {
      flow.cancel();CupboxModels.failed(r?.error||"请求失败");
      userMessage.remove();
      ta.value = text;
      pushMsg("assistant", { text: (r && r.error) || "请求失败", err: true });
    }
  } catch (e) {
    flow.cancel();CupboxModels.failed(e.message||String(e));
    userMessage.remove();
    ta.value = text;
    typing.remove();
    pushMsg("assistant", { text: String((e && e.message) || e), err: true });
  } finally {
    sending = false;
    offTool?.();offText?.();
    stopLiveTrace();
    CupboxModels.finished(false);
    ta.disabled = false;
    $("btn-new-chat").disabled = false;
    $("btn-clear").disabled = false;
    btn.disabled = !ta.value.trim();
    btn.classList.remove("loading");
    ta.focus();
  }
}

/* ---------------- 会话列表 ---------------- */

function relTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function refreshSessions(activeId) {
  let list = [], harness = [];
  try { list = (await api.sessionsList?.()) || []; } catch { list = []; }
  try { harness = (await api.harnessSessions?.()) || []; } catch { harness = []; }
  const box = $("sess-list");
  box.innerHTML = "";
  const query = sessionFilter.toLowerCase();
  list = list.filter(s => String(s.title || '').toLowerCase().includes(query));
  const linked=new Set(list.map(s=>s.harnessSessionId).filter(Boolean));
  harness = harness.filter(s => !linked.has(s.id)&&String(s.title || '').toLowerCase().includes(query));
  const merged = [...list.map(s => ({ ...s, engine: 'normal' })), ...harness];
  merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (!merged.length) {
    const div = document.createElement("div");
    div.className = "sess-empty";
    div.textContent = query ? "没有找到匹配的任务" : "从一个小任务开始。\n你的对话会自动出现在这里。";
    div.style.whiteSpace = "pre-line";
    box.appendChild(div);
    return;
  }
  merged.forEach((s, i) => {
    const advanced = s.engine === 'harness';
    const item = document.createElement("div");
    item.className = "sess-item" + (s.id === activeId ? " active" : "") + (advanced ? " harness-task" : "");
    item.style.setProperty("--i", String(i));
    item.title = advanced ? s.title : s.title;

    const title = document.createElement("div");
    title.className = "s-title";
    title.textContent = s.title;

    const meta = document.createElement("div");
    meta.className = "s-meta";
    const mode = document.createElement("span");
    mode.className = "s-mode" + (advanced ? " harness" : "");
    mode.textContent = advanced ? "任务" : "历史";
    const when = document.createElement("span");
    const rounds = advanced ? (s.turns || 0) : Math.max(0, Math.round((s.count || 0) / 2));
    when.textContent = `${relTime(s.updatedAt)} · ${rounds} 轮`;
    meta.appendChild(mode);
    meta.appendChild(when);

    const open = () => {
      if (!advanced) { void openSession(s.id); return; }
      void window.CupboxHarness?.resume?.(s.id);
    };

    if (!advanced) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "s-del";
      del.title = "删除会话";
      del.setAttribute("aria-label", `删除任务：${s.title}`);
      del.textContent = "✕";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (sending) { toast("任务进行中，请完成后再删除"); return; }
        const confirmed = await confirmAction(`删除「${s.title}」？此操作无法撤销。`);
        if (!confirmed || sending) return;
        try {
          await api.sessionsDelete?.(s.id);
          if (s.id === sessionId) newChat();
          await refreshSessions(sessionId);
          toast("任务记录已删除");
        } catch (e) { toast("删除失败：" + e.message); }
      });
      item.appendChild(del);
    }

    item.appendChild(title);
    item.appendChild(meta);
    item.addEventListener("click", open);
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.addEventListener("keydown", e => { if (e.target === item && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(); } });
    box.appendChild(item);
  });
}

function mountHomeSnake(root) {
  const canvas=root.querySelector(".snake-board"),ctx=canvas.getContext("2d"),scoreNode=root.querySelector("[data-snake-score]"),statusNode=root.querySelector("[data-snake-status]"),toggle=root.querySelector("[data-snake-toggle]"),overlay=root.querySelector("[data-snake-overlay]"),overlayTitle=root.querySelector("[data-snake-overlay-title]"),overlayCopy=root.querySelector("[data-snake-overlay-copy]");
  const size=18,step=18,dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}},opposite={up:"down",down:"up",left:"right",right:"left"};
  let snake,dir,nextDir,food,score,playing=true,over=false,timer,disposed=false,autoPilot=true;
  const pickFood=()=>{const free=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!snake.some(p=>p.x===x&&p.y===y))free.push({x,y});return free.length?free[Math.floor(Math.random()*free.length)]:null;};
  function draw(){const ratio=window.devicePixelRatio||1,w=canvas.clientWidth||324,h=canvas.clientHeight||324;if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}ctx.setTransform(canvas.width/324,0,0,canvas.height/324,0,0);ctx.clearRect(0,0,324,324);ctx.fillStyle="#10182a";ctx.fillRect(0,0,324,324);ctx.strokeStyle="rgba(169,194,255,.055)";ctx.lineWidth=1;for(let i=0;i<=size;i++){ctx.beginPath();ctx.moveTo(i*step+.5,0);ctx.lineTo(i*step+.5,324);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*step+.5);ctx.lineTo(324,i*step+.5);ctx.stroke();}if(food){ctx.shadowColor="#ffd68a";ctx.shadowBlur=18;ctx.fillStyle="#ffd68a";ctx.beginPath();ctx.arc(food.x*step+9,food.y*step+9,5.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}snake.forEach((p,i)=>{const inset=i?2.2:1.3;ctx.fillStyle=i?`rgba(124,185,255,${Math.max(.42,1-i/snake.length*.55)})`:"#a6d4ff";ctx.shadowColor=i?"transparent":"#74bfff";ctx.shadowBlur=i?0:13;ctx.beginPath();ctx.roundRect(p.x*step+inset,p.y*step+inset,step-inset*2,step-inset*2,i?5:6);ctx.fill();});ctx.shadowBlur=0;const head=snake[0];if(head){const d=dirs[dir],cx=head.x*step+9,cy=head.y*step+9,px=-d.y,py=d.x;ctx.fillStyle="#16294a";for(const side of [-1,1]){ctx.beginPath();ctx.arc(cx+d.x*3+px*side*3,cy+d.y*3+py*side*3,1.5,0,Math.PI*2);ctx.fill();}}}
  function updateStatus(){statusNode.innerHTML=`<i></i> ${over?"本局结束":playing?"正在玩":"已暂停"}`;statusNode.classList.toggle("paused",!playing&&!over);statusNode.classList.toggle("ended",over);toggle.textContent=playing?"暂停":over?"再来一局":"继续";overlay.hidden=playing;overlayTitle.textContent=over?"再试一次？":"暂停中";overlayCopy.textContent=over?`本局得分 ${String(score).padStart(2,"0")}`:"准备好后继续";}
  function reset(){snake=[{x:6,y:9},{x:5,y:9},{x:4,y:9},{x:3,y:9}];dir="right";nextDir="right";score=0;over=false;playing=true;autoPilot=true;food=pickFood();scoreNode.textContent="00";updateStatus();draw();}
  function autoDirection(){const choices=Object.keys(dirs).filter(name=>name!==opposite[dir]).map(name=>{const d=dirs[name],x=snake[0].x+d.x,y=snake[0].y+d.y,blocked=x<0||x>=size||y<0||y>=size||snake.slice(0,-1).some(p=>p.x===x&&p.y===y);return{name,distance:food?Math.abs(food.x-x)+Math.abs(food.y-y):0,blocked};}).filter(item=>!item.blocked);choices.sort((a,b)=>a.distance-b.distance||(a.name===dir?-1:b.name===dir?1:0));return choices[0]?.name||dir;}
  function tick(){if(!playing||disposed)return;if(autoPilot)nextDir=autoDirection();dir=nextDir;const d=dirs[dir],head={x:snake[0].x+d.x,y:snake[0].y+d.y},eats=food&&head.x===food.x&&head.y===food.y,body=eats?snake:snake.slice(0,-1);if(head.x<0||head.x>=size||head.y<0||head.y>=size||body.some(p=>p.x===head.x&&p.y===head.y)){playing=false;over=true;updateStatus();draw();return;}snake.unshift(head);if(eats){score+=10;scoreNode.textContent=String(score).padStart(2,"0");food=pickFood();if(!food){playing=false;over=true;overlayTitle.textContent="满分通关！";}}else snake.pop();updateStatus();draw();}
  function setDir(name){if(!dirs[name]||name===opposite[dir]||name===opposite[nextDir])return;autoPilot=false;nextDir=name;canvas.focus({preventScroll:true});}
  function onKey(e){const keys={ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"},value=keys[e.key];if(!value)return;e.preventDefault();if(!playing){if(over)reset();else{playing=true;updateStatus();}}setDir(value);}
  canvas.addEventListener("keydown",onKey);root.querySelectorAll("[data-snake-dir]").forEach(button=>button.addEventListener("click",()=>{if(!playing){if(over)reset();else{playing=true;updateStatus();}}setDir(button.dataset.snakeDir);}));root.querySelector("[data-snake-reset]").addEventListener("click",reset);toggle.addEventListener("click",()=>{if(over)reset();else{playing=!playing;updateStatus();canvas.focus({preventScroll:true});}});const onVisibility=()=>{if(document.hidden&&playing){playing=false;updateStatus();}};document.addEventListener("visibilitychange",onVisibility);const resize=()=>draw();window.addEventListener("resize",resize);let observer;const cleanup=()=>{disposed=true;clearInterval(timer);canvas.removeEventListener("keydown",onKey);document.removeEventListener("visibilitychange",onVisibility);window.removeEventListener("resize",resize);observer?.disconnect();};observer=new MutationObserver(()=>{if(!root.isConnected)cleanup();});observer.observe(document.body,{childList:true,subtree:true});reset();timer=window.setInterval(tick,145);return cleanup;
}

function clearChatDom() {
  homeDashboardCleanup?.();
  homeDashboardCleanup = null;
  const scroll = $("chat-scroll");
  chatFold = { messages: [], nodes: [] };
  chatBatch = false;
  followChat = true;
  $("chat-fold")?.remove();
  const rail = $("chat-rail");
  if (rail) { rail.hidden = true; rail.replaceChildren(); }
  scroll.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "chat-empty";
  empty.id = "chat-empty";
  empty.innerHTML = `<div class="welcome-kicker"><span class="live-dot"></span> CUPBOX WORKSPACE · READY FOR YOUR NEXT IDEA</div>
    <section class="home-hero"><img src="assets/sakura-companion.png" alt="筑梦喵与白猫在樱花晴空下陪伴你" /><div class="home-hero-shade"></div><div class="home-hero-copy"><span class="hero-eyebrow">CUPBOX · 樱晴工作台</span><h1>灵感尽管来，<br>琐事交给我。</h1><p>AI 对话、文件处理和本地工具，都在这里开始。</p><button type="button" class="mascot-pill" data-open-pet><span class="mascot-spark">✦</span><span><b>筑梦喵</b><small>你的桌面小搭子</small></span><i aria-hidden="true">↗</i></button></div><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div></section>
    <div class="home-dashboard"><section class="home-main-column"><div class="home-section-heading"><div><span class="section-eyebrow">QUICK START</span><h2>今天，想一起完成什么？</h2><p>从一个小任务开始，剩下的交给 Cupbox。</p></div><button class="tool-link" data-open-tools>全部工具 <span>↗</span></button></div>
    <div class="quick-grid"><button class="quick-card" data-quick="organize"><span class="quick-icon">⌑</span><span><b>给文件安个家</b><small>分类整理，先预览再执行</small></span><i>↗</i></button><button class="quick-card" data-quick="codec"><span class="quick-icon">{ }</span><span><b>整理一段 JSON</b><small>格式化、编码与文本转换</small></span><i>↗</i></button><button class="quick-card" data-quick="ocr"><span class="quick-icon">▤</span><span><b>读出图片里的文字</b><small>提取文字，少一点手动输入</small></span><i>↗</i></button></div>
    <button class="setup-link" id="setup-link"><span>✧ 配置 AI 模型，开始第一段对话</span><span>去设置 →</span></button>
    <div class="home-note"><span>⌘</span><p><b>本机优先，安心开工</b><small>文件工具在本地运行；聊天记录保存在这台设备。</small></p><span class="note-status">LOCAL · READY</span></div></section>
    <section class="snake-card" aria-labelledby="snake-title"><header class="snake-heading"><div><span class="section-eyebrow"><span class="live-dot"></span> LITTLE ARCADE</span><h2 id="snake-title">贪吃蛇</h2><p>吃掉星星，和筑梦喵一起冲分。</p></div><button type="button" class="snake-reset" data-snake-reset aria-label="重新开始">↻</button></header><div class="snake-score-row"><span><small>本局分数</small><b data-snake-score>00</b></span><span class="snake-status" data-snake-status><i></i> 正在玩</span></div><div class="snake-board-wrap"><canvas class="snake-board" width="324" height="324" tabindex="0" aria-label="贪吃蛇游戏区域，使用方向键或 WASD 操控"></canvas><div class="snake-overlay" data-snake-overlay hidden><b data-snake-overlay-title>暂停中</b><span data-snake-overlay-copy>准备好后继续</span></div></div><div class="snake-controls"><button type="button" class="snake-toggle" data-snake-toggle>暂停</button><div class="snake-pad" role="group" aria-label="贪吃蛇方向控制"><button type="button" data-snake-dir="up" aria-label="向上">↑</button><button type="button" data-snake-dir="left" aria-label="向左">←</button><button type="button" data-snake-dir="down" aria-label="向下">↓</button><button type="button" data-snake-dir="right" aria-label="向右">→</button></div></div><footer class="snake-footer"><span>自动巡游 · 方向键 / WASD 接管</span><span>吃到 ✦ +10</span></footer></section></div>`;
  scroll.appendChild(empty);
  empty.querySelectorAll("[data-quick]").forEach(b => {
    const art=CupboxVisuals.art(({organize:'files',codec:'data',ocr:'vision'})[b.dataset.quick]);b.prepend(art);b.querySelector('.quick-icon').remove();
    b.addEventListener("click", () => {
    const tool = visibleTools().find(t => t.id === b.dataset.quick);
    if (!tool) { toast("这项工具已关闭，可在设置中启用"); return; }
    selectTool(tool.id, true); openDrawer();
    });
  });
  empty.querySelector("[data-open-tools]").addEventListener("click", ()=>{CupboxToolWorkspace.library();openDrawer();});
  empty.querySelector("[data-open-pet]").addEventListener("click", ()=>openModal("pet"));
  empty.querySelector("#setup-link").addEventListener("click", () => openModal("api"));
  empty.querySelector("#setup-link").hidden = modelReady;
  homeDashboardCleanup = mountHomeSnake(empty);
}

async function newChat() {
  if(sending){toast("任务进行中，请等待回复后再新建");return;}
  window.CupboxHarness?.setMode?.("normal");
  setMode("ask",false);
  if(drawerOpen)closeDrawer();
  sessionId = null;
  CupboxModels.clearImages();$("workflow-board").hidden=true;localStorage.removeItem("cupbox.chatDraft");
  clearChatDom();
  $("chat-title").textContent = "新任务";
  $("chat-text").value = "";
  $("btn-send").disabled = !$("chat-text").value.trim();
  await refreshSessions(null);
  $("chat-text").focus();
}

async function openSession(id) {
  if (sending) { toast("当前任务进行中，请等待回复后再切换"); return; }
  window.CupboxHarness?.setMode?.("normal");
  if(drawerOpen)closeDrawer();
  try {
    const s = await api.sessionsRead?.(id);
    if (!s) return;
    sessionId = s.id;
    $("chat-title").textContent = s.title || "会话";
    setMode(s.harnessSessionId?"agent":"ask", false);
    CupboxModels.clearImages();CupboxChatPicker.restore(s.chatSelection);$("workflow-board").hidden=true;
    clearChatDom();
    const scroll = $("chat-scroll");
    $("chat-empty")?.remove();
    const messages = s.messages || [];
    const foldAt = Math.max(0, messages.length - CHAT_FOLD_KEEP);
    chatFold = { messages: messages.slice(0, foldAt), nodes: [] };
    chatBatch = true;
    messages.slice(foldAt).forEach((m) => {
      if (m.role === "user") pushMsg("user", { text: m.text, time: "" });
      else if (m.role === "assistant") pushMsg("assistant", { text:m.text,trace:m.trace,tasks:m.tasks,media:m.media,messageId:m.id,sessionId:s.id,feedback:m.feedback,memoryId:m.memoryId,memoryText:m.memoryText,time:"" });
    });
    chatBatch = false;
    updateChatFold();
    renderChatRail();
    // pushMsg 里 time 为空则不显示 meta —— 统一补一次时间即可（此处省略）
    await refreshSessions(s.id);
    scrollChat(true);
  } catch { /* 损坏文件忽略 */ }
}

/* ---------------- 设置弹窗 ---------------- */

function openModal(tab) {
  const opening = !modalOpen;
  if (!modalOpen) restoreFocus = document.activeElement;
  const scrim = $("modal-scrim");
  const m = $("settings-modal");
  const focusBefore = document.activeElement;
  scrim.hidden = false;
  m.hidden = false;
  requestAnimationFrame(() => {
    if (!modalOpen) return;
    scrim.classList.add("open");
    m.classList.add("open");
    if (opening && document.activeElement === focusBefore) m.querySelector("button")?.focus();
  });
  modalOpen = true;
  switchTab(tab || 'general');
  if (opening) void fillApiForm();
}

function closeModal() {
  if (!modalOpen) return;
  modalOpen = false;
  restoreFocus?.focus();
  const scrim = $("modal-scrim");
  const m = $("settings-modal");
  scrim.classList.remove("open");
  m.classList.remove("open");
  setTimeout(() => {
    if (!modalOpen) { scrim.hidden = true; m.hidden = true; }
  }, 300);
}

let aboutThanksLoading=false;
async function loadAboutThanks(force=false){
  if(aboutThanksLoading)return;aboutThanksLoading=true;
  const button=$('about-thanks-refresh'),status=$('about-thanks-status'),list=$('about-thanks-list');button.disabled=true;list.replaceChildren();status.textContent='正在读取 GitHub 在线感谢名单…';
  try{const value=await api.aboutThanks(force);list.replaceChildren();for(const entry of value.entries){const card=document.createElement('article'),text=document.createElement('p'),links=document.createElement('div');card.className='about-thanks-entry';text.textContent=entry.text;links.className='about-thanks-links';for(const link of entry.links||[]){const b=document.createElement('button');b.type='button';b.textContent=link.label+' ↗';b.className='btn-ghost2';b.onclick=()=>void api.openExternal(link.url);links.append(b);}card.append(text,links);list.append(card);}status.textContent=value.ok?(value.unchanged?'已检查 GitHub · 名单无变化':'已读取 GitHub 在线名单')+' · '+new Date(value.updatedAt).toLocaleString('zh-CN')+' · '+value.entries.length+' 条致谢':value.error;
  }catch{status.textContent='名单暂时无法加载，请稍后重试；更新软件后请完整退出再打开。';}finally{aboutThanksLoading=false;button.disabled=false;}
}
function switchTab(name) {
  const settingsScroller=document.querySelector("#settings-modal .modal-body"),restoredScroll=window.CupboxUX?.beforePage("settings",name,settingsScroller)??0;
  document.querySelectorAll("#modal-tabs .tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
    b.setAttribute("aria-selected", String(b.dataset.tab === name));
  });
  ["general", "api", "models", "agent-presets", "pet", "march7th", "theme", "branding", "music", "execution", "notifications", "workbench", "startup", "plugins", "about", "freemodel"].forEach((n) => {
    const page = $(`tab-${n}`);
    if (page) page.hidden = n !== name;
  });
  CupboxSettingsLayout.sync(name);
  settingsScroller.scrollTo({top:restoredScroll,behavior:'instant'});
  if (name === "notifications") void window.CupboxSMTP?.load();
  if (name === "freemodel") loadFreemodelTab();
    if (name === "about") void loadAboutThanks();
}

async function loadFreemodelTab() { return CupboxChatPicker.refreshFree(); }

async function fillApiForm() {
  const sequence=++apiFillSequence,revision=CupboxProviders.revision();
  try {
    const r = await api.aiConfigGet?.();
    if(sequence!==apiFillSequence||revision!==CupboxProviders.revision())return;
    const c = (r && r.ok && r.config) || {};
    CupboxProviders.fill(c);
    const set = (id, v) => {
      const el = $(id);
      if (el && v !== undefined && v !== null) el.value = String(v);
    };
    if (c.provider) set("api-provider", c.provider);
    set("api-base", c.baseUrl);
    set("api-model", c.model);
    set("api-reasoning-mode",c.reasoningMode||"auto");
    set("api-key", ""); // 永不回填明文 Key，留空 = 保持不变
    set("api-temp", c.temperature);
    set("api-turns", c.maxTurns);
  } catch { /* 读取失败保持占位 */ }
  // 储存管理：显示数据目录（v1.0.3 起默认 文档/Cupbox）
  try {
    const s = await api.storageInfo?.();
    if (s && sequence === apiFillSequence) {
      $("storage-path").textContent = s.home;
      $("storage-badge").textContent = s.envOverride ? "CUPBOX_HOME 已覆盖" : "文档 · Cupbox";
    }
  } catch { /* 存储信息不可用忽略 */ }
}

async function saveApi() {
  const btn = $("btn-save-api");
  const label = btn.querySelector(".btn-label");
  const status = $("api-status");
  const raw = (id) => ($(id) ? $(id).value.trim() : "");
  btn.disabled = true;
  btn.classList.add("loading");
  if (label) label.textContent = "保存中…";
  try {
    const patch = {
      preset:$("api-preset").value,
      provider: raw("api-provider") || "openai-compatible",
      baseUrl: raw("api-base"),
      model: raw("api-model"),
      ...(raw("api-key") ? { apiKey: raw("api-key") } : {}),
      temperature: raw("api-temp") === "" ? null : Number(raw("api-temp")),
      reasoningMode:raw("api-reasoning-mode")||"auto",
      maxTurns: raw("api-turns") === "" ? null : Number(raw("api-turns")),
    };
    const r = await api.aiConfigSet?.(patch);
    if (!r || !r.ok) throw new Error((r && r.error) || "保存失败");
    status.textContent = `已保存 · ${r.config.model || "未选择模型"} · ${r.config.hasApiKey ? "密钥已配置" : "未配置密钥"}`;
    status.style.color = "";
    await fillApiForm();
    await CupboxModels.refresh();
    await refreshModel();
  } catch (e) {
    status.textContent = `${String((e && e.message) || e)}`;
    status.style.color = "var(--err)";
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    if (label) label.textContent = "保存 API 设置";
  }
}

function renderPlugins() {
  const box = $("plugin-list");
  box.innerHTML = "";
  const dis = Array.isArray(prefs.disabledTools) ? prefs.disabledTools : [];
  TOOLS.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "plugin-row" + (dis.includes(t.id) ? " off" : "");
    row.style.animationDelay = `${i * 30}ms`;

    const ic = document.createElement("span");
    ic.className = "p-ic";
    ic.innerHTML = CupboxIcons.html(t.id);
    const txt = document.createElement("div");
    txt.className = "p-txt";
    const name = document.createElement("div");
    name.className = "p-name";
    name.textContent = t.name;
    const desc = document.createElement("div");
    desc.className = "p-desc";
    desc.textContent = t.hint || (t.warn || `${t.group} 工具`);
    txt.appendChild(name);
    txt.appendChild(desc);

    const sw = document.createElement("label");
    sw.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", `启用${t.name}`);
    input.checked = !dis.includes(t.id);
    const track = document.createElement("span");
    track.className = "track";
    const thumb = document.createElement("span");
    thumb.className = "thumb";
    track.appendChild(thumb);
    sw.appendChild(input);
    sw.appendChild(track);
    input.addEventListener("change", async () => {
      let next;
      if (input.checked) next = dis.filter((x) => x !== t.id);
      else next = dis.includes(t.id) ? dis : [...dis, t.id];
      dis.length = 0;
      dis.push(...next);
      row.classList.toggle("off", !input.checked);
      await savePrefs({ disabledTools: next });
      renderDrawerTools();
      CupboxToolWorkspace.render();
      // 当前选中工具被禁用时切到第一个可见工具
      if (!visibleTools().some((x) => x.id === current.id)) {
        const first = visibleTools()[0];
        if (first) selectTool(first.id, true);
        else { $("tool-form").innerHTML = ""; $("tool-title").textContent = "暂无启用的工具"; $("tool-hint").hidden = true; $("tool-warn").hidden = true; $("btn-run").disabled = true; }
      }
      $("btn-run").disabled = !visibleTools().length;
    });

    row.appendChild(ic);
    row.appendChild(txt);
    row.appendChild(sw);
    box.appendChild(row);
  });
}

/* ---------------- 工作区 ---------------- */

async function pickWorkspace(forWork=false) {
  if(!forWork&&prefs.executionEnvironment!=='native'){openModal('execution');return;}
  try {
    const p = await api.pickWorkspace?.();
    const el = $("ws-path");
    if (el) el.textContent = p || prefs.workspace || "默认工作目录";
    if (p) { prefs.workspace = p; toast("工作文件夹已切换：" + p); }
    return p;
  } catch (e) { toast("选择工作目录失败：" + e.message); }
}

/* ---------------- 版本检测与更新公告 ---------------- */

function toast(msg, ms) { return CupboxUX.notify(String(msg), ms || {}); }

function sourceName(s) {
  return s === "github" ? "GitHub Releases" : s === "npm" ? "npm registry" : s === "custom" ? "自定义清单" : "";
}

/**
 * 检查更新。opts.manual = 用户主动点版本号（带反馈）；opts.force = 绕过主进程 5 分钟缓存。
 * 任何失败都不打扰用户（静默），只有手动检查才给 toast 反馈。
 */
async function checkUpdate(opts) {
  opts = opts || {};
  const ver = $("ver-chip");
  if (opts.manual && ver) { ver.classList.add("checking"); ver.title = "正在检查更新…"; }
  let info = null;
  try { info = await api.updateCheck?.(opts.force); } catch { info = null; }
  if (opts.manual && ver) { ver.classList.remove("checking"); ver.title = "点击检查更新"; }

  if (!info || info.source === "disabled" || info.source === "none") {
    if (opts.manual) {
      if (!info) toast("检查更新失败（网络不可用）");
      else if (info.source === "disabled") toast("更新检查已关闭（CUPBOX_UPDATE_DISABLE=1）");
      else toast(`检查更新失败：${info.error || "未知错误"}`);
    }
    return info;
  }

  updateInfo = info;
  if (info.hasUpdate) {
    const chip = $("update-chip");
    if (chip) {
      $("update-chip-text").textContent = `v${info.latest} 可用`;
      chip.hidden = false;
    }
    // 更新只展示徽标，由用户主动打开公告。
  } else {
    // 已是最新 / 数据源版本更低：强制收起徽标，防止上一次检查留下的「可用」常驻
    const chip = $("update-chip");
    if (chip) chip.hidden = true;
    if (opts.manual) {
      if (ver) {
        ver.classList.add("uptodate");
        setTimeout(() => ver.classList.remove("uptodate"), 1500);
      }
      toast(`已是最新 v${info.current}`);
    }
  }
  return info;
}

function showUpdateAnnounce() {
  if (!updateInfo) return;
  $("upd-current").textContent = `v${updateInfo.current}`;
  $("upd-latest").textContent = `v${updateInfo.latest}`;
  $("upd-source").textContent = sourceName(updateInfo.source) || "更新源";
  const notes = $("upd-notes");
  if (updateInfo.notes && updateInfo.notes.trim()) {
    notes.textContent = updateInfo.notes;
    notes.classList.remove("empty");
  } else {
    notes.textContent = "本版本未附带更新说明，可打开 Releases 页面或 CHANGELOG 查看完整变更。";
    notes.classList.add("empty");
  }
  const scrim = $("upd-scrim");
  const m = $("upd-modal");
  scrim.hidden = false;
  m.hidden = false;
  updOpen = true;
  requestAnimationFrame(() => {
    scrim.classList.add("open");
    m.classList.add("open");
  });
  setTimeout(() => $("btn-upd-go")?.focus(), 240);
}

function closeUpdateAnnounce() {
  if (!updOpen) return;
  updOpen = false;
  const scrim = $("upd-scrim");
  const m = $("upd-modal");
  scrim.classList.remove("open");
  m.classList.remove("open");
  setTimeout(() => {
    if (!updOpen) { scrim.hidden = true; m.hidden = true; }
  }, 300);
}

/* ---------------- 开屏公告（GitHub announcement.json） ---------------- */

/** 展示公告。正文只用 textContent，杜绝公告文件里的 HTML/脚本注入。 */
function openAnnouncement(item, source) {
  if (!item) return;
  announcement = item;
  $("ann-title").textContent = item.title;
  $("ann-body").textContent = item.body;
  const date = $("ann-date");
  date.hidden = !item.publishedAt;
  if (item.publishedAt) date.textContent = item.publishedAt;
  const src = $("ann-source");
  src.hidden = !source;
  if (source) src.textContent = source === "raw.githubusercontent.com" ? "GitHub" : source;
  const github = $("btn-ann-github");
  github.hidden = !item.url;
  $("ann-mute").checked = false;
  const scrim = $("ann-scrim");
  const m = $("ann-modal");
  scrim.hidden = false;
  m.hidden = false;
  annOpen = true;
  requestAnimationFrame(() => {
    scrim.classList.add("open");
    m.classList.add("open");
  });
  setTimeout(() => $("btn-ann-ok")?.focus(), 240);
}

function closeAnnouncement() {
  if (!annOpen) return;
  annOpen = false;
  const scrim = $("ann-scrim");
  const m = $("ann-modal");
  scrim.classList.remove("open");
  m.classList.remove("open");
  setTimeout(() => {
    if (!annOpen) { scrim.hidden = true; m.hidden = true; }
  }, 300);
  if (announcement) {
    const muted = $("ann-mute")?.checked === true;
    void savePrefs({ announcementSeenVersion: announcement.version, announcementMuted: muted });
  }
  setTimeout(() => $("chat-text")?.focus(), 320);
}

/**
 * 启动时检测公告：已读同一版本且勾过「不再提示」→ 跳过；有新内容 → 无论是否静音都显示。
 * force=true 时忽略已读状态（验证脚本用）。检查失败完全静默。
 */
async function maybeShowAnnouncement(force) {
  if (!force && SMOKE) return null; // 冒烟截图不联网
  let result = null;
  try { result = await api.announcementCheck?.(); } catch { result = null; }
  if (!result || !result.ok || !result.announcement) return null;
  const item = result.announcement;
  if (!force && String(prefs.announcementSeenVersion || "") === item.version && prefs.announcementMuted === true) return null;
  openAnnouncement(item, result.source);
  return item;
}

/* —— 上下文洞察弹窗（成分 / 趋势 / 事件） —— */
const CTX_PART_COLORS = {
  system: "#82a38a", tools: "#d6b17d", user: "#cb96a3",
  injected: "#8fb3c9", assistant: "#a99bd4", toolResults: "#9fb88a",
};
const CTX_EVENT_LABELS = { inject: "注入", compact: "压缩", switch: "切换", mode: "模式" };

function fmtTokens(n) {
  const raw = Math.round(Number(n) || 0);
  const v = Math.abs(raw);
  const sign = raw < 0 ? "-" : "";
  if (v < 1000) return `${sign}${v}`;
  if (v < 1e6) return `${sign}${(v / 1000).toFixed(v < 1e4 ? 1 : 0)}k`;
  return `${sign}${(v / 1e6).toFixed(1)}M`;
}
function fmtTime(at) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const ctxEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** 建元素并用 CSSOM 赋样式（CSP 拦 style= 属性，但 el.style.x 赋值不受限）。 */
function ctxEl(tag, cls, css) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (css) Object.assign(el.style, css);
  return el;
}

function renderContextStats(payload) {
  const rec = payload?.record || { window: 128000, last: null, trend: [], events: [], totals: { requests: 0, prompt: 0, output: 0 } };
  const last = rec.last;
  const occ = last && rec.window ? last.total / rec.window : 0;

  $("ctx-window").textContent = `窗口 ${fmtTokens(rec.window)}`;
  $("ctx-kpis").innerHTML = `
    <div class="ctx-kpi"><b>${last ? fmtTokens(last.total) : "—"}</b><span>最近一次占用 tokens</span><em>${last ? `${(occ * 100).toFixed(occ < 0.1 ? 1 : 0)}% of 窗口` : "尚无请求"}</em></div>
    <div class="ctx-kpi"><b>${rec.totals.requests || 0}</b><span>累计请求</span></div>
    <div class="ctx-kpi"><b>${fmtTokens(rec.totals.prompt)}</b><span>累计输入 tokens</span><em>提供方上报</em></div>
    <div class="ctx-kpi"><b>${fmtTokens(rec.totals.output)}</b><span>累计输出 tokens</span></div>`;

  const bar = $("ctx-bar");
  const legend = $("ctx-legend");
  bar.replaceChildren();
  legend.replaceChildren();
  if (last && last.total > 0) {
    for (const p of last.parts) {
      const seg = ctxEl("i", "", {
        width: `${Math.max(0, (p.tokens / last.total) * 100)}%`,
        background: CTX_PART_COLORS[p.key] || "#9ab",
      });
      seg.title = `${p.label}：${fmtTokens(p.tokens)} tokens`;
      bar.append(seg);

      const row = ctxEl("div", "ctx-leg");
      row.append(ctxEl("i", "", { background: CTX_PART_COLORS[p.key] || "#9ab" }));
      const name = document.createElement("b");
      name.textContent = p.label;
      const val = document.createElement("span");
      val.textContent = `${fmtTokens(p.tokens)} · ${last.total ? ((p.tokens / last.total) * 100).toFixed(1) : 0}%`;
      row.append(name, val);
      legend.append(row);
    }
  } else {
    const note = document.createElement("div");
    note.className = "ctx-empty-note";
    note.textContent = "还没有数据。发送一条消息后，这里会显示六成分占比。";
    legend.append(note);
  }

  const trend = rec.trend || [];
  $("ctx-trend-count").textContent = `${trend.length} 次请求`;
  const tEl = $("ctx-trend");
  tEl.replaceChildren();
  if (trend.length) {
    const max = Math.max(...trend.map((t) => Math.max(t.tokens || 0, t.prompt || 0)), 1);
    for (const t of trend.slice(-60)) {
      const h = Math.max(3, Math.round(((t.tokens || 0) / max) * 100));
      const promptRatio = t.prompt && t.tokens ? Math.min(1, t.prompt / Math.max(t.tokens, t.prompt)) : 0;
      const bar2 = ctxEl("i", t.prompt ? "has-prompt" : "", { height: `${h}%` });
      bar2.style.setProperty("--cq", `${Math.round(promptRatio * 100)}%`);
      bar2.title = `${fmtTime(t.at)} · 估算 ${fmtTokens(t.tokens)} tokens${t.prompt ? ` · 实际输入 ${fmtTokens(t.prompt)}` : ""}${t.output ? ` · 输出 ${fmtTokens(t.output)}` : ""}${t.label ? `\n${t.label}` : ""}`;
      tEl.append(bar2);
    }
  } else {
    const s = document.createElement("span");
    s.className = "ctx-empty";
    s.textContent = "暂无趋势 · 发送消息后逐条记录";
    tEl.append(s);
  }

  const events = rec.events || [];
  $("ctx-event-count").textContent = String(events.length);
  const eEl = $("ctx-events");
  eEl.replaceChildren();
  if (events.length) {
    for (const ev of [...events].reverse().slice(0, 30)) {
      const row = ctxEl("div", "ctx-ev");
      const kind = document.createElement("span");
      kind.className = "ctx-ev-kind";
      kind.dataset.kind = ev.kind;
      kind.textContent = CTX_EVENT_LABELS[ev.kind] || ev.kind;
      const txt = document.createElement("span");
      txt.className = "ctx-ev-txt";
      txt.textContent = ev.label || "";
      if (typeof ev.delta === "number") {
        const d = document.createElement("b");
        d.textContent = ` ${ev.delta > 0 ? "+" : ""}${fmtTokens(ev.delta)}`;
        d.style.color = ev.delta < 0 ? "var(--warn)" : "var(--accent)";
        d.style.fontWeight = "600";
        txt.append(d);
      }
      const time = document.createElement("span");
      time.className = "ctx-ev-time";
      time.textContent = fmtTime(ev.at);
      row.append(kind, txt, time);
      eEl.append(row);
    }
  } else {
    const note = document.createElement("div");
    note.className = "ctx-empty-note";
    note.textContent = "暂无事件。注入记忆块、压缩历史、切换模型或模式时会记录在这里。";
    eEl.append(note);
  }

  const base = payload?.baseline;
  $("ctx-note").innerHTML = base && base.kind === "baseline"
    ? `Agent 基线开销：系统提示词 ${fmtTokens(base.system?.tokens)} + 工具 Schema ${fmtTokens(base.tools?.tokens)}（${base.tools?.count ?? 0} 个工具）= <b>${fmtTokens(base.total)}</b> · ${ctxEsc(base.note || "")}`
    : "估算为固定密度启发式（≈），非精确 tokenizer 计数。";
}

async function openContextModal() {
  if (ctxOpen) return;
  let payload = null;
  try { payload = await api.contextStats?.(sessionId); } catch { payload = null; }
  renderContextStats(payload || null);
  const scrim = $("ctx-scrim");
  const m = $("ctx-modal");
  scrim.hidden = false;
  m.hidden = false;
  ctxOpen = true;
  requestAnimationFrame(() => {
    scrim.classList.add("open");
    m.classList.add("open");
  });
  setTimeout(() => $("ctx-close")?.focus(), 240);
}

function closeContextModal() {
  if (!ctxOpen) return;
  ctxOpen = false;
  const scrim = $("ctx-scrim");
  const m = $("ctx-modal");
  scrim.classList.remove("open");
  m.classList.remove("open");
  setTimeout(() => {
    if (!ctxOpen) { scrim.hidden = true; m.hidden = true; }
  }, 300);
}

/** 设置 → 关于更新：检查 GitHub 仓库新版本并内联展示结果（不弹公告，结果区自己给下载按钮）。 */
async function checkUpdateInSettings() {
  const btn = $("btn-check-upd");
  const label = btn.querySelector(".btn-label");
  const st = $("check-status");
  const box = $("about-result");
  btn.disabled = true;
  btn.classList.add("loading");
  if (label) label.textContent = "检查中…";
  st.textContent = "正在查询 GitHub 仓库…";
  box.hidden = true;
  box.className = "about-result";

  let info = null;
  try { info = await checkUpdate({ force: true, noAnnounce: true }); } catch { info = null; }

  btn.disabled = false;
  btn.classList.remove("loading");
  if (label) label.textContent = "检查 GitHub 仓库更新";
  st.textContent = "";

  box.hidden = false;
  if (!info || info.source === "none" || info.source === "disabled") {
    box.classList.add("bad");
    box.textContent = !info
      ? "检查失败（网络不可用），可稍后重试"
      : info.source === "disabled"
        ? "更新检查已关闭（CUPBOX_UPDATE_DISABLE=1）"
        : `检查失败：${info.error || "未知错误"}\n数据源不可达时会自动跳到下一源，全部不可达才报此错。`;
    return;
  }
  if (info.hasUpdate) {
    box.classList.add("has");
    box.textContent = `发现新版本 v${info.latest}（当前 v${info.current}）· 来源 ${sourceName(info.source)}\nRelease 说明与下载入口已就绪。`;
    const go = document.createElement("button");
    go.type = "button";
    go.className = "btn-ghost2";
    go.textContent = "前往 GitHub 下载";
    go.addEventListener("click", () => { void api.openExternal?.(info.url || RELEASES_URL); });
    box.appendChild(go);
  } else {
    box.classList.add("ok");
    box.textContent = `已是最新版本 v${info.current}（数据源 ${sourceName(info.source)}）`;
  }
}

/* ---------------- 窗口控制 ---------------- */

function bindWindowControls() {
  const w = api.win;
  if (!w) return;
  $("cap-min")?.addEventListener("click", () => w.minimize());
  $("cap-max")?.addEventListener("click", async () => {
    const maximized = await w.toggleMaximize();
    const max = $("cap-max");
    if (max) max.dataset.max = maximized ? "1" : "0";
  });
  $("cap-close")?.addEventListener("click", () => w.close());
}

/* ---------------- 启动 ---------------- */

async function boot() {
  CupboxIcons.mount();
  CupboxUX.init();
  CupboxResponse.init({toast,updated:()=>{if(typeof refreshContextStats==="function")void refreshContextStats();}});
  CupboxProviders.init();
  CupboxOfficeLocal.init({current:()=>current.id,run});
  CupboxToolWorkspace.init({tools:visibleTools,select:selectTool,current:()=>current.id,busy:()=>toolRunning,toast,native:()=>void CupboxExecution.setEnvironment('native')});
  bindWindowControls();

  // 偏好（主题 / 强调色 / 模式 / 工作区 / 插件开关）
  try {
    const p = await api.prefsGet?.();
    if (p && typeof p === "object") prefs = { ...prefs, ...p };
  } catch { /* 用默认 */ }
  applyTheme(prefs.theme || "light", prefs.accent || "aurora");
  CupboxTheme.init({ getPrefs: () => prefs, save: savePrefs, theme: applyTheme, pick: () => api.pickWallpaper() });
  $("filesystem-enabled").checked=prefs.filesystemTools!==false;$("filesystem-enabled").addEventListener("change",()=>void savePrefs({filesystemTools:$("filesystem-enabled").checked}));
  CupboxStartup.init({getPrefs:()=>prefs,save:savePrefs,pick:()=>api.pickStartupMedia()});
  await CupboxMarch7th.init({getPrefs:()=>prefs,toast,settings:openModal}).catch(e=>toast('三月七面板加载失败：'+e.message));
  await CupboxPetSettings.init({settings:openModal,closeSettings:closeModal,toast}).catch(e=>toast('桌宠面板加载失败：'+e.message));
  await CupboxAgentPresets.init({getPrefs:()=>prefs,save:savePrefs,mode:setMode,settings:openModal,toast,isBusy:()=>sending||toolRunning}).catch(e=>toast('预设面板加载失败：'+e.message));
  await CupboxExecution.init({getPrefs:()=>prefs,save:savePrefs,settings:openModal,toolName:id=>TOOLS.find(t=>t.id===id)?.name||CupboxResponse.toolName(id),toast,onChange:(environment,root)=>{
    $("ws-path").textContent=environment==='sandbox'?'沙箱工作目录':prefs.workspace||'默认工作目录';
    CupboxToolWorkspace.availability(current.id);
    for(const id of ['dir','root','cwd']){const field=$("tool-form").querySelector(`[data-key="${id}"]`);if(field)field.value=environment==='sandbox'?root:(prefs.workspace||'');}
  }});
  const startup = CupboxStartup.play(prefs);
  setMode("ask", false);
  const wsEl = $("ws-path");
  if (wsEl) wsEl.textContent = prefs.workspace||"聊天无需选择";

  renderDrawerTools();
  await CupboxPluginSettings.init({getPrefs:()=>prefs,toast,isBusy:()=>sending||toolRunning}).catch(e=>toast(e.message));
  renderPlugins();
  if (visibleTools()[0]) selectTool(visibleTools()[0].id, true);
  $("btn-run").disabled = !visibleTools().length;
  clearChatDom();
  await CupboxWorkbench.init({session:()=>sessionId,toast});
  await CupboxModels.init({prefs,mode:setMode,save:savePrefs,refresh:refreshModel,toast,confirm:confirmAction,session:()=>sessionId,retry:task=>sendChat({retry:task})});
  await CupboxChatPicker.init({getPrefs:()=>prefs,save:savePrefs,refresh:refreshModel,settings:openModal,closeSettings:closeModal,mode:setMode,toast});
  await refreshModel();
  $("btn-send").disabled = true;
  await refreshSessions(null);

  // 顶部信息
  try {
    const info = await api.info();
    $("ver-chip").textContent = `v${info.version}`;
    $("startup-display-version").textContent = `v${info.version}`;
    $("engine-chip").textContent = `${info.tools ?? 18} 工具 · Electron ${info.electron} · Node ${info.node}`;
    CupboxToolWorkspace.updateCount();
    const av = $("about-ver");
    if (av) av.textContent = `v${info.version}`;
    const hv = $("startup-hero-version");
    if (hv) hv.textContent = info.version;
  } catch { /* info 不可用忽略 */ }

  // 版本检测：静默首检 → 有新版则顶栏徽标 + 一次性更新公告
  void checkUpdate({});

  // —— 事件绑定 ——
  $("btn-run")?.addEventListener("click", run);
  $("tool-search").addEventListener("input", renderDrawerTools);
  $("session-search").addEventListener("input", () => { sessionFilter = $("session-search").value.trim(); void refreshSessions(sessionId); });
  
  // 模型管理：侧栏直达模型库（多模型增删、能力多选 文本/视觉/绘图…）
  $("btn-models-nav")?.addEventListener("click", () => openModal("models"));
  $("btn-qq-nav")?.addEventListener("click", () => api.qqOpen().catch(e => toast(e.message)));
  // 储存管理：打开 / 定位数据目录
  $("storage-open")?.addEventListener("click", () => void api.storageOpen?.());
  $("storage-reveal")?.addEventListener("click", () => void api.storageReveal?.());
  $("tool-form")?.addEventListener("submit", (e) => { e.preventDefault(); run(); });

  $("btn-drawer")?.addEventListener("click", ()=>{CupboxToolWorkspace.library();openDrawer();});
  $("drawer-close")?.addEventListener("click", closeDrawer);
  $("drawer-scrim")?.addEventListener("click", closeDrawer);

  $("btn-settings")?.addEventListener("click", () => openModal());
  CupboxSettingsLayout.init({open:openModal,switchPage:switchTab});
  $("modal-close")?.addEventListener("click", closeModal);
  $("modal-scrim")?.addEventListener("click", closeModal);
  document.querySelectorAll("#modal-tabs .tab").forEach((b) => {
    b.addEventListener("click", () => switchTab(b.dataset.tab));
  });
  $("btn-save-api")?.addEventListener("click", saveApi);

  document.querySelectorAll("#seg-theme .seg-btn").forEach((b) => {
    b.addEventListener("click", () => {
      applyTheme(b.dataset.theme, prefs.accent);
      void savePrefs({ theme: b.dataset.theme });
    });
  });
  document.querySelectorAll("#swatches .swatch").forEach((b) => {
    b.addEventListener("click", () => {
      applyTheme(prefs.theme, b.dataset.accent);
      void savePrefs({ accent: b.dataset.accent });
    });
  });
  $("btn-settings")?.addEventListener("dblclick", () => switchTab("plugins"));

  document.querySelectorAll("#mode-toggle .mode-btn").forEach((b) => {
    b.addEventListener("click", () => setMode(b.dataset.mode));
  });

  $("btn-new-chat")?.addEventListener("click", newChat);
  $("btn-clear")?.addEventListener("click", async () => {
    if (sending) return;
    if (!$("chat-scroll").querySelector(".msg")) return;
    if (!await confirmAction("清空当前任务的对话记录？此操作无法撤销。")) return;
    if (sending) return;
    if (sessionId) {
      try { await api.sessionsClear?.(sessionId); } catch (e) { toast("清空失败：" + e.message); return; }
    }
    clearChatDom();
    toast("当前对话已清空");
    await refreshSessions(sessionId);
  });
  $("btn-workspace")?.addEventListener("click", pickWorkspace);

  // —— 上下文洞察弹窗 ——
  $("btn-context")?.addEventListener("click", () => { void openContextModal(); });
  $("ctx-close")?.addEventListener("click", closeContextModal);
  $("ctx-scrim")?.addEventListener("click", closeContextModal);

  const ta = $("chat-text");
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      void sendChat();
    }
  });
  ta.addEventListener("input", () => {
    $("btn-send").disabled = sending || !ta.value.trim();
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  });
  $("btn-send")?.addEventListener("click", sendChat);

  // —— 版本检测 / 更新公告 ——
  const verChip = $("ver-chip");
  verChip?.addEventListener("click", () => void checkUpdate({ manual: true, force: true }));
  verChip?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void checkUpdate({ manual: true, force: true });
    }
  });
  $("update-chip")?.addEventListener("click", showUpdateAnnounce);
  $("btn-check-upd")?.addEventListener("click", checkUpdateInSettings);
  $('about-thanks-refresh')?.addEventListener('click',()=>void loadAboutThanks(true));
  $('settings-afdian')?.addEventListener('click',()=>void api.openExternal?.('https://afdian.com/a/beilaishi'));
  $('settings-copy-group')?.addEventListener('click',()=>void api.openExternal?.('https://qm.qq.com/q/V2pNRPkW0G'));
  $('settings-show-thanks')?.addEventListener('click',()=>{switchTab('about');requestAnimationFrame(()=>$('about-thanks-title').scrollIntoView({block:'start',behavior:'smooth'}));});
  $('about-show-thanks')?.addEventListener('click',()=>$('about-thanks-title').scrollIntoView({block:'start',behavior:'smooth'}));
  $('about-copy-group')?.addEventListener('click',async()=>{try{await api.aboutCopyGroup();$('about-group-status').textContent='群号已复制';}catch{$('about-group-status').textContent='复制失败，请手动复制上方群号';}});
  document.querySelectorAll("#tab-about [data-url]").forEach((b) => {
    b.addEventListener("click", () => { void api.openExternal?.(b.dataset.url); });
  });
  $("upd-close")?.addEventListener("click", closeUpdateAnnounce);
  $("upd-scrim")?.addEventListener("click", closeUpdateAnnounce);
  $("btn-upd-go")?.addEventListener("click", () => {
    void api.openExternal?.((updateInfo && updateInfo.url) || RELEASES_URL);
  });
  $("btn-upd-log")?.addEventListener("click", () => { void api.openExternal?.(CHANGELOG_URL); });
  $("btn-upd-later")?.addEventListener("click", async () => {
    closeUpdateAnnounce();
    if (updateInfo) {
      await savePrefs({ dismissedVersion: updateInfo.latest });
      toast("已静默该版本 · 仍可点击顶栏徽标查看");
    }
  });

  // —— 开屏公告 ——
  $("ann-close")?.addEventListener("click", closeAnnouncement);
  $("ann-scrim")?.addEventListener("click", closeAnnouncement);
  $("btn-ann-ok")?.addEventListener("click", closeAnnouncement);
  $("btn-ann-github")?.addEventListener("click", () => { void api.openExternal?.(announcement?.url || RELEASES_URL); });

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); if (!modalOpen && !drawerOpen && !updOpen && !annOpen && !ctxOpen) void newChat(); }
    const overlay = annOpen ? $("ann-modal") : modalOpen ? $("settings-modal") : updOpen ? $("upd-modal") : ctxOpen ? $("ctx-modal") : null;
    if (overlay && e.key === "Tab") {
      const focusable = [...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    }
    if (e.key === "Escape") {
      if (annOpen) closeAnnouncement();
      else if (modalOpen) closeModal();
      else if (updOpen) closeUpdateAnnounce();
      else if (ctxOpen) closeContextModal();
      else if (drawerOpen) closeDrawer();
    }
  });

  // —— 冒烟模式（截图用，不打网络）：种一段演示对话 → 抽屉跑真实 hash → 打开设置 ——
  if (SMOKE) {
    setTimeout(() => {
      $("chat-title").textContent = "冒烟验证";
      $("chat-empty")?.remove();
      pushMsg("user", { text: "算出「cupbox 可视化冒烟」的 sha256，再看看 1718000000 是什么时间。", time: "12:01" });
      pushMsg("assistant", {
        text:
          "两件事都办好了：\n\n1️⃣ sha256 = 6c25e56d3fb1b50466e88befc49e9924eda46956c37b742d8b2167a6d8ae697\n2️⃣ 1718000000 → 2024-06-10T14:13:20+08:00（北京时间，约 2 年前）",
        trace: [
          { name: "hash", ok: true, durationMs: 3, args: { algo: "sha256" } },
          { name: "time", ok: true, durationMs: 1, args: { input: "1718000000" } },
        ],
        time: "12:01 · 18 ms",
      });
    }, 3400);
    // 主进程 6.3s 截抽屉帧、8.0s 截设置帧
    setTimeout(() => {
      openDrawer();
      selectTool("hash", true);
    }, 5600);
    setTimeout(() => {
      const input = $("tool-form").querySelector('[data-key="text"]');
      if (input) input.value = "cupbox 可视化冒烟";
      void run();
    }, 5900);
    setTimeout(() => {
      closeDrawer();
      openModal("about");
    }, 7500);
    // 7.7s：在「关于更新」页跑一次真实检查（注入假更新源时结果区会显示发现新版），主进程 8.1s 截设置帧
    setTimeout(() => {
      if (updateInfo && updateInfo.hasUpdate) void checkUpdateInSettings();
    }, 7700);
    // 8.45s：切浅色 + 薄荷强调色（只改 DOM，不落盘偏好），主进程 8.95s 截浅色帧
    setTimeout(() => {
      applyTheme("light", "mint");
    }, 8450);
    // 9.0s：先收起抽屉与设置窗，9.4s 打开更新公告（冒烟需注入 CUPBOX_UPDATE_URL 假更新源才有内容），主进程 9.9s 截更新帧
    setTimeout(() => {
      closeModal();
      closeDrawer();
    }, 9000);
    setTimeout(() => {
      if (updateInfo && updateInfo.hasUpdate) showUpdateAnnounce();
    }, 9400);
    // 10.0s：打开上下文洞察面板（演示数据，仅冒烟截图用），主进程 10.6s 截帧
    setTimeout(() => {
      closeUpdateAnnounce();
      const now = Date.now();
      const demo = {
        record: {
          window: 128000,
          last: {
            parts: [
              { key: "system", label: "系统提示词", tokens: 55, chars: 220 },
              { key: "tools", label: "工具 Schema", tokens: 2040, chars: 8160 },
              { key: "user", label: "用户消息", tokens: 1860, chars: 7440 },
              { key: "injected", label: "注入上下文", tokens: 940, chars: 3760 },
              { key: "assistant", label: "助手回复", tokens: 1520, chars: 6080 },
              { key: "toolResults", label: "工具结果", tokens: 3080, chars: 12320 },
            ],
            total: 9495, window: 128000, occupancy: 9495 / 128000, at: now,
          },
          trend: Array.from({ length: 18 }, (_, i) => ({
            at: now - (17 - i) * 60000,
            tokens: 1200 + i * 470 + (i % 3) * 300,
            ...(i % 4 === 0 ? { prompt: 1400 + i * 430, output: 180 + i * 12 } : {}),
            label: ["帮我整理下载目录", "这段 base64 是什么", "批量重命名加序号", "算一个 sha256"][i % 4],
          })),
          events: [
            { at: now - 4000, kind: "inject", label: "记忆块注入（facts.jsonl 召回 Top3）", delta: 320 },
            { at: now - 90000, kind: "compact", label: "压缩 12 条早前消息为摘要", delta: -2140 },
            { at: now - 200000, kind: "switch", label: "模型 gpt-4o → claude-sonnet-4" },
            { at: now - 320000, kind: "mode", label: "问一问 → 执行任务" },
          ],
          totals: { requests: 18, prompt: 15420, output: 6840 },
          lastInjectTokens: 320,
          model: "claude-sonnet-4",
        },
        baseline: null,
      };
      renderContextStats(demo);
      const scrim = $("ctx-scrim"), m = $("ctx-modal");
      scrim.hidden = false; m.hidden = false; ctxOpen = true;
      requestAnimationFrame(() => { scrim.classList.add("open"); m.classList.add("open"); });
    }, 10000);
  }

  // 首次进入聚焦输入框
  await startup;
  $("chat-text")?.focus();
  void maybeShowAnnouncement(); // 开屏公告：每次启动检测 GitHub 上的 announcement.json
  window.cupboxReady = true;
}

async function refreshModel() {
  try {
    await CupboxModels.refresh();
    const r = await api.aiConfigGet?.();
    const c = r?.ok ? r.config : {};
    modelReady = (await api.chatModels()).models.some(m=>m.enabled);
    CupboxChatPicker.sync();
    if ($("setup-link")) $("setup-link").hidden = modelReady;
  } catch { modelReady = false; }
}

function confirmAction(message, options) { return CupboxUX.confirm(message, options); }

boot();

