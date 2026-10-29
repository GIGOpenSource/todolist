/**
 * 提示消息工具：统一创建与展示轻量提示。
 */

import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
let timer = null

/** 展示轻量提示消息。 */
export function toast(msg, ms = 2200) {
  message.value = String(msg || '')
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
  }, ms)
}

/** 创建可复用的提示消息状态。 */
export function useToast() {
  return { visible, message, toast }
}
