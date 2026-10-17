# 更新日志

本文件记录本项目所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh/1.1.0/)，
版本号遵循 [语义化版本规范](https://semver.org/lang/zh-CN/)。

> 📖 **English (optional): [CHANGELOG.en.md](./CHANGELOG.en.md)**

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
