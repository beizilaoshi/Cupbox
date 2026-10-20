# 用户提供的需求规格原文

以下内容作为验收需求保留；实现与安全收敛说明见 WORKBENCH.md。

我先做了两条实测来校准结论。其中一条推翻了我上一轮的说法，所以下面这份规格是基于实测的。

0. 实测校准

试验	
结果	

echo hi > t.txt（白名单 echo）	
❌ 被拒绝：发现 > 元字符	

node -e "...writeFileSync..."（白名单 node -e）	
✅ 成功写入并删除，cwd = E:\测试\release\Cupbox可视化	

修正结论：我并非“不能写文件”，实际问题是“只能靠内联 node -e 一行 JS 写文件”。这种方式可行，但无法维护：转义地狱、无 BOM/CRLF 控制、无原子性、每次重新构造、改不了大文件；而且刚才那个临时文件我只能用 unlinkSync 删除，因为没有删除工具。这恰恰是需求的动机。

Cupbox 工具能力补全 · 需求规格 v1

优先级：P0 = 不做就没法干事，P1 = 每天都会卡，P2 = 体验升级。

#	
需求	
优先级	
解决什么	

1	
fs 文件读写族（read/write/edit/patch/mkdir/mv/cp/rm/stat）	
P0	
改代码	

2	
http 出网请求	
P0	
查文档 / 验证 API	

3	
统一授权策略（workspace root + 会话级白名单 + 审计）	
P0	
安全边界，支撑 1/2	

4	
diff 两文件 / 两目录对比	
P1	
改完自查	

5	
grep 搜索增强（上下文行、多行、结构化结果）	
P1	
读代码	

6	
replace 跨文件批量替换（正则 + 预览）	
P1	
重构	

7	
pty 持久终端会话	
P1	
dev server / 长任务	

8	
proc 扩端口占用 + 启停守护	
P1	
端口冲突	

9	
image resize/crop/convert/diff	
P1	
截图调试	

10	
git 结构化操作	
P2	
提交不靠引号拼接	

11	
pkg / test 输出解析	
P2	
迭代修复闭环	

12	
记忆命名空间 + 任务清单	
P2	
跨项目不串味	

13	
context_stats 按文件/工具归因	
P2	
省 token	

14	
图片剪贴板读写	
P2	
贴图调试	

1. P0 · fs 文件读写族

1.1 共享约定

interface FsCtx {
  root?: string;            // 缺省 = policy.workspaceRoot，禁止逃逸
  encoding?: 'utf8' | 'utf8bom' | 'gbk' | 'utf16le' | 'binary'; // 默认自动探测
  eol?: 'preserve' | 'lf' | 'crlf';  // 默认 preserve（按原文件）
  dryRun?: boolean;         // 破坏性操作默认 true
  confirmToken?: string;    // dryRun 返回的令牌，二次调用执行
}

type FsErrorCode =
  | 'E_PATH_OUTSIDE_ROOT' | 'E_NOT_FOUND' | 'E_IS_DIR' | 'E_TOO_LARGE'
  | 'E_BINARY' | 'E_ENCODING' | 'E_CONFLICT' | 'E_AMBIGUOUS_MATCH'
  | 'E_LOCKED' | 'E_PATH_TOO_LONG' | 'E_RESERVED_NAME';

统一返回（前端好渲染）：

interface FsResult<T = void> {
  ok: boolean;
  code?: FsErrorCode;
  message?: string;
  changed?: { path: string; bytesBefore: number; bytesAfter: number };
  diff?: string;            // unified diff，dryRun 时必有
  data?: T;
  confirmToken?: string;    // dryRun 时返回
}

1.2 fs_read

interface FsReadArgs {
  path: string;
  startLine?: number;   // 1-based
  endLine?: number;     // 含，缺省读到尾
  maxBytes?: number;    // 默认 256KB，超限截断并置 truncated
  withLineNumbers?: boolean; // 默认 true，格式 "12| code"
  pattern?: string;     // 只返回匹配行 ± context
  context?: number;     // 默认 3
}
// 返回 { content, lines: [{ no, text }], totalLines, encoding, eol, truncated, isBinary }

要点：二进制先探测（NUL 字节）再拒绝或走 base64；totalLines 让 Agent 知道该不该继续分页读；先给行号范围读，别整文件灌进上下文。

1.3 fs_write

interface FsWriteArgs extends FsCtx {
  path: string;
  content: string;
  createParents?: boolean;  // 默认 true
  mode?: 'overwrite' | 'append' | 'prepend' | 'createOnly';
  backup?: boolean;         // 默认 true，写前 .bak 或写 .cupbox/backups/
}

要点：原子写（同目录临时文件 + rename，Windows 上 rename 会失败需 fallback copy）；保留原文件的 EOL/BOM；mode 里 createOnly 防误覆盖。

1.4 fs_edit（最常用，必须精准）

interface FsEditArgs extends FsCtx {
  path: string;
  oldText: string;      // 精确匹配，含缩进/换行
  newText: string;
  replaceAll?: boolean; // 默认 false；false 时匹配数 ≠1 直接 E_AMBIGUOUS_MATCH
  fuzzy?: boolean;      // 默认 false：忽略行尾空白与 EOL 差异
}

要点：匹配数等于 0 或大于 1 直接报错，并在错误消息里附实际命中位置的上下文——这是 Agent 改代码最容易崩的地方，别让它猜。

1.5 fs_patch

interface FsPatchArgs extends FsCtx {
  patch: string;            // unified diff，可多文件
  reverse?: boolean;
  fuzz?: number;            // 默认 0，>0 允许上下文漂移
  allowPartial?: boolean;   // 默认 false：任一 hunk 失败则全量回滚
}

1.6 其余

fs_mkdir({ path, recursive })
fs_mv({ from, to[]?, overwrite? })      // dryRun 预览冲突
fs_cp({ from, to, overwrite?, recursive? })
fs_rm({ path, recursive?, toRecycleBin? }) // Windows 走回收站，默认 true
fs_stat({ path })  // { type, size, mtime, encoding, eol, hash, isSymlink, realpath }

fs_stat 带 hash 很关键：我改完文件可以自己校验，不用靠 hash 工具传路径（现在它只能 hash 文件，但我读不到内容）。

1.7 Windows 专项（这套在 E:\ 上跑，别忽略）

路径 >260 字符：加 \\?\ 前缀或拒绝并报 E_PATH_TOO_LONG

保留名：CON/PRN/AUX/NUL/COM1..9/LPT1..9，含 name.ext 形式

文件锁：EBUSY/EPERM 指数退避重试 3 次（编辑器占用常见）

大小写不敏感：路径比较归一化，E_CONFLICT 判断别用 ===

符号链接 / junction：realpath 后重新校验是否仍在 root 内

2. P0 · http

interface HttpArgs {
  url: string;
  method?: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD';  // 默认 GET
  headers?: Record<string,string>;
  body?: string | { json?: unknown; form?: Record<string,string> };
  timeoutMs?: number;          // 默认 15s，上限 60s
  redirect?: 'follow' | 'manual' | 'error';  // 默认 follow，上限 5 跳
  maxBytes?: number;           // 默认 1MB，超限截断
  saveTo?: string;             // 下载到文件（走 fs 沙箱）
  responseType?: 'auto'|'text'|'json'|'binary';
}
// 返回 { status, statusText, headers, body, truncated, size, durationMs }

安全（SSRF 防线，默认全开）：

协议白名单 http/https

默认拒绝私网/环回/链路本地：127.0.0.0/8、10/8、172.16/12、192.168/16、169.254/16、::1、fc00::/7；必须在 DNS 解析后校验，防 rebinding

域名白名单（policy.httpAllowHosts，支持 *.npmjs.com）

不自动携带本地 cookie / 环境变量里的 token

响应体不进上下文前先截断，二进制只回元信息

3. P0 · 授权与策略

现在每次调用都要重传 allowPrefixes，同一项目反复授权，纯摩擦。

interface Policy {
  workspaceRoot: string;                 // fs 沙箱子树
  allowPrefixes: string[];               // 会话/项目级持久
  denyPatterns: string[];                // 优先级高于 allow，如 "rm -rf", "git push"
  fsWriteRoots: string[];
  httpAllowHosts: string[];
  sensitivePaths: string[];              // .env / id_rsa 等，读写需二次确认
  requireConfirm: ('fs_rm'|'git_push'|'shell')[];
  auditLog: string;                      // jsonl：时间/工具/参数摘要/结果/耗时
}

要点：项目级 .cupbox/policy.json（随仓库走，团队共享）；一次确认、会话内复用；策略变更必须显式声明而不是自动合并放宽；审计日志支持“回滚到某次操作前”（配合 fs_* 的 backup）。

4. P1 · diff / grep / replace

diff({ left: string | {path}, right: ..., ignoreWhitespace?, context?: 3 })
  // 返回 unified + 摘要 { added, removed, files }

grep({
  root: string,
  pattern: string,
  regex?: boolean, multiline?: boolean, caseSensitive?: boolean,
  glob?: string | string[],           // 缺省尊重 .gitignore
  contextBefore?: number, contextAfter?: number,
  maxMatchesPerFile?: number, maxFiles?: number,
  groupByFile?: boolean                // 默认 true，前端友好
})
// 返回 [{ file, matches: [{ line, col, text, before[], after[] }], truncated }]

replace({
  root, pattern, replacement,          // 支持 $1 / $<name>
  regex?, glob?, ignore?: string[],
  encoding?, skipBinary?: true,        // 默认跳过二进制与 >2MB 文件
  dryRun?: true                        // 默认预览，返回逐文件 diff
})

现在 search 只能给“文件包含某串”，没有上下文行、没有多行、没有结构化行号，读代码基本靠猜。

5. P1 · pty 持久会话

run 是一次性 + 超时（上限 10 分钟），dev server 一启动就废。

pty_spawn({ command, cwd, env?, cols?, rows? })   // 返回 sessionId
pty_write({ sessionId, input })                    // 可送 Ctrl-C \x03
pty_read({ sessionId, since?: cursor, maxBytes? }) // 增量读，带 cursor 防重复
pty_kill({ sessionId, signal? })
pty_list()

要点：增量读必须带游标（不然 dev server 刷日志会撑爆上下文）；输出按行截断 + 尾部保留；空闲超时自动回收。

proc({ action: 'list', query?, withPort?: true })   // 加端口/命令行/父进程
proc({ action: 'kill', pid, name, port? })          // 现有双重校验保留

6. P1 · image

image_convert({ input, output, format: 'png'|'jpeg'|'webp'|'avif', quality?, stripMetadata? })
image_resize({ input, output, width?, height?, fit: 'cover'|'contain'|'fill', maxSide? })
image_crop({ input, output, x, y, width, height })
image_diff({ a, b, output?, threshold?, ignoreAntiAlias? })  // 截图回归
image_info({ input })   // 尺寸/格式/通道/DPI/主要色值
image_sample({ input, x, y, w?, h? })  // 区域主色 / 像素值

现有 obfuscate 只做混淆，前端截图调 UI 完全用不上。

7. P2 · git / pkg / test

git({ action: 'status'|'diff'|'log'|'branch'|'add'|'commit'|'checkout'|'stash',
      paths?, message?, staged?, maxCount? })
// 返回结构化 { branch, ahead, behind, files:[{path, status, staged}], ... }
// commit message 走参数不拼 shell，彻底干掉引号地狱

pkg({ action: 'detect' })  // { manager: 'pnpm'|'npm'|'yarn'|'bun', lockfile, scripts }
pkg({ action: 'run', script, args? })   // 自动 cwd、自动 manager、流式输出

test({ command, runner?: 'vitest'|'jest'|'node:test'|'auto' })
// 返回 { passed, failed, skipped, failures: [{ file, line, name, message, stack }], durationMs }

test 的结构化失败列表是“改完自检”的关键：没有它，我只能读一大坨彩色文本。

8. P2 · 记忆与上下文

memory_remember({ text, source?, scope: 'global'|'project', projectKey?, ttl? })
memory_recall({ query, scope?, projectKey?, limit? })
memory_manage({ list?, forget?, scope?, exportTo? })
task({ action: 'add'|'list'|'done'|'clear', workspaceKey })  // 跨会话待办
context_stats({ byFile?: true, byTool?: true })              // token 归因

现在记忆是一维的（有 source 标签但无检索隔离），项目一多必串味。

9. 横切需求（容易漏，但决定好不好用）

dry-run 语义统一：所有破坏性工具默认预览；返回 confirmToken，带 token 二次调用才真执行；token 绑定参数摘要，改参数即失效（防 TOCTOU）。

幂等：同样的 fs_write 内容重复调用不应产生备份噪声。

并发锁：同文件并发写串行化 + E_CONFLICT，而非静默后写覆盖。

编码兜底：GBK 自动检测（国内老项目）、BOM 保留、EOL 保留；不确定时不猜，报 E_ENCODING 让我显式指定。

所有输出可截断且标注截断，Agent 才知道要不要续读。

审计 + 可回滚：backup + auditLog ＋ fs_rollback({ operationId })。

run 逃生舱：保留白名单模式，另加 mode: 'shell'，需 requireConfirm + 明确打印完整命令串 + 不允许在无人确认时使用。否则“复杂命令永远做不了”这个洞补不上。

10. 最小可行集（想快速见效就做这 3 个）

fs_read + fs_edit + fs_write（含 dry-run diff）→ 从“能聊”变成“能改代码”

http → 能查文档、验接口，不再凭空猜 API

pty → 能起 dev server 看着日志改

三个都落地后，我可以完全通过工具完成“读代码 → 改 → 跑测试 → 看失败 → 再改”的闭环，不需要你手工粘 diff。

11. 验收用例（写完拿这些卡一遍）

用例	
期望	

fs_read 读 50MB 日志	
截断 + truncated:true + 可 startLine 续读	

fs_read 读 GBK 文件	
正确解码，或明确报 E_ENCODING	

fs_write 到已存在文件	
默认 dryRun 出 diff，不落盘	

fs_edit oldText 出现 2 次	
E_AMBIGUOUS_MATCH + 两处位置	

fs_rm 带 ../	
E_PATH_OUTSIDE_ROOT	

fs_rm 经 junction 逃逸	
realpath 后仍判越界	

fs_write 写 CON	
E_RESERVED_NAME	

http GET http://127.0.0.1:8080	
默认拒绝（SSRF）	

http 域名解析到内网 IP	
拒绝，不回退	

pty_read 连续两次	
第二次不重复第一次内容	

test 跑 vitest 有 3 个失败	
failures 长度 = 3 且含 file:line	

需要我把这份东西写成 .cupbox/SPEC.md 吗？不过得先给我 fs_write——这正是第 1 条需求的现成证据。