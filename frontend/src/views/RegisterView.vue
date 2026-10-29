<script setup>
/**
 * 桌面端注册页：创建账号并初始化会话。
 */
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import logoUrl from '../utils/brand.js'
import { register } from '../api/client.js'
import { enterSession } from '../stores/auth.js'
import { themeClass } from '../stores/theme.js'
import { t, localeVersion } from '../i18n/index.js'
import { LEGAL_PUBLIC_BASE_URL } from '../config.js'
import { toast } from '../utils/toast.js'
import AppDownloadEntry from '../components/AppDownloadEntry.vue'
import { redirectToSiteIfNeeded } from '../utils/siteReturn.js'

const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const confirm = ref('')
const agree = ref(false)
const loading = ref(false)

const privacyUrl = `${LEGAL_PUBLIC_BASE_URL}/privacy.html`
const termsUrl = `${LEGAL_PUBLIC_BASE_URL}/terms.html`

const i18n = computed(() => {
  void localeVersion.value
  return {
    brand: t('register.brand'),
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
    privacy: t('profile.privacy'),
    terms: t('profile.terms'),
  }
})

async function handleRegister() {
  const u = username.value.trim()
  const p = password.value
  if (u.length < 3) {
    toast(t('register.usernameShort'))
    return
  }
  if (p.length < 6) {
    toast(t('register.passwordShort'))
    return
  }
  if (p !== confirm.value) {
    toast(t('register.passwordMismatch'))
    return
  }
  if (!agree.value) {
    toast(t('register.needAgree'))
    return
  }
  loading.value = true
  try {
    const res = await register(u, p)
    await enterSession(res)
    toast(t('register.success'))
    if (redirectToSiteIfNeeded(route.query.redirect, res)) return
    router.replace(route.query.redirect || { name: 'tasks' })
  } catch (err) {
    toast(err.message || t('register.failed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page" :class="themeClass()">
    <div class="auth-card panel">
      <div class="auth-brand">
        <div class="logo-wrap">
          <img :src="logoUrl" alt="Upgrade" width="72" height="72" />
        </div>
        <h1>{{ i18n.brand }}</h1>
        <p class="sub">{{ i18n.sub }}</p>
      </div>

      <form class="auth-form" @submit.prevent="handleRegister">
        <div class="field">
          <label>{{ i18n.username }}</label>
          <input v-model="username" autocomplete="username" :placeholder="i18n.usernamePh" />
        </div>
        <div class="field">
          <label>{{ i18n.password }}</label>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            :placeholder="i18n.passwordPh"
          />
        </div>
        <div class="field">
          <label>{{ i18n.confirmPassword }}</label>
          <input
            v-model="confirm"
            type="password"
            autocomplete="new-password"
            :placeholder="i18n.confirmPh"
          />
        </div>
        <label class="agree">
          <input v-model="agree" type="checkbox" />
          <span>
            {{ i18n.agreePrefix }}
            <a :href="privacyUrl" target="_blank" rel="noopener">{{ i18n.privacy }}</a>
            {{ i18n.agreeAnd }}
            <a :href="termsUrl" target="_blank" rel="noopener">{{ i18n.terms }}</a>
          </span>
        </label>
        <button class="btn btn-primary" type="submit" :disabled="loading">
          {{ loading ? i18n.submitting : i18n.submit }}
        </button>
      </form>

      <router-link class="auth-link" :to="{ name: 'login', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">{{ i18n.backLogin }}</router-link>
      <AppDownloadEntry placement="auth" />
    </div>
  </div>
</template>
