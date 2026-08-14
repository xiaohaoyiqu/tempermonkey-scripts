// ==UserScript==
// @name         Bluesky Media Downloader@萧浩已去(xiaohaoyiqu)
// @namespace    local.content.downloader
// @version      1.0.0
// @description:zh-CN  Bluesky 媒体下载辅助：给已加载帖子添加下载入口，支持 API 补全、图片 PNG、视频 MP4、GIF 转换和音频 MP3 抽取。
// @author       萧浩已去(xiaohaoyiqu)
// @match        https://bsky.app/*
// @run-at       document-idle
// @grant        unsafeWindow
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      public.api.bsky.app
// @connect      bsky.social
// @connect      cdn.bsky.app
// @connect      video.bsky.app
// @connect      video.cdn.bsky.app
// ==/UserScript==

/* global unsafeWindow, GM_download, GM_xmlhttpRequest */

(function () {
  "use strict";

  const FLOAT_BUTTON_CLASS = "cdb-floating-button";
  const POST_BUTTON_CLASS = "cdb-post-button";
  const POST_BUTTON_SLOT_CLASS = "cdb-post-button-slot";
  const POST_BUTTON_FALLBACK_CLASS = "cdb-post-button-fallback";
  const PANEL_CLASS = "cdb-picker-panel";
  const TOAST_CLASS = "cdb-toast";
  const POST_READY_ATTR = "data-cdb-post-download-ready";
  const POST_SELECTOR = [
    '[data-testid^="feedItem-by-"]',
    '[data-testid^="postThreadItem-by-"]',
    '[data-testid^="searchFeedItem-by-"]',
    '[data-testid^="searchPost-by-"]',
  ].join(", ");
  const SEARCH_RESULT_POST_SELECTOR = '[role="link"][tabindex="0"]';
  const MEDIA_MIN_SIZE = 80;
  const APPVIEW_ORIGIN = "https://public.api.bsky.app";
  const HANDLE_RESOLVE_ORIGINS = [
    APPVIEW_ORIGIN,
    "https://bsky.social",
  ];
  const API_CONNECT_HOSTS = new Set([
    "public.api.bsky.app",
    "bsky.social",
  ]);
  const MEDIA_CONNECT_HOSTS = new Set([
    "cdn.bsky.app",
    "video.bsky.app",
    "video.cdn.bsky.app",
  ]);
  const LAMEJS_URL = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";
  const GIFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js";
  const GIF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js";
  const MAX_PAGE_API_POSTS = 40;
  const didCache = new Map();
  const postViewCache = new Map();
  let scanTimer = 0;

  function addStyle() {
    if (document.getElementById("cdb-media-downloader-style")) return;
    const style = document.createElement("style");
    style.id = "cdb-media-downloader-style";
    style.textContent = `
      .${FLOAT_BUTTON_CLASS} {
        position: fixed;
        right: 18px;
        bottom: 76px;
        z-index: 2147483646;
        height: 36px;
        min-width: 54px;
        border: 0;
        border-radius: 999px;
        padding: 0 13px;
        background: #0f172a;
        color: #fff;
        cursor: pointer;
        font: 700 13px/36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.28);
      }
      .${FLOAT_BUTTON_CLASS}:hover {
        background: #1d4ed8;
      }
      .cdb-floating-count {
        margin-left: 5px;
        font-weight: 600;
        opacity: 0.82;
      }
      .${POST_BUTTON_SLOT_CLASS} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        min-width: 34px;
        min-height: 34px;
        margin-left: 4px;
      }
      .${POST_BUTTON_FALLBACK_CLASS} {
        display: flex;
        justify-content: flex-end;
        padding: 4px 12px 8px;
      }
      .${POST_BUTTON_CLASS} {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 999px;
        color: rgb(83, 100, 113);
        background: transparent;
        cursor: pointer;
        font: 700 15px/32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
      }
      .${POST_BUTTON_CLASS}:hover {
        color: #1d4ed8;
        background: rgba(29, 78, 216, 0.1);
      }
      .${PANEL_CLASS}-mask {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        background: rgba(15, 23, 42, 0.36);
      }
      .${PANEL_CLASS} {
        position: fixed;
        top: 72px;
        right: 24px;
        z-index: 2147483647;
        width: min(500px, calc(100vw - 32px));
        max-height: calc(100vh - 120px);
        overflow: auto;
        color: #0f172a;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .cdb-panel-head,
      .cdb-panel-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.1);
      }
      .cdb-panel-foot {
        border-top: 1px solid rgba(15, 23, 42, 0.1);
        border-bottom: 0;
        flex-wrap: wrap;
      }
      .cdb-panel-head strong {
        font-size: 14px;
      }
      .cdb-panel-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }
      .cdb-panel-bulk {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .cdb-panel-close,
      .cdb-panel-download,
      .cdb-panel-audio,
      .cdb-panel-gif,
      .cdb-panel-select,
      .cdb-panel-clear {
        border: 0;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        font: inherit;
      }
      .cdb-panel-close {
        background: #f1f5f9;
      }
      .cdb-panel-download {
        color: #fff;
        background: #0f172a;
      }
      .cdb-panel-audio {
        color: #fff;
        background: #2563eb;
      }
      .cdb-panel-gif {
        color: #fff;
        background: #7c3aed;
      }
      .cdb-panel-select,
      .cdb-panel-clear {
        color: #0f172a;
        background: #e2e8f0;
      }
      .cdb-media-row {
        display: grid;
        grid-template-columns: 28px 72px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        cursor: pointer;
      }
      .cdb-media-row:hover {
        background: #f8fafc;
      }
      .cdb-media-row img,
      .cdb-media-thumb {
        width: 72px;
        height: 72px;
        object-fit: cover;
        border-radius: 6px;
        background: #0f172a;
        color: #fff;
        display: grid;
        place-items: center;
      }
      .cdb-media-title {
        display: block;
        font-weight: 600;
      }
      .cdb-media-url {
        display: block;
        word-break: break-all;
        color: #64748b;
        font-size: 12px;
      }
      .${TOAST_CLASS} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        max-width: min(440px, calc(100vw - 36px));
        padding: 10px 12px;
        border-radius: 8px;
        color: #fff;
        background: rgba(15, 23, 42, 0.94);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.26);
      }
    `;
    document.documentElement.appendChild(style);
  }

  function absoluteUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch (_) {
      return url || "";
    }
  }

  function highestSrcFromSrcset(srcset) {
    if (!srcset) return "";
    const best = srcset
      .split(",")
      .map((part) => {
        const [url, size] = part.trim().split(/\s+/);
        const width = Number((size || "").replace(/[^\d.]/g, "")) || 0;
        return { url: absoluteUrl(url), width };
      })
      .sort((a, b) => b.width - a.width)[0];
    return best ? best.url : "";
  }

  function mediaUrl(node) {
    if (node instanceof HTMLImageElement) {
      return (
        highestSrcFromSrcset(node.srcset) ||
        absoluteUrl(
          node.currentSrc ||
            node.src ||
            node.getAttribute("data-src") ||
            node.getAttribute("data-uri") ||
            "",
        )
      );
    }
    if (node instanceof HTMLVideoElement) {
      const source = node.querySelector("source[src]");
      return absoluteUrl(node.currentSrc || node.src || (source && source.getAttribute("src")) || "");
    }
    if (node instanceof HTMLElement) {
      return backgroundImageUrl(node);
    }
    return "";
  }

  function isLargeMedia(node) {
    const rect = node.getBoundingClientRect();
    if (rect.width >= MEDIA_MIN_SIZE && rect.height >= MEDIA_MIN_SIZE) return true;
    if (node instanceof HTMLImageElement) {
      const width = node.naturalWidth || Number(node.getAttribute("width")) || 0;
      const height = node.naturalHeight || Number(node.getAttribute("height")) || 0;
      return width >= MEDIA_MIN_SIZE && height >= MEDIA_MIN_SIZE;
    }
    if (node instanceof HTMLVideoElement) {
      return (
        (node.videoWidth || 0) >= MEDIA_MIN_SIZE &&
        (node.videoHeight || 0) >= MEDIA_MIN_SIZE
      );
    }
    return false;
  }

  function isVisibleMedia(node) {
    const rect = node.getBoundingClientRect();
    return (
      isLargeMedia(node) &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function mediaNodesIn(root) {
    return [
      ...root.querySelectorAll("img, video, [style*='background']"),
    ].filter((node) => node instanceof HTMLElement && mediaUrl(node));
  }

  function backgroundImageUrl(node) {
    const value = (node.style && node.style.backgroundImage) || getComputedStyle(node).backgroundImage;
    if (!value || value === "none") return "";
    const match = value.match(/url\((["']?)(.*?)\1\)/i);
    return match ? absoluteUrl(match[2]) : "";
  }

  function likelyPostImageUrl(url) {
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
    try {
      const parsed = new URL(url, location.href);
      if (!/(\.|^)bsky\.app$/i.test(parsed.hostname)) return false;
      return parsed.pathname.includes("/img/feed_");
    } catch (_) {
      return false;
    }
  }

  function fullSizeBlueskyUrl(url) {
    return String(url || "")
      .replace("/img/feed_thumbnail/", "/img/feed_fullsize/")
      .replace("/img/feed_thumbnail_optimized/", "/img/feed_fullsize/");
  }

  function isGifUrl(url) {
    return /\.gif(?:$|[?#])/i.test(url || "");
  }

  function isGifLikeVideo(video) {
    const labeledAncestor = video.closest("[aria-label]");
    const text = [
      video.getAttribute("aria-label"),
      video.getAttribute("title"),
      labeledAncestor ? labeledAncestor.getAttribute("aria-label") : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes("gif") || (video.loop && video.muted && !video.controls && !text.includes("video"));
  }

  function collectPostMedia(post) {
    const nodes = mediaNodesIn(post).filter((node) => isLargeMedia(node) && belongsToPost(node, post));
    const author = postAuthor(post);
    const permalink = postPermalink(post);
    const postId = postIdFromPermalink(permalink);
    const postUri = atUriFromPermalink(permalink);
    const indexedAt = postIndexedAt(post);
    const videoRects = nodes
      .filter((node) => node instanceof HTMLVideoElement)
      .map((node) => node.getBoundingClientRect());
    const seen = new Set();
    const items = [];
    for (const node of nodes) {
      const item = mediaItemFromNode(node, author, videoRects, indexedAt);
      if (!item) continue;
      item.author = item.author || author;
      item.postId = item.postId || postId;
      item.postUrl = item.postUrl || permalink;
      item.uri = item.uri || postUri;
      const key = `${item.kind}:${item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    return items;
  }

  function mediaItemFromNode(node, author, videoRects, indexedAt) {
    const url = mediaUrl(node);
    if (!url || url.startsWith("data:")) return null;
    const isVideo = node instanceof HTMLVideoElement;
    if (!isVideo && overlapsAnyRect(node.getBoundingClientRect(), videoRects)) return null;
    if (!isVideo && looksLikeVideoPreview(node)) return null;
    const normalized = isVideo ? url : fullSizeBlueskyUrl(url);
    if (!isVideo && !likelyPostImageUrl(normalized)) return null;
    const kind = isVideo ? (isGifLikeVideo(node) ? "gifVideo" : "video") : isGifUrl(normalized) ? "gifImage" : "image";
    return {
      kind,
      type: isVideo ? "video" : "image",
      url: normalized,
      thumb: isVideo ? "" : normalized,
      author,
      cid: cidFromMediaUrl(normalized),
      postId: "",
      postUrl: "",
      uri: "",
      indexedAt: indexedAt || Date.now(),
    };
  }

  function overlapsAnyRect(rect, rects) {
    const area = rect.width * rect.height;
    if (!area) return false;
    return rects.some((other) => {
      const width = Math.max(0, Math.min(rect.right, other.right) - Math.max(rect.left, other.left));
      const height = Math.max(0, Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top));
      const overlap = width * height;
      const otherArea = other.width * other.height || area;
      return overlap / Math.min(area, otherArea) > 0.45;
    });
  }

  function looksLikeVideoPreview(node) {
    const scope = nearbyMediaScope(node);
    const ariaText = [
      node.getAttribute("alt"),
      node.getAttribute("aria-label"),
      attr(node.closest("[aria-label]"), "aria-label"),
      attr(scope && scope.querySelector("[aria-label]"), "aria-label"),
      scope ? scope.textContent : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (/\b(video|play|播放|视频)\b/i.test(ariaText)) return true;

    const rect = node.getBoundingClientRect();
    const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const centerText = [
      attr(center, "aria-label"),
      attr(center && center.closest ? center.closest("[aria-label]") : null, "aria-label"),
      center ? center.textContent : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return /\b(video|play|播放|视频)\b/i.test(centerText);
  }

  function nearbyMediaScope(node) {
    const baseRect = node.getBoundingClientRect();
    let current = node.parentElement;
    let best = node.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      const rect = current.getBoundingClientRect();
      if (rect.width < baseRect.width || rect.height < baseRect.height) break;
      if (rect.width <= baseRect.width * 2.2 && rect.height <= baseRect.height * 2.2) best = current;
      if (rect.width > baseRect.width * 2.4 || rect.height > baseRect.height * 2.6) break;
      current = current.parentElement;
    }
    return best;
  }

  function attr(node, name) {
    return node && typeof node.getAttribute === "function" ? node.getAttribute(name) : "";
  }

  function postContainers(root = document) {
    const posts = new Set([...root.querySelectorAll(POST_SELECTOR)].filter((node) => node instanceof HTMLElement));
    for (const node of root.querySelectorAll(SEARCH_RESULT_POST_SELECTOR)) {
      if (node instanceof HTMLElement && isSearchResultPostCandidate(node)) posts.add(node);
    }
    for (const link of root.querySelectorAll('a[href*="/post/"]')) {
      const post = postContainerFromPermalink(link);
      if (post) posts.add(post);
    }
    for (const node of mediaNodesIn(root).filter(isPotentialPostMedia)) {
      const post = nearestPostContainer(node);
      if (post) posts.add(post);
    }
    return dedupeNestedPosts([...posts].filter(isSinglePostContainer));
  }

  function closestPostContainer(node) {
    const post = nearestPostContainer(node);
    return post instanceof HTMLElement ? post : null;
  }

  function belongsToPost(node, post) {
    const nearest = closestPostContainer(node);
    return nearest === post || (nearest && post.contains(nearest));
  }

  function isPotentialPostMedia(node) {
    if (node instanceof HTMLVideoElement) return isLargeMedia(node);
    const url = fullSizeBlueskyUrl(mediaUrl(node));
    return isLargeMedia(node) && likelyPostImageUrl(url);
  }

  function nearestPostContainer(node) {
    const explicit = node.closest(POST_SELECTOR);
    if (explicit instanceof HTMLElement) return explicit;

    const roleLink = node.closest(SEARCH_RESULT_POST_SELECTOR);
    if (roleLink instanceof HTMLElement && isSearchResultPostCandidate(roleLink)) return roleLink;

    const permalink = node.closest('a[href*="/post/"]');
    if (permalink instanceof HTMLElement) {
      const post = postContainerFromPermalink(permalink);
      if (post) return post;
    }

    let current = node.parentElement;
    let best = null;
    while (current && current !== document.body && current !== document.documentElement) {
      const rect = current.getBoundingClientRect();
      if (isLoosePostCandidate(current)) {
        best = current;
        break;
      }
      if (rect.height > Math.max(1000, window.innerHeight * 1.6)) break;
      current = current.parentElement;
    }
    return best;
  }

  function postContainerFromPermalink(permalink) {
    let current = permalink instanceof HTMLElement ? permalink.parentElement : null;
    let best = null;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.matches(SEARCH_RESULT_POST_SELECTOR) && isSinglePostContainer(current)) {
        return current;
      }
      if (current.matches(POST_SELECTOR)) return current;
      if (!best && isSinglePostContainer(current)) best = current;
      if (current.getAttribute("role") === "link" && current.getAttribute("tabindex") === "0") {
        if (isSinglePostContainer(current)) return current;
      }
      const rect = current.getBoundingClientRect();
      if (best && rect.height > Math.max(1200, window.innerHeight * 2)) break;
      current = current.parentElement;
    }
    return best;
  }

  function isSearchResultPostCandidate(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (node.getAttribute("role") !== "link" || node.getAttribute("tabindex") !== "0") return false;
    return isSinglePostContainer(node);
  }

  function isLoosePostCandidate(node) {
    return isSinglePostContainer(node) && hasActionButtons(node);
  }

  function isSinglePostContainer(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (!hasPostIdentity(node) || !hasPostMedia(node)) return false;
    if (isGlobalPageContainer(node)) return false;
    const rect = node.getBoundingClientRect();
    if (rect.height > Math.max(1600, window.innerHeight * 2.4)) return false;
    return distinctPostPermalinkCount(node) <= 2;
  }

  function isGlobalPageContainer(node) {
    if (!node || node === document.body || node === document.documentElement) return true;
    const tag = String(node.tagName || "").toLowerCase();
    if (["main", "section"].includes(tag)) return true;
    const rect = node.getBoundingClientRect();
    return rect.height > Math.max(1800, window.innerHeight * 2.7);
  }

  function hasPostIdentity(node) {
    return hasAuthorLink(node) && hasPostPermalink(node);
  }

  function hasAuthorLink(node) {
    return Boolean(node.querySelector('a[href^="/profile/"], a[href^="https://bsky.app/profile/"]'));
  }

  function hasPostPermalink(node) {
    return Boolean(node.querySelector('a[href*="/post/"]'));
  }

  function hasPostMedia(node) {
    return mediaNodesIn(node).some((item) => item instanceof HTMLVideoElement || likelyPostImageUrl(fullSizeBlueskyUrl(mediaUrl(item))));
  }

  function hasActionButtons(node) {
    if (!node.querySelector) return false;
    const dataTestIds = node.querySelector('[data-testid="replyBtn"], [data-testid="likeBtn"], [data-testid="postLikeBtn"], [data-testid="repostBtn"], [data-testid="postBookmarkBtn"], [data-testid="postShareBtn"], [data-testid="postDropdownBtn"]');
    if (dataTestIds) return true;
    return [...node.querySelectorAll('button[aria-label], [role="button"][aria-label]')].some((button) => {
      const label = String(button.getAttribute("aria-label") || button.getAttribute("title") || "").toLowerCase();
      return /回复|转发|喜欢|收藏|分享|菜单|选项|reply|repost|like|bookmark|share|more|menu/.test(label);
    });
  }

  function distinctPostPermalinkCount(node) {
    const links = [...node.querySelectorAll('a[href*="/post/"]')];
    const normalized = links
      .map((link) => postPermalinkKey(link.getAttribute("href") || link.href || ""))
      .filter(Boolean);
    return new Set(normalized).size;
  }

  function dedupeNestedPosts(posts) {
    const sorted = posts
      .filter((post) => post instanceof HTMLElement)
      .sort((a, b) => areaOfRect(a.getBoundingClientRect()) - areaOfRect(b.getBoundingClientRect()));
    const result = [];
    for (const post of sorted) {
      const key = postPermalink(post);
      if (result.some((kept) => {
        const keptKey = postPermalink(kept);
        return key && keptKey === key && (kept.contains(post) || post.contains(kept));
      })) continue;
      result.push(post);
    }
    return result.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectA.top - rectB.top || rectA.left - rectB.left;
    });
  }

  function areaOfRect(rect) {
    return Math.max(0, rect.width) * Math.max(0, rect.height);
  }

  function postPermalinkKey(href) {
    try {
      const url = new URL(href, location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] !== "profile" || !parts[1] || parts[2] !== "post" || !parts[3]) return "";
      return `${decodeURIComponent(parts[1])}/post/${decodeURIComponent(parts[3])}`;
    } catch (_) {
      return "";
    }
  }

  function postPermalink(post) {
    if (!(post instanceof HTMLElement)) return "";
    const links = [...post.querySelectorAll('a[href*="/post/"]')];
    const timestampLink =
      links.find((link) => link.hasAttribute("data-tooltip")) ||
      links.find((link) => /\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2}/.test(
        `${link.getAttribute("aria-label") || ""} ${link.getAttribute("title") || ""}`,
      ));
    const keys = [timestampLink, ...links.filter((link) => link !== timestampLink)]
      .map((link) => {
        if (!link) return "";
        const href = link.getAttribute("href") || link.href || "";
        const key = postPermalinkKey(href);
        return key ? `https://bsky.app/profile/${key}` : "";
      })
      .filter(Boolean);
    return keys[0] || "";
  }

  function postIdFromPermalink(href) {
    try {
      const url = new URL(href, location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[0] === "profile" && parts[2] === "post" && parts[3] ? decodeURIComponent(parts[3]) : "";
    } catch (_) {
      return "";
    }
  }

  function postIndexedAt(post) {
    if (!(post instanceof HTMLElement)) return Date.now();
    const link = [...post.querySelectorAll('a[href*="/post/"]')].find(
      (item) => item.hasAttribute("data-tooltip") || item.hasAttribute("aria-label"),
    );
    const raw = link
      ? link.getAttribute("data-tooltip") || link.getAttribute("aria-label") || ""
      : "";
    const parsed = parsePageDate(raw);
    return parsed || Date.now();
  }

  function parsePageDate(value) {
    const text = cleanDisplayName(value);
    const chinese = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日[^\d]*(\d{1,2}):(\d{2})/);
    if (chinese) {
      const date = new Date(
        Number(chinese[1]),
        Number(chinese[2]) - 1,
        Number(chinese[3]),
        Number(chinese[4]),
        Number(chinese[5]),
      );
      return date.getTime();
    }
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function atUriFromPermalink(href) {
    try {
      const url = new URL(href, location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] !== "profile" || !parts[1] || parts[2] !== "post" || !parts[3]) return "";
      const author = decodeURIComponent(parts[1]);
      const postId = decodeURIComponent(parts[3]);
      if (!author || !postId) return "";
      if (author.startsWith("did:")) return `at://${author}/app.bsky.feed.post/${postId}`;
      return "";
    } catch (_) {
      return "";
    }
  }

  function cidFromMediaUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      const cidMatch = parsed.pathname.match(/(baf[a-z0-9]+)(?:[@./_-]|$)/i);
      if (cidMatch && cidMatch[1]) return cidMatch[1];
      const parts = parsed.pathname.split("/").filter(Boolean);
      const blobIndex = parts.indexOf("blob");
      if (blobIndex >= 0 && parts[blobIndex + 1]) return stripCidSuffix(parts[blobIndex + 1]);
      const imgIndex = parts.findIndex((part) => /^feed_/.test(part));
      if (imgIndex >= 0 && parts[imgIndex + 2]) return stripCidSuffix(parts[imgIndex + 2]);
      return stripCidSuffix(parts[parts.length - 1] || "");
    } catch (_) {
      return "";
    }
  }

  function stripCidSuffix(value) {
    return String(value || "").replace(/@[^/]+$/i, "").replace(/\.[a-z0-9]+$/i, "");
  }

  function postAuthor(post) {
    const links = [...post.querySelectorAll('a[href^="/profile/"], a[href^="https://bsky.app/profile/"]')];
    let fallbackHandle = "";
    for (const link of links) {
      const handle = profileHandleFromHref(link.getAttribute("href") || link.href || "");
      if (!handle) continue;
      fallbackHandle ||= stripLeadingAt(handle);
      if (isAvatarProfileLink(link)) continue;
      const displayName = displayNameFromProfileLink(link, handle);
      if (displayName) return displayName;
    }
    const testId = post.getAttribute("data-testid") || "";
    const match = testId.match(/(?:feedItem|postThreadItem|searchFeedItem|searchPost)-by-(.+)$/);
    return cleanDisplayName(fallbackHandle || stripLeadingAt(match && match[1]) || "unknown");
  }

  function isAvatarProfileLink(link) {
    if (!(link instanceof HTMLElement)) return false;
    if (link.querySelector('[data-testid="userAvatarImage"], img')) return true;
    const label = `${link.getAttribute("aria-label") || ""} ${link.getAttribute("title") || ""}`;
    return /头像|avatar|profile picture|profile photo/i.test(label);
  }

  function displayNameFromProfileLink(link, handle) {
    if (!(link instanceof HTMLElement)) return "";
    const candidates = [
      link.textContent || "",
      ...[...link.querySelectorAll("[dir='auto'], span, div")].map((node) => node.textContent || ""),
      link.getAttribute("aria-label") || "",
      link.getAttribute("title") || "",
    ];
    const normalizedHandle = cleanDisplayName(handle).replace(/^@+/, "");
    const escapedHandle = escapeRegExp(normalizedHandle);
    const handleSuffix = normalizedHandle
      ? new RegExp(`\\s*[(@]?@?${escapedHandle}\\)?\\s*$`, "i")
      : null;
    for (const candidate of candidates) {
      let value = cleanDisplayName(candidate);
      if (!value || value.length > 120) continue;
      if (handleSuffix) value = value.replace(handleSuffix, "").trim();
      if (!value || value.startsWith("@") || value.toLowerCase() === normalizedHandle.toLowerCase()) continue;
      if (/^(follow|following|reply|repost|like|share|more|menu|查看个人资料|查看资料|view profile|profile)$/i.test(value)) continue;
      if (/头像|avatar|profile picture|profile photo|的头像/i.test(value)) continue;
      return value;
    }
    return "";
  }

  function cleanDisplayName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function profileHandleFromHref(href) {
    try {
      const url = new URL(href, location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[0] === "profile" && parts[1] ? decodeURIComponent(parts[1]) : "";
    } catch (_) {
      return "";
    }
  }

  function stripLeadingAt(value) {
    return cleanDisplayName(value).replace(/^@+/, "").trim();
  }

  function sanitizeFilenamePart(value) {
    return stripLeadingAt(value || "unknown")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 40) || "unknown";
  }

  function ensureFloatingButton() {
    if (document.querySelector(`.${FLOAT_BUTTON_CLASS}`)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = FLOAT_BUTTON_CLASS;
    button.innerHTML = 'BS ↓ <span class="cdb-floating-count">0</span>';
    button.title = "下载当前页面已加载的 Bluesky 帖子媒体";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const items = collectLoadedPageMedia();
      if (!items.length) {
        notify("当前页面已加载区域没有检测到可下载媒体。");
        return;
      }
      notify("正在补全 Bluesky 媒体信息...");
      openPicker(await enrichMediaItems(items));
    });
    document.body.appendChild(button);
  }

  function collectLoadedPageMedia() {
    const seen = new Set();
    const items = [];
    for (const post of postContainers().slice(0, MAX_PAGE_API_POSTS)) {
      for (const item of collectPostMedia(post)) {
        if (!item || seen.has(item.url)) continue;
        seen.add(item.url);
        items.push(item);
      }
    }
    return items;
  }

  function visibleStats() {
    const posts = postContainers();
    let resources = 0;
    for (const post of posts) resources += collectPostMedia(post).length;
    return { posts: posts.length, resources };
  }

  function scan() {
    ensureFloatingButton();
    for (const post of postContainers()) ensurePostButton(post);
    updateFloatingCount();
  }

  function updateFloatingCount() {
    const count = document.querySelector(`.${FLOAT_BUTTON_CLASS} .cdb-floating-count`);
    if (!count) return;
    const stats = visibleStats();
    const label = `${stats.posts}帖/${stats.resources}项`;
    if (count.textContent !== label) count.textContent = label;
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 180);
  }

  function ensurePostButton(post) {
    if (!(post instanceof HTMLElement)) return;
    if (post.getAttribute(POST_READY_ATTR) === "1" && post.querySelector(`.${POST_BUTTON_SLOT_CLASS}`)) return;
    if (!collectPostMedia(post).length) return;
    post.setAttribute(POST_READY_ATTR, "1");

    const button = document.createElement("button");
    button.type = "button";
    button.className = POST_BUTTON_CLASS;
    button.textContent = "↓";
    button.title = "下载这条帖子里的媒体";
    const stopActivation = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    };
    button.addEventListener("pointerdown", stopActivation, true);
    button.addEventListener("mousedown", stopActivation, true);
    button.addEventListener("click", async (event) => {
      stopActivation(event);
      const items = collectPostMedia(post);
      if (!items.length) {
        notify("这条帖子没有检测到可下载媒体。");
        return;
      }
      notify("正在补全 Bluesky 媒体信息...");
      await handlePostButtonDownload(await enrichMediaItems(items));
    });

    const slot = document.createElement("span");
    slot.className = POST_BUTTON_SLOT_CLASS;
    slot.appendChild(button);
    insertPostButton(post, slot);
  }

  function insertPostButton(post, slot) {
    const bookmark = post.querySelector('[data-testid="postBookmarkBtn"]') || findLabeledAction(post, /收藏|bookmark|save/i);
    if (bookmark) {
      const target = actionInsertionTarget(bookmark);
      target.insertAdjacentElement("afterend", slot);
      return;
    }

    const actionButton =
      post.querySelector('[data-testid="replyBtn"], [data-testid="postLikeBtn"], [data-testid="repostBtn"]') ||
      findLabeledAction(post, /回复|转发|喜欢|reply|repost|like/i);
    if (actionButton) {
      actionInsertionTarget(actionButton).insertAdjacentElement("afterend", slot);
      return;
    }

    const row = document.createElement("div");
    row.className = POST_BUTTON_FALLBACK_CLASS;
    row.appendChild(slot);
    post.appendChild(row);
  }

  function findLabeledAction(post, pattern) {
    return [...post.querySelectorAll('button[aria-label], [role="button"][aria-label]')].find((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`;
      return pattern.test(label);
    });
  }

  function actionInsertionTarget(action) {
    const button = action.closest("button") || action;
    return button.parentElement && button.parentElement.childElementCount === 1
      ? button.parentElement
      : button;
  }

  function openPicker(items) {
    closePicker();
    if (!items.length) return;
    const hasAudioAction = items.some(canExtractAudio);
    const hasGifAction = items.some(canConvertToGif);

    const mask = document.createElement("div");
    mask.className = `${PANEL_CLASS}-mask`;
    const panel = document.createElement("section");
    panel.className = PANEL_CLASS;
    panel.innerHTML = `
      <div class="cdb-panel-head">
        <strong>选择媒体（${items.length} 个资源）</strong>
        <button type="button" class="cdb-panel-close">关闭</button>
      </div>
      <div class="cdb-panel-body"></div>
      <div class="cdb-panel-foot">
        <span class="cdb-panel-bulk">
          <button type="button" class="cdb-panel-select">全选</button>
          <button type="button" class="cdb-panel-clear">取消全选</button>
        </span>
        <span class="cdb-panel-actions">
          <button type="button" class="cdb-panel-audio">抽取音频 MP3</button>
          <button type="button" class="cdb-panel-gif">转 GIF</button>
          <button type="button" class="cdb-panel-download">下载选中</button>
        </span>
      </div>
    `;

    const body = panel.querySelector(".cdb-panel-body");
    for (const [index, item] of items.entries()) {
      const row = document.createElement("label");
      row.className = "cdb-media-row";
      row.innerHTML = `
        <input type="checkbox" data-index="${index}">
        ${
          item.thumb
            ? `<img src="${escapeAttr(item.thumb)}" alt="">`
            : `<div class="cdb-media-thumb">${mediaLabel(item)}</div>`
        }
        <span>
          <span class="cdb-media-title">${escapeHtml(item.author || "unknown")} · ${mediaLabel(item)} ${index + 1}</span>
          <span class="cdb-media-url">${escapeHtml(shortUrl(item.url))}</span>
        </span>
      `;
      body.appendChild(row);
    }

    mask.addEventListener("click", closePicker);
    panel.querySelector(".cdb-panel-close").addEventListener("click", closePicker);
    const audioButton = panel.querySelector(".cdb-panel-audio");
    const gifButton = panel.querySelector(".cdb-panel-gif");
    audioButton.hidden = !hasAudioAction;
    gifButton.hidden = !hasGifAction;
    panel.querySelector(".cdb-panel-select").addEventListener("click", () => {
      const boxes = [...panel.querySelectorAll("input[type='checkbox']")];
      for (const box of boxes) box.checked = true;
    });
    panel.querySelector(".cdb-panel-clear").addEventListener("click", () => {
      const boxes = [...panel.querySelectorAll("input[type='checkbox']")];
      for (const box of boxes) box.checked = false;
    });
    panel.querySelector(".cdb-panel-download").addEventListener("click", async () => {
      const selected = selectedItems(panel, items);
      if (!selected.length) {
        notify("请先选择要下载的媒体。");
        return;
      }
      for (const [index, item] of selected.entries()) await downloadMedia(item, index);
    });
    audioButton.addEventListener("click", async () => {
      const selected = selectedItems(panel, items).filter(canExtractAudio);
      if (!selected.length) {
        notify("没有选中的视频，无法抽取音频。");
        return;
      }
      for (const [index, item] of selected.entries()) await extractAudio(item, index);
    });
    gifButton.addEventListener("click", async () => {
      const selected = selectedItems(panel, items).filter(canConvertToGif);
      if (!selected.length) {
        notify("没有选中的视频，无法转换 GIF。");
        return;
      }
      for (const [index, item] of selected.entries()) await downloadGifVideo(item, index);
    });

    document.body.appendChild(mask);
    document.body.appendChild(panel);
  }

  async function handlePostButtonDownload(items) {
    if (!items.length) return;
    if (isSinglePlainImage(items)) {
      notify("正在下载单张图片...");
      await downloadMedia(items[0], 0);
      return;
    }
    openPicker(items);
  }

  function isSinglePlainImage(items) {
    return items.length === 1 && items[0] && items[0].type === "image" && items[0].kind === "image";
  }

  function canExtractAudio(item) {
    return item && item.type === "video" && item.kind !== "gifVideo";
  }

  function canConvertToGif(item) {
    return item && item.type === "video";
  }

  function selectedItems(panel, items) {
    return [...panel.querySelectorAll("input[type='checkbox']:checked")]
      .map((box) => items[Number(box.getAttribute("data-index"))])
      .filter(Boolean);
  }

  function closePicker() {
    const panel = document.querySelector(`.${PANEL_CLASS}`);
    const mask = document.querySelector(`.${PANEL_CLASS}-mask`);
    if (panel) panel.remove();
    if (mask) mask.remove();
  }

  function mediaLabel(item) {
    if (item.kind === "gifImage" || item.kind === "gifVideo") return "GIF";
    return item.type === "video" ? "VIDEO" : "IMAGE";
  }

  async function enrichMediaItems(items) {
    const groups = new Map();
    for (const item of items) {
      if (!item || !item.postUrl) continue;
      const key = item.uri || item.postUrl;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    for (const [key, groupedItems] of groups.entries()) {
      try {
        const postView = await postViewForItem(groupedItems[0]);
        if (!postView) continue;
        const apiItems = mediaItemsFromPostView(postView, groupedItems[0].postUrl);
        mergeApiItems(groupedItems, apiItems);
      } catch (error) {
        console.debug("[Bluesky Media Downloader] API media fallback skipped", key, error);
      }
    }
    return items;
  }

  async function postViewForItem(item) {
    if (!item) return null;
    const uri = item.uri || await atUriForPostUrl(item.postUrl);
    if (!uri) return null;
    item.uri = uri;
    if (postViewCache.has(uri)) return postViewCache.get(uri);

    const url = `${APPVIEW_ORIGIN}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`;
    const payload = await requestJson(url);
    const postView = payload && payload.thread && payload.thread.post ? payload.thread.post : null;
    if (postView) postViewCache.set(uri, postView);
    return postView;
  }

  async function atUriForPostUrl(postUrl) {
    try {
      const url = new URL(postUrl, location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] !== "profile" || !parts[1] || parts[2] !== "post" || !parts[3]) return "";
      const author = decodeURIComponent(parts[1]);
      const postId = decodeURIComponent(parts[3]);
      const did = author.startsWith("did:") ? author : await resolveDid(author);
      return did && postId ? `at://${did}/app.bsky.feed.post/${postId}` : "";
    } catch (_) {
      return "";
    }
  }

  async function resolveDid(handle) {
    const clean = String(handle || "").replace(/^@+/, "");
    if (!clean) return "";
    if (clean.startsWith("did:")) return clean;
    if (didCache.has(clean)) return didCache.get(clean);

    let lastError = null;
    for (const origin of HANDLE_RESOLVE_ORIGINS) {
      try {
        const payload = await requestJson(`${origin}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(clean)}`);
        const did = payload && payload.did ? String(payload.did) : "";
        if (did) {
          didCache.set(clean, did);
          return did;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) console.debug("[Bluesky Media Downloader] resolve handle failed", clean, lastError);
    didCache.set(clean, "");
    return "";
  }

  function mediaItemsFromPostView(postView, postUrl) {
    const record = postView && postView.record ? postView.record : {};
    const embed = postView && postView.embed ? postView.embed : null;
    const author = apiAuthorName(postView && postView.author);
    const postId = postIdFromAtUri(postView && postView.uri ? postView.uri : "");
    const indexedAt = record && record.createdAt ? Date.parse(record.createdAt) || Date.now() : Date.now();
    const items = [];
    collectApiEmbedMedia(embed, {
      author,
      postId,
      postUrl,
      uri: postView && postView.uri ? postView.uri : "",
      indexedAt,
      items,
    });
    return items;
  }

  function apiAuthorName(author) {
    if (!author || typeof author !== "object") return "";
    const displayName = cleanDisplayName(author.displayName || "");
    const handle = stripLeadingAt(author.handle || "");
    if (displayName && displayName !== handle && !displayName.startsWith("@")) return displayName;
    return handle;
  }

  function collectApiEmbedMedia(embed, context) {
    if (!embed || typeof embed !== "object") return;
    const type = String(embed.$type || "");
    if (type.includes("app.bsky.embed.images") && Array.isArray(embed.images)) {
      for (const image of embed.images) {
        const fullsize = image.fullsize || image.thumb || "";
        if (!fullsize) continue;
        context.items.push({
          kind: "image",
          type: "image",
          url: fullsize,
          thumb: image.thumb || fullsize,
          author: context.author,
          cid: cidFromMediaUrl(fullsize),
          postId: context.postId,
          postUrl: context.postUrl,
          uri: context.uri,
          indexedAt: context.indexedAt,
        });
      }
    }
    if (type.includes("app.bsky.embed.video")) {
      const playlist = embed.playlist || "";
      const thumbnail = embed.thumbnail || "";
      context.items.push({
        kind: "video",
        type: "video",
        url: playlist || thumbnail,
        playlist,
        thumb: thumbnail,
        author: context.author,
        cid: cidFromMediaUrl(playlist || thumbnail),
        postId: context.postId,
        postUrl: context.postUrl,
        uri: context.uri,
        indexedAt: context.indexedAt,
      });
    }
    if (embed.media) collectApiEmbedMedia(embed.media, context);
    if (embed.record && embed.record.embeds) {
      for (const nestedEmbed of embed.record.embeds) collectApiEmbedMedia(nestedEmbed, context);
    }
    if (embed.record && embed.record.embed) collectApiEmbedMedia(embed.record.embed, context);
  }

  function mergeApiItems(domItems, apiItems) {
    if (!apiItems || !apiItems.length) return;
    const byCid = new Map(apiItems.filter((item) => item.cid).map((item) => [item.cid, item]));
    const byType = new Map();
    const used = new Set();
    for (const item of apiItems) {
      if (!byType.has(item.type)) byType.set(item.type, []);
      byType.get(item.type).push(item);
    }

    for (const item of domItems) {
      const cidMatch = item.cid && byCid.get(item.cid) && !used.has(byCid.get(item.cid))
        ? byCid.get(item.cid)
        : null;
      const match =
        cidMatch ||
        shiftMatchingType(byType, item.type) ||
        shiftMatchingType(byType, item.type === "video" ? "video" : "image");
      if (!match) continue;
      used.add(match);
      Object.assign(item, {
        kind: match.kind || item.kind,
        type: match.type || item.type,
        url: match.url || item.url,
        playlist: match.playlist || item.playlist || "",
        thumb: match.thumb || item.thumb || "",
        author: match.author || item.author,
        cid: match.cid || item.cid,
        postId: match.postId || item.postId,
        postUrl: match.postUrl || item.postUrl,
        uri: match.uri || item.uri,
        indexedAt: match.indexedAt || item.indexedAt,
      });
    }
  }

  function shiftMatchingType(byType, type) {
    const items = byType.get(type);
    return items && items.length ? items.shift() : null;
  }

  function postIdFromAtUri(uri) {
    const match = String(uri || "").match(/\/app\.bsky\.feed\.post\/([^/]+)$/);
    return match && match[1] ? match[1] : "";
  }

  async function downloadMedia(item, index) {
    try {
      if (item.kind === "gifImage") {
        downloadUrl(item.url, filenameFor(item, "gif", index, "gif"));
        return;
      }
      if (item.kind === "gifVideo") {
        await downloadGifVideo(item, index);
        return;
      }
      if (item.type === "image") {
        const blob = await requestBlob(item.url);
        const pngBlob = await imageBlobToPng(blob);
        downloadBlob(pngBlob, filenameFor(item, "image", index, "png"));
        return;
      }
      await downloadVideoMp4(item, index);
    } catch (error) {
      notify(`下载失败：${readableFetchError(error)}。已尝试打开原链接。`);
      if (item.url && !item.url.startsWith("blob:")) openInNewTab(item.url);
    }
  }

  async function downloadVideoMp4(item, index) {
    const url = item.playlist || item.url || "";
    if (!url) throw new Error("视频地址为空");
    if (/\.m3u8(?:$|[?#])/i.test(url)) {
      notify("正在读取 Bluesky 视频分片...");
      const videoBlob = await hlsPlaylistToMp4Blob(url);
      downloadBlob(videoBlob, filenameFor(item, "video", index, "mp4"));
      return;
    }
    if (url.startsWith("blob:")) {
      const blob = await requestBlob(url);
      downloadBlob(blob, filenameFor(item, "video", index, "mp4"));
      return;
    }
    const blob = await requestBlob(url);
    downloadBlob(blob, filenameFor(item, "video", index, "mp4"));
  }

  async function downloadGifVideo(item, index) {
    try {
      const gifEncoder = await ensureExternalLibrary("GIF", GIFJS_URL);
      if (!gifEncoder) throw new Error("GIF 编码器没有加载成功");
      notify("正在转换 GIF，默认截取前 6 秒。");
      const videoBlob = await requestVideoBlob(item);
      const gifBlob = await videoBlobToGif(videoBlob, gifEncoder);
      downloadBlob(gifBlob, filenameFor(item, "gif", index, "gif"));
      notify("GIF 已生成。");
    } catch (error) {
      notify(`GIF 转换失败：${readableFetchError(error)}。`);
      if (item.url && !item.url.startsWith("blob:")) openInNewTab(item.url);
    }
  }

  async function extractAudio(item, index) {
    try {
      const mp3EncoderLib = await ensureExternalLibrary("lamejs", LAMEJS_URL);
      if (!mp3EncoderLib) throw new Error("MP3 编码器没有加载成功");
      notify("正在抽取音频，需要按视频实际时长处理。");
      const videoBlob = await requestVideoBlob(item);
      const audioBuffer = await videoBlobToAudioBuffer(videoBlob);
      const mp3Blob = encodeMp3(audioBuffer, mp3EncoderLib);
      downloadBlob(mp3Blob, filenameFor(item, "audio", index, "mp3"));
      notify("音频已生成。");
    } catch (error) {
      notify(`音频抽取失败：${readableFetchError(error)}。`);
      if (item.url && !item.url.startsWith("blob:")) openInNewTab(item.url);
    }
  }

  async function requestVideoBlob(item) {
    const url = (item && (item.playlist || item.url)) || "";
    if (!url) throw new Error("视频地址为空");
    if (/\.m3u8(?:$|[?#])/i.test(url)) return hlsPlaylistToMp4Blob(url);
    return requestBlob(url);
  }

  function readableFetchError(error) {
    const message = String((error && error.message) || error || "");
    if (/脚本跨源权限未启用/i.test(message)) {
      return "请在 Tampermonkey 提示中允许访问 Bluesky API 和媒体域名，然后刷新页面";
    }
    if (/跨源读取失败|跨源读取超时/i.test(message)) {
      return "脚本读取 Bluesky 媒体失败，请确认已允许对应跨源权限";
    }
    if (/当前只支持 Bluesky fMP4/i.test(message)) {
      return message;
    }
    if (/failed to fetch|load failed|networkerror|cors|cross-origin/i.test(message)) {
      return "浏览器阻止读取跨源媒体，不能在页面内转换";
    }
    return message || "未知错误";
  }

  function ensureExternalLibrary(globalName, url) {
    const existing = globalValue(globalName);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => {
        const value = globalValue(globalName);
        if (value) resolve(value);
        else reject(new Error(`${globalName} 未暴露全局变量`));
      };
      script.onerror = () => reject(new Error(`加载 ${globalName} 失败`));
      document.head.appendChild(script);
    });
  }

  function globalValue(name) {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow[name]) return unsafeWindow[name];
    } catch (_) {
      // ignore isolated-world access errors
    }
    return window[name];
  }

  function requestBlob(url) {
    return requestResource(url, "blob");
  }

  function requestText(url) {
    return requestResource(url, "text");
  }

  async function requestJson(url) {
    const text = await requestText(url);
    return JSON.parse(text);
  }

  function requestArrayBuffer(url) {
    return requestResource(url, "arraybuffer");
  }

  function requestResource(url, responseType) {
    if (!url) return Promise.reject(new Error("媒体地址为空"));
    let target;
    try {
      target = new URL(url, location.href);
    } catch (_) {
      return Promise.reject(new Error("资源地址无效"));
    }

    if (target.origin === location.origin) {
      return fetch(target.href, { credentials: "include", mode: "cors" }).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (responseType === "text") return response.text();
        if (responseType === "arraybuffer") return response.arrayBuffer();
        return response.blob();
      });
    }

    const hostname = target.hostname.toLowerCase();
    if (!MEDIA_CONNECT_HOSTS.has(hostname) && !API_CONNECT_HOSTS.has(hostname)) {
      return Promise.reject(new Error("不允许读取此跨源资源域名"));
    }
    if (typeof GM_xmlhttpRequest !== "function") {
      return Promise.reject(new Error("脚本跨源权限未启用，请重新保存脚本"));
    }

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: target.href,
        responseType,
        timeout: responseType === "arraybuffer" ? 60000 : 30000,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            resolve(response.response);
          } else {
            reject(new Error(`HTTP ${response.status || 0}`));
          }
        },
        onerror() {
          reject(new Error("跨源读取失败"));
        },
        ontimeout() {
          reject(new Error("跨源读取超时"));
        },
      });
    });
  }

  async function hlsPlaylistToMp4Blob(playlistUrl) {
    const variant = await resolveHlsVariant(playlistUrl);
    const playlistText = await requestText(variant.url);
    const segmentUrls = mediaSegmentUrls(playlistText, variant.url);
    if (!segmentUrls.length) throw new Error("没有读取到 Bluesky 视频分片");
    if (!looksLikeFragmentedMp4Playlist(playlistText, segmentUrls)) {
      throw new Error("当前只支持 Bluesky fMP4 视频直接保存，无法把此 HLS 格式封装成 MP4");
    }

    const parts = [];
    const initUrl = initializationSegmentUrl(playlistText, variant.url);
    if (initUrl) parts.push(await requestArrayBuffer(initUrl));
    for (const segmentUrl of segmentUrls) {
      parts.push(await requestArrayBuffer(segmentUrl));
    }
    return new Blob(parts, { type: "video/mp4" });
  }

  async function resolveHlsVariant(url) {
    const text = await requestText(url);
    const variants = hlsVariantUrls(text, url);
    if (!variants.length) return { url, text };
    return variants.sort((a, b) => b.bandwidth - a.bandwidth)[0];
  }

  function hlsVariantUrls(text, baseUrl) {
    const lines = String(text || "").split(/\r?\n/);
    const variants = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
      const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
      const bandwidth = bandwidthMatch ? Number(bandwidthMatch[1]) : 0;
      const next = nextHlsUri(lines, index + 1);
      if (next) variants.push({ url: absoluteUrlFrom(next, baseUrl), bandwidth });
    }
    return variants;
  }

  function initializationSegmentUrl(text, baseUrl) {
    const match = String(text || "").match(/#EXT-X-MAP:[^\n\r]*URI=(?:"([^"]+)"|([^,\s]+))/i);
    return match ? absoluteUrlFrom(match[1] || match[2], baseUrl) : "";
  }

  function mediaSegmentUrls(text, baseUrl) {
    const lines = String(text || "").split(/\r?\n/);
    const urls = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line || line.startsWith("#")) continue;
      urls.push(absoluteUrlFrom(line, baseUrl));
    }
    return urls;
  }

  function nextHlsUri(lines, startIndex) {
    for (let index = startIndex; index < lines.length; index += 1) {
      const line = String(lines[index] || "").trim();
      if (!line || line.startsWith("#")) continue;
      return line;
    }
    return "";
  }

  function looksLikeFragmentedMp4Playlist(text, segmentUrls) {
    if (/#EXT-X-MAP:/i.test(text || "")) return true;
    return segmentUrls.every((url) => /\.(?:m4s|mp4)(?:$|[?#])/i.test(url));
  }

  function absoluteUrlFrom(url, baseUrl) {
    try {
      return new URL(url, baseUrl || location.href).href;
    } catch (_) {
      return url || "";
    }
  }

  async function imageBlobToPng(blob) {
    const image = await loadImage(blob);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);
    closeBitmap(image);
    return new Promise((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error("图片转换 PNG 失败"));
      }, "image/png");
    });
  }

  async function videoBlobToGif(videoBlob, gifEncoder) {
    const { video, objectUrl } = await loadVideo(videoBlob);
    const sourceWidth = video.videoWidth || 480;
    const sourceHeight = video.videoHeight || 270;
    const width = Math.min(480, sourceWidth);
    const height = Math.max(1, Math.round((sourceHeight / sourceWidth) * width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const duration = Math.min(6, Number.isFinite(video.duration) ? video.duration : 6);
    const fps = 8;
    const delay = 1000 / fps;
    const gif = new gifEncoder({
      workers: 2,
      quality: 10,
      workerScript: GIF_WORKER,
      width,
      height,
    });

    for (let time = 0; time < duration; time += 1 / fps) {
      await seekVideo(video, time);
      context.drawImage(video, 0, 0, width, height);
      gif.addFrame(context, { copy: true, delay });
    }

    URL.revokeObjectURL(objectUrl);
    return new Promise((resolve, reject) => {
      gif.on("finished", resolve);
      gif.on("abort", () => reject(new Error("GIF 编码被中止")));
      gif.render();
    });
  }

  function loadImage(blob) {
    if ("createImageBitmap" in window) return createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(blob);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("图片加载失败"));
      };
      image.src = objectUrl;
    });
  }

  function loadVideo(blob) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.onloadedmetadata = () => resolve({ video, objectUrl });
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("视频加载失败"));
      };
      video.src = objectUrl;
    });
  }

  function videoBlobToAudioBuffer(videoBlob) {
    return new Promise((resolve, reject) => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        reject(new Error("当前浏览器不支持 AudioContext"));
        return;
      }

      const audioContext = new AudioContextClass();
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(videoBlob);
      const chunks = [];
      const channels = 2;
      let source = null;
      let processor = null;
      let silentGain = null;
      let timeoutId = 0;
      let settled = false;

      video.src = objectUrl;
      video.crossOrigin = "anonymous";
      video.preload = "auto";
      video.playsInline = true;
      video.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(video);

      function cleanup() {
        clearTimeout(timeoutId);
        video.pause();
        video.remove();
        URL.revokeObjectURL(objectUrl);
        try {
          if (processor) processor.disconnect();
          if (source) source.disconnect();
          if (silentGain) silentGain.disconnect();
        } catch (_) {
          // ignore disconnect races
        }
        if (audioContext.close) audioContext.close();
      }

      function finish() {
        if (settled) return;
        settled = true;
        try {
          if (!chunks.length) throw new Error("没有捕获到音轨");
          resolve(makeAudioBufferLike(chunks, audioContext.sampleRate, channels));
        } catch (error) {
          reject(error);
        } finally {
          cleanup();
        }
      }

      function fail(error) {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error || "视频音频读取失败")));
        cleanup();
      }

      video.addEventListener("loadedmetadata", async () => {
        try {
          source = audioContext.createMediaElementSource(video);
          processor = audioContext.createScriptProcessor(4096, channels, channels);
          silentGain = audioContext.createGain();
          silentGain.gain.value = 0;
          processor.onaudioprocess = (event) => {
            const input = event.inputBuffer;
            const left = new Float32Array(input.getChannelData(0));
            const right =
              input.numberOfChannels > 1
                ? new Float32Array(input.getChannelData(1))
                : new Float32Array(input.getChannelData(0));
            chunks.push([left, right]);
          };
          source.connect(processor);
          processor.connect(silentGain);
          silentGain.connect(audioContext.destination);
          if (audioContext.resume) await audioContext.resume();
          timeoutId = window.setTimeout(
            () => fail(new Error("音频抽取超时")),
            Math.max(30000, ((Number.isFinite(video.duration) ? video.duration : 60) + 15) * 1000),
          );
          await video.play();
        } catch (error) {
          fail(error);
        }
      }, { once: true });
      video.addEventListener("ended", finish, { once: true });
      video.addEventListener("error", () => fail(new Error("视频加载失败")), { once: true });
    });
  }

  function makeAudioBufferLike(chunks, sampleRate, channels) {
    const length = chunks.reduce((sum, chunk) => sum + chunk[0].length, 0);
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    let offset = 0;
    for (const chunk of chunks) {
      data[0].set(chunk[0], offset);
      data[1].set(chunk[1], offset);
      offset += chunk[0].length;
    }
    return {
      sampleRate,
      numberOfChannels: channels,
      getChannelData(channel) {
        return data[Math.min(channel, channels - 1)];
      },
    };
  }

  function seekVideo(video, time) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("视频帧读取超时"));
      }, 8000);
      function cleanup() {
        clearTimeout(timer);
        video.removeEventListener("seeked", done);
        video.removeEventListener("error", fail);
      }
      function done() {
        cleanup();
        resolve();
      }
      function fail() {
        cleanup();
        reject(new Error("视频帧读取失败"));
      }
      video.addEventListener("seeked", done, { once: true });
      video.addEventListener("error", fail, { once: true });
      video.currentTime = Math.min(time, Math.max(0, (video.duration || time) - 0.05));
    });
  }

  function closeBitmap(image) {
    if (typeof image.close === "function") image.close();
  }

  function encodeMp3(audioBuffer, mp3EncoderLib) {
    const channels = Math.min(2, audioBuffer.numberOfChannels || 1);
    const left = floatToInt16(audioBuffer.getChannelData(0));
    const right = channels === 2 ? floatToInt16(audioBuffer.getChannelData(1)) : null;
    const encoder = new mp3EncoderLib.Mp3Encoder(channels, audioBuffer.sampleRate, 128);
    const blockSize = 1152;
    const parts = [];
    for (let offset = 0; offset < left.length; offset += blockSize) {
      const leftChunk = left.subarray(offset, offset + blockSize);
      const mp3Chunk =
        channels === 2
          ? encoder.encodeBuffer(leftChunk, right.subarray(offset, offset + blockSize))
          : encoder.encodeBuffer(leftChunk);
      if (mp3Chunk.length) parts.push(mp3Chunk);
    }
    const end = encoder.flush();
    if (end.length) parts.push(end);
    return new Blob(parts, { type: "audio/mpeg" });
  }

  function floatToInt16(channelData) {
    const result = new Int16Array(channelData.length);
    for (let index = 0; index < channelData.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[index]));
      result[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return result;
  }

  function filenameFor(item, kind, index, ext) {
    const date = item && item.indexedAt ? new Date(item.indexedAt) : new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      "_",
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
    ].join("");
    const author = sanitizeFilenamePart(item && item.author ? item.author : "unknown");
    const postId = sanitizeFilenamePart(item && item.postId ? item.postId : "post").slice(0, 20);
    return `${author}_${stamp}_${postId}_${String(index + 1).padStart(2, "0")}.${ext}`;
  }

  function downloadBlob(blob, name) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  }

  function downloadUrl(url, name) {
    if (typeof GM_download === "function" && !url.startsWith("blob:")) {
      try {
        GM_download({
          url,
          name,
          saveAs: false,
          onerror: () => openInNewTab(url),
        });
        return;
      } catch (_) {
        // fall back to anchor
      }
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openInNewTab(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function notify(message) {
    const toast = document.createElement("div");
    toast.className = TOAST_CLASS;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("'", "&#39;");
  }

  function shortUrl(url) {
    return url.length > 90 ? `${url.slice(0, 72)}...${url.slice(-14)}` : url;
  }

  function init() {
    addStyle();
    scan();
    window.addEventListener("focus", scheduleScan);
    window.addEventListener("scroll", scheduleScan, { passive: true });
    setInterval(scan, 1800);
    const observer = new MutationObserver((mutations) => {
      const hasPageChange = mutations.some((mutation) =>
        [...mutation.addedNodes, ...mutation.removedNodes].some(
          (node) => !(node instanceof HTMLElement) || !node.closest(`.${FLOAT_BUTTON_CLASS}, .${PANEL_CLASS}, .${TOAST_CLASS}`),
        ),
      );
      if (hasPageChange) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
