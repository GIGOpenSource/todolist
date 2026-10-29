<!-- 管理后台布局：侧栏菜单与权限过滤。 -->
<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-name">{{ t('app.brand') }}</div>
        <div class="brand-sub">{{ t('app.brandSub') }}</div>
      </div>
      <nav class="nav">
        <router-link
          v-for="item in navItems"
          :key="item.route"
          :class="{ active: route.name === item.route }"
          :to="{ name: item.route }"
        >
          {{ item.label }}
        </router-link>
      </nav>
      <div class="sidebar-foot">
        <label class="lang-switch">
          <span class="lang-switch-label">{{ t('app.language') }}</span>
          <select class="input lang-select" :value="localeCode" @change="onLocaleChange">
            <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.name }}</option>
          </select>
        </label>
        <div class="sidebar-user">{{ userLabel }}</div>
        <button class="btn btn-ghost" type="button" @click="onLogout">{{ t('app.logout') }}</button>
      </div>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
/**
 * 管理后台布局：侧栏菜单与权限过滤。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clearAuth, getUser, getRefreshToken } from '../stores/storage.js'
import { logout as apiLogout } from '../api/client.js'
import { hasPermission, navItemsLabeled } from '../utils/permissions.js'
import { LOCALES, getLocale, setLocale, t, localeVersion } from '../i18n/index.js'

const route = useRoute()
const router = useRouter()
const localeCode = ref(getLocale())

watch(localeVersion, () => {
  localeCode.value = getLocale()
})

const userLabel = computed(() => {
  const u = getUser()
  if (!u) return ''
  return u.nickname || u.username || ''
})

const navItems = computed(() => {
  void localeVersion.value
  const u = getUser()
  return navItemsLabeled().filter((p) => hasPermission(u, p.key))
})

function onLocaleChange(e) {
  setLocale(e.target.value)
  localeCode.value = getLocale()
}

async function onLogout() {
  const refresh = getRefreshToken()
  try {
    if (refresh) await apiLogout(refresh)
  } catch {
    // still clear local session
  }
  clearAuth()
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.lang-switch {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.lang-switch-label {
  font-size: 12px;
  color: var(--text-muted);
}

.lang-select {
  height: 34px;
  padding: 0 10px;
}
</style>
