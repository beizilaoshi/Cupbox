# Cupbox 本地插件接口 · API v1

应用版本保持 1.0.3，插件 API 独立版本为1。入口：QQ 工作台 → 插件中心。规则作用于**主对话最终文字**和**QQ 最终发送前文字**。内置首个插件“输出内容检测”默认关闭，先本机测试，再保存并启用。

## 首个插件怎么用

1. 在“拦截词”中逐行填写不允许发送的字面文字；默认示例为 `[禁止发送]`。
2. “脱敏词”会替换为指定占位符；两类词表各最多100条，每条1～200字。替换占位符最多200字，不允许填密钥。
3. `maxChars=0` 不额外限制长度，其他整数按 Unicode 码点计数，上限100000。
4. 测试当前草稿不会启用插件、保存规则、调用模型、发送 QQ 或写入聊天记忆。放行/替换/拦截及原因代码会显示在测试区。
5. 保存插件配置独立于“保存机器人设置”；保存会取消待发 QQ 回复，新回复读取最新规则。旧聊天不会批量改写。

检测只覆盖上述最终文字，不扫描图片、视频、工具回执、工作流进度、子任务预览、CLI/MCP 或旧聊天。不会撤销模型调用、已执行工具或已发送的工具图片。它是本机字面规则检测，不是远程内容审核服务或通用语义安全判断。现有安全限制始终优先，不能通过插件关闭。

## 插件包结构

```text
my-output-plugin/
  manifest.json
  rules.json
  README.md        # 可选，不执行
```

`manifest.json`：

```json
{
  "apiVersion": 1,
  "id": "example.output-inspector",
  "name": "我的输出检测",
  "version": "1.0.0",
  "description": "自定义发送前文字检查",
  "kind": "output-rules",
  "hook": "reply.beforeSend",
  "entry": "rules.json",
  "permissions": ["response.read", "response.block", "response.replace"]
}
```

`rules.json`：

```json
{
  "blockWords": ["[禁止发送]"],
  "maskWords": ["内部代号A"],
  "replacement": "[已隐藏]",
  "maxChars": 0
}
```

ID必须唯一，不能覆盖内置 `cupbox.output-inspector`。内置源码在 `desktop/plugins/examples/output-inspector/`，可从插件中心打开目录，复制后修改 ID。外置示例压缩包解压后可直接选择内层 `output-inspector` 文件夹导入，不直接加载 ZIP。

## 版本、权限和钩子合同

接口类型在 `desktop/plugins/api.d.ts`，宿主在 `desktop/plugins/host.js`。API v1 是**声明式插件接口**，不导入或执行第三方 JavaScript、Python、Shell、HTML、依赖安装脚本或正则表达式。未知 API、运行类型、钩子、入口路径、额外清单字段或未知权限均拒绝加载。未来代码插件需要另行设计隔离运行时，当前不支持把 `entry` 改成脚本。

| 权限 | 能力 |
| --- | --- |
| `response.read` | 检测当前最终文字，必需 |
| `response.block` | 依据词表或长度取消最终文字发送 |
| `response.replace` | 仅以固定占位符替换已配置的字面片段 |

不开权限给插件访问提示词、用户消息历史、QQ身份、密钥、记忆文件、网络或工具；也不提供自主发消息的接口。宿主负责读取用户明确导入的两个 JSON，不代表插件有文件系统权限。单文件最多128KiB，配置与条目数另有上限；最多19个外置插件。

`reply.beforeSend` 返回：

```ts
type OutputDecision =
  | { action: 'pass' | 'replace'; text: string; code: string }
  | { action: 'block'; code: string };
```

`PluginHost.apply(text, {surface, signal, guard})` 执行检测链，返回 `{allowed, text, checks}`。`surface` 为 `qq` 或 `desktop`，属于宿主上下文，不给声明式插件额外权限。`guard` 由核心程序提供，插件不能替换。运行输入最多200000 UTF-16代码单元，并在每次替换前检查扩张长度，避免规则产生无限膨胀。

检查顺序：核心安全检查 → 每个已启用插件先检查原始文字，再检查当前文字并替换 → 用全部插件的拦截词/长度复查最终文字 → 核心安全再检查 → QQ 去除内部表情标记并重新检查 → 分段发送或主窗口显示。拦截优先，替换不能掩盖其他插件对原始内容的禁止，也不能拼出之前已检查插件的禁词。内置插件在最前，外置插件按安装顺序；配置保存不改变顺序。

拦截命中支持 NFKC 和常见零宽字符归一化；脱敏为原始文本的精确、区分大小写字面替换。主要原因码：`PASS`、`MASKED`、`BLOCK_WORD`、`MAX_LENGTH`、`REPLACEMENT_BLOCKED`、`OUTPUT_LIMIT`、`FINAL_RECHECK`、`PLUGIN_UNAVAILABLE`、`PLUGIN_ERROR`、`CORE_SECURITY`。

## 安装、持久化与故障

导入只复制经过校验的 manifest.json 和 rules.json，文件链接会被拒绝，其他文件不复制、不执行。每个新插件默认停用。文件与配置保存在应用私有数据目录 `plugins/`，各插件目录名由ID散列得到，不直接拼接任意入口路径。主对话与 QQ 共用这份配置。

内置示例在程序目录，自定义规则在 `plugins/settings.json`。内置示例只能停用；外置插件可以移出登记，本机副本保留供恢复。要更新外置插件，先停用并移出，再从已审阅的新文件夹导入，重新启用。导入同ID不会静默覆盖现有配置。

宿主绑定导入清单与默认规则的 SHA256。启用的插件丢失、损坏、版本/权限不兼容或内容变化时，最终文字停止发送，不能静默绕过；可在插件中心停用并审阅。配置文件损坏同样停止检测流程。停用插件的错误不影响回复；内置示例若随软件更新发生改变，需要本机重新审阅。

QQ 控制台“插件”阶段仅记录插件ID、动作与原因代码，不写入待测文字或用户原话。主对话被拦截时显示明确错误且不把被拦截的最终答复加入成功聊天记录；工具已经发生的操作仍可能需要用户自行核查。QQ只保存实际发出的替换后文字。
