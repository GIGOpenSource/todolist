<script setup>
/**
 * 注册页：创建账号并进入初始会话。
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { register } from '../../api/index.js'
import { bindSession } from '../../utils/storage.js'
import { resetTodoCache, refreshTodosFromServer } from '../../utils/todoStore.js'
import { resetNoteCache, refreshNotesFromServer } from '../../utils/noteStore.js'
import { startAutoSyncScheduler } from '../../utils/autoSync.js'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion } from '../../utils/i18n.js'
import AuthBrand from '../../components/AuthBrand.vue'
import LocalePicker from '../../components/LocalePicker.vue'

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const agreed = ref(false)
const loading = ref(false)
const pageThemeClass = computed(() => themeClass())

const i18n = computed(() => {
  void localeVersion.value
  return {
    back: t('register.back'),
    brand: t('login.brand'),
    slogan: t('login.slogan'),
    sub: t('register.sub'),
    username: t('register.username'),
    password: t('register.password'),
    confirmPassword: t('register.confirmPassword'),
    usernamePh: t('register.usernamePh'),
    passwordPh: t('register.passwordPh'),
    confirmPh: t('register.confirmPh'),
    submit: t('register.submit'),
    submitting: t('register.submitting'),
    backLogin: t('register.backLogin'),
    agreePrefix: t('register.agreePrefix'),
    agreeAnd: t('register.agreeAnd'),
    needAgree: t('register.needAgree'),
  }
})

onShow(() => {
  syncPageChrome()
})

async function handleRegister() {
  const u = username.value.trim()
  const p = password.value
  const c = confirmPassword.value

  if (u.length < 3) {
    uni.showToast({ title: t('register.usernameShort'), icon: 'none' })
    return
  }
  if (p.length < 6) {
    uni.showToast({ title: t('register.passwordShort'), icon: 'none' })
    return
  }
  if (p !== c) {
    uni.showToast({ title: t('register.passwordMismatch'), icon: 'none' })
    return
  }
  if (!agreed.value) {
    uni.showToast({ title: t('register.needAgree'), icon: 'none' })
    return
  }

  loading.value = true
  try {
    const res = await register(u, p)
    bindSession(res.access_token, res.username, {
      nickname: res.nickname,
      avatar: res.avatar,
      signature: res.signature,
      gender: res.gender,
      refresh_token: res.refresh_token || '',
      user_id: res.user_id,
    })
    resetTodoCache()
    resetNoteCache()
    refreshTodosFromServer().catch(() => {})
    refreshNotesFromServer().catch(() => {})
    startAutoSyncScheduler()
    uni.showToast({ title: t('register.success'), icon: 'success' })
    setTimeout(() => {
      uni.switchTab({
        url: '/pages/todos/todos',
        fail: () => {
          if (typeof window !== 'undefined' && window.location) {
            const base = (import.meta.env.BASE_URL || '/app/').replace(/\/?$/, '/')
            window.location.replace(`${base}#/pages/todos/todos`)
          }
        },
      })
    }, 400)
  } catch (e) {
    uni.showToast({ title: e.message || t('register.failed'), icon: 'none' })
    loading.value = false
  }
}

function goLogin() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/login/login' }) })
}

function goPrivacy() {
  uni.navigateTo({ url: '/pages/legal/privacy' })
}

function goTerms() {
  uni.navigateTo({ url: '/pages/legal/terms' })
}
</script>

<template>
  <view class="page ios-page auth-page" :class="pageThemeClass">
    <view class="auth-ambient" aria-hidden="true">
      <view class="orb orb-a" />
      <view class="orb orb-b" />
    </view>

    <view class="auth-shell ios-content">
      <view class="auth-topbar">
        <view class="topbar-back" :class="{ disabled: loading }" @click="goLogin">
          <text class="back-text">{{ i18n.back }}</text>
        </view>
        <LocalePicker variant="inline" />
      </view>

      <view class="form-panel">
        <view class="form-main">
          <AuthBrand compact :title="i18n.brand" :slogan="i18n.slogan" :hint="i18n.sub" />

          <view class="sheet glass">
            <view class="field">
              <text class="label">{{ i18n.username }}</text>
              <input
                class="input"
                v-model="username"
                :placeholder="i18n.usernamePh"
                maxlength="64"
              />
            </view>
            <view class="field">
              <text class="label">{{ i18n.password }}</text>
              <input
                class="input"
                v-model="password"
                password
                :placeholder="i18n.passwordPh"
                maxlength="128"
              />
            </view>
            <view class="field last">
              <text class="label">{{ i18n.confirmPassword }}</text>
              <input
                class="input"
                v-model="confirmPassword"
                password
                :placeholder="i18n.confirmPh"
                maxlength="128"
                @confirm="handleRegister"
              />
            </view>
          </view>

          <view class="agree-row" @click="agreed = !agreed">
            <view class="agree-box" :class="{ on: agreed }">
              <text v-if="agreed" class="agree-tick">✓</text>
            </view>
            <view class="agree-text">
              <text class="agree-muted">{{ i18n.agreePrefix }}</text>
              <text class="agree-link" @click.stop="goPrivacy">{{ t('profile.privacy') }}</text>
              <text class="agree-muted">{{ i18n.agreeAnd }}</text>
              <text class="agree-link" @click.stop="goTerms">{{ t('profile.terms') }}</text>
            </view>
          </view>

          <view
            class="pill-btn tint submit-btn"
            :class="{ disabled: loading }"
            @click="handleRegister"
          >
            <text>{{ loading ? i18n.submitting : i18n.submit }}</text>
          </view>
        </view>

        <view class="auth-footer" @click="goLogin">
          <text class="footer-muted">{{ i18n.backLogin }}</text>
        </view>
        <view class="legal-row">
          <text class="legal-link" @click.stop="goPrivacy">{{ t('profile.privacy') }}</text>
          <text class="legal-dot">·</text>
          <text class="legal-link" @click.stop="goTerms">{{ t('profile.terms') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.auth-page {
  position: relative;
  height: 100vh;
  height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  box-sizing: border-box;
}

.auth-ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.55;
  animation: orb-drift 14s ease-in-out infinite;
}

.orb-a {
  width: min(420rpx, 42vw);
  height: min(420rpx, 42vw);
  top: -80rpx;
  right: -60rpx;
  background: var(--app-tint-soft);
}

.orb-b {
  width: min(360rpx, 36vw);
  height: min(360rpx, 36vw);
  bottom: 12%;
  left: -100rpx;
  background: var(--app-success);
  opacity: 0.14;
  animation-delay: -5s;
  animation-duration: 18s;
}

.auth-shell {
  --app-page-inset: 20px;
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: var(--app-auth-max, 480px);
  margin-left: auto;
  margin-right: auto;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding-left: max(22px, env(safe-area-inset-left, 0px));
  padding-right: max(22px, env(safe-area-inset-right, 0px));
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.auth-topbar {
  flex-shrink: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  margin-bottom: 8px;
}

.topbar-back {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding-right: 12px;
}

.topbar-back.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.back-text {
  font-size: 17px;
  color: var(--app-tint);
  font-weight: 500;
}

.form-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.form-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 8px;
  animation: rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.sheet {
  border-radius: var(--app-radius-panel);
  overflow: hidden;
  margin-bottom: 14px;
}

.field {
  padding: 14px 16px 8px;
  border-bottom: 0.5px solid var(--app-separator);
}

.field.last {
  border-bottom: none;
  padding-bottom: 14px;
}

.label {
  display: block;
  font-size: 12px;
  color: var(--app-secondary);
  margin-bottom: 6px;
}

.input {
  height: 36px;
  font-size: 17px;
  color: var(--app-label);
  background: transparent;
}

.agree-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 4px 4px 16px;
}

.agree-box {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid var(--app-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  box-sizing: border-box;
}

.agree-box.on {
  background: var(--app-tint);
  border-color: var(--app-tint);
}

.agree-tick {
  color: var(--app-on-tint);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.agree-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.45;
}

.agree-muted {
  color: var(--app-secondary);
}

.agree-link {
  color: var(--app-tint);
  font-weight: 600;
}

.submit-btn {
  margin-top: 0;
}

.auth-footer {
  flex-shrink: 0;
  margin-top: auto;
  padding: 20px 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-muted {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-tint);
}

.legal-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4px 8px 12px;
}

.legal-link {
  font-size: 13px;
  color: var(--app-secondary);
}

.legal-dot {
  font-size: 13px;
  color: var(--app-tertiary);
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes orb-drift {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-12px, 10px, 0) scale(1.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .orb,
  .form-main {
    animation: none;
  }
}
</style>
