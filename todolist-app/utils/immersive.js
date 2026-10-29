/**
 * 移动端沉浸式界面适配：同步状态栏高度、颜色与页面变量。
 */

export function getStatusBarHeight() {
  try {
    const h = Number(uni.getSystemInfoSync().statusBarHeight)
    // App 真机一般 20~59；异常时给兜底，避免内容顶进
    if (h > 0) return h
  } catch {
    // ignore
  }
  // #ifdef APP-PLUS
  return 44
  // #endif
  // #ifndef APP-PLUS
  return 0
  // #endif
}

/** 把真实状态栏高度写入 CSS 变量，打包后比仅依赖默认注入更稳 */
export function ensureStatusBarCssVar() {
  const h = getStatusBarHeight()
  const value = `${h}px`
  try {
    // H5 / App WebView
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.setProperty('--status-bar-height', value)
      document.documentElement.style.setProperty('--app-status-bar-height', value)
    }
  } catch {
    // ignore
  }
  return h
}

/** 应用沉浸式状态栏外观。 */
export function applyImmersiveStatusBar(frontDark = true) {
  ensureStatusBarCssVar()

  // #ifdef APP-PLUS
  try {
    // eslint-disable-next-line no-undef
    plus.navigator.setStatusBarBackground('#00000000')
    // eslint-disable-next-line no-undef
    plus.navigator.setStatusBarStyle(frontDark ? 'dark' : 'light')
  } catch (e) {
    // ignore
  }
  // #endif

  const frontColor = frontDark ? '#000000' : '#ffffff'
  const backgroundColor = '#00000000'
  const applyWithRetry = (attempt = 0) => {
    uni.setNavigationBarColor({
      frontColor,
      backgroundColor,
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('page not found') && attempt < 3) {
          setTimeout(() => applyWithRetry(attempt + 1), 150)
        }
      },
    })
  }
  try {
    applyWithRetry()
  } catch {
    // H5 / 部分端可能不支持，忽略
  }
}
