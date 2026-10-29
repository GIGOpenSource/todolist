/**
 * 管理后台本地存储：维护管理员令牌、刷新令牌与用户信息。
 */

import { STORAGE_PREFIX } from '../config.js'

const TOKEN_KEY = `${STORAGE_PREFIX}token`
const REFRESH_KEY = `${STORAGE_PREFIX}refresh`
const USER_KEY = `${STORAGE_PREFIX}user`

/** 读取访问令牌。 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

/** 保存访问令牌。 */
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/** 读取刷新令牌。 */
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || ''
}

/** 保存刷新令牌。 */
export function setRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_KEY, token)
  else localStorage.removeItem(REFRESH_KEY)
}

/** 读取当前管理员信息。 */
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

/** 保存当前管理员信息。 */
export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

/** 清除当前登录态。 */
export function clearAuth() {
  setToken('')
  setRefreshToken('')
  setUser(null)
}
