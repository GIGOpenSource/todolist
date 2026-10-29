<script setup>
/**
 * 登录页：支持账号登录与已删除账号恢复。
 */
import { ref, computed } from 'vue'
import { login, restoreAccount } from '../../api/index.js'
import { bindSession, getToken } from '../../utils/storage.js'
import { resetTodoCache, refreshTodosFromServer } from '../../utils/todoStore.js'
import { resetNoteCache, refreshNotesFromServer } from '../../utils/noteStore.js'
import { startAutoSyncScheduler } from '../../utils/autoSync.js'
import { onShow } from '@dcloudio/uni-app'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion } from '../../utils/i18n.js'
import AuthBrand from '../../components/AuthBrand.vue'
import LocalePicker from '../../components/LocalePicker.vue'
import { ENABLE_OAUTH_UI } from '../../utils/config.js'

const username = ref('')
const password = ref('')
const loading = ref(false)
/** choose | account — 无 OAuth 时直接进入账号表单 */
const mode = ref(ENABLE_OAUTH_UI ? 'choose' : 'account')
const showGoogle = ref(false)
const showApple = ref(false)
const pageThemeClass = computed(() => themeClass())

const i18n = computed(() => {
  void localeVersion.value
  return {
    brand: t('login.brand'),
    slogan: t('login.slogan'),
    sub: t('login.sub'),
    chooseHint: t('login.chooseHint'),
    username: t('login.username'),
    password: t('login.password'),
    usernamePh: t('login.usernamePh'),
    passwordPh: t('login.passwordPh'),
    submit: t('login.submit'),
    submitting: t('login.submitting'),
    createAccount: t('login.createAccount'),
    google: t('login.google'),
    apple: t('login.apple'),
    account: t('login.account'),
    back: t('login.back'),
    oauthSoon: t('login.oauthSoon'),
  }
})

function detectAuthPlatforms() {
  if (!ENABLE_OAUTH_UI) {
    showGoogle.value = false
    showApple.value = false
    return
  }
  try {
    const info = uni.getSystemInfoSync() || {}
    const platform = String(info.platform || '').toLowerCase()
    const system = String(info.system || '').toLowerCase()
    const ua =
      typeof navigator !== 'undefined' ? String(navigator.userAgent || '').toLowerCase() : ''
    const isAndroid = platform === 'android' || system.includes('android') || ua.includes('android')
    const isIOS =
      platform === 'ios' ||
      system.includes('ios') ||
      /iphone|ipad|ipod/.test(ua) ||
      (typeof navigator !== 'undefined' &&
        navigator.platform === 'MacIntel' &&
        Number(navigator.maxTouchPoints || 0) > 1)
    const isMac =
      platform === 'mac' ||
      platform === 'macos' ||
      system.includes('mac') ||
      (/macintosh|mac os x/.test(ua) && Number(navigator?.maxTouchPoints || 0) <= 1)
    showGoogle.value = isAndroid
    showApple.value = isIOS || isMac
  } catch {
    showGoogle.value = false
    showApple.value = false
  }
}

onShow(() => {
  syncPageChrome()
  detectAuthPlatforms()
  if (getToken()) {
    uni.switchTab({ url: '/pages/todos/todos' })
  }
})


function openAccountLogin() {
  mode.value = 'account'
}

function backToChoose() {
  if (loading.value) return
  mode.value = 'choose'
}

function handleOauth(provider) {
  // Real IdP not wired — keep toast only when ENABLE_OAUTH_UI is intentionally on
  uni.showToast({ title: t('login.oauthSoon', { provider }), icon: 'none' })
}

function formatPurgeDate(isoOrMessage) {
  if (!isoOrMessage) return '—'
  const m = String(isoOrMessage).match(/\d{4}-\d{2}-\d{2}/)
  if (m) return m[0]
  try {
    const d = new Date(isoOrMessage)
    if (Number.isNaN(d.getTime())) return String(isoOrMessage).slice(0, 10)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  } catch {
    return String(isoOrMessage).slice(0, 10)
  }
}

function enterSession(res) {
  console.log('[login] enterSession called with:', JSON.stringify(res))
  bindSession(res.access_token, res.username, {
    nickname: res.nickname,
    avatar: res.avatar,
    signature: res.signature,
    gender: res.gender,
    refresh_token: res.refresh_token || '',
    user_id: res.user_id,
  })
  console.log('[login] after bindSession, token:', getToken() ? 'exists' : 'empty')
  try {
    resetTodoCache()
  } catch (e) {
    console.error('[login] resetTodoCache error:', e)
  }
  try {
    resetNoteCache()
  } catch (e) {
    console.error('[login] resetNoteCache error:', e)
  }
  try {
    refreshTodosFromServer().catch((e) => console.error('[login] refreshTodos error:', e))
  } catch (e) {
    console.error('[login] refreshTodosFromServer error:', e)
  }
  try {
    refreshNotesFromServer().catch((e) => console.error('[login] refreshNotes error:', e))
  } catch (e) {
    console.error('[login] refreshNotesFromServer error:', e)
  }
  try {
    startAutoSyncScheduler()
  } catch (e) {
    console.error('[login] startAutoSync error:', e)
  }
}

function promptRestore(u, p, serverMessage) {
  const date = formatPurgeDate(serverMessage)
  uni.showModal({
    title: t('login.restoreTitle'),
    content: t('login.restoreContent', { date }),
    confirmText: t('login.restore'),
    success: async (modal) => {
      if (!modal.confirm) return
      loading.value = true
      try {
        const res = await restoreAccount(u, p)
        enterSession(res)
        uni.showToast({ title: t('login.restoreSuccess'), icon: 'success' })
        setTimeout(goTodos, 400)
      } catch (err) {
        uni.showToast({ title: err.message || t('login.restoreFailed'), icon: 'none' })
      } finally {
        loading.value = false
      }
    },
  })
}

function goTodos() {
  // tabBar 页必须用 switchTab；H5 失败时硬跳（hash + base=/app/）
  uni.switchTab({
    url: '/pages/todos/todos',
    fail: () => {
      if (typeof window !== 'undefined' && window.location) {
        const base = (import.meta.env.BASE_URL || '/app/').replace(/\/?$/, '/')
        window.location.replace(`${base}#/pages/todos/todos`)
      }
    },
  })
}

async function handleLogin() {
  const u = username.value.trim()
  const p = password.value
  if (!u || !p) {
    uni.showToast({ title: t('login.needCredentials'), icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await login(u, p)
    enterSession(res)
    uni.showToast({ title: t('login.success'), icon: 'success' })
    // 成功后不再改 loading，避免触发 uni-h5-vue slots 更新踩坑；直接进首页
    setTimeout(goTodos, 400)
  } catch (e) {
    // 40302: pending deletion; fail envelope result is always null — use message for purge date
    if (e && e.code === 40302) {
      loading.value = false
      promptRestore(u, p, e.message)
      return
    }
    if (e && e.code === 42901) {
      uni.showToast({ title: e.message || t('login.rateLimited'), icon: 'none' })
      loading.value = false
      return
    }
    uni.showToast({ title: e.message || t('login.failed'), icon: 'none' })
    loading.value = false
  }
}

function goRegister() {
  uni.navigateTo({ url: '/pages/register/register' })
}

function goPrivacy() {
  uni.navigateTo({ url: '/pages/legal/privacy' })
}

function goTerms() {
  uni.navigateTo({ url: '/pages/legal/terms' })
}
</script>

<template>
  <view class="page ios-page auth-page" :class="[pageThemeClass, `mode-${mode}`]">
    <view class="auth-ambient" aria-hidden="true">
      <view class="orb orb-a" />
      <view class="orb orb-b" />
    </view>

    <view class="auth-shell ios-content">
      <view class="auth-topbar">
        <view
          v-if="ENABLE_OAUTH_UI && mode === 'account'"
          class="topbar-back"
          :class="{ disabled: loading }"
          @click="backToChoose"
        >
          <text class="back-text">{{ i18n.back }}</text>
        </view>
        <view v-else class="topbar-spacer" />
        <LocalePicker variant="inline" />
      </view>

      <view v-if="mode === 'choose'" class="choose-panel">
        <view class="choose-hero">
          <AuthBrand :title="i18n.brand" :slogan="i18n.slogan" />
        </view>

        <view class="choose-actions">
          <text class="section-hint">{{ i18n.chooseHint }}</text>
          <view class="methods">
            <view
              v-if="showGoogle"
              class="auth-btn google"
              style="--i: 0"
              @click="handleOauth('Google')"
            >
              <view class="auth-icon google-icon"><text class="g">G</text></view>
              <text class="auth-text">{{ i18n.google }}</text>
            </view>

            <view
              v-if="showApple"
              class="auth-btn apple"
              style="--i: 1"
              @click="handleOauth('Apple')"
            >
              <view class="auth-icon apple-icon"><view class="a" /></view>
              <text class="auth-text">{{ i18n.apple }}</text>
            </view>

            <view class="auth-btn account" style="--i: 2" @click="openAccountLogin">
              <view class="auth-icon account-icon"><text class="key">◎</text></view>
              <text class="auth-text">{{ i18n.account }}</text>
            </view>
          </view>
        </view>

        <view class="auth-footer" @click="goRegister">
          <text class="footer-muted">{{ i18n.createAccount }}</text>
        </view>
        <view class="legal-row">
          <text class="legal-link" @click.stop="goPrivacy">{{ t('profile.privacy') }}</text>
          <text class="legal-dot">·</text>
          <text class="legal-link" @click.stop="goTerms">{{ t('profile.terms') }}</text>
        </view>
      </view>

      <view v-else class="form-panel">
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
                confirm-type="next"
              />
            </view>
            <view class="field last">
              <text class="label">{{ i18n.password }}</text>
              <input
                class="input"
                v-model="password"
                password
                :placeholder="i18n.passwordPh"
                maxlength="128"
                confirm-type="done"
                @confirm="handleLogin"
              />
            </view>
          </view>

          <view class="pill-btn tint submit-btn" :class="{ disabled: loading }" @click="handleLogin">
            <text>{{ loading ? i18n.submitting : i18n.submit }}</text>
          </view>
        </view>

        <view class="auth-footer" @click="goRegister">
          <text class="footer-muted">{{ i18n.createAccount }}</text>
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
  bottom: 8%;
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

.topbar-spacer {
  width: 1px;
  height: 1px;
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

.choose-panel,
.form-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.choose-hero {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px 0 20px;
  min-height: 160px;
}

.methods {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin: 0 auto;
}

.choose-actions {
  flex-shrink: 0;
  padding-bottom: 8px;
  animation: rise-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
}

.section-hint {
  display: block;
  text-align: center;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.2px;
  color: var(--app-tertiary);
}

.form-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 12px;
  animation: rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.auth-btn {
  position: relative;
  height: var(--app-btn-height);
  min-height: 48px;
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 48px;
  background: var(--app-fill-strong);
  border: 0.5px solid var(--app-glass-border);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 24px var(--app-shadow);
  animation: rise-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(0.18s + var(--i, 0) * 0.07s);
  box-sizing: border-box;
}

.auth-btn.google {
  border-color: var(--app-separator);
}

.auth-btn.apple {
  background: #000000;
  border-color: #000000;
}

.auth-btn.account {
  background: var(--app-tint);
  border-color: transparent;
  box-shadow: 0 10px 28px var(--app-tint-glow);
}

.auth-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.google-icon .g {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-tint);
  line-height: 1;
}

.apple-icon .a {
  width: 10px;
  height: 12px;
  border-radius: 4px 4px 2px 2px;
  background: #ffffff;
  display: block;
}

.account-icon .key {
  font-size: 14px;
  color: var(--app-on-tint);
  line-height: 1;
}

.auth-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-label);
  text-align: center;
  line-height: 1.2;
}

.auth-btn.apple .auth-text {
  color: #ffffff;
}

.auth-btn.account .auth-text {
  color: var(--app-on-tint);
}

/* Dark: Apple 按钮反色（白底黑字） */
.theme-dark .auth-btn.apple {
  background: #ffffff;
  border-color: #ffffff;
}

.theme-dark .auth-btn.apple .auth-text {
  color: #000000;
}

.theme-dark .apple-icon .a {
  background: #000000;
}

.sheet {
  border-radius: var(--app-radius-panel);
  overflow: hidden;
  margin-bottom: 16px;
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
  .choose-actions,
  .form-main,
  .auth-btn {
    animation: none;
  }
}

@media (min-width: 768px) {
  .choose-hero {
    min-height: 120px;
    padding: 16px 0 12px;
  }

  .auth-shell {
    padding-top: 8px;
  }
}

@media (orientation: landscape) and (max-height: 560px) {
  .choose-hero {
    min-height: 0;
    padding: 8px 0;
  }

  .auth-brand {
    margin-bottom: 12px;
  }
}
</style>
