# Cupbox

<p align="center">
  <img src="https://img.shields.io/npm/v/cupbox?style=for-the-badge&color=cb8a52" alt="npm version">
  <img src="https://img.shields.io/node/v/cupbox?style=for-the-badge&color=438f70" alt="Node.js">
  <img src="https://img.shields.io/github/actions/workflow/status/beizilaoshi/cupbox/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI">
  <img src="https://img.shields.io/badge/license-MIT-5279c7?style=for-the-badge" alt="MIT License">
</p>

<p align="center">
  <strong>把重复的开发杂活，交给命令行和 AI。</strong>
</p>

<p align="center">
  一个工具包，两种使用方式。<br>
  既是开发者的命令行工具箱，也是 AI 智能体可以直接调用的 MCP 工具集。
</p>

<p align="center">
  <a href="#-为什么选择-cupbox">为什么选择</a> ·
  <a href="#-功能一览">功能一览</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-让-ai-替你干活">接入 AI</a> ·
  <a href="#-安全设计">安全设计</a> ·
  <a href="#-参与贡献">参与贡献</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cupbox">npm</a> ·
  <a href="https://github.com/beizilaoshi/cupbox">GitHub</a> ·
  <a href="./README.en.md">English Documentation</a>
</p>

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

### 一套能力，两种入口

```text
                    Cupbox
                       │
             ┌─────────┴─────────┐
             │                   │
       CLI 命令行             MCP Server
             │                   │
       开发者直接使用         AI 智能体调用
             │                   │
             └─────────┬─────────┘
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
- **统一引擎：** 两种入口复用同一套核心能力，减少重复实现。
- **安全优先：** 对文件变更、命令执行和进程管理设置明确的操作边界。

无论是你亲自敲命令，还是让 AI 帮你完成任务，都不需要为同一件事情维护两套工具。

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
- 命令执行必须通过白名单检查。
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

Cupbox 将 13 项日常开发杂活整合为一套工具。每项能力均提供 CLI 入口与对应的 MCP 工具。

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

### 🖥️ 系统与桌面工具

| 功能 | CLI 命令 | MCP 工具 | 能力说明 |
|---|---|---|---|
| OCR 文字识别 | `cupbox ocr` | `ocr_image` | 调用 Windows 原生引擎或 Tesseract |
| 剪贴板 | `cupbox clip` | `clipboard` | 读取和写入剪贴板 |
| 截屏 | `cupbox shot` | `take_screenshot` | 调用平台支持的截屏能力并输出 PNG |
| 受保护命令执行 | `cupbox run` | `run_command` | 命令前缀白名单、超时限制和输出截断 |
| 进程管理 | `cupbox proc` | `process` | 按内存等信息查看进程，并对结束操作进行双重校验 |

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

## 🛡️ 安全设计

Cupbox 不希望 AI 自动化变成无边界的系统控制，因此将若干安全措施作为默认设计方向。

| 风险场景 | 对应措施 | 设计目的 |
|---|---|---|
| 批量移动文件 | 支持 dry-run 预览 | 执行前检查影响范围 |
| 批量重命名 | 预览、冲突检查 | 减少误操作与文件覆盖 |
| AI 调用命令执行 | 命令前缀白名单 | 限制可执行的命令范围 |
| 命令执行时间过长 | 超时控制 | 防止任务无限等待 |
| 命令输出过大 | 输出截断 | 控制返回结果的体积 |
| 终止错误进程 | PID 与进程名双重校验 | 降低误结束其他进程的风险 |
| 不需要某些 AI 工具 | 支持禁用指定工具 | 缩小可用工具的攻击面 |

### 禁用指定 MCP 工具

可以通过环境变量关闭不希望暴露给 AI 的工具：

```bash
CUPBOX_DISABLE_TOOLS=run_command,process cupbox mcp
```

上面的写法展示了配置意图。不同操作系统设置环境变量的语法不同，Windows 用户可以在启动 MCP 的配置环境中设置对应变量。

### 安全边界

需要注意以下几点：

- 白名单限制的是允许的命令形式，不等于完整的操作系统沙箱。
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
