/**
 * 桌面网页端入口：初始化主题、路由并挂载应用。
 */

import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { initTheme } from './stores/theme.js'
import { setUnauthorizedHandler } from './api/client.js'
import { getToken } from './stores/storage.js'
import { startAutoSyncScheduler } from './stores/autoSync.js'
import {
  consumeSiteAuthHash,
  probeSiteSessionIntoH5,
  pushSessionToSite,
} from './utils/siteReturn.js'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/views.css'
import './styles/report-card.css'

initTheme()

setUnauthorizedHandler(() => {
  router.replace({ name: 'login' })
})

async function boot() {
  // Cross-origin site → H5 handoff (Enter app hash) before guards
  consumeSiteAuthHash()
  if (!getToken()) {
    await probeSiteSessionIntoH5()
  }

  const app = createApp(App)
  app.use(router)
  app.mount('#app')

  // Todos hydrate only via login / 4 AM auto sync / manual sync — not every boot.
  if (getToken()) {
    startAutoSyncScheduler()
    pushSessionToSite().catch(() => {})
  }
}

boot().catch(() => {
  const app = createApp(App)
  app.use(router)
  app.mount('#app')
})
