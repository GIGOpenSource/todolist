/**
 * @file useAuth.js
 * @description 登录态工具：判断是否登录、强制跳转、读取当前用户 ID。
 * 不持有响应式状态；页面在 onMounted / 提交前调用即可。
 * @depends storage.js、device.js（re-export getDeviceId）
 */

import { getToken } from "@/utils/storage";

/** 设备 ID 从 device 再导出，方便页面一次性从 useAuth 引入 */
export { getDeviceId } from "@/utils/device";

/**
 * 是否已登录（以本地 todolist_token 为准）
 * @returns {boolean}
 */
export function isLoggedIn() {
  return Boolean(getToken());
}

/**
 * 要求已登录；否则 reLaunch 到登录页。
 * @returns {boolean} true=已登录可继续；false=已跳转
 */
export function requireAuth() {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: "/pages/login/login" });
    return false;
  }
  return true;
}

/**
 * 已登录则离开登录/注册页，进入首页（防重复登录）
 */
export function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    uni.switchTab({ url: "/pages/todos/todos" });
  }
}

/**
 * 从 user_info JSON 读取用户数字 ID
 * @returns {number|string|null}
 */
export function getCurrentUserId() {
  const infoStr = getItem("user_info");
  if (!infoStr) return null;
  try {
    const info = JSON.parse(infoStr);
    return info.id ?? null;
  } catch {
    return null;
  }
}
