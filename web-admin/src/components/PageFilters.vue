<!-- 管理端列表页公共筛选（平台/国家/语言等）。 -->
<template>
  <div class="page-filters">
    <label class="filter-field">
      <span>{{ t('filters.platform') }}</span>
      <select v-model="local.platform" class="input">
        <option v-for="opt in platformOptions" :key="opt.value || 'all'" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </label>
    <label class="filter-field">
      <span>{{ t('filters.dateFrom') }}</span>
      <input v-model="local.dateFrom" class="input" type="date" />
    </label>
    <label class="filter-field">
      <span>{{ t('filters.dateTo') }}</span>
      <input v-model="local.dateTo" class="input" type="date" />
    </label>
    <label class="filter-field">
      <span>{{ t('filters.country') }}</span>
      <select v-model="local.country" class="input">
        <option value="">{{ t('filters.countryAll') }}</option>
        <option v-for="opt in countryOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </label>
    <label class="filter-field">
      <span>{{ t('filters.language') }}</span>
      <select v-model="local.language" class="input">
        <option value="">{{ t('filters.languageAll') }}</option>
        <option v-for="opt in languageOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </label>
    <div class="filter-actions">
      <button class="btn btn-primary" type="button" @click="apply">{{ t('filters.apply') }}</button>
      <button class="btn btn-ghost" type="button" @click="clear">{{ t('filters.clear') }}</button>
    </div>
  </div>
</template>

<script setup>
/**
 * 管理端列表页公共筛选（平台/国家/语言等）。
 */
import { computed, reactive, watch } from 'vue'
import { t, localeVersion } from '../i18n/index.js'
import { emptyFilters, loadFilters, saveFilters } from '../utils/filters.js'
import { COUNTRY_OPTIONS, LANGUAGE_OPTIONS } from '../utils/geo.js'

const props = defineProps({
  pageKey: { type: String, required: true },
})

const emit = defineEmits(['change'])

const local = reactive({ ...loadFilters(props.pageKey) })

const platformOptions = computed(() => {
  void localeVersion.value
  return [
    { value: '', label: t('filters.platformAll') },
    { value: 'ios', label: t('filters.platform.ios') },
    { value: 'android', label: t('filters.platform.android') },
    { value: 'web', label: t('filters.platform.web') },
    { value: 'pc', label: t('filters.platform.pc') },
    { value: 'unknown', label: t('filters.platform.unknown') },
  ]
})

const countryOptions = computed(() => {
  void localeVersion.value
  const opts = COUNTRY_OPTIONS.map((o) => ({
    value: o.value,
    label: `${t(o.labelKey)} (${o.value})`,
  }))
  const cur = (local.country || '').trim()
  if (cur && !opts.some((o) => o.value === cur)) {
    opts.unshift({ value: cur, label: cur })
  }
  return opts
})

const languageOptions = computed(() => {
  void localeVersion.value
  const opts = LANGUAGE_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.labelKey),
  }))
  const cur = (local.language || '').trim()
  if (cur && !opts.some((o) => o.value === cur)) {
    opts.unshift({ value: cur, label: cur })
  }
  return opts
})

watch(
  () => props.pageKey,
  (key) => {
    Object.assign(local, loadFilters(key))
  }
)

function snapshot() {
  return {
    platform: local.platform || '',
    country: (local.country || '').trim(),
    language: (local.language || '').trim(),
    dateFrom: local.dateFrom || '',
    dateTo: local.dateTo || '',
  }
}

function apply() {
  const next = snapshot()
  saveFilters(props.pageKey, next)
  emit('change', next)
}

function clear() {
  Object.assign(local, emptyFilters())
  saveFilters(props.pageKey, emptyFilters())
  emit('change', emptyFilters())
}

defineExpose({ getFilters: snapshot, apply, clear })
</script>

<style scoped>
.page-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  align-items: flex-end;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(28, 36, 48, 0.65);
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.filter-field span {
  font-size: 12px;
  color: var(--text-muted);
}

.filter-field .input {
  min-width: 140px;
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

@media (max-width: 720px) {
  .filter-actions {
    margin-left: 0;
    width: 100%;
  }
  .filter-actions .btn {
    flex: 1;
  }
}
</style>
