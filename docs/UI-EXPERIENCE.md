# 界面与交互更新

入口和现有功能保持一致，版本按用户要求固定为 1.0.3。

- **启动**：默认“晴窗启程”，使用独立生成的樱花晴窗插画，逐层显示品牌与文案；深色模式加深遮罩。风景、极简和本地 GIF / 视频 / 图片继续支持。可以跳过、按 Esc 跳过或关闭动画；系统减少动态效果时直接进入。装饰动效不表示真实下载或加载百分比。
- **通知**：带图标与标题的成功、提醒、错误、普通提示；最多同时显示三条。普通提示默认 6.5 秒，悬停或键盘聚焦时暂停；错误需手动关闭。右上角通知中心保留本次启动最近 30 条记录，支持清除。通知正文使用文本节点，支持屏幕阅读器播报，不存入磁盘。
- **风险确认**：文件修改、删除、代码执行、网络、剪贴板、敏感访问、策略分别说明后果；优先显示目标与工作目录，变更预览和技术参数分开展示。密钥字段与确认令牌在参数展示中隐藏。高风险删除、终止进程、策略变更需勾选确认。焦点默认位于拒绝按钮，Esc 拒绝，Tab 限制在对话框；操作结束后恢复焦点与原有界面交互。
- **权限切换**：从其他模式开启完全控制前显示风险说明并要求勾选；从沙箱切到本机前说明影响。取消不会保存设置。完全控制在设置和输入区持续显示警示颜色；并不取消执行层对 Shell、敏感文件和策略变更的人工批准要求。
- **其他体验**：统一设置页标签、字号、留白、卡片与按压反馈；开发工具显示中文名称、字段标签与明确空状态，切换工具清除旧结果；文件预览和提交分开。删除和清空任务改成居中确认，失败不会假装完成。命令工具移除失效的调用方白名单字段，明确选择可信项目白名单或 Shell 逐次批准；批量修改、进程终止、剪贴板和截图等操作在运行前展示风险。

风险图形仅辅助辨认，所有决定、警告和状态仍有可选择和可朗读的真实文字。

## 视觉资源

- `desktop/ui/assets/startup-atelier.png`：通过内置 **image_gen** 生成，新的项目资产；原主题插画继续保留。
- `desktop/ui/assets/ui-warning.svg`、`ui-success.svg`、`ui-info.svg`：项目内原创 SVG，分别用于警示、完成与提示；不把文字绘制进图片。
- 对应实现：`desktop/ui/interactions.js`、`interactions.css`、`risk-model.js`、`startup.js`、`execution.js`。

### 启动插画最终提示词

Use case: stylized-concept. Asset type: polished desktop productivity app startup illustration, landscape 16:9, no text. Primary request: a calm, welcoming pastel anime illustration in the delicate luminous sakura fantasy style of a cozy companion workspace. Scene: a sunlit open window overlooking soft blue clouds and distant spring hills, cherry blossoms framing the window, a tidy ivory desk with a small notebook and a translucent blue glass cube catching a star of light, tiny white cat asleep beside the notebook. Composition: cinematic airy wide shot, main illustrated desk and window on right two thirds, left third pale ivory lilac negative space for live accessible UI typography. Style: refined hand-painted anime background, soft detailed brushwork, subtle paper texture, restrained sparkles, blue/lavender/blush pink with warm light, elegant and quiet. No characters, no lettering, no logos, no watermark, no UI buttons, no busy pattern. Output one finished illustration.

## 检查

新增 `desktop/verify-experience.mjs` 使用隔离测试目录验证通知持久性与正文转义、确认与取消、权限保存、真实删除的批准前后状态、Shell 警示、焦点隔离、紧凑窗口、减少动态效果。原界面、回复和开发能力检查继续运行。模型测试只使用本地模拟服务。

Windows 执行沙箱内启动 Electron 会被当前 ACL 拒绝。界面检查使用执行沙箱外的隔离测试进程，不修改系统 ACL，也不关闭 Electron 自身沙箱。
