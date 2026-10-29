<script setup>
/**
 * 桌面端登录页：完成账号认证与会话恢复。
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import logoUrl from '../utils/brand.js'
import { login, restoreAccount } from '../api/client.js'
import { enterSession, leaveSession } from '../stores/auth.js'
import { themeClass } from '../stores/theme.js'
import { t, localeVersion, LOCALES, getLocale, setLocale } from '../i18n/index.js'
import { toast } from '../utils/toast.js'
import AppDownloadEntry from '../components/AppDownloadEntry.vue'
import { isExternalReturnUrl, redirectToSiteIfNeeded } from '../utils/siteReturn.js'
import { getNickname, getAvatar, getUsername } from '../stores/storage.js'

const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const loading = ref(false)
const locale = ref(getLocale())
const bootstrapping = ref(route.query.logout === '1')

onMounted(async () => {
  if (route.query.logout !== '1') return
  try {
    await leaveSession()
  } catch {
    /* local clear still happens inside leaveSession */
  }
  const redirect = route.query.redirect
  if (isExternalReturnUrl(redirect)) {
    window.location.assign(String(redirect))
    return
  }
  bootstrapping.value = false
  router.replace({ name: 'login', query: {} })
})

function finishAuth(res) {
  if (
    redirectToSiteIfNeeded(route.query.redirect, {
      ...res,
      nickname: res.nickname || getNickname(),
      avatar: res.avatar || getAvatar(),
      username: res.username || getUsername(),
    })
  ) {
    return
  }
  router.replace(route.query.redirect || { name: 'tasks' })
}

const i18n = computed(() => {
  void localeVersion.value
  return {
    brand: t('login.brand'),
    slogan: t('login.slogan'),
    sub: t('login.sub'),
    username: t('login.username'),
    password: t('login.password'),
    usernamePh: t('login.usernamePh'),
    passwordPh: t('login.passwordPh'),
    submit: t('login.submit'),
    submitting: t('login.submitting'),
    createAccount: t('login.createAccount'),
  }
})

function onLocaleChange() {
  setLocale(locale.value)
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

async function promptRestore(u, p, serverMessage) {
  const date = formatPurgeDate(serverMessage)
  const ok = window.confirm(t('login.restoreContent', { date }))
  if (!ok) return
  loading.value = true
  try {
    const res = await restoreAccount(u, p)
    await enterSession(res)
    toast(t('login.restoreSuccess'))
    finishAuth(res)
  } catch (err) {
    toast(err.message || t('login.restoreFailed'))
  } finally {
    loading.value = false
  }
}

async function handleLogin() {
  const u = username.value.trim()
  const p = password.value
  if (!u || !p) {
    toast(t('login.needCredentials'))
    return
  }
  loading.value = true
  try {
    const res = await login(u, p)
    await enterSession(res)
    toast(t('login.success'))
    finishAuth(res)
  } catch (err) {
    // 40302: pending deletion; fail envelope result is always null
    if (err.code === 40302) {
      await promptRestore(u, p, err.message)
      return
    }
    toast(err.message || t('login.failed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page" :class="themeClass()">
    <div v-if="bootstrapping" class="auth-card panel">
      <p class="sub">…</p>
    </div>
    <div v-else class="auth-card panel">
      <div class="auth-brand">
        <div class="logo-wrap">
          <img :src="logoUrl" alt="Upgrade" width="88" height="88" />
        </div>
        <h1>{{ i18n.brand }}</h1>
        <p class="slogan">{{ i18n.slogan }}</p>
        <p class="sub">{{ i18n.sub }}</p>
      </div>

      <div class="field">
        <label for="locale">Language</label>
        <select id="locale" v-model="locale" @change="onLocaleChange">
          <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
      </div>

      <form class="auth-form" @submit.prevent="handleLogin">
        <div class="field">
          <label for="username">{{ i18n.username }}</label>
          <input id="username" v-model="username" autocomplete="username" :placeholder="i18n.usernamePh" />
        </div>
        <div class="field">
          <label for="password">{{ i18n.password }}</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            :placeholder="i18n.passwordPh"
          />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="loading">
          {{ loading ? i18n.submitting : i18n.submit }}
        </button>
      </form>

      <router-link class="auth-link" :to="{ name: 'register', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">{{ i18n.createAccount }}</router-link>
      <AppDownloadEntry placement="auth" />
    </div>
  </div>
</template>
