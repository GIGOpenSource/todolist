/**
 * 弹窗锁定工具：在弹窗开启时控制页面滚动。
 */

import { watch, onUnmounted } from 'vue'

let lockCount = 0

function applyBodyLock(locked) {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('modal-open', locked)
}

/** 在弹窗开启时锁定页面滚动。 */
export function useModalLock(isOpen) {
  const stop = watch(
    isOpen,
    (open) => {
      if (open) {
        lockCount += 1
        applyBodyLock(true)
      } else if (lockCount > 0) {
        lockCount -= 1
        if (lockCount === 0) applyBodyLock(false)
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    stop()
    if (isOpen.value && lockCount > 0) {
      lockCount -= 1
      if (lockCount === 0) applyBodyLock(false)
    }
  })
}
