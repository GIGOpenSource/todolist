/**
 * 移动端设备适配：识别平台、窗口尺寸与响应式布局形态。
 */

import { ref } from 'vue'

/** Form-factor breakpoints (logical CSS px / uni windowWidth) */
export const BP_TABLET = 768
/** Large tablet (iPad Pro portrait / small landscape) */
export const BP_TABLET_LG = 1024
/** Real desktop web only — never apply to pads */
export const BP_DESKTOP = 1200

/** Bumps when form factor or width changes */
export const deviceVersion = ref(0)

let watching = false

/** 读取当前窗口宽度。 */
export function getWindowWidth() {
  try {
    const info = uni.getSystemInfoSync() || {}
    const w = Number(info.windowWidth || info.screenWidth || 0)
    if (w > 0) return w
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.innerWidth) return window.innerWidth
  return 375
}

/** 读取当前窗口高度。 */
export function getWindowHeight() {
  try {
    const info = uni.getSystemInfoSync() || {}
    const h = Number(info.windowHeight || info.screenHeight || 0)
    if (h > 0) return h
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.innerHeight) return window.innerHeight
  return 667
}

function hasCoarsePointer() {
  try {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches
    )
  } catch {
    return false
  }
}

/** 识别当前运行平台。 */
export function detectPlatform() {
  let platform = 'web'
  let os = 'unknown'
  let deviceType = ''
  let model = ''
  try {
    const info = uni.getSystemInfoSync() || {}
    const p = String(info.platform || '').toLowerCase()
    const uniPlatform = String(info.uniPlatform || '').toLowerCase()
    deviceType = String(info.deviceType || '').toLowerCase()
    model = String(info.model || info.deviceModel || info.brand || '').toLowerCase()
    // #ifdef H5
    platform = 'web'
    // #endif
    // #ifdef APP-PLUS
    platform = 'app'
    // #endif
    // #ifdef MP
    platform = 'mp'
    // #endif
    if (!platform || platform === 'unknown') {
      if (uniPlatform.includes('web') || uniPlatform === 'h5') platform = 'web'
      else if (p === 'ios' || p === 'android') platform = 'app'
    }
    os = p || os
  } catch {
    // ignore
  }

  const ua =
    typeof navigator !== 'undefined' ? String(navigator.userAgent || '').toLowerCase() : ''
  const isIpadOsDesktopUa =
    typeof navigator !== 'undefined' &&
    navigator.platform === 'MacIntel' &&
    Number(navigator.maxTouchPoints || 0) > 1

  const isIOS =
    os === 'ios' || /iphone|ipad|ipod/.test(ua) || isIpadOsDesktopUa
  const isAndroid = os === 'android' || ua.includes('android')

  const shortSide = Math.min(getWindowWidth(), getWindowHeight())
  const longSide = Math.max(getWindowWidth(), getWindowHeight())

  // Pad signals (iPad Pro landscape is often ≥1200 CSS px — must still count as pad)
  const isPadUa =
    deviceType === 'pad' ||
    /ipad/.test(ua) ||
    /ipad/.test(model) ||
    isIpadOsDesktopUa ||
    (isAndroid && deviceType === 'pad') ||
    (isAndroid && !/mobile/.test(ua) && shortSide >= BP_TABLET) ||
    // Touch tablet heuristic: coarse pointer + phone-sized short side is still phone;
    // short side ≥ 600 ≈ 7" tablet and up (covers iPad mini → Pro)
    (hasCoarsePointer() && shortSide >= 600 && longSide >= BP_TABLET)

  return {
    platform,
    os: isIOS ? 'ios' : isAndroid ? 'android' : os,
    isIOS,
    isAndroid,
    isPadUa,
    isH5: platform === 'web',
    deviceType,
    model,
    shortSide,
    longSide,
  }
}

/** 根据平台和宽度判断设备形态。 */
export function resolveFormFactor(width = getWindowWidth(), meta = detectPlatform()) {
  // Pads (incl. iPad Pro any orientation) never use desktop chrome
  if (meta.isPadUa) return 'tablet'
  // Desktop web: wide viewport without coarse-pointer tablet chrome
  if (width >= BP_DESKTOP && !hasCoarsePointer()) return 'desktop'
  if (width >= BP_TABLET) return 'tablet'
  return 'phone'
}

/** 将响应式像素转换为网页像素。 */
export function rpxToPx(rpx, width = getWindowWidth()) {
  const n = Number(rpx)
  if (!Number.isFinite(n)) return rpx
  const w = Math.max(1, Number(width) || 375)
  return `${(n / 750) * w}px`
}

/** 计算当前设备形态的布局变量。 */
export function layoutVarsFor(form, width = getWindowWidth()) {
  if (form === 'desktop') {
    return {
      '--app-content-max': '880px',
      '--app-tab-max': '640px',
      '--app-sheet-max': '560px',
      '--app-space-page': '28px',
      '--app-page-inset': '28px',
      '--app-type-large-title': '40px',
      '--app-btn-height': '48px',
      '--app-btn-height-sheet': '48px',
      '--app-auth-max': '440px',
      '--app-cal-max': '560px',
      '--app-cal-cell': '44px',
    }
  }
  if (form === 'tablet') {
    // iPad Pro / large pads: slightly wider column, still phone-app chrome (bottom sheets)
    const large = width >= BP_TABLET_LG
    return {
      '--app-content-max': large ? '820px' : '720px',
      '--app-tab-max': large ? '600px' : '560px',
      '--app-sheet-max': large ? '560px' : '520px',
      '--app-space-page': large ? '28px' : '24px',
      '--app-page-inset': large ? '28px' : '24px',
      '--app-type-large-title': large ? '38px' : '36px',
      '--app-btn-height': '48px',
      '--app-btn-height-sheet': '48px',
      '--app-auth-max': '440px',
      '--app-cal-max': large ? '600px' : '520px',
      '--app-cal-cell': large ? '52px' : '48px',
    }
  }
  // phone：与 App.vue 默认 rpx 设计稿对齐，但 inline 必须写 px
  return {
    '--app-content-max': '100%',
    '--app-tab-max': '100%',
    '--app-sheet-max': '100%',
    '--app-space-page': rpxToPx(32, width),
    '--app-page-inset': rpxToPx(32, width),
    '--app-type-large-title': rpxToPx(68, width),
    '--app-btn-height': rpxToPx(88, width),
    '--app-btn-height-sheet': rpxToPx(84, width),
    '--app-auth-max': '480px',
    '--app-cal-max': '100%',
    '--app-cal-cell': 'none',
  }
}

function applyVarsToEl(el, vars) {
  if (!el || !el.style) return
  Object.keys(vars).forEach((key) => {
    el.style.setProperty(key, vars[key])
  })
}

function deviceRoots() {
  if (typeof document === 'undefined') return []
  return [
    document.documentElement,
    document.body,
    document.querySelector('uni-page-body'),
    document.querySelector('uni-app'),
    document.getElementById('app'),
  ].filter(Boolean)
}

/** 生成当前设备信息快照。 */
export function getDeviceSnapshot() {
  const meta = detectPlatform()
  const width = getWindowWidth()
  const form = resolveFormFactor(width, meta)
  return {
    form,
    width,
    ...meta,
    isPhone: form === 'phone',
    isTablet: form === 'tablet',
    isDesktop: form === 'desktop',
  }
}

/** 将设备信息与布局变量应用到页面。 */
export function applyDeviceToDom(snapshot = getDeviceSnapshot()) {
  const vars = layoutVarsFor(snapshot.form, snapshot.width)
  try {
    if (typeof document === 'undefined') return snapshot
    deviceRoots().forEach((el) => {
      el.setAttribute('data-form', snapshot.form)
      el.setAttribute('data-os', snapshot.os)
      el.setAttribute('data-platform', snapshot.platform)
      el.setAttribute('data-pad', snapshot.isPadUa ? '1' : '0')
      el.classList.toggle('device-phone', snapshot.form === 'phone')
      el.classList.toggle('device-tablet', snapshot.form === 'tablet')
      el.classList.toggle('device-desktop', snapshot.form === 'desktop')
      el.classList.toggle('device-pad', !!snapshot.isPadUa)
      el.classList.toggle('os-ios', snapshot.isIOS)
      el.classList.toggle('os-android', snapshot.isAndroid)
      applyVarsToEl(el, vars)
    })
  } catch {
    // ignore
  }
  return snapshot
}

let lastForm = ''
let lastWidthBucket = -1

/** 刷新设备布局状态。 */
export function syncDeviceLayout() {
  const snap = applyDeviceToDom()
  const bucket = Math.round(snap.width / 40)
  if (snap.form !== lastForm || bucket !== lastWidthBucket) {
    lastForm = snap.form
    lastWidthBucket = bucket
    deviceVersion.value += 1
  }
  return snap
}

/** 启动窗口变化监听。 */
export function startDeviceWatch() {
  if (watching) return
  watching = true
  // #ifdef H5
  if (typeof window !== 'undefined') {
    let timer = null
    const onResize = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => syncDeviceLayout(), 80)
    }
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onResize, { passive: true })
  }
  // #endif
}
