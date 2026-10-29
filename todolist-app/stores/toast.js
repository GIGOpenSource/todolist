/**
 * @file toast.js
 * @description 全局轻提示：Pinia 状态 + uni.showToast 双写。
 * api.js 通过导出的 showToast() 调用，页面也可直接 import。
 */
import { defineStore } from "pinia";
import { ref } from "vue";

/** Pinia store：可在模板中绑定 message 做自定义 Toast UI */
export const useToastStore = defineStore("toast", () => {
  const message = ref("");
  let timer = null;

  /**
   * 展示提示
   * @param {string} text
   * @param {number} [duration=2500]
   */
  function showToast(text, duration = 2500) {
    message.value = text;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      message.value = "";
      timer = null;
    }, duration);
    uni.showToast({ title: text, icon: "none", duration });
  }

  return { message, showToast };
});

/**
 * 非组件上下文便捷调用（utils/api.js 等）
 * @param {string} text
 */
export function showToast(text) {
  useToastStore().showToast(text);
}
