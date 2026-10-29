<!-- 管理端-管理员账号 CRUD 与权限分配。 -->
<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ t('admins.title') }}</h1>
        <p>{{ t('admins.subtitle') }}</p>
      </div>
      <button class="btn btn-primary" type="button" @click="openCreate">{{ t('admins.create') }}</button>
    </div>

    <p v-if="error" class="login-error">{{ error }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('admins.col.id') }}</th>
            <th>{{ t('admins.col.username') }}</th>
            <th>{{ t('admins.col.nickname') }}</th>
            <th>{{ t('admins.col.perms') }}</th>
            <th>{{ t('admins.col.created') }}</th>
            <th>{{ t('admins.col.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="6" class="empty">{{ t('admins.empty') }}</td>
          </tr>
          <tr v-for="row in rows" :key="row.id">
            <td class="mono">{{ row.id }}</td>
            <td>{{ row.username }}</td>
            <td>{{ row.nickname || t('common.dash') }}</td>
            <td>
              <span
                v-for="key in rowPermKeys(row)"
                :key="key"
                class="badge ok perm-badge"
              >
                {{ permissionLabel(key) }}
              </span>
              <span v-if="!rowPermKeys(row).length" class="muted">{{ t('common.dash') }}</span>
            </td>
            <td class="mono muted">{{ formatTime(row.created_at) }}</td>
            <td>
              <button class="btn" type="button" @click="openEdit(row)">{{ t('common.edit') }}</button>
              <button
                class="btn btn-danger"
                type="button"
                :disabled="row.username === currentUsername"
                @click="onDelete(row)"
              >
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
      <div class="modal modal-wide">
        <h3>{{ editingId ? t('admins.modal.edit') : t('admins.modal.create') }}</h3>
        <div v-if="!editingId" class="field">
          <label class="label">{{ t('admins.field.username') }}</label>
          <input v-model="form.username" class="input" autocomplete="off" />
        </div>
        <div class="field">
          <label class="label">{{ t('admins.field.nickname') }}</label>
          <input v-model="form.nickname" class="input" />
        </div>
        <div class="field">
          <label class="label">{{ editingId ? t('admins.field.passwordEdit') : t('admins.field.password') }}</label>
          <input v-model="form.password" class="input" type="password" autocomplete="new-password" />
        </div>

        <div class="field">
          <label class="label">{{ t('admins.col.perms') }}</label>
          <div class="perm-all-row checkbox-row">
            <input id="perm_all" v-model="form.allPerms" type="checkbox" @change="onToggleAll" />
            <label for="perm_all">{{ t('perm.all') }}</label>
          </div>
          <div class="perm-grid" :class="{ disabled: form.allPerms }">
            <label
              v-for="p in permissionItems"
              :key="p.key"
              class="checkbox-row"
            >
              <input
                v-model="form.permissions"
                type="checkbox"
                :value="p.key"
                :disabled="form.allPerms"
              />
              <span>{{ permissionLabel(p.key) }}</span>
            </label>
          </div>
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
 * 管理端-管理员账号 CRUD 与权限分配。
 */
/**
 * 管理员页面：创建、编辑与删除后台管理员。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { fetchAdmins, createAdmin, updateAdmin, deleteAdmin } from '../api/client.js'
import { getUser, setUser } from '../stores/storage.js'
import {
  permissionCatalog,
  PERM_ALL,
  normalizePermissions,
  permissionLabel,
  allPermissionKeys,
  ensurePermissionCatalog,
} from '../utils/permissions.js'
import { t, localeVersion } from '../i18n/index.js'
import { formatBeijingTimeLabel } from '../utils/time.js'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const modalError = ref('')
const rows = ref([])
const pageNum = ref(1)
const pageSize = 20
const total = ref(0)
const showModal = ref(false)
const editingId = ref(null)

const permissionItems = computed(() => {
  void localeVersion.value
  return permissionCatalog.value
})

const currentUsername = computed(() => getUser()?.username || '')
const pages = computed(() => {
  void localeVersion.value
  return Math.ceil(total.value / pageSize) || 0
})

const form = reactive({
  username: '',
  nickname: '',
  password: '',
  allPerms: false,
  permissions: allPermissionKeys().filter((k) => k !== 'admins'),
})

function rowPermKeys(row) {
  void localeVersion.value
  return normalizePermissions(row.permissions)
}

function formatTime(iso) {
  if (!iso) return t('common.dash')
  return formatBeijingTimeLabel(iso) || t('common.dash')
}

function onToggleAll() {
  if (form.allPerms) {
    form.permissions = allPermissionKeys()
  }
}

function selectedPermissionsPayload() {
  if (form.allPerms) return [PERM_ALL]
  return [...form.permissions]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, pageInfo } = await fetchAdmins({
      pageNum: pageNum.value,
      pageSize,
    })
    rows.value = Array.isArray(data) ? data : []
    total.value = pageInfo?.total ?? 0
  } catch (e) {
    error.value = e.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.username = ''
  form.nickname = ''
  form.password = ''
  form.allPerms = false
  form.permissions = allPermissionKeys().filter((k) => k !== 'admins')
  modalError.value = ''
  showModal.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.username = row.username
  form.nickname = row.nickname || ''
  form.password = ''
  const perms = normalizePermissions(row.permissions)
  form.allPerms = perms.includes(PERM_ALL)
  form.permissions = form.allPerms ? allPermissionKeys() : [...perms]
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

function syncSelfPermissions(result) {
  const me = getUser()
  if (!me || !result || result.username !== me.username) return
  setUser({
    ...me,
    nickname: result.nickname || me.nickname,
    permissions: result.permissions || me.permissions,
  })
}

async function save() {
  saving.value = true
  modalError.value = ''
  try {
    const permissions = selectedPermissionsPayload()
    if (!form.allPerms && permissions.length === 0) {
      modalError.value = t('admins.needPerm')
      return
    }
    if (editingId.value) {
      const payload = { nickname: form.nickname, permissions }
      if (form.password) payload.password = form.password
      const { data } = await updateAdmin(editingId.value, payload)
      syncSelfPermissions(data)
    } else {
      if (!form.username.trim() || !form.password) {
        modalError.value = t('admins.needCredentials')
        return
      }
      await createAdmin({
        username: form.username.trim(),
        password: form.password,
        nickname: form.nickname,
        permissions,
      })
    }
    showModal.value = false
    await load()
  } catch (e) {
    modalError.value = e.message || t('admins.saveFailed')
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  if (!confirm(t('admins.confirmDelete', { name: row.username }))) return
  try {
    await deleteAdmin(row.id)
    await load()
  } catch (e) {
    error.value = e.message || t('admins.deleteFailed')
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

onMounted(async () => {
  await ensurePermissionCatalog().catch(() => {})
  await load()
})
</script>

<style scoped>
.perm-badge {
  margin: 0 4px 4px 0;
}

.perm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin-top: 10px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.18);
}

.perm-grid.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.perm-all-row {
  margin-bottom: 4px;
}

.modal-wide {
  width: min(560px, 100%);
}
</style>
