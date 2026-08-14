# Tampermonkey Scripts
这些脚本主要面向电脑的 Chrome / Edge + Tampermonkey。Firefox + Violentmonkey 或 Tampermonkey 理论可用，但需要自行验证，可以提交跟我说。移动端的浏览器需等待。

## 脚本列表

| 脚本 | 版本 | 站点 | 说明 | 安装 |
| --- | --- | --- | --- | --- |
| `zhihu-reading-helper.user.js` | 1.1.0 | 知乎 | 右侧按钮轮；历史固定和清空；当前可见/全页分范围收起；问题详情页展开；避开右下角“看山”和回到顶部按钮。 | [Raw](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/zhihu-reading-helper.user.js) |
| `instagram-media-downloader.user.js` | 1.1.0 | Instagram | 帖子点赞/评论操作栏插入下载入口；点击后选择立即下载或加入队列；多媒体选择；图片 PNG；视频 MP4；支持 MP3 抽取和 GIF 转换。 | [Raw](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/instagram-media-downloader.user.js) |
| `bluesky-media-downloader.user.js` | 1.1.0 | Bluesky | 帖子下载按钮和页面级入口；API 补全媒体；点击后选择立即下载或加入队列；多媒体选择；图片 PNG；视频 MP4；支持 MP3 抽取和 GIF 转换。 | [Raw](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/bluesky-media-downloader.user.js) |

## 安装

推荐方式：
安装Tampermonkey -> 打开上表对应的 Raw 链接 -> Tampermonkey 会识别 `.user.js` 并提示安装。

手动方式：
打开Tampermonkey管理面板 -> 新建脚本->复制对应 `.user.js` 文件内容并保存。

版本归档：
`1.0版本/` 保存初版脚本，`1.1版本/` 保存当前 1.1 系列脚本；根目录保留当前推荐安装版本。

## 浏览器和权限要求

### Zhihu Reading Helper
会保存最近浏览的5个问题，历史面板支持固定问题和清空未固定记录；可以收起当前可见回答或全页较长回答；展开/阅读全文只在问题详情页启用；可以设置移动时隐藏导航栏。


### Instagram Media Downloader
用来下载Instagram的图片，gif，视频，可转视频为gif。
点击帖子上的下载按钮后，会先选择“立即下载”或“添加到队列”。单个普通图片在选择立即下载后直接保存；多图、视频或 GIF 会打开立即下载选择框。选择添加到队列时使用独立选择框，队列最多 30 项，面板支持全选、取消全选、单选、删除选中、按类型下载选中、下载全部和清空队列。队列下载或转换成功后会自动移除已处理项；图片只按 PNG 下载，不参与视频转 GIF 或抽音频。队列保存在当前页面会话中，刷新或关闭页面后会清空。
脚本声明 `@connect *`，首次读取媒体时可能需要在脚本管理器中授权。
Instagram 的媒体地址可能是临时 URL 或 `blob:`，个别情况下会下载失败或只能打开原链接。

### Bluesky Media Downloader
用来下载bluesky的图片，gif，视频，可转视频为gif。
点击帖子下载按钮或页面级入口后，会先补全媒体信息，再选择“立即下载”或“添加到队列”。单个普通图片在选择立即下载后直接保存；多图、视频或 GIF 会打开立即下载选择框。选择添加到队列时使用独立选择框，队列最多 30 项，面板支持全选、取消全选、单选、删除选中、按类型下载选中、下载全部和清空队列。队列下载或转换成功后会自动移除已处理项；图片只按 PNG 下载，不参与视频转 GIF 或抽音频。队列保存在当前页面会话中，刷新或关闭页面后会清空。
- 脚本声明以下跨源权限：
  - `public.api.bsky.app`
  - `bsky.social`
  - `cdn.bsky.app`
  - `video.bsky.app`
  - `video.cdn.bsky.app`

第一次读取 API 或媒体时，Tampermonkey 可能要求授权。


## 注意事项

三个脚本都只处理浏览器页面已经加载出来的内容。Instagram 和 Bluesky 的视频、GIF、音频转换都在浏览器本地执行，长视频会比较耗 CPU 和内存。 外部库来自 CDN，网络不可达时，基础下载仍可用，但 MP3/GIF 附加功能不可用。 如果脚本管理器拒绝跨域权限，媒体转换和 API 补全会失败。

## 后续计划

- Zhihu Reading Helper：问题页增加阅读进度，例如当前第几个回答。
- Zhihu Reading Helper：增加隐藏相关推荐、热榜或侧栏的开关。
