# 更新日志

本文件记录本项目所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh/1.1.0/)，
版本号遵循 [语义化版本规范](https://semver.org/lang/zh-CN/)。

> 📖 **English (optional): [CHANGELOG.en.md](./CHANGELOG.en.md)**

## [1.0.2] - 2026-10-20

### Windows 安装版

- 新增完整离线安装包、中文品牌欢迎页、樱花深浅色引导图片、步骤提示与快速上手介绍。
- 可选安装位置、开始菜单及桌面快捷方式；支持覆盖安装和卸载，保留用户对话与配置，不添加开机自启。
- 新增 `npm run pack:installer` 与 SHA256 校验输出，独立暂存构建，不再清空整个 release。版本保持 1.0.2。
- 安装说明与代码签名现状见 docs/WINDOWS-INSTALLER.md。

### 免费模型、对话选择与思考深度

- 补齐免费目录刷新、总开关与逐模型开关、最小连接检测、用于对话入口；不可用通道不放行，关闭时不自动换服务。
- 输入框模型按钮改为可搜索的分组菜单，直接切换模型；新增模型感知的思考深度滑块与逐模型记忆，保存并恢复会话选择。
- 深度实际映射 OpenAI / DeepSeek / OpenRouter 参数；未知型号保留默认或显式指定适配。免费请求不沿用付费密钥，取消信号传入网络层。
- 交互参考 dsh-codex-effort-slider，独立适配现有桌面界面；保留减少动态效果，版本仍为 1.0.2。说明见 docs/CHAT-MODELS-AND-EFFORT.md。

### 功能插画与图标动效

- 新增四张透明功能插画，用于首页快捷入口、工具分类、搜索空状态与模型协作引导。
- 设置、通知、文件夹、工具、搜索等图标响应悬停与键盘聚焦；复制成功显示短暂勾选，子任务图标对应真实运行状态。
- 支持系统减少动态效果，保留文字反馈；不引入网络图标或动画依赖。
- 资源与最终提示词见 docs/FEATURE-VISUALS.md。

### 界面与风险交互

- 重做默认启动开场，新增樱花晴窗插画，保留本地自定义素材与减少动态效果支持。
- 新增分级通知卡片和通知中心；错误手动关闭，提示可回看。
- 风险窗口优先展示后果、目标和目录，高风险需勾选确认；完全控制与本机环境切换增加事前说明。
- 统一设置页层级、字号、卡片和按压反馈；开发工具增加中文字段及空状态，命令工具纠正过期白名单表单。
- 详见 docs/UI-EXPERIENCE.md，包含素材来源及最终提示词。

### 开发工具能力补全

- 桌面 Agent 新增 36 项开发工具接口，覆盖分页文件读写/补丁/备份回滚、HTTP、diff/grep/replace、真实持久 ConPTY、进程/端口、图片处理、Git、项目脚本/测试解析、项目记忆/待办、上下文归因与图片剪贴板。
- 破坏性文件修改默认预览，使用参数与快照绑定的一次性令牌提交；拒绝路径及 junction 越界。
- 项目策略提案不自动信任，Shell 和终端输入即使完全控制也必须人工批准；域名授权与 DNS 地址固定阻止 SSRF。
- 新增“开发与授权”操作界面、结构化结果、预览执行按钮与策略编辑。大段工具结果压缩时仍保留有效 JSON 和令牌。
- 详见 docs/WORKBENCH.md（含安全收敛与边界）。

### 回复、评价与场景工作流

- 复用 Marked 和 DOMPurify 渲染 Markdown，新增正文、Markdown 与代码块复制；工具轨迹折叠、文件工具中文名称。
- 新增有帮助 / 不准确评价，影响后续参考与历史过滤；明确确认后保存长期记忆，支持修改和移除，差评撤销对应已存记忆并重建摘要。
- 新增任务场景、自动流程选择、依赖调度、上游交付传递、失败阻断与可选验收 / 一次修正。
- 复用官方 MCP Filesystem 的 10 项文件能力，执行模式下子项目独立目录落盘，协调模型整合；写入继续使用批准机制。便携打包包含完整生产依赖。
- 详见 docs/RESPONSES-AND-WORKFLOWS.md。

### 上下文洞察（能力方向致敬 [dsh-context](https://github.com/bowenliang123/dsh-context)）

- 新增 `src/core/context.ts`：token 固定密度估算（中文≈1.5 字符/token、西文≈4 字符/token）、**六成分分解**（系统提示词 / 工具 Schema / 用户消息 / 注入上下文 / 助手回复 / 工具结果）、趋势点与事件的追加与裁剪、紧凑 token 展示。
- 新增 CLI `cupbox context [--text 文本] [--file 路径] [--window 128000] [--json]`：估算文本占用；不传文本时返回 **Agent 基线开销**（系统提示词 + 全部工具 Schema 合计）。
- MCP 新增 `context_stats` 工具（只读），**工具总数 20 → 21**；编排层 `TOOL_DEFS` 同步至 19。
- AI 调用开始采集**提供方上报的真实 usage**：`aiChat` 读取 Anthropic `input_tokens/output_tokens` 与 OpenAI `prompt_tokens/completion_tokens`，`aiAgent` 循环内累加并返回请求数。
- 桌面版：每轮对话把成分分解、占用趋势（含真实 in/out）、四类事件（注入 / 压缩 / 切换模型 / 切换模式）写进会话记录；对话页新增「**上下文**」按钮，弹窗展示 KPI（最近占用、累计请求、累计输入 / 输出）、六成分堆叠条、逐请求趋势柱与事件流；`CUPBOX_CONTEXT_WINDOW` 可调整窗口大小。
- 估算为启发式（≈），非精确 tokenizer 计数，仅作占用参考。

### 同版本既有更新（2026-10-19）

### 存储与模型管理

- **数据目录默认迁到系统「文档」`Documents/Cupbox`**（配置、密钥、模型库、会话、记忆全在此），旧 `~/.cupbox` 首次启动自动迁移：只复制不删除、新目录已有内容绝不覆盖、失败静默不影响启动；`CUPBOX_HOME` 仍可整体覆盖（便携/测试隔离）。
- 新增 `src/core/paths.ts` 统一解析数据目录（CLI / MCP / 桌面三形态同一语义），CLI `main` 与 MCP `startMcpServer` 启动时自动迁移。
- 设置 → 模型连接新增**「API 储存管理」卡片**：显示当前数据目录、一键打开储存文件夹、定位 `config.json`。
- 侧栏新增**「模型管理」入口**：直达模型库（多模型增删、文本 / 视觉 / 绘图 / 语音 / 视频能力多选、启用开关）。

### 工具调用可视化与对话气泡

- Agent 执行任务时**工具调用实时直播**：每次调用以卡片逐条出现（工具名、参数、执行中动画 → 完成耗时 / 失败红字与错误详情），像看现场直播；完成后由最终消息的完整工具轨迹接管。
- `aiAgent` 新增 `onToolStart` 回调（早于完成事件），主进程经 `chat:tool` IPC 推送到渲染进程（phase=start/done），`runId` 过滤防串台。
- **AI 回复改为气泡样式**：卡片底色 + 左下尖角 + 标识头，与用户气泡对偶；带入场动画，错误气泡红色描边。

### 三层记忆与上下文压缩（架构参考 [dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon)）

- 新增 `src/core/memory.ts`：运行时记忆（用户画像 / 协作约定，常驻注入 system prompt）、长期事实（`facts.jsonl` 追加式存储，中文二元组 + 拉丁词相关性召回）、会话摘要三层。
- 新增上下文压缩：历史超过预算（默认 24000 字符）时，旧轮次由模型浓缩为 ≤400 字摘要，只保留最近 8 条原文；摘要并入 system prompt 持续生效。无 AI 配置时降级为纯截断，绝不阻塞对话。
- CLI 新增 `cupbox memory add|search|list|stats|forget|user|collab` 子命令。
- MCP 新增 `memory_remember` / `memory_recall` / `memory_manage` / `memory_profile` 四个工具，**工具总数 16 → 20**；编排层 `TOOL_DEFS` 同步至 18（桌面 Agent 可直接调用记忆工具跨会话记事）。
- 桌面版 `chat:send` 每次对话自动注入相关记忆；触发压缩时对话框显示「已压缩 N 条早前消息为摘要」提示条。
- 修复 `cupbox memory add <文本> --source <标签>` 时标签值被误并入文本的解析问题。

### 多模型与项目工作流

- 新增独立模型库与文本、视觉、绘图、语音、视频能力路由，多模型工作默认关闭。
- 新增直接处理、顺序制作、并行大项目与审阅工作流；可指定参与项目制作的文本模型，分栏查看子项目真实进度。
- 新增参考图片、媒体本地保存、子项目复制与失败重试、停止请求、Markdown 导出及草稿恢复。
- 修正窗口最小化定位并新增 Ctrl+M。视频目前适配硅基流动协议。详见 docs/DESKTOP-MODELS.md。

### 模型连接与工具执行

- 新增硅基流动、DeepSeek、GPT、Claude、OpenRouter、Ollama、LM Studio 和自定义服务预设，支持获取模型列表与连接测试，更换服务或地址不复用旧密钥。
- 新增请求批准、智能批准、完全控制，以及文件沙箱 / 本机运行。手动工具和桌面 Agent 共用批准与执行边界。
- 本地工具改为独立工作区，提供分类卡片、搜索、路径选择器、示例、输入与结果保留，以及结构化结果列表和表格。

### 桌面外观与启动体验

- 新增可配置启动动画：光轨启程、风景开场、极简呼吸，以及本地 GIF、MP4、WebM 或图片素材；支持预览、开关、时长、文案、跳过和减少动态效果。
- 扩展为 8 款内置主题：樱晴、绽放、月湖、花庭、极光、沙丘、水墨和纯色；新增分类筛选与配套界面色调，保留自定义背景。
- 重新设计几何折叠盒 Logo，同步 SVG、PNG、ICO 与桌面窗口标识。
- 统一 CLI、桌面和便携包版本号为 1.0.2。

### 测试

- 用例 198 → **331** 全绿，新增 12 个测试文件（freemodel、context、memory、paths、workbench、execution、model-workflow、chat-choice、workflow-scenes、response-context、filesystem-tools、workbench-http）。

## [1.0.1] - 2026-10-18

自 1.0.0 以来的全部演进（首次公开发行版）。主题合并自开发期的 1.1.0–1.6.0 里程碑。

### 新增 —— AI 工具箱（对标 opencode / Codex）

- `src/core/ai.ts`：双协议适配（OpenAI 兼容 `/chat/completions` 与 Anthropic `/messages`）、统一消息模型、超时与结构化错误（未配置 Key 返回中文配置指引，绝不发起请求）。
- `src/core/toolkit.ts`：14 个本地工具的统一编排层（`TOOL_DEFS` JSON Schema + `runTool()`），CLI / MCP / 桌面共用同一套引擎语义。
- 子命令 `cupbox ai ask | agent | config`；配置读写 `~/.cupbox/config.json`（0600，密钥打码），环境变量 `CUPBOX_AI_*` 优先。
- MCP 新增 `ai_ask`（只读）与 `ai_agent`（破坏性标注，返回工具轨迹），工具总数 **14 → 16**；Agent 默认 8 轮、上限 10 轮，内部 `rename` / `organize` **强制 dry-run**、`run` 仍必须白名单——**AI 不获得超出人类使用时的任何权限**。

### 新增 —— 可视化桌面版（阶段 1/3）

- 本地 Electron 便携应用：主进程直调 `dist/core` 的 14 个引擎 + 沙箱 preload + 纯静态 UI（无构建步骤、离线可用）；打包器产出 `release/Cupbox可视化/Cupbox可视化.exe`（约 236 MB）。
- **图片像素混淆 `obfuscate`（第 14 项工具）**：六模式（gilbert / b / c / c2 / pe1 / pe2），引擎移植自「番茄图片混淆 桌面版」（[MIT License, Copyright (c) 2026 3450892121](https://github.com/3450892121)）并**逐字节对拍一致**，14 组兼容金标长期保留在测试中。

### 新增 —— 对话工作台布局

- **会话侧栏**：新建会话、历史列表（`~/.cupbox/sessions/` 持久化、ID 白名单防穿越、删除 / 清空）、工作区目录选择（对话注入工作区上下文）。
- **对话主区**：问一问 / Agent 分段切换并落盘；多轮历史随请求携带；工具轨迹卡片；Enter 发送、打字指示与进场动效。
- **工具箱抽屉**：16 工具表单折叠进右侧抽屉，分组选择 + 转场动画，Esc / 遮罩收起。
- **设置弹窗四页签**：**API 设置**（脱敏回填）、**主题**（深色 / 浅色 / 跟随系统 × 极光 / 薄荷 / 琥珀 / 玫瑰，23 处强调色令牌 `color-mix()` 派生）、**插件管理**（开关同时作用于工具箱与 Agent 工具集）、**关于更新**（版本信息 + 检查 GitHub 仓库新版本 + 仓库 / Releases / CHANGELOG 快捷入口）。
- 新增 IPC 桥（prefs / sessions / ws:pick / chat:send / update / open:external）；**AI 调用成功才落盘**，失败不污染历史。

### 新增 —— 版本检测与更新公告

- `src/core/update.ts` 三级数据源：`CUPBOX_UPDATE_URL` 自定义清单 → **GitHub Releases** → npm registry（校验包名与仓库归属，防撞名误报）；语义化比较（容忍 `v` 前缀、预发布低于正式版）；永不抛错；`CUPBOX_UPDATE_DISABLE=1` 零请求关闭。
- CLI `cupbox update [--json]`（失败退出码 1）；桌面顶栏「vX.Y.Z 可用」呼吸徽标 + 点版本号手动检查；**更新公告弹窗**（版本对比、Release 说明、前往 GitHub 下载 / 查看更新日志 / 稍后提醒，每版本自动一次、静默后徽标可再进）；外链统一 https 白名单 IPC；主进程 5 分钟缓存；toast 轻提示组件。

### 变更 —— 液态玻璃视觉系统

- **开启动画**（logo 描边 + 字母级联 + 流光进度条，可跳过、尊重减弱动效）；玻璃面板（Chromium 支持时 SVG 位移场真折射，否则纯模糊）；三团极光光斑 + 噪点氛围；侧栏指示球、流光扫过、换场转场、聚焦辉光、错误抖动等交互动效；iOS 风格开关；无系统标题栏 + 自绘窗口控制 + Windows 11 亚克力。纯前端实现，**零新增依赖**。

### 安全

- MCP `run_command` **默认拒绝**（必须 `allowPrefixes` 或 `CUPBOX_RUN_ALLOW`）+ 白名单模式 shell 注入拦截（带引号状态机扫描元字符）。
- zip 解压双重预检（zip-slip 路径穿越拒绝 + 覆盖已有文件拒绝）；PNG 解压炸弹防护（IHDR 尺寸上限 8000 万像素）；进程 kill 需 PID **与** 进程名双匹配。

### 修复

- 换肤脚本保护 `:root` 令牌时吞掉分号，`--accent` / `--accent-2` / `--ok` 整块失效导致强调色渐变不渲染——已补回。
- `.tab-page { display: flex }` 压过 UA `[hidden]` 规则导致设置页签叠显——增补 `.tab-page[hidden] { display: none; }`。

### 测试

- 用例 **176 → 197** 全绿：obfuscate 68 项链路 + 14 组金标、`test/ai.test.ts` 配置与编排安全、`test/update.test.ts` 11 项（版本比较、data: 清单、关闭零请求、GitHub/npm 回退、仓库不匹配拒报、全败兜底）。

[1.0.1]: https://github.com/beizilaoshi/cupbox/releases/tag/v1.0.1

## [1.0.0] - 2026-10-17

首个稳定版本。项目由 `chorebox` 更名为 `cupbox`。

### 新增

- **CLI + MCP 双形态** —— 13 项工具既可用 `cupbox <命令>` 在终端使用，也可作为 MCP 工具供 Claude Desktop / Cursor / Cline 调用。
- 文件杂活：`organize`（按类型/日期/正则整理）、`rename`（模板/正则批量重命名，重名安全）、`search`（文件名+内容搜索，跳过 `node_modules`）。
- 数据杂活：`hash`（md5/sha1/sha256/sha512）、`time`（秒/毫秒自动识别、ISO、北京时间、相对时间）、`codec`（base64/URL/HTML/JSON）、`csv`（RFC 4180 双向转换）、`zip`（创建/解压/列清单，UTF-8 文件名）。
- 系统杂活：`ocr`（Windows 原生引擎 / tesseract，中文可用）、`clip`（剪贴板读写）、`shot`（原生截屏输出 PNG）、`run`（白名单 + 超时 + 输出截断）、`proc`（进程列出/结束，PID **与** 进程名双校验）。
- AI 安全：破坏性 MCP 工具对 AI 默认 `dryRun=true`；`CUPBOX_DISABLE_TOOLS` 环境变量可对智能体隐藏指定工具。
- 所有 CLI 命令支持 `--json` 输出。
- CI 矩阵：Windows + Ubuntu × Node 18/20/22。

[1.0.0]: https://github.com/beizilaoshi/cupbox/releases/tag/v1.0.0
