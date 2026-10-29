/**
 * 品牌资源配置：导出客户端统一使用的品牌标识。
 */

function resolveStaticLogo() {
  try {
    const base =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/'
    // H5 base is `/app/` → `/app/static/logo.png`; App/native stays `/static/logo.png`
    return `${base}static/logo.png`.replace(/([^:]\/)\/+/g, '$1')
  } catch {
    return '/static/logo.png'
  }
}

export const BRAND_LOGO = resolveStaticLogo()

/** App 包内 logo 的候选本地路径。 */
export function nativeLogoPaths() {
  const paths = ['_www/static/logo.png', 'static/logo.png']
  if (typeof plus !== 'undefined' && plus.io && typeof plus.io.convertLocalFileSystemURL === 'function') {
    try {
      const abs = plus.io.convertLocalFileSystemURL('_www/static/logo.png')
      if (abs) paths.unshift(abs)
    } catch (_) {
      /* ignore */
    }
  }
  return paths
}

/**
 * App 逻辑层把包内 logo 读成 PNG dataURL，供海报渲染（html2canvas 无法加载 /static 路径）。
 */
export function loadNativeLogoDataUrl() {
  return new Promise((resolve) => {
    if (typeof plus === 'undefined' || !plus.nativeObj || typeof plus.nativeObj.Bitmap !== 'function') {
      resolve('')
      return
    }
    const bitmap = new plus.nativeObj.Bitmap(`brand_logo_${Date.now()}`)
    const done = (ok) => {
      if (!ok) {
        try {
          bitmap.clear()
        } catch (_) {
          /* ignore */
        }
        resolve('')
        return
      }
      try {
        let data = bitmap.toBase64Data()
        bitmap.clear()
        if (data && !String(data).startsWith('data:')) {
          data = `data:image/png;base64,${data}`
        }
        resolve(data || '')
      } catch (_) {
        try {
          bitmap.clear()
        } catch (__) {
          /* ignore */
        }
        resolve('')
      }
    }
    const paths = nativeLogoPaths()
    const tryLoad = (i) => {
      if (i >= paths.length) {
        done(false)
        return
      }
      bitmap.load(
        paths[i],
        () => done(true),
        () => tryLoad(i + 1)
      )
    }
    tryLoad(0)
  })
}
