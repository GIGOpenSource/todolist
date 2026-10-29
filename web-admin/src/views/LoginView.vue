<!-- 管理端登录页。 -->
<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="onSubmit">
      <div class="login-lang">
        <label class="label">{{ t('app.language') }}</label>
        <select class="input" :value="localeCode" @change="onLocaleChange">
          <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
      </div>
      <h1>{{ t('login.title') }}</h1>
      <p class="hint">{{ t('login.hint') }}</p>
      <p v-if="error" class="login-error">{{ error }}</p>
      <div class="field">
        <label class="label">{{ t('login.username') }}</label>
        <input v-model="username" class="input" autocomplete="username" required />
      </div>
      <div class="field">
        <label class="label">{{ t('login.password') }}</label>
        <input
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>
      <button class="btn btn-primary" type="submit" style="width: 100%" :disabled="loading">
        {{ loading ? t('login.submitting') : t('login.submit') }}
      </button>
    </form>
  </div>
</template>

<script setup>
/**
 * 管理端登录页。
 */
/**
 * 管理后台登录页：认证管理员并跳转授权页面。
 */
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '../api/client.js'
import { setToken, setRefreshToken, setUser, clearAuth } from '../stores/storage.js'
import { LOCALES, getLocale, setLocale, t, localeVersion } from '../i18n/index.js'

const router = useRouter()
const route = useRoute()

const username = ref('admin')
const password = ref('')
const loading = ref(false)
const error = ref('')
const localeCode = ref(getLocale())

watch(localeVersion, () => {
  localeCode.value = getLocale()
})

function onLocaleChange(e) {
  setLocale(e.target.value)
  localeCode.value = getLocale()
}

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await login(username.value.trim(), password.value)
    if (!data?.access_token || data.role !== 'admin') {
      clearAuth()
      error.value = t('login.notAdmin')
      return
    }
    setToken(data.access_token)
    setRefreshToken(data.refresh_token || '')
    setUser({
      username: data.username,
      nickname: data.nickname || '',
      role: data.role,
      permissions: data.permissions || ['*'],
    })
    const { ensurePermissionCatalog, firstAllowedRoute } = await import('../utils/permissions.js')
    await ensurePermissionCatalog().catch(() => {})
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect) {
      router.replace(redirect)
    } else {
      router.replace({ name: firstAllowedRoute(data) })
    }
  } catch (e) {
    error.value = e.message || t('login.failed')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-lang {
  margin-bottom: 16px;
}
</style>
