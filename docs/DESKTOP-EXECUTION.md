# 桌面模型连接、执行权限与工具工作区

## 模型连接

设置 → 模型连接，提供硅基流动、DeepSeek、OpenAI / GPT、Anthropic / Claude、OpenRouter、Ollama、LM Studio 和自定义服务八种预设。选择预设后填写对应密钥，再获取模型列表或直接输入模型 ID，最后保存。

获取模型列表使用当前输入的连接参数，不需要先保存。模型是否可调用取决于服务商和账号权限。Ollama、LM Studio 预设仅在地址为本机回环地址时允许不填密钥。

更换服务商或地址不会自动复用原服务的密钥；渲染界面只能看到是否已配置密钥，不会收到已保存密钥的明文。配置仍保存在本机原有的 `~/.cupbox/config.json`。

## 权限模式

这些设置作用于桌面本地工具，以及桌面 Agent 的每一次工具调用。CLI / MCP 继续保留原有默认行为。

| 模式 | 行为 |
| --- | --- |
| 请求批准 | 每次工具调用都显示操作、完整参数、执行环境和目录，批准后才执行 |
| 智能批准 | 文本转换、工作区内读取和预览自动执行；写入、区外访问、剪贴板等系统操作请求批准 |
| 完全控制 | 已启用工具免交互确认；工具自身的白名单、冲突处理和参数校验仍有效 |

拒绝操作不会执行对应工具。单次批准只对应当前操作，不能被其他窗口或后续调用复用。窗口关闭时会取消待批准请求。修改设置不会把已经等待批准的操作切换到另一执行环境。

## 沙箱与本机运行

默认使用智能批准和文件沙箱。沙箱是应用管理的独立文件目录与 Node 权限受限子进程，不是虚拟机。它处理已导入的副本，保留原文件；只允许指定目录的文件访问，禁止网络、子进程和系统工具。工作进程不接收服务商密钥环境变量，设置内显示实际沙箱目录。

- 支持沙箱：哈希、时间、编解码、CSV、搜索、重命名、整理、图片像素混淆。
- 需要本机：压缩包、OCR、剪贴板、截屏、命令、进程管理。
- 文件导入、打开文件选择框属于用户主动的素材选择；模型请求在主进程通过已配置的模型服务发送。
- 系统工具会显示切换本机入口；切换后仍按权限模式进行批准判断。

进入工具库可直接导入文件或打开沙箱目录。沙箱会拒绝越界路径和链接绕行，并限制工作进程时长、内存及输出。它只运行预置工具，不提供任意代码执行能力。

## 本地工具

工具库是独立工作区，提供分类卡片与全局搜索。点击卡片后进入输入 / 结果工作区，路径可通过选择器填写，常用文本工具提供示例。搜索、批量变更、哈希、时间和进程等结果以列表或表格展示，并可展开原始 JSON。切换工具保留当前运行期间的输入和最近结果。

## 接口参考

- [硅基流动 Chat Completions](https://docs.siliconflow.cn/docs/api/chat-completions-post)
- [DeepSeek API](https://api-docs.deepseek.com/guides/codex)
- [OpenAI GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [Anthropic 模型列表](https://platform.claude.com/docs/en/api/models/list)
- [Ollama OpenAI 兼容接口](https://docs.ollama.com/api/openai-compatibility)
- [OpenRouter 接口](https://openrouter.ai/docs/api_reference/overview)
- [Node 权限模型](https://nodejs.org/api/permissions.html)
