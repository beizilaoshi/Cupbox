# Cupbox 架构蓝图

> 愿景：做一个**对标 Codex、并在开放性上超越它**的可视化开发工具——
> Codex 是"单厂商引擎 + 官方界面"，我们的路线是"**多引擎可插拔 + 自有可视化驾驶舱 + 本地工具箱**"。

状态图例：✅ 已完成 · 🚧 进行中 · 📅 计划

---

## 一、三阶段路线

### 阶段 1 · 工具驾驶舱（✅ 已完成，v1.0.2）

把 cupbox 从"命令行里的 14 个杂活工具"变成"双击 exe 就能用的可视化工具"。

| 内容 | 说明 |
|---|---|
| Electron 桌面壳 | `desktop/`：main（直调 `dist/core`）+ 沙箱 preload + 纯静态仪表盘 |
| 16 工具可视化 | AI 1 + 数据 4 + 文件 4 + 图片 2 + 系统 4 + 设置 1，动态表单 + 结果面板（JSON/图片预览/AI 轨迹） |
| 同芯三形态 | CLI / MCP / 桌面壳共用**同一套** `dist/core` 实现，行为与安全边界完全一致 |
| 绿色打包 | `desktop/pack.mjs` → `release/Cupbox可视化/Cupbox可视化.exe`（约 236 MB，免安装） |
| 冒烟取证 | `--smoke`：开窗 → 自动运行 hash → 自截屏 → 退出（开发态与产物双验证通过） |
| 内置 AI 引擎（v1.4.0） | `cupbox ai ask/agent/config` + MCP `ai_ask`/`ai_agent`（工具 14 → 16）+ 桌面「设置」页；OpenAI 兼容 / Anthropic 双协议直连，Agent 内 `rename`/`organize` 强制 dry-run、`run` 仍须白名单 |

### 阶段 2 · ACP 多引擎接入（📅 把 Codex/Claude/Gemini 装进驾驶舱）

目标：在自己的界面里跑真 agent——"实现 Codex"的那一步。

| 缝合对象 | 作用 |
|---|---|
| `@agentclientprotocol/sdk` | ACP（Agent Client Protocol）标准：编辑器/界面 ↔ agent 的通用协议，Zed、JetBrains 生态在用 |
| `@agentclientprotocol/codex-acp` | 官方 Codex 的 ACP 桥——**不写一行 Codex 代码即可驱动 Codex** |
| claude / gemini / DSH 的 ACP 适配 | 同协议接入多家引擎，引擎可插拔 = 相对 Codex 的差异化 |
| `@openai/codex-sdk` | 官方 TS SDK，作为直连后端的备选通道 |

设计草案：
- `desktop/` 增加 `engines/` 层：每个引擎 = 一个 ACP client（stdio 起子进程）。
- UI 增加"会话"页：对话流（思考块/工具卡片）、引擎选择器、每会话独立 runtime。
- 工具箱与 agent 打通：14 个 cupbox 工具注册为 agent 可调用的本地工具（agent 的"手"）。

### 阶段 3 · 超越 Codex 的差异化（📅 技能、调度、多会话）

| 缝合对象 | 借鉴点 |
|---|---|
| `skills`（Vercel Labs，MIT） | 开放技能生态：`npx skills add owner/repo` 装 SKILL.md，兼容 75+ agent → 做成技能市场页 |
| `shraga` | 会话 fork/resume、双向 MCP、cron 调度 + 事件总线、推送、多用户 |
| `pi-web-ui` | 会话功能清单：steer 插队、并发会话、fork 重问、压缩卡片可见、斜杠命令、提示模板、自动重试 |
| `@visulima/tui` / `tokenjuice` | 若保留终端形态：Rust diff 渲染、终端输出压缩 |

---

## 二、当前架构（阶段 1）

```
                    ┌──────────────────────────────────────┐
   ┌──────────┐     │  cupbox 三形态（同一引擎、同一安全边界） │     ┌──────────────┐
   │ cupbox   │     │                                      │     │  MCP 客户端   │
   │ <命令>   │────▶│  src/index.ts (CLI 分发)             │     │  Claude 等    │
   └──────────┘     │  src/mcp.ts   (20 工具注册+guard)    │◀────└──────────────┘
                    │  desktop/main.js (IPC+AI/设置)     │
                    └───────────────┬──────────────────────┘
                                    │ 全部 import 同一批模块
                    ┌───────────────▼──────────────────────┐
                    │ dist/core（16 引擎 + AI/编排层 + 记忆 + 更新检测 + 护栏） │
                    │ hash time codec search rename        │
                    │ organize csv zip obfuscate ocr       │
                    │ clip shot run proc ai                │
                    │ memory（三层记忆 + 上下文压缩）        │
                    │ │ toolkit（双协议 AI + 18 工具编排）    │
                     │ ── 护栏：dry-run 默认 / 白名单+注入拦截 │
                    │    zip-slip 预检 / 进程双匹配 /        │
                    │    PNG 炸弹防护 / 绝不静默覆盖         │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │ util: platform / fsutil / ps         │
                    └──────────────────────────────────────┘
```

### 记忆与压缩流水线（v1.0.2，架构参考 dsh-mnemon）

```
用户消息 ──▶ chat:send
              ├─ ① compactHistory(history, budget=24000)
              │     超预算 → 旧轮次交模型浓缩 ≤400 字摘要
              │     （无配置降级为纯截断）→ summary 并入 system
              │     桌面提示条「已压缩 N 条」
              ├─ ② memoryPromptBlock(text)
              │     user.md / memory.md 常驻注入
              │     + facts.jsonl 相关性召回 Top3
              │     （中文二元组 + 拉丁词打分）
              └─ ③ integrate(prompt, config)
                    ask  → aiChat(system + summary + memory + history + prompt)
                    agent→ aiAgent(… + memory_* 4 工具可跨会话记事)
```

记忆存储全在 `~/.cupbox/memory/`（`CUPBOX_HOME` 可重定向），追加式、可 `forget`、不上传。

### 上下文洞察流水线（v1.1.0，能力方向致敬 dsh-context）

```
chat:send 成功落盘前
  ├─ contextBreakdown({system, toolSchemas, injected, messages})
  │    六成分固定序：系统提示词 → 工具 Schema → 用户消息
  │                 → 注入上下文 → 助手回复 → 工具结果
  │    total = Σ各成分（估算 tokens），occupancy = total / window
  ├─ pushTrend(caps 200)：tokens + 提供方 usage(prompt/completion) + label
  ├─ pushEvent(caps 100)：
  │    inject  注入记忆/摘要变化（delta = token 差）
  │    compact 压缩历史（delta 为负，按 chars/4 折算）
  │    switch  模型切换；mode 工作模式切换
  └─ sess.context = ctx → writeSession（随会话持久化）

渲染进程「上下文」按钮 → api.contextStats(sessionId)
  → 主进程读会话 record + runTool('context_stats', {}) 基线
  → 弹窗渲染 KPI / 六色堆叠条 / 逐请求趋势柱 / 事件流
```

- 估算密度：中文/全角 ≈ 1.5 字符 token，西文 ≈ 4 字符 token（`src/core/context.ts`），启发式（≈）非精确计数。
- 窗口解析：显式 `--window` → 环境变量 `CUPBOX_CONTEXT_WINDOW` → 默认 128000。
- 入口三形态：CLI `cupbox context`、MCP `context_stats`（只读）、桌面洞察面板；Agent 基线（系统提示词 + 全部工具 Schema）由 toolkit 动态 import `ai.js` 计算，避免循环依赖。

目录结构：

```
cupbox/
├── src/                # TS 源码（CLI / MCP / core / util）
├── dist/               # 构建产物（三形态共用）
├── desktop/            # 可视化桌面壳
│   ├── main.js         # Electron 主进程 + 21 工具 IPC 分发（含 AI / 设置 / 上下文洞察）
│   ├── preload.cjs     # contextBridge（沙箱，最小 API 面）
│   ├── ui/             # 纯静态仪表盘（index/styles/app）
│   └── pack.mjs        # 极简打包器 → exe
├── docs/ARCHITECTURE.md
├── test/               # 271 用例（vitest）
└── release/            # 打包产物（gitignore）
```

---

## 三、GitHub 侦察结论（2026-10-18，经 npm registry 取证）

活动度（最后发版时间 = "在维护"的硬证据）：

| 项目 | npm 包 | 版本 | 最后发版 |
|---|---|---|---|
| OpenAI Codex CLI | `@openai/codex` | 0.163.0 | 2026-10-17 |
| Codex TS SDK | `@openai/codex-sdk` | 0.163.0 | 2026-10-17 |
| Codex ACP 桥 | `@agentclientprotocol/codex-acp` | 2.2.2 | 2026-10-16 |
| Google Gemini CLI | `@google/gemini-cli` | 0.64.0 | 2026-10-18 |
| Anthropic Claude Code | `@anthropic-ai/claude-code` | 2.1.302 | 2026-10-16 |
| opencode | `opencode-ai` | 1.19.3 | 2026-10-16 |
| pi-web-ui（驾驶舱参考） | `pi-web-ui` | 0.107.0 | 2026-10-17 |
| shraga（多人 web UI） | `shraga` | 0.1.159 | 2026-10-12 |
| skills（技能生态，MIT） | `skills` | 1.7.2 | 2026-10-09 |

侦察渠道说明：本环境 `github.com` / CDN 的 DNS 不可解析、web search 无 key，情报改经 **npm registry** 获取（包背后的仓库即 GitHub 项目，README / 版本 / 发版时间均可取证）。

---

## 四、安全边界（桌面版全部继承）

| 风险 | 防线 |
|---|---|
| AI/界面误执行破坏命令 | `rename`/`organize` 默认 dry-run，勾选框取消才执行 |
| 任意 shell 执行 | `run` 白名单必填（CLI 人工路径除外）+ 元字符注入拦截 |
| zip-slip / 静默覆盖 | 解压前条目预检 + 覆盖冲突拒绝 |
| 误杀进程 | kill 需 PID + 进程名双匹配 |
| PNG 解压炸弹 | IHDR 尺寸预检（默认 8000 万像素上限） |
| 文件覆盖 | 重名自动 ` (1)`，绝不静默覆盖 |

---

## 五、环境约束与踩坑记录

- **网络**：`github.com`、jsDelivr DNS 不可解析；web search 缺 key。可用通道 = npm registry + npmmirror 镜像（Electron 运行时走 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/`）。
- **ELECTRON_RUN_AS_NODE=1**：宿主环境预置了该变量，会把 Electron 降级为纯 Node（无窗口）。运行/冒烟前必须先 `Remove-Item Env:ELECTRON_RUN_AS_NODE`（开发与产物同样中招过一次）。
- **electron 安装**：npm postinstall 未落盘时，手动 `node node_modules/electron/install.js`（同镜像变量）即可补救。
- **打包思路来源**：参考项目（番茄图片混淆 桌面版，MIT）的 pack 流程——运行时整树复制 + `resources/app` + exe 改名；本项目独立重写为 `desktop/pack.mjs`。
- **发布**：`E:\测试` 当前无 `.git`（历史丢失），推送前需 `git init` 重新首提交。

---

## 六、里程碑验收

- [x] 阶段 1：exe 双击可用、14 工具全通、安全默认生效、开发态与产物截图取证一致
- [x] v1.4.0：内置 AI 引擎上线（`ai ask/agent/config`、MCP 16 工具、桌面设置页、液态玻璃 UI）
- [x] v1.0.0：桌面版重构为对话工作台（会话侧栏 / 工作区 / 工具抽屉 / 设置页签：API·主题·插件 / 深浅主题与强调色令牌化）
- [x] v1.0.1：版本检测与更新公告（`core/update.ts` 三级数据源 · CLI `cupbox update` · 设置「关于更新」页检查 GitHub 仓库 · 桌面徽标 + 公告窗 + https 白名单外链 · `CUPBOX_UPDATE_DISABLE`）
- [x] 186 测试全绿、`npm audit --omit=dev` 0 运行时漏洞
- [ ] 阶段 2：ACP client 接入 ≥2 个引擎（codex-acp + 1），会话页可对话、可看 diff
- [ ] 阶段 3：技能市场页（skills）、调度页（cron）、多会话并发
