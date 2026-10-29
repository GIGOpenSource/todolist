/**
 * UNIApp 入口：创建 SSR/应用实例。
 */

import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  return { app }
}
