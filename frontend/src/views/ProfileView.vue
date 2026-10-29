<script setup>
/**
 * 桌面端个人资料页：管理资料、账号安全与应用偏好。
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { updateProfile, deleteAccount, changePassword, fetchProfile, presignAvatar } from '../api/client.js'
import { useModalLock } from '../utils/modalLock.js'
import {
  getUsername,
  getNickname,
  getAvatar,
  getSignature,
  getGender,
  getDisplayName,
  setProfileCache,
  setToken,
  setRefreshToken,
  getListUpdatedAt,
  getCloudCount,
  setUserId,
} from '../stores/storage.js'
import {
  ensureTodoCache,
  cloudCount as storeCloudCount,
  revision,
  todos,
} from '../stores/todos.js'
import { leaveSession } from '../stores/auth.js'
import { getTheme, setTheme } from '../stores/theme.js'
import {
  t,
  localeVersion,
  LOCALES,
  getLocale,
  setLocale,
} from '../i18n/index.js'
import { formatLocalTime } from '../utils/datetime.js'
import { LEGAL_PUBLIC_BASE_URL } from '../config.js'
import { toast } from '../utils/toast.js'
import { refreshUnreadCount, unreadCount, hasUnread } from '../stores/notifications.js'

const router = useRouter()
const username = ref('')
const nickname = ref('')
const avatar = ref('')
const signature = ref('')
const gender = ref('')
const displayName = ref('')
const listUpdatedAt = ref(0)
const todoCount = ref(0)
const cloudCount = ref(0)
const darkMode = ref(false)
const localeCode = ref(getLocale())

const editOpen = ref(false)
const editNickname = ref('')
const editSignature = ref('')
const editGender = ref('')
const saving = ref(false)
const avatarSaving = ref(false)

const pwdOpen = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pwdSaving = ref(false)

useModalLock(computed(() => editOpen.value || pwdOpen.value))

const privacyUrl = `${LEGAL_PUBLIC_BASE_URL}/privacy.html`
const termsUrl = `${LEGAL_PUBLIC_BASE_URL}/terms.html`

const GENDER_OPTS = [
  { value: '', labelKey: 'profile.genderUnset' },
  { value: 'male', labelKey: 'profile.genderMale' },
  { value: 'female', labelKey: 'profile.genderFemale' },
  { value: 'other', labelKey: 'profile.genderOther' },
]

const genderOptions = computed(() => {
  void localeVersion.value
  return GENDER_OPTS.map((o) => ({ value: o.value, label: t(o.labelKey) }))
})

const genderLabel = computed(() => {
  void localeVersion.value
  const hit = genderOptions.value.find((o) => o.value === gender.value)
  return hit ? hit.label : t('profile.genderUnset')
})

const avatarLetter = computed(() => {
  const name = displayName.value || t('common.user')
  return String(name).slice(0, 1).toUpperCase()
})

function formatTime(ts) {
  if (!ts) return t('profile.neverUpdated')
  return formatLocalTime(ts, { withSeconds: false }) || t('profile.neverUpdated')
}

function applyLocalProfile() {
  username.value = getUsername()
  nickname.value = getNickname()
  avatar.value = getAvatar()
  signature.value = getSignature()
  gender.value = getGender()
  displayName.value = getDisplayName()
}

function loadLocal() {
  ensureTodoCache()
  applyLocalProfile()
  listUpdatedAt.value = getListUpdatedAt()
  void revision.value
  todoCount.value = todos.value.length
  cloudCount.value = storeCloudCount.value || getCloudCount()
  darkMode.value = getTheme() === 'dark'
  localeCode.value = getLocale()
}

async function refreshFromServer() {
  try {
    const res = await fetchProfile()
    if (res.user_id) setUserId(res.user_id)
    const next = {
      nickname: res.nickname ?? '',
      avatar: res.avatar ?? '',
      signature: res.signature ?? '',
      gender: res.gender ?? '',
    }
    setProfileCache(next)
    applyLocalProfile()
  } catch {
    // keep local cache
  }
}

onMounted(() => {
  loadLocal()
  refreshFromServer()
  refreshUnreadCount({ platform: 'pc' }).catch(() => {})
})

function onDarkChange() {
  setTheme(darkMode.value ? 'dark' : 'light')
}

function onLocaleChange() {
  setLocale(localeCode.value)
  toast(t('profile.languageChanged'))
}

function openEdit() {
  editNickname.value = nickname.value
  editSignature.value = signature.value
  editGender.value = gender.value
  editOpen.value = true
}

function closeEdit() {
  if (saving.value) return
  editOpen.value = false
}

async function saveProfile() {
  saving.value = true
  try {
    const res = await updateProfile({
      nickname: editNickname.value.trim(),
      signature: editSignature.value.trim(),
      gender: editGender.value,
      avatar: avatar.value,
    })
    const next = {
      nickname: res.nickname ?? editNickname.value.trim(),
      signature: res.signature ?? editSignature.value.trim(),
      gender: res.gender ?? editGender.value,
      avatar: res.avatar ?? avatar.value,
    }
    setProfileCache(next)
    nickname.value = next.nickname
    signature.value = next.signature
    gender.value = next.gender
    avatar.value = next.avatar
    displayName.value = getDisplayName()
    editOpen.value = false
    toast(t('profile.profileSaved'))
  } catch (e) {
    toast(e.message || t('common.requestFailed'))
  } finally {
    saving.value = false
  }
}

function onAvatarFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 800 * 1024) {
    toast(t('profile.avatarTooLarge'))
    e.target.value = ''
    return
  }
  const mime = file.type || 'image/jpeg'
  avatarSaving.value = true
  ;(async () => {
    try {
      let usedPresign = false
      try {
        const signed = await presignAvatar(mime)
        if (signed?.upload_url && signed?.public_url) {
          usedPresign = true
          const put = await fetch(signed.upload_url, {
            method: 'PUT',
            headers: signed.headers || { 'Content-Type': mime },
            body: file,
          })
          if (!put.ok) throw new Error('upload failed')
          const res = await updateProfile({ avatar: signed.public_url })
          avatar.value = res.avatar || signed.public_url
          setProfileCache({ avatar: avatar.value })
          toast(t('profile.profileSaved'))
          return
        }
      } catch (e) {
        // OSS enabled but upload failed — do not fall back to data URL (server rejects it)
        if (usedPresign) throw e
        // OSS not configured / presign unavailable — fall through to data URL
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('read failed'))
        reader.readAsDataURL(file)
      })
      if (!dataUrl || dataUrl.length > 550000) {
        toast(t('profile.avatarTooLarge'))
        return
      }
      const res = await updateProfile({ avatar: dataUrl })
      avatar.value = res.avatar || dataUrl
      setProfileCache({ avatar: avatar.value })
      toast(t('profile.profileSaved'))
    } catch (err) {
      toast(err.message || t('profile.avatarFailed'))
    } finally {
      avatarSaving.value = false
    }
  })()
  e.target.value = ''
}

function openPassword() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  pwdSaving.value = false
  pwdOpen.value = true
}

function closePassword() {
  if (pwdSaving.value) return
  pwdOpen.value = false
}

async function savePassword() {
  const oldPw = oldPassword.value
  const next = newPassword.value
  const confirm = confirmPassword.value
  if (!oldPw) {
    toast(t('profile.passwordNeedOld'))
    return
  }
  if (!next || next.length < 6) {
    toast(t('profile.passwordShort'))
    return
  }
  if (next !== confirm) {
    toast(t('profile.passwordMismatch'))
    return
  }
  pwdSaving.value = true
  try {
    const result = await changePassword(oldPw, next)
    if (result?.access_token) setToken(result.access_token)
    if (result?.refresh_token) setRefreshToken(result.refresh_token)
    pwdOpen.value = false
    toast(t('profile.passwordChanged'))
  } catch (err) {
    toast(err.message || t('profile.passwordFailed'))
  } finally {
    pwdSaving.value = false
  }
}

async function handleLogout() {
  if (!window.confirm(t('profile.logoutContent'))) return
  await leaveSession()
  const { redirectToSiteLogoutIfNeeded } = await import('../utils/siteReturn.js')
  if (redirectToSiteLogoutIfNeeded()) return
  router.replace({ name: 'login' })
}

async function handleDelete() {
  if (!window.confirm(t('profile.deleteContent'))) return
  try {
    await deleteAccount()
    await leaveSession()
    toast(t('profile.deleteScheduled'))
    const { redirectToSiteLogoutIfNeeded } = await import('../utils/siteReturn.js')
    if (redirectToSiteLogoutIfNeeded()) return
    router.replace({ name: 'login' })
  } catch (e) {
    toast(e.message || t('profile.deleteFailed'))
  }
}

const countsLabel = computed(() => {
  void localeVersion.value
  void revision.value
  return t('profile.taskCounts', { local: todoCount.value, cloud: cloudCount.value })
})
</script>

<template>
  <div class="profile-layout">
    <section class="panel profile-hero">
      <div class="avatar-wrap">
        <div class="avatar-frame">
          <img v-if="avatar" :src="avatar" alt="" class="avatar-img" />
          <div v-else class="avatar-img letter">{{ avatarLetter }}</div>
        </div>
        <label class="avatar-btn" :class="{ busy: avatarSaving }">
          <span>{{ avatarSaving ? '…' : t('profile.changeAvatar') }}</span>
          <input type="file" accept="image/*" hidden :disabled="avatarSaving" @change="onAvatarFile" />
        </label>
      </div>

      <div class="profile-meta">
        <h2 class="profile-name">{{ displayName || t('common.user') }}</h2>
        <p class="profile-account">{{ t('profile.account', { username: username || '—' }) }}</p>
        <p v-if="signature" class="profile-bio">{{ signature }}</p>
        <div class="profile-chips">
          <span class="meta-chip">{{ genderLabel }}</span>
          <span class="meta-chip">{{ countsLabel }}</span>
        </div>
        <div class="profile-hero-actions">
          <button type="button" class="btn btn-primary btn-compact" @click="openEdit">
            {{ t('profile.editProfile') }}
          </button>
        </div>
      </div>
    </section>

    <div class="profile-side">
      <section class="panel settings-list">
        <button type="button" class="setting-row" @click="router.push({ name: 'notifications' })">
          <span class="setting-title">{{ t('profile.notifications') }}</span>
          <span class="setting-trailing">
            <span v-if="hasUnread" class="notif-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
            <span class="setting-chevron" aria-hidden="true">›</span>
          </span>
        </button>

        <button type="button" class="setting-row" @click="openPassword">
          <span class="setting-title">{{ t('profile.changePassword') }}</span>
          <span class="setting-trailing">
            <span class="setting-chevron" aria-hidden="true">›</span>
          </span>
        </button>

        <div class="setting-row">
          <span class="setting-title">{{ t('profile.darkMode') }}</span>
          <span class="setting-trailing">
            <label class="switch" :aria-label="t('profile.darkMode')">
              <input v-model="darkMode" type="checkbox" @change="onDarkChange" />
              <span class="switch-track" aria-hidden="true" />
            </label>
          </span>
        </div>

        <label class="setting-row setting-row-select">
          <span class="setting-title">{{ t('profile.language') }}</span>
          <span class="setting-trailing">
            <select class="setting-select" v-model="localeCode" @change="onLocaleChange">
              <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.name }}</option>
            </select>
            <span class="setting-chevron" aria-hidden="true">›</span>
          </span>
        </label>

        <div class="setting-row">
          <span class="setting-title">{{ t('profile.listTimestamp') }}</span>
          <span class="setting-trailing">
            <span class="setting-value">{{ formatTime(listUpdatedAt) }}</span>
          </span>
        </div>

        <a class="setting-row" :href="privacyUrl" target="_blank" rel="noopener">
          <span class="setting-title">{{ t('profile.privacy') }}</span>
          <span class="setting-trailing">
            <span class="setting-chevron" aria-hidden="true">›</span>
          </span>
        </a>
        <a class="setting-row" :href="termsUrl" target="_blank" rel="noopener">
          <span class="setting-title">{{ t('profile.terms') }}</span>
          <span class="setting-trailing">
            <span class="setting-chevron" aria-hidden="true">›</span>
          </span>
        </a>
      </section>

      <section class="panel settings-list settings-actions">
        <button type="button" class="setting-row setting-danger" @click="handleLogout">
          <span class="setting-title">{{ t('profile.logout') }}</span>
        </button>
        <button type="button" class="setting-row setting-danger-soft" @click="handleDelete">
          <span class="setting-title">{{ t('profile.deleteAccount') }}</span>
        </button>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="editOpen" class="modal-backdrop" @click.self="closeEdit">
        <div class="modal profile-edit-modal" role="dialog" :aria-label="t('profile.editProfile')">
          <h2>{{ t('profile.editProfile') }}</h2>
          <div class="field">
            <label>{{ t('profile.nickname') }}</label>
            <input
              v-model="editNickname"
              :placeholder="t('profile.nicknamePh')"
              autocomplete="nickname"
              maxlength="40"
            />
          </div>
          <div class="field">
            <label>{{ t('profile.signature') }}</label>
            <textarea
              v-model="editSignature"
              rows="3"
              :placeholder="t('profile.signaturePh')"
              maxlength="120"
            />
          </div>
          <div class="field">
            <label>{{ t('profile.gender') }}</label>
            <select v-model="editGender">
              <option v-for="o in genderOptions" :key="o.value || 'unset'" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" :disabled="saving" @click="closeEdit">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="saving" @click="saveProfile">
              {{ saving ? '…' : t('common.save') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="pwdOpen" class="modal-backdrop" @click.self="closePassword">
        <div class="modal profile-pwd-modal" role="dialog" :aria-label="t('profile.changePasswordTitle')">
          <h2>{{ t('profile.changePasswordTitle') }}</h2>
          <div class="field">
            <label>{{ t('profile.oldPassword') }}</label>
            <input
              v-model="oldPassword"
              type="password"
              autocomplete="current-password"
              :placeholder="t('profile.oldPasswordPh')"
            />
          </div>
          <div class="field">
            <label>{{ t('profile.newPassword') }}</label>
            <input
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              :placeholder="t('profile.newPasswordPh')"
            />
          </div>
          <div class="field">
            <label>{{ t('profile.confirmPassword') }}</label>
            <input
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              :placeholder="t('profile.confirmPasswordPh')"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" :disabled="pwdSaving" @click="closePassword">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="btn btn-primary" :disabled="pwdSaving" @click="savePassword">
              {{ pwdSaving ? t('profile.passwordSaving') : t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
