# DeepSeek Harness 工具工作台

> 当前入口已统一为“工作”，最新使用方式见 [HARNESS-WORK.md](HARNESS-WORK.md)。以下保留首次接入的技术记录。


入口：Cupbox 左侧 **Harness 工作台** → 查看或搜索工具清单 → **打开原版工作台**。先在左下角选择工作文件夹；启动确认展示目录、连接导入与独立批准规则。

## 接入方式

直接分发并运行官方 `@deepseek-ai/dsh@0.2.1-rc.2`，保留官方 UI、工具插件、工具调用卡片、流式会话事件和批准流程。官方运行时采用独立沙箱浏览器窗口，无 Cupbox preload 或 Node 权限，仅绑定随机端口的 `127.0.0.1`，使用原版一次性访问令牌与浏览器会话认证。关闭窗口会先确认并停止其任务；主应用退出也请求运行时有界关闭。

安装包和便携版将运行时置于应用根目录的 `dsh/`，缩短 Win32 安装与重命名路径；源码开发仍使用 `desktop/harness-runtime/`。工作目录自动登记为原版项目，不自动创建模型任务。会话、配置、凭据和插件资料位于系统文档目录的 `Cupbox/harness`，与 Cupbox 原有任务历史分开。模型库中启用的非免费文本连接通过官方多服务商适配器导入，默认沿用 Cupbox 选中的文本连接；API Key 通过独立子进程环境传入，生成的 profile 文件只含变量引用。第三方匿名免费通道不支持这条原版协议链路。

默认 `workspace-write`＋请求批准，不继承主应用的完全控制配置。进入工作台后应核对其独立权限设置。终端、插件代码、子 Agent 和联网会影响文件或产生模型费用。遥测通过官方环境开关关闭；启动访问令牌不进入 Cupbox 诊断或 renderer API。

## 工具范围与版本

参考官方源码提交 `22ddee3792402c3e70ec5f86a63c3e3e895a2f60` 的工具目录，界面列出 70 个去重接口。**清单是接口参考，实际模型工具由操作系统、预设、已启用插件与外部配置决定。** 本次不把接口数量等同于已经启用的工具数量。

- 官方标准 / PTC / 创造预设：文件读取、写入、编辑、图片读取、glob/grep、PowerShell、后台任务、任务清单、目标、技能、子 Agent、工作流、定时任务、网页与 MCP 资源等；按原版预设组合提供。
- 官方已随包分发的扩展：持久终端、Git Worktree、会话查询、团队协作、循环工作流等，可从原版 Plugins 中按需启用。PTC 与普通调用、团队与普通子 Agent、Windows PowerShell 与 Bash 存在组合或平台差异。
- 另附官方 LSP 与 Stagehand 原生浏览器插件。LSP 需要安装并配置语言服务器；浏览器需要兼容 Chrome 和独立受支持模型。当前官方 Stagehand 插件不支持 DeepSeek 端点或自定义 baseURL。插件的 README 随运行时保留，具体配置在原版插件管理中完成。
- `propose_action`、`subagent_oar` 来自较新的上游源码，当前未在公开 npm 发布，清单明确标为“上游未发布”，尚未接入当前固定版本。

## Cupbox 主对话展示

原有主对话仍使用 Cupbox 的权限与执行器，新增 Harness 风格的单行工具摘要、状态、耗时、参数与结果展开，失败项自动展开，工具事件按调用 ID 配对。历史消息使用相同卡片。日志界面脱敏常见密钥与图片数据，使用文本节点展示工具数据。

纯文本直接对话通过真实 SSE 接收增量，界面以约 55 字符/秒显示；非流式或工具任务的最终回答也采用同样的缓慢展示。提供“立即显示”，尊重系统减少动态效果设置。多模型任务不混合多个子任务的文本流，只有单文本直接工作流使用该增量入口。

## 验证

- 59 项相关自动化测试：模型路由、Agent、工作流、免费通道、QQ 分段及新增 Harness 边界测试。
- 原版 headless 实际文件工具测试：本机模拟模型请求真实 `read` 工具，返回文件中的校验文字，生成 11 条事件记录；该测试组合实际提供 25 项工具，无外部模型调用。
- 隔离 Electron 验证：70 项参考清单、逐字输出与立即显示、真实 SSE、展开输入/结果、失败提示、紧凑深色布局、同风格风险确认、IPC 启动原版认证页面与进程停止。无 renderer 错误。

命令：`node desktop/verify-harness-tools.mjs`、`npx electron desktop/verify-harness.mjs`。

## 依赖与许可

源项目：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，MIT，Copyright (c) 2026 DeepSeek。完整许可保留为 `desktop/harness-runtime/LICENSE.deepseek-harness`，所有随包依赖保留各自许可。

运行时依赖单独固定于 `desktop/harness-runtime/package-lock.json`，可用 `npm ci --ignore-scripts` 重建 JavaScript 依赖。附带 Node 25.6.0 Windows x64（当前 Electron 的 V8 指纹不受官方底层加载器支持，所以运行时使用独立 Node），许可位于 `bin/LICENSE`，二进制 SHA256：`1448db441895712bf3eb82102cb6bac80f7b95a62c83ecbc856021d4f9e4d50c`。插件包管理使用附带的 pnpm 10.20.0。
