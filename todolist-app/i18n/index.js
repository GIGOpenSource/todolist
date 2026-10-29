/**
 * @file i18n/index.js
 * @description vue-i18n 实例：7 语言文案 + 语言检测/切换持久化。
 * 文案键结构：locales/*.json，页面内 t('namespace.key')。
 * 存储键兼容 React：i18nextLng、ui_language。
 */
import { createI18n } from "vue-i18n";
import { getItem, setItem } from "@/utils/storage";
import zh from "./locales/zh.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import pt from "./locales/pt.json";
import es from "./locales/es.json";
import id from "./locales/id.json";

/** 产品支持的 UI 语言码（与 locales 文件一一对应） */
const supportedLngs = ["zh", "en", "ja", "ko", "pt", "es", "id"];

/**
 * 检测初始语言：本地偏好 → 系统语言 → 默认 en
 * @returns {string}
 */
function detectLanguage() {
  const saved = getItem("i18nextLng") || getItem("ui_language");
  if (saved && supportedLngs.includes(saved)) {
    console.log("[i18n] 使用已保存语言:", saved);
    return saved;
  }
  try {
    const sysInfo = uni.getSystemInfoSync();
    const sysLang = sysInfo?.language || "";
    console.log("[i18n] 获取到系统语言:", sysLang);
    const lang = sysLang.slice(0, 2);
    if (supportedLngs.includes(lang)) return lang;
  } catch (e) {
    console.log("[i18n] 获取系统语言失败:", e);
  }
  console.log("[i18n] 无匹配语言，回退到默认 en");
  return "en";
}53

/**
 * 全局 i18n 实例（Composition API：legacy: false）
 * vue-i18n 的 messages 直接挂 locale → 文案树；页面用 t('login.title')。
 * （React i18next 用 translation 命名空间；此处不要再包一层 translation，否则键全失效。）
 */
export const i18n = createI18n({
  legacy: false,
  locale: detectLanguage(),
  fallbackLocale: "en",
  messages: {
    zh,
    en,
    ja,
    ko,
    pt,
    es,
    id,
  },
});

/**
 * 切换界面语言并持久化（同时写 i18nextLng / ui_language）
 * @param {string} lng
 */
export function setAppLanguage(lng) {
  const key = supportedLngs.includes(lng) ? lng : "en";
  i18n.global.locale.value = key;
  setItem("i18nextLng", key);
  setItem("ui_language", key);
}

export default i18n;
