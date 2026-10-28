# 感谢名单维护

只维护仓库根目录的 [thanks.json](../thanks.json)，不再从README提取，不需要同步另一份名单。

```json
{
  "schemaVersion": 1,
  "entries": [
    {"text": "特别感谢：杯艺宣（龚震宇）", "links": []}
  ]
}
```

在`beizilaoshi/Cupbox`的`main`分支修改这个文件即可。应用每次打开感谢页面都请求GitHub，不读取本地文件或磁盘缓存。点击“检查 GitHub 更新”也会立即请求。ETag相同且GitHub返回304时复用本次运行已验证的结果；联网失败或文件格式错误时清空名单并明确报错，不回退到本地名单。应用不再打包thanks.json副本；实际名单以GitHub上的文件为准。

仅接受版本1的JSON数据：最多200条、每条1500字、8个HTTPS链接、文件最大128KB。名称按纯文字显示，不执行HTML、脚本或远程配置。更改结构版本需先适配软件。

本次远程测试只上传`thanks.json`，应用适配代码保留本机，后续正常发布应用时一并包含。

验证：`npx vitest run test/about-thanks.test.ts`。`desktop/verify-thanks.mjs`覆盖实际界面的更新和断网错误提示，`--live`验证真实GitHub文件，使用隔离测试目录，不修改用户缓存。
