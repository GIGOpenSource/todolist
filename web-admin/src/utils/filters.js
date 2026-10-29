/**
 * 后台筛选工具：持久化筛选条件并构建请求参数。
 */

const STORAGE_PREFIX = 'upgrade_admin_filters_'

export const PLATFORM_OPTIONS = [
  { value: '', label: '全部平台' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'web', label: 'Web' },
  { value: 'pc', label: 'PC' },
  { value: 'unknown', label: '未知' },
]

/** 创建空筛选条件。 */
export function emptyFilters() {
  return {
    platform: '',
    country: '',
    language: '',
    dateFrom: '',
    dateTo: '',
  }
}

/** 读取指定页面的筛选条件。 */
export function loadFilters(pageKey) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + pageKey)
    if (!raw) return emptyFilters()
    const parsed = JSON.parse(raw)
    return {
      platform: parsed.platform || '',
      country: parsed.country || '',
      language: parsed.language || '',
      dateFrom: parsed.dateFrom || '',
      dateTo: parsed.dateTo || '',
    }
  } catch {
    return emptyFilters()
  }
}

/** 保存指定页面的筛选条件。 */
export function saveFilters(pageKey, filters) {
  localStorage.setItem(STORAGE_PREFIX + pageKey, JSON.stringify(filters || emptyFilters()))
}

/** 将有效筛选条件追加到请求参数。 */
export function appendFilterParams(params, filters) {
  if (!filters) return params
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.country) params.set('country', filters.country)
  if (filters.language) params.set('language', filters.language)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  return params
}

/** 将筛选条件转换为查询字符串。 */
export function filtersQuery(filters) {
  const params = new URLSearchParams()
  appendFilterParams(params, filters)
  const s = params.toString()
  return s ? `?${s}` : ''
}
