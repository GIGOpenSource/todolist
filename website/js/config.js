/**
 * Upgrade 官网配置 — 上线前改 loginUrl 与各端下载链接，或由后台 CMS 覆盖。
 * 非本机访问时：apiBaseUrl 默认同源（走反代 /api）；loginUrl 需 CMS 或下方填写。
 */
;(function () {
  var host = typeof location !== 'undefined' ? location.hostname : ''
  var isLocal = host === '127.0.0.1' || host === 'localhost'
  var override = (typeof window !== 'undefined' && window.UPGRADE_SITE_OVERRIDE) || {}

  window.UPGRADE_SITE = {
    brand: 'Upgrade',
    contactEmail: 'you@example.com',
    /** H5 网页端登录页（PC Vue，部署路径 /h5/） */
    loginUrl: isLocal ? 'http://127.0.0.1:5180/h5/login' : '/h5/login',
    /** 登录后「进入项目」跳转的产品入口 */
    appUrl: isLocal ? 'http://127.0.0.1:5180/h5/' : '/h5/',
    /**
     * Backend for CMS + visit analytics.
     * Local: direct API. Production: empty = same-origin `/api/...` (nginx reverse proxy).
     */
    apiBaseUrl: isLocal ? 'http://127.0.0.1:8000' : '',
    downloads: {
      androidPhone: { id: 'androidPhone', url: '', ready: false },
      androidPad: { id: 'androidPad', url: '', ready: false },
      iosPhone: { id: 'iosPhone', url: '', ready: false },
      iosPad: { id: 'iosPad', url: '', ready: false },
    },
    shots: [
      { src: './assets/shots/tasks.svg', key: 0 },
      { src: './assets/shots/calendar.svg', key: 1 },
      { src: './assets/shots/stats.svg', key: 2 },
    ],
  }

  // Optional runtime override (inject before this script, or set on window)
  if (override && typeof override === 'object') {
    var keys = Object.keys(override)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (override[k] != null) window.UPGRADE_SITE[k] = override[k]
    }
  }
})()
