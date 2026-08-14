# Tampermonkey Scripts 1.1.0

这是 `1.1版本/` 的版本归档。三个脚本内容与仓库根目录的当前推荐版本一致；如果只想安装最新版，也可以直接使用根目录 README 中的链接。

## 脚本列表

| 脚本 | 站点 | 主要功能 | 安装 |
| --- | --- | --- | --- |
| `zhihu-reading-helper.user.js` | 知乎 | 按钮轮、浏览历史、固定问题、分范围收起回答、问题详情页展开、顶部导航滚动隐藏。 | [安装 1.1.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/1.1%E7%89%88%E6%9C%AC/zhihu-reading-helper.user.js) |
| `instagram-media-downloader.user.js` | Instagram | 操作栏下载入口、立即下载、下载队列、多媒体选择、PNG / MP4 / GIF / MP3。 | [安装 1.1.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/1.1%E7%89%88%E6%9C%AC/instagram-media-downloader.user.js) |
| `bluesky-media-downloader.user.js` | Bluesky | 帖子和页面级下载入口、API 补全媒体、下载队列、PNG / MP4 / GIF / MP3。 | [安装 1.1.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/1.1%E7%89%88%E6%9C%AC/bluesky-media-downloader.user.js) |

## 1.1.0 更新内容

### Zhihu Reading Helper

- 历史记录支持固定、取消固定和清空未固定记录。
- “收起”拆分为“收当前”和“收全页”。
- “展开 / 阅读全文”只在问题详情页启用，优先调用知乎原生按钮。
- 按钮轮根据当前页面状态显示禁用态和提示，并避开右下角“看山”和回到顶部按钮。

### Instagram Media Downloader

- 下载入口移动到帖子点赞、评论、分享等操作栏。
- 增加“立即下载 / 添加到队列”流程。
- 队列最多 30 项，支持全选、取消全选、单选、删除、按类型下载、下载全部和清空。
- 图片只下载为 PNG，不参与视频转 GIF 或抽取 MP3；普通视频支持 MP4、GIF 和 MP3。
- 队列保存在当前页面会话中，成功处理的项目会自动移除。

### Bluesky Media Downloader

- 保留帖子按钮和页面级入口。
- 点击时通过 Bluesky 公共 API 补全媒体信息。
- 增加“立即下载 / 添加到队列”流程，队列最多 30 项。
- 图片下载为 PNG，普通视频下载为 MP4；普通视频支持 GIF 转换和 MP3 抽取。
- 选择框默认不勾选资源，并提供全选和取消全选。

## 安装和权限

安装 Tampermonkey 后打开上表 Raw 链接即可。第一次读取跨源资源时，Tampermonkey 可能会弹出授权提示。

Instagram 声明 `@connect *`。Bluesky 需要允许以下域名：

- `public.api.bsky.app`
- `bsky.social`
- `cdn.bsky.app`
- `video.bsky.app`
- `video.cdn.bsky.app`

Instagram 和 Bluesky 的 MP3 / GIF 功能会按需从 CDN 加载 `lamejs` 和 `gif.js`。如果扩展拒绝跨源权限，媒体读取、API 补全或转换功能可能失败。

## 已知限制

- 只处理脚本运行时页面中已经加载出来的内容。
- 下载队列只存在于当前页面会话，刷新或关闭页面后清空。
- 浏览器本地转换长视频会占用较多 CPU 和内存。
- Instagram 个别临时 URL 或 `blob:` URL 可能只能打开原链接。
- Bluesky 对常见 fMP4 HLS 视频会尝试拼接为 MP4；不支持的 HLS 格式会提示并尝试打开原链接。

## 相关文档

- [仓库主 README](../README.md)
- [版本更新记录](../CHANGELOG.md)
