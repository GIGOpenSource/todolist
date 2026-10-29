/**
 * 文案词典入口：组装 zh/en 等语言包，勿在此写业务逻辑。
 */

import { ref } from 'vue'
import en from './en.js'
import zhHansExtra from './zh-Hans-extra.js'
import zhHantExtra from './zh-Hant-extra.js'
import zhHansBase from './zh-Hans.base.json'
import zhHantBase from './zh-Hant.base.json'
import { STORAGE_PREFIX } from '../config.js'

export const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'zh-Hans', name: '简体中文' },
  { code: 'zh-Hant', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'th', name: 'ไทย' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'pl', name: 'Polski' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'sv', name: 'Svenska' },
  { code: 'hi', name: 'हिन्दी' },
]

const packs = {
  en,
  'zh-Hans': { ...zhHansBase, ...zhHansExtra },
  'zh-Hant': { ...zhHantBase, ...zhHantExtra },
}

const STORAGE_KEY = `${STORAGE_PREFIX}locale`
const DEFAULT_LOCALE = 'en'

export const localeVersion = ref(0)

export function getMessages(code) {
  if (!code || code === 'en') return packs.en
  const overlay = packs[code]
  if (!overlay) return packs.en
  return { ...packs.en, ...overlay }
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

export function getAcceptLanguage() {
  const code = getLocale()
  if (code.startsWith('zh')) return 'zh'
  return code.split('-')[0] || 'en'
}

/** System / device language (first login capture). */
export function getDeviceLanguage() {
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

export function t(key, params) {
  void localeVersion.value
  const messages = getMessages(getLocale())
  const fallback = getMessages('en')
  const raw = messages[key] ?? fallback[key] ?? key
  return format(raw, params)
}

export function intlLocale() {
  const code = getLocale()
  if (code === 'zh-Hans') return 'zh-CN'
  if (code === 'zh-Hant') return 'zh-TW'
  return code
}

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

export function formatMonthTitle(year, month) {
  return t('calendar.monthTitle', { year, month })
}

export function weekdaysShort() {
  try {
    const fmt = new Intl.DateTimeFormat(intlLocale(), { weekday: 'narrow' })
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2021, 7, i + 1)))
  } catch {
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  }
}
