<!-- 管理端-LLM 模型配置列表与默认模型。 -->
<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ t('llm.title') }}</h1>
        <p>{{ t('llm.subtitle') }}</p>
      </div>
      <button class="btn btn-primary" type="button" @click="openCreate">{{ t('llm.create') }}</button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('llm.col.name') }}</th>
            <th>{{ t('llm.col.model') }}</th>
            <th>{{ t('llm.col.baseUrl') }}</th>
            <th>{{ t('llm.col.apiKey') }}</th>
            <th>{{ t('llm.col.status') }}</th>
            <th>{{ t('llm.col.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="6" class="empty">{{ t('llm.empty') }}</td>
          </tr>
          <tr v-for="row in rows" :key="row.id">
            <td>
              {{ row.name }}
              <span v-if="row.is_default" class="badge ok" style="margin-left: 6px">{{ t('llm.default') }}</span>
            </td>
            <td class="mono">{{ row.model }}</td>
            <td class="mono muted">{{ row.base_url }}</td>
            <td class="mono muted">{{ row.api_key_masked || t('common.dash') }}</td>
            <td>
              <span class="badge" :class="row.enabled ? 'ok' : 'off'">
                {{ row.enabled ? t('llm.enabled') : t('llm.disabled') }}
              </span>
            </td>
            <td>
              <button class="btn" type="button" @click="openEdit(row)">{{ t('common.edit') }}</button>
              <button class="btn btn-danger" type="button" @click="onDelete(row)">{{ t('common.delete') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <h3>{{ editingId ? t('llm.modal.edit') : t('llm.modal.create') }}</h3>
        <div class="field">
          <label class="label">{{ t('llm.field.name') }}</label>
          <input v-model="form.name" class="input" required />
        </div>
        <div class="field">
          <label class="label">{{ t('llm.field.model') }}</label>
          <input v-model="form.model" class="input" placeholder="gpt-4o-mini" />
        </div>
        <div class="field">
          <label class="label">{{ t('llm.field.baseUrl') }}</label>
          <input v-model="form.base_url" class="input" placeholder="https://api.openai.com/v1" />
        </div>
        <div class="field">
          <label class="label">{{ editingId ? t('llm.field.apiKeyEdit') : t('llm.field.apiKey') }}</label>
          <input v-model="form.api_key" class="input" type="password" autocomplete="off" />
        </div>
        <div class="field">
          <label class="label">{{ t('llm.field.remark') }}</label>
          <input v-model="form.remark" class="input" />
        </div>
        <div class="field checkbox-row">
          <input id="enabled" v-model="form.enabled" type="checkbox" />
          <label for="enabled">{{ t('llm.field.enabled') }}</label>
        </div>
        <div class="field checkbox-row">
          <input id="is_default" v-model="form.is_default" type="checkbox" />
          <label for="is_default">{{ t('llm.field.setDefault') }}</label>
        </div>
        <p v-if="modalError" class="login-error">{{ modalError }}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" @click="closeModal">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" type="button" :disabled="saving" @click="save">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 管理端-LLM 模型配置列表与默认模型。
 */
/**
 * 模型配置页：管理报告生成使用的大模型配置。
 */
import { onMounted, reactive, ref } from 'vue'
import {
  fetchLlmModels,
  createLlmModel,
  updateLlmModel,
  deleteLlmModel,
} from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'

void localeVersion.value

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const modalError = ref('')
const rows = ref([])
const showModal = ref(false)
const editingId = ref(null)

const form = reactive({
  name: '',
  model: 'gpt-4o-mini',
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  remark: '',
  enabled: true,
  is_default: false,
})

function resetForm() {
  form.name = ''
  form.model = 'gpt-4o-mini'
  form.base_url = 'https://api.openai.com/v1'
  form.api_key = ''
  form.remark = ''
  form.enabled = true
  form.is_default = false
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await fetchLlmModels()
    rows.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  modalError.value = ''
  showModal.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.name = row.name
  form.model = row.model
  form.base_url = row.base_url
  form.api_key = ''
  form.remark = row.remark || ''
  form.enabled = !!row.enabled
  form.is_default = !!row.is_default
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function save() {
  if (!form.name.trim()) {
    modalError.value = t('llm.needName')
    return
  }
  saving.value = true
  modalError.value = ''
  try {
    if (editingId.value) {
      const payload = {
        name: form.name.trim(),
        model: form.model.trim(),
        base_url: form.base_url.trim(),
        remark: form.remark,
        enabled: form.enabled,
        is_default: form.is_default,
      }
      if (form.api_key) payload.api_key = form.api_key
      await updateLlmModel(editingId.value, payload)
    } else {
      await createLlmModel({
        name: form.name.trim(),
        model: form.model.trim(),
        base_url: form.base_url.trim(),
        api_key: form.api_key,
        remark: form.remark,
        enabled: form.enabled,
        is_default: form.is_default,
      })
    }
    showModal.value = false
    await load()
  } catch (e) {
    modalError.value = e.message || t('llm.saveFailed')
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  if (!confirm(t('llm.confirmDelete', { name: row.name }))) return
  try {
    await deleteLlmModel(row.id)
    await load()
  } catch (e) {
    error.value = e.message || t('llm.deleteFailed')
  }
}

onMounted(load)
</script>
