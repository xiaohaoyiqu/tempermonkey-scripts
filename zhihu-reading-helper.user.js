// ==UserScript==
// @name         Zhihu Reading Helper@萧浩已去(xiaohaoyiqu)
// @namespace    local.content.downloader
// @version      1.0.0
// @description:zh-CN  知乎阅读辅助：通过按钮轮手动管理浏览历史、内容收起或收起过长回答、顶部导航隐藏，不默认修改页面。
// @author       萧浩已去(xiaohaoyiqu)
// @match        https://www.zhihu.com/*
// @match        https://zhihu.com/*
// @match        https://zhuanlan.zhihu.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  "use strict";

  const HISTORY_KEY = "cdz_zhihu_question_history";
  const MAX_HISTORY = 5;
  const HOST_ID = "cdz-zhihu-wheel-host";
  const EXPAND_ATTR = "data-cdz-reading-expand";
  const COLLAPSE_MAX_HEIGHT = "320px";
  const WHEEL_RIGHT = 24;
  const WHEEL_MIN_BOTTOM = 172;
  const WHEEL_MAX_BOTTOM_MARGIN = 126;
  const WHEEL_KANSHAN_GAP = 18;
  const CONTENT_SELECTORS = [
    ".RichContent-inner",
    ".RichText",
    ".Post-RichTextContainer",
    ".ContentItem .RichContent",
    ".AnswerItem .RichContent",
    ".TopstoryItem .RichContent",
  ].join(", ");
  const HEADER_SELECTORS = [
    ".AppHeader",
    ".ColumnPageHeader",
    ".TopstoryPageHeader",
    "header",
  ];

  let lastRoute = location.href;
  let routeTimer = 0;
  let wheelPositionTimer = 0;
  let wheelPositionObserver = null;
  let scrollHandler = null;
  let lastScrollY = window.scrollY;
  let headerAutoHideEnabled = false;
  let headerHidden = false;
  let ui = null;
  const collapsedBodies = new Set();
  const bodyExpandButtons = new Map();
  const bodyStyleSnapshots = new WeakMap();
  const headerStyleSnapshots = new WeakMap();
  const trackedHeaders = new Set();

  function gmGet(key, fallback) {
    try {
      if (typeof GM_getValue === "function") return GM_getValue(key, fallback);
    } catch (_) {
      // fall through
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function gmSet(key, value) {
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(key, value);
        return;
      }
    } catch (_) {
      // fall through
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // ignore quota errors
    }
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function questionTitle() {
    const candidates = [
      ".QuestionHeader-title",
      "h1",
      "[data-za-detail-view-element_name='Title']",
    ];
    for (const selector of candidates) {
      const node = document.querySelector(selector);
      const text = node && cleanText(node.textContent);
      if (text) return text;
    }
    return document.title.replace(/\s*-\s*知乎\s*$/, "").trim() || "知乎页面";
  }

  function recordQuestionHistory() {
    const match = location.pathname.match(/^\/question\/(\d+)/);
    if (!match) return false;

    const item = {
      id: match[1],
      title: questionTitle(),
      url: location.origin + location.pathname,
      savedAt: Date.now(),
    };
    const stored = gmGet(HISTORY_KEY, []);
    const history = Array.isArray(stored) ? stored : [];
    const next = [item, ...history.filter((old) => old && old.id !== item.id)].slice(0, MAX_HISTORY);
    gmSet(HISTORY_KEY, next);
    return true;
  }

  function readHistory() {
    const stored = gmGet(HISTORY_KEY, []);
    return Array.isArray(stored) ? stored.filter((item) => item && item.url) : [];
  }

  function makeShadowUi() {
    if (document.getElementById(HOST_ID)) return null;
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = [
      "position:fixed",
      `right:${WHEEL_RIGHT}px`,
      `bottom:${WHEEL_MIN_BOTTOM}px`,
      "width:0",
      "height:0",
      "z-index:2147483647",
      "pointer-events:none",
    ].join(";");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        * {
          box-sizing: border-box;
        }
        .root {
          position: relative;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        button,
        a {
          font: inherit;
        }
        button {
          border: 0;
          cursor: pointer;
        }
        .main-button,
        .wheel-button {
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: #fff;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.24);
          pointer-events: auto;
          user-select: none;
        }
        .main-button {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 46px;
          height: 46px;
          background: #175199;
          font-size: 22px;
          line-height: 1;
          transition: transform 160ms ease, background 160ms ease;
        }
        .main-button:hover {
          background: #0f3d76;
        }
        .open .main-button {
          transform: rotate(45deg);
        }
        .wheel-button {
          position: absolute;
          right: 1px;
          bottom: 1px;
          width: 42px;
          height: 42px;
          padding: 0;
          background: #334155;
          font-size: 12px;
          opacity: 0;
          transform: translate(0, 0) scale(0.4);
          transition: transform 180ms ease, opacity 180ms ease, background 160ms ease;
          pointer-events: none;
        }
        .wheel-button:hover {
          background: #175199;
        }
        .open .wheel-button {
          opacity: 1;
          pointer-events: auto;
        }
        .open .action-history {
          transform: translate(-58px, -188px) scale(1);
        }
        .open .action-collapse {
          transform: translate(-58px, -141px) scale(1);
        }
        .open .action-restore {
          transform: translate(-58px, -94px) scale(1);
        }
        .open .action-header {
          transform: translate(-58px, -47px) scale(1);
        }
        .open .action-refresh {
          transform: translate(-58px, 0) scale(1);
        }
        .history-panel {
          position: absolute;
          right: 0;
          bottom: 58px;
          width: 292px;
          max-height: 360px;
          overflow: auto;
          color: #17233d;
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid rgba(15, 23, 42, 0.14);
          border-radius: 8px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
          pointer-events: auto;
        }
        .history-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 11px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.1);
          font-size: 13px;
          font-weight: 600;
        }
        .history-close {
          padding: 2px 5px;
          color: #64748b;
          background: transparent;
        }
        .history-item {
          display: block;
          padding: 9px 11px;
          color: #1f2937;
          text-decoration: none;
          font-size: 13px;
          line-height: 1.4;
          border-bottom: 1px solid rgba(15, 23, 42, 0.07);
        }
        .history-item:hover {
          background: #f6f8fa;
        }
        .history-empty {
          padding: 13px 11px;
          color: #7a8599;
          font-size: 13px;
        }
        .toast {
          position: absolute;
          right: 0;
          bottom: 58px;
          width: max-content;
          max-width: 290px;
          padding: 8px 10px;
          color: #fff;
          background: rgba(15, 23, 42, 0.92);
          border-radius: 6px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.22);
          font-size: 12px;
          line-height: 1.4;
          pointer-events: none;
        }
        [hidden] {
          display: none !important;
        }
      </style>
      <div class="root">
        <div class="history-panel" hidden></div>
        <button class="wheel-button action-history" type="button" title="查看浏览历史" aria-label="查看浏览历史">历史</button>
        <button class="wheel-button action-collapse" type="button" title="收起当前页面较长内容" aria-label="收起当前页面较长内容">收起</button>
        <button class="wheel-button action-restore" type="button" title="展开收起内容或触发页面阅读全文" aria-label="展开收起内容或触发页面阅读全文">展开</button>
        <button class="wheel-button action-header" type="button" title="开启或关闭顶部导航滚动隐藏" aria-label="开启或关闭顶部导航滚动隐藏">导航</button>
        <button class="wheel-button action-refresh" type="button" title="记录当前问题并更新历史面板" aria-label="记录当前问题并更新历史面板">记录</button>
        <button class="main-button" type="button" title="打开知乎阅读辅助按钮轮" aria-label="打开知乎阅读辅助按钮轮">+</button>
      </div>
    `;
    document.body.appendChild(host);
    return {
      host,
      shadow,
      root: shadow.querySelector(".root"),
      main: shadow.querySelector(".main-button"),
      history: shadow.querySelector(".action-history"),
      collapse: shadow.querySelector(".action-collapse"),
      restore: shadow.querySelector(".action-restore"),
      header: shadow.querySelector(".action-header"),
      refresh: shadow.querySelector(".action-refresh"),
      panel: shadow.querySelector(".history-panel"),
    };
  }

  function showToast(message) {
    if (!ui || !ui.root) return;
    const oldToast = ui.root.querySelector(".toast");
    if (oldToast) oldToast.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    ui.root.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function setMenuOpen(open) {
    if (!ui) return;
    ui.root.classList.toggle("open", open);
    ui.main.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function elementIsVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0;
  }

  function actionText(element) {
    if (!(element instanceof HTMLElement)) return "";
    return cleanText([
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent,
    ].filter(Boolean).join(" "));
  }

  function scheduleWheelPosition() {
    clearTimeout(wheelPositionTimer);
    wheelPositionTimer = window.setTimeout(adjustWheelPosition, 120);
  }

  function adjustWheelPosition() {
    if (!ui || !ui.host) return;
    const host = ui.host;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1200;
    let bottom = WHEEL_MIN_BOTTOM;
    let right = WHEEL_RIGHT;

    const kanshanPanel = [...document.querySelectorAll('[data-kanshan-panel="true"]')]
      .find((panel) => panel instanceof HTMLElement && elementIsVisible(panel));
    if (kanshanPanel) {
      const rect = kanshanPanel.getBoundingClientRect();
      right = Math.max(WHEEL_RIGHT, viewportWidth - rect.left + WHEEL_KANSHAN_GAP);
      bottom = Math.max(bottom, viewportHeight - rect.bottom + 14);
    }

    const candidates = [...document.querySelectorAll("button, [role='button'], a, [aria-label], [title]")];
    for (const node of candidates) {
      if (!(node instanceof HTMLElement) || host.contains(node) || !elementIsVisible(node)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.right < viewportWidth - 220 || rect.bottom < viewportHeight - 360) continue;
      const style = getComputedStyle(node);
      const label = actionText(node);
      const isRightTool =
        /看山|回到顶部|返回顶部|顶部|AI|ai/i.test(label) ||
        ((style.position === "fixed" || style.position === "sticky") && rect.width <= 160 && rect.height <= 160);
      if (!isRightTool) continue;
      bottom = Math.max(bottom, viewportHeight - rect.top + 14);
    }

    const maxBottom = Math.max(WHEEL_MIN_BOTTOM, viewportHeight - WHEEL_MAX_BOTTOM_MARGIN);
    host.style.right = `${Math.min(right, Math.max(WHEEL_RIGHT, viewportWidth - 72))}px`;
    host.style.bottom = `${Math.min(bottom, maxBottom)}px`;
  }

  function renderHistoryPanel() {
    if (!ui || !ui.panel) return;
    ui.panel.replaceChildren();
    const head = document.createElement("div");
    head.className = "history-head";
    const title = document.createElement("span");
    title.textContent = "最近浏览的问题";
    const close = document.createElement("button");
    close.className = "history-close";
    close.type = "button";
    close.textContent = "关闭";
    close.addEventListener("click", () => {
      ui.panel.hidden = true;
    });
    head.append(title, close);
    ui.panel.appendChild(head);

    const history = readHistory();
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "暂无问题记录";
      ui.panel.appendChild(empty);
      return;
    }
    for (const item of history) {
      const link = document.createElement("a");
      link.className = "history-item";
      link.href = item.url;
      link.title = item.title || "";
      link.textContent = item.title || item.url;
      ui.panel.appendChild(link);
    }
  }

  function toggleHistoryPanel() {
    if (!ui || !ui.panel) return;
    if (ui.panel.hidden) {
      renderHistoryPanel();
      ui.panel.hidden = false;
    } else {
      ui.panel.hidden = true;
    }
  }

  function propertySnapshot(element, property) {
    return {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    };
  }

  function restoreProperty(element, property, snapshot) {
    if (!snapshot || !snapshot.value) {
      element.style.removeProperty(property);
      return;
    }
    element.style.setProperty(property, snapshot.value, snapshot.priority);
  }

  function expandButtonStyle() {
    return [
      "display:block",
      "width:100%",
      "margin:8px 0 12px",
      "padding:8px 12px",
      "border:0",
      "border-radius:6px",
      "color:#175199",
      "background:#f6f8fa",
      "font:14px/1.4 -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif",
      "cursor:pointer",
      "text-align:center",
    ].join(";");
  }

  function ensureExpandButton(body) {
    const existing = bodyExpandButtons.get(body);
    if (existing && existing.isConnected) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "阅读全文";
    button.setAttribute(EXPAND_ATTR, "1");
    button.setAttribute("aria-label", "阅读全文并恢复这段内容");
    button.style.cssText = expandButtonStyle();
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nativeClicked = clickNativeReadMoreForBody(body);
      const restored = nativeClicked || restoreCollapsedBody(body);
      showToast(restored ? "已展开当前内容" : "没有找到可展开的内容");
    });
    body.insertAdjacentElement("afterend", button);
    bodyExpandButtons.set(body, button);
    return button;
  }

  function removeExpandButton(body) {
    const button = bodyExpandButtons.get(body);
    if (button) button.remove();
    bodyExpandButtons.delete(body);
  }

  function restoreCollapsedBody(body) {
    if (!(body instanceof HTMLElement)) return false;
    const snapshot = bodyStyleSnapshots.get(body);
    restoreProperty(body, "max-height", snapshot && snapshot.maxHeight);
    restoreProperty(body, "overflow", snapshot && snapshot.overflow);
    collapsedBodies.delete(body);
    removeExpandButton(body);
    return true;
  }

  function contentItemFor(node) {
    if (!(node instanceof HTMLElement)) return null;
    return node.closest(".ContentItem, .List-item, article, .Post-content, .Post-RichTextContainer");
  }

  function nativeReadMoreButtons(root = document) {
    return uniqueButtonsByContentItem([...root.querySelectorAll("button, a, [role='button']")]
      .filter((button) => {
        if (!(button instanceof HTMLElement)) return false;
        if (button.hasAttribute(EXPAND_ATTR)) return false;
        if (button.closest('[data-kanshan-panel="true"]')) return false;
        if (!contentItemFor(button)) return false;
        if (!elementIsVisible(button)) return false;
        return button.classList.contains("ContentItem-expandButton") ||
          /阅读全文|展开阅读全文|显示全部|展开全部/.test(actionText(button));
      }));
  }

  function clickButtons(buttons) {
    let count = 0;
    for (const button of buttons) {
      try {
        button.click();
        count += 1;
      } catch (_) {
        // ignore page handler failures
      }
    }
    return count;
  }

  function clickNativeReadMoreButtons(root = document) {
    return clickButtons(nativeReadMoreButtons(root));
  }

  function clickNativeReadMoreForBody(body) {
    const item = contentItemFor(body);
    const buttons = nativeReadMoreButtons(item || document);
    const clicked = clickButtons(buttons);
    if (clicked) {
      removeExpandButton(body);
      collapsedBodies.delete(body);
      return true;
    }
    return false;
  }

  function nativeCollapseButtons(root = document) {
    return uniqueButtonsByContentItem([...root.querySelectorAll("button, [role='button']")]
      .filter((button) => {
        if (!(button instanceof HTMLElement)) return false;
        if (!elementIsVisible(button)) return false;
        if (button.hasAttribute(EXPAND_ATTR)) return false;
        if (button.closest('[data-kanshan-panel="true"]')) return false;
        if (!contentItemFor(button)) return false;
        return button.hasAttribute("data-zop-retract-question") ||
          /(^|\s)收起(\s|$)/.test(actionText(button));
      }));
  }

  function uniqueButtonsByContentItem(buttons) {
    const seen = new Set();
    const result = [];
    for (const button of buttons) {
      const item = contentItemFor(button) || button;
      if (seen.has(item)) continue;
      seen.add(item);
      result.push(button);
    }
    return result;
  }

  function clickNativeCollapseButtons() {
    return clickButtons(nativeCollapseButtons());
  }

  function answerUnit(count) {
    return `${count} 个回答`;
  }

  function hasNativeReadMoreOrCollapse(node) {
    const item = contentItemFor(node);
    if (!item) return false;
    return nativeReadMoreButtons(item).length > 0 || nativeCollapseButtons(item).length > 0;
  }

  function contentBodies(root = document) {
    const candidates = [];
    if (root instanceof HTMLElement && root.matches(CONTENT_SELECTORS)) candidates.push(root);
    if (root.querySelectorAll) candidates.push(...root.querySelectorAll(CONTENT_SELECTORS));
    const unique = [...new Set(candidates)].filter((node) => node instanceof HTMLElement);
    return unique.filter((node) => {
      if (collapsedBodies.has(node)) return false;
      if (node.closest(".RichContent.is-collapsed")) return false;
      if (node.matches(".RichContent.is-collapsed")) return false;
      if (hasNativeReadMoreOrCollapse(node)) return false;
      if (node.offsetHeight <= 460) return false;
      return !unique.some((other) => other !== node && other.contains(node));
    });
  }

  function collapseContent() {
    const nativeCount = clickNativeCollapseButtons();
    const bodies = contentBodies();
    for (const body of bodies) {
      bodyStyleSnapshots.set(body, {
        maxHeight: propertySnapshot(body, "max-height"),
        overflow: propertySnapshot(body, "overflow"),
      });
      body.style.setProperty("max-height", COLLAPSE_MAX_HEIGHT, "important");
      body.style.setProperty("overflow", "hidden", "important");
      collapsedBodies.add(body);
      ensureExpandButton(body);
    }
    if (nativeCount && bodies.length) {
      showToast(`已收起 ${answerUnit(nativeCount + bodies.length)}`);
    } else if (nativeCount) {
      showToast(`已收起 ${answerUnit(nativeCount)}`);
    } else {
      showToast(bodies.length ? `已收起 ${answerUnit(bodies.length)}` : "当前页面没有检测到可收起的回答");
    }
  }

  function restoreContent() {
    let count = 0;
    for (const body of [...collapsedBodies]) {
      if (restoreCollapsedBody(body)) count += 1;
    }
    const nativeCount = clickNativeReadMoreButtons();
    if (count && nativeCount) {
      showToast(`已展开 ${answerUnit(count + nativeCount)}`);
    } else if (count) {
      showToast(`已展开 ${answerUnit(count)}`);
    } else if (nativeCount) {
      showToast(`已展开 ${answerUnit(nativeCount)}`);
    } else {
      showToast("没有已收起的回答，也没有检测到可展开的回答");
    }
  }

  function headerElements() {
    return HEADER_SELECTORS.flatMap((selector) => [...document.querySelectorAll(selector)])
      .filter((header) => header instanceof HTMLElement);
  }

  function setHeaderHiddenState(hidden) {
    headerHidden = hidden;
    for (const header of headerElements()) {
      if (hidden) {
        if (!headerStyleSnapshots.has(header)) {
          headerStyleSnapshots.set(header, {
            transform: propertySnapshot(header, "transform"),
            transition: propertySnapshot(header, "transition"),
          });
          trackedHeaders.add(header);
        }
        header.style.setProperty("transform", "translateY(-105%)", "important");
        header.style.setProperty("transition", "transform 180ms ease", "important");
      } else {
        const snapshot = headerStyleSnapshots.get(header);
        if (snapshot) {
          restoreProperty(header, "transform", snapshot.transform);
          restoreProperty(header, "transition", snapshot.transition);
        }
      }
    }
    if (!hidden) {
      for (const header of trackedHeaders) {
        const snapshot = headerStyleSnapshots.get(header);
        if (snapshot) {
          restoreProperty(header, "transform", snapshot.transform);
          restoreProperty(header, "transition", snapshot.transition);
        }
      }
      trackedHeaders.clear();
    }
  }

  function onScroll() {
    const currentY = window.scrollY;
    const shouldHide = currentY > lastScrollY && currentY > 90;
    if (shouldHide !== headerHidden) setHeaderHiddenState(shouldHide);
    lastScrollY = currentY;
  }

  function updateHeaderButton() {
    if (!ui || !ui.header) return;
    ui.header.textContent = headerAutoHideEnabled ? "导航开" : "导航";
    ui.header.title = headerAutoHideEnabled
      ? "关闭顶部导航滚动隐藏"
      : "开启顶部导航滚动隐藏";
  }

  function toggleHeaderAutoHide() {
    headerAutoHideEnabled = !headerAutoHideEnabled;
    if (headerAutoHideEnabled) {
      lastScrollY = window.scrollY;
      scrollHandler = onScroll;
      window.addEventListener("scroll", scrollHandler, { passive: true });
      showToast("已开启顶部导航滚动隐藏");
    } else {
      if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
      scrollHandler = null;
      setHeaderHiddenState(false);
      showToast("已关闭顶部导航滚动隐藏");
    }
    updateHeaderButton();
  }

  function recordCurrentState() {
    const recorded = recordQuestionHistory();
    if (ui && !ui.panel.hidden) renderHistoryPanel();
    showToast(recorded ? "已记录当前问题" : "当前页面不是问题页，已更新面板状态");
  }

  function setupUi() {
    ui = makeShadowUi();
    if (!ui) return;
    ui.main.addEventListener("click", () => {
      setMenuOpen(!ui.root.classList.contains("open"));
    });
    ui.history.addEventListener("click", () => {
      toggleHistoryPanel();
      setMenuOpen(true);
    });
    ui.collapse.addEventListener("click", () => {
      collapseContent();
      setMenuOpen(false);
    });
    ui.restore.addEventListener("click", () => {
      restoreContent();
      setMenuOpen(false);
    });
    ui.header.addEventListener("click", () => {
      toggleHeaderAutoHide();
    });
    ui.refresh.addEventListener("click", () => {
      recordCurrentState();
      setMenuOpen(false);
    });
    updateHeaderButton();
    adjustWheelPosition();
    window.addEventListener("resize", scheduleWheelPosition, { passive: true });
    window.addEventListener("scroll", scheduleWheelPosition, { passive: true });
    wheelPositionObserver = new MutationObserver(scheduleWheelPosition);
    wheelPositionObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "aria-hidden"] });
  }

  function checkRoute() {
    if (location.href === lastRoute) return;
    lastRoute = location.href;
    recordQuestionHistory();
    if (ui && !ui.panel.hidden) renderHistoryPanel();
    scheduleWheelPosition();
  }

  function setupRouteWatcher() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const notifyRouteChange = () => window.setTimeout(checkRoute, 0);
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      notifyRouteChange();
      return result;
    };
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      notifyRouteChange();
      return result;
    };
    window.addEventListener("popstate", notifyRouteChange);
    window.addEventListener("hashchange", notifyRouteChange);
    routeTimer = window.setInterval(checkRoute, 1000);
  }

  function init() {
    recordQuestionHistory();
    setupUi();
    setupRouteWatcher();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
