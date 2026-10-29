/**
 * 折叠标题工具：根据滚动位置计算标题过渡状态。
 */

/** Compact title starts as the large title line is leaving the viewport. */
export const TITLE_COLLAPSE_START = 28

/** Fully collapsed — roughly one large-title line + padding. */
export const TITLE_COLLAPSE_END = 56

/** 计算大标题的折叠进度。 */
export function collapsingProgress(
  scrollTop = 0,
  { start = TITLE_COLLAPSE_START, end = TITLE_COLLAPSE_END } = {}
) {
  const y = Number(scrollTop) || 0
  const span = end - start
  if (span <= 0) return y > start ? 1 : 0
  const t = (y - start) / span
  if (t <= 0) return 0
  if (t >= 1) return 1
  // Ease-out — snappy like Telegram
  return 1 - (1 - t) * (1 - t)
}

/** 从滚动事件读取垂直偏移。 */
export function scrollTopFromEvent(e) {
  if (!e) return 0
  if (typeof e.scrollTop === 'number') return e.scrollTop
  if (e.detail && typeof e.detail.scrollTop === 'number') return e.detail.scrollTop
  return 0
}

/** 读取当前页面的滚动偏移。 */
export function readActiveScrollTop() {
  if (typeof document === 'undefined') return 0
  const pageTop =
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  if (pageTop > 0) return pageTop
  const nodes = document.querySelectorAll(
    '.list-scroll, .page-scroll, .stats-scroll, .profile-scroll, uni-scroll-view .uni-scroll-view, .uni-scroll-view'
  )
  for (const n of nodes) {
    if (n && typeof n.scrollTop === 'number' && n.scrollTop > 0) return n.scrollTop
  }
  return 0
}
