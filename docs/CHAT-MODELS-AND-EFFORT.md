# 免费模型、对话选择与思考深度

版本固定为 **1.1.0**。

## 使用

1. 点击对话输入框中的模型按钮，搜索并选择默认连接、独立模型或已启用的免费模型。按钮显示当前模型及深度。要新增连接，点“管理模型与连接”。
2. 在同一个菜单拖动“思考深度”，也可点击档位名称或用方向键 / Home / End 操作。调整对下一次发送生效；请求进行中禁止切换。默认档不发送强度字段，交由提供方决定。档位按所选模型变化，不是所有模型都有“关闭”或“最高”。
3. 每个模型分别记住深度，切回时恢复；成功对话保存当次模型、调用能力和深度，重新打开历史时恢复。停用或删除后的模型保持失效提示，不自动换到其他服务。对话文件不保存 API Key。
4. 免费模型在“设置 → 免费模型”中开启，点“刷新目录”获取候选；可以逐项启停、发送一个小请求检测连接、直接“用于对话”。通常从本机缓存读取，打开菜单不会自动消耗推理额度。检测成功仅说明当次可用，不能保证后续请求成功。

## 能力与边界

- 免费服务是第三方公共通道，当前仅接入文本问答。当前消息和相关会话历史会发送到该服务；不要发送私人或敏感内容。总开关默认关闭。关闭总开关或单模型开关后拒绝新的该模型请求；不影响付费连接、也不把付费密钥发给免费网关。
- 上游已封禁的 OpenCode 通道只展示状态，不允许选用或检测；没有为了可用性绕过封禁。目录和缓存不是服务可用性的承诺。
- 免费模型未声明推理参数支持时，滑块只保留默认，不凭模型显示名伪造支持。目前免费通道没有接入视觉、工具执行或多媒体生成，因此不会因目录里的视觉标记就开放这些能力。
- OpenAI 兼容已识别推理型号使用 `reasoning_effort`；DeepSeek 思考模式适配使用 `thinking.type` 与 `reasoning_effort`；OpenRouter / 已声明兼容参数的免费模型使用 `reasoning.effort` 或关闭标记。
- 未识别型号、专用接口型号或当前不支持调节的 Anthropic 连接会禁用滑块。自定义网关可在连接的高级参数里明确指定适配方式；需要与实际服务文档相符。不能保证中转服务接受或执行同名参数。
- 高深度通常更慢、用量更多；不是答案质量保证，不是输出长度设置。思考连续性字段仅用于当前工具循环，不混入最终正文或会话记录。
- 保留系统减少动态效果设置。高档位用紫色和轻量星点表示，文字与键盘操作不依赖动画。

## 参考与复用

界面交互参考 [Microqian2th/dsh-codex-effort-slider](https://github.com/Microqian2th/dsh-codex-effort-slider)：将滑块放在模型菜单、按档位着色、高档位增加星点。该仓库为 DSH 插件，不能直接用于本项目的 Electron 静态界面；本实现独立编写，没有安装或执行其插件代码，也没有改变其原仓库。

参数分别核对 [OpenAI Reasoning models](https://developers.openai.com/api/docs/guides/reasoning?api-mode=chat)、[DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)、[OpenRouter Reasoning Tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)。模型支持会变化，不认识的型号保持默认或显式配置适配方式。

实现：`src/core/reasoning.ts`、`desktop/chat-models.js`、`desktop/ui/chat-picker.js`。新增测试 `test/chat-choice.test.ts` 和 `desktop/verify-chat-picker.mjs` 验证实际发送字段、深度连续性、免费隔离、开关与取消。界面联调用本机模拟模型服务，没有使用真实账号、密钥或免费额度。
