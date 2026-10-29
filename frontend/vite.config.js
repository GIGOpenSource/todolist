import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/** 旧路径 /app → /h5，避免书签失效 */
function redirectLegacyAppPath() {
  return {
    name: 'redirect-legacy-app-path',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url || '/'
        const pathOnly = raw.split('?')[0]
        if (pathOnly === '/app' || pathOnly.startsWith('/app/')) {
          const q = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
          const rest =
            pathOnly === '/app' || pathOnly === '/app/' ? '/' : pathOnly.slice('/app'.length)
          res.statusCode = 302
          res.setHeader('Location', `/h5${rest.startsWith('/') ? rest : `/${rest}`}${q}`)
          res.end()
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  base: '/h5/',
  plugins: [vue(), redirectLegacyAppPath()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    host: '127.0.0.1',
  },
})
