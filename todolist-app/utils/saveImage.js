/**
 * 跨端保存 / 分享海报：H5 触发下载，App 写入相册或调起系统分享。
 */

import { t } from './i18n.js'
import { downloadDataUrl } from './shareChannels.js'

function toLocalUrl(path) {
  if (typeof plus !== 'undefined' && plus.io && typeof plus.io.convertLocalFileSystemURL === 'function') {
    try {
      const url = plus.io.convertLocalFileSystemURL(path)
      if (url) return url
    } catch (_) {
      /* keep original */
    }
  }
  return path
}

function hasPlusBitmap() {
  return typeof plus !== 'undefined' && plus.nativeObj && typeof plus.nativeObj.Bitmap === 'function'
}

function isAuthDenied(err) {
  const msg = String((err && (err.errMsg || err.message)) || err || '')
  return /auth|deny|denied|permission|权限/i.test(msg)
}

/** 将 dataURL 写成 App 本地 png，返回可供相册 / 分享使用的路径。 */
export function writeDataUrlToTempFile(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!hasPlusBitmap()) {
      reject(new Error(t('report.posterErrorH5')))
      return
    }
    const bitmap = new plus.nativeObj.Bitmap(`poster_${Date.now()}`)
    bitmap.loadBase64Data(
      dataUrl,
      () => {
        const filePath = `_doc/upgrade_poster_${Date.now()}.png`
        bitmap.save(
          filePath,
          { overwrite: true, quality: 100 },
          (res) => {
            bitmap.clear()
            resolve(toLocalUrl(res.target || filePath))
          },
          (err) => {
            bitmap.clear()
            reject(err)
          }
        )
      },
      (err) => {
        bitmap.clear()
        reject(err)
      }
    )
  })
}

function saveLocalToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve({ ok: true, method: 'album' }),
      fail: (err) => reject(err),
    })
  })
}

function promptAlbumPermission() {
  return new Promise((resolve) => {
    uni.showModal({
      title: t('report.posterNeedAlbumTitle'),
      content: t('report.posterNeedAlbum'),
      confirmText: t('report.posterOpenSetting'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (res.confirm) uni.openSetting({})
        resolve()
      },
      fail: () => resolve(),
    })
  })
}

/**
 * 保存海报：App 写入系统相册，H5 下载 png。
 */
export async function saveDataUrlToDevice(dataUrl, filename) {
  if (!dataUrl) throw new Error(t('report.saveFailed'))

  if (hasPlusBitmap()) {
    try {
      const path = await writeDataUrlToTempFile(dataUrl)
      return await saveLocalToAlbum(path)
    } catch (err) {
      if (isAuthDenied(err)) await promptAlbumPermission()
      throw err
    }
  }

  if (typeof document !== 'undefined') {
    downloadDataUrl(dataUrl, filename)
    return { ok: true, method: 'download' }
  }

  throw new Error(t('report.posterErrorH5'))
}

/**
 * App 调起系统分享面板；H5 不可用时返回 unsupported。
 */
export async function shareDataUrlWithSystem(dataUrl, opts = {}) {
  if (!dataUrl) return { ok: false, reason: 'empty' }
  if (!hasPlusBitmap()) return { ok: false, reason: 'unsupported' }

  const path = await writeDataUrlToTempFile(dataUrl)
  const summary = opts.text || opts.title || ''

  return new Promise((resolve) => {
    const fail = () => resolve({ ok: false, reason: 'failed' })
    if (typeof uni.shareWithSystem === 'function') {
      uni.shareWithSystem({
        summary,
        imageUrl: path,
        success: () => resolve({ ok: true, method: 'system' }),
        fail,
      })
      return
    }
    if (typeof plus !== 'undefined' && plus.share && typeof plus.share.sendWithSystem === 'function') {
      plus.share.sendWithSystem(
        { type: 'image', pictures: [path], content: summary, title: opts.title || '' },
        () => resolve({ ok: true, method: 'system' }),
        fail
      )
      return
    }
    resolve({ ok: false, reason: 'unsupported' })
  })
}
