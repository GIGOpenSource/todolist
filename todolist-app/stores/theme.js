/**
 * @file theme.js
 * @description 明/暗主题。H5 写 data-theme 到 documentElement；App 依赖 CSS 变量。
 * 本地键：theme = "dark" | "light"
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getItem, setItem } from "@/utils/storage";

/** 主题 Store：初始化时 applyTheme，切换时持久化 */
export const useThemeStore = defineStore("theme", () => {
  const theme = ref(getItem("theme") || "dark");

  /** 将当前 theme 同步到 DOM；同时写 data-theme 与 .dark，对齐 React */
  function applyTheme() {
    // 仅在 H5 环境操作 DOM，APP/小程序环境不支持 document
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute("data-theme", theme.value);
      document.documentElement.classList.toggle("dark", theme.value === "dark");
    }
  }

  /** 在 dark / light 间切换并写入本地 */
  function toggleTheme() {
    theme.value = theme.value === "dark" ? "light" : "dark";
    setItem("theme", theme.value);
    applyTheme();
  }

  const isDark = computed(() => theme.value === "dark");

  applyTheme();

  return { theme, isDark, toggleTheme, applyTheme };
});