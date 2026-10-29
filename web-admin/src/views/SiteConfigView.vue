<!-- 管理端-官网 CMS 配置编辑。 -->
<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ t('site.title') }}</h1>
        <p>{{ t('site.subtitle') }}</p>
      </div>
      <button class="btn btn-primary" type="button" :disabled="saving || loading" @click="save">
        {{ saving ? t('common.saving') : t('common.save') }}
      </button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-if="success" class="login-ok">{{ success }}</p>

    <section class="panel">
      <h2 class="panel-title">{{ t('site.section.global') }}</h2>
      <div class="form-grid">
        <div class="field">
          <label class="label">{{ t('site.field.brand') }}</label>
          <input v-model="form.brand" class="input" maxlength="64" />
        </div>
        <div class="field">
          <label class="label">{{ t('site.field.contactEmail') }}</label>
          <input v-model="form.contactEmail" class="input" maxlength="120" />
        </div>
        <div class="field field-span">
          <label class="label">{{ t('site.field.loginUrl') }}</label>
          <input v-model="form.loginUrl" class="input" maxlength="512" />
        </div>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">{{ t('site.section.downloads') }}</h2>
      <div class="download-grid">
        <div v-for="key in downloadKeys" :key="key" class="download-card">
          <h3>{{ t(`site.platform.${key}`) }}</h3>
          <div class="field">
            <label class="label">{{ t('site.download.url') }}</label>
            <input v-model="form.downloads[key].url" class="input" />
          </div>
          <label class="checkbox-row">
            <input v-model="form.downloads[key].ready" type="checkbox" />
            <span>{{ t('site.download.ready') }}</span>
          </label>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">{{ t('site.section.shots') }}</h2>
      <div class="form-grid">
        <div v-for="(shot, idx) in form.shots" :key="idx" class="field field-span">
          <label class="label">{{ t('site.field.shotSrc', { n: idx + 1 }) }}</label>
          <input v-model="shot.src" class="input" />
        </div>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">{{ t('site.section.copy') }}</h2>
      <div class="lang-tabs" role="tablist">
        <button
          v-for="loc in SITE_LOCALES"
          :key="loc.code"
          type="button"
          class="lang-tab"
          :class="{ active: activeLocale === loc.code }"
          role="tab"
          :aria-selected="activeLocale === loc.code"
          @click="activeLocale = loc.code"
        >
          {{ loc.name }}
        </button>
      </div>

      <div v-if="currentPack" class="copy-form">
        <div class="form-grid">
          <div v-for="key in scalarKeys" :key="key" class="field" :class="{ 'field-span': key === 'support' }">
            <label class="label">{{ t(`site.copy.${key}`) }}</label>
            <textarea
              v-if="key === 'support'"
              v-model="currentPack[key]"
              class="input textarea"
              rows="3"
            />
            <input v-else v-model="currentPack[key]" class="input" />
          </div>
        </div>

        <h3 class="subhead">Shots</h3>
        <div class="form-grid">
          <template v-for="(shot, idx) in currentPack.shots" :key="'shot-' + idx">
            <div class="field">
              <label class="label">{{ t('site.copy.shotTitle', { n: idx + 1 }) }}</label>
              <input v-model="shot.title" class="input" />
            </div>
            <div class="field">
              <label class="label">{{ t('site.copy.shotDesc', { n: idx + 1 }) }}</label>
              <input v-model="shot.desc" class="input" />
            </div>
          </template>
        </div>

        <h3 class="subhead">Features</h3>
        <div class="form-grid">
          <template v-for="(feat, idx) in currentPack.features" :key="'feat-' + idx">
            <div class="field">
              <label class="label">{{ t('site.copy.featureTitle', { n: idx + 1 }) }}</label>
              <input v-model="feat.title" class="input" />
            </div>
            <div class="field">
              <label class="label">{{ t('site.copy.featureDesc', { n: idx + 1 }) }}</label>
              <input v-model="feat.desc" class="input" />
            </div>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * 管理端-官网 CMS 配置编辑。
 */
/**
 * 站点配置页：维护公开站点与客户端运行参数。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { fetchSiteConfig, updateSiteConfig } from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'

const SITE_LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'zh-Hans', name: '简体中文' },
  { code: 'zh-Hant', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'th', name: 'ไทย' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'pl', name: 'Polski' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'sv', name: 'Svenska' },
  { code: 'hi', name: 'हिन्दी' },
]

const scalarKeys = [
  'hook',
  'slogan',
  'support',
  'ctaLogin',
  'ctaDownload',
  'showcaseTitle',
  'showcaseSub',
  'productTitle',
  'productSub',
  'downloadTitle',
  'downloadSub',
  'desireTitle',
  'desireSub',
  'footerNote',
]

const downloadKeys = ['androidPhone', 'androidPad', 'iosPhone', 'iosPad']

function emptyPack() {
  return {
    hook: '',
    slogan: '',
    support: '',
    ctaLogin: '',
    ctaDownload: '',
    showcaseTitle: '',
    showcaseSub: '',
    productTitle: '',
    productSub: '',
    downloadTitle: '',
    downloadSub: '',
    desireTitle: '',
    desireSub: '',
    footerNote: '',
    shots: [
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' },
    ],
    features: [
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' },
    ],
  }
}

function emptyDownloads() {
  const out = {}
  downloadKeys.forEach((k) => {
    out[k] = { id: k, url: '', ready: false }
  })
  return out
}

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const activeLocale = ref('zh-Hans')

const form = reactive({
  brand: 'Upgrade',
  contactEmail: '',
  loginUrl: '',
  downloads: emptyDownloads(),
  shots: [
    { src: '', key: 0 },
    { src: '', key: 1 },
    { src: '', key: 2 },
  ],
  i18n: Object.fromEntries(SITE_LOCALES.map((l) => [l.code, emptyPack()])),
})

const currentPack = computed(() => {
  void localeVersion.value
  return form.i18n[activeLocale.value]
})

function applyData(data) {
  if (!data || typeof data !== 'object') return
  form.brand = data.brand || 'Upgrade'
  form.contactEmail = data.contactEmail || ''
  form.loginUrl = data.loginUrl || ''
  const dl = data.downloads || {}
  downloadKeys.forEach((k) => {
    const item = dl[k] || {}
    form.downloads[k] = {
      id: k,
      url: item.url || '',
      ready: !!item.ready,
    }
  })
  const shots = Array.isArray(data.shots) ? data.shots : []
  form.shots = [0, 1, 2].map((i) => ({
    src: (shots[i] && shots[i].src) || '',
    key: (shots[i] && shots[i].key) ?? i,
  }))
  const remoteI18n = data.i18n && typeof data.i18n === 'object' ? data.i18n : {}
  SITE_LOCALES.forEach(({ code }) => {
    const pack = remoteI18n[code] || {}
    const next = emptyPack()
    scalarKeys.forEach((k) => {
      next[k] = pack[k] != null ? String(pack[k]) : ''
    })
    for (let i = 0; i < 3; i += 1) {
      const s = Array.isArray(pack.shots) && pack.shots[i] ? pack.shots[i] : {}
      next.shots[i] = { title: s.title || '', desc: s.desc || '' }
      const f = Array.isArray(pack.features) && pack.features[i] ? pack.features[i] : {}
      next.features[i] = { title: f.title || '', desc: f.desc || '' }
    }
    form.i18n[code] = next
  })
}

async function load() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await fetchSiteConfig()
    applyData(data)
  } catch (e) {
    error.value = e.message || t('site.loadFailed')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const payload = {
      brand: form.brand,
      contactEmail: form.contactEmail,
      loginUrl: form.loginUrl,
      downloads: { ...form.downloads },
      shots: form.shots.map((s, i) => ({ src: s.src, key: s.key ?? i })),
      i18n: JSON.parse(JSON.stringify(form.i18n)),
    }
    const { data } = await updateSiteConfig(payload)
    applyData(data)
    success.value = t('site.saveSuccess')
  } catch (e) {
    error.value = e.message || t('site.saveFailed')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.panel {
  margin-bottom: 20px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-elevated);
}

.panel-title {
  margin: 0 0 14px;
  font-size: 16px;
}

.subhead {
  margin: 18px 0 10px;
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
}

.field-span {
  grid-column: 1 / -1;
}

.textarea {
  min-height: 72px;
  resize: vertical;
  padding: 10px 12px;
}

.download-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.download-card {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
}

.download-card h3 {
  margin: 0 0 10px;
  font-size: 14px;
}

.lang-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.lang-tab {
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  font-size: 12px;
}

.lang-tab.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: #fff;
}

.login-ok {
  color: var(--success);
  margin: 0 0 12px;
}

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
}

@media (max-width: 900px) {
  .form-grid,
  .download-grid {
    grid-template-columns: 1fr;
  }
}
</style>
