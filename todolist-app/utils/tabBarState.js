/**
 * 标签栏状态工具：记录并同步当前标签索引。
 */

let previousIndex = 0
let currentIndex = 0

/** 读取标签页索引配置。 */
export function getTabIndices() {
  return { previous: previousIndex, current: currentIndex }
}

/** 记录当前标签索引。 */
export function rememberTabIndex(index) {
  if (index === currentIndex) return
  previousIndex = currentIndex
  currentIndex = index
}

/** 同步标签栏选中状态。 */
export function syncTabIndex(index) {
  currentIndex = index
  previousIndex = index
}
