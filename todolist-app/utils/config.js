/**
 * 移动端运行配置：集中维护 API、法律页面与联系信息。
 * 正式构建请设置 VITE_API_BASE_URL / VITE_LEGAL_PUBLIC_BASE_URL（见 .env.production.example）。
 *
 * 注意：.env.production 里空字符串是给 H5「同源 /api」用的。
 * App 包运行在 file://，空基址会被解析成 file://...，登录会报
 * Expected URL scheme 'http' or 'https' but was 'file'。
 */

const trimSlash = (s) => String(s ?? '').replace(/\/$/, '')

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

const isApp =
  process.env.UNI_PLATFORM === 'app-plus' || process.env.UNI_PLATFORM === 'app'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL
const trimmed = trimSlash(rawBaseUrl ?? '')

export const BASE_URL = (() => {
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // App 正式包 / 未配置时必须用公网绝对地址；H5 空字符串仍表示同源
  if (isApp || rawBaseUrl === undefined) return DEFAULT_API_BASE_URL
  return trimmed
})()

/**
 * 上架用公开法律页（App Store / Play 要求可在未安装应用时访问的 HTTPS 链接）。
 * 部署 website/ 后填写，例如 https://www.example.com
 */
export const LEGAL_PUBLIC_BASE_URL = trimSlash(
  import.meta.env.VITE_LEGAL_PUBLIC_BASE_URL || '',
)

/** 个人中心「官网」外链 */
export const OFFICIAL_WEBSITE_URL = 'https://www.example.com'

/** 隐私政策/用户协议中的联系邮箱（上架审核常查） */
export const LEGAL_CONTACT_EMAIL =
  import.meta.env.VITE_LEGAL_CONTACT_EMAIL || 'you@example.com'

/**
 * OAuth 占位按钮（Google/Apple）。未接真实 IdP 前保持 false，避免误导用户。
 * 接入后设 VITE_ENABLE_OAUTH_UI=true 并实现真正的授权流。
 */
export const ENABLE_OAUTH_UI = String(import.meta.env.VITE_ENABLE_OAUTH_UI || '') === 'true'
