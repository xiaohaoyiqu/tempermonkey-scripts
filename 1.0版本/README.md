# Tampermonkey Scripts 1.0.0

这是 `1.0版本/` 的历史归档。

## 脚本列表

| 脚本 | 版本 | 站点 | 说明                                                                 | 安装 |
| --- | --- | --- |--------------------------------------------------------------------| --- |
| `zhihu-reading-helper.user.js` | 1.0.0 | 知乎 | 右侧按钮轮；记录最近问题；优先调用知乎原生收起/阅读全文；避开右下角知乎和回到顶部按钮。                       | [安装 1.0.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/1.0%E7%89%88%E6%9C%AC/zhihu-reading-helper.user.js) |
| `instagram-media-downloader.user.js` | 1.0.0 | Instagram | 帖子设置按钮左侧添加下载按钮；单图直下；多媒体选择；图片 PNG；视频 MP4；支持 MP3 抽取和 GIF 转换。         | [安装 1.0.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/1.0%E7%89%88%E6%9C%AC/instagram-media-downloader.user.js) |
| `bluesky-media-downloader.user.js` | 1.0.0 | Bluesky | 帖子下载按钮和页面下载面板；API 补全媒体；单图直下；多媒体选择；图片 PNG；视频 MP4；支持 MP3 抽取和 GIF 转换。 | [安装 1.0.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/1.0%E7%89%88%E6%9C%AC/bluesky-media-downloader.user.js) |

## 安装

安装 Tampermonkey 后打开上表对应的 Raw 链接即可，也可以在 Tampermonkey 管理面板中新建脚本并复制对应 `.user.js` 文件内容。

## 浏览器和权限要求

脚本主要面向电脑端 Chrome / Edge + Tampermonkey。Firefox、Violentmonkey 和移动端浏览器可能需要额外适配。

### Zhihu Reading Helper
会保存最近浏览的 5 个问题，可以自动收起或者展开当前问题页的答案，可以设置移动时隐藏导航栏。


### Instagram Media Downloader
用来下载 Instagram 的图片、GIF 和视频，可转视频为 GIF；1.0.0 尚未包含 1.1.0 的下载队列流程。
脚本声明 `@connect *`，首次读取媒体时可能需要在脚本管理器中授权。
Instagram 的媒体地址可能是临时 URL 或 `blob:`，个别情况下会下载失败或只能打开原链接。

### Bluesky Media Downloader
用来下载 Bluesky 的图片、GIF 和视频，可转视频为 GIF；
- 脚本声明以下跨源权限：
  - `public.api.bsky.app`
  - `bsky.social`
  - `cdn.bsky.app`
  - `video.bsky.app`
  - `video.cdn.bsky.app`

第一次读取 API 或媒体时，Tampermonkey 可能要求授权。


## 注意事项

zhihu-reading-helper，instagram-media-downloader.user，bluesky-media-downloader.user脚本都只处理浏览器页面已经加载出来的内容。Instagram 和 Bluesky 的视频、GIF、音频转换都在浏览器本地执行，长视频会比较耗 CPU 和内存。外部库来自 CDN，网络不通时，基础下载仍可用，但 MP3/GIF 附加功能不可用。如果脚本管理器拒绝跨域权限，媒体转换和 API 补全会失败。

## 相关文档

- [仓库主 README](../README.md)
- [版本更新记录](../CHANGELOG.md)

