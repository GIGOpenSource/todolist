import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs'

const isApp = process.env.UNI_PLATFORM === 'app-plus' || process.env.UNI_PLATFORM === 'app'

/** 旧路径 /h5 → /app，避免书签失效 */
function redirectLegacyH5Path() {
  return {
    name: 'redirect-legacy-h5-path',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url || '/'
        const pathOnly = raw.split('?')[0]
        if (pathOnly === '/h5' || pathOnly.startsWith('/h5/')) {
          const q = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
          const rest =
            pathOnly === '/h5' || pathOnly === '/h5/' ? '/' : pathOnly.slice('/h5'.length)
          res.statusCode = 302
          res.setHeader('Location', `/app${rest.startsWith('/') ? rest : `/${rest}`}${q}`)
          res.end()
          return
        }
        next()
      })
    },
  }
}

/** 复制 static 目录到 dist */
function copyStaticPlugin() {
  return {
    name: 'copy-static',
    closeBundle() {
      const srcDir = resolve(__dirname, 'static')
      const destDir = resolve(__dirname, 'dist/build/h5/static')
      if (!existsSync(srcDir)) return

      function copyDir(src, dest) {
        if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
        for (const file of readdirSync(src)) {
          const srcPath = resolve(src, file)
          const destPath = resolve(dest, file)
          if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath)
          } else {
            copyFileSync(srcPath, destPath)
          }
        }
      }

      copyDir(srcDir, destDir)
      console.log('✅ Copied static assets to dist/build/h5/static')
    }
  }
}

export default defineConfig({
  plugins: [uni(), redirectLegacyH5Path(), copyStaticPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: isApp
    ? {
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      }
    : {},
})
