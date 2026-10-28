# Use-It 引擎（实时操作 Office / AutoCAD）

Cupbox 工具箱里的 **Use-It** 工具不是文档生成器，而是通过 [use-it-agent](https://github.com/UseIt-AI/use-it-agent) 的本地引擎，用 COM 直接操作**已经打开的** PowerPoint、Word、Excel、AutoCAD 和桌面 GUI。它和现有的 `word_*` / `ppt_*` / `excel_*`（生成与编辑文件）互补：后者产出文件，前者改当前窗口里的实时文档。

## 1. 安装引擎（一次性）

需要 Windows + Python 3.11+，以及对应的桌面应用。

```powershell
py -3.13 -m pip install -e "D:\下载\useit-src\use-it-agent-main[local-engine]"
```

`[local-engine]` 会装上 fastapi/uvicorn、python-pptx、python-docx、openpyxl、pywin32、mss、uiautomation、pynput、browser-use 等。**必须完整安装**：引擎的 `/api/v1` 路由在启动时会导入全部子路由（含 browser），缺依赖会直接启动失败。

## 2. 启动引擎

```powershell
py -3.13 "D:\下载\useit-src\use-it-agent-main\src\local_engine\main.py"
```

- 默认只监听 `127.0.0.1:8324`；改端口用环境变量 `LOCAL_ENGINE_PORT`。
- 引擎是独立进程，Cupbox 不会替你启动它；保持窗口开着即可。
- 启动后可在浏览器打开 `http://127.0.0.1:8324/api/v1/health` 自检。

## 3. 在 Cupbox 里使用

| 位置 | 工具 | 作用 |
| --- | --- | --- |
| 工具箱 → 系统 | `useit_status` | 检查引擎与四个应用的连接状态；未启动时直接给出安装/启动命令 |
| Agent（本机模式） | `useit_catalog` | 列出引擎各控制器当前支持的动作清单，写 actions/脚本前先查 |
| 工具箱 → 办公 | `useit_ppt` | 查看 PPT 结构、执行动作数组、跑 PowerShell/Python |
| 工具箱 → 办公 | `useit_word` | 查看 Word 结构、跑脚本（引擎暂不支持结构化动作） |
| 工具箱 → 办公 | `useit_excel` | 查看 Excel 结构、跑脚本（只支持脚本模式） |
| 工具箱 → 系统 | `useit_autocad` | 状态、打开/激活图纸、读实体、按 JSON 或 Python 绘图 |
| 工具箱 → 系统 | `useit_computer` | 截屏、鼠标/键盘动作数组 |

工作模式（Agent）里这 6 个工具同样可选，但**只在本机运行模式**下出现；文件沙箱模式会隐藏它们。所有会改动文档/桌面的动作都会在 `smart` 之外的批准模式下逐次请求确认（`full` 模式也会问），这是故意的：实时文档没有预览令牌可回滚。

## 4. 参数速查

公共：`engineUrl`（默认 `http://127.0.0.1:8324`，只接受回环地址）、`timeoutMs`。

- `useit_ppt`：`action = status | open | close | snapshot | actions | code`
  - `open`：`filePath`、`readOnly`
  - `snapshot`：`includeContent`、`includeScreenshot`、`maxSlides`、`currentSlideOnly`
  - `actions`：`actions`（JSON 字符串或数组，单次 ≤100 条），动作见下
  - `code`：`code`、`language`（PowerShell / Python）、`returnScreenshot`
- `useit_word` / `useit_excel`：`action = status | open | close | snapshot | code`，参数同上（无 `actions`）。
- `useit_autocad`：`action = status | launch | open | close | activate | snapshot | step`
  - `activate`：`drawingName` 或 `index`
  - `step`：`stepAction = draw_from_json | execute_python_com`，配 `data` 或 `code`
- `useit_computer`：`action = screenshot | actions`；截屏 `resize`，动作数组 `actions`。

PPT 结构化动作：`add_slide`、`goto_slide`、`delete_slide`、`duplicate_slide`、`move_slide`、`render_ppt_layout`、`lint_layout`、`insert_native_chart`、`insert_native_table`、`insert_media`、`update_element`、`delete_element`、`group_elements`、`ungroup_elements`、`align_elements`、`distribute_elements`、`reorder_elements`、`add_shape_animation`、`clear_slide_animations`、`set_slide_transition`。

## 5. 安全边界

- 只允许 `127.0.0.1` / `localhost` / `::1`，拒绝局域网和内网地址。
- 不自动安装、不自动启动、不访问网络下载。
- 引擎返回的截图 base64、超长字符串会被替换成 `{ omitted, chars }`，不会灌进模型上下文。
- 所有本机应用操作都在现有 Workbench 审计里记录；执行环境切到文件沙箱时这些工具整体隐藏。

## 6. 常见问题

- **`E_USEIT_OFFLINE` / ECONNREFUSED**：引擎没启动，或端口不是 8324。先跑 `useit_status`。
- **启动引擎报 `ModuleNotFoundError`**：没装 `[local-engine]` extras，或用了 3.8 的 python。
- **Word / Excel 的 actions 报错**：引擎目前只实现了 PPT 的结构化动作；Word/Excel 用 `code`。
- **PPT 报 COM 错误**：PowerPoint 没装/没登录，或文档被独占；先在桌面手动打开一次。
- **端口被占用**：设置 `LOCAL_ENGINE_PORT=8334`，启动引擎，并在工具 `engineUrl` 填 `http://127.0.0.1:8334`。
