/**
 * 桌面网页端运行配置：集中维护 API 与存储前缀。
 * 下载链接由 /api/site/config 的 downloads 字段提供。
 * 正式构建请设置 VITE_API_BASE_URL / VITE_LEGAL_PUBLIC_BASE_URL（见 .env.production.example）。
 */

const trimSlash = (s) => String(s ?? '').replace(/\/$/, '')

// VITE_API_BASE_URL 存在时用它（包括空字符串=同源），不存在时回退到 localhost
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL
export const BASE_URL = trimSlash(
  rawBaseUrl !== undefined ? rawBaseUrl : 'http://127.0.0.1:8000',
)

/** Public legal pages (website/). Empty in prod until VITE_LEGAL_PUBLIC_BASE_URL is set. */
export const LEGAL_PUBLIC_BASE_URL = trimSlash(
  import.meta.env.VITE_LEGAL_PUBLIC_BASE_URL ||
    (import.meta.env.DEV ? 'http://127.0.0.1:4173' : ''),
)

export const LEGAL_CONTACT_EMAIL =
  import.meta.env.VITE_LEGAL_CONTACT_EMAIL || 'you@example.com'

/** localStorage key prefix — must NOT collide with mobile `todolist_*` */
export const STORAGE_PREFIX = 'upgrade_pc_'
