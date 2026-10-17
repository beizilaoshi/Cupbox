# cupbox

[![CI](https://github.com/beizilaoshi/cupbox/actions/workflows/ci.yml/badge.svg)](https://github.com/beizilaoshi/cupbox/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/cupbox.svg)](https://www.npmjs.com/package/cupbox)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![node](https://img.shields.io/node/v/cupbox.svg)](https://nodejs.org)

**把杂活儿交给命令行和 AI。** 一个包装两次：装好后既是人类用的 **CLI**，也是 AI 智能体用的 **MCP 服务器**（Claude Desktop / Cursor / Cline）——13 项日常开发杂活，零配置。

> 📖 **English (optional): [README.en.md](./README.en.md)**

## 为什么做这个？

- **你敲命令，或者你的 AI 敲。** 每项能力都有两种用法：终端里 `cupbox organize`，AI 客户端里 `organize_files`。同一套引擎、同一套安全规则。
- **为 AI 设计的安全默认。** AI 驱动的破坏性操作**默认先 dry-run 预览**；执行命令必须过白名单；结束进程要求 PID **和** 进程名同时匹配。智能体可以热心，但不能手滑。
- **不用装一堆依赖。** OCR 用 Windows 自带引擎（或已装的 `tesseract`），压缩用系统 `tar`，剪贴板/截屏走原生能力。全部运行时依赖只有 **两个**。
- **跨平台。** Windows / macOS / Linux，Node ≥ 18.17。

## 13 项能力一览

| 杂活 | CLI | MCP 工具 | 说明 |
|---|---|---|---|
| 整理文件夹 | `cupbox organize` | `organize_files` | 按类型/日期/正则，先预览再动手 |
| 批量重命名 | `cupbox rename` | `batch_rename` | `{n}-{name}` 模板、正则、重名不覆盖 |
| 搜索 | `cupbox search` | `search_files` | 文件名+内容，自动跳过 node_modules |
| 哈希 | `cupbox hash` | `hash` | md5/sha1/sha256/sha512，文本或文件 |
| 时间戳转换 | `cupbox time` | `time_convert` | 自动识别秒/毫秒，ISO、北京时间、相对时间 |
| 编解码 | `cupbox codec` | `codec` | base64、URL、HTML、JSON 格式化/压缩 |
| CSV ⇄ JSON | `cupbox csv` | `convert_csv_json` | RFC 4180，分隔符自动识别 |
| OCR 文字识别 | `cupbox ocr` | `ocr_image` | Windows 原生引擎 / tesseract，中文可用 |
| 剪贴板 | `cupbox clip` | `clipboard` | 读 / 写 |
| 截屏 | `cupbox shot` | `take_screenshot` | 原生截屏，输出 PNG |
| 压缩包 | `cupbox zip` | `zip` | 创建/解压/列清单，中文名无忧 |
| 受保护执行命令 | `cupbox run` | `run_command` | 白名单 + 超时 + 输出截断 |
| 进程管理 | `cupbox proc` | `process` | 按内存排序列出；结束需 pid **+** 名字双校验 |

所有 CLI 命令都支持 `--json`，方便脚本消费。

## 安装

```bash
npm install -g cupbox      # 全局安装
# 或者先试后装：
npx cupbox help
```

## CLI 快速上手

```bash
# 先预览，再执行：把下载目录按类型归档
cupbox organize ~/Downloads --mode category --dry-run
cupbox organize ~/Downloads --mode category

#  📋 report.pdf  →  Documents/report.pdf
#  📋 photo.png   →  Images/photo.png
#  📋 预览完毕（未执行），共 2 项将移动。去掉 --dry-run 执行。

# 给照片编号（重名自动跳过，绝不覆盖）
cupbox rename ./photos --template "{n}-{name}" --ext *.jpg --dry-run

# 全仓库搜 TODO（自动跳过 node_modules/.git）
cupbox search ./src -c "TODO" --glob *.ts

# 时间、哈希、编解码这些琐碎活
cupbox time 1700000000
cupbox hash --text "hello" --algo sha256,md5
cupbox codec b64e "你好，世界"

# OCR 截图（Windows 自带引擎，中文可用）
cupbox ocr ./截图.png --lang zh-Hans

# 结束进程：PID 和名字都对得上才动手
cupbox proc kill --pid 1234 --name node
```

## 接入你的 AI（MCP）

在 MCP 客户端配置（如 `claude_desktop_config.json`）中加入：

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

不想全局安装？用 `npx -y cupbox mcp`，见 [`examples/npx-mcp-config.json`](./examples/npx-mcp-config.json)。

然后直接对 AI 说：

> “把我的下载目录按文件类型整理一下——**先给我看预览**。”
> “把这些截图按顺序编号，我确认之前别动原文件。”

AI 会调用 `organize_files` / `batch_rename`——这两个工具对 AI **默认 dry-run**：先返回预览，你说执行才执行。

### 安全护栏

| 场景 | cupbox 的做法 |
|---|---|
| AI 要移动/重命名文件 | 先预览（AI 调用时 `dryRun` 默认为 `true`） |
| AI 要执行 shell 命令 | 必须匹配命令前缀白名单；内置超时与输出截断 |
| AI 要结束进程 | PID 与预期进程名必须同时匹配 |
| 重名冲突 | 跳过并说明原因——绝不静默覆盖 |
| 想对 AI 关掉某些工具 | `CUPBOX_DISABLE_TOOLS=run_command,process cupbox mcp` |

## 文档

- 终端里跑 `cupbox help`——完整命令手册
- English documentation (optional): [README.en.md](./README.en.md)
- MCP 配置示例：[`examples/`](./examples/)

## 开发

```bash
git clone https://github.com/beizilaoshi/cupbox.git
cd cupbox
npm ci
npm test        # 构建 + 全量测试（单测、CLI 冒烟、内存传输上的 MCP 集成）
npm run dev     # tsc 监听模式
```

目录结构：`src/core`（功能）· `src/util`（平台/进程/文件系统工具）· `src/index.ts`（CLI）· `src/mcp.ts`（MCP 服务器）· `test/`（vitest）。

CI 覆盖 **Windows + Ubuntu × Node 18/20/22**。

## 参与贡献

欢迎 Issue 和 PR——尤其是各平台的边角情况（路径、编码、工具可用性）。请保持 `npm test` 全绿。

## 许可证

[MIT](./LICENSE)
