/**
 * 移动端主题工具：维护主题变量并同步页面与系统栏外观。
 */

import { ref } from 'vue'
import { applyImmersiveStatusBar } from './immersive.js'
import { syncDeviceLayout, startDeviceWatch } from './device.js'

const THEME_KEY = 'todolist_theme'

/** Bumps when theme changes so pages can re-bind class */
export const themeVersion = ref(0)

/**
 * Shared chrome tokens — defined in App.vue CSS (rpx compiled to px).
 * Do NOT inject rpx via element.style: browsers treat literal "28rpx" as invalid,
 * which breaks border-radius / heights for any theme that inherits from those roots
 * (historically: dark mode, because .theme-dark omitted structural tokens).
 */
export const SHARED_VARS = {
  '--app-scrim': 'rgba(0, 0, 0, 0.5)',
  '--app-on-tint': '#ffffff',
  '--app-glass-blur': '32px',
}

/** Color tokens only (safe for inline DOM application) */
export const LIGHT_VARS = {
  ...SHARED_VARS,
  '--app-bg': '#f2f2f7',
  '--app-bg-grad-a': 'rgba(0, 122, 255, 0.14)',
  '--app-bg-grad-b': 'rgba(52, 199, 89, 0.1)',
  '--app-bg-grad-c': 'rgba(175, 82, 222, 0.06)',
  '--app-label': '#000000',
  '--app-secondary': 'rgba(60, 60, 67, 0.6)',
  '--app-tertiary': 'rgba(60, 60, 67, 0.35)',
  '--app-fill': 'rgba(120, 120, 128, 0.12)',
  '--app-fill-strong': 'rgba(255, 255, 255, 0.92)',
  '--app-glass': 'rgba(255, 255, 255, 0.55)',
  '--app-glass-border': 'rgba(255, 255, 255, 0.72)',
  '--app-separator': 'rgba(60, 60, 67, 0.12)',
  '--app-tint': '#007aff',
  '--app-tint-soft': 'rgba(0, 122, 255, 0.14)',
  '--app-tint-glow': 'rgba(0, 122, 255, 0.22)',
  '--app-danger': '#d96058',
  '--app-success': '#34c759',
  '--app-overdue': '#d96058',
  '--app-warning': '#c99540',
  '--app-warning-soft': 'rgba(201, 149, 64, 0.22)',
  /* iOS 26 Liquid Glass tab bar */
  '--app-tab-bg': 'rgba(255, 255, 255, 0.28)',
  '--app-tab-border': 'rgba(255, 255, 255, 0.48)',
  '--app-tab-pill': 'rgba(255, 255, 255, 0.58)',
  '--app-tab-pill-border': 'rgba(255, 255, 255, 0.72)',
  '--app-tab-text': '#8e8e93',
  '--app-shadow': 'rgba(0, 0, 0, 0.08)',
}

export const DARK_VARS = {
  ...SHARED_VARS,
  '--app-bg': '#000000',
  '--app-bg-grad-a': 'rgba(10, 132, 255, 0.22)',
  '--app-bg-grad-b': 'rgba(48, 209, 88, 0.12)',
  '--app-bg-grad-c': 'rgba(191, 90, 242, 0.1)',
  '--app-label': '#ffffff',
  '--app-secondary': 'rgba(235, 235, 245, 0.6)',
  '--app-tertiary': 'rgba(235, 235, 245, 0.35)',
  '--app-fill': 'rgba(120, 120, 128, 0.32)',
  '--app-fill-strong': 'rgba(44, 44, 46, 0.94)',
  '--app-glass': 'rgba(58, 58, 60, 0.78)',
  '--app-glass-border': 'rgba(255, 255, 255, 0.18)',
  '--app-separator': 'rgba(84, 84, 88, 0.65)',
  '--app-tint': '#0a84ff',
  '--app-tint-soft': 'rgba(10, 132, 255, 0.22)',
  '--app-tint-glow': 'rgba(10, 132, 255, 0.35)',
  '--app-danger': '#e07870',
  '--app-success': '#30d158',
  '--app-overdue': '#e07870',
  '--app-warning': '#d4ab5c',
  '--app-warning-soft': 'rgba(212, 171, 92, 0.28)',
  /* iOS 26 Liquid Glass tab bar (dark) */
  '--app-tab-bg': 'rgba(40, 40, 42, 0.42)',
  '--app-tab-border': 'rgba(255, 255, 255, 0.16)',
  '--app-tab-pill': 'rgba(255, 255, 255, 0.16)',
  '--app-tab-pill-border': 'rgba(255, 255, 255, 0.22)',
  '--app-tab-text': '#8e8e93',
  '--app-shadow': 'rgba(0, 0, 0, 0.45)',
}

/** 读取当前主题。 */
export function getTheme() {
  const t = uni.getStorageSync(THEME_KEY)
  return t === 'dark' ? 'dark' : 'light'
}

/** 设置并持久化主题。 */
export function setTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light'
  uni.setStorageSync(THEME_KEY, t)
  applyThemeToDom(t)
  applyPageBackground(t)
  syncDeviceLayout()
  themeVersion.value += 1
  return t
}

function applyVarsToEl(el, vars) {
  if (!el || !el.style) return
  Object.keys(vars).forEach((key) => {
    el.style.setProperty(key, vars[key])
  })
}

/** Strip legacy invalid rpx structural tokens previously written by older builds */
function clearBrokenStructuralInlineVars(el) {
  if (!el || !el.style) return
  ;[
    '--app-radius-panel',
    '--app-radius-control',
    '--app-radius-pill',
    '--app-page-inset',
    '--app-space-page',
    '--app-type-large-title',
    '--app-btn-height',
    '--app-btn-height-sheet',
  ].forEach((key) => {
    const v = el.style.getPropertyValue(key)
    if (v && String(v).includes('rpx')) el.style.removeProperty(key)
  })
}

function themeRoots() {
  if (typeof document === 'undefined') return []
  return [
    document.documentElement,
    document.body,
    document.querySelector('uni-page-body'),
    document.querySelector('uni-app'),
    document.getElementById('app'),
    document.querySelector('page'),
  ].filter(Boolean)
}

/** 将主题变量应用到页面。 */
export function applyThemeToDom(theme) {
  const t = theme === 'dark' ? 'dark' : 'light'
  const vars = t === 'dark' ? DARK_VARS : LIGHT_VARS
  try {
    themeRoots().forEach((el) => {
      el.setAttribute('data-theme', t)
      el.classList.toggle('theme-dark', t === 'dark')
      el.classList.toggle('theme-light', t === 'light')
      clearBrokenStructuralInlineVars(el)
      applyVarsToEl(el, vars)
    })
  } catch {
    // ignore
  }
}

/** 初始化已保存的主题。 */
export function initTheme() {
  return setTheme(getTheme())
}

/** 同步页面与系统栏外观。 */
export function syncPageChrome() {
  const theme = initTheme()
  applyImmersiveStatusBar(theme !== 'dark')
  applyPageBackground(theme)
  startDeviceWatch()
  syncDeviceLayout()
  return theme
}

/** 应用页面背景色。 */
export function applyPageBackground(theme) {
  const bg = theme === 'dark' ? '#000000' : '#f2f2f7'
  try {
    uni.setBackgroundColor({
      backgroundColor: bg,
      backgroundColorTop: bg,
      backgroundColorBottom: bg,
    })
  } catch {
    // ignore
  }
  try {
    if (typeof document !== 'undefined') {
      if (document.documentElement) document.documentElement.style.backgroundColor = bg
      if (document.body) document.body.style.backgroundColor = bg
      const pageBody = document.querySelector('uni-page-body')
      if (pageBody) pageBody.style.backgroundColor = bg
    }
  } catch {
    // ignore
  }
}

/** 返回页面根节点的主题类名。 */
export function themeClass() {
  void themeVersion.value
  return getTheme() === 'dark' ? 'theme-dark' : 'theme-light'
}
