# 更新日志

本文件记录本项目所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh/1.1.0/)，
版本号遵循 [语义化版本规范](https://semver.org/lang/zh-CN/)。

> 📖 **English (optional): [CHANGELOG.en.md](./CHANGELOG.en.md)**

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
