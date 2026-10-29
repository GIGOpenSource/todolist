/**
 * 移动端国际化工具：管理语言选择、文案读取与日期格式化。
 */

import { ref } from 'vue'
import { LOCALES, getMessages } from '../locales/index.js'

const STORAGE_KEY = 'todolist_locale'
const DEFAULT_LOCALE = 'en'

/** Bumps when locale changes so computed/templates refresh */
export const localeVersion = ref(0)

export { LOCALES }

/** 读取当前语言。 */
export function getLocale() {
  const saved = uni.getStorageSync(STORAGE_KEY)
  if (saved && LOCALES.some((l) => l.code === saved)) return saved
  return DEFAULT_LOCALE
}

/** 设置并持久化当前语言。 */
export function setLocale(code) {
  const next = LOCALES.some((l) => l.code === code) ? code : DEFAULT_LOCALE
  uni.setStorageSync(STORAGE_KEY, next)
  localeVersion.value += 1
  return next
}

/** 读取当前语言的展示信息。 */
export function getLocaleMeta() {
  const code = getLocale()
  return LOCALES.find((l) => l.code === code) || LOCALES[0]
}

/** 生成接口请求使用的语言标头。 */
export function getAcceptLanguage() {
  const code = getLocale()
  if (code.startsWith('zh')) return 'zh'
  return code.split('-')[0] || 'en'
}

/** 读取设备语言。 */
export function getDeviceLanguage() {
  try {
    const info = uni.getSystemInfoSync?.() || {}
    const raw = info.language || info.osLanguage || info.systemLanguage || ''
    if (raw) return String(raw).replace('_', '-').slice(0, 32)
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return String(navigator.language).replace('_', '-').slice(0, 32)
    }
  } catch {
    /* ignore */
  }
  return getLocale()
}

function format(template, params) {
  if (!params) return template
  return String(template).replace(/\{(\w+)\}/g, (_, k) =>
    params[k] === undefined || params[k] === null ? `{${k}}` : String(params[k])
  )
}

/** 读取并插值当前语言文案。 */
export function t(key, params) {
  // depend on version for reactivity when used inside computed
  void localeVersion.value
  const messages = getMessages(getLocale())
  const fallback = getMessages('en')
  const raw = messages[key] ?? fallback[key] ?? key
  return format(raw, params)
}

/** 返回国际化格式使用的语言标签。 */
export function intlLocale() {
  const code = getLocale()
  if (code === 'zh-Hans') return 'zh-CN'
  if (code === 'zh-Hant') return 'zh-TW'
  return code
}

/** 格式化短日期。 */
export function formatDateShort(ts) {
  try {
    return new Intl.DateTimeFormat(intlLocale(), {
      month: 'short',
      day: 'numeric',
      year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    }).format(new Date(ts))
  } catch {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
}

/** 格式化月份标题。 */
export function formatMonthTitle(year, month) {
  return t('calendar.monthTitle', { year, month })
}

/** 返回星期简称列表。 */
export function weekdaysShort() {
  try {
    const fmt = new Intl.DateTimeFormat(intlLocale(), { weekday: 'narrow' })
    // Sunday-start week to match calendar grid
    const base = new Date(2024, 0, 7) // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      return fmt.format(d)
    })
  } catch {
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  }
}
