<!-- 管理端-全站笔记列表与编辑删除。 -->
<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ t('notes.title') }}</h1>
        <p>{{ t('notes.subtitle') }}</p>
      </div>
    </div>

    <PageFilters page-key="notes" @change="onFiltersChange" />

    <div class="toolbar">
      <input
        v-model="q"
        class="input"
        :placeholder="t('notes.searchPh')"
        @keyup.enter="search"
      />
      <button class="btn" type="button" @click="search">{{ t('common.search') }}</button>
      <button class="btn btn-ghost" type="button" @click="reset">{{ t('common.reset') }}</button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('notes.col.title') }}</th>
            <th>{{ t('notes.col.uid') }}</th>
            <th>{{ t('notes.col.nickname') }}</th>
            <th>{{ t('notes.col.platform') }}</th>
            <th>{{ t('notes.col.country') }}</th>
            <th>{{ t('notes.col.updated') }}</th>
            <th>{{ t('notes.col.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="7" class="empty">{{ t('notes.empty') }}</td>
          </tr>
          <tr v-for="row in rows" :key="row.id">
            <td>
              <div class="title-cell">{{ row.title }}</div>
              <div v-if="row.content" class="preview muted">{{ preview(row.content) }}</div>
            </td>
            <td class="mono">{{ row.user_id }}</td>
            <td>{{ row.nickname || t('common.dash') }}</td>
            <td>{{ row.register_platform_label || row.register_platform || t('common.dash') }}</td>
            <td>{{ row.register_region || t('common.dash') }}</td>
            <td class="mono muted">{{ formatTime(row.updated_at || row.created_at) }}</td>
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

    <div class="pager">
      <span>{{ t('common.pager', { total, page: pageNum, pages: pages || 1 }) }}</span>
      <div class="pager-actions">
        <button class="btn" type="button" :disabled="pageNum <= 1 || loading" @click="prev">
          {{ t('common.prev') }}
        </button>
        <button
          class="btn"
          type="button"
          :disabled="pageNum >= pages || loading"
          @click="next"
        >
          {{ t('common.next') }}
        </button>
      </div>
    </div>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal">
        <h3>{{ t('notes.modal.edit') }}</h3>
        <p class="muted" style="margin: 0 0 12px">
          {{ t('notes.ownerLine', { uid: form.user_id, name: form.nickname || t('common.dash') }) }}
        </p>
        <div class="field">
          <label class="label">{{ t('notes.field.title') }}</label>
          <input v-model="form.title" class="input" />
        </div>
        <div class="field">
          <label class="label">{{ t('notes.field.content') }}</label>
          <textarea v-model="form.content" class="input" rows="8" />
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
 * 笔记管理页：查询、编辑与删除用户笔记。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { fetchNotes, updateNote, deleteNote } from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'
import { formatBeijingTimeLabel } from '../utils/time.js'
import PageFilters from '../components/PageFilters.vue'
import { loadFilters } from '../utils/filters.js'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const modalError = ref('')
const rows = ref([])
const q = ref('')
const pageNum = ref(1)
const pageSize = 20
const total = ref(0)
const filters = ref(loadFilters('notes'))
const showModal = ref(false)
const editingId = ref(null)

const form = reactive({
  title: '',
  content: '',
  user_id: '',
  nickname: '',
})

const pages = computed(() => {
  void localeVersion.value
  return Math.ceil(total.value / pageSize) || 0
})

function formatTime(iso) {
  if (!iso) return t('common.dash')
  return formatBeijingTimeLabel(iso) || t('common.dash')
}

function preview(text) {
  const s = String(text || '').trim()
  if (!s) return ''
  return s.length > 80 ? `${s.slice(0, 80)}…` : s
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, pageInfo } = await fetchNotes({
      pageNum: pageNum.value,
      pageSize,
      q: q.value.trim(),
      ...filters.value,
    })
    rows.value = Array.isArray(data) ? data : []
    total.value = pageInfo?.total ?? 0
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

function onFiltersChange(next) {
  filters.value = { ...next }
  pageNum.value = 1
  load()
}

function search() {
  pageNum.value = 1
  load()
}

function reset() {
  q.value = ''
  pageNum.value = 1
  load()
}

function prev() {
  if (pageNum.value > 1) {
    pageNum.value -= 1
    load()
  }
}

function next() {
  if (pageNum.value < pages.value) {
    pageNum.value += 1
    load()
  }
}

function openEdit(row) {
  editingId.value = row.id
  form.title = row.title || ''
  form.content = row.content || ''
  form.user_id = row.user_id
  form.nickname = row.nickname || ''
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function save() {
  if (!editingId.value) return
  const title = form.title.trim()
  if (!title) {
    modalError.value = t('notes.needTitle')
    return
  }
  saving.value = true
  modalError.value = ''
  try {
    await updateNote(editingId.value, {
      title,
      content: form.content,
    })
    showModal.value = false
    await load()
  } catch (e) {
    modalError.value = e.message || t('notes.saveFailed')
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  if (!confirm(t('notes.confirmDelete', { title: row.title || row.id }))) return
  try {
    await deleteNote(row.id)
    await load()
  } catch (e) {
    error.value = e.message || t('notes.deleteFailed')
  }
}

onMounted(load)
</script>

<style scoped>
.title-cell {
  font-weight: 600;
}
.preview {
  margin-top: 4px;
  font-size: 12px;
  max-width: 360px;
  line-height: 1.4;
}
</style>
