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
      { k: "allowPrefixes", label: "允许的前缀白名单 *必填（逗号分隔）", type: "text", ph: "npm,git status" },
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

const GROUP_ORDER = ["数据", "文件", "图片", "系统"];
const OPTION_LABELS = { b64e: "Base64 编码", b64d: "Base64 解码", urle: "URL 编码", urlde: "URL 解码", "html-esc": "HTML 转义", "html-unesc": "HTML 还原", json: "JSON 格式化", "json-min": "JSON 压缩", category: "按文件类型", date: "按日期", regex: "按正则规则", create: "创建压缩包", extract: "解压文件", list: "查看列表", read: "读取剪贴板", write: "写入剪贴板", kill: "结束进程", auto: "自动选择", windows: "Windows 原生识别" };
for (const t of TOOLS) {
  if (["organize", "rename"].includes(t.id)) {
    t.warn = "文件变更默认先预览";
    t.fields.find(f => f.k === "dryRun").label = "仅预览变更（关闭后实际执行）";
  }
}
const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const api = window.cupbox || {};
let prefs = { theme: "light", accent: "aurora", mode: "ask", workspace: "", disabledTools: [], dismissedVersion: "", background: "sakura", backgroundVeil: 72, backgroundBlur: 0, backgroundFit: "cover", startupEnabled:true, startupStyle:'orbit', startupDuration:1.6, startupCaption:'让灵感，轻轻启程。' };
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
  prefs = { ...prefs, ...patch };
  try {
    const r = await api.prefsSet?.(patch);
    if (r && !r.ok) toast("外观暂时无法保存，请稍后重试");
  } catch { /* 偏好写失败不阻塞界面 */ }
}

window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
  if (prefs.theme === "system") applyTheme("system", prefs.accent);
});

function setMode(mode, persist) {
  if (sending) return;
  prefs.mode = mode === "agent" ? "agent" : "ask";
  document.querySelectorAll("#mode-toggle .mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === prefs.mode);
  });
  if (persist !== false) void savePrefs({ mode: prefs.mode });
  $("mode-description").textContent = prefs.mode === "agent" ? "调用本地工具完成任务 · 文件变更默认先预览" : "一起理清思路，找到答案";
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
        badge.textContent = "安全";
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
    else args[k] = el.value;
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
  if (CupboxToolWorkspace.result(r,body)) {
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

async function run() {
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
    const res = await api.run(runningId, collect());
    const ms=Math.round(performance.now()-t0);toolResults.set(runningId,{res,ms});
    if(current.id===runningId)renderResult(res,ms);
  } catch (e) {
    const res={ ok: false, error: String((e && e.message) || e) };const ms=Math.round(performance.now()-t0);toolResults.set(runningId,{res,ms});if(current.id===runningId)renderResult(res,ms);
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

function scrollChat() {
  const el = $("chat-scroll");
  if (el) el.scrollTop = el.scrollHeight;
}

function pushMsg(kind, payload) {
  const scroll = $("chat-scroll");
  $("chat-empty")?.remove();
  const div = document.createElement("div");
  div.className = `msg ${kind}${payload.err ? " err" : ""}`;

  if (payload.err) {
    div.textContent = payload.text;
    scroll.appendChild(div);
    scrollChat();
    return div;
  }

  if (payload.text) div.textContent = payload.text;

  if (payload.compaction && payload.compaction.turns > 0) {
    const c = document.createElement("div");
    c.className = "msg-compaction";
    c.textContent = `已压缩 ${payload.compaction.turns} 条早前消息为摘要（${payload.compaction.charsBefore} → ${payload.compaction.charsAfter} 字符）`;
    div.appendChild(c);
  }

  if (Array.isArray(payload.trace) && payload.trace.length) {
    const head = document.createElement("div");
    head.className = "msg-trace-head";
    head.textContent = `工具轨迹 · ${payload.trace.length} 次`;
    div.appendChild(head);
    payload.trace.forEach((t, i) => {
      const line = document.createElement("div");
      line.className = t.ok ? "trace-line" : "trace-line trace-bad";
      const argsPreview = t.args && Object.keys(t.args).length ? JSON.stringify(t.args).slice(0, 90) : "";
      line.textContent = `${i + 1}. ${t.name} ${t.ok ? "完成" : "失败"} ${t.durationMs}ms${argsPreview ? ` — ${argsPreview}` : ""}`;
      div.appendChild(line);
    });
  }

  CupboxModels.drawMedia(div,payload.media);
  CupboxModels.renderTasks(div,payload.tasks);
  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.textContent = payload.time || chatTime();
  div.appendChild(meta);

  scroll.appendChild(div);
  scrollChat();
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
    const row = document.createElement("div");
    row.className = "lt-row running";
    const args = ev.call.args && Object.keys(ev.call.args).length ? JSON.stringify(ev.call.args).slice(0, 90) : "";
    const label = document.createElement("span"); label.className = "lt-name"; label.textContent = ev.call.name;
    const detail = document.createElement("span"); detail.className = "lt-args"; detail.textContent = args;
    const status = document.createElement("span"); status.className = "lt-status"; status.textContent = "执行中…";
    row.append(label, detail, status);
    rows.appendChild(row);
    const list = liveTrace.pending.get(ev.call.name) || [];
    list.push(row); liveTrace.pending.set(ev.call.name, list);
    rows.parentElement.classList.add("active");
    scrollChat();
  } else if (ev.phase === "done" && ev.item) {
    const list = liveTrace.pending.get(ev.item.name);
    const row = list && list.shift();
    if (row) {
      row.classList.remove("running");
      row.classList.add(ev.item.ok ? "ok" : "bad");
      const st = row.querySelector(".lt-status");
      if (st) st.textContent = ev.item.ok ? `完成 · ${ev.item.durationMs}ms` : `失败 · ${ev.item.durationMs}ms`;
      if (!ev.item.ok) {
        const err = document.createElement("div"); err.className = "lt-error"; err.textContent = String(ev.item.result || "").slice(0, 300);
        row.appendChild(err);
      }
    }
    scrollChat();
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
      ...selection,
    });
    typing.remove();
    stopLiveTrace(true);
    if (r && r.ok) {
      sessionId = r.sessionId;
      pushMsg("assistant", {
        text: r.result && typeof r.result.text === "string" ? r.result.text : "（空回复）",
        trace: r.result ? r.result.trace : null,
        tasks:r.result?.tasks,media:r.result?.media,
        compaction: r.result?.compaction,
        time: `${chatTime()} · ${Math.round(performance.now() - t0)} ms`,
      });
      $("chat-title").textContent = r.title || "会话";
      CupboxModels.finished(true);
      await refreshSessions(sessionId);
    } else {
      CupboxModels.failed(r?.error||"请求失败");
      userMessage.remove();
      ta.value = text;
      pushMsg("assistant", { text: (r && r.error) || "请求失败", err: true });
    }
  } catch (e) {
    CupboxModels.failed(e.message||String(e));
    userMessage.remove();
    ta.value = text;
    typing.remove();
    pushMsg("assistant", { text: String((e && e.message) || e), err: true });
  } finally {
    sending = false;
    offTool?.();
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
  let list = [];
  try { list = (await api.sessionsList?.()) || []; } catch { list = []; }
  const box = $("sess-list");
  box.innerHTML = "";
  if (!list.length) {
    const div = document.createElement("div");
    div.className = "sess-empty";
    div.textContent = "从一个小任务开始。\n你的对话会自动出现在这里。";
    div.style.whiteSpace = "pre-line";
    box.appendChild(div);
    return;
  }
  list = list.filter(s => s.title.toLowerCase().includes(sessionFilter.toLowerCase()));
  if (!list.length) box.innerHTML = '<div class="sess-empty">没有找到匹配的任务</div>';
  list.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "sess-item" + (s.id === activeId ? " active" : "");
    item.style.setProperty("--i", String(i));
    item.title = s.title;

    const title = document.createElement("div");
    title.className = "s-title";
    title.textContent = s.title;

    const meta = document.createElement("div");
    meta.className = "s-meta";
    const mode = document.createElement("span");
    mode.className = "s-mode";
    mode.textContent = s.mode === "agent" ? "agent" : "ask";
    const when = document.createElement("span");
    when.textContent = `${relTime(s.updatedAt)} · ${Math.max(0, Math.round((s.count || 0) / 2))} 轮`;
    meta.appendChild(mode);
    meta.appendChild(when);

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
      } catch { /* 忽略 */ }
    });

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(del);
    item.addEventListener("click", () => openSession(s.id));
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.addEventListener("keydown", e => { if (e.target === item && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); void openSession(s.id); } });
    box.appendChild(item);
  });
}

function clearChatDom() {
  const scroll = $("chat-scroll");
  scroll.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "chat-empty";
  empty.id = "chat-empty";
  empty.innerHTML = `<div class="welcome-kicker">A LITTLE HELP, A LOVELY DAY</div>
    <div class="welcome-art"><img src="assets/sakura-companion.png" alt="樱花晴空下，银发猫耳女孩与白猫在桌边陪伴你" /><div class="hero-copy"><span>CUPBOX · 樱晴</span><h1>把琐事交给我，<br>把时间留给喜欢的事。</h1><p>你的每一个小想法，都可以从这里开始。</p></div></div>
    <div class="ce-title">今天，想一起完成什么？</div><div class="ce-sub">整理文件、处理数据，或只是聊聊你的新想法。</div>
    <div class="quick-heading"><span>从这里轻松开始</span><button class="ghost-btn" data-open-tools>查看全部工具 ↗</button></div>
    <div class="quick-grid"><button class="quick-card" data-quick="organize"><span class="quick-icon">⌑</span><span><b>给文件安个家</b><small>按类型整理，先预览再操作</small></span></button><button class="quick-card" data-quick="codec"><span class="quick-icon">{ }</span><span><b>整理一段 JSON</b><small>格式化、编码与文本转换</small></span></button><button class="quick-card" data-quick="ocr"><span class="quick-icon">▤</span><span><b>读出图片里的文字</b><small>提取文字，少一点手动输入</small></span></button></div>
    <button class="setup-link" id="setup-link"><span>✧ 配置你的 AI 搭子，开始第一段对话</span><span>去设置 →</span></button>`;
  scroll.appendChild(empty);
  empty.querySelectorAll("[data-quick]").forEach(b => {
    b.querySelector('.quick-icon').innerHTML = CupboxIcons.html(b.dataset.quick);
    b.addEventListener("click", () => {
    const tool = visibleTools().find(t => t.id === b.dataset.quick);
    if (!tool) { toast("这项工具已关闭，可在设置中启用"); return; }
    selectTool(tool.id, true); openDrawer();
    });
  });
  empty.querySelector("[data-open-tools]").addEventListener("click", ()=>{CupboxToolWorkspace.library();openDrawer();});
  empty.querySelector("#setup-link").addEventListener("click", () => openModal("api"));
  empty.querySelector("#setup-link").hidden = modelReady;
}

async function newChat() {
  if (sending) { toast("任务进行中，请等待回复后再新建"); return; }
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
  if(drawerOpen)closeDrawer();
  try {
    const s = await api.sessionsRead?.(id);
    if (!s) return;
    sessionId = s.id;
    $("chat-title").textContent = s.title || "会话";
    setMode(s.mode, false);
    CupboxModels.clearImages();$("workflow-board").hidden=true;
    clearChatDom();
    const scroll = $("chat-scroll");
    $("chat-empty")?.remove();
    (s.messages || []).forEach((m) => {
      if (m.role === "user") pushMsg("user", { text: m.text, time: "" });
      else if (m.role === "assistant") pushMsg("assistant", { text: m.text, trace: m.trace, tasks:m.tasks,media:m.media,time: "" });
    });
    // pushMsg 里 time 为空则不显示 meta —— 统一补一次时间即可（此处省略）
    await refreshSessions(s.id);
    scrollChat();
  } catch { /* 损坏文件忽略 */ }
}

/* ---------------- 设置弹窗 ---------------- */

function openModal(tab) {
  if (!modalOpen) restoreFocus = document.activeElement;
  const scrim = $("modal-scrim");
  const m = $("settings-modal");
  scrim.hidden = false;
  m.hidden = false;
  requestAnimationFrame(() => {
    scrim.classList.add("open");
    m.classList.add("open");
    m.querySelector("button")?.focus();
  });
  modalOpen = true;
  if (tab) switchTab(tab);
  if (tab === "api" || !tab) void fillApiForm();
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

function switchTab(name) {
  document.querySelectorAll("#modal-tabs .tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
    b.setAttribute("aria-selected", String(b.dataset.tab === name));
  });
  ["api", "models", "theme", "execution", "startup", "plugins", "about"].forEach((n) => {
    const page = $(`tab-${n}`);
    if (page) page.hidden = n !== name;
  });
}

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
    set("api-key", ""); // 永不回填明文 Key，留空 = 保持不变
    set("api-temp", c.temperature);
    set("api-turns", c.maxTurns);
  } catch { /* 读取失败保持占位 */ }
  // 储存管理：显示数据目录（v1.0.2 起默认 文档/Cupbox）
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

async function pickWorkspace() {
  if(prefs.executionEnvironment!=='native'){openModal('execution');return;}
  try {
    const p = await api.pickWorkspace?.();
    const el = $("ws-path");
    if (el) el.textContent = p || prefs.workspace || "未选择";
    if (p) prefs.workspace = p;
  } catch { /* 用户取消忽略 */ }
}

/* ---------------- 版本检测与更新公告 ---------------- */

function toast(msg, ms) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  void t.offsetWidth;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => { t.hidden = true; }, 320);
  }, ms || 2600);
}

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
  CupboxProviders.init();
  CupboxToolWorkspace.init({tools:visibleTools,select:selectTool,current:()=>current.id,busy:()=>toolRunning,toast,native:()=>{void savePrefs({executionEnvironment:'native'});CupboxExecution.sync(prefs);}});
  bindWindowControls();

  // 偏好（主题 / 强调色 / 模式 / 工作区 / 插件开关）
  try {
    const p = await api.prefsGet?.();
    if (p && typeof p === "object") prefs = { ...prefs, ...p };
  } catch { /* 用默认 */ }
  applyTheme(prefs.theme || "light", prefs.accent || "aurora");
  CupboxTheme.init({ getPrefs: () => prefs, save: savePrefs, theme: applyTheme, pick: () => api.pickWallpaper() });
  CupboxStartup.init({getPrefs:()=>prefs,save:savePrefs,pick:()=>api.pickStartupMedia()});
  await CupboxExecution.init({getPrefs:()=>prefs,save:savePrefs,settings:openModal,toolName:id=>TOOLS.find(t=>t.id===id)?.name||id,toast,onChange:(environment,root)=>{
    $("ws-path").textContent=environment==='sandbox'?'沙箱工作目录':prefs.workspace||'未选择';
    CupboxToolWorkspace.availability(current.id);
    for(const id of ['dir','root','cwd']){const field=$("tool-form").querySelector(`[data-key="${id}"]`);if(field)field.value=environment==='sandbox'?root:(prefs.workspace||'');}
  }});
  const startup = CupboxStartup.play(prefs);
  setMode(prefs.mode || "ask", false);
  const wsEl = $("ws-path");
  if (wsEl) wsEl.textContent = prefs.executionEnvironment==='native'?(prefs.workspace||"未选择"):'沙箱工作目录';

  renderDrawerTools();
  renderPlugins();
  if (visibleTools()[0]) selectTool(visibleTools()[0].id, true);
  $("btn-run").disabled = !visibleTools().length;
  clearChatDom();
  await CupboxModels.init({prefs,save:savePrefs,refresh:refreshModel,toast,confirm:confirmAction,session:()=>sessionId,retry:task=>sendChat({retry:task})});
  await refreshModel();
  $("btn-send").disabled = true;
  await refreshSessions(null);

  // 顶部信息
  try {
    const info = await api.info();
    $("ver-chip").textContent = `v${info.version}`;
    $("startup-display-version").textContent = `v${info.version}`;
    $("engine-chip").textContent = `${info.tools ?? 18} 工具 · Electron ${info.electron} · Node ${info.node}`;
    document.querySelectorAll('.nav-count').forEach((el) => { el.textContent = String(info.tools ?? 18); });
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
  $("btn-model").addEventListener("click", () => openModal("api"));
  // 模型管理：侧栏直达模型库（多模型增删、能力多选 文本/视觉/绘图…）
  $("btn-models-nav")?.addEventListener("click", () => openModal("models"));
  // 储存管理：打开 / 定位数据目录
  $("storage-open")?.addEventListener("click", () => void api.storageOpen?.());
  $("storage-reveal")?.addEventListener("click", () => void api.storageReveal?.());
  $("tool-form")?.addEventListener("submit", (e) => { e.preventDefault(); run(); });

  $("btn-drawer")?.addEventListener("click", ()=>{CupboxToolWorkspace.library();openDrawer();});
  $("drawer-close")?.addEventListener("click", closeDrawer);
  $("drawer-scrim")?.addEventListener("click", closeDrawer);

  $("btn-settings")?.addEventListener("click", () => openModal());
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
      try { await api.sessionsClear?.(sessionId); } catch { /* 忽略 */ }
    }
    clearChatDom();
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

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); if (!modalOpen && !drawerOpen && !updOpen && !ctxOpen) void newChat(); }
    const overlay = modalOpen ? $("settings-modal") : updOpen ? $("upd-modal") : ctxOpen ? $("ctx-modal") : null;
    if (overlay && e.key === "Tab") {
      const focusable = [...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    }
    if (e.key === "Escape") {
      if (modalOpen) closeModal();
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
  window.cupboxReady = true;
}

async function refreshModel() {
  try {
    await CupboxModels.refresh();
    const r = await api.aiConfigGet?.();
    const c = r?.ok ? r.config : {};
    modelReady = Boolean(c?.model) || (await api.modelsList()).some(m=>m.enabled);
    $("btn-model").textContent = c?.model || (modelReady?"模型库已就绪 ⌄":"配置模型 ⌄");
    if ($("setup-link")) $("setup-link").hidden = modelReady;
  } catch { modelReady = false; }
}

function confirmAction(message) {
  confirmAction.cancel?.();
  return new Promise(resolve => {
    const bar = document.createElement("div");
    bar.className = "confirm-bar";
    bar.setAttribute("role", "alert");
    const text = document.createElement("span"); text.textContent = message;
    const yes = document.createElement("button"); yes.textContent = "确认";
    const no = document.createElement("button"); no.textContent = "取消";
    const finish = value => { bar.remove(); confirmAction.cancel = null; resolve(value); };
    confirmAction.cancel = () => finish(false);
    yes.addEventListener("click", () => finish(true));
    no.addEventListener("click", () => finish(false));
    bar.append(text, yes, no);
    $("stage").insertBefore(bar, $("chat-scroll"));
    no.focus();
  });
}

boot();
