/**
 * 桌面网页端主题状态：持久化主题并更新页面变量。
 */

import { ref } from 'vue'
import { STORAGE_PREFIX } from '../config.js'

const THEME_KEY = `${STORAGE_PREFIX}theme`

export const themeVersion = ref(0)

export const LIGHT_VARS = {
  '--app-bg': '#f2f2f7',
  '--app-bg-grad-a': 'rgba(0, 122, 255, 0.14)',
  '--app-bg-grad-b': 'rgba(52, 199, 89, 0.1)',
  '--app-bg-grad-c': 'rgba(0, 122, 255, 0.06)',
  '--app-label': '#0a0a0c',
  '--app-secondary': 'rgba(10, 10, 12, 0.58)',
  '--app-tertiary': 'rgba(10, 10, 12, 0.38)',
  '--app-fill': 'rgba(120, 120, 128, 0.12)',
  '--app-fill-strong': 'rgba(255, 255, 255, 0.92)',
  '--app-glass': 'rgba(255, 255, 255, 0.72)',
  '--app-glass-border': 'rgba(255, 255, 255, 0.8)',
  '--app-separator': 'rgba(15, 27, 45, 0.1)',
  '--app-tint': '#007aff',
  '--app-tint-soft': 'rgba(0, 122, 255, 0.14)',
  '--app-tint-glow': 'rgba(0, 122, 255, 0.22)',
  '--app-danger': '#d96058',
  '--app-success': '#34c759',
  '--app-overdue': '#d96058',
  '--app-warning': '#c99540',
  '--app-on-tint': '#ffffff',
  '--app-shadow': 'rgba(15, 45, 96, 0.1)',
  '--app-sidebar': 'rgba(255, 255, 255, 0.78)',
}

export const DARK_VARS = {
  '--app-bg': '#000000',
  '--app-bg-grad-a': 'rgba(10, 132, 255, 0.22)',
  '--app-bg-grad-b': 'rgba(48, 209, 88, 0.12)',
  '--app-bg-grad-c': 'rgba(10, 132, 255, 0.1)',
  '--app-label': '#ffffff',
  '--app-secondary': 'rgba(235, 235, 245, 0.6)',
  '--app-tertiary': 'rgba(235, 235, 245, 0.35)',
  '--app-fill': 'rgba(120, 120, 128, 0.32)',
  '--app-fill-strong': 'rgba(44, 44, 46, 0.94)',
  '--app-glass': 'rgba(44, 44, 46, 0.88)',
  '--app-glass-border': 'rgba(255, 255, 255, 0.14)',
  '--app-separator': 'rgba(84, 84, 88, 0.55)',
  '--app-tint': '#0a84ff',
  '--app-tint-soft': 'rgba(10, 132, 255, 0.22)',
  '--app-tint-glow': 'rgba(10, 132, 255, 0.35)',
  '--app-danger': '#e07870',
  '--app-success': '#30d158',
  '--app-overdue': '#e07870',
  '--app-warning': '#d4ab5c',
  '--app-on-tint': '#ffffff',
  '--app-shadow': 'rgba(0, 0, 0, 0.45)',
  '--app-sidebar': 'rgba(28, 28, 30, 0.92)',
}

/** 读取当前主题。 */
export function getTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** 将主题变量应用到页面。 */
export function applyThemeToDom(theme) {
  const t = theme === 'dark' ? 'dark' : 'light'
  const vars = t === 'dark' ? DARK_VARS : LIGHT_VARS
  const root = document.documentElement
  root.setAttribute('data-theme', t)
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
  document.body?.setAttribute('data-theme', t)
}

/** 设置并持久化主题。 */
export function setTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light'
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    // ignore
  }
  applyThemeToDom(t)
  themeVersion.value += 1
  return t
}

/** 切换明暗主题。 */
export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

/** 初始化已保存的主题。 */
export function initTheme() {
  return setTheme(getTheme())
}

/** 返回页面根节点的主题类名。 */
export function themeClass() {
  void themeVersion.value
  return getTheme() === 'dark' ? 'theme-dark' : 'theme-light'
}
