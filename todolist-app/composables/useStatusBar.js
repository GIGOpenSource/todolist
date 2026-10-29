/**
 * @file useStatusBar.js
 * @description 状态栏 / 安全区尺寸，供 AppPageShell 与全屏页布局使用。
 * App 端依赖 manifest 沉浸式 statusbar；H5 多为 0。
 */

import { ref, onMounted } from "vue";

/** 模块级缓存，避免每页重复 getSystemInfoSync */
const cached = ref(null);

/**
 * 组合式：返回响应式安全区信息；挂载后再读一次以防首屏不准
 * @returns {import('vue').Ref}
 */
export function useStatusBar() {
  if (!cached.value) {
    cached.value = readSafeArea();
  }

  onMounted(() => {
    cached.value = readSafeArea();
  });

  return cached;
}

/**
 * 同步读取系统安全区与窗口高度
 * @returns {{
 *   statusBarHeight: number,
 *   safeAreaTop: number,
 *   safeAreaBottom: number,
 *   windowHeight: number,
 *   navBarHeight: number
 * }}
 */
export function readSafeArea() {
  try {
    const sys = uni.getSystemInfoSync();
    const statusBarHeight = sys.statusBarHeight || 0;
    const safe = sys.safeAreaInsets || { top: 0, bottom: 0, left: 0, right: 0 };
    // 顶边取 statusBar 与 safe.top 较大值，覆盖刘海屏
    const safeAreaTop = Math.max(statusBarHeight, safe.top || 0);
    const safeAreaBottom = safe.bottom || 0;
    const windowHeight = sys.windowHeight || 0;
    let navBarHeight = 44;
    // #ifdef MP
    navBarHeight = sys.titleBarHeight || 44;
    // #endif
    return {
      statusBarHeight,
      safeAreaTop,
      safeAreaBottom,
      windowHeight,
      navBarHeight,
    };
  } catch {
    return {
      statusBarHeight: 0,
      safeAreaTop: 0,
      safeAreaBottom: 0,
      windowHeight: 0,
      navBarHeight: 44,
    };
  }
}

/**
 * 生成页面内容区 padding / minHeight 样式对象
 * @param {boolean} [showTabBar=false] 是否预留自定义 TabBar 高度（56px）
 * @returns {Record<string, string>}
 */
export function pageContentStyle(showTabBar = false) {
  const info = readSafeArea();
  const tabH = showTabBar ? 56 : 0;
  return {
    paddingTop: `${info.safeAreaTop}px`,
    paddingBottom: `${info.safeAreaBottom + tabH}px`,
    minHeight: `${info.windowHeight}px`,
  };
}
