# Tampermonkey Scripts

个人自用油猴脚本仓库，当前三个脚本均以 `1.0.0` 作为初版发布。目标仓库：

https://github.com/xiaohaoyiqu/tempermonkey-scripts

这些脚本主要面向桌面端 Chrome / Edge + Tampermonkey。Firefox + Violentmonkey 或 Tampermonkey 理论可用，但还需要继续实测。Safari、iOS、Android 浏览器不作为主要兼容目标。

## 脚本列表

| 脚本 | 版本 | 站点 | 说明 | 安装 |
| --- | --- | --- | --- | --- |
| `zhihu-reading-helper.user.js` | 1.0.0 | 知乎 | 右侧按钮轮；记录最近问题；优先调用知乎原生收起/阅读全文；避开右下角“看山”和回到顶部按钮。 | [Raw](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/zhihu-reading-helper.user.js) |
| `instagram-media-downloader.user.js` | 1.0.0 | Instagram | 帖子三点按钮左侧插入下载入口；单图直下；多媒体选择；图片 PNG；视频 MP4；支持 MP3 抽取和 GIF 转换。 | [Raw](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/instagram-media-downloader.user.js) |
| `bluesky-media-downloader.user.js` | 1.0.0 | Bluesky | 帖子下载按钮和页面级入口；API 补全媒体；单图直下；多媒体选择；图片 PNG；视频 MP4；支持 MP3 抽取和 GIF 转换。 | [Raw](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/bluesky-media-downloader.user.js) |

## 安装

推荐方式：

1. 安装 Tampermonkey。
2. 打开上表对应的 Raw 链接。
3. Tampermonkey 会识别 `.user.js` 并提示安装。

手动方式：

1. 打开 Tampermonkey 管理面板。
2. 新建脚本。
3. 复制对应 `.user.js` 文件内容并保存。

## 浏览器和权限要求

### Zhihu Reading Helper

- 主要使用 DOM、Shadow DOM、MutationObserver。
- 使用 `GM_getValue` / `GM_setValue` 保存最近 5 个问题，脚本内有 `localStorage` 兜底。
- 不需要跨域下载权限。
- 不依赖外部 CDN。
- 主要风险是知乎页面结构变化，例如 `ContentItem-expandButton`、`data-zop-retract-question`、`data-kanshan-panel` 等类名或属性被改。

### Instagram Media Downloader

- 需要 `GM_download` 和 `GM_xmlhttpRequest`。
- 脚本声明 `@connect *`，首次读取媒体时可能需要在脚本管理器中授权。
- MP3 抽取会按需加载 `lamejs`。
- GIF 转换会按需加载 `gif.js` 和 `gif.worker.js`。
- 图片转 PNG 依赖浏览器 `canvas.toBlob`。
- 视频音频抽取依赖 `AudioContext`。
- Instagram 的媒体地址可能是临时 URL 或 `blob:`，个别情况下会下载失败或只能打开原链接。

### Bluesky Media Downloader

- 需要 `GM_download` 和 `GM_xmlhttpRequest`。
- 脚本声明以下跨源权限：
  - `public.api.bsky.app`
  - `bsky.social`
  - `cdn.bsky.app`
  - `video.bsky.app`
  - `video.cdn.bsky.app`
- 首次读取 API 或媒体时，Tampermonkey 可能要求授权。
- MP3 抽取和 GIF 转换同样按需加载 `lamejs`、`gif.js` 和 `gif.worker.js`。
- Bluesky 视频优先读取 API 返回的 HLS 播放列表；当前只直接封装常见 fMP4 分片，遇到其他 HLS 形式会提示并打开原链接。

## 注意事项

- 三个脚本都只处理浏览器页面已经加载出来的内容。
- Instagram 和 Bluesky 的视频、GIF、音频转换都在浏览器本地执行，长视频会比较耗 CPU 和内存。
- 外部库来自 CDN，网络不可达时，基础下载仍可用，但 MP3/GIF 附加功能不可用。
- 如果脚本管理器拒绝跨域权限，媒体转换和 API 补全会失败。

## 推送到 GitHub

只推送 `油猴脚本` 目录，不要把整个 `twitter_Crawler-main` 项目推到这个仓库。

如果 `tempermonkey-scripts` 是空仓库，可以在 PowerShell 中执行：

```powershell
Set-Location -LiteralPath 'D:\xuexi\python\twitter_Crawler-main\油猴脚本'
git init
git branch -M main
git add README.md *.user.js
git commit -m "Add userscripts"
git remote add origin https://github.com/xiaohaoyiqu/tempermonkey-scripts.git
git push -u origin main
```

如果远程仓库已经有内容，推荐先克隆到单独目录，再复制文件提交：

```powershell
Set-Location -LiteralPath 'D:\xuexi\python'
git clone https://github.com/xiaohaoyiqu/tempermonkey-scripts.git
Copy-Item -LiteralPath D:\xuexi\python\twitter_Crawler-main\油猴脚本\*.user.js -Destination D:\xuexi\python\tempermonkey-scripts -Force
Copy-Item -LiteralPath D:\xuexi\python\twitter_Crawler-main\油猴脚本\README.md -Destination D:\xuexi\python\tempermonkey-scripts\README.md -Force
Set-Location -LiteralPath 'D:\xuexi\python\tempermonkey-scripts'
git add README.md *.user.js
git commit -m "Update userscripts"
git push
```

推送时 GitHub 可能要求登录。HTTPS 推送通常需要 GitHub 凭据管理器或 Personal Access Token；也可以把 remote 换成 SSH 地址：

```powershell
git remote set-url origin git@github.com:xiaohaoyiqu/tempermonkey-scripts.git
```
