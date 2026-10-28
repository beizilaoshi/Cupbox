# 开屏公告（announcement.json）

Cupbox 每次启动都会读取 GitHub 仓库根目录的 [`announcement.json`](../announcement.json)：

```
https://raw.githubusercontent.com/beizilaoshi/cupbox/main/announcement.json
```

读取成功且检测到「新内容」时，启动动画结束后弹出公告窗口；网络失败、文件缺失或格式错误都不会打扰用户（静默跳过）。

## 文件格式

```json
{
  "id": "2026-10-21-welcome",
  "title": "欢迎使用 Cupbox 工具箱",
  "body": "正文，支持换行。\n\n第二段。",
  "publishedAt": "2026-10-21",
  "url": "https://github.com/beizilaoshi/cupbox"
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 公告标题，最多 200 字。 |
| `body` | 是 | 正文纯文本，最多 8000 字；`\n` 表示换行。 |
| `id` | 否 | 公告标识，最多 120 字；省略时用正文哈希代替。 |
| `publishedAt` | 否 | 日期或版本备注，最多 40 字，仅用于展示。 |
| `url` | 否 | 仅接受 `https://` 链接，显示「在 GitHub 查看」按钮。 |

## 更新规则

程序把 `id + title + body + publishedAt` 的哈希记为公告版本：

- **内容有变化**（改标题、正文或日期，或换 `id`）→ 视为新公告，即使之前点过「不再提示」也会再显示一次；
- **内容没变化** → 用户勾选「不再提示当前公告」后不再弹出；
- 阅读状态存在 `desktop.json` 的 `announcementSeenVersion` / `announcementMuted` 中。

因此发新公告时，只要修改 `title` / `body` / `publishedAt` 任意一项即可，建议同时更新 `id` 与 `publishedAt` 便于追溯。

## 实现位置

- `desktop/announcement.js`：拉取、校验、版本计算（`fetchAnnouncement` / `parseAnnouncement` / `shouldShowAnnouncement`）。
- `desktop/main.js`：`announcement:check` IPC（每次启动检测一次，不缓存）。
- `desktop/preload.cjs`：`api.announcementCheck()`。
- `desktop/ui/app.js`：`maybeShowAnnouncement()` / `openAnnouncement()` / `closeAnnouncement()`，启动动画结束后调用。
- `desktop/ui/index.html` + `desktop/ui/styles.css`：`#ann-modal` 弹窗。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `CUPBOX_ANNOUNCEMENT_URL` | 覆盖公告地址（本地测试可指向 `http://127.0.0.1:<port>/announcement.json`）。 |
| `CUPBOX_ANNOUNCEMENT_DISABLE=1` | 完全关闭公告检查。 |

## 安全约定

- 公告正文按**纯文本**渲染（`textContent` + `white-space: pre-wrap`），不解析 HTML；
- 链接只放行 `https://`，经主进程 `shell.openExternal` 打开；
- 请求 4 秒超时，带时间戳参数绕开 GitHub raw 的 CDN 缓存；
- 任何解析/网络错误只返回 `{ ok: false }`，不影响启动。

## 本地验证

`desktop/verify-announcement.mjs` 会起一个本地 HTTP 服务提供公告 JSON，隔离 `CUPBOX_HOME` 后驱动真实窗口，断言：新公告弹出并显示标题/正文/日期、勾选「不再提示」后写入偏好、同版本再次启动不显示、内容变化后再次显示。
