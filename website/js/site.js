/**
 * 官网交互入口：初始化导航、语言、主题与页面行为。
 */

;(function () {
  const SITE = window.UPGRADE_SITE
  const LOCALES = window.UPGRADE_LOCALES || []
  const I18N = window.UPGRADE_I18N || {}
  if (!SITE) return

  const LANG_KEY = 'upgrade_site_lang'
  const THEME_KEY = 'upgrade_site_theme'
  const AUTH_KEY = 'upgrade_site_auth'
  const AUTH_HASH_PREFIX = 'upgrade_site_auth='
  const platformOrder = ['androidPhone', 'androidPad', 'iosPhone', 'iosPad']

  function getSiteSession() {
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      if (!raw) return null
      const data = JSON.parse(raw)
      if (!data || !data.username) return null
      return data
    } catch (e) {
      return null
    }
  }

  /** In-memory profile for this page (holds data-URL avatars that cannot be persisted). */
  var liveProfile = null

  function setSiteSession(data) {
    try {
      if (!data || !data.username) {
        localStorage.removeItem(AUTH_KEY)
        return
      }
      // data: avatars blow localStorage quota; only persist http(s) so nickname/token always save.
      var avatar = String(data.avatar || '')
      if (!/^https?:\/\//i.test(avatar)) avatar = ''
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          username: String(data.username || ''),
          nickname: String(data.nickname || '').trim(),
          avatar: avatar,
          access_token: String(data.access_token || ''),
          refresh_token: String(data.refresh_token || ''),
        }),
      )
    } catch (e) {}
  }

  function clearSiteSession() {
    liveProfile = null
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch (e) {}
  }

  function getDisplaySession() {
    var session = getSiteSession()
    if (!session) return null
    if (!liveProfile) return session
    return {
      username: liveProfile.username || session.username,
      nickname: liveProfile.nickname != null ? liveProfile.nickname : session.nickname,
      avatar:
        liveProfile.avatar != null && liveProfile.avatar !== ''
          ? liveProfile.avatar
          : session.avatar,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }
  }

  /** Consume `#upgrade_site_auth=...` handoff from H5 login and strip the hash. */
  function consumeAuthHash() {
    function take(data) {
      if (!data || !data.username) return
      setSiteSession(data)
      liveProfile = {
        username: String(data.username || ''),
        nickname: String(data.nickname || '').trim(),
        avatar: String(data.avatar || ''),
      }
    }
    try {
      const hash = String(location.hash || '')
      if (!hash.startsWith('#' + AUTH_HASH_PREFIX) && !hash.startsWith(AUTH_HASH_PREFIX)) {
        const idx = hash.indexOf(AUTH_HASH_PREFIX)
        if (idx === -1) return
        const encoded = hash.slice(idx + AUTH_HASH_PREFIX.length)
        take(JSON.parse(decodeURIComponent(encoded)))
        history.replaceState(null, '', location.pathname + location.search)
        return
      }
      const encoded = hash.replace(/^#/, '').slice(AUTH_HASH_PREFIX.length)
      take(JSON.parse(decodeURIComponent(encoded)))
      history.replaceState(null, '', location.pathname + location.search)
    } catch (e) {}
  }

  /** Allow H5 return after site_logout handoff (localhost / same host / configured login origin). */
  function isAllowedH5Return(value) {
    if (!value) return false
    try {
      const u = new URL(String(value), location.href)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
      const host = u.hostname.toLowerCase()
      if (host === '127.0.0.1' || host === 'localhost') return true
      const cur = location.hostname.toLowerCase().replace(/^www\./, '')
      if (host.replace(/^www\./, '') === cur) return true
      try {
        const login = new URL(SITE.loginUrl || '', location.href)
        if (login.origin === u.origin) return true
      } catch (e) {}
      return false
    } catch (e) {
      return false
    }
  }

  /** H5 logout handoff: `?site_logout=1&redirect=/h5/login`. Returns true if navigating away. */
  function consumeSiteLogout() {
    try {
      const u = new URL(location.href)
      if (u.searchParams.get('site_logout') !== '1') return false
      clearSiteSession()
      const redirect = u.searchParams.get('redirect')
      u.searchParams.delete('site_logout')
      u.searchParams.delete('redirect')
      const qs = u.searchParams.toString()
      const clean = u.pathname + (qs ? '?' + qs : '') + u.hash
      if (isAllowedH5Return(redirect)) {
        window.location.assign(redirect)
        return true
      }
      history.replaceState(null, '', clean)
      return false
    } catch (e) {
      return false
    }
  }

  /** Ensure PC web paths use Vite/nginx base `/h5/` (legacy CMS often stored `/login`). */
  function normalizeH5Url(raw, role) {
    if (!raw || raw === '#') return raw || '#'
    try {
      const u = new URL(String(raw), location.href)
      var path = u.pathname || '/'
      // /login → /h5/login ; /register → /h5/register
      if (path === '/login' || path === '/login/') {
        u.pathname = '/h5/login'
      } else if (path === '/register' || path === '/register/') {
        u.pathname = '/h5/register'
      } else if (path === '/app/login' || path === '/app/login/') {
        // mis-aimed at mobile base; website login is PC /h5/
        u.pathname = '/h5/login'
      } else if (role === 'app' && (path === '/' || path === '/app' || path === '/app/')) {
        u.pathname = '/h5/'
      } else if (role === 'app' && path === '/h5') {
        u.pathname = '/h5/'
      }
      return u.toString()
    } catch (e) {
      return String(raw)
    }
  }

  function buildLoginUrl() {
    const base = normalizeH5Url(SITE.loginUrl || '#', 'login')
    if (!base || base === '#') return '#'
    try {
      const u = new URL(base, location.href)
      u.searchParams.set('redirect', location.origin + '/')
      return u.toString()
    } catch (e) {
      return base
    }
  }

  function buildAppUrl() {
    const base = normalizeH5Url(SITE.appUrl || SITE.loginUrl || '#', 'app')
    if (!base || base === '#') return '#'
    const session = getSiteSession()
    if (!session || !session.access_token || !session.username) return base
    try {
      const u = new URL(base, location.href)
      const avatar = String(session.avatar || '')
      const safeAvatar = /^https?:\/\//i.test(avatar) ? avatar : ''
      u.hash =
        AUTH_HASH_PREFIX +
        encodeURIComponent(
          JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token || '',
            username: session.username,
            nickname: session.nickname || '',
            avatar: safeAvatar,
          }),
        )
      return u.toString()
    } catch (e) {
      return base
    }
  }

  function h5BridgeUrl(action) {
    try {
      const login = new URL(normalizeH5Url(SITE.loginUrl || '', 'login'), location.href)
      if (login.origin === location.origin) return null
      const u = new URL('/h5/auth-bridge', login.origin)
      if (action) u.searchParams.set('action', action)
      return u.toString()
    } catch (e) {
      return null
    }
  }

  function isAllowedBridgeOrigin(origin) {
    if (!origin) return false
    try {
      const u = new URL(origin)
      const host = u.hostname.toLowerCase()
      if (host === '127.0.0.1' || host === 'localhost') return true
      const cur = location.hostname.toLowerCase().replace(/^www\./, '')
      if (host.replace(/^www\./, '') === cur) return true
      try {
        const login = new URL(SITE.loginUrl || '', location.href)
        if (login.origin === origin) return true
      } catch (e) {}
      return false
    } catch (e) {
      return false
    }
  }

  /** When website has no session, ask cross-origin H5 if it is logged in. */
  function probeH5SessionIntoSite() {
    if (getSiteSession()) return Promise.resolve(false)
    const url = h5BridgeUrl('probe')
    if (!url) return Promise.resolve(false)
    return new Promise(function (resolve) {
      var done = false
      var iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText =
        'position:fixed;width:0;height:0;opacity:0;pointer-events:none;border:0;left:0;top:0'
      iframe.src = url

      function finish(ok) {
        if (done) return
        done = true
        window.removeEventListener('message', onMessage)
        clearTimeout(timer)
        try {
          iframe.parentNode && iframe.parentNode.removeChild(iframe)
        } catch (e) {}
        resolve(!!ok)
      }

      function onMessage(event) {
        if (!isAllowedBridgeOrigin(event.origin)) return
        var data = event.data
        if (!data || data.type !== 'upgrade_auth_bridge' || data.source !== 'h5') return
        if (data.action !== 'session') return
        var session = data.session
        if (session && session.access_token && session.username) {
          setSiteSession(session)
          liveProfile = {
            username: String(session.username || ''),
            nickname: String(session.nickname || '').trim(),
            avatar: String(session.avatar || ''),
          }
          applyAuthUi()
          refreshSiteProfile()
          finish(true)
          return
        }
        finish(false)
      }

      window.addEventListener('message', onMessage)
      var timer = setTimeout(function () {
        finish(false)
      }, 2500)
      document.body.appendChild(iframe)
    })
  }

  function buildLogoutUrl() {
    const base = normalizeH5Url(SITE.loginUrl || '#', 'login')
    if (!base || base === '#') return '#'
    try {
      const u = new URL(base, location.href)
      u.searchParams.set('logout', '1')
      u.searchParams.set('redirect', location.origin + '/')
      return u.toString()
    } catch (e) {
      return base
    }
  }

  function accountLetter(session) {
    const name = String((session && (session.nickname || session.username)) || '').trim()
    if (!name) return '?'
    const m = name.match(/[\p{L}\p{N}]/u)
    return (m ? m[0] : name.charAt(0)).toUpperCase()
  }

  function displayLabel(session) {
    if (!session) return ''
    const nick = String(session.nickname || '').trim()
    const user = String(session.username || '').trim()
    return nick || user
  }

  function applyAuthUi() {
    const session = getDisplaySession()
    const loggedIn = !!(session && session.username)
    const guestIds = ['authGuest', 'ctaGuest', 'ctaGuestBottom']
    const userIds = ['authUser', 'ctaUser', 'ctaUserBottom']
    guestIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) el.hidden = loggedIn
    })
    userIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) el.hidden = !loggedIn
    })
    const account = document.getElementById('navAccount')
    const nameEl = document.getElementById('navAccountName')
    const imgEl = document.getElementById('navAvatarImg')
    const letterEl = document.getElementById('navAvatarLetter')
    const label = loggedIn ? displayLabel(session) : ''
    const username = loggedIn ? String(session.username || '').trim() : ''
    if (account) {
      account.title =
        label && username && label !== username ? label + ' · ' + username : label
    }
    if (nameEl) nameEl.textContent = label
    if (imgEl && letterEl) {
      const avatar = loggedIn ? String(session.avatar || '').trim() : ''
      if (avatar) {
        imgEl.src = avatar
        imgEl.hidden = false
        letterEl.hidden = true
        letterEl.textContent = ''
        imgEl.onerror = function () {
          imgEl.hidden = true
          imgEl.removeAttribute('src')
          letterEl.hidden = false
          letterEl.textContent = accountLetter(session)
        }
      } else {
        imgEl.hidden = true
        imgEl.removeAttribute('src')
        letterEl.hidden = !loggedIn
        letterEl.textContent = loggedIn ? accountLetter(session) : ''
      }
    }
    const appUrl = buildAppUrl()
    ;['navEnter', 'ctaEnter', 'ctaEnterBottom'].forEach((id) => {
      const el = document.getElementById(id)
      if (el) el.setAttribute('href', appUrl)
    })
  }

  function apiUrl(path) {
    return String(SITE.apiBaseUrl || '').replace(/\/$/, '') + path
  }

  function applyProfileResult(session, result) {
    const nickname = String(result.nickname || '').trim()
    const avatar = String(result.avatar || '')
    const username = String(result.username || session.username || '').trim()
    liveProfile = { username: username, nickname: nickname, avatar: avatar }
    setSiteSession({
      username: username,
      nickname: nickname,
      avatar: avatar,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    applyAuthUi()
  }

  function refreshAccessToken(session) {
    if (!session || !session.refresh_token) return Promise.resolve(null)
    return fetch(apiUrl('/api/auth/tokens'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
      mode: 'cors',
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body }
        })
      })
      .then(function (pack) {
        const result = pack.body && pack.body.result
        if (!pack.ok || !result || pack.body.code !== 200 || !result.access_token) return null
        const next = {
          username: result.username || session.username,
          nickname: result.nickname != null ? result.nickname : session.nickname,
          avatar: result.avatar != null ? result.avatar : session.avatar,
          access_token: result.access_token,
          refresh_token: result.refresh_token || session.refresh_token,
        }
        setSiteSession(next)
        return next
      })
      .catch(function () {
        return null
      })
  }

  function fetchProfile(session) {
    return fetch(apiUrl('/api/auth/me'), {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + session.access_token,
        Accept: 'application/json',
      },
      mode: 'cors',
    }).then(function (res) {
      return res.json().then(function (body) {
        return { status: res.status, ok: res.ok, body: body }
      })
    })
  }

  /** Pull nickname/avatar from API; supports token refresh and data-URL avatars in memory. */
  function refreshSiteProfile() {
    var session = getSiteSession()
    if (!session || !session.access_token) return
    fetchProfile(session)
      .then(function (pack) {
        if (pack.status === 401 || pack.body.code === 40102 || pack.body.code === 40103) {
          return refreshAccessToken(session).then(function (next) {
            if (!next) return null
            return fetchProfile(next).then(function (pack2) {
              return { session: next, pack: pack2 }
            })
          })
        }
        return { session: session, pack: pack }
      })
      .then(function (ctx) {
        if (!ctx || !ctx.pack) return
        const result = ctx.pack.body && ctx.pack.body.result
        if (!ctx.pack.ok || !result || ctx.pack.body.code !== 200) return
        applyProfileResult(ctx.session, result)
      })
      .catch(function () {})
  }

  function applyLoginLinks() {
    const url = buildLoginUrl()
    ;['navLogin', 'ctaLogin', 'ctaLoginBottom'].forEach((id) => {
      const el = document.getElementById(id)
      if (el) el.setAttribute('href', url)
    })
    applyAuthUi()
  }

  async function handleLogout() {
    const session = getSiteSession()
    clearSiteSession()
    applyAuthUi()
    // Revoke refresh on API when we have it (best-effort)
    if (session && session.refresh_token) {
      const base = String(SITE.apiBaseUrl || '').replace(/\/$/, '')
      try {
        fetch(base + '/api/auth/sessions', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: session.access_token ? 'Bearer ' + session.access_token : '',
          },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
          mode: 'cors',
          keepalive: true,
        }).catch(function () {})
      } catch (e) {}
    }
    // Clear H5/PC local session via login?logout=1 handoff
    const logoutUrl = buildLogoutUrl()
    if (logoutUrl && logoutUrl !== '#') {
      window.location.assign(logoutUrl)
    }
  }

  function normalizeLang(code) {
    if (!code) return 'en'
    if (I18N[code]) return code
    if (code === 'zh') return 'zh-Hans'
    if (code.startsWith('zh-Hans') || code === 'zh-CN') return 'zh-Hans'
    if (code.startsWith('zh-Hant') || code === 'zh-TW' || code === 'zh-HK') return 'zh-Hant'
    const short = code.split('-')[0]
    if (I18N[short]) return short
    return 'en'
  }

  function detectLang() {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && I18N[saved]) return saved
    const nav = String(navigator.language || navigator.userLanguage || 'en')
    return normalizeLang(nav)
  }

  let lang = detectLang()

  function t() {
    return I18N[lang] || I18N.en || {}
  }

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
    } catch (e) {}
    return 'light'
  }

  function setTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem(THEME_KEY, next)
    const icon = document.getElementById('themeIcon')
    if (icon) icon.textContent = next === 'dark' ? '☀' : '☾'
    const btn = document.getElementById('themeToggle')
    if (btn) {
      const copy = t()
      btn.setAttribute('aria-label', copy.themeToggle || 'Theme')
      btn.title = next === 'dark' ? copy.themeLight || 'Light' : copy.themeDark || 'Dark'
    }
  }

  function detectPlatform() {
    const ua = String(navigator.userAgent || '').toLowerCase()
    const isIpadOs =
      navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1
    const isAndroid = /android/.test(ua)
    const isIOS = /iphone|ipod/.test(ua) || /ipad/.test(ua) || isIpadOs
    const isPad =
      /ipad/.test(ua) ||
      isIpadOs ||
      (isAndroid && !/mobile/.test(ua)) ||
      (isAndroid && Math.min(window.innerWidth, window.innerHeight) >= 600)

    if (isAndroid && isPad) return 'androidPad'
    if (isAndroid) return 'androidPhone'
    if (isIOS && isPad) return 'iosPad'
    if (isIOS) return 'iosPhone'
    return null
  }

  function applyContact() {
    const el = document.getElementById('footerContact')
    if (!el) return
    const email = SITE.contactEmail || 'you@example.com'
    el.setAttribute('href', `mailto:${email}`)
    el.textContent = email
    el.setAttribute('title', email)
    const copy = t()
    if (copy.contact) el.setAttribute('aria-label', copy.contact + ': ' + email)
  }

  /** Fire-and-forget website visit beacon for admin stats. */
  function recordVisit() {
    const base = String(SITE.apiBaseUrl || '').replace(/\/$/, '')
    const key = 'upgrade_site_visit_pinged'
    try {
      if (sessionStorage.getItem(key) === '1') return
      sessionStorage.setItem(key, '1')
    } catch (e) {}
    try {
      const langHeader = normalizeLang(lang || detectLang())
      fetch(base + '/api/analytics/visits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': langHeader,
          'X-Client-Platform': 'web',
          'X-Device-Language': langHeader,
        },
        body: JSON.stringify({ platform: 'web' }),
        mode: 'cors',
        keepalive: true,
      }).catch(function () {})
    } catch (e) {}
  }

  function currentLocaleName() {
    const hit = LOCALES.find((item) => item.code === lang)
    return (hit && hit.name) || lang
  }

  function closeLangMenu() {
    const picker = document.getElementById('langPicker')
    const trigger = document.getElementById('langTrigger')
    const menu = document.getElementById('langMenu')
    if (!picker || !trigger || !menu) return
    picker.classList.remove('is-open')
    trigger.setAttribute('aria-expanded', 'false')
    menu.hidden = true
  }

  function openLangMenu() {
    const picker = document.getElementById('langPicker')
    const trigger = document.getElementById('langTrigger')
    const menu = document.getElementById('langMenu')
    if (!picker || !trigger || !menu) return
    picker.classList.add('is-open')
    trigger.setAttribute('aria-expanded', 'true')
    menu.hidden = false
    const active = menu.querySelector('.lang-option.is-active')
    if (active) active.focus()
  }

  function fillLangSelect() {
    const trigger = document.getElementById('langTrigger')
    const label = document.getElementById('langTriggerLabel')
    const menu = document.getElementById('langMenu')
    if (!trigger || !label || !menu) return

    const copy = t()
    trigger.setAttribute('aria-label', copy.langLabel || 'Language')
    label.textContent = currentLocaleName()

    menu.innerHTML = ''
    LOCALES.forEach((item) => {
      const li = document.createElement('li')
      li.setAttribute('role', 'presentation')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'lang-option' + (item.code === lang ? ' is-active' : '')
      btn.setAttribute('role', 'option')
      btn.setAttribute('aria-selected', item.code === lang ? 'true' : 'false')
      btn.dataset.code = item.code
      btn.textContent = item.name
      btn.addEventListener('click', () => {
        if (item.code === lang) {
          closeLangMenu()
          return
        }
        lang = normalizeLang(item.code)
        localStorage.setItem(LANG_KEY, lang)
        closeLangMenu()
        applyI18n()
        applyContact()
        fillLangSelect()
      })
      li.appendChild(btn)
      menu.appendChild(li)
    })
  }

  function resolveLegalLocale(code) {
    const LEGAL = window.UPGRADE_LEGAL
    const packs = (LEGAL && LEGAL.locales) || {}
    if (packs[code]) return code
    if (code === 'zh') return 'zh-Hans'
    if (String(code).startsWith('zh-Hans') || code === 'zh-CN') return 'zh-Hans'
    if (String(code).startsWith('zh-Hant') || code === 'zh-TW' || code === 'zh-HK') return 'zh-Hant'
    const short = String(code || '').split('-')[0]
    if (packs[short]) return short
    return packs.en ? 'en' : Object.keys(packs)[0] || 'en'
  }

  function fillLegalEmail(text) {
    const email = SITE.contactEmail || 'you@example.com'
    return String(text || '').split('{email}').join(email)
  }

  function renderLegalDoc() {
    const kind = document.body.getAttribute('data-legal-doc')
    if (!kind) return
    const LEGAL = window.UPGRADE_LEGAL
    if (!LEGAL || !LEGAL.locales) return

    const code = resolveLegalLocale(lang)
    const pack = LEGAL.locales[code] || LEGAL.locales.en
    const doc = pack && pack[kind]
    if (!doc) return

    const titleEl = document.getElementById('legalTitle')
    const updatedEl = document.getElementById('legalUpdated')
    const bodyEl = document.getElementById('legalBody')
    if (titleEl) titleEl.textContent = doc.title || ''
    if (updatedEl) updatedEl.textContent = doc.updated || ''
    if (bodyEl) {
      bodyEl.innerHTML = ''
      ;(doc.paragraphs || []).forEach((raw) => {
        const p = document.createElement('p')
        p.className = 'legal-block'
        const text = fillLegalEmail(raw)
        // Turn bare email into a mailto link for store reviewers / users.
        const email = SITE.contactEmail || 'you@example.com'
        if (email && text.indexOf(email) !== -1) {
          const parts = text.split(email)
          parts.forEach((chunk, idx) => {
            if (chunk) p.appendChild(document.createTextNode(chunk))
            if (idx < parts.length - 1) {
              const a = document.createElement('a')
              a.href = 'mailto:' + email
              a.textContent = email
              p.appendChild(a)
            }
          })
        } else {
          p.textContent = text
        }
        bodyEl.appendChild(p)
      })
    }

    const brand = SITE.brand || 'Upgrade'
    document.title = (doc.title || kind) + ' · ' + brand
  }

  function applyI18n() {
    const copy = t()
    document.documentElement.lang = lang
    const isLegal = !!document.body.getAttribute('data-legal-doc')
    if (!isLegal) document.title = SITE.brand

    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n')
      if (copy[key] != null) node.textContent = copy[key]
    })

    const trigger = document.getElementById('langTrigger')
    if (trigger) trigger.setAttribute('aria-label', copy.langLabel || 'Language')
    const label = document.getElementById('langTriggerLabel')
    if (label) label.textContent = currentLocaleName()

    const backTop = document.getElementById('backToTop')
    if (backTop) {
      backTop.setAttribute(
        'aria-label',
        copy.backToTop || (I18N.en && I18N.en.backToTop) || 'Back to top'
      )
    }

    renderFeatures()
    renderShots()
    renderDownloads()
    renderLegalDoc()
    setTheme(document.documentElement.getAttribute('data-theme') || getTheme())
  }

  const FEATURE_ICONS = [
    // cloud sync
    `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M14 32.5h18.5a8 8 0 0 0 1.2-15.9 11 11 0 0 0-21.2 2.4A7.5 7.5 0 0 0 14 32.5Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M21 28v8.5M27 28v8.5M21 36.5l3 3 3-3M24 24.5v-5.5M21.5 21.5 24 19l2.5 2.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    // calendar rhythm
    `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="10" y="12" width="28" height="26" rx="5" stroke="currentColor" stroke-width="2.2"/><path d="M10 20h28M17 9v6M31 9v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="18" cy="27" r="2.2" fill="currentColor"/><circle cx="24" cy="27" r="2.2" fill="currentColor"/><circle cx="30" cy="27" r="2.2" fill="currentColor"/><circle cx="18" cy="33" r="2.2" fill="currentColor"/><circle cx="24" cy="33" r="2.2" fill="currentColor"/></svg>`,
    // period report
    `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M15 10h12l8 8v18a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M27 10v8h8" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M18 30v4M23 26v8M28 23v11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="34" cy="18" r="4.5" fill="var(--tint-soft)" stroke="currentColor" stroke-width="1.6"/><path d="M34 15.8v4.4M31.8 18h4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  ]

  function renderFeatures() {
    const list = document.getElementById('featureList')
    if (!list) return
    const copy = t()
    list.innerHTML = ''
    ;(copy.features || []).forEach((f, idx) => {
      const li = document.createElement('li')
      li.className = 'feature-item'
      li.innerHTML =
        '<div class="feature-icon"></div><div class="feature-copy"><span class="feature-title"></span><p class="feature-desc"></p></div>'
      li.querySelector('.feature-icon').innerHTML = FEATURE_ICONS[idx] || FEATURE_ICONS[0]
      li.querySelector('.feature-title').textContent = f.title
      li.querySelector('.feature-desc').textContent = f.desc
      list.appendChild(li)
    })
  }

  function renderShots() {
    const grid = document.getElementById('shotGrid')
    if (!grid) return
    const copy = t()
    const shotsCopy = copy.shots || []
    grid.innerHTML = ''
    ;(SITE.shots || []).forEach((shot, idx) => {
      const meta = shotsCopy[idx] || shotsCopy[shot.key] || { title: '', desc: '' }
      const fig = document.createElement('figure')
      fig.className = 'shot-card'
      fig.innerHTML =
        '<div class="shot-frame"><img alt="" /></div><figcaption><strong></strong><span></span></figcaption>'
      const img = fig.querySelector('img')
      img.src = shot.src
      img.alt = meta.title || 'Upgrade screenshot'
      fig.querySelector('strong').textContent = meta.title || ''
      fig.querySelector('span').textContent = meta.desc || ''
      grid.appendChild(fig)
    })
  }

  function renderDownloads() {
    const grid = document.getElementById('downloadGrid')
    if (!grid) return
    const copy = t()
    const recommended = detectPlatform()
    grid.innerHTML = ''

    platformOrder.forEach((key) => {
      const item = (SITE.downloads && SITE.downloads[key]) || {}
      const ready = !!(item.ready && item.url)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'download-card'
      btn.dataset.platform = key
      if (recommended === key) btn.classList.add('is-recommended')
      if (!ready) {
        btn.classList.add('is-disabled')
        btn.disabled = true
      }

      const name = (copy.platforms && copy.platforms[key]) || key
      btn.innerHTML =
        '<span class="dl-badge"></span><span class="dl-name"></span><span class="dl-meta"></span><span class="dl-action"></span>'
      btn.querySelector('.dl-badge').textContent = copy.recommended || ''
      btn.querySelector('.dl-name').textContent = name
      btn.querySelector('.dl-meta').textContent = ready
        ? copy.downloadAction
        : copy.comingSoon
      btn.querySelector('.dl-action').textContent = ready
        ? copy.downloadAction
        : copy.comingSoon

      if (ready) {
        btn.addEventListener('click', () => {
          window.open(item.url, '_blank', 'noopener,noreferrer')
        })
      }
      grid.appendChild(btn)
    })
  }

  function bindBackToTop() {
    const btn = document.getElementById('backToTop')
    if (!btn) return

    const threshold = () => Math.max(window.innerHeight * 0.85, 480)
    let ticking = false

    const sync = () => {
      ticking = false
      const show = window.scrollY >= threshold()
      btn.classList.toggle('is-visible', show)
      btn.setAttribute('aria-hidden', show ? 'false' : 'true')
      btn.tabIndex = show ? 0 : -1
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(sync)
    }

    btn.addEventListener('click', () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    })

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    sync()
  }

  function bindControls() {
    const trigger = document.getElementById('langTrigger')
    const picker = document.getElementById('langPicker')
    if (trigger && picker) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation()
        if (picker.classList.contains('is-open')) closeLangMenu()
        else openLangMenu()
      })
      document.addEventListener('click', (e) => {
        if (!picker.contains(e.target)) closeLangMenu()
      })
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLangMenu()
      })
    }
    const themeBtn = document.getElementById('themeToggle')
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light'
        setTheme(cur === 'dark' ? 'light' : 'dark')
      })
    }
    bindMobileNav()
    bindBackToTop()
    ;['navLogout', 'ctaLogout', 'ctaLogoutBottom'].forEach((id) => {
      const el = document.getElementById(id)
      if (el) el.addEventListener('click', (e) => {
        e.preventDefault()
        handleLogout()
      })
    })
  }

  /** Collapse primary nav behind a toggle on narrow viewports (homepage drawer only). */
  function bindMobileNav() {
    const topNav = document.getElementById('topNav')
    const toggle = document.getElementById('navToggle')
    const actions = document.getElementById('navActions')
    if (!topNav || !toggle || !actions) return
    if (!topNav.classList.contains('topnav--drawer')) return

    const mq = window.matchMedia('(max-width: 720px)')

    function setOpen(open) {
      topNav.classList.toggle('is-open', open)
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu')
    }

    function close() {
      setOpen(false)
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation()
      setOpen(!topNav.classList.contains('is-open'))
    })

    actions.addEventListener('click', (e) => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest('a.nav-link, a.nav-control, button.nav-control, #navLogin, #navEnter, #navLogout'))
        close()
    })

    document.addEventListener('click', (e) => {
      if (!mq.matches) return
      if (!topNav.classList.contains('is-open')) return
      if (topNav.contains(e.target)) return
      close()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close()
    })

    const onViewport = () => {
      if (!mq.matches) close()
    }
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onViewport)
    else if (typeof mq.addListener === 'function') mq.addListener(onViewport)
  }

  function applyBrand() {
    const brand = SITE.brand || 'Upgrade'
    document.querySelectorAll('.brand-word').forEach((el) => {
      el.textContent = brand
    })
    const hero = document.getElementById('heroBrand')
    if (hero) hero.textContent = brand
    document.title = brand
  }

  function mergeLocalePack(base, overlay) {
    if (!overlay || typeof overlay !== 'object') return base
    const out = Object.assign({}, base || {})
    Object.keys(overlay).forEach((k) => {
      const v = overlay[k]
      if (Array.isArray(v)) {
        out[k] = v
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = Object.assign({}, out[k] || {}, v)
      } else if (v != null) {
        out[k] = v
      }
    })
    return out
  }

  function applyRemoteConfig(remote) {
    if (!remote || typeof remote !== 'object') return
    if (remote.brand) SITE.brand = remote.brand
    if (remote.contactEmail != null) SITE.contactEmail = remote.contactEmail
    if (remote.loginUrl) {
      var remoteLogin = String(remote.loginUrl)
      var remoteIsLocal = /127\.0\.0\.1|localhost/i.test(remoteLogin)
      var pageIsLocal =
        location.hostname === '127.0.0.1' || location.hostname === 'localhost'
      // Never apply leftover localhost CMS URLs onto a non-local deploy
      if (!remoteIsLocal || pageIsLocal) {
        SITE.loginUrl = normalizeH5Url(remoteLogin, 'login')
      }
    }
    if (remote.appUrl) {
      var remoteApp = String(remote.appUrl)
      var remoteAppLocal = /127\.0\.0\.1|localhost/i.test(remoteApp)
      var pageIsLocalApp =
        location.hostname === '127.0.0.1' || location.hostname === 'localhost'
      if (!remoteAppLocal || pageIsLocalApp) {
        SITE.appUrl = normalizeH5Url(remoteApp, 'app')
      }
    }
    if (remote.downloads && typeof remote.downloads === 'object') {
      SITE.downloads = Object.assign({}, SITE.downloads || {}, remote.downloads)
    }
    if (Array.isArray(remote.shots) && remote.shots.length) {
      SITE.shots = remote.shots
    }
    if (remote.i18n && typeof remote.i18n === 'object') {
      Object.keys(remote.i18n).forEach((code) => {
        I18N[code] = mergeLocalePack(I18N[code] || {}, remote.i18n[code])
      })
    }
  }

  function refreshUi() {
    applyBrand()
    applyLoginLinks()
    applyContact()
    applyI18n()
    fillLangSelect()
  }

  function loadRemoteConfig() {
    const base = String(SITE.apiBaseUrl || '').replace(/\/$/, '')
    // Empty base = same-origin reverse proxy (`/api/...`)
    return fetch(base + '/api/site/config', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      mode: 'cors',
    })
      .then((res) => res.json())
      .then((body) => {
        if (body && body.code === 200 && body.result) {
          applyRemoteConfig(body.result)
          refreshUi()
        }
      })
      .catch(function () {})
  }

  setTheme(getTheme())
  fillLangSelect()
  applyBrand()
  // Harden against legacy CMS / config without /h5/ base
  SITE.loginUrl = normalizeH5Url(SITE.loginUrl || '', 'login')
  SITE.appUrl = normalizeH5Url(SITE.appUrl || SITE.loginUrl || '', 'app')
  consumeAuthHash()
  const leavingForH5 = consumeSiteLogout()
  applyLoginLinks()
  if (leavingForH5) return
  probeH5SessionIntoSite().then(function () {
    refreshSiteProfile()
  })
  applyContact()
  bindControls()
  applyI18n()
  recordVisit()
  loadRemoteConfig()

  let resizeTimer = null
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(renderDownloads, 120)
  })
})()
