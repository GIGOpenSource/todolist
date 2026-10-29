<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchSiteConfig } from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'

const props = defineProps({
  /** sidebar | auth — placement for popover direction */
  placement: { type: String, default: 'sidebar' },
})

const open = ref(false)
let closeTimer = null

const copy = computed(() => {
  void localeVersion.value
  return {
    trigger: t('downloadApp.trigger'),
    hint: t('downloadApp.hint'),
    google: t('downloadApp.googlePlay'),
    apple: t('downloadApp.appStore'),
    soon: t('downloadApp.soon'),
    scan: t('downloadApp.scan'),
  }
})

const emptyEntry = () => ({ url: '', ready: false })
const android = ref(emptyEntry())
const ios = ref(emptyEntry())

function pickDownload(item) {
  const url = String(item?.url || '').trim()
  return { url, ready: Boolean(url) }
}

onMounted(async () => {
  try {
    const cfg = await fetchSiteConfig()
    const downloads = cfg?.downloads || {}
    android.value = pickDownload(downloads.androidPhone)
    ios.value = pickDownload(downloads.iosPhone)
  } catch {
    android.value = emptyEntry()
    ios.value = emptyEntry()
  }
})

const stores = computed(() => [
  {
    key: 'googlePlay',
    label: copy.value.google,
    url: android.value.url,
    ready: android.value.ready,
  },
  {
    key: 'appStore',
    label: copy.value.apple,
    url: ios.value.url,
    ready: ios.value.ready,
  },
])

function qrSrc(url) {
  const data = encodeURIComponent(url)
  return `https://api.qrserver.com/v1/create-qr-code/?size=148x148&margin=10&data=${data}`
}

function show() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  open.value = true
}

function hide() {
  closeTimer = setTimeout(() => {
    open.value = false
  }, 120)
}

function onTriggerKey(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    open.value = !open.value
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div
    class="app-dl"
    :class="[`place-${props.placement}`, { open }]"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <button
      type="button"
      class="app-dl-trigger"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="true"
      :aria-controls="'app-dl-panel'"
      @keydown="onTriggerKey"
    >
      <span class="app-dl-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.8" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.8" />
          <rect x="3" y="14" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M14 14h3.5M17.5 14V17.5M14 17.5h7M21 14v7"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      </span>
      <span class="app-dl-text">
        <strong>{{ copy.trigger }}</strong>
        <small>{{ copy.hint }}</small>
      </span>
    </button>

    <div
      id="app-dl-panel"
      class="app-dl-panel"
      role="region"
      :aria-hidden="open ? 'false' : 'true'"
      :aria-label="copy.trigger"
    >
      <p class="app-dl-scan">{{ copy.scan }}</p>
      <div class="app-dl-grid">
        <div v-for="store in stores" :key="store.key" class="app-dl-card">
          <a
            v-if="store.ready"
            class="qr-frame"
            :href="store.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="store.label"
          >
            <img
              :src="qrSrc(store.url)"
              :alt="store.label"
              width="132"
              height="132"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </a>
          <div v-else class="qr-frame soon">
            <div class="qr-placeholder">
              <span>{{ copy.soon }}</span>
            </div>
          </div>
          <div class="store-meta">
            <a
              v-if="store.ready"
              class="store-name is-link"
              :href="store.url"
              target="_blank"
              rel="noopener noreferrer"
              >{{ store.label }}</a
            >
            <template v-else>
              <span class="store-name">{{ store.label }}</span>
              <span class="store-soon">{{ copy.soon }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-dl {
  position: relative;
}

.app-dl-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--app-separator);
  background: var(--app-fill);
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.place-sidebar .app-dl-trigger {
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
}

.place-sidebar .app-dl-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

.app-dl:hover .app-dl-trigger,
.app-dl.open .app-dl-trigger {
  background: var(--app-tint-soft);
  border-color: color-mix(in srgb, var(--app-tint) 35%, transparent);
  box-shadow: 0 8px 22px var(--app-shadow);
}

.app-dl-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  color: var(--app-tint);
  background: var(--app-fill-strong);
  flex-shrink: 0;
}

.app-dl-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.app-dl-text strong {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.app-dl-text small {
  font-size: 11px;
  color: var(--app-secondary);
  font-weight: 500;
}

.app-dl-panel {
  position: absolute;
  z-index: 60;
  width: 320px;
  padding: 14px;
  border-radius: var(--radius);
  background: var(--app-fill-strong);
  border: 1px solid var(--app-separator);
  box-shadow: 0 18px 48px var(--app-shadow);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(6px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
}

.place-sidebar .app-dl-panel {
  left: calc(100% + 12px);
  bottom: 0;
}

.place-auth .app-dl-panel {
  left: 50%;
  top: calc(100% + 10px);
  bottom: auto;
  transform: translate(-50%, -6px);
}

.app-dl.open .app-dl-panel,
.app-dl:hover .app-dl-panel,
.app-dl:focus-within .app-dl-panel {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0);
}

.place-auth.open .app-dl-panel,
.place-auth:hover .app-dl-panel,
.place-auth:focus-within .app-dl-panel {
  transform: translate(-50%, 0);
}

.app-dl-scan {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-secondary);
  letter-spacing: 0.02em;
}

.app-dl-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.app-dl-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.qr-frame {
  width: 132px;
  height: 132px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--app-separator);
  display: grid;
  place-items: center;
  color: inherit;
  text-decoration: none;
}

.qr-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.qr-frame.soon {
  background: var(--app-fill);
}

.qr-placeholder {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--app-tertiary);
}

.store-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}

.store-name {
  font-size: 12px;
  font-weight: 700;
}

.store-name.is-link {
  color: var(--app-tint);
}

.store-soon {
  font-size: 11px;
  color: var(--app-tertiary);
}

@media (max-width: 960px) {
  .place-sidebar .app-dl-panel {
    left: 0;
    right: 0;
    bottom: calc(100% + 10px);
    width: auto;
  }
}
</style>
