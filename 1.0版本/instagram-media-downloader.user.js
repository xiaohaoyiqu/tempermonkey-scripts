// ==UserScript==
// @name         Instagram Media Downloader@萧浩已去(xiaohaoyiqu)
// @namespace    local.content.downloader
// @version      1.0.0
// @description:zh-CN  Instagram 媒体下载辅助：给帖子添加下载入口，支持单图直下、多选下载、图片 PNG、视频 MP4、GIF 转换和视频音频抽取。
// @author       萧浩已去(xiaohaoyiqu)
// @match        https://www.instagram.com/*
// @run-at       document-idle
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      *
// ==/UserScript==

/* global GM_download, GM_xmlhttpRequest, unsafeWindow */

(function () {
  "use strict";

  const BUTTON_CLASS = "cdi-download-button";
  const PANEL_CLASS = "cdi-picker-panel";
  const TOAST_CLASS = "cdi-toast";
  const SCANNED_ATTR = "data-cdi-download-ready";
  const MEDIA_MIN_SIZE = 160;
  const SCAN_DELAY_MS = 180;
  const LAMEJS_URL = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";
  const GIFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js";
  const GIF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js";
  let scanTimer = 0;

  function addStyle() {
    if (document.getElementById("cdi-media-downloader-style")) return;
    const style = document.createElement("style");
    style.id = "cdi-media-downloader-style";
    style.textContent = `
      .${BUTTON_CLASS} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 32px;
        height: 32px;
        margin: 0 4px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: rgb(38, 38, 38);
        cursor: pointer;
        font: 700 16px/32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
      }
      .${BUTTON_CLASS}:hover {
        background: rgba(0, 0, 0, 0.06);
      }
      .${PANEL_CLASS}-mask {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        background: rgba(0, 0, 0, 0.38);
      }
      .${PANEL_CLASS} {
        position: fixed;
        top: 72px;
        right: 24px;
        z-index: 2147483647;
        width: min(480px, calc(100vw - 32px));
        max-height: calc(100vh - 120px);
        overflow: auto;
        color: #111827;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .cdi-panel-head,
      .cdi-panel-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(17, 24, 39, 0.1);
      }
      .cdi-panel-foot {
        border-top: 1px solid rgba(17, 24, 39, 0.1);
        border-bottom: 0;
        flex-wrap: wrap;
      }
      .cdi-panel-head strong {
        font-size: 14px;
      }
      .cdi-panel-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }
      .cdi-panel-bulk {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .cdi-panel-close,
      .cdi-panel-download,
      .cdi-panel-audio,
      .cdi-panel-gif,
      .cdi-panel-select,
      .cdi-panel-clear {
        border: 0;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        font: inherit;
      }
      .cdi-panel-close {
        background: #f3f4f6;
      }
      .cdi-panel-download {
        color: #fff;
        background: #111827;
      }
      .cdi-panel-audio {
        color: #fff;
        background: #7c3aed;
      }
      .cdi-panel-gif {
        color: #fff;
        background: #2563eb;
      }
      .cdi-panel-select,
      .cdi-panel-clear {
        color: #111827;
        background: #e5e7eb;
      }
      .cdi-media-row {
        display: grid;
        grid-template-columns: 28px 72px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(17, 24, 39, 0.08);
        cursor: pointer;
      }
      .cdi-media-row:hover {
        background: #f9fafb;
      }
      .cdi-media-row img,
      .cdi-media-thumb {
        width: 72px;
        height: 72px;
        object-fit: cover;
        border-radius: 6px;
        background: #111827;
        color: #fff;
        display: grid;
        place-items: center;
      }
      .cdi-media-title {
        display: block;
        font-weight: 600;
      }
      .cdi-media-url {
        display: block;
        word-break: break-all;
        color: #6b7280;
        font-size: 12px;
      }
      .${TOAST_CLASS} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        max-width: min(420px, calc(100vw - 36px));
        padding: 10px 12px;
        border-radius: 8px;
        color: #fff;
        background: rgba(17, 24, 39, 0.92);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.26);
      }
    `;
    document.documentElement.appendChild(style);
  }

  function highestSrcFromSrcset(srcset) {
    if (!srcset) return "";
    return srcset
      .split(",")
      .map((part) => {
        const [url, size] = part.trim().split(/\s+/);
        const width = Number((size || "").replace(/[^\d.]/g, "")) || 0;
        return { url: absoluteUrl(url), width };
      })
      .sort((a, b) => b.width - a.width)[0]?.url || "";
  }

  function absoluteUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch (_) {
      return url || "";
    }
  }

  function mediaUrl(node) {
    if (node instanceof HTMLImageElement) {
      return highestSrcFromSrcset(node.srcset) || absoluteUrl(node.currentSrc || node.src);
    }
    if (node instanceof HTMLVideoElement) {
      const source = node.querySelector("source[src]");
      return absoluteUrl(node.currentSrc || node.src || (source && source.getAttribute("src")) || "");
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
      return (node.videoWidth || 0) >= MEDIA_MIN_SIZE && (node.videoHeight || 0) >= MEDIA_MIN_SIZE;
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

  function isManagedUi(node) {
    return Boolean(node.closest(`.${PANEL_CLASS}, .${PANEL_CLASS}-mask, .${TOAST_CLASS}, .${BUTTON_CLASS}`));
  }

  function likelyDownloadableMedia(node) {
    if (!(node instanceof HTMLElement) || isManagedUi(node) || !isVisibleMedia(node)) return false;
    const url = mediaUrl(node);
    if (!url || url.startsWith("data:")) return false;
    return node instanceof HTMLImageElement || node instanceof HTMLVideoElement;
  }

  function nearestMediaContainer(node) {
    return (
      node.closest("[role='dialog'] article") ||
      node.closest("article") ||
      node.closest("[role='dialog']") ||
      node.parentElement
    );
  }

  function collectMedia(container) {
    const nodes = [...container.querySelectorAll("img[src], img[srcset], video")].filter(likelyDownloadableMedia);
    const seen = new Set();
    const items = [];
    const author = containerAuthor(container);
    const postId = containerShortcode(container);
    const indexedAt = containerPublishedAt(container);
    for (const node of nodes) {
      const url = mediaUrl(node);
      const type = node instanceof HTMLVideoElement ? "video" : "image";
      const kind =
        type === "video"
          ? isGifLikeVideo(node)
            ? "gifVideo"
            : "video"
          : isGifUrl(url)
            ? "gifImage"
            : "image";
      const key = `${type}:${url}`;
      if (!url || seen.has(key)) continue;
      seen.add(key);
      items.push({
        kind,
        type,
        url,
        thumb: node instanceof HTMLImageElement ? mediaUrl(node) : "",
        label: node.getAttribute("alt") || node.getAttribute("aria-label") || "",
        author,
        postId,
        indexedAt,
      });
    }
    return items;
  }

  function containerAuthor(container) {
    const links = [...container.querySelectorAll('a[href^="/"]')];
    let fallbackHandle = "";
    for (const link of links) {
      const handle = instagramHandleFromHref(link.getAttribute("href") || "");
      if (!handle) continue;
      fallbackHandle ||= handle;
      const displayName = instagramDisplayNameFromLink(link, handle);
      if (displayName) return displayName;
    }
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
    const match = ogTitle.match(/^([^(@]+)(?:\s*\(|\s+on Instagram)/i);
    return cleanDisplayName(match && match[1] ? match[1].trim() : fallbackHandle || "unknown");
  }

  function instagramDisplayNameFromLink(link, handle) {
    if (!(link instanceof HTMLElement)) return "";
    const candidates = [
      link.getAttribute("aria-label") || "",
      link.getAttribute("title") || "",
      link.textContent || "",
      ...[...link.querySelectorAll("span, div")].map((node) => node.textContent || ""),
    ];
    const normalizedHandle = cleanDisplayName(handle).replace(/^@+/, "");
    const escapedHandle = escapeRegExp(normalizedHandle);
    const handleSuffix = normalizedHandle
      ? new RegExp(`\\s*\\(@?${escapedHandle}\\)\\s*$|\\s+@?${escapedHandle}\\s*$`, "i")
      : null;
    for (const candidate of candidates) {
      let value = cleanDisplayName(candidate);
      if (!value || value.length > 120) continue;
      if (handleSuffix) value = value.replace(handleSuffix, "").trim();
      if (!value || value.startsWith("@") || value.toLowerCase() === normalizedHandle.toLowerCase()) continue;
      if (/^(follow|following|message|more|settings)$/i.test(value)) continue;
      return value;
    }
    return "";
  }

  function instagramHandleFromHref(href) {
    try {
      const url = new URL(href, location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 1 || !parts[0]) return "";
      const reserved = new Set(["accounts", "direct", "explore", "p", "reel", "reels", "stories", "tv"]);
      return reserved.has(parts[0]) ? "" : parts[0];
    } catch (_) {
      return "";
    }
  }

  function containerShortcode(container) {
    const candidates = [
      location.href,
      ...[...container.querySelectorAll('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]')]
        .map((link) => link.getAttribute("href") || link.href || ""),
    ];
    for (const href of candidates) {
      const shortcode = shortcodeFromHref(href);
      if (shortcode) return sanitizeFilenamePart(shortcode);
    }
    return "post";
  }

  function shortcodeFromHref(href) {
    try {
      const url = new URL(href, location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      const index = parts.findIndex((part) => ["p", "reel", "tv"].includes(part));
      return index >= 0 && parts[index + 1] ? parts[index + 1] : "";
    } catch (_) {
      return "";
    }
  }

  function containerPublishedAt(container) {
    const time = container.querySelector("time[datetime]") || document.querySelector("time[datetime]");
    const parsed = time ? Date.parse(time.getAttribute("datetime") || "") : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function sanitizeFilenamePart(value) {
    return cleanDisplayName(value)
      .replace(/^@+/, "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "unknown";
  }

  function isGifUrl(url) {
    return /\.gif(?:$|[?#])/i.test(url || "");
  }

  function isGifLikeVideo(video) {
    const labeledAncestor = video.closest("[aria-label], [title]");
    const text = [
      video.getAttribute("aria-label"),
      video.getAttribute("title"),
      labeledAncestor ? labeledAncestor.getAttribute("aria-label") : "",
      labeledAncestor ? labeledAncestor.getAttribute("title") : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes("gif") || isGifUrl(mediaUrl(video));
  }

  function cleanDisplayName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function ensureContainerButton(container) {
    if (!(container instanceof HTMLElement)) return;
    const existingButton = container.querySelector(`.${BUTTON_CLASS}`);
    if (container.getAttribute(SCANNED_ATTR) === "1" && existingButton) {
      insertContainerButton(container, existingButton);
      return;
    }
    const items = collectMedia(container);
    if (!items.length) return;

    container.setAttribute(SCANNED_ATTR, "1");

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.title = "下载媒体";
    button.setAttribute("aria-label", "下载媒体");
    button.textContent = "↓";
    const stopActivation = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    };
    button.addEventListener("pointerdown", stopActivation, true);
    button.addEventListener("mousedown", stopActivation, true);
    button.addEventListener("click", async (event) => {
      stopActivation(event);
      const items = collectMedia(container);
      if (!items.length) {
        notify("当前区域没有检测到可下载媒体。");
        return;
      }
      await handleContainerDownload(items);
    });
    insertContainerButton(container, button);
  }

  function insertContainerButton(container, button) {
    const moreButton = findMoreOptionsButton(container);
    if (moreButton) {
      const target = actionInsertionTarget(moreButton);
      target.insertAdjacentElement("beforebegin", button);
      return;
    }

    const header = container.querySelector("header") || container.closest("article")?.querySelector("header");
    if (header) {
      header.appendChild(button);
      return;
    }
    container.prepend(button);
  }

  function findMoreOptionsButton(container) {
    const scopes = [
      container.querySelector("header"),
      container.closest("article")?.querySelector("header"),
      container,
    ].filter(Boolean);

    for (const scope of scopes) {
      const labeled = [...scope.querySelectorAll("[aria-label], [title]")].find((node) => {
        const label = actionLabel(node);
        return /more options|更多|选项|options/i.test(label);
      });
      if (labeled) return actionElement(labeled);

      const dotted = [...scope.querySelectorAll("button, [role='button']")].find((node) => {
        const label = actionLabel(node);
        return /(?:\.\.\.|…|•••|⋯)/.test(label);
      });
      if (dotted) return actionElement(dotted);
    }
    return null;
  }

  function actionElement(node) {
    return node.closest("button, [role='button']") || node;
  }

  function actionInsertionTarget(action) {
    const button = actionElement(action);
    return button.parentElement && button.parentElement.childElementCount === 1
      ? button.parentElement
      : button;
  }

  function actionLabel(node) {
    const isElement =
      node instanceof HTMLElement ||
      (typeof SVGElement !== "undefined" && node instanceof SVGElement);
    if (!isElement) return "";
    return [
      node.getAttribute("aria-label"),
      node.getAttribute("title"),
      node.textContent,
      ...[...node.querySelectorAll("[aria-label], title")].map((child) =>
        child.getAttribute("aria-label") || child.getAttribute("title") || child.textContent,
      ),
    ]
      .filter(Boolean)
      .join(" ");
  }

  function scan() {
    const selector = [
      "article img[src]",
      "article img[srcset]",
      "article video",
      "[role='dialog'] img[src]",
      "[role='dialog'] img[srcset]",
      "[role='dialog'] video",
    ].join(", ");
    const mediaNodes = [...document.querySelectorAll(selector)].filter(isLargeMedia);
    const containers = new Set(mediaNodes.map(nearestMediaContainer).filter(Boolean));
    for (const container of containers) ensureContainerButton(container);
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, SCAN_DELAY_MS);
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
      <div class="cdi-panel-head">
        <strong>选择媒体</strong>
        <button type="button" class="cdi-panel-close">关闭</button>
      </div>
      <div class="cdi-panel-body"></div>
      <div class="cdi-panel-foot">
        <span class="cdi-panel-bulk">
          <button type="button" class="cdi-panel-select">全选</button>
          <button type="button" class="cdi-panel-clear">取消全选</button>
        </span>
        <span class="cdi-panel-actions">
          <button type="button" class="cdi-panel-audio">抽取音频 MP3</button>
          <button type="button" class="cdi-panel-gif">转 GIF</button>
          <button type="button" class="cdi-panel-download">下载选中</button>
        </span>
      </div>
    `;

    const body = panel.querySelector(".cdi-panel-body");
    for (const [index, item] of items.entries()) {
      const row = document.createElement("label");
      row.className = "cdi-media-row";
      row.innerHTML = `
        <input type="checkbox" data-index="${index}">
        ${
          item.thumb
            ? `<img src="${escapeAttr(item.thumb)}" alt="">`
            : `<div class="cdi-media-thumb">${mediaLabel(item)}</div>`
        }
        <span>
          <span class="cdi-media-title">${escapeHtml(item.author || "unknown")} · ${mediaLabel(item)} ${index + 1}</span>
          <span class="cdi-media-url">${escapeHtml(shortUrl(item.url))}</span>
        </span>
      `;
      body.appendChild(row);
    }

    mask.addEventListener("click", closePicker);
    panel.querySelector(".cdi-panel-close").addEventListener("click", closePicker);
    const audioButton = panel.querySelector(".cdi-panel-audio");
    const gifButton = panel.querySelector(".cdi-panel-gif");
    audioButton.hidden = !hasAudioAction;
    gifButton.hidden = !hasGifAction;
    panel.querySelector(".cdi-panel-select").addEventListener("click", () => {
      const boxes = [...panel.querySelectorAll("input[type='checkbox']")];
      for (const box of boxes) box.checked = true;
    });
    panel.querySelector(".cdi-panel-clear").addEventListener("click", () => {
      const boxes = [...panel.querySelectorAll("input[type='checkbox']")];
      for (const box of boxes) box.checked = false;
    });
    panel.querySelector(".cdi-panel-download").addEventListener("click", async () => {
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

  async function handleContainerDownload(items) {
    if (items.length === 1 && items[0].type === "image") {
      notify("正在下载单张图片...");
      await downloadMedia(items[0], 0);
      return;
    }
    openPicker(items);
  }

  function mediaLabel(item) {
    if (item.kind === "gifImage" || item.kind === "gifVideo") return "GIF";
    return item.type === "video" ? "VIDEO" : "IMAGE";
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
    document.querySelector(`.${PANEL_CLASS}`)?.remove();
    document.querySelector(`.${PANEL_CLASS}-mask`)?.remove();
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

  function filenameFor(item, kind, index, ext) {
    const date = item && item.indexedAt ? new Date(item.indexedAt) : new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      "_",
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0"),
    ].join("");
    const author = sanitizeFilenamePart(item && item.author ? item.author : "unknown");
    const postId = sanitizeFilenamePart(item && item.postId ? item.postId : "post");
    return `instagram_${author}_${stamp}_${postId}_${kind}_${String(index + 1).padStart(2, "0")}.${ext}`;
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
      downloadUrl(item.url, filenameFor(item, "video", index, "mp4"));
    } catch (error) {
      notify(`下载失败：${error.message || error}`);
      if (item.url && !item.url.startsWith("blob:")) openInNewTab(item.url);
    }
  }

  async function downloadGifVideo(item, index) {
    try {
      const gifEncoder = await ensureExternalLibrary("GIF", GIFJS_URL);
      if (!gifEncoder) throw new Error("GIF 编码器没有加载成功");
      notify("正在转换 GIF，默认处理视频前 6 秒。");
      const videoBlob = await requestBlob(item.url);
      const gifBlob = await videoBlobToGif(videoBlob, gifEncoder);
      downloadBlob(gifBlob, filenameFor(item, "gif", index, "gif"));
      notify("GIF 已生成。");
    } catch (error) {
      notify(`GIF 转换失败：${error.message || error}`);
    }
  }

  async function extractAudio(item, index) {
    try {
      const mp3EncoderLib = await ensureExternalLibrary("lamejs", LAMEJS_URL);
      if (!mp3EncoderLib) throw new Error("MP3 编码器没有加载成功");
      notify("正在抽取音频，需要按视频实际时长处理。");
      const videoBlob = await requestBlob(item.url);
      const audioBuffer = await videoBlobToAudioBuffer(videoBlob);
      const mp3Blob = encodeMp3(audioBuffer, mp3EncoderLib);
      downloadBlob(mp3Blob, filenameFor(item, "audio", index, "mp3"));
      notify("音频已生成。");
    } catch (error) {
      notify(`音频抽取失败：${error.message || error}`);
    }
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

  function requestResource(url, responseType) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error("媒体地址为空"));
        return;
      }
      if (url.startsWith("blob:") || typeof GM_xmlhttpRequest !== "function") {
        fetch(url, { credentials: "include" })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.blob();
          })
          .then(resolve)
          .catch(reject);
        return;
      }
      try {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          responseType,
          anonymous: false,
          timeout: 120000,
          onload: (response) => {
            if (response.status >= 200 && response.status < 400) {
              resolve(response.response);
            } else {
              reject(new Error(`HTTP ${response.status}`));
            }
          },
          onerror: () => reject(new Error("请求媒体失败")),
          ontimeout: () => reject(new Error("请求媒体超时")),
        });
      } catch (error) {
        reject(error);
      }
    });
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

    video.pause();
    video.remove();
    URL.revokeObjectURL(objectUrl);
    return new Promise((resolve, reject) => {
      gif.on("finished", resolve);
      gif.on("abort", () => reject(new Error("GIF 编码被中止")));
      gif.render();
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
          processor?.disconnect();
          source?.disconnect();
          silentGain?.disconnect();
        } catch (_) {
          // ignore disconnect races
        }
        audioContext.close?.();
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
          await audioContext.resume?.();
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
    setTimeout(() => toast.remove(), 4200);
  }

  function init() {
    addStyle();
    scan();
    window.addEventListener("focus", scheduleScan);
    window.addEventListener("scroll", scheduleScan, { passive: true });
    setInterval(scheduleScan, 1800);
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
