# Cupbox

<p align="center">
  <img src="https://img.shields.io/npm/v/cupbox?style=for-the-badge&color=cb8a52" alt="npm version">
  <img src="https://img.shields.io/node/v/cupbox?style=for-the-badge&color=438f70" alt="Node.js">
  <img src="https://img.shields.io/github/actions/workflow/status/beizilaoshi/cupbox/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI">
  <img src="https://img.shields.io/badge/license-MIT-5279c7?style=for-the-badge" alt="MIT License">
</p>

<p align="center">
  <strong>把杂活交给 AI —— 命令行、MCP 与桌面工作台。</strong>
</p>

<p align="center">
  <img src="./desktop/ui/assets/logos/mascot-sakura.png" width="220" alt="筑梦喵抱着 Cupbox 标志">
</p>

<p align="center"><em>筑梦喵陪你把想法变成可以交付的工作。</em></p>

<p align="center">
  一个工具包，三种形态。<br>
  开发者的命令行工具箱、AI 智能体可调用的 MCP 工具集，以及带原生 AI 工作模式的桌面版。
</p>

<p align="center">
  <a href="#-为什么选择-cupbox">为什么选择</a> ·
  <a href="#-功能一览">功能一览</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-让-ai-替你干活">接入 AI</a> ·
  <a href="#-安全设计">安全设计</a> ·
  <a href="#-参与贡献">参与贡献</a> ·
  <a href="#-交流群">交流群</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cupbox">npm</a> ·
  <a href="https://github.com/beizilaoshi/cupbox">GitHub</a> ·
  <a href="https://github.com/beizilaoshi/cupbox/stargazers">⭐ 点亮 Star</a> ·
  <a href="./README.en.md">English Documentation</a>
</p>

---

## ⚠️ 许可与素材声明

- **代码与文档**：MIT 许可证，可自由使用、修改与分发。
- **全部美术与音频资源**（插画、角色立绘、服装与动作像素图、图标、界面背景、启动动画素材、表情包、背景音乐与音效等，含随安装包分发的内容）：**不在 MIT 许可范围内**，权利归项目团队所有，未经书面许可不得复制、修改、分发或用于任何衍生作品。
- **「筑梦喵」（Dream Weaving Meow）是团队 IP 形象**（含形象、名称、设定、服饰与衍生造型）：**不可复用**——无论公益或商业用途均不得使用、仿制、二次创作，或作为其他项目/产品的形象；违者将视情节追究法律责任。

完整条款见 [LICENSE](./LICENSE) 与 [素材许可说明](./docs/ASSETS-LICENSE.md)。

---

## 📦 Cupbox 是什么？

**Cupbox 是一个面向日常开发工作的轻量级工具箱。**

在开发过程中，我们总会遇到许多不大不小的杂活：

- 下载目录堆满了文件，需要按类型整理。
- 一批图片需要统一编号，或者按规则批量重命名。
- 想在项目中搜索某个关键词，却不想被依赖目录和构建产物干扰。
- 需要计算文件哈希、转换时间戳、处理 JSON 或 CSV。
- 想快速识别截图中的文字，或者压缩、解压一个文件夹。
- 希望 AI 帮忙操作本地文件，却不想把系统权限完全交出去。

这些事情单独看都很简单，但频繁切换工具、编写临时脚本和重复确认操作，会不断打断开发节奏。

Cupbox 希望把这些零散能力整合到一个统一、可复用、可审查的工具集中。

### 一套能力，三种入口

```text
                    Cupbox
                       │
        ┌────────────┼────────────┐
        │            │            │
   CLI 命令行     MCP Server    桌面工作台
        │            │            │
  开发者直接使用  AI 智能体调用  普通/高级任务
        │            │            │
        └────────────┼────────────┘
                       │
                 统一功能引擎
                       │
          ┌────────────┼────────────┐
          │            │            │
        文件操作     文本处理     系统工具
          │            │            │
          └────────────┼────────────┘
                       │
                统一安全规则
```

- **CLI：** 面向开发者，适合手动操作、终端工作流和脚本自动化。
- **MCP：** 面向 AI 智能体，让兼容 MCP 的客户端能够以结构化工具调用 Cupbox。
- **桌面版：** Electron 工作台，普通任务继续原会话，高级任务在主窗口内嵌原生 AI 引擎；工具调用、提问、审批、执行轨迹和任务恢复都在同一界面完成。
- **统一引擎：** 三种入口复用同一套核心能力，减少重复实现。
- **安全优先：** 对文件变更、命令执行和进程管理设置明确的操作边界。

无论是你亲自敲命令、在桌面工作台里对话，还是让 AI 帮你完成任务，都不需要为同一件事情维护两套工具。

## ✨ 为什么选择 Cupbox？

### 01. 不只是命令行，也是 AI 的工具箱

传统 CLI 主要服务于人类用户，而 Cupbox 同时考虑 AI 智能体的调用方式。

同一项能力既可以通过命令执行：

```bash
cupbox organize ~/Downloads --mode category --dry-run
```

也可以通过 MCP 工具调用：

```text
organize_files
```

这样，开发者可以继续使用熟悉的终端，而 AI 则可以在授权的工具范围内协助完成重复性工作。

### 02. 安全默认，而不是事后补救

让 AI 操作本地文件很方便，但错误的移动、重命名或系统命令也可能造成实际损失。

Cupbox 将安全规则纳入工具设计：

- 文件整理和批量重命名支持预览操作。
- 面向 AI 的文件变更工具默认先进行 dry-run。
- 命令执行必须通过白名单检查：面向 AI 的 `run_command` **默认拒绝执行**，必须提供 `allowPrefixes` 或管理员预设 `CUPBOX_RUN_ALLOW`，且白名单模式下拦截 shell 元字符防注入。
- 进程终止需要同时校验 PID 和进程名。
- 重名冲突默认跳过，不静默覆盖。
- MCP 工具支持通过环境变量禁用。

**让 AI 具备执行能力，但不意味着让 AI 获得无限制的执行权限。**

### 03. 轻量依赖，尽量使用系统能力

Cupbox 尽量复用操作系统已有的能力，减少额外依赖和部署负担。

- OCR：Windows 原生识别能力或已安装的 Tesseract。
- 压缩包：系统 `tar`。
- 剪贴板与截屏：使用平台对应的原生能力。
- 运行环境：Node.js 18.17 或更高版本。
- 运行时依赖：项目设计目标为仅两个运行时依赖。

具体能力仍取决于操作系统、相关系统组件和可选工具是否可用。

### 04. 跨平台，统一工作流

Cupbox 面向 Windows、macOS 和 Linux，适合个人开发环境、项目仓库以及日常文件处理。

不同平台的系统工具和权限机制可能存在差异，因此实际功能可用性以对应平台的实现和测试结果为准。

---

## 🧰 功能一览

Cupbox 的工具按入口分别统计，数量不要混在一起看：

| 入口 | 数量 | 说明 |
|---|---|---|
| 桌面工具箱 | **121 项** | 51 项本地工具 + 70 项工作模式工具目录 |
| 原生工作引擎 | **66 项** | 工作模式下 AI 可直接调用的本机工具 |
| 命令行 / MCP | **21 项** | 终端命令与 MCP 客户端调用 |

### 🧰 桌面工具箱（121 项）

工具箱按“办公 / 本机工具 / 文件 / 数据 / 图片 / 工作模式”分类，支持搜索：

| 分类 | 数量 | 内容 |
|---|---|---|
| 办公 | 23 | Word 读取 / 制作 / 替换 / 模板 / 邮件合并；PPT 读取 / 制作 / 替换 / 重排；Excel 读取 / 制作 / 修改 / 分析 / 转换 / 格式化 / 合并；PDF 读取 / 生成 / 合并 / 拆分 / 盖章；Office 导入导出 |
| 本机工具 | 20 | Use-It 7（PPT、Word、Excel、AutoCAD、桌面截图与动作、状态、动作清单）、桌面协作 6（观察、截图、OCR、视觉、鼠标、键盘）、压缩、OCR、剪贴板、截图、命令、进程 |
| 文件 | 3 | 文件整理、批量重命名、文件搜索 |
| 数据 | 4 | 哈希、时间戳、编码解码、CSV/JSON |
| 图片 | 1 | 图片像素混淆与还原 |
| 工作模式目录 | 70 | Harness 工具目录：原版运行时 38、需启用扩展 22、需浏览器与模型 6、上游未发布 2、Windows pwsh 1、语言服务器 1 |

### 🛠️ 原生工作引擎（66 项）

工作模式（高级任务）下 AI 实际可调用的工具，写入继续走预览与批准：

| 领域 | 数量 | 工具 |
|---|---|---|
| 文件 | 10 | 读取、写入、编辑、补丁、建目录、移动、复制、删除、信息、回滚 |
| 终端与进程 | 7 | 伪终端创建 / 写入 / 读取 / 结束 / 列表、受保护命令、进程管理 |
| 图片 | 6 | 转换、缩放、裁剪、对比、信息、取色 |
| 办公文档 | 23 | Word 5、PPT 4、Excel 7、Office 2、PDF 5 |
| Use-It | 7 | 状态、动作清单、PPT、Word、Excel、AutoCAD、桌面 |
| 记忆 / 任务 / 上下文 | 5 | 记事、召回、管理、任务、上下文统计 |
| 网络 / 比较 / 搜索 / 替换 / 剪贴板 | 5 | HTTP、diff、grep、replace、剪贴板图片 |
| Git / 包 / 测试 | 3 | git、包管理、测试 |

以下 21 个工具同时提供命令行与 MCP 入口：

### 📁 文件管理

| 功能 | CLI 命令 | MCP 工具 | 能力说明 |
|---|---|---|---|
| 文件整理 | `cupbox organize` | `organize_files` | 按文件类型、日期或正则规则归档，支持预览 |
| 批量重命名 | `cupbox rename` | `batch_rename` | 模板、正则与扩展名筛选，重名不覆盖 |
| 文件搜索 | `cupbox search` | `search_files` | 搜索文件名与内容，自动跳过常见依赖目录 |
| 压缩包管理 | `cupbox zip` | `zip` | 创建、解压和查看压缩包清单 |

### 🔧 文本与数据处理

| 功能 | CLI 命令 | MCP 工具 | 能力说明 |
|---|---|---|---|
| 哈希计算 | `cupbox hash` | `hash` | 支持 MD5、SHA-1、SHA-256、SHA-512 |
| 时间转换 | `cupbox time` | `time_convert` | 识别秒或毫秒时间戳，转换 ISO、北京时间和相对时间 |
| 编码与解码 | `cupbox codec` | `codec` | Base64、URL、HTML 编解码及 JSON 格式化、压缩 |
| CSV 与 JSON 转换 | `cupbox csv` | `convert_csv_json` | 双向转换，支持 RFC 4180 相关 CSV 处理 |

### 🖼️ 图片处理

| 功能 | CLI 命令 | MCP 工具 | 能力说明 |
|---|---|---|---|
| 图片像素混淆 | `cupbox obfuscate` | `obfuscate_image` | 六种模式混淆与无损还原，与「番茄图片混淆」生态互通；密钥非法即时拦截，绝不覆盖已有文件 |

### 🖥️ 系统与桌面工具

| 功能 | CLI 命令 | MCP 工具 | 能力说明 |
|---|---|---|---|
| OCR 文字识别 | `cupbox ocr` | `ocr_image` | 调用 Windows 原生引擎或 Tesseract |
| 剪贴板 | `cupbox clip` | `clipboard` | 读取和写入剪贴板 |
| 截屏 | `cupbox shot` | `take_screenshot` | 调用平台支持的截屏能力并输出 PNG |
| 受保护命令执行 | `cupbox run` | `run_command` | MCP 侧默认拒绝、必须白名单（防注入），超时限制和输出截断 |
| 进程管理 | `cupbox proc` | `process` | 按内存等信息查看进程，并对结束操作进行双重校验 |
| 版本检测与更新 | `cupbox update` | — | GitHub Releases → npm 双数据源（npm 源校验仓库归属防撞名），输出更新公告与下载地址；`CUPBOX_UPDATE_DISABLE=1` 可关闭 |

### 🧠 AI 能力

| 功能 | CLI 命令 | MCP 工具 | 能力说明 |
|---|---|---|---|
| AI 问答 | `cupbox ai ask` | `ai_ask` | 通过已配置的 API 单次问答（OpenAI 兼容 / Anthropic 双协议） |
| AI Agent | `cupbox ai agent` | `ai_agent` | 多轮循环：模型自主调用本地工具完成任务后给出总结 |

### 🧩 三层记忆与上下文压缩（参考 [dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon) 架构）

AI 不再每次从零开始：Cupbox 在本机维护三层记忆，超长对话自动压缩为摘要。

| 层 | 存储 | 行为 |
|---|---|---|
| 运行时记忆 | `文档/Cupbox/memory/user.md`（用户画像）+ `memory.md`（协作约定） | **常驻注入**每次对话的 system prompt |
| 长期事实 | `文档/Cupbox/memory/facts.jsonl`（追加式日志） | 按查询**相关性召回**（中文二元组 + 拉丁词打分） |
| 项目档案 | 会话工作区 + 会话摘要 | 工作区目录常驻提示；摘要在压缩时由 AI 生成 |

**上下文压缩**：历史超过预算（默认 24000 字符）时，旧轮次交给模型浓缩成 ≤400 字摘要，只保留最近 8 条原文。摘要并入 system prompt，下轮继续生效。无 AI 配置时降级为纯截断，绝不阻塞对话。桌面版对话框会出现「已压缩 N 条早前消息为摘要」提示条。

| 操作 | CLI | MCP 工具 |
|---|---|---|
| 记住一条事实 | `cupbox memory add <内容> [--source 标签]` | `memory_remember` |
| 按关键词召回 | `cupbox memory search <关键词>` | `memory_recall` |
| 列出 / 遗忘 | `cupbox memory list` / `forget <id或关键词>` | `memory_manage` |
| 画像 / 约定 | `cupbox memory user [内容]` / `collab [内容]` | `memory_profile` |

桌面版 Agent 循环中，模型可直接调用这 4 个记忆工具跨会话记事；每次对话开始时自动注入相关记忆。

### 📊 上下文洞察（致敬 [dsh-context](https://github.com/bowenliang123/dsh-context) 的能力方向）

长对话最怕「不知道还剩多少空间」。Cupbox 把上下文占用变成看得见的数字：

| 能力 | CLI | MCP 工具 | 说明 |
|---|---|---|---|
| Token 估算与窗口占用 | `cupbox context [--text 文本] [--file 路径] [--window 128000]` | `context_stats` | 固定密度启发式（中文≈1.5 字符/token，西文≈4 字符/token）；不传文本时返回 Agent 基线开销（系统提示词 + 全部工具 Schema） |

- **六成分分解**：每次请求把上下文拆成 系统提示词 / 工具 Schema / 用户消息 / 注入上下文 / 助手回复 / 工具结果 六段，各占多少一目了然。
- **趋势与事件**：桌面版按请求记录占用曲线（含提供方上报的实际输入/输出 token），并标注 注入记忆、压缩历史、切换模型、切换模式 四类事件。
- **桌面入口**：对话页右上角「上下文」按钮打开洞察面板（成分条 + 占用趋势 + 事件流）；窗口默认 128k，可用环境变量 `CUPBOX_CONTEXT_WINDOW` 调整。
- 估算为启发式（≈），非精确 tokenizer 计数，仅作占用参考。

所有 CLI 命令均支持 `--json`，便于脚本、自动化流程和其他程序消费结构化输出。

---

## 🚀 快速开始

### 环境要求

| 项目 | 要求 |
|---|---|
| Node.js | ≥ 18.17 |
| 包管理器 | npm |
| 操作系统 | Windows / macOS / Linux |
| 可选组件 | OCR 引擎等依赖具体功能的系统组件 |

### 方式一：全局安装

```bash
npm install -g cupbox
```

安装完成后，可以在终端的任意工作目录中使用：

```bash
cupbox help
```

### 方式二：无需全局安装，直接试用

```bash
npx cupbox help
```

适合初次体验，或者暂时不想安装全局命令的用户。

### 第一次使用：整理下载目录

先查看会发生什么：

```bash
cupbox organize ~/Downloads --mode category --dry-run
```

确认预览符合预期后，再执行：

```bash
cupbox organize ~/Downloads --mode category
```

例如，预览结果可能类似：

```text
photo.png   → Images/photo.png
report.pdf  → Documents/report.pdf

预览完成：共 2 项待移动。
当前为 dry-run，未执行任何移动操作。
```

以上仅为输出示例，实际目录名称、统计信息与显示格式以运行结果为准。

**建议：第一次处理重要目录时，始终先预览，再执行。**

---

## 💻 CLI 使用示例

### 1. 文件整理

按照类型整理下载目录：

```bash
cupbox organize ~/Downloads --mode category --dry-run
cupbox organize ~/Downloads --mode category
```

支持的模式和规则以 `cupbox organize --help` 为准。

### 2. 批量重命名

给照片添加连续编号：

```bash
cupbox rename ./photos --template "{n}-{name}" --ext "*.jpg" --dry-run
```

确认预览结果后，移除 `--dry-run` 执行。

批量操作前应检查文件筛选范围与重命名结果，避免误选不需要处理的文件。

### 3. 搜索项目内容

搜索 TypeScript 源码中的 TODO：

```bash
cupbox search ./src -c "TODO" --glob "*.ts"
```

适合快速定位待办事项、关键字、配置项或需要排查的代码片段。

### 4. 计算文件哈希

```bash
cupbox hash --text "hello" --algo sha256,md5
```

可以用于计算文本或文件的哈希值，具体参数以命令帮助为准。

注意：MD5 和 SHA-1 不适合需要现代抗碰撞安全性的场景；校验文件完整性时，优先考虑 SHA-256 或 SHA-512。

### 5. 转换时间戳

```bash
cupbox time 1700000000
```

适用于日志排查、接口调试和数据库时间字段分析。

### 6. 编码与解码

```bash
cupbox codec b64e "你好，世界"
```

还可用于 URL、HTML 与 JSON 等常见数据处理场景。

### 7. OCR 识别截图

```bash
cupbox ocr ./截图.png --lang zh-Hans
```

可用于识别截图中的文字，适合从报错图片、界面截图或文档图片中提取文本。

识别语言和实际效果取决于系统 OCR 引擎及其语言支持情况。

### 8. 压缩与解压

通过 `cupbox zip` 处理压缩包，可以减少在文件管理器、临时脚本与终端工具之间切换的次数。

先查看完整参数：

```bash
cupbox zip --help
```

创建、解压和查看清单时，建议特别留意目标目录以及压缩包中包含的路径。

### 9. 受保护的命令执行

```bash
cupbox run --help
```

Cupbox 为命令执行提供白名单、超时和输出截断机制。具体允许的命令取决于项目中的白名单配置。

不要将其视为任意 Shell 命令执行器，也不要在未审核白名单的情况下直接向不可信输入开放执行能力。

### 10. 查看与结束进程

查看支持的进程操作：

```bash
cupbox proc --help
```

结束进程时，需要提供 PID 和预期进程名：

```bash
cupbox proc kill --pid 1234 --name node
```

示例中的 `1234` 仅为占位 PID。执行前应确认进程确实是目标进程。

### 11. 图片像素混淆与还原

```bash
cupbox obfuscate ./图.png --mode c --key 我的密钥
```

混淆后的图片会另存为 `图.obf.png`；用同一模式和密钥加 `--decrypt` 即可无损还原：

```bash
cupbox obfuscate ./图.obf.png --mode c --key 我的密钥 --decrypt
```

六种模式的说明可通过不带参数的 `cupbox obfuscate` 查看。密钥错误或缺失会在执行前被拒绝，输出文件重名时自动改名，绝不覆盖已有文件。

---

## 🤖 让 AI 替你干活

Cupbox 的一个重要目标，是让 AI 不仅能回答问题，还能在受控范围内调用实际工具。

通过 MCP（Model Context Protocol），兼容的 AI 客户端可以发现并调用 Cupbox 提供的工具。

### 支持场景

例如，你可以向 AI 提出这样的任务：

> 帮我整理下载目录，先按文件类型分类，把预计移动的文件列表给我看。我确认后再执行。

或者：

> 帮我给这批截图按顺序编号。先生成预览，不要覆盖任何已有文件。

AI 可以根据任务选择对应的 MCP 工具，获取结构化结果，并在确认后继续执行。

### 内置 AI 引擎（API 直连，不依赖 MCP 客户端）

Cupbox 自带 Codex 式 AI 能力，CLI、桌面版、MCP 三种形态都能直接调用模型：

- **`cupbox ai ask`** —— 单次问答；
- **`cupbox ai agent`** —— 多轮 Agent 循环：模型自主选择本地 14 个工具（文件 / 数据 / 图片 / 受保护命令）执行任务，最后给出总结；
- MCP 侧新增 `ai_ask`、`ai_agent` 两个工具，在 Claude Desktop / Cursor 中直接可调；
- 桌面版就是一座对话工作台：新建会话 / 历史对话、「问一问 · Agent 模式」一键切换，API 配置在「设置 → API 设置」页完成。

**首次配置（一次即可）：**

```bash
# OpenAI 兼容协议（官方 / DeepSeek / Kimi / Ollama / OpenRouter / vLLM …）
cupbox ai config --provider openai-compatible --base https://api.deepseek.com/v1 --model deepseek-chat --key sk-xxx

# 或 Anthropic 官方
cupbox ai config --provider anthropic --model claude-sonnet-4-5 --key sk-ant-xxx
```

```bash
cupbox ai ask "1718000000 是几点"
cupbox ai agent "搜索项目里所有 TODO 并汇总" --max-turns 6
cupbox ai config                 # 查看当前配置（Key 打码显示）
```

- 配置保存在 `文档/Cupbox/config.json`（权限 0600；v1.0.3 起默认系统「文档」目录，旧 `~/.cupbox` 首次启动自动迁移，`CUPBOX_HOME` 可覆盖），**密钥只存本机、不上传**；
- 环境变量 `CUPBOX_AI_API_KEY` / `CUPBOX_AI_BASE_URL` / `CUPBOX_AI_MODEL` / `CUPBOX_AI_PROVIDER` 优先于配置文件；
- Agent 内 `rename` / `organize` **永远 dry-run 预览**（轮次默认 8、上限 10），`run` 仍必须白名单——**AI 拿不到任何超出人类使用时的安全权限**。

### 方式一：使用全局安装

先安装 Cupbox：

```bash
npm install -g cupbox
```

然后在 MCP 客户端配置文件中加入：

```json
{
  "mcpServers": {
    "cupbox": {
      "command": "cupbox",
      "args": ["mcp"]
    }
  }
}
```

保存配置后，按照对应客户端的要求重新启动或刷新 MCP 连接。

### 方式二：使用 npx

如果不想全局安装，可以参考项目提供的配置示例：

[`examples/npx-mcp-config.json`](./examples/npx-mcp-config.json)

通常可以使用以下启动方式：

```bash
npx -y cupbox mcp
```

具体配置方式以目标客户端的 MCP 配置规范为准。

### AI 调用时的默认行为

对于文件整理和批量重命名，MCP 工具默认启用 dry-run 预览。AI 可以先读取预计执行结果，再根据用户的明确要求发起实际操作。

```text
用户提出任务
    ↓
AI 选择对应的 MCP 工具
    ↓
Cupbox 校验参数与安全规则
    ↓
返回预览结果
    ↓
用户确认执行
    ↓
Cupbox 再次校验并执行操作
    ↓
返回执行结果
```

实际执行流程仍受具体工具的参数、实现逻辑和安全检查约束。

需要特别说明：**dry-run 不是完整的事务机制，也不能代替权限隔离、备份和执行前的最终检查。** 对重要数据，仍建议先备份，并确认操作范围。

---

## 📦 可视化桌面版（阶段 1/3）

本地 Electron 桌面应用，工作台式布局（v1.0.0 起）：

- **会话侧栏** —— 新建会话、历史对话列表（本机 `文档/Cupbox/sessions/` 持久化，可删除 / 清空）、**工作区目录选择**（Agent 的文件任务在工作区内进行）；
- **对话主区** —— 「问一问 / Agent 模式」分段切换，Enter 发送、Shift+Enter 换行，回复附带工具轨迹卡片，多轮上下文自动携带；
- **工具箱抽屉** —— 原 16 工具表单界面折叠为右侧抽屉，按数据 / 文件 / 图片 / 系统分组选择，动态表单 + 结果面板（JSON 美化、图片预览）；
- **设置弹窗** —— 四个页签：**API 设置**（协议 / 地址 / 模型 / 密钥 / 温度 / agent 轮次）、**主题**（深色 · 浅色 · 跟随系统 × 极光 / 薄荷 / 琥珀 / 玫瑰四种强调色，即时生效并落盘）、**插件管理**（每个工具的开关同时作用于工具箱显示与 Agent 可调用的工具集）、**关于更新**（版本信息、一键**检查 GitHub 仓库新版本**与结果展示、仓库 / Releases / CHANGELOG 快捷入口）；
- **版本检测与更新公告**（v1.0.1）—— 启动静默检查更新，发现新版顶栏亮「vX.Y.Z 可用」呼吸徽标并自动弹出一次更新公告（版本对比 + Release 说明 + **前往 GitHub 下载** / 查看更新日志 / 稍后提醒）；点击顶栏版本号或在「设置 → 关于更新」可手动检查（转圈反馈），静默过的版本仍可从徽标再进，`CUPBOX_UPDATE_DISABLE=1` 一键关闭检查。
- **数据默认存「文档」**（v1.0.3）—— 配置 / 密钥 / 模型库 / 会话 / 记忆都在 `文档/Cupbox`，设置 → 模型连接的「API 储存管理」可一键打开文件夹、定位 `config.json`；旧 `~/.cupbox` 首次启动自动迁移（只复制不覆盖，`CUPBOX_HOME` 可覆盖），侧栏「模型管理」直达多模型与能力多选页面。
- **工具调用实时直播 + AI 气泡**（v1.0.3）—— Agent 执行任务时每次工具调用以卡片逐条出现（工具名 / 参数 / 执行中动画 → 完成耗时或失败详情），结束后由完整轨迹接管；AI 回复改为与用户气泡对偶的卡片气泡样式，带入场动画。
- **Use-It 实时 Office 集成** —— 通过 use-it-agent 本地引擎用 COM 操作**已打开的** PowerPoint / Word / Excel / AutoCAD 与桌面 GUI；工具箱「办公 / 系统」新增 7 个工具，Agent 在本机模式下可调用，写入逐次批准。引擎安装与启动见 [docs/USEIT-ENGINE.md](docs/USEIT-ENGINE.md)。
- **普通 / 高级任务统一入口** —— 工作页顶部切换普通任务与高级任务，默认普通任务；高级任务在主窗口内嵌运行。侧栏「最近任务」同时列出普通会话与高级任务（带“高级”标记），点击即回到对应模式，切换视图不会打断正在运行的任务。
- **聊天定位条与历史折叠** —— 右侧按轮次显示刻度，悬停预览、点击跳转并自动展开折叠的历史；长会话只渲染最近一批消息，向上按批展开，避免一次渲染整个历史。
- **流式滚动跟随** —— 只有停留在对话底部时才自动跟随新内容；向上翻看历史时不会被流式输出拽回，回到底部后恢复跟随。


与 CLI、MCP 共用同一套引擎和安全默认（dry-run、白名单、解压预检全部生效）。

```bash
npm install          # 首次会经 npmmirror 镜像下载 Electron 运行时
npm run desktop      # 开发运行
npm run pack:exe     # 打包绿色便携 exe → release/Cupbox可视化/Cupbox可视化.exe
npm run pack:installer # Windows 安装包（需 Inno Setup 6.7+）→ release/Cupbox-Setup-1.2.0-x64.exe
```

安装版提供樱花主题中文引导、深浅色外观、安装位置与快捷方式选择，卸载保留对话和配置。
侧栏“QQ 机器人”提供独立扫码窗口、自动配置的 NapCat、群聊/私聊规则、共享记忆与受控表情包，见 [QQ 机器人说明](docs/QQ-BOT.md)。
构建、安装与签名说明见 [Windows 安装版](docs/WINDOWS-INSTALLER.md)。

三阶段路线（工具驾驶舱 → ACP 多引擎接入 → 技能市场/调度/多会话）与选型依据见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 🛡️ 安全设计

Cupbox 不希望 AI 自动化变成无边界的系统控制，因此将若干安全措施作为默认设计方向。

| 风险场景 | 对应措施 | 设计目的 |
|---|---|---|
| 批量移动文件 | 支持 dry-run 预览 | 执行前检查影响范围 |
| 批量重命名 | 预览、冲突检查 | 减少误操作与文件覆盖 |
| AI 调用命令执行 | 默认拒绝，须显式白名单 | 不提供 `allowPrefixes` 或 `CUPBOX_RUN_ALLOW` 就不执行；白名单下拦截 shell 元字符防注入 |
| 命令执行时间过长 | 超时控制 | 防止任务无限等待 |
| 命令输出过大 | 输出截断 | 控制返回结果的体积 |
| 解压来源不明的 zip | 解压前预检路径穿越与覆盖冲突 | 防 zip-slip（`../` 穿越）与静默覆盖目标目录已有文件 |
| 终止错误进程 | PID 与进程名双重校验 | 降低误结束其他进程的风险 |
| 不需要某些 AI 工具 | 支持禁用指定工具 | 缩小可用工具的攻击面 |

### 禁用指定 MCP 工具

可以通过环境变量关闭不希望暴露给 AI 的工具：

```bash
CUPBOX_DISABLE_TOOLS=run_command,process cupbox mcp
```

上面的写法展示了配置意图。不同操作系统设置环境变量的语法不同，Windows 用户可以在启动 MCP 的配置环境中设置对应变量。

与之配合，`CUPBOX_RUN_ALLOW=npm,git status` 可以为 `run_command` 预设允许的命令前缀（调用时提供了 `allowPrefixes` 则以调用方为准）。两者都没有时，MCP 侧的 `run_command` 会拒绝执行任何命令。

### 安全边界

需要注意以下几点：

- 白名单限制的是允许的命令形式，不等于完整的操作系统沙箱。
- 白名单模式下命令不得包含 shell 元字符（管道、重定向、命令替换、cmd 变量展开等），命中即拒绝——这是防注入设计，不是功能缺陷；需要管道或重定向时请由人工在 CLI 不加白名单运行。
- 解压 zip 前会预检路径穿越条目与覆盖冲突；经由人工 CLI 处理不可信压缩包时，仍建议先确认来源。
- 被允许的程序仍可能具有自身的文件访问和系统权限。
- PID 与进程名校验可以降低误操作风险，但不能消除所有进程竞态问题。
- dry-run 的预览结果不保证执行时文件系统状态仍然相同。
- 处理敏感数据时，仍需遵循最小权限原则。

如果要将 Cupbox 部署到自动化服务器，或者交给具有较高权限的 AI 智能体使用，应进一步评估操作系统账户权限、工作目录限制、命令白名单以及运行环境隔离。

---

## ⚙️ 平台与依赖

Cupbox 尽可能使用轻量的实现方式，但部分功能依赖操作系统能力。

| 功能 | 依赖或限制 |
|---|---|
| 基础 CLI 与 MCP | Node.js 运行环境 |
| OCR | Windows 原生 OCR 能力或已安装的 Tesseract |
| 压缩包处理 | 依赖实现所使用的系统压缩工具 |
| 剪贴板 | 依赖对应平台的能力与权限 |
| 截屏 | 依赖对应平台的实现与权限 |
| 图片像素混淆 | PNG 编解码由纯 JS 的 [pngjs](https://github.com/pngjs/pngjs) 实现，无原生依赖 |
| 进程管理 | 受操作系统权限和进程管理规则约束 |

如果某项功能在你的环境中不可用，请先检查系统组件、权限和命令帮助，再提交包含操作系统、Node.js 版本、复现步骤及错误输出的 Issue。

---

## 📚 文档与帮助

- **命令帮助：** 在终端执行 `cupbox help`。
- **npm 包：** [cupbox](https://www.npmjs.com/package/cupbox)。
- **GitHub 仓库：** [beizilaoshi/cupbox](https://github.com/beizilaoshi/cupbox)。
- **英文文档：** [README.en.md](./README.en.md)。
- **MCP 配置示例：** [`examples/`](./examples/)。
- **问题反馈：** [GitHub Issues](https://github.com/beizilaoshi/cupbox/issues)。

对于尚未熟悉的命令，建议优先查看帮助信息，再对真实文件执行批量操作。

---

## 🧑‍💻 本地开发

欢迎开发者参与 Cupbox 的改进与扩展。

### 获取源码

```bash
git clone https://github.com/beizilaoshi/cupbox.git
cd cupbox
npm ci
```

### 运行测试

```bash
npm test
```

项目的测试流程覆盖构建、单元测试、CLI 冒烟测试，以及基于内存传输的 MCP 集成测试。

### 启动开发监听

```bash
npm run dev
```

### 项目结构

```text
cupbox/
├── src/
│   ├── core/       # 核心功能实现
│   ├── util/       # 平台、进程、文件系统等工具
│   ├── index.ts    # CLI 入口
│   └── mcp.ts      # MCP Server 入口
├── test/           # 自动化测试
├── examples/       # MCP 配置示例
├── README.md
└── README.en.md
```

### 持续集成

项目现有 CI 配置覆盖 Windows、Ubuntu，以及 Node.js 18、20、22 的测试组合。

持续集成的目标是尽早发现跨平台差异、运行时兼容性问题和功能回归。

---

## 🤝 参与贡献

Cupbox 仍然有很多值得改进的地方。欢迎提交 Issue、建议和 Pull Request。

尤其欢迎以下方向的贡献：

- **跨平台兼容性：** 路径、编码、权限与系统工具差异。
- **安全性：** 参数校验、边界条件、异常处理和安全测试。
- **测试覆盖：** 文件操作、异常输入、冲突场景及 MCP 集成。
- **开发体验：** 更清晰的命令帮助、更友好的错误提示和结构化输出。
- **文档完善：** 使用示例、常见问题和平台配置说明。

建议在提交 PR 前运行：

```bash
npm test
```

请尽量提供可复现的测试用例，并说明修改内容、适用场景以及可能产生的兼容性影响。

---

## 💬 交流群

- QQ 群：**1005188752**
- 加群链接：<https://qm.qq.com/q/V2pNRPkW0G>
- 爱发电：<https://afdian.com/a/beilaishi>

群内用于使用答疑、版本通知和功能讨论；遇到可复现的问题，仍建议优先提交 Issue，方便跟踪和沉淀。

---

## 🗺️ 项目方向

Cupbox 的长期方向是成为一个轻量、可靠、适合人类与 AI 共同使用的开发工具箱。

可以考虑持续完善以下方面：

- **可靠性：** 进一步补足边界条件、异常恢复和跨平台测试。
- **安全性：** 持续审查命令执行、路径处理和文件变更的安全边界。
- **可组合性：** 让 CLI、MCP 与脚本工作流之间保持清晰一致的行为。
- **可维护性：** 控制依赖增长，保持模块边界清晰。
- **易用性：** 提供更直观的错误信息、示例和环境诊断。

这些是项目的发展方向，不代表所有事项都已经实现。

---

## 🙏 致谢

图片像素混淆（`obfuscate` / `obfuscate_image`）的六种模式算法移植自开源项目「番茄图片混淆 桌面版」（[MIT License, Copyright (c) 2026 3450892121](https://github.com/3450892121)，作者 GitHub 主页：[github.com/3450892121](https://github.com/3450892121)）。移植实现与原版引擎做过逐字节对拍，并在测试中保留了兼容性金标，以确保与该项目及手机端生态的长期互通。感谢原作者的开源贡献。

三层记忆与上下文压缩（`memory` 子命令 / `memory_*` 工具 / 会话摘要）的架构设计参考了开源项目 [dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon)（omdsh-dev）的运行时记忆、长期事实与回合压缩模型。Cupbox 的实现是面向本机 CLI/桌面场景的独立重写（Node 内置模块，无额外运行时依赖），致谢原作者的架构启发。

---

## 📄 许可证

Cupbox 使用 [MIT License](./LICENSE) 开源。

你可以在 MIT 许可证条款范围内使用、修改和分发本项目。具体权利与义务以仓库中的许可证文本为准。

---

<p align="center">
  <strong>Cupbox — Less busywork, more building.</strong>
</p>

<p align="center">
  少写一次临时脚本，少做一次重复操作。<br>
  把时间留给真正值得创造的东西。
</p>


### 桌面开发工具与项目授权

设置 → 开发与授权提供 36 项桌面 Agent 工具：文件预览/事务/回滚、HTTP、真实 ConPTY、搜索替换、图片处理、Git、脚本与测试、项目记忆。文件修改需预览令牌，项目策略提案不自动信任，Shell 始终人工批准。详见 [开发工具说明](docs/WORKBENCH.md)。


### 本机渗透测试 Agent（默认关闭）

设置 → 权限与环境可开启隐藏的本机渗透测试 Agent，开启时需确认风险。工具和本机模型请求都只允许固定127.0.0.1，不解析域名、不跟随重定向。复用 MIT node-portscanner 检查端口，并提供有界HTTP安全头/配置暴露检查；没有本机模型也可运行固定流程。详见 [边界、来源与使用说明](docs/LOOPBACK-AGENT.md)。当前版本为1.2.0。

### 桌面协作：鼠标、读屏与视觉

设置 → 权限与环境开启需要的权限，在左侧桌面协作手动授权目标窗口，再使用 Agent 对话。新增7个桌面工具，默认关闭，逐次确认；Ctrl+Alt+F12紧急停止。[权限、开源来源与使用说明](docs/COMPUTER-ASSIST.md)。

