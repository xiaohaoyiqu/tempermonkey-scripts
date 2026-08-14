# Tampermonkey Scripts

三个浏览器用户脚本，面向电脑端 Chrome / Edge + Tampermonkey，分别辅助知乎阅读、Instagram 媒体下载和 Bluesky 媒体下载。

Firefox、Violentmonkey 以及移动端浏览器可能需要额外适配，当前没有作为主要测试环境。

## 快速安装

安装 Tampermonkey 后，打开下面对应的 Raw 链接，扩展通常会自动识别并显示安装页面。

| 脚本 | 版本 | 站点 | 主要功能 | 安装 |
| --- | --- | --- | --- | --- |
| `zhihu-reading-helper.user.js` | 1.1.0 | 知乎 | 按钮轮、浏览历史、固定问题、分范围收起回答、问题详情页展开、顶部导航滚动隐藏。 | [安装 1.1.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/zhihu-reading-helper.user.js) |
| `instagram-media-downloader.user.js` | 1.1.0 | Instagram | 操作栏下载入口、立即下载、下载队列、多媒体选择、PNG / MP4 / GIF / MP3。 | [安装 1.1.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/instagram-media-downloader.user.js) |
| `bluesky-media-downloader.user.js` | 1.1.0 | Bluesky | 帖子和页面级下载入口、API 补全媒体、下载队列、PNG / MP4 / GIF / MP3。 | [安装 1.1.0](https://raw.githubusercontent.com/xiaohaoyiqu/tempermonkey-scripts/main/bluesky-media-downloader.user.js) |

也可以在 Tampermonkey 管理面板中选择“新建脚本”，复制对应 `.user.js` 文件的完整内容后保存。

## 版本目录

| 目录 | 内容 |
| --- | --- |
| 根目录 | 当前推荐安装版本，当前为 1.1.0。 |
| [`1.1版本/`](./1.1%E7%89%88%E6%9C%AC/) | 1.1.0 脚本和对应版本说明，内容与根目录推荐脚本保持一致。 |
| [`1.0版本/`](./1.0%E7%89%88%E6%9C%AC/) | 1.0.0 历史归档，不跟随当前功能更新。 |
| [`CHANGELOG.md`](./CHANGELOG.md) | 版本变化、权限和已知限制的简要记录。 |

## 功能说明

### Zhihu Reading Helper

- 右侧按钮轮提供历史、收起、展开、导航和记录等操作。
- 自动记录最近 5 个问题；历史记录可以固定、取消固定，或清空未固定记录。
- “收当前”只处理当前可见回答，“收全页”处理页面中较长回答。
- “展开”只在 `/question/{id}` 和 `/question/{id}/answer/{id}` 问题详情页启用，优先调用知乎原生按钮，没有原生按钮时再使用脚本兜底。
- “导航”可以切换顶部导航栏的滚动隐藏；脚本默认不会自动收起页面内容。
- 使用 `GM_getValue` / `GM_setValue` 保存历史，扩展 API 不可用时会尝试使用页面 `localStorage`。

### Instagram Media Downloader

- 在帖子点赞、评论、分享等操作栏中插入下载入口。
- 点击后可以选择“立即下载”或“添加到队列”。
- 多媒体选择框和队列都支持全选、取消全选；队列还支持删除选中、按类型下载、下载全部和清空。
- 队列上限为 30 项，只保存在当前页面会话中；刷新或关闭页面后会清空。
- 图片统一转换为 PNG；普通视频支持 MP4、抽取 MP3 和转换 GIF；GIF 图片保持 GIF，GIF 视频支持转换为 GIF。
- Instagram 媒体地址可能是临时 URL 或 `blob:` URL，个别资源可能只能打开原链接。

### Bluesky Media Downloader

- 为已加载帖子提供帖子级下载按钮，并保留页面级入口。
- 点击时通过 Bluesky 公共 API 补全图片、视频和 GIF 的媒体信息。
- 支持立即下载、加入队列、多媒体选择、全选、取消全选、删除选中、按类型下载、下载全部和清空队列。
- 队列上限为 30 项，只保存在当前页面会话中；成功处理的队列项会自动移除。
- 图片下载为 PNG；普通视频下载为 MP4，可抽取 MP3 或转换 GIF；GIF 图片保持 GIF，GIF 视频支持转换为 GIF。
- 对常见 fMP4 HLS 视频会尝试在浏览器内拼接为 MP4；不支持的 HLS 格式会提示并尝试打开原链接。

## 权限和依赖

| 脚本 | 用户脚本权限 | 用途 |
| --- | --- | --- |
| Zhihu Reading Helper | `GM_getValue`、`GM_setValue` | 保存浏览历史和固定状态。 |
| Instagram Media Downloader | `GM_download`、`GM_xmlhttpRequest`、`unsafeWindow`、`@connect *` | 下载跨源媒体、读取媒体和加载浏览器端转换库。 |
| Bluesky Media Downloader | `GM_download`、`GM_xmlhttpRequest`、`unsafeWindow`、指定 `@connect` 域名 | 调用 Bluesky 公共 API、读取媒体和加载浏览器端转换库。 |

Bluesky 需要允许访问以下域名：

- `public.api.bsky.app`
- `bsky.social`
- `cdn.bsky.app`
- `video.bsky.app`
- `video.cdn.bsky.app`

Instagram 和 Bluesky 的 MP3 / GIF 功能会按需从 CDN 加载 `lamejs` 和 `gif.js`。如果扩展拒绝跨源权限，API 补全、媒体读取或转换功能可能失败。

## 使用限制

- 只处理脚本运行时页面中已经加载出来的帖子、图片和视频。
- Instagram 和 Bluesky 的视频、GIF、音频转换在浏览器本地执行，长视频会占用较多 CPU 和内存。
- 站点页面结构或媒体接口变化后，按钮定位和媒体解析可能需要更新。
- 受版权、站点规则和账号权限约束的内容，请只在有权使用的范围内下载。

## 后续计划

- Zhihu Reading Helper：增加问题页阅读进度，例如当前第几个回答。
- Zhihu Reading Helper：增加隐藏相关推荐、热榜或侧栏的开关。
