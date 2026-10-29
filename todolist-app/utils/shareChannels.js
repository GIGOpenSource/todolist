/**
 * 海报分享工具：转换图片数据并适配各端分享渠道。
 */

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl || '').split(',')
  if (parts.length < 2) throw new Error('invalid image')
  const mimeMatch = parts[0].match(/:(.*?);/)
  const mime = (mimeMatch && mimeMatch[1]) || 'image/png'
  const binary = atob(parts[1])
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** 将图片数据转换为文件对象。 */
export function dataUrlToFile(dataUrl, filename = 'poster.png') {
  const blob = dataUrlToBlob(dataUrl)
  const name = filename.endsWith('.png') || filename.endsWith('.jpg') ? filename : `${filename}.png`
  try {
    return new File([blob], name, { type: blob.type || 'image/png' })
  } catch {
    // Older WebViews may lack File ctor; Blob still works for some share paths.
    blob.name = name
    return blob
  }
}

/** 下载图片数据。 */
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename || 'poster.png'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function tryNativeShare({ title, text, url, file }) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return { ok: false, reason: 'unsupported' }
  }
  const payload = {}
  if (title) payload.title = title
  if (text) payload.text = text
  if (url) payload.url = url

  if (file && navigator.canShare) {
    const files = [file]
    try {
      if (navigator.canShare({ files })) {
        await navigator.share({ ...payload, files })
        return { ok: true, method: 'files' }
      }
    } catch (e) {
      if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) {
        return { ok: false, reason: 'cancelled' }
      }
      // fall through to text/url share
    }
  }

  try {
    await navigator.share(payload)
    return { ok: true, method: 'text' }
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) {
      return { ok: false, reason: 'cancelled' }
    }
    return { ok: false, reason: 'failed', error: e }
  }
}

function openExternal(url) {
  if (typeof window === 'undefined' || !url) return
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** 将海报分享到指定渠道。 */
export async function sharePosterToChannel(channel, opts = {}) {
  const dataUrl = opts.dataUrl
  if (!dataUrl) return { ok: false, reason: 'empty' }

  const filename = opts.filename || 'upgrade-poster.png'
  const title = opts.title || 'Upgrade'
  const text = opts.text || ''
  const pageUrl = opts.pageUrl || (typeof location !== 'undefined' ? location.href : '')

  let file = null
  try {
    file = dataUrlToFile(dataUrl, filename)
  } catch (_) {
    file = null
  }

  const native = await tryNativeShare({ title, text, url: pageUrl, file })
  if (native.ok) return native
  if (native.reason === 'cancelled') return native

  // Fallbacks when Web Share is unavailable or rejected.
  downloadDataUrl(dataUrl, filename)

  if (channel === 'facebook') {
    const sharer = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl || 'https://www.facebook.com/')}`
    openExternal(sharer)
    return { ok: true, method: 'facebook-sharer' }
  }

  if (channel === 'instagram') {
    // No reliable web image upload URL; deep-link opens app when installed (mobile).
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
    if (/iPhone|iPad|iPod|Android/i.test(ua)) {
      openExternal('instagram://app')
    }
    return { ok: true, method: 'instagram-app' }
  }

  return { ok: true, method: 'download' }
}
