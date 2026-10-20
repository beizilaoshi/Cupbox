# 开发工具与安全授权（桌面 Agent）

本次根据用户提供的《Cupbox 工具能力补全 · 需求规格 v1》实现桌面工具接口。入口为 **设置 → 开发与授权**；对话选择 **执行任务** 时，AI 使用相同的执行层。现有 CLI / MCP 服务继续保留原有工具集，本页的 36 项扩展通过桌面 Agent 与桌面 IPC 提供。

## 需求对应

| 规格 | 实现 |
| --- | --- |
| P0 文件族 | `fs_read/write/edit/patch/mkdir/mv/cp/rm/stat/rollback` |
| P0 出网请求 | `http`：GET/POST/PUT/PATCH/DELETE/HEAD、JSON/form、重定向、截断、预览下载保存 |
| P0 统一授权 | 固定工作目录、本机可信策略、仓库提案需确认、域名会话授权、敏感路径强制确认、JSONL 审计 |
| P1 对比 | `diff`：文件 / 目录 unified diff 与增删统计 |
| P1 搜索与替换 | `grep`：结构化行列及上下文、多行；`replace`：逐文件预览，正则捕获组替换 |
| P1 持久终端 | `pty_spawn/write/read/kill/list`，真实 ConPTY，增量游标和尾部缓冲，空闲 10 分钟回收 |
| P1 进程 | `proc`：原有 PID+名称校验，扩展端口校验、父 PID、脱敏命令行，以及以 PTY 承载的后台任务启停 |
| P1 图片 | `image_convert/resize/crop/diff/info/sample`，PNG/JPEG/WebP/AVIF 输出 |
| P2 Git | `git`：status/diff/log/branch/add/commit/checkout/stash，参数数组调用；写操作两阶段预览 |
| P2 项目脚本与测试 | `pkg detect/run`，脚本运行返回持久终端；`test` 解析 Vitest/Jest JSON 与 Node TAP |
| P2 记忆与待办 | `memory_remember/recall/manage` 默认 project，支持显式 global 与 TTL；`task` 按项目跨会话保存 |
| P2 上下文归因 | `context_stats` 按工具 / 文件累计返回内容的近似 token；不是精确 tokenizer 或提供方账单 |
| P2 图片剪贴板 | `clipboard_image read/write`，仅桌面本机模式，始终请求批准 |

## 使用顺序

1. 本机模式先选择工作文件夹；沙箱模式使用应用隔离目录。文件路径可以相对工作目录，也可传该目录内的绝对路径。
2. 写入、编辑、补丁、复制、移动、删除、批量替换、图片输出和文件回滚默认只预览。结果包含 `diff` 和 `confirmToken`。
3. 使用**同样的参数**追加 `dryRun:false` 与 `confirmToken` 提交。令牌有效 5 分钟、一次性使用，绑定工具、会话、工作目录、参数与原文件快照；文件或参数变化应重新预览。每个会话最多缓存 4 个待提交预览。
4. 智能批准对文件修改仍请求批准，批准窗口包含可复查的 diff。开发界面的“执行这次预览”按钮会自动携带对应令牌；编辑输入或切换会话会使该按钮失效。
5. 已成功修改的文件会返回 `operationId`；使用 `fs_rollback` 再次预览、确认后恢复。目标如果又被修改，会拒绝覆盖。

```json
{"name":"fs_write","args":{"path":"src/example.ts","content":"export const answer = 42;\n","mode":"createOnly"}}
```

得到预览令牌后：

```json
{"name":"fs_write","args":{"path":"src/example.ts","content":"export const answer = 42;\n","mode":"createOnly","dryRun":false,"confirmToken":"上次返回的令牌"}}
```

新文件、空目录复制和跨文件批量修改也采用同一预览约定。`changed` 为数组，以兼容单文件与多文件事务。多目标移动请拆成多个单目标预览。`root` 不会替换工作目录安全边界，子目录操作应体现在 `path` 或搜索的 `root` 中。

## 文件保障与限制

- 读取流式扫描行数，默认返回最多 256 KB，可使用行号继续读取；超限明确返回 `truncated`。模型上下文中的二次压缩仍保留可解析 JSON、令牌、总行数及继续读取位置。
- UTF-8 / UTF-8 BOM / UTF-16LE BOM 自动识别。GBK 不能可靠判定时返回 `E_ENCODING`，显式指定 `encoding:"gbk"` 可无损读写。BOM 和原 EOL 默认保留。
- 二进制普通文本读取返回 `E_BINARY`，显式 `encoding:"binary"` 时读写标准 base64。
- `fs_edit` 默认唯一精确匹配；无命中或多命中返回 `E_AMBIGUOUS_MATCH` 和位置。`fuzzy:true` 只忽略行尾空白和 EOL，保留未匹配区域。
- `fs_patch` 先验证所有 hunk，再提交。拒绝 `allowPartial:true`；可反向应用，fuzz 限制为 0–2。
- 文件写入使用同目录临时文件和 rename，文件占用退避重试。**不以普通 copy 覆盖作为失败兜底**，避免把“原子写”降级为部分写入。
- 默认始终保留恢复材料；`backup:false` 不会取消安全备份。删除在 Electron 使用系统回收站；非桌面测试环境使用私有可恢复隔离区。拒绝 `toRecycleBin:false` 永久删除。
- 拒绝 `..` 越界、符号链接 / junction、Windows 设备名及 ADS，超过安全长度 250 字符明确拒绝。项目策略目录和应用私有授权 / 审计 / 备份存储不能由 AI 文件工具改写。
- 文件提交按工作目录跨会话串行化，提交核对快照。多文件失败会尝试恢复已写入文件；外部进程恶意并发、磁盘故障或锁定导致恢复失败时，备份仍保留，不承诺跨进程的系统级事务。
- 单次文本写入最多 8 MB，修改单文件最多 64 MB，事务缓存总量最多 64 MB；目录操作最多 3000 个文件、删除备份最多 100 MB。请对更大任务分批处理。
- `grep/replace` 默认忽略常见生成目录，读取根目录 `.gitignore`，跳过二进制和超过 2 MB 的文件；复杂或高风险正则明确拒绝。

## 策略与网络

策略实际保存在本机数据目录 `policies/<workspace hash>.json`。项目 `.cupbox/policy.json` 只是团队共享的**提案**，必须在开发与授权界面读取、核对、保存并批准。不会自动合并放宽，也不会信任模型传来的 `allowPrefixes`。

```json
{
  "workspaceRoot":"E:\\你的项目",
  "allowPrefixes":["node -v"],
  "denyPatterns":["git push","rm -rf","format ","diskpart","shutdown "],
  "fsWriteRoots":["."],
  "httpAllowHosts":[],
  "sensitivePaths":[".env","id_rsa","id_ed25519",".npmrc",".pypirc","credentials"],
  "requireConfirm":["fs_rm","git_push","shell"]
}
```

- `workspaceRoot` 不能通过策略重定向，`fsWriteRoots` 必须位于该工作目录内。拒绝规则优先于白名单。
- 敏感文件访问、策略变更、Shell 和非 Ctrl-C 终端输入，**即使完全控制模式也需要明确人工批准**。
- 命令白名单是对本机程序的授权，不是 OS 沙箱。解释器、项目脚本和依赖代码本身可以影响本机；不要把宽泛的解释器前缀当作路径隔离。白名单模式不使用 shell 拼接，并固定可执行文件位置，避免仓库放置同名程序劫持查找。
- `mode:"shell"` 是明确的逃生舱，会完整展示命令与目录，每次请求批准；不会因项目白名单或完全控制而无人执行。
- 终端、进程、Git、项目脚本、测试与剪贴板不在文件沙箱模式下运行。沙箱是应用的目录与能力边界，**不是虚拟机或针对已批准本机代码的操作系统安全边界**。
- HTTP 只允许 HTTP/HTTPS，无内嵌 URL 凭据。DNS 的所有返回地址均检查，实际连接复用固定地址集，重定向逐跳重查；拒绝私网、环回、链路本地、保留地址及 IPv4 映射 IPv6。没有“域名允许就放行私网”的后门。
- 新域名按方法与主机请求本会话授权，也可由明确保存的主机白名单允许；非读取 HTTP 方法继续遵循批准策略。跨域不转发认证及自定义密钥头，不读取本机 Cookie 或环境变量中的凭据。
- 禁止 Host、Cookie、代理认证等危险请求头；默认超时 15 秒、最多 60 秒、重定向最多 5 跳、响应默认 1 MB。二进制仅返回元信息；下载保存另走文件预览令牌，提交下载不会再次发起请求。

## 审计、终端与测试

- 审计统一追加到数据目录 `audit.jsonl`，执行前先记录 started；开始审计不可写时拒绝操作，完成审计失败则保留真实结果并提示。记录包含时间、工具、路径/URL 摘要、结果、耗时与文件操作 ID。不会记录正文、密钥头、URL 查询参数或终端原始输入内容。审计位置固定在应用私有数据目录，不能通过项目提案重定向覆盖文件。
- `pty_read` 可传 `since`，也可使用上次游标。输出保留有界尾部，游标过期时明确截断。`pty_kill` 仅操作本项目会话持有的终端，等待退出；后台任务可通过 `proc` 的 start/stop/list-daemons 操作。
- `pkg run` 返回终端 ID，使用 `pty_read` 增量查看，不让 dev server 占住一次性调用。`test` 返回失败列表以及 `parsed`，不能解析时不会声称检查通过。
- Git 默认禁用 hooks 和外部 diff，写操作绑定仓库/文件快照，始终确认提交。没有 push、强制 reset/clean、自动恢复 stash 等高风险入口；元数据越出工作目录的 worktree 默认拒绝。
- 项目记忆默认隔离，TTL 单位秒；显式 global 才跨项目。旧版已有事实与用户画像保持原有全局语义，不自动猜测归属；新保存的回复记忆与项目根关联。
- 停止 AI 请求不会自动结束已明确启动的持久终端；使用 `pty_kill` 或关闭窗口停止。窗口关闭会清理其终端。

## 复用与验证

使用 `diff`、`iconv-lite`、`ignore`、`minimatch`、`safe-regex2`、`sharp`、`pixelmatch`、`ipaddr.js`、`string-argv` 和预编译 `@lydell/node-pty`。没有把普通管道当成 PTY。原官方 MCP Filesystem 适配器保留作兼容代码，桌面 Agent 默认使用本规格的预览事务接口，避免旧的立即写入绕过令牌。

验证覆盖 50 MB 日志、GBK/UTF16/BOM、模糊与多命中编辑、补丁失败不写、目录和保留名、junction 越界、预览冲突、备份回滚、DNS 重绑定防线、重定向凭据剥离、真实 Git 带引号提交、真实像素处理、项目隔离、真实 Electron ConPTY，以及 Node / Vitest 各 3 条失败的解析。生产依赖审计单独检查；没有使用用户真实 API 密钥或执行真实仓库推送。
