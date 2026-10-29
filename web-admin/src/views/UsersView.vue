<!-- 管理端-用户分页、软删/恢复/硬删。 -->
<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ t('users.title') }}</h1>
        <p>{{ t('users.subtitle') }}</p>
      </div>
      <button class="btn btn-primary" type="button" @click="openCreate">{{ t('users.create') }}</button>
    </div>

    <PageFilters page-key="users" @change="onFiltersChange" />

    <div class="toolbar">
      <input
        v-model="q"
        class="input"
        :placeholder="t('users.searchPh')"
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
            <th>{{ t('users.col.uid') }}</th>
            <th>{{ t('users.col.avatar') }}</th>
            <th>{{ t('users.col.nickname') }}</th>
            <th>{{ t('users.col.gender') }}</th>
            <th>{{ t('users.col.account') }}</th>
            <th>{{ t('users.col.password') }}</th>
            <th>{{ t('users.col.method') }}</th>
            <th>{{ t('users.col.platform') }}</th>
            <th>{{ t('users.col.language') }}</th>
            <th>{{ t('users.col.region') }}</th>
            <th>{{ t('users.col.created') }}</th>
            <th>{{ t('users.col.status') }}</th>
            <th>{{ t('users.col.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="13" class="empty">{{ t('users.empty') }}</td>
          </tr>
          <tr v-for="row in rows" :key="row.id">
            <td class="mono">{{ row.id }}</td>
            <td>
              <img
                v-if="row.avatar"
                class="avatar-thumb"
                :src="row.avatar"
                alt=""
              />
              <span v-else class="avatar-placeholder">{{ t('common.dash') }}</span>
            </td>
            <td>{{ row.nickname || t('common.dash') }}</td>
            <td>{{ genderLabel(row.gender) }}</td>
            <td class="mono">{{ row.username }}</td>
            <td class="muted">••••••</td>
            <td>{{ methodLabel(row.register_method) }}</td>
            <td>{{ row.register_platform_label || row.register_platform || t('common.dash') }}</td>
            <td class="mono">{{ row.device_language || t('common.dash') }}</td>
            <td>{{ row.register_region || t('common.dash') }}</td>
            <td class="mono muted">{{ formatTime(row.created_at) }}</td>
            <td>
              <span class="badge" :class="row.deleted_at ? 'off' : 'ok'">
                {{ row.deleted_at ? t('users.statusDeleted') : t('users.statusOk') }}
              </span>
            </td>
            <td class="ops">
              <button class="btn" type="button" @click="openEdit(row)">{{ t('common.edit') }}</button>
              <button class="btn" type="button" @click="openResetPwd(row)">{{ t('users.resetPwd') }}</button>
              <button
                v-if="!row.deleted_at"
                class="btn btn-danger"
                type="button"
                @click="onSoftDelete(row)"
              >
                {{ t('common.delete') }}
              </button>
              <button
                v-else
                class="btn"
                type="button"
                @click="onRestore(row)"
              >
                {{ t('users.restore') }}
              </button>
              <button class="btn btn-danger" type="button" @click="onHardDelete(row)">
                {{ t('users.hardDelete') }}
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
      <div class="modal modal-wide">
        <h3>
          {{
            modalMode === 'create'
              ? t('users.modal.create')
              : modalMode === 'password'
                ? t('users.modal.password')
                : t('users.modal.edit')
          }}
        </h3>

        <template v-if="modalMode === 'password'">
          <p class="muted" style="margin: 0 0 12px">{{ t('users.accountLine', { name: form.username }) }}</p>
          <div class="field">
            <label class="label">{{ t('users.field.newPasswordHint') }}</label>
            <input v-model="form.password" class="input" type="password" autocomplete="new-password" />
          </div>
        </template>

        <template v-else>
          <div v-if="modalMode === 'create'" class="field">
            <label class="label">{{ t('users.field.usernameCreate') }}</label>
            <input v-model="form.username" class="input" autocomplete="off" />
          </div>
          <div v-if="modalMode === 'create'" class="field">
            <label class="label">{{ t('users.field.passwordCreate') }}</label>
            <input v-model="form.password" class="input" type="password" autocomplete="new-password" />
          </div>
          <div class="field">
            <label class="label">{{ t('users.field.nickname') }}</label>
            <input v-model="form.nickname" class="input" />
          </div>
          <div class="field">
            <label class="label">{{ t('users.field.gender') }}</label>
            <select v-model="form.gender" class="input">
              <option value="">{{ t('users.gender.unset') }}</option>
              <option value="male">{{ t('users.gender.male') }}</option>
              <option value="female">{{ t('users.gender.female') }}</option>
              <option value="other">{{ t('users.gender.other') }}</option>
            </select>
          </div>
          <div class="field">
            <label class="label">{{ t('users.field.avatar') }}</label>
            <input v-model="form.avatar" class="input" :placeholder="t('users.avatarPh')" />
          </div>
          <div class="field">
            <label class="label">{{ t('users.field.method') }}</label>
            <select v-model="form.register_method" class="input">
              <option value="password">{{ t('users.method.password') }}</option>
              <option value="apple">{{ t('users.method.apple') }}</option>
              <option value="google">{{ t('users.method.google') }}</option>
            </select>
          </div>
          <div class="field">
            <label class="label">{{ t('users.field.region') }}</label>
            <select v-model="form.register_region" class="input">
              <option value="">{{ t('filters.countryAll') }}</option>
              <option
                v-for="opt in countrySelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label class="label">{{ t('users.field.language') }}</label>
            <select v-model="form.device_language" class="input">
              <option value="">{{ t('filters.languageAll') }}</option>
              <option
                v-for="opt in languageSelectOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label class="label">{{ t('users.field.platform') }}</label>
            <select v-model="form.register_platform" class="input">
              <option value="">{{ t('users.platform.unset') }}</option>
              <option value="ios">{{ t('users.platform.ios') }}</option>
              <option value="android">{{ t('users.platform.android') }}</option>
              <option value="web">{{ t('users.platform.web') }}</option>
              <option value="pc">{{ t('users.platform.pc') }}</option>
              <option value="unknown">{{ t('users.platform.unknown') }}</option>
            </select>
          </div>
        </template>

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
 * 管理端-用户分页、软删/恢复/硬删。
 */
/**
 * 用户管理页：查询、编辑、停用与恢复用户。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import {
  fetchUsers,
  createUser,
  updateUser,
  softDeleteUser,
  restoreUser,
  hardDeleteUser,
} from '../api/client.js'
import { t, localeVersion } from '../i18n/index.js'
import { formatBeijingTimeLabel } from '../utils/time.js'
import PageFilters from '../components/PageFilters.vue'
import { loadFilters } from '../utils/filters.js'
import { COUNTRY_OPTIONS, LANGUAGE_OPTIONS } from '../utils/geo.js'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const modalError = ref('')
const rows = ref([])
const q = ref('')
const pageNum = ref(1)
const pageSize = 20
const total = ref(0)
const filters = ref(loadFilters('users'))
const showModal = ref(false)
const modalMode = ref('edit') // create | edit | password
const editingId = ref(null)

const pages = computed(() => {
  void localeVersion.value
  return Math.ceil(total.value / pageSize) || 0
})

const form = reactive({
  username: '',
  password: '',
  nickname: '',
  gender: '',
  avatar: '',
  register_method: 'password',
  register_region: '',
  register_platform: '',
  device_language: '',
})

const countrySelectOptions = computed(() => {
  void localeVersion.value
  const opts = COUNTRY_OPTIONS.map((o) => ({
    value: o.value,
    label: `${t(o.labelKey)} (${o.value})`,
  }))
  const cur = (form.register_region || '').trim()
  if (cur && !opts.some((o) => o.value === cur)) {
    opts.unshift({ value: cur, label: cur })
  }
  return opts
})

const languageSelectOptions = computed(() => {
  void localeVersion.value
  const opts = LANGUAGE_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.labelKey),
  }))
  const cur = (form.device_language || '').trim()
  if (cur && !opts.some((o) => o.value === cur)) {
    opts.unshift({ value: cur, label: cur })
  }
  return opts
})

function formatTime(iso) {
  if (!iso) return t('common.dash')
  return formatBeijingTimeLabel(iso) || t('common.dash')
}

function genderLabel(g) {
  void localeVersion.value
  if (!g) return t('common.dash')
  const key = `users.gender.${g}`
  const label = t(key)
  return label === key ? g : label
}

function methodLabel(m) {
  void localeVersion.value
  if (!m) return t('common.dash')
  const normalized = m === 'ios' ? 'apple' : m
  const key = `users.method.${normalized}`
  const label = t(key)
  return label === key ? m : label
}

function resetForm() {
  form.username = ''
  form.password = ''
  form.nickname = ''
  form.gender = ''
  form.avatar = ''
  form.register_method = 'password'
  form.register_region = ''
  form.register_platform = ''
  form.device_language = ''
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, pageInfo } = await fetchUsers({
      pageNum: pageNum.value,
      pageSize,
      q: q.value.trim(),
      role: 'user',
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

function openCreate() {
  modalMode.value = 'create'
  editingId.value = null
  resetForm()
  modalError.value = ''
  showModal.value = true
}

function openEdit(row) {
  modalMode.value = 'edit'
  editingId.value = row.id
  form.username = row.username
  form.password = ''
  form.nickname = row.nickname || ''
  form.gender = row.gender || ''
  form.avatar = row.avatar || ''
  form.register_method = row.register_method || 'password'
  form.register_region = row.register_region || ''
  form.register_platform = row.register_platform || ''
  form.device_language = row.device_language || ''
  modalError.value = ''
  showModal.value = true
}

function openResetPwd(row) {
  modalMode.value = 'password'
  editingId.value = row.id
  form.username = row.username
  form.password = ''
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function save() {
  saving.value = true
  modalError.value = ''
  try {
    if (modalMode.value === 'create') {
      if (!form.username.trim() || !form.password) {
        modalError.value = t('users.needCredentials')
        return
      }
      await createUser({
        username: form.username.trim(),
        password: form.password,
        nickname: form.nickname,
        gender: form.gender,
        avatar: form.avatar,
        register_method: form.register_method,
        register_region: form.register_region,
        register_platform: form.register_platform,
        device_language: form.device_language,
      })
    } else if (modalMode.value === 'password') {
      if (!form.password || form.password.length < 6) {
        modalError.value = t('users.needPassword')
        return
      }
      await updateUser(editingId.value, { password: form.password })
    } else {
      await updateUser(editingId.value, {
        nickname: form.nickname,
        gender: form.gender,
        avatar: form.avatar,
        register_method: form.register_method,
        register_region: form.register_region,
        register_platform: form.register_platform,
        device_language: form.device_language,
      })
    }
    showModal.value = false
    await load()
  } catch (e) {
    modalError.value = e.message || t('users.saveFailed')
  } finally {
    saving.value = false
  }
}

async function onSoftDelete(row) {
  if (!confirm(t('users.confirmSoft', { name: row.username }))) return
  try {
    await softDeleteUser(row.id)
    await load()
  } catch (e) {
    error.value = e.message || t('users.deleteFailed')
  }
}

async function onRestore(row) {
  try {
    await restoreUser(row.id)
    await load()
  } catch (e) {
    error.value = e.message || t('users.restoreFailed')
  }
}

async function onHardDelete(row) {
  if (!confirm(t('users.confirmHard', { name: row.username }))) return
  try {
    await hardDeleteUser(row.id)
    await load()
  } catch (e) {
    error.value = e.message || t('users.hardDeleteFailed')
  }
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

onMounted(load)
</script>

<style scoped>
.avatar-thumb {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.06);
}

.avatar-placeholder {
  color: var(--text-muted);
}

.ops {
  white-space: nowrap;
}

.ops .btn {
  margin: 2px 4px 2px 0;
}

.modal-wide {
  width: min(560px, 100%);
}
</style>
