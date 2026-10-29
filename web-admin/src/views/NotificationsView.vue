<!-- 管理端-通知规则与临时 campaign 管理。 -->
<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ t('notif.title') }}</h1>
        <p>{{ t('notif.subtitle') }}</p>
      </div>
    </div>

    <div class="tabs">
      <button
        type="button"
        class="tab"
        :class="{ active: tab === 'rules' }"
        @click="tab = 'rules'"
      >
        {{ t('notif.tab.rules') }}
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: tab === 'campaigns' }"
        @click="switchCampaigns"
      >
        {{ t('notif.tab.campaigns') }}
      </button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>
    <p v-if="success" class="login-ok">{{ success }}</p>

    <!-- ── Rules ── -->
    <template v-if="tab === 'rules'">
      <div class="toolbar">
        <label class="checkbox-row">
          <input v-model="rules.enabled" type="checkbox" />
          <span>{{ t('notif.rules.enabled') }}</span>
        </label>
        <div class="toolbar-actions">
          <button class="btn" type="button" :disabled="rulesLoading" @click="loadRules">
            {{ t('common.refresh') }}
          </button>
          <button class="btn btn-ghost" type="button" :disabled="rulesSaving" @click="onResetRules">
            {{ t('notif.rules.reset') }}
          </button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="rulesSaving"
            @click="saveRules"
          >
            {{ rulesSaving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
      <p class="muted tip">{{ t('notif.rules.tip') }}</p>

      <section class="panel">
        <h2 class="panel-title">{{ t('notif.section.principles') }}</h2>
        <div class="chip-grid">
          <label v-for="(val, key) in rules.principles" :key="key" class="checkbox-row">
            <input v-model="rules.principles[key]" type="checkbox" />
            <span>{{ principleLabel(key) }}</span>
          </label>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">{{ t('notif.section.scenes') }}</h2>
        <div v-for="scene in rules.permission_scenes" :key="scene.id" class="scene-card">
          <div class="scene-head">
            <strong>{{ sceneLabel(scene.id) }}</strong>
            <span class="badge" :class="scene.enabled ? 'ok' : 'off'">
              {{ priorityLabel(scene.priority) }}
            </span>
            <label class="checkbox-row">
              <input v-model="scene.enabled" type="checkbox" />
              <span>{{ t('notif.scene.enabled') }}</span>
            </label>
          </div>
          <p class="muted scene-meta">
            <span>{{ t('notif.scene.trigger') }}：{{ triggerLabel(scene.trigger) }}</span>
            <span v-if="scene.value"> · {{ t('notif.scene.value') }}：{{ scene.value }}</span>
          </p>
          <div class="form-grid">
            <div class="field">
              <label class="label">{{ t('notif.l1.title') }}</label>
              <input v-model="scene.l1.title" class="input" />
            </div>
            <div class="field">
              <label class="label">{{ t('notif.l1.primary') }}</label>
              <input v-model="scene.l1.primary" class="input" />
            </div>
            <div class="field field-span">
              <label class="label">{{ t('notif.l1.body') }}</label>
              <input v-model="scene.l1.body" class="input" />
            </div>
            <div class="field">
              <label class="label">{{ t('notif.l1.secondary') }}</label>
              <input v-model="scene.l1.secondary" class="input" />
            </div>
            <div class="field">
              <label class="label">{{ t('notif.scene.channel') }}</label>
              <select v-model="scene.channel" class="input">
                <option v-for="opt in channelOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">{{ t('notif.section.channels') }}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ t('notif.col.channel') }}</th>
                <th>{{ t('notif.col.label') }}</th>
                <th>{{ t('notif.col.defaultOn') }}</th>
                <th>{{ t('notif.col.v1Send') }}</th>
                <th>{{ t('notif.col.priority') }}</th>
                <th>{{ t('notif.col.window') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ch, id) in rules.channels" :key="id">
                <td>{{ channelLabel(id) }}</td>
                <td>
                  <input v-model="ch.label" class="input input-inline" />
                </td>
                <td>
                  <input v-model="ch.enabled_default" type="checkbox" :disabled="id === 'promo'" />
                </td>
                <td>
                  <input v-model="ch.v1_send" type="checkbox" :disabled="id === 'promo'" />
                </td>
                <td>{{ priorityLabel(ch.priority) }}</td>
                <td class="muted">{{ ch.allow_window_default || t('common.dash') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted tip">{{ t('notif.channels.promoNote') }}</p>
      </section>

      <section class="panel">
        <h2 class="panel-title">{{ t('notif.section.frequency') }}</h2>
        <div class="form-grid">
          <div v-for="key in freqKeys" :key="key" class="field">
            <label class="label">{{ freqLabel(key) }}</label>
            <input
              v-if="typeof rules.frequency[key] === 'boolean'"
              v-model="rules.frequency[key]"
              type="checkbox"
            />
            <input
              v-else
              v-model.number="rules.frequency[key]"
              class="input"
              type="number"
              min="0"
            />
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">{{ t('notif.section.quiet') }}</h2>
        <div class="form-grid">
          <div class="field">
            <label class="checkbox-row">
              <input v-model="rules.quiet_hours.enabled" type="checkbox" />
              <span>{{ t('notif.quiet.enabled') }}</span>
            </label>
          </div>
          <div class="field">
            <label class="label">{{ t('notif.quiet.start') }}</label>
            <input v-model="rules.quiet_hours.start" class="input" placeholder="22:00" />
          </div>
          <div class="field">
            <label class="label">{{ t('notif.quiet.end') }}</label>
            <input v-model="rules.quiet_hours.end" class="input" placeholder="08:00" />
          </div>
          <div class="field">
            <label class="checkbox-row">
              <input v-model="rules.quiet_hours.defer_due_to_next_window" type="checkbox" />
              <span>{{ t('notif.quiet.defer') }}</span>
            </label>
          </div>
          <div class="field">
            <label class="checkbox-row">
              <input v-model="rules.quiet_hours.system_bypass" type="checkbox" />
              <span>{{ t('notif.quiet.systemBypass') }}</span>
            </label>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">{{ t('notif.section.l3') }}</h2>
        <div class="form-grid">
          <div class="field">
            <label class="checkbox-row">
              <input v-model="rules.l3_settings_guide.enabled" type="checkbox" />
              <span>{{ t('notif.l3.enabled') }}</span>
            </label>
          </div>
          <div class="field">
            <label class="label">{{ t('notif.l3.cooldownDays') }}</label>
            <input v-model.number="rules.l3_settings_guide.cooldown_days" class="input" type="number" min="1" />
          </div>
          <div class="field">
            <label class="label">{{ t('notif.l3.maxInWindow') }}</label>
            <input v-model.number="rules.l3_settings_guide.max_in_window" class="input" type="number" min="1" />
          </div>
        </div>
      </section>
    </template>

    <!-- ── Campaigns ── -->
    <template v-else>
      <div class="toolbar">
        <select v-model="campaignStatusFilter" class="input" @change="loadCampaigns">
          <option value="">{{ t('notif.campaign.filterAll') }}</option>
          <option value="draft">{{ t('notif.campaign.status.draft') }}</option>
          <option value="scheduled">{{ t('notif.campaign.status.scheduled') }}</option>
          <option value="active">{{ t('notif.campaign.status.active') }}</option>
          <option value="ended">{{ t('notif.campaign.status.ended') }}</option>
          <option value="cancelled">{{ t('notif.campaign.status.cancelled') }}</option>
        </select>
        <button class="btn btn-primary" type="button" @click="openCreate">
          {{ t('notif.campaign.create') }}
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('notif.campaign.col.id') }}</th>
              <th>{{ t('notif.campaign.col.title') }}</th>
              <th>{{ t('notif.campaign.col.channel') }}</th>
              <th>{{ t('notif.campaign.col.status') }}</th>
              <th>{{ t('notif.campaign.col.platforms') }}</th>
              <th>{{ t('notif.campaign.col.window') }}</th>
              <th>{{ t('notif.campaign.col.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!campaignsLoading && campaigns.length === 0">
              <td colspan="7" class="empty">{{ t('notif.campaign.empty') }}</td>
            </tr>
            <tr v-for="row in campaigns" :key="row.id">
              <td class="mono">{{ row.id }}</td>
              <td>{{ row.title }}</td>
              <td>{{ channelLabel(row.channel) }}</td>
              <td>
                <span class="badge" :class="row.status === 'active' ? 'ok' : 'off'">
                  {{ statusLabel(row.status) }}
                </span>
              </td>
              <td class="muted">{{ platformsLabel(row.platforms) }}</td>
              <td class="muted">
                {{ formatTime(row.start_at) }} → {{ formatTime(row.end_at) }}
              </td>
              <td class="ops">
                <button class="btn" type="button" @click="openEdit(row)">{{ t('common.edit') }}</button>
                <button class="btn btn-danger" type="button" @click="onDelete(row)">
                  {{ t('common.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal modal-wide">
        <h3>{{ editingId ? t('notif.campaign.edit') : t('notif.campaign.create') }}</h3>
        <div class="field">
          <label class="label">{{ t('notif.campaign.col.title') }}</label>
          <input v-model="form.title" class="input" />
        </div>
        <div class="field">
          <label class="label">{{ t('notif.campaign.body') }}</label>
          <textarea v-model="form.body" class="input" rows="4" />
        </div>
        <div class="form-grid">
          <div class="field">
            <label class="label">{{ t('notif.campaign.col.channel') }}</label>
            <select v-model="form.channel" class="input">
              <option value="system">{{ t('notif.channel.system') }}</option>
              <option value="promo">{{ t('notif.channel.promo') }}</option>
            </select>
          </div>
          <div class="field">
            <label class="label">{{ t('notif.campaign.col.status') }}</label>
            <select v-model="form.status" class="input">
              <option value="draft">{{ t('notif.campaign.status.draft') }}</option>
              <option value="scheduled">{{ t('notif.campaign.status.scheduled') }}</option>
              <option value="active">{{ t('notif.campaign.status.active') }}</option>
              <option value="ended">{{ t('notif.campaign.status.ended') }}</option>
              <option value="cancelled">{{ t('notif.campaign.status.cancelled') }}</option>
            </select>
          </div>
          <div class="field">
            <label class="label">{{ t('notif.campaign.col.platforms') }}</label>
            <input
              v-model="form.platforms"
              class="input"
              :placeholder="t('notif.campaign.platform.hint')"
            />
          </div>
          <div class="field">
            <label class="label">{{ t('notif.campaign.start') }}</label>
            <input v-model="form.start_at" class="input" type="datetime-local" />
          </div>
          <div class="field">
            <label class="label">{{ t('notif.campaign.end') }}</label>
            <input v-model="form.end_at" class="input" type="datetime-local" />
          </div>
          <div class="field">
            <label class="checkbox-row">
              <input v-model="form.bypass_quiet" type="checkbox" :disabled="form.channel !== 'system'" />
              <span>{{ t('notif.campaign.bypassQuiet') }}</span>
            </label>
          </div>
        </div>
        <div class="field">
          <label class="label">{{ t('notif.campaign.remark') }}</label>
          <input v-model="form.remark" class="input" />
        </div>
        <p v-if="modalError" class="login-error">{{ modalError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" @click="closeModal">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" type="button" :disabled="saving" @click="saveCampaign">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 管理端-通知规则与临时 campaign 管理。
 */
/**
 * 管理后台通知页：配置通知规则并管理推送活动。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import {
  fetchNotificationRules,
  updateNotificationRules,
  resetNotificationRules,
  fetchNotificationCampaigns,
  createNotificationCampaign,
  updateNotificationCampaign,
  deleteNotificationCampaign,
} from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'
import { formatBeijingTime, formatBeijingTimeLabel } from '../utils/time.js'

const tab = ref('rules')
const error = ref('')
const success = ref('')
const rulesLoading = ref(false)
const rulesSaving = ref(false)
const campaignsLoading = ref(false)
const campaigns = ref([])
const campaignStatusFilter = ref('')
const showModal = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')

const rules = reactive({
  enabled: true,
  principles: {},
  permission_scenes: [],
  channels: {},
  frequency: {},
  quiet_hours: {
    enabled: true,
    start: '22:00',
    end: '08:00',
    defer_due_to_next_window: true,
    system_bypass: true,
  },
  l3_settings_guide: {
    enabled: true,
    cooldown_days: 14,
    max_in_window: 2,
  },
})

const form = reactive({
  title: '',
  body: '',
  channel: 'system',
  status: 'draft',
  platforms: 'all',
  start_at: '',
  end_at: '',
  bypass_quiet: false,
  remark: '',
})

const freqKeys = computed(() => {
  void localeVersion.value
  return Object.keys(rules.frequency || {})
})

const channelOptions = computed(() => {
  void localeVersion.value
  return ['due', 'streak', 'report', 'system', 'promo'].map((value) => ({
    value,
    label: channelLabel(value),
  }))
})

function i18nOr(key, fallback) {
  void localeVersion.value
  const label = t(key)
  return label === key ? fallback : label
}

function principleLabel(key) {
  return i18nOr(`notif.principle.${key}`, key)
}

function freqLabel(key) {
  return i18nOr(`notif.freq.${key}`, key)
}

function sceneLabel(id) {
  return i18nOr(`notif.scene.${id}`, id)
}

function triggerLabel(trigger) {
  return i18nOr(`notif.trigger.${trigger}`, trigger || t('common.dash'))
}

function channelLabel(id) {
  return i18nOr(`notif.channel.${id}`, id)
}

function priorityLabel(value) {
  return i18nOr(`notif.priority.${value}`, value || t('common.dash'))
}

function statusLabel(status) {
  return i18nOr(`notif.campaign.status.${status}`, status || t('common.dash'))
}

function platformsLabel(raw) {
  void localeVersion.value
  const v = (raw || '').trim().toLowerCase()
  if (!v || v === 'all') return t('notif.campaign.platform.all')
  return raw
}

function formatTime(iso) {
  if (!iso) return t('common.dash')
  return formatBeijingTime(iso, { withSeconds: false }) || t('common.dash')
}

function toLocalInput(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function fromLocalInput(val) {
  if (!val) return null
  try {
    return new Date(val).toISOString()
  } catch {
    return null
  }
}

function applyRules(pack) {
  const r = pack?.rules || pack || {}
  rules.enabled = r.enabled !== false
  rules.principles = { ...(r.principles || {}) }
  rules.permission_scenes = (r.permission_scenes || []).map((s) => ({
    ...s,
    l1: { ...(s.l1 || {}) },
  }))
  rules.channels = JSON.parse(JSON.stringify(r.channels || {}))
  rules.frequency = { ...(r.frequency || {}) }
  rules.quiet_hours = {
    enabled: true,
    start: '22:00',
    end: '08:00',
    defer_due_to_next_window: true,
    system_bypass: true,
    ...(r.quiet_hours || {}),
  }
  rules.l3_settings_guide = {
    enabled: true,
    cooldown_days: 14,
    max_in_window: 2,
    ...(r.l3_settings_guide || {}),
  }
}

async function loadRules() {
  rulesLoading.value = true
  error.value = ''
  try {
    const { data } = await fetchNotificationRules()
    applyRules(data)
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    rulesLoading.value = false
  }
}

async function saveRules() {
  rulesSaving.value = true
  error.value = ''
  success.value = ''
  try {
    const payload = {
      rules: {
        enabled: rules.enabled,
        principles: { ...rules.principles },
        permission_scenes: rules.permission_scenes.map((s) => ({
          ...s,
          l1: { ...s.l1 },
        })),
        channels: JSON.parse(JSON.stringify(rules.channels)),
        frequency: { ...rules.frequency },
        quiet_hours: { ...rules.quiet_hours },
        l3_settings_guide: { ...rules.l3_settings_guide },
      },
    }
    const { data } = await updateNotificationRules(payload)
    applyRules(data)
    success.value = t('notif.rules.saved')
  } catch (e) {
    error.value = e.message || t('notif.rules.saveFailed')
  } finally {
    rulesSaving.value = false
  }
}

async function onResetRules() {
  if (!confirm(t('notif.rules.confirmReset'))) return
  rulesSaving.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await resetNotificationRules()
    applyRules(data)
    success.value = t('notif.rules.resetOk')
  } catch (e) {
    error.value = e.message || t('notif.rules.saveFailed')
  } finally {
    rulesSaving.value = false
  }
}

async function loadCampaigns() {
  campaignsLoading.value = true
  error.value = ''
  try {
    const { data } = await fetchNotificationCampaigns({
      pageNum: 1,
      pageSize: 100,
      status: campaignStatusFilter.value,
    })
    campaigns.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    campaignsLoading.value = false
  }
}

function switchCampaigns() {
  tab.value = 'campaigns'
  loadCampaigns()
}

function resetForm() {
  form.title = ''
  form.body = ''
  form.channel = 'system'
  form.status = 'draft'
  form.platforms = 'all'
  form.start_at = ''
  form.end_at = ''
  form.bypass_quiet = false
  form.remark = ''
}

function openCreate() {
  editingId.value = null
  resetForm()
  modalError.value = ''
  showModal.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.title = row.title || ''
  form.body = row.body || ''
  form.channel = row.channel || 'system'
  form.status = row.status || 'draft'
  form.platforms = row.platforms || 'all'
  form.start_at = toLocalInput(row.start_at)
  form.end_at = toLocalInput(row.end_at)
  form.bypass_quiet = !!row.bypass_quiet
  form.remark = row.remark || ''
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function saveCampaign() {
  if (!form.title.trim()) {
    modalError.value = t('notif.campaign.needTitle')
    return
  }
  saving.value = true
  modalError.value = ''
  try {
    const payload = {
      title: form.title.trim(),
      body: form.body,
      channel: form.channel,
      status: form.status,
      platforms: form.platforms || 'all',
      start_at: fromLocalInput(form.start_at),
      end_at: fromLocalInput(form.end_at),
      bypass_quiet: form.channel === 'system' ? form.bypass_quiet : false,
      remark: form.remark,
    }
    if (editingId.value) {
      await updateNotificationCampaign(editingId.value, payload)
    } else {
      await createNotificationCampaign(payload)
    }
    showModal.value = false
    await loadCampaigns()
  } catch (e) {
    modalError.value = e.message || t('notif.campaign.saveFailed')
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  if (!confirm(t('notif.campaign.confirmDelete', { title: row.title }))) return
  try {
    await deleteNotificationCampaign(row.id)
    await loadCampaigns()
  } catch (e) {
    error.value = e.message || t('notif.campaign.deleteFailed')
  }
}

onMounted(loadRules)
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tab {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
}
.tab.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tip {
  margin: 0 0 16px;
  font-size: 13px;
}
.panel {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(28, 36, 48, 0.55);
}
.panel-title {
  margin: 0 0 12px;
  font-size: 15px;
}
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
}
.scene-card {
  padding: 12px 0;
  border-top: 1px solid var(--border);
}
.scene-card:first-of-type {
  border-top: 0;
  padding-top: 0;
}
.scene-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 6px;
}
.scene-meta {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.45;
}
.input-inline {
  min-width: 120px;
  max-width: 200px;
  padding: 4px 8px;
  font-size: 13px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}
.field-span {
  grid-column: 1 / -1;
}
@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
.login-ok {
  color: var(--success);
  margin: 0 0 12px;
  font-size: 13px;
}
</style>
