/**
 * 滚动边缘效果：检测滚动位置并维护边缘模糊状态。
 */

const TOP_THRESHOLD = 10

let topOn = false
let listening = false

function rootEl() {
  if (typeof document === 'undefined') return null
  return document.documentElement
}

function apply() {
  const root = rootEl()
  if (!root) return
  root.dataset.edgeTop = topOn ? '1' : '0'
}

/** 重置滚动边缘状态。 */
export function resetScrollEdges() {
  if (!topOn) {
    apply()
    return
  }
  topOn = false
  apply()
}

/** 根据滚动位置更新边缘状态。 */
export function updateScrollEdges({ scrollTop = 0 } = {}) {
  const next = Number(scrollTop) > TOP_THRESHOLD
  if (next === topOn) return
  topOn = next
  apply()
}

/** 处理滚动容器的边缘状态。 */
export function onScrollViewEdge(e) {
  updateScrollEdges({ scrollTop: e?.detail?.scrollTop || 0 })
}

/** 处理页面滚动的边缘状态。 */
export function onPageScrollEdge(e) {
  updateScrollEdges({ scrollTop: e?.scrollTop || 0 })
}

/** 进入页面时：按当前滚动位置恢复顶部模糊（未滚动则为关） */
export function resyncScrollEdges() {
  if (typeof document === 'undefined') {
    resetScrollEdges()
    return
  }
  const pageTop =
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  if (pageTop > TOP_THRESHOLD) {
    updateScrollEdges({ scrollTop: pageTop })
    return
  }
  const nodes = document.querySelectorAll(
    '.list-scroll, .page-scroll, .stats-scroll, .profile-scroll, uni-scroll-view .uni-scroll-view, .uni-scroll-view'
  )
  for (const n of nodes) {
    if (n && typeof n.scrollTop === 'number' && n.scrollTop > TOP_THRESHOLD) {
      updateScrollEdges({ scrollTop: n.scrollTop })
      return
    }
  }
  resetScrollEdges()
}

function isIgnoredScrollTarget(el) {
  if (!el || el === document || el === document.documentElement || el === document.body) {
    return false
  }
  if (typeof el.closest !== 'function') return false
  return !!(
    el.closest('.sheet') ||
    el.closest('.sheet-mask') ||
    el.closest('.sheet-panel') ||
    el.closest('.poster-modal') ||
    el.closest('.poster-sheet') ||
    el.closest('.locale-list')
  )
}

function onCaptureScroll(e) {
  const el = e.target
  if (isIgnoredScrollTarget(el)) return

  if (el === document || el === document.documentElement || el === document.body) {
    const top =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    updateScrollEdges({ scrollTop: top })
    return
  }

  if (el && typeof el.scrollTop === 'number') {
    updateScrollEdges({ scrollTop: el.scrollTop })
  }
}

/** 启动滚动边缘模糊监听。 */
export function startScrollEdgeBlur() {
  apply()
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener('scroll', onCaptureScroll, { capture: true, passive: true })
}
