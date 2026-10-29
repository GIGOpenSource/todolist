/**
 * 文案词典入口：组装 zh/en/ko 等语言包，勿在此写业务逻辑。
 */

import { ref } from 'vue'
import zhHans from './locales/zh-Hans.js'
import en from './locales/en.js'
import ko from './locales/ko.js'

export const LOCALES = [
  { code: 'zh-Hans', name: '简体中文' },
  { code: 'en', name: 'English' },
  { code: 'ko', name: '한국어' },
]

const packs = {
  'zh-Hans': zhHans,
  en,
  ko,
}

const STORAGE_KEY = 'upgrade_admin_locale'
const DEFAULT_LOCALE = 'zh-Hans'

export const localeVersion = ref(0)

export function getMessages(code) {
  const pack = packs[code]
  if (!pack) return packs[DEFAULT_LOCALE]
  if (code === DEFAULT_LOCALE) return pack
  return { ...packs[DEFAULT_LOCALE], ...pack }
}

export function getLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LOCALES.some((l) => l.code === saved)) return saved
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE
}

export function setLocale(code) {
  const next = LOCALES.some((l) => l.code === code) ? code : DEFAULT_LOCALE
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore
  }
  localeVersion.value += 1
  return next
}

export function getLocaleMeta() {
  const code = getLocale()
  return LOCALES.find((l) => l.code === code) || LOCALES[0]
}

/** Accept-Language for API: zh / en / ko */
export function getAcceptLanguage() {
  const code = getLocale()
  if (code.startsWith('zh')) return 'zh'
  if (code === 'ko') return 'ko'
  return 'en'
}

export function t(key, params = {}) {
  void localeVersion.value
  const messages = getMessages(getLocale())
  let text = messages[key]
  if (text == null) text = packs.en[key]
  if (text == null) text = key
  if (params && typeof params === 'object') {
    Object.keys(params).forEach((k) => {
      text = String(text).replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]))
    })
  }
  return text
}
