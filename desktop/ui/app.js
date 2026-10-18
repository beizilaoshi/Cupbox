// Cupbox AI 工作台 —— 渲染层（会话 / 工具抽屉 / 设置弹窗；纯静态、无外部依赖）
"use strict";

/* ---------------- 本地工具表（原主界面已折叠进「工具箱」抽屉） ---------------- */

const TOOLS = [
  { id: "hash", icon: "#️⃣", name: "哈希计算", group: "数据", hint: "md5 / sha1 / sha256 / sha512。文本与文件二选一。",
    fields: [
      { k: "text", label: "文本", type: "text", ph: "hello world" },
      { k: "file", label: "或：文件路径", type: "text", ph: "C:/path/file.txt" },
      { k: "algo", label: "算法（逗号分隔）", type: "text", value: "sha256" },
    ] },
  { id: "time", icon: "🕒", name: "时间转换", group: "数据", hint: "秒/毫秒时间戳或日期字符串 → ISO / UTC / 北京时间 / 相对时间。",
    fields: [
      { k: "input", label: "时间戳或日期（留空 = 当前时间）", type: "text", ph: "1718000000 或 2026-10-18 10:00" },
    ] },
  { id: "codec", icon: "🔐", name: "编解码", group: "数据", hint: "base64 / URL / HTML / JSON 互转，带合法性校验。",
    fields: [
      { k: "op", label: "操作", type: "select", options: ["b64e", "b64d", "urle", "urlde", "html-esc", "html-unesc", "json", "json-min"], value: "b64e" },
      { k: "text", label: "文本", type: "textarea", ph: "输入内容" },
    ] },
  { id: "csv", icon: "📊", name: "CSV ↔ JSON", group: "数据", hint: "RFC 4180：引号、转行、转义全支持；自动识别常见分隔符。",
    fields: [
      { k: "to", label: "转换为", type: "select", options: ["json", "csv"], value: "json" },
      { k: "text", label: "粘贴 CSV / JSON 文本", type: "textarea", ph: "name,age\nalice,30\nbob,25" },
    ] },
  { id: "search", icon: "🔍", name: "搜索", group: "文件", hint: "文件名 + 内容双搜索；自动跳过 node_modules/.git 等噪音目录。",
    fields: [
      { k: "root", label: "目录", type: "text", ph: "E:/project" },
      { k: "pattern", label: "文件名包含", type: "text" },
      { k: "content", label: "内容包含", type: "text" },
      { k: "glob", label: "glob 过滤", type: "text", ph: "*.ts" },
      { k: "regex", label: "按正则匹配", type: "checkbox" },
    ] },
  { id: "rename", icon: "✏️", name: "批量重命名", group: "文件", warn: "破坏性工具 · 默认 dry-run 预览",
    fields: [
      { k: "dir", label: "目录", type: "text" },
      { k: "find", label: "查找", type: "text" },
      { k: "replace", label: "替换为", type: "text" },
      { k: "template", label: "或：模板（{n} 序号 {name} 原名 {date} 日期）", type: "text", ph: "{n}-{name}" },
      { k: "ext", label: "扩展名过滤", type: "text", ph: "*.jpg" },
      { k: "recursive", label: "含子目录", type: "checkbox" },
      { k: "dryRun", label: "dry-run 预览（关掉才会真正改名）", type: "checkbox", value: true },
    ] },
  { id: "organize", icon: "🗂️", name: "文件整理", group: "文件", warn: "破坏性工具 · 默认 dry-run 预览",
    fields: [
      { k: "dir", label: "目录", type: "text" },
      { k: "mode", label: "模式", type: "select", options: ["category", "date", "regex"], value: "category" },
      { k: "pattern", label: "regex 捕获组 1 = 子目录（regex 模式用）", type: "text", ph: "^(\\d{4})-" },
      { k: "recursive", label: "含子目录", type: "checkbox" },
      { k: "cleanup", label: "清理整理后空目录", type: "checkbox" },
      { k: "dryRun", label: "dry-run 预览（关掉才会移动文件）", type: "checkbox", value: true },
    ] },
  { id: "zip", icon: "🗜️", name: "压缩 / 解压", group: "文件", hint: "解压前自动预检：zip-slip 路径穿越拒绝、覆盖已有文件拒绝。",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["create", "extract", "list"], value: "create" },
      { k: "output", label: "zip 路径（create = 输出；extract / list = 输入）", type: "text" },
      { k: "sources", label: "源文件或目录（create 用，逗号分隔）", type: "text" },
      { k: "destDir", label: "解压目标目录（extract 用）", type: "text" },
    ] },
  { id: "obfuscate", icon: "🖼️", name: "图片像素混淆", group: "图片", hint: "gilbert / b / c / c2 / pe1 / pe2 六模式；与「番茄图片混淆」生态互通。",
    fields: [
      { k: "input", label: "输入 PNG 路径", type: "text" },
      { k: "mode", label: "模式", type: "select", options: ["gilbert", "b", "c", "c2", "pe1", "pe2"], value: "c" },
      { k: "key", label: "密钥（pe1/pe2 必须是 0~1 小数，如 0.666）", type: "text" },
      { k: "decrypt", label: "还原（decrypt，需与混淆时相同模式与密钥）", type: "checkbox" },
      { k: "output", label: "输出路径（留空自动命名）", type: "text" },
    ] },
  { id: "ocr", icon: "📄", name: "OCR 文字识别", group: "图片", hint: "Windows 原生 OCR（需系统语言包）或 tesseract。",
    fields: [
      { k: "imagePath", label: "图片路径", type: "text" },
      { k: "lang", label: "语言", type: "text", value: "zh-Hans" },
      { k: "engine", label: "引擎", type: "select", options: ["auto", "windows", "tesseract"], value: "auto" },
    ] },
  { id: "clip", icon: "📋", name: "剪贴板", group: "系统",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["read", "write"], value: "read" },
      { k: "text", label: "写入文本（write 时使用）", type: "textarea" },
    ] },
  { id: "shot", icon: "📸", name: "截屏", group: "系统", hint: "系统原生截屏，输出 PNG。",
    fields: [
      { k: "outputPath", label: "输出 PNG 路径（留空自动命名）", type: "text" },
    ] },
  { id: "run", icon: "⚙️", name: "受保护命令执行", group: "系统", warn: "安全默认：白名单必填 · 元字符拦截",
    fields: [
      { k: "command", label: "命令", type: "text", ph: "npm test" },
      { k: "allowPrefixes", label: "允许的前缀白名单 *必填（逗号分隔）", type: "text", ph: "npm,git status" },
      { k: "cwd", label: "工作目录（可选）", type: "text" },
      { k: "timeoutMs", label: "超时毫秒（≤ 600000）", type: "text", value: "60000" },
    ] },
  { id: "proc", icon: "🧩", name: "进程查看 / 结束", group: "系统", warn: "kill 需 PID + 进程名双匹配",
    fields: [
      { k: "action", label: "动作", type: "select", options: ["list", "kill"], value: "list" },
      { k: "query", label: "list：进程名过滤", type: "text" },
      { k: "pid", label: "kill：PID", type: "text" },
      { k: "name", label: "kill：预期进程名（必须与实际匹配）", type: "text" },
    ] },
];

const GROUP_ORDER = ["数据", "文件", "图片", "系统"];
const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const api = window.cupbox || {};
let prefs = { theme: "dark", accent: "aurora", mode: "ask", workspace: "", disabledTools: [], dismissedVersion: "" };
let current = TOOLS[0];
let toolIndex = 0;
let bootstrapped = false;
let sessionId = null;   // 当前会话（null = 尚未落盘的新会话）
let sending = false;
let drawerOpen = false;
let modalOpen = false;
let updOpen = false;    // 更新公告弹窗
let updateInfo = null;  // 最近一次检测结果（UpdateInfo）

const SMOKE = new URLSearchParams(location.search).get("smoke");
const RELEASES_URL = "https://github.com/beizilaoshi/cupbox/releases/latest";
const CHANGELOG_URL = "https://github.com/beizilaoshi/cupbox/blob/main/CHANGELOG.md";

/* ---------------- 开启动画 ---------------- */

function buildSplashLetters() {
  const box = $("splash-name");
  if (!box || box.childElementCount) return;
  "Cupbox".split("").forEach((ch, i) => {
    const s = document.createElement("span");
    s.textContent = ch;
    s.style.animationDelay = `${0.55 + i * 0.07}s`;
    box.appendChild(s);
  });
}

let revealed = false;
function reveal() {
  if (revealed) return;
  revealed = true;
  $("splash")?.classList.add("done");
  $("app")?.classList.add("revealed");
  setTimeout(() => $("splash")?.classList.add("gone"), 700);
}

function startSplashTimeline() {
  if (REDUCED) { reveal(); return; }
  setTimeout(reveal, 2600);
  $("splash")?.addEventListener("click", reveal);
  window.addEventListener("keydown", reveal, { once: true });
}

/* ---------------- 主题 / 偏好 ---------------- */

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
  });
}

async function savePrefs(patch) {
  prefs = { ...prefs, ...patch };
  try {
    const r = await api.prefsSet?.(patch);
    if (r && r.ok && r.prefs) prefs = r.prefs;
  } catch { /* 偏好写失败不阻塞界面 */ }
}

window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
  if (prefs.theme === "system") applyTheme("system", prefs.accent);
});

function setMode(mode, persist) {
  prefs.mode = mode === "agent" ? "agent" : "ask";
  document.querySelectorAll("#mode-toggle .mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === prefs.mode);
  });
  if (persist !== false) void savePrefs({ mode: prefs.mode });
}

/* ---------------- 工具抽屉 ---------------- */

function visibleTools() {
  const dis = Array.isArray(prefs.disabledTools) ? prefs.disabledTools : [];
  return TOOLS.filter((t) => !dis.includes(t.id));
}

function renderDrawerTools() {
  const box = $("drawer-tools");
  box.innerHTML = "";
  const tools = visibleTools();
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
      icon.textContent = t.icon;
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
  const scrim = $("drawer-scrim");
  const d = $("drawer");
  scrim.hidden = false;
  d.hidden = false;
  requestAnimationFrame(() => {
    scrim.classList.add("open");
    d.classList.add("open");
  });
}

function closeDrawer() {
  if (!drawerOpen) return;
  drawerOpen = false;
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
  const same = bootstrapped && TOOLS[toolIndex]?.id === id;
  if (same) return;
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
  document.querySelectorAll("#drawer-tools .tool-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === current.id);
  });
  $("tool-title").textContent = `${current.icon} ${current.name}`;
  const warn = $("tool-warn");
  warn.hidden = !current.warn;
  if (current.warn) warn.textContent = current.warn;
  const hint = $("tool-hint");
  hint.hidden = !current.hint;
  if (current.hint) hint.textContent = current.hint;
  renderForm();
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
        opt.textContent = o;
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
    wrap.appendChild(input);
    form.appendChild(wrap);
  });
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
    setStatus("❌ 失败", "chip-red");
    const div = document.createElement("div");
    div.className = "err-block";
    div.textContent = res.error;
    body.appendChild(div);
    return;
  }
  setStatus("✅ 完成", "chip-green");

  const r = res.result;
  const pre = document.createElement("div");
  pre.className = "ok-block";
  if (typeof r === "string") {
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
    img.src = "file:///" + imgPath.replace(/\\/g, "/");
    body.appendChild(img);
  }
}

/* ---------------- 工具运行 ---------------- */

async function run() {
  const btn = $("btn-run");
  const label = btn.querySelector(".btn-label");
  btn.disabled = true;
  btn.classList.add("loading");
  if (label) label.textContent = "运行中";
  setStatus("运行中…", "chip-amber");
  const t0 = performance.now();
  try {
    const res = await api.run(current.id, collect());
    renderResult(res, Math.round(performance.now() - t0));
  } catch (e) {
    renderResult({ ok: false, error: String((e && e.message) || e) }, Math.round(performance.now() - t0));
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    if (label) label.textContent = "运行";
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

  if (Array.isArray(payload.trace) && payload.trace.length) {
    const head = document.createElement("div");
    head.className = "msg-trace-head";
    head.textContent = `🔧 工具轨迹 · ${payload.trace.length} 次`;
    div.appendChild(head);
    payload.trace.forEach((t, i) => {
      const line = document.createElement("div");
      line.className = t.ok ? "trace-line" : "trace-line trace-bad";
      const argsPreview = t.args && Object.keys(t.args).length ? JSON.stringify(t.args).slice(0, 90) : "";
      line.textContent = `${i + 1}. ${t.name} ${t.ok ? "✅" : "❌"} ${t.durationMs}ms${argsPreview ? ` — ${argsPreview}` : ""}`;
      div.appendChild(line);
    });
  }

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

async function sendChat() {
  if (sending) return;
  const ta = $("chat-text");
  const text = ta.value.trim();
  if (!text) return;

  sending = true;
  const btn = $("btn-send");
  btn.disabled = true;
  btn.classList.add("loading");
  ta.value = "";
  ta.style.height = "auto";

  pushMsg("user", { text });
  const typing = showTyping();
  const t0 = performance.now();

  try {
    const r = await api.chatSend({
      text,
      sessionId,
      mode: prefs.mode,
    });
    typing.remove();
    if (r && r.ok) {
      sessionId = r.sessionId;
      pushMsg("assistant", {
        text: r.result && typeof r.result.text === "string" ? r.result.text : "（空回复）",
        trace: r.result ? r.result.trace : null,
        time: `${chatTime()} · ${Math.round(performance.now() - t0)} ms`,
      });
      $("chat-title").textContent = r.title || "会话";
      await refreshSessions(sessionId);
    } else {
      pushMsg("assistant", { text: (r && r.error) || "请求失败", err: true });
    }
  } catch (e) {
    typing.remove();
    pushMsg("assistant", { text: String((e && e.message) || e), err: true });
  } finally {
    sending = false;
    btn.disabled = false;
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
    div.textContent = "还没有会话。\n点上方「新建会话」开始，历史会自动保存在本机。";
    div.style.whiteSpace = "pre-line";
    box.appendChild(div);
    return;
  }
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
    del.textContent = "✕";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
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
    box.appendChild(item);
  });
}

function clearChatDom() {
  const scroll = $("chat-scroll");
  scroll.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "chat-empty";
  empty.id = "chat-empty";
  empty.innerHTML =
    '<div class="ce-logo" aria-hidden="true">☕</div>' +
    '<div class="ce-title">开始一个会话</div>' +
    '<div class="ce-sub">问一问 = 单次问答（带历史上下文）· Agent 模式 = 模型自主调用本地工具完成任务<br />工具在「工具箱」里 · API / 主题 / 插件在「设置」里</div>';
  scroll.appendChild(empty);
}

async function newChat() {
  sessionId = null;
  clearChatDom();
  $("chat-title").textContent = "新会话";
  await refreshSessions(null);
  $("chat-text").focus();
}

async function openSession(id) {
  try {
    const s = await api.sessionsRead?.(id);
    if (!s) return;
    sessionId = s.id;
    $("chat-title").textContent = s.title || "会话";
    setMode(s.mode, false);
    clearChatDom();
    const scroll = $("chat-scroll");
    $("chat-empty")?.remove();
    (s.messages || []).forEach((m) => {
      if (m.role === "user") pushMsg("user", { text: m.text, time: "" });
      else if (m.role === "assistant") pushMsg("assistant", { text: m.text, trace: m.trace, time: "" });
    });
    // pushMsg 里 time 为空则不显示 meta —— 统一补一次时间即可（此处省略）
    await refreshSessions(s.id);
    scrollChat();
  } catch { /* 损坏文件忽略 */ }
}

/* ---------------- 设置弹窗 ---------------- */

function openModal(tab) {
  const scrim = $("modal-scrim");
  const m = $("settings-modal");
  scrim.hidden = false;
  m.hidden = false;
  requestAnimationFrame(() => {
    scrim.classList.add("open");
    m.classList.add("open");
  });
  modalOpen = true;
  if (tab) switchTab(tab);
  if (tab === "api" || !tab) void fillApiForm();
}

function closeModal() {
  if (!modalOpen) return;
  modalOpen = false;
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
  });
  ["api", "theme", "plugins", "about"].forEach((n) => {
    const page = $(`tab-${n}`);
    if (page) page.hidden = n !== name;
  });
}

async function fillApiForm() {
  try {
    const r = await api.aiConfigGet?.();
    const c = (r && r.ok && r.config) || {};
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
      provider: raw("api-provider") || "openai-compatible",
      baseUrl: raw("api-base"),
      model: raw("api-model"),
      ...(raw("api-key") ? { apiKey: raw("api-key") } : {}),
      temperature: raw("api-temp") === "" ? null : Number(raw("api-temp")),
      maxTurns: raw("api-turns") === "" ? null : Number(raw("api-turns")),
    };
    const r = await api.aiConfigSet?.(patch);
    if (!r || !r.ok) throw new Error((r && r.error) || "保存失败");
    status.textContent = `✅ 已保存 · ${r.config.provider} · ${r.config.model || "(未配置模型)"} · Key ${r.config.apiKey ? "已配置" : "(未配置)"}`;
    status.style.color = "";
    fillApiForm();
  } catch (e) {
    status.textContent = `❌ ${String((e && e.message) || e)}`;
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
    ic.textContent = t.icon;
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
      // 当前选中工具被禁用时切到第一个可见工具
      if (!visibleTools().some((x) => x.id === current.id)) {
        const first = visibleTools()[0];
        if (first) selectTool(first.id, true);
      }
    });

    row.appendChild(ic);
    row.appendChild(txt);
    row.appendChild(sw);
    box.appendChild(row);
  });
}

/* ---------------- 工作区 ---------------- */

async function pickWorkspace() {
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
      if (!info) toast("❌ 检查更新失败（网络不可用）");
      else if (info.source === "disabled") toast("更新检查已关闭（CUPBOX_UPDATE_DISABLE=1）");
      else toast(`❌ 检查更新失败：${info.error || "未知错误"}`);
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
    // 启动自动公告：每个版本只弹一次（「稍后提醒」写入 dismissedVersion 抑制）；冒烟模式不自动弹；noAnnounce 供设置页内联展示
    if (!opts.manual && !opts.noAnnounce && !SMOKE && prefs.dismissedVersion !== info.latest) {
      setTimeout(() => {
        if (updateInfo && updateInfo.hasUpdate && prefs.dismissedVersion !== updateInfo.latest && !updOpen) {
          showUpdateAnnounce();
        }
      }, 1500);
    }
  } else {
    // 已是最新 / 数据源版本更低：强制收起徽标，防止上一次检查留下的「可用」常驻
    const chip = $("update-chip");
    if (chip) chip.hidden = true;
    if (opts.manual) {
      if (ver) {
        ver.classList.add("uptodate");
        setTimeout(() => ver.classList.remove("uptodate"), 1500);
      }
      toast(`✅ 已是最新 v${info.current}`);
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
  if (label) label.textContent = "🔍 检查 GitHub 仓库更新";
  st.textContent = "";

  box.hidden = false;
  if (!info || info.source === "none" || info.source === "disabled") {
    box.classList.add("bad");
    box.textContent = !info
      ? "❌ 检查失败（网络不可用），可稍后重试"
      : info.source === "disabled"
        ? "更新检查已关闭（CUPBOX_UPDATE_DISABLE=1）"
        : `❌ 检查失败：${info.error || "未知错误"}\n数据源不可达时会自动跳到下一源，全部不可达才报此错。`;
    return;
  }
  if (info.hasUpdate) {
    box.classList.add("has");
    box.textContent = `发现新版本 v${info.latest}（当前 v${info.current}）· 来源 ${sourceName(info.source)}\nRelease 说明与下载入口已就绪。`;
    const go = document.createElement("button");
    go.type = "button";
    go.className = "btn-ghost2";
    go.textContent = "📥 前往 GitHub 下载";
    go.addEventListener("click", () => { void api.openExternal?.(info.url || RELEASES_URL); });
    box.appendChild(go);
  } else {
    box.classList.add("ok");
    box.textContent = `✅ 已是最新版本 v${info.current}（数据源 ${sourceName(info.source)}）`;
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
  buildSplashLetters();
  bindWindowControls();
  startSplashTimeline();

  // 偏好（主题 / 强调色 / 模式 / 工作区 / 插件开关）
  try {
    const p = await api.prefsGet?.();
    if (p && typeof p === "object") prefs = { ...prefs, ...p };
  } catch { /* 用默认 */ }
  applyTheme(prefs.theme || "dark", prefs.accent || "aurora");
  setMode(prefs.mode || "ask", false);
  const wsEl = $("ws-path");
  if (wsEl) wsEl.textContent = prefs.workspace || "未选择";

  renderDrawerTools();
  selectTool("hash", true);
  await refreshSessions(null);

  // 顶部信息
  try {
    const info = await api.info();
    $("ver-chip").textContent = `v${info.version}`;
    $("engine-chip").textContent = `16 工具 · Electron ${info.electron} · Node ${info.node}`;
    const av = $("about-ver");
    if (av) av.textContent = `v${info.version}`;
  } catch { /* info 不可用忽略 */ }

  // 版本检测：静默首检 → 有新版则顶栏徽标 + 一次性更新公告
  void checkUpdate({});

  // —— 事件绑定 ——
  $("btn-run")?.addEventListener("click", run);
  $("tool-form")?.addEventListener("submit", (e) => { e.preventDefault(); run(); });

  $("btn-drawer")?.addEventListener("click", openDrawer);
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
    if (sessionId) {
      try { await api.sessionsClear?.(sessionId); } catch { /* 忽略 */ }
    }
    clearChatDom();
  });
  $("btn-workspace")?.addEventListener("click", pickWorkspace);

  const ta = $("chat-text");
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendChat();
    }
  });
  ta.addEventListener("input", () => {
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
    if (e.key === "Escape") {
      if (modalOpen) closeModal();
      else if (updOpen) closeUpdateAnnounce();
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
  }

  // 首次进入聚焦输入框
  setTimeout(() => { if (!REDUCED) $("chat-text")?.focus(); }, 2900);
}

boot();
