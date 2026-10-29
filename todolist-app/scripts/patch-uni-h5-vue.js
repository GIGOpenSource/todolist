/**
 * Patch @dcloudio/uni-h5-vue initSlots:
 *   def(children, "_", type[, true])
 * → Object.defineProperty(..., { writable: true, value: type })
 *
 * @vue/shared@3.4.21 的 def 只有 3 参，第 4 个 true 会被忽略，_ 仍为只读；
 * 随后渲染里 t._ = 1/2 就会抛
 *   TypeError: Cannot assign to read only property '_'
 * @see https://ask.dcloud.net.cn/question/211130
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', 'node_modules', '@dcloudio', 'uni-h5-vue')
if (!fs.existsSync(root)) {
  console.warn('[patch-uni-h5-vue] @dcloudio/uni-h5-vue not installed, skip')
  process.exit(0)
}

const REPLACEMENT =
  'Object.defineProperty(children, "_", { configurable: true, enumerable: false, writable: true, value: type })'

const patterns = [
  /shared\.def\(children,\s*"_"\s*,\s*type\s*(?:,\s*true)?\)/g,
  /(?<![\w.])def\(children,\s*"_"\s*,\s*type\s*(?:,\s*true)?\)/g,
]

const targets = [
  'dist/vue.runtime.esm.js',
  'dist/vue.runtime.cjs.js',
  'dist-x/vue.runtime.esm.js',
  'dist-x/vue.runtime.cjs.js',
  'dist-x-vapor/vue.runtime.esm.js',
  'dist-x-vapor/vue.runtime.cjs.js',
]

let patched = 0
for (const rel of targets) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) continue
  let src = fs.readFileSync(file, 'utf8')
  if (src.includes('writable: true, value: type }') && src.includes('Object.defineProperty(children, "_"')) {
    // already applied
    continue
  }
  let out = src
  for (const re of patterns) {
    out = out.replace(re, REPLACEMENT)
  }
  if (out !== src) {
    fs.writeFileSync(file, out)
    patched += 1
    console.log(`[patch-uni-h5-vue] patched ${rel}`)
  }
}

if (!patched) {
  console.log('[patch-uni-h5-vue] already patched or no matching sites')
} else {
  console.log(`[patch-uni-h5-vue] done (${patched} file(s))`)
}
