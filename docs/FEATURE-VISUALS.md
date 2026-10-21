# 功能插画与图标动效

本轮为现有界面加入小幅、与操作相关的动效，版本固定为 1.0.3。

## 实际使用位置

| 资源 | 用途 | 入口 |
| --- | --- | --- |
| `feature-files.png` | 文件夹与归档卡片，解释文件整理 | 首页文件快捷入口、文件工具分类 |
| `feature-data.svg` | 数据卡片与转换箭头，解释格式转换 | 首页 JSON 快捷入口、数据工具分类 |
| `feature-vision.png` | 扫描框与放大镜，解释图片读取 | 首页图片文字入口、图片工具分类 |
| `feature-workflow.svg` | 分支任务与汇合卡片，解释分工整合 | 模型管理、系统工具分类 |

所有图片位于 `desktop/ui/assets/`，其中两张 PNG 由内置 **image_gen** 生成并保留透明通道，数据转换与协作流程使用项目原创 SVG 矢量图解。首页按钮、分类和空状态均保留明确中文名称与简短说明，图片作为装饰辅助理解，不替代文字或交互控件。新增 `feature-visuals.js` 统一引用；插画丢失时动态插画自动隐藏，功能文字仍然存在。

## 动效规则

- 设置齿轮轻转、通知铃轻摆、文件夹轻抬、搜索轻移、上传箭头上扬、工具格依次回应。鼠标悬停和键盘聚焦都可触发，离开后停止。
- 首页插画轻抬并改变阴影；静止时不持续飘动。
- 复制成功后显示勾选与“已复制”，约 1.5 秒后恢复原按钮。重复复制不会累积状态或改变被复制内容。
- 发送中和子任务执行中显示有节制的状态动画。完成勾选只随真实完成状态出现；不会用装饰动画暗示执行成功。
- 系统减少动态效果时关闭这些图标与插画动画，但保留文字、颜色及状态。运行中的短暂 JavaScript 动画也会取消。

复用并扩充项目原生 SVG 图标集，没有增加图标或动效网络依赖。动态反馈不改变原有批准流程，也不自动开启多模型或发起模型调用。

## 验证

`desktop/verify-visuals.mjs` 验证两张生成 PNG 的真实透明通道及全部资源的浏览器加载、入口目标、分类同步、搜索与模型空状态、鼠标悬停与静止、复制内容和恢复、减少动态效果及深浅色界面。复制验证使用隔离的浏览器剪贴板替身，不覆盖系统剪贴板。

截图与日志位于 `output/ui-review/`。原有界面、回复与多模型回归继续检查。

## 最终生成提示词

### 文件整理（内置 image_gen）

Use case: stylized-concept. Asset type: standalone small feature illustration for Cupbox desktop UI. Style: refined pastel anime object illustration, delicate luminous brushwork, softly rounded forms with porcelain and translucent periwinkle glass, elegant blue/lavender/blush-pink palette, warm soft highlights, subtle watercolor texture. Compact centered readable silhouette, front three-quarter view, generous transparent padding, high quality at small scale. Transparent background, no words, no letters, no logos, no watermark, no UI frame. One cohesive object grouping, not an icon sheet. A friendly blue file folder containing three ivory document cards. Two small sorted pastel tabs and one gentle curved arrow clearly suggest organizing documents. The folder and papers are the main subject, subtle sakura petal detail.

### 图片读取（内置 image_gen）

Use case: stylized-concept. Asset type: standalone small feature illustration for Cupbox desktop UI. Style: refined pastel anime object illustration, delicate luminous brushwork, softly rounded forms with porcelain and translucent periwinkle glass, elegant blue/lavender/blush-pink palette, warm soft highlights, subtle watercolor texture. Compact centered readable silhouette, front three-quarter view, generous transparent padding, high quality at small scale. Transparent background, no words, no letters, no logos, no watermark, no UI frame. One cohesive object grouping, not an icon sheet. A rounded translucent blue picture frame containing miniature sakura hills and a small sun, surrounded by four periwinkle scanner corner brackets. A small magnifying lens in front clearly suggests reading or inspecting an image.

数据转换与协作资源为项目内原创 SVG，未使用生成图片占位。昨日另外两张生图请求没有返回可用文件，最终资源采用上述矢量图解。
