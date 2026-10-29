/**
 * 官网登录回跳：登录/注册成功后把会话带回 marketing site；
 * 跨域（本地 4173 ↔ 5180）时用 iframe bridge 保持登录态一致。
 */

import { LEGAL_PUBLIC_BASE_URL } from '../config.js'
import {
  getToken,
  getRefreshToken,
  getUsername,
  getNickname,
  getAvatar,
  bindSession,
} from '../stores/storage.js'

const AUTH_HASH_PREFIX = 'upgrade_site_auth='
const MSG_TYPE = 'upgrade_auth_bridge'
const BRIDGE_TIMEOUT_MS = 2500

/** 是否为可回跳的绝对 http(s) URL。 */
export function isExternalReturnUrl(value) {
  if (typeof value !== 'string' || !value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 仅允许回跳本机或与当前页同站（含 www），避免开放重定向带出 token。
 */
export function isAllowedSiteReturn(value) {
  if (!isExternalReturnUrl(value)) return false
  try {
    const u = new URL(value)
    const host = u.hostname.toLowerCase()
    if (host === '127.0.0.1' || host === 'localhost') return true
    if (typeof location !== 'undefined' && location.hostname) {
      const cur = location.hostname.toLowerCase().replace(/^www\./, '')
      const target = host.replace(/^www\./, '')
      if (cur && target === cur) return true
    }
    return false
  } catch {
    return false
  }
}

function sessionPayload(session) {
  const avatar = String(session?.avatar || '')
  const safeAvatar =
    /^https?:\/\//i.test(avatar) || (avatar && avatar.length <= 2048 && !avatar.startsWith('data:'))
      ? avatar
      : ''
  return {
    access_token: session?.access_token || '',
    refresh_token: session?.refresh_token || '',
    username: session?.username || '',
    nickname: session?.nickname || '',
    avatar: safeAvatar,
  }
}

function currentH5Session() {
  const access_token = getToken()
  const username = getUsername()
  if (!access_token || !username) return null
  return sessionPayload({
    access_token,
    refresh_token: getRefreshToken(),
    username,
    nickname: getNickname(),
    avatar: getAvatar(),
  })
}

function isAllowedBridgeOrigin(origin) {
  if (!origin) return false
  try {
    const u = new URL(origin)
    const host = u.hostname.toLowerCase()
    if (host === '127.0.0.1' || host === 'localhost') return true
    if (location?.hostname) {
      const cur = location.hostname.toLowerCase().replace(/^www\./, '')
      if (host.replace(/^www\./, '') === cur) return true
    }
    if (LEGAL_PUBLIC_BASE_URL) {
      const site = new URL(LEGAL_PUBLIC_BASE_URL)
      if (site.origin === origin) return true
    }
    return false
  } catch {
    return false
  }
}

/** 官网首页（用于跨域退出 / bridge）；同域时返回 null。 */
function resolveCrossOriginSiteHome() {
  if (!LEGAL_PUBLIC_BASE_URL) return null
  try {
    const site = new URL(
      LEGAL_PUBLIC_BASE_URL.endsWith('/') ? LEGAL_PUBLIC_BASE_URL : `${LEGAL_PUBLIC_BASE_URL}/`,
    )
    if (site.origin === location.origin) return null
    return site.origin + '/'
  } catch {
    return null
  }
}

function siteBridgeUrl(action, hashPayload) {
  const home = resolveCrossOriginSiteHome()
  if (!home) return null
  try {
    const u = new URL('auth-bridge.html', home)
    if (action) u.searchParams.set('action', action)
    if (hashPayload) {
      u.hash = AUTH_HASH_PREFIX + encodeURIComponent(JSON.stringify(hashPayload))
    }
    return u.toString()
  } catch {
    return null
  }
}

function runSiteIframe(url, { expectActions, timeoutMs = BRIDGE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null)
      return
    }
    let done = false
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;width:0;height:0;opacity:0;pointer-events:none;border:0;left:0;top:0'
    iframe.src = url

    const finish = (value) => {
      if (done) return
      done = true
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      try {
        iframe.remove()
      } catch {
        /* ignore */
      }
      resolve(value)
    }

    const onMessage = (event) => {
      if (!isAllowedBridgeOrigin(event.origin)) return
      const data = event.data
      if (!data || data.type !== MSG_TYPE || data.source !== 'site') return
      if (expectActions && !expectActions.includes(data.action)) return
      finish(data)
    }

    window.addEventListener('message', onMessage)
    const timer = setTimeout(() => finish(null), timeoutMs)
    document.body.appendChild(iframe)
  })
}

/**
 * 若 redirect 为允许的官网外链，则携带会话 hash 跳转并返回 true；否则返回 false。
 * avatar 仅携带 http(s) 或短字符串，避免 data URL 撑爆 hash。
 */
export function redirectToSiteIfNeeded(redirect, session) {
  if (!isAllowedSiteReturn(redirect) || !session) return false
  try {
    const url = new URL(redirect)
    url.hash = AUTH_HASH_PREFIX + encodeURIComponent(JSON.stringify(sessionPayload(session)))
    window.location.assign(url.toString())
    return true
  } catch {
    return false
  }
}

/**
 * H5 退出后：若官网在不同源（本地 4173 vs 5180），跳转官网清会话再回 H5 登录页。
 * 同域已由 clearAuth 清掉 upgrade_site_auth，返回 false。
 */
export function redirectToSiteLogoutIfNeeded() {
  const siteHome = resolveCrossOriginSiteHome()
  if (!siteHome) return false
  try {
    const u = new URL(siteHome)
    u.searchParams.set('site_logout', '1')
    u.searchParams.set('redirect', new URL('/h5/login', location.origin).toString())
    window.location.assign(u.toString())
    return true
  } catch {
    return false
  }
}

/** 静默把当前 H5 会话写入跨域官网 localStorage。 */
export async function pushSessionToSite(session) {
  const payload = sessionPayload(session || currentH5Session() || {})
  if (!payload.access_token || !payload.username) return false
  // Same origin: write directly
  if (!resolveCrossOriginSiteHome()) {
    try {
      const avatar = payload.avatar
      localStorage.setItem(
        'upgrade_site_auth',
        JSON.stringify({
          username: payload.username,
          nickname: payload.nickname,
          avatar: /^https?:\/\//i.test(avatar) ? avatar : '',
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        }),
      )
      return true
    } catch {
      return false
    }
  }
  const url = siteBridgeUrl('store', payload)
  const res = await runSiteIframe(url, { expectActions: ['stored', 'session'] })
  return !!(res && res.session && res.session.access_token)
}

/** 静默清掉跨域官网会话。 */
export async function clearSessionOnSite() {
  if (!resolveCrossOriginSiteHome()) {
    try {
      localStorage.removeItem('upgrade_site_auth')
    } catch {
      /* ignore */
    }
    return true
  }
  const url = siteBridgeUrl('logout')
  await runSiteIframe(url, { expectActions: ['cleared'] })
  return true
}

/**
 * 从 hash 消费官网带来的会话（进入项目 / 回跳）。
 * @returns {boolean} 是否写入了 H5 会话
 */
export function consumeSiteAuthHash() {
  try {
    const hash = String(location.hash || '')
    const idx = hash.indexOf(AUTH_HASH_PREFIX)
    if (idx === -1) return false
    const encoded = hash.slice(idx + AUTH_HASH_PREFIX.length)
    const data = JSON.parse(decodeURIComponent(encoded))
    if (!data?.access_token || !data?.username) return false
    bindSession(data.access_token, data.username, {
      nickname: data.nickname || '',
      avatar: data.avatar || '',
      refresh_token: data.refresh_token || '',
    })
    history.replaceState(null, '', location.pathname + location.search)
    return true
  } catch {
    return false
  }
}

/**
 * H5 无本地会话时，向跨域官网探测已有登录态并写入。
 * @returns {object|null} 探测到的 session
 */
export async function probeSiteSessionIntoH5() {
  if (getToken() && getUsername()) return null
  const url = siteBridgeUrl('probe')
  if (!url) {
    // Same origin: read site key directly
    try {
      const raw = localStorage.getItem('upgrade_site_auth')
      const data = raw ? JSON.parse(raw) : null
      if (!data?.access_token || !data?.username) return null
      bindSession(data.access_token, data.username, {
        nickname: data.nickname || '',
        avatar: data.avatar || '',
        refresh_token: data.refresh_token || '',
      })
      return data
    } catch {
      return null
    }
  }
  const res = await runSiteIframe(url, { expectActions: ['session'] })
  const session = res?.session
  if (!session?.access_token || !session?.username) return null
  bindSession(session.access_token, session.username, {
    nickname: session.nickname || '',
    avatar: session.avatar || '',
    refresh_token: session.refresh_token || '',
  })
  return session
}
