/**
 * 后台权限工具：目录以 API 为准，本地 FALLBACK 仅作离线兜底。
 */

import { ref } from 'vue'
import { t, localeVersion } from '../i18n/index.js'
import { fetchPermissionCatalog } from '../api/client.js'

export const PERM_ALL = '*'

/** Fallback aligned with backend `common.permissions` — used before/without API. */
export const FALLBACK_PERMISSIONS = [
  { key: 'stats', labelKey: 'nav.stats', route: 'stats' },
  { key: 'users', labelKey: 'nav.users', route: 'users' },
  { key: 'todos', labelKey: 'nav.todos', route: 'todos' },
  { key: 'notes', labelKey: 'nav.notes', route: 'notes' },
  { key: 'llm', labelKey: 'nav.llm', route: 'llm-models' },
  { key: 'notifications', labelKey: 'nav.notifications', route: 'notifications' },
  { key: 'site', labelKey: 'nav.site', route: 'site-config' },
  { key: 'admins', labelKey: 'nav.admins', route: 'admins' },
]

/** Reactive catalog; mutated by ensurePermissionCatalog(). */
export const permissionCatalog = ref(FALLBACK_PERMISSIONS.map((p) => ({ ...p })))
const catalogReady = ref(false)
let loadPromise = null

/** @deprecated use permissionCatalog — kept for callers that import PERMISSIONS */
export const PERMISSIONS = FALLBACK_PERMISSIONS

function mapCatalogItem(item, fallbackByKey) {
  const key = String(item?.key || '').trim()
  if (!key) return null
  const fb = fallbackByKey.get(key) || {}
  return {
    key,
    route: item.route || fb.route || key,
    labelKey: item.label_key || item.labelKey || fb.labelKey || `nav.${key}`,
  }
}

/** 从后端拉取权限目录并覆盖本地 fallback。 */
export async function ensurePermissionCatalog({ force = false } = {}) {
  if (catalogReady.value && !force) return permissionCatalog.value
  if (loadPromise && !force) return loadPromise
  loadPromise = (async () => {
    const fallbackByKey = new Map(FALLBACK_PERMISSIONS.map((p) => [p.key, p]))
    try {
      const { data } = await fetchPermissionCatalog()
      const list = Array.isArray(data) ? data : []
      const mapped = list.map((item) => mapCatalogItem(item, fallbackByKey)).filter(Boolean)
      if (mapped.length) {
        permissionCatalog.value = mapped
      }
    } catch {
      // keep fallback
    } finally {
      catalogReady.value = true
      loadPromise = null
    }
    return permissionCatalog.value
  })()
  return loadPromise
}

/** 返回权限的显示名称。 */
export function permissionLabel(key) {
  void localeVersion.value
  if (key === PERM_ALL || key === '*') return t('perm.all')
  return t(`perm.${key}`)
}

/** 返回带本地化名称的导航项。 */
export function navItemsLabeled() {
  void localeVersion.value
  void permissionCatalog.value
  return permissionCatalog.value.map((p) => ({
    ...p,
    label: t(p.labelKey),
  }))
}

/** 规范化管理员权限集合。 */
export function normalizePermissions(raw) {
  void permissionCatalog.value
  const keys = permissionCatalog.value.map((p) => p.key)
  if (!raw) return [PERM_ALL]
  if (Array.isArray(raw)) {
    if (raw.includes(PERM_ALL) || raw.includes('*')) return [PERM_ALL]
    return keys.filter((k) => raw.includes(k))
  }
  if (raw === '*' || raw === PERM_ALL) return [PERM_ALL]
  return [PERM_ALL]
}

/** 判断管理员是否拥有指定权限。 */
export function hasPermission(userOrPerms, key) {
  const perms = Array.isArray(userOrPerms)
    ? normalizePermissions(userOrPerms)
    : normalizePermissions(userOrPerms?.permissions)
  if (perms.includes(PERM_ALL)) return true
  return perms.includes(key)
}

/** 返回管理员首个可访问路由。 */
export function firstAllowedRoute(userOrPerms) {
  for (const p of permissionCatalog.value) {
    if (hasPermission(userOrPerms, p.key)) return p.route
  }
  return 'login'
}

/** 当前目录全部 module key（不含 *）。 */
export function allPermissionKeys() {
  return permissionCatalog.value.map((p) => p.key)
}
