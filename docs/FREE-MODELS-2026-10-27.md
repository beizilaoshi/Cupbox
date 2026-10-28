# 免费模型接入复查（2026-10-27）

已阅读 GitHub 上这些 dsh 项目的文档，只参考接入设计，没有执行其安装脚本：

- [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)：公开模型目录、免费标记与渠道隔离。
- [yu-wenchao/dsh-opencode-free-models](https://github.com/yu-wenchao/dsh-opencode-free-models)：OpenCode 模型发现。
- [STARKTANG108/dsh-free-models](https://github.com/STARKTANG108/dsh-free-models)：需要用户注册取得密钥，不属于免登录方案。
- [yu-wenchao/dsh-free-models-hub](https://github.com/yu-wenchao/dsh-free-models-hub)：免费额度导航与用户自行填Key，不当作匿名可用服务。

Kilo 公开 `/api/gateway/models` 返回200，当时列出17个 `isFree: true` 条目。使用无Authorization、无设备伪装、无指纹工具的标准请求，以下5个模型真实返回了完整算式 `17+23-8+5=37`：

- `kilo-auto/free`
- `reflection/beam-free`
- `dots-studio/dots-3-note-preview:free`
- `nvidia/nemotron-3.5-super-vl:free`
- `stealth/glyph-cluster`

另12个仅确认在免费目录中，没有逐个推理验证。目录条数、模型和政策可能变化，应用动态获取。每次推理先复查目标仍标记免费，变为收费或不在清单就拒绝提交。没有鉴权绕过、没有轮换身份或额度规避，也不自动转到其他供应商。

OpenCode 新的 `/inference/v1/models` 可读，但匿名推理实测429额度限制，因此不重新加入可用通道。Vireonix上午曾可用，本轮复查模型接口返回502：保留已有独立选择并显示缓存状态，不把它当作唯一可用来源。

Kilo目录明确说明部分上游可能留存提示词用于改进服务。免费不等于隐私保护或长期可用。初次打开免费模型页会更新目录；也可点“刷新列表”和“检测连接”。只有明确开启免费模型总开关后才可用于对话。

同时修复工具箱会话删除：`experience.js` 原先覆盖了 `interactions.js` 的 `CupboxUX` 对象，丢失确认弹窗函数。现改为合并界面能力，并让真实文件删除错误返回界面。隔离桌面测试分别删除了非当前会话和当前会话，核对文件与列表均消失。
