/**
 * 管理后台入口：注册路由并挂载应用。
 */

import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { setUnauthorizedHandler } from './api/client.js'
import { getToken } from './stores/storage.js'
import { ensurePermissionCatalog } from './utils/permissions.js'
import './styles/base.css'
import './styles/shell.css'

setUnauthorizedHandler(() => {
  router.replace({ name: 'login' })
})

if (getToken()) {
  ensurePermissionCatalog().catch(() => {})
}

createApp(App).use(router).mount('#app')
