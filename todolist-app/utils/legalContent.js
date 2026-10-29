/**
 * 法律内容生成器：按当前语言返回隐私政策与用户协议分段文案。
 */

import { getLocale } from './i18n.js'
import { LEGAL_CONTACT_EMAIL, LEGAL_PUBLIC_BASE_URL } from './config.js'
import { LEGAL_LOCALES } from './legalLocales.js'

function resolveLocale(code) {
  const raw = String(code || '')
  if (LEGAL_LOCALES[raw]) return raw
  if (raw.startsWith('zh-Hans') || raw === 'zh-CN' || raw === 'zh') return 'zh-Hans'
  if (raw.startsWith('zh-Hant') || raw === 'zh-TW' || raw === 'zh-HK') return 'zh-Hant'
  const short = raw.split('-')[0]
  if (LEGAL_LOCALES[short]) return short
  return 'en'
}

function fillPlaceholders(text, email) {
  return String(text || '').split('{email}').join(email)
}

function withWebNote(paragraphs, locale) {
  const email = LEGAL_CONTACT_EMAIL || 'privacy@example.com'
  const filled = paragraphs.map((p) => fillPlaceholders(p, email))
  if (LEGAL_PUBLIC_BASE_URL) {
    const note =
      locale.startsWith('zh')
        ? `\n公开网页版：${LEGAL_PUBLIC_BASE_URL}`
        : `\nPublic web copy: ${LEGAL_PUBLIC_BASE_URL}`
    const last = filled.length - 1
    if (last >= 0) filled[last] = `${filled[last]}${note}`
  }
  return filled
}

function pickDoc(kind) {
  const locale = resolveLocale(getLocale())
  const pack = LEGAL_LOCALES[locale] || LEGAL_LOCALES.en
  const doc = pack[kind] || LEGAL_LOCALES.en[kind]
  return {
    title: doc.title,
    updated: doc.updated,
    paragraphs: withWebNote(doc.paragraphs || [], locale),
  }
}

/** 生成隐私政策内容分段。 */
export function privacySections() {
  return pickDoc('privacy')
}

/** 生成用户协议内容分段。 */
export function termsSections() {
  return pickDoc('terms')
}
