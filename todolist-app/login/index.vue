<script setup>
/**
 * @file pages/login — 登录页（公开路由）
 * @description 邮箱/用户名 + 密码登录；使用 rawFetch 避免 401 跳转死循环。
 * @depends rawFetch、storage、useAuth.redirectIfLoggedIn
 */
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { login as apiLogin } from "@/api/index";
import { setToken, setUsername, setRefreshToken } from "@/utils/storage";
import { redirectIfLoggedIn } from "@/composables/useAuth";
import { bindAnalyticsTap } from "@/utils/analytics";

const { t } = useI18n();
redirectIfLoggedIn();

// ——— 表单状态 ———
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const emailError = ref("");
const passwordError = ref("");
const emailTouched = ref(false);
const passwordTouched = ref(false);
const loading = ref(false);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 邮箱校验 */
function validateEmail() {
  const trimEmail = email.value.trim();
  if (!emailTouched.value) return;
  if (!trimEmail) {
    emailError.value = t("login.errorEmailEmpty");
  } else if (!EMAIL_REGEX.test(trimEmail)) {
    emailError.value = t("login.errorEmailFormat");
  } else {
    emailError.value = "";
  }
}

/** 密码校验 */
function validatePassword() {
  if (!passwordTouched.value) return;
  if (!password.value) {
    passwordError.value = t("login.errorPwdEmpty");
  } else {
    passwordError.value = "";
  }
}

// 监听输入变化进行实时校验
watch(email, validateEmail);
watch(password, validatePassword);

/** 提交登录：成功写 token/user_info 并进首页 */
async function handleLogin() {
  // 标记所有字段已触摸，触发校验
  emailTouched.value = true;
  passwordTouched.value = true;
  
  emailError.value = "";
  passwordError.value = "";
  const trimEmail = email.value.trim();
  let hasError = false;
  
    if (!trimEmail) {
      emailError.value = t("login.errorEmailEmpty");
      hasError = true;
    } else if (!EMAIL_REGEX.test(trimEmail)) {
      emailError.value = t("login.errorEmailFormat");
      hasError = true;
    }
    
    if (!password.value) {
      passwordError.value = t("login.errorPwdEmpty");
      hasError = true;
    }
    
    if (hasError) {
      return;
    }
  loading.value = true;
  try {
    console.log("[login] 开始登录...");
    console.log("[login] 当前页面路径:", getCurrentPages().map(p => p.route));
    const result = await apiLogin(trimEmail, password.value);
    console.log("[login] API result:", JSON.stringify(result));
    // api.login 已经处理了响应解析，成功时返回用户数据
    const token = result.access_token || result.token || "";
    const username = result.username || trimEmail;
    const refreshToken = result.refresh_token || "";
    console.log("[login] token:", token ? "存在" : "空");
    console.log("[login] username:", username);
    // 使用正确的存储函数
    setToken(token);
    setUsername(username);
    if (refreshToken) setRefreshToken(refreshToken);
    console.log("[login] 存储完成，准备跳转...");
    console.log("[login] 当前token:", uni.getStorageSync("todolist_token") ? "已存储" : "未存储");
    console.log("[login] 当前username:", uni.getStorageSync("todolist_username"));

    // 使用 reLaunch 跳转（自定义 tabBar 下 switchTab 可能有问题）
    console.log("[login] 使用 uni.reLaunch 跳转...");
    uni.reLaunch({
      url: "/pages/todos/todos",
      success: (res) => {
        console.log("[login] reLaunch success:", res);
      },
      fail: (err) => {
        console.error("[login] reLaunch fail:", err);
      }
    });
  } catch (err) {
    console.error("[login] error:", err);
    passwordError.value = err.message || t("login.errorFailed");
  } finally {
    loading.value = false;
  }
}

function goRegister() {
  uni.navigateTo({ url: "/pages/register/index" });
}
</script>

<template>
  <view class="login-page">
    <view class="login-inner">
      <view class="logo-wrap">
        <view class="logo-circle">
          <image src="/static/common/logo.svg"></image>
        </view>
        <text class="login-title">{{ t("home.title") }}</text>
        <text class="text-muted" style="margin-top: 20rpx;display: block;">{{ t("login.subtitle") }}</text>
      </view>

      <view class="input-group">
        <input
          v-model="email"
          class="input-field"
          :placeholder="t('login.username')"
          @focus="emailTouched = true"
        />
        <text v-if="emailError" class="error-text">{{ emailError }}</text>
      </view>
      <view class="input-group">
        <view class="password-wrap">
          <input
            v-model="password"
            class="input-field"
            :password="!showPassword"
            :placeholder="t('login.password')"
            @focus="passwordTouched = true"
          />
         <view class="eye-btn" @tap="showPassword = !showPassword">
           <image v-if="showPassword" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E" style="width: 40rpx; height: 40rpx;" />
           <image v-else src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/%3E%3Cline x1='1' y1='1' x2='23' y2='23'/%3E%3C/svg%3E" style="width: 40rpx; height: 40rpx;" />
         </view>
        </view>
        <text v-if="passwordError" class="error-text">{{ passwordError }}</text>
      </view>

      <button
        class="login-btn w-full mt-md"
        :disabled="loading"
        @tap="bindAnalyticsTap('login-submit', handleLogin, '登录')"
      >
        {{ loading ? t("login.loggingIn") : t("login.loginBtn") }}
      </button>

      <view
        class="register-link mt-md"
        @tap="bindAnalyticsTap('login-to-register', goRegister, '去注册')"
      >
        <text class="text-muted">{{ t("login.noAccount") }}</text>
        <text class="text-primary">{{ t("login.registerBtn") }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: calc(env(safe-area-inset-top) + 48rpx) 48rpx 64rpx;
  box-sizing: border-box;
  background: var(--bg);
}
.login-inner { width: 100%; max-width: 640rpx; }
.logo-wrap { text-align: center; margin-bottom: 64rpx; }
.logo-circle {
  width: 240rpx; height: 240rpx; margin: 0 auto 24rpx;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 64rpx; color: #fff;
  // background: var(--gradient-brand);
  image{
    width: 100%;
    height: 100%;
  }
}
.login-title { display: block; font-size: 48rpx; font-weight: 600; margin-bottom: 8rpx; color: var(--fg); }
.error-text { color: var(--destructive); font-size: 24rpx; margin-top: 8rpx; line-height: 1.4; }
.input-group { margin-top: 32rpx; }
.password-wrap { position: relative; }
.eye-btn {
  position: absolute;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  padding: 8rpx;
  color: var(--fg-muted);
}
.register-link { text-align: center; font-size: 26rpx; margin-top: 48rpx; }
.login-btn {
  width: 100%;
  height: 100rpx;
  border-radius: 25rpx;
  // background: var(--gradient-brand);
  background: linear-gradient(139.53deg, #FFF946 21.98%, #E747A4 113.24%);
  color: #000;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
</style>
