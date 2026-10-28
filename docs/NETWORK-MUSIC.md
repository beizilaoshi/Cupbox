# 酷狗概念版背景音乐

入口：设置 → 背景音乐 → 酷狗概念版在线音乐。

- 搜索歌曲：返回最多20首；加入后在“网络歌单”分组展示。
- 我的收藏歌单：读取同一酷狗账号下的“我喜欢”、收藏和自建歌单，选择一份同步。歌曲卡片末尾固定显示“网络歌单”。
- 同步为增量合并：同账号歌曲按Hash去重，重复同步保留禁用状态，不自动移除已有歌曲。可手动从本机移除；此操作不调用酷狗删除/取消收藏接口。
- 播放时根据当前账号授权获取音频，首次下载到用户音乐目录的`online-cache`；后续复用有效缓存。系统歌曲、本地导入、网络歌曲共享音量和三种播放方式。
- 歌单元数据存入现有桌面设置的`musicNetworkTracks`，不保存临时播放URL。网络曲目绑定账号指纹，换账号需重新同步；凭证仍使用现有Windows本机加密存储。
- 最多600份账号歌单、单份读取2000个条目、本机1000首网络歌曲；分页失败或超限不提交半份歌单。每次音频下载最多10MB，遵守平台返回的播放权限。

接口行为参考 [EchoMusic v2.3.2](https://github.com/hoowhoami/EchoMusic/releases/tag/v2.3.2) 的`src/renderer/api/playlist.ts`及歌单映射逻辑。EchoMusic客户端为GPL-3.0-only；本次没有复制客户端组件或代码，使用项目已有的MIT许可`echomusic-api`后端，并增加独立的卡片UI和适配层。

验证：

```powershell
npx vitest run test/music-network.test.ts test/music-library.test.ts test/music.test.ts test/qq-echo-music.test.ts test/qq-music-login.test.ts
```

`desktop/verify-music-network.mjs`使用隔离账号与模拟服务响应，验证真实IPC、持久化、播放器、搜索同步流程、浅/深色及最小窗口卡片布局。不会访问用户的真实登录数据。真实搜索另用现有签名接口验证；真实个人收藏需登录对应账号后读取。
