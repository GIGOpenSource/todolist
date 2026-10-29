/**
 * 管理后台运行配置：集中维护 API 地址与存储前缀。
 * 正式构建请设置 VITE_API_BASE_URL（见 .env.production.example）。
 */

const trimSlash = (s) => String(s ?? '').replace(/\/$/, '')

// VITE_API_BASE_URL 存在时用它（包括空字符串=同源），不存在时回退到 localhost
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL
export const BASE_URL = trimSlash(
  rawBaseUrl !== undefined ? rawBaseUrl : 'http://127.0.0.1:8000',
)

/** localStorage key prefix — must NOT collide with PC frontend / mobile app */
export const STORAGE_PREFIX = 'upgrade_admin_'
