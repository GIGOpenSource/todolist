<!-- 移动端根组件：启动同步调度、主题与连续打开日。 -->
<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { getToken, touchActiveDay, syncStreakToServer } from './utils/storage.js'
import { ensureTodoCache } from './utils/todoStore.js'
import { syncPageChrome } from './utils/theme.js'
import { getLocale } from './utils/i18n.js'
import { startAutoSyncScheduler, stopAutoSyncScheduler } from './utils/autoSync.js'
import { startScrollEdgeBlur, resyncScrollEdges } from './utils/scrollEdgeBlur.js'
import { touchStreak } from './api/index.js'

function noteOpenDay() {
  if (!getToken()) return
  touchActiveDay()
  syncStreakToServer(touchStreak).catch(() => {})
}

onLaunch(() => {
  getLocale() // ensure default persisted preference is read
  syncPageChrome()
  startScrollEdgeBlur()
  // App 原生 tabBar 在 webview 外层，CSS 藏不住；统一用自定义 GlassTabBar
  // #ifdef APP-PLUS
  try {
    uni.hideTabBar({ animation: false })
  } catch {
    /* ignore */
  }
  // #endif
  if (getToken()) {
    noteOpenDay()
    // Local todo cache only; full cloud pull is 4 AM / manual sync / login.
    ensureTodoCache()
    startAutoSyncScheduler()
    uni.switchTab({ url: '/pages/todos/todos' })
  } else {
    stopAutoSyncScheduler()
  }
})

onShow(() => {
  syncPageChrome()
  resyncScrollEdges()
  if (getToken()) {
    noteOpenDay()
    ensureTodoCache()
    startAutoSyncScheduler()
  } else {
    stopAutoSyncScheduler()
  }
})
</script>

<style lang="scss">
/* ===== Theme tokens（与 utils/theme.js LIGHT_VARS / DARK_VARS 保持同步） =====
 * 结构 token 必须同时挂在 .theme-light / .theme-dark 上：
 * 日间靠 .theme-light 自带全量；夜间若只写颜色，结构量会回落到祖先上
 * 被 JS inline 的非法 rpx 覆盖，圆角/高度/间距等控件样式会整批失效。
 */
:root,
html,
page,
.theme-light,
.theme-dark {
  --app-page-inset: 32rpx;
  --app-radius-panel: 28rpx;
  --app-radius-control: 16rpx;
  --app-radius-pill: 999rpx;
  --app-space-page: 32rpx;
  --app-type-large-title: 68rpx;
  --app-btn-height: 88rpx;
  --app-btn-height-sheet: 84rpx;
  --app-scrim: rgba(0, 0, 0, 0.5);
  --app-on-tint: #ffffff;
  --app-glass-blur: 32px;
  --app-content-max: 100%;
  --app-tab-max: 100%;
  --app-sheet-max: 100%;
  --app-auth-max: 480px;
  --app-cal-max: 100%;
  --app-cal-cell: none;
}

:root,
html,
page,
.theme-light {
  --app-bg: #f2f2f7;
  --app-bg-grad-a: rgba(0, 122, 255, 0.14);
  --app-bg-grad-b: rgba(52, 199, 89, 0.1);
  --app-bg-grad-c: rgba(175, 82, 222, 0.06);
  --app-label: #000000;
  --app-secondary: rgba(60, 60, 67, 0.6);
  --app-tertiary: rgba(60, 60, 67, 0.35);
  --app-fill: rgba(120, 120, 128, 0.12);
  --app-fill-strong: rgba(255, 255, 255, 0.92);
  --app-glass: rgba(255, 255, 255, 0.55);
  --app-glass-border: rgba(255, 255, 255, 0.72);
  --app-separator: rgba(60, 60, 67, 0.12);
  --app-tint: #007aff;
  --app-tint-soft: rgba(0, 122, 255, 0.14);
  --app-tint-glow: rgba(0, 122, 255, 0.22);
  --app-danger: #d96058;
  --app-success: #34c759;
  --app-overdue: #d96058;
  --app-warning: #c99540;
  --app-warning-soft: rgba(201, 149, 64, 0.22);
  /* iOS 26 Liquid Glass tab bar */
  --app-tab-bg: rgba(255, 255, 255, 0.28);
  --app-tab-border: rgba(255, 255, 255, 0.48);
  --app-tab-pill: rgba(255, 255, 255, 0.58);
  --app-tab-pill-border: rgba(255, 255, 255, 0.72);
  --app-tab-text: #8e8e93;
  --app-shadow: rgba(0, 0, 0, 0.08);
}

html[data-theme='dark'],
:root[data-theme='dark'],
page[data-theme='dark'],
.theme-dark {
  --app-bg: #000000;
  --app-bg-grad-a: rgba(10, 132, 255, 0.22);
  --app-bg-grad-b: rgba(48, 209, 88, 0.12);
  --app-bg-grad-c: rgba(191, 90, 242, 0.1);
  --app-label: #ffffff;
  --app-secondary: rgba(235, 235, 245, 0.6);
  --app-tertiary: rgba(235, 235, 245, 0.35);
  --app-fill: rgba(120, 120, 128, 0.32);
  --app-fill-strong: rgba(44, 44, 46, 0.94);
  --app-glass: rgba(58, 58, 60, 0.78);
  --app-glass-border: rgba(255, 255, 255, 0.18);
  --app-separator: rgba(84, 84, 88, 0.65);
  --app-tint: #0a84ff;
  --app-tint-soft: rgba(10, 132, 255, 0.22);
  --app-tint-glow: rgba(10, 132, 255, 0.35);
  --app-danger: #e07870;
  --app-success: #30d158;
  --app-overdue: #e07870;
  --app-warning: #d4ab5c;
  --app-warning-soft: rgba(212, 171, 92, 0.28);
  /* iOS 26 Liquid Glass tab bar (dark) */
  --app-tab-bg: rgba(40, 40, 42, 0.42);
  --app-tab-border: rgba(255, 255, 255, 0.16);
  --app-tab-pill: rgba(255, 255, 255, 0.16);
  --app-tab-pill-border: rgba(255, 255, 255, 0.22);
  --app-tab-text: #8e8e93;
  --app-shadow: rgba(0, 0, 0, 0.45);
}

page {
  background-color: var(--app-bg);
  color: var(--app-label);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    "PingFang SC", "Helvetica Neue", sans-serif;
  min-height: 100%;
  height: 100%;
  letter-spacing: -0.2px;
}

/* H5：固定全屏背景，不随页面滚动 */
html,
body,
uni-page-body {
  min-height: 100%;
  height: 100%;
  background-color: var(--app-bg);
  background-image:
    radial-gradient(ellipse 90% 55% at 10% -10%, var(--app-bg-grad-a), transparent 55%),
    radial-gradient(ellipse 70% 45% at 95% 5%, var(--app-bg-grad-b), transparent 50%),
    radial-gradient(ellipse 60% 40% at 50% 100%, var(--app-bg-grad-c), transparent 55%);
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-attachment: scroll;
}

.ios-page {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  background: transparent;
  color: var(--app-label);
}

.ios-page::before {
  content: '';
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  background-color: var(--app-bg);
  background-image:
    radial-gradient(ellipse 90% 55% at 10% -10%, var(--app-bg-grad-a), transparent 55%),
    radial-gradient(ellipse 70% 45% at 95% 5%, var(--app-bg-grad-b), transparent 50%),
    radial-gradient(ellipse 60% 40% at 50% 100%, var(--app-bg-grad-c), transparent 55%);
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

/*
 * 屏缘模糊：仅底部。顶部不再加模糊带，避免吸顶时出现一块「底色 + 分界」。
 * 登录/注册除外
 */
.ios-page:not(.auth-page)::after {
  content: '';
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  pointer-events: none;
  backdrop-filter: blur(28px) saturate(1.05);
  -webkit-backdrop-filter: blur(28px) saturate(1.05);
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    transparent calc(100% - 110px - env(safe-area-inset-bottom, 0px)),
    rgba(0, 0, 0, 0.65) calc(100% - 52px),
    #000 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    transparent calc(100% - 110px - env(safe-area-inset-bottom, 0px)),
    rgba(0, 0, 0, 0.65) calc(100% - 52px),
    #000 100%
  );
  mask-mode: alpha;
  -webkit-mask-mode: alpha;
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .ios-page:not(.auth-page)::after {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.ios-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: var(--app-content-max);
  margin-left: auto;
  margin-right: auto;
  padding-top: calc(
    max(
      var(--status-bar-height, 0px),
      var(--app-status-bar-height, 0px),
      env(safe-area-inset-top, 0px)
    ) + var(--app-page-inset, 32rpx)
  );
  padding-left: max(0px, env(safe-area-inset-left, 0px));
  padding-right: max(0px, env(safe-area-inset-right, 0px));
  box-sizing: border-box;
}

/*
 * Telegram-style: reserve the 44px nav row under the status bar so the large
 * title sits below the compact-title slot (and sticky tools aren’t covered).
 */
.ios-content.has-collapse-nav {
  padding-top: calc(
    max(
      var(--status-bar-height, 0px),
      var(--app-status-bar-height, 0px),
      env(safe-area-inset-top, 0px)
    ) + 44px
  );
}

/* ===== Shared surfaces（页面可直接复用） ===== */
.glass {
  background: var(--app-glass);
  backdrop-filter: saturate(180%) blur(var(--app-glass-blur));
  -webkit-backdrop-filter: saturate(180%) blur(var(--app-glass-blur));
  border: 0.5px solid var(--app-glass-border);
  box-shadow: 0 10px 32px var(--app-shadow);
}

.group {
  background: var(--app-fill-strong);
  border-radius: var(--app-radius-panel);
  overflow: hidden;
}

.pill-btn {
  height: var(--app-btn-height);
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  background: var(--app-fill-strong);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 0.5px solid var(--app-glass-border);
  color: var(--app-tint);
  box-sizing: border-box;
}

.pill-btn.tint {
  background: var(--app-tint);
  color: var(--app-on-tint);
  border-color: transparent;
  box-shadow: 0 8px 20px var(--app-tint-glow);
}

.pill-btn.ghost {
  color: var(--app-tint);
}

.pill-btn.danger {
  color: var(--app-danger);
}

.pill-btn.disabled {
  opacity: 0.55;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: var(--app-scrim);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  /* Block interaction / scroll with content behind the sheet */
  touch-action: none;
  overscroll-behavior: none;
}

.sheet-panel {
  position: relative;
  width: min(100%, var(--app-sheet-max));
  margin-left: auto;
  margin-right: auto;
  background: var(--app-fill-strong);
  border-radius: var(--app-radius-panel) var(--app-radius-panel) 0 0;
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.sheet-btn {
  height: var(--app-btn-height-sheet);
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  background: var(--app-fill);
  color: var(--app-label);
}

.sheet-btn.primary {
  background: var(--app-tint);
  color: var(--app-on-tint);
}

.uni-tabbar,
.uni-tabbar-border,
uni-tabbar {
  display: none !important;
  height: 0 !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

uni-button:after {
  border: none !important;
}

.uni-picker-container,
.uni-date-picker,
uni-picker .uni-picker-container,
.uni-system-picker {
  z-index: 30000 !important;
}

.uni-picker-container .uni-picker-custom,
.uni-picker-container .uni-picker,
.uni-mask[style*='z-index'],
.uni-picker-toggle {
  z-index: 30001 !important;
}

/*
 * Form factors (utils/device.js → data-form + inline CSS vars)
 * phone / tablet(含 iPad Pro) / desktop(仅宽屏网页)
 * ≥1200 的样式必须用 [data-form=desktop]，避免 iPad Pro 横屏误套桌面布局。
 */
@media (min-width: 768px) {
  :root,
  html {
    --app-content-max: 720px;
    --app-tab-max: 560px;
    --app-sheet-max: 520px;
    --app-space-page: 24px;
    --app-page-inset: 24px;
    --app-type-large-title: 36px;
    --app-btn-height: 48px;
    --app-btn-height-sheet: 48px;
    --app-auth-max: 420px;
    --app-cal-max: 520px;
    --app-cal-cell: 48px;
  }
}

@media (min-width: 1024px) {
  :root,
  html {
    --app-content-max: 820px;
    --app-tab-max: 600px;
    --app-sheet-max: 560px;
    --app-space-page: 28px;
    --app-page-inset: 28px;
    --app-type-large-title: 38px;
    --app-auth-max: 440px;
    --app-cal-max: 600px;
    --app-cal-cell: 52px;
  }
}

/* 仅真实桌面网页；Pad 即使 ≥1200 也保持 tablet（由 JS data-form 覆盖） */
html[data-form='desktop'],
.device-desktop {
  --app-content-max: 880px;
  --app-tab-max: 640px;
  --app-sheet-max: 560px;
  --app-space-page: 28px;
  --app-page-inset: 28px;
  --app-type-large-title: 40px;
  --app-auth-max: 440px;
  --app-cal-max: 560px;
  --app-cal-cell: 44px;
}

html[data-form='desktop'] .sheet-mask,
.device-desktop .sheet-mask {
  align-items: center;
  padding: 24px;
  box-sizing: border-box;
}

html[data-form='desktop'] .sheet-panel,
html[data-form='desktop'] .sheet,
.device-desktop .sheet-panel,
.device-desktop .sheet {
  border-radius: var(--app-radius-panel);
  max-height: min(85vh, 720px);
  overflow: auto;
}

/* Pad（含 iPad Pro）：始终底部 Sheet */
html[data-pad='1'] .sheet-mask,
.device-pad .sheet-mask {
  align-items: flex-end !important;
  padding: 0 !important;
}

html[data-pad='1'] .sheet-panel,
html[data-pad='1'] .sheet,
.device-pad .sheet-panel,
.device-pad .sheet {
  border-radius: var(--app-radius-panel) var(--app-radius-panel) 0 0 !important;
}

/* Phone: no artificial cell cap */
html[data-form='phone'],
.device-phone {
  --app-cal-cell: none;
}

@media (pointer: fine) {
  html[data-form='desktop'] .pill-btn,
  html[data-form='desktop'] .sheet-btn,
  .device-desktop .pill-btn,
  .device-desktop .sheet-btn {
    cursor: pointer;
  }
}
</style>
