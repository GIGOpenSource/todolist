<script setup>
/**
 * 个人资料页：资料编辑、头像上传、账号与偏好设置。
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlassTabBar from '../../components/GlassTabBar.vue'
import CollapsingNavBar from '../../components/CollapsingNavBar.vue'
import { resyncScrollEdges, onScrollViewEdge } from '../../utils/scrollEdgeBlur.js'
import {
  collapsingProgress,
  scrollTopFromEvent,
  readActiveScrollTop,
} from '../../utils/collapsingTitle.js'
import {
  getToken,
  getUsername,
  getNickname,
  getAvatar,
  getSignature,
  getGender,
  getDisplayName,
  setProfileCache,
  getListUpdatedAt,
  getCloudCount,
  clearAuth,
  setToken,
  setRefreshToken,
  setUserId,
} from '../../utils/storage.js'
import { ensureTodoCache, cloudCount as storeCloudCount, revision, resetTodoCache } from '../../utils/todoStore.js'
import { stopAutoSyncScheduler } from '../../utils/autoSync.js'
import { updateProfile, deleteAccount, logout, presignAvatar, changePassword, fetchProfile } from '../../api/index.js'
import { OFFICIAL_WEBSITE_URL } from '../../utils/config.js'
import { getTheme, setTheme, syncPageChrome, themeClass, LIGHT_VARS, DARK_VARS } from '../../utils/theme.js'
import { applyImmersiveStatusBar } from '../../utils/immersive.js'
import {
  t,
  localeVersion,
  LOCALES,
  getLocale,
  setLocale,
  getLocaleMeta,
} from '../../utils/i18n.js'
import { formatLocalTime } from '../../utils/datetime.js'
import {
  refreshUnreadCount,
  unreadCount as notifUnreadCount,
  hasUnread as notifHasUnread,
} from '../../utils/notificationStore.js'

const GENDER_OPTS = [
  { value: '', labelKey: 'profile.genderUnset' },
  { value: 'male', labelKey: 'profile.genderMale' },
  { value: 'female', labelKey: 'profile.genderFemale' },
  { value: 'other', labelKey: 'profile.genderOther' },
]

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
const localeIndex = ref(0)

const editVisible = ref(false)
const editNickname = ref('')
const editSignature = ref('')
const editGender = ref('')
const saving = ref(false)
const avatarSaving = ref(false)
const localeVisible = ref(false)
const titleProgress = ref(0)

const pwdVisible = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pwdSaving = ref(false)

function onProfileScroll(e) {
  onScrollViewEdge(e)
  titleProgress.value = collapsingProgress(scrollTopFromEvent(e))
}

const i18n = computed(() => {
  void localeVersion.value
  return {
    title: t('profile.title'),
    localTasks: t('profile.localTasks', { n: todoCount.value }),
    cloudTasks: t('profile.cloudTasks', { n: cloudCount.value }),
    darkMode: t('profile.darkMode'),
    language: t('profile.language'),
    listTimestamp: t('profile.listTimestamp'),
    neverUpdated: t('profile.neverUpdated'),
    myTasks: t('profile.myTasks'),
    view: t('common.view'),
    logout: t('profile.logout'),
    user: t('common.user'),
    languageName: getLocaleMeta().name,
    nickname: t('profile.nickname'),
    nicknamePh: t('profile.nicknamePh'),
    editProfile: t('profile.editProfile'),
    profileSaved: t('profile.profileSaved'),
    account: t('profile.account', { username: username.value || '—' }),
    signature: t('profile.signature'),
    signaturePh: t('profile.signaturePh'),
    gender: t('profile.gender'),
    changeAvatar: t('profile.changeAvatar'),
    cancel: t('common.cancel'),
    save: t('common.save'),
    notifications: t('profile.notifications'),
    privacy: t('profile.privacy'),
    terms: t('profile.terms'),
    website: t('profile.website'),
    deleteAccount: t('profile.deleteAccount'),
    changePassword: t('profile.changePassword'),
    changePasswordTitle: t('profile.changePasswordTitle'),
    oldPassword: t('profile.oldPassword'),
    newPassword: t('profile.newPassword'),
    confirmPassword: t('profile.confirmPassword'),
    oldPasswordPh: t('profile.oldPasswordPh'),
    newPasswordPh: t('profile.newPasswordPh'),
    confirmPasswordPh: t('profile.confirmPasswordPh'),
    passwordSaving: t('profile.passwordSaving'),
  }
})

const genderOptions = computed(() => {
  void localeVersion.value
  return GENDER_OPTS.map((o) => ({ value: o.value, label: t(o.labelKey) }))
})

const genderLabel = computed(() => {
  const hit = genderOptions.value.find((o) => o.value === gender.value)
  return hit ? hit.label : t('profile.genderUnset')
})

const avatarLetter = computed(() => {
  const name = displayName.value || i18n.value.user
  return String(name).slice(0, 1).toUpperCase()
})

function formatTime(ts) {
  if (!ts) return t('profile.neverUpdated')
  return formatLocalTime(ts, { withSeconds: false }) || t('profile.neverUpdated')
}

function applyProfileFields(p = {}) {
  if (typeof p.nickname === 'string') nickname.value = p.nickname.trim()
  if (typeof p.avatar === 'string') avatar.value = p.avatar
  if (typeof p.signature === 'string') signature.value = p.signature.trim()
  if (typeof p.gender === 'string') gender.value = p.gender.trim()
  displayName.value = getDisplayName()
  setProfileCache({
    nickname: nickname.value,
    avatar: avatar.value,
    signature: signature.value,
    gender: gender.value,
  })
}

function applyLocalProfile() {
  ensureTodoCache()
  username.value = getUsername()
  nickname.value = getNickname()
  avatar.value = getAvatar()
  signature.value = getSignature()
  gender.value = getGender()
  displayName.value = getDisplayName()
  listUpdatedAt.value = getListUpdatedAt()
  void revision.value
  todoCount.value = ensureTodoCache().length
  cloudCount.value = storeCloudCount.value || getCloudCount()
  darkMode.value = getTheme() === 'dark'
  const code = getLocale()
  const idx = LOCALES.findIndex((l) => l.code === code)
  localeIndex.value = idx >= 0 ? idx : 0
}

function load() {
  applyLocalProfile()
}

async function refreshFromServer() {
  try {
    const res = await fetchProfile()
    if (res.user_id) setUserId(res.user_id)
    setProfileCache({
      nickname: res.nickname ?? '',
      avatar: res.avatar ?? '',
      signature: res.signature ?? '',
      gender: res.gender ?? '',
    })
    applyLocalProfile()
  } catch {
    // keep local cache
  }
}

onShow(() => {
  syncPageChrome()
  resyncScrollEdges()
  titleProgress.value = collapsingProgress(readActiveScrollTop())
  if (!getToken() || !getUsername()) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  load()
  refreshFromServer()
  refreshUnreadCount().catch(() => {})
})

function onDarkChange(e) {
  const on = !!e.detail.value
  darkMode.value = on
  setTheme(on ? 'dark' : 'light')
  applyImmersiveStatusBar(!on)
}

const pageThemeClass = computed(() => themeClass())
const tintColor = computed(() => {
  void pageThemeClass.value
  const vars = getTheme() === 'dark' ? DARK_VARS : LIGHT_VARS
  return vars['--app-tint']
})

function openLocaleSheet() {
  localeVisible.value = true
}

function closeLocaleSheet() {
  localeVisible.value = false
}

function selectLocale(idx) {
  if (!Number.isFinite(idx) || idx < 0 || idx >= LOCALES.length) return
  localeIndex.value = idx
  setLocale(LOCALES[idx].code)
  localeVisible.value = false
  uni.showToast({ title: t('profile.languageChanged'), icon: 'none' })
}

function openEditProfile() {
  editNickname.value = nickname.value || ''
  editSignature.value = signature.value || ''
  editGender.value = gender.value || ''
  editVisible.value = true
}

function closeEditProfile() {
  if (saving.value) return
  editVisible.value = false
}

function selectGender(value) {
  editGender.value = value
}

async function saveProfile() {
  if (saving.value) return
  saving.value = true
  try {
    const res = await updateProfile({
      nickname: (editNickname.value || '').trim(),
      signature: (editSignature.value || '').trim(),
      gender: editGender.value || '',
    })
    applyProfileFields(res || {
      nickname: editNickname.value,
      signature: editSignature.value,
      gender: editGender.value,
      avatar: avatar.value,
    })
    editVisible.value = false
    uni.showToast({ title: t('profile.profileSaved'), icon: 'success' })
  } catch (err) {
    uni.showToast({ title: err.message || t('common.requestFailed'), icon: 'none' })
  } finally {
    saving.value = false
  }
}

function readFileAsDataUrl(filePath) {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    if (typeof fetch === 'function' && String(filePath).startsWith('blob:')) {
      fetch(filePath)
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('read failed'))
          reader.readAsDataURL(blob)
        })
        .catch(reject)
      return
    }
    // #endif
    try {
      const fs = uni.getFileSystemManager()
      fs.readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          const lower = String(filePath).toLowerCase()
          const mime = lower.includes('.png')
            ? 'image/png'
            : lower.includes('.webp')
              ? 'image/webp'
              : 'image/jpeg'
          resolve(`data:${mime};base64,${res.data}`)
        },
        fail: (err) => reject(err || new Error('read failed')),
      })
    } catch (e) {
      reject(e)
    }
  })
}

async function chooseAvatar() {
  if (avatarSaving.value) return
  uni.chooseMedia({
    count: 1,
      mediaType: ['image'],        // 新增，指定选图片
    sourceType: ['album'],       // 先只从相册选，避开相机权限问题
    success: async (res) => {
      const path = (res.tempFilePaths && res.tempFilePaths[0]) || ''
      if (!path) return
      avatarSaving.value = true
      try {
        const lower = String(path).toLowerCase()
        const mime = lower.includes('.png')
          ? 'image/png'
          : lower.includes('.webp')
            ? 'image/webp'
            : 'image/jpeg'
        // Prefer OSS direct upload when server supports it
        let usedPresign = false
        try {
          const signed = await presignAvatar(mime)
          if (signed?.upload_url && signed?.public_url) {
            usedPresign = true
            await new Promise((resolve, reject) => {
              uni.uploadFile({
                url: signed.upload_url,
                filePath: path,
                name: 'file',
                header: signed.headers || { 'Content-Type': mime },
                success: (up) => {
                  if (up.statusCode >= 200 && up.statusCode < 300) resolve(up)
                  else reject(new Error('upload failed'))
                },
                fail: reject,
              })
            }).catch(async () => {
              // Some S3 endpoints expect raw PUT body — fallback via uni.request arraybuffer if needed
              const fs = uni.getFileSystemManager()
              const bin = fs.readFileSync(path)
              await new Promise((resolve, reject) => {
                uni.request({
                  url: signed.upload_url,
                  method: 'PUT',
                  data: bin,
                  header: signed.headers || { 'Content-Type': mime },
                  success: (r) => {
                    if (r.statusCode >= 200 && r.statusCode < 300) resolve(r)
                    else reject(new Error('put failed'))
                  },
                  fail: reject,
                })
              })
            })
            const saved = await updateProfile({ avatar: signed.public_url })
            applyProfileFields(saved || { avatar: signed.public_url })
            uni.showToast({ title: t('profile.profileSaved'), icon: 'success' })
            return
          }
        } catch (e) {
          if (usedPresign) throw e
          // OSS not configured — fall through to data URL
        }

        const dataUrl = await readFileAsDataUrl(path)
        if (!dataUrl || dataUrl.length > 550000) {
          uni.showToast({ title: t('profile.avatarTooLarge'), icon: 'none' })
          return
        }
        const saved = await updateProfile({ avatar: dataUrl })
        applyProfileFields(saved || { avatar: dataUrl })
        uni.showToast({ title: t('profile.profileSaved'), icon: 'success' })
      } catch (err) {
        uni.showToast({ title: err.message || t('profile.avatarFailed'), icon: 'none' })
      } finally {
        avatarSaving.value = false
      }
    },
  })
}

function goTasks() {
  uni.switchTab({ url: '/pages/todos/todos' })
}

function openPasswordSheet() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  pwdSaving.value = false
  pwdVisible.value = true
}

function closePasswordSheet() {
  if (pwdSaving.value) return
  pwdVisible.value = false
}

async function savePassword() {
  const oldPw = oldPassword.value
  const next = newPassword.value
  const confirm = confirmPassword.value
  if (!oldPw) {
    uni.showToast({ title: t('profile.passwordNeedOld'), icon: 'none' })
    return
  }
  if (!next || next.length < 6) {
    uni.showToast({ title: t('profile.passwordShort'), icon: 'none' })
    return
  }
  if (next !== confirm) {
    uni.showToast({ title: t('profile.passwordMismatch'), icon: 'none' })
    return
  }
  pwdSaving.value = true
  try {
    const result = await changePassword(oldPw, next)
    if (result?.access_token) setToken(result.access_token)
    if (result?.refresh_token) setRefreshToken(result.refresh_token)
    pwdVisible.value = false
    uni.showToast({ title: t('profile.passwordChanged'), icon: 'success' })
  } catch (err) {
    uni.showToast({ title: err.message || t('profile.passwordFailed'), icon: 'none' })
  } finally {
    pwdSaving.value = false
  }
}

function goPrivacy() {
  uni.navigateTo({ url: '/pages/legal/privacy' })
}

function goNotifications() {
  uni.navigateTo({ url: '/pages/notifications/notifications' })
}

function goTerms() {
  uni.navigateTo({ url: '/pages/legal/terms' })
}

function goWebsite() {
  const url = OFFICIAL_WEBSITE_URL
  // #ifdef APP-PLUS
  plus.runtime.openURL(url)
  // #endif
  // #ifdef H5
  if (typeof window !== 'undefined') window.open(url, '_blank')
  // #endif
}

function handleDeleteAccount() {
  uni.showModal({
    title: t('profile.deleteTitle'),
    content: t('profile.deleteContent'),
    confirmText: t('profile.deleteConfirm'),
    confirmColor: '#d96058',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deleteAccount()
        resetTodoCache()
        stopAutoSyncScheduler()
        clearAuth()
        uni.showToast({ title: t('profile.deleteScheduled'), icon: 'none', duration: 2500 })
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/login/login' })
        }, 600)
      } catch (err) {
        uni.showToast({ title: err.message || t('profile.deleteFailed'), icon: 'none' })
      }
    },
  })
}

function handleLogout() {
  uni.showModal({
    title: t('profile.logoutTitle'),
    content: t('profile.logoutContent'),
    success: async (res) => {
      if (!res.confirm) return
      try {
        await logout()
      } catch {
        // local clear still required even if revoke fails
      }
      resetTodoCache()
      stopAutoSyncScheduler()
      clearAuth()
      uni.reLaunch({ url: '/pages/login/login' })
    },
  })
}
</script>

<template>
  <view class="page ios-page profile-page" :class="pageThemeClass">
    <CollapsingNavBar :title="i18n.title" :progress="titleProgress" />
    <view class="content ios-content has-collapse-nav profile-content">
      <scroll-view scroll-y class="profile-scroll" :show-scrollbar="false" @scroll="onProfileScroll">
        <view class="large-title-wrap">
          <text class="large-title">{{ i18n.title }}</text>
        </view>

        <view class="hero glass" @click="openEditProfile">
          <view class="avatar" @click.stop="chooseAvatar">
            <image v-if="avatar" class="avatar-img" :src="avatar" mode="aspectFill" />
            <text v-else class="avatar-text">{{ avatarLetter }}</text>
          </view>
          <view class="info">
            <text class="name">{{ displayName || i18n.user }}</text>
            <text v-if="signature" class="meta signature">{{ signature }}</text>
            <text class="meta">{{ i18n.account }}</text>
            <view class="counts-row">
              <text class="count-item">{{ i18n.localTasks }}</text>
              <text class="count-item">{{ i18n.cloudTasks }}</text>
            </view>
          </view>
          <text class="hero-edit">›</text>
        </view>

        <view class="group">
          <view class="row" @click="chooseAvatar">
            <text class="label">{{ i18n.changeAvatar }}</text>
            <view class="trailing">
              <view class="mini-avatar">
                <image v-if="avatar" class="mini-avatar-img" :src="avatar" mode="aspectFill" />
                <text v-else class="mini-avatar-text">{{ avatarLetter }}</text>
              </view>
              <text class="chev">›</text>
            </view>
          </view>
          <view class="row" @click="openEditProfile">
            <text class="label">{{ i18n.nickname }}</text>
            <view class="trailing">
              <text class="value">{{ nickname || '—' }}</text>
              <text class="chev">›</text>
            </view>
          </view>
          <view class="row" @click="openEditProfile">
            <text class="label">{{ i18n.signature }}</text>
            <view class="trailing">
              <text class="value">{{ signature || '—' }}</text>
              <text class="chev">›</text>
            </view>
          </view>
          <view class="row last" @click="openEditProfile">
            <text class="label">{{ i18n.gender }}</text>
            <view class="trailing">
              <text class="value">{{ genderLabel }}</text>
              <text class="chev">›</text>
            </view>
          </view>
        </view>

        <view class="group">
          <view class="row">
            <text class="label">{{ i18n.darkMode }}</text>
            <view class="trailing">
              <switch :checked="darkMode" :color="tintColor" @change="onDarkChange" />
            </view>
          </view>
          <view class="row last" @click="openLocaleSheet">
            <text class="label">{{ i18n.language }}</text>
            <view class="trailing">
              <text class="value">{{ i18n.languageName }}</text>
              <text class="chev">›</text>
            </view>
          </view>
        </view>

        <view class="group">
          <view class="row">
            <text class="label">{{ i18n.listTimestamp }}</text>
            <view class="trailing">
              <text class="value">{{ formatTime(listUpdatedAt) }}</text>
            </view>
          </view>
          <view class="row last" @click="goTasks">
            <text class="label">{{ i18n.myTasks }}</text>
            <view class="trailing">
              <text class="link">{{ i18n.view }}</text>
              <text class="chev">›</text>
            </view>
          </view>
        </view>

        <view class="group">
          <view class="row" @click="goNotifications">
            <text class="label">{{ i18n.notifications }}</text>
            <view class="trailing">
              <text v-if="notifHasUnread" class="notif-badge">
                {{ notifUnreadCount > 99 ? '99+' : notifUnreadCount }}
              </text>
              <text class="chev">›</text>
            </view>
          </view>
          <view class="row" @click="openPasswordSheet">
            <text class="label">{{ i18n.changePassword }}</text>
            <view class="trailing">
              <text class="chev">›</text>
            </view>
          </view>
          <view class="row" @click="goPrivacy">
            <text class="label">{{ i18n.privacy }}</text>
            <view class="trailing">
              <text class="chev">›</text>
            </view>
          </view>
          <view class="row" @click="goTerms">
            <text class="label">{{ i18n.terms }}</text>
            <view class="trailing">
              <text class="chev">›</text>
            </view>
          </view>
          <view class="row last" @click="goWebsite">
            <text class="label">{{ i18n.website }}</text>
            <view class="trailing">
              <text class="chev">›</text>
            </view>
          </view>
        </view>

        <view class="pill-btn danger" @click="handleLogout">
          <text>{{ i18n.logout }}</text>
        </view>
        <view class="pill-btn ghost-danger" @click="handleDeleteAccount">
          <text>{{ i18n.deleteAccount }}</text>
        </view>
        <view class="scroll-spacer"></view>
      </scroll-view>
    </view>
    <GlassTabBar />

    <view v-if="editVisible" class="sheet-mask" @click="closeEditProfile">
      <view class="sheet" @click.stop>
        <text class="sheet-title">{{ i18n.editProfile }}</text>
        <text class="field-label">{{ i18n.nickname }}</text>
        <input
          class="sheet-input"
          v-model="editNickname"
          maxlength="64"
          :placeholder="i18n.nicknamePh"
        />
        <text class="field-label">{{ i18n.signature }}</text>
        <input
          class="sheet-input"
          v-model="editSignature"
          maxlength="120"
          :placeholder="i18n.signaturePh"
        />
        <text class="field-label">{{ i18n.gender }}</text>
        <view class="gender-row">
          <view
            v-for="opt in genderOptions"
            :key="opt.value || 'unset'"
            class="gender-chip"
            :class="{ active: editGender === opt.value }"
            @click="selectGender(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
        <view class="sheet-actions">
          <view class="sheet-btn ghost" @click="closeEditProfile"><text>{{ i18n.cancel }}</text></view>
          <view class="sheet-btn primary" @click="saveProfile"><text>{{ i18n.save }}</text></view>
        </view>
      </view>
    </view>

    <view v-if="pwdVisible" class="sheet-mask" @click="closePasswordSheet">
      <view class="sheet" @click.stop>
        <text class="sheet-title">{{ i18n.changePasswordTitle }}</text>
        <text class="field-label">{{ i18n.oldPassword }}</text>
        <input
          class="sheet-input"
          v-model="oldPassword"
          password
          maxlength="128"
          :placeholder="i18n.oldPasswordPh"
        />
        <text class="field-label">{{ i18n.newPassword }}</text>
        <input
          class="sheet-input"
          v-model="newPassword"
          password
          maxlength="128"
          :placeholder="i18n.newPasswordPh"
        />
        <text class="field-label">{{ i18n.confirmPassword }}</text>
        <input
          class="sheet-input"
          v-model="confirmPassword"
          password
          maxlength="128"
          :placeholder="i18n.confirmPasswordPh"
        />
        <view class="sheet-actions">
          <view class="sheet-btn ghost" @click="closePasswordSheet"><text>{{ i18n.cancel }}</text></view>
          <view
            class="sheet-btn primary"
            :class="{ disabled: pwdSaving }"
            @click="savePassword"
          >
            <text>{{ pwdSaving ? i18n.passwordSaving : i18n.save }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="localeVisible" class="sheet-mask" @click="closeLocaleSheet">
      <view class="sheet locale-sheet" @click.stop>
        <text class="sheet-title">{{ i18n.language }}</text>
        <scroll-view scroll-y class="locale-list" :show-scrollbar="false">
          <view
            v-for="(item, idx) in LOCALES"
            :key="item.code"
            class="locale-item"
            :class="{ active: localeIndex === idx }"
            @click="selectLocale(idx)"
          >
            <text class="locale-name">{{ item.name }}</text>
            <text v-if="localeIndex === idx" class="locale-check">✓</text>
          </view>
        </scroll-view>
        <view class="sheet-btn ghost locale-cancel" @click="closeLocaleSheet">
          <text>{{ i18n.cancel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.profile-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.profile-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  padding-left: var(--app-space-page);
  padding-right: var(--app-space-page);
  padding-bottom: 0;
}

.profile-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}

.scroll-spacer {
  height: calc(160rpx + env(safe-area-inset-bottom));
}

.pill-btn.ghost-danger {
  margin-top: 16rpx;
  background: transparent;
  color: var(--app-danger);
  border: 0.5px solid rgba(217, 96, 88, 0.35);
  box-shadow: none;
}

.large-title-wrap {
  padding: 0 8rpx 28rpx;
}

.large-title {
  font-size: var(--app-type-large-title);
  font-weight: 700;
  letter-spacing: -1.5px;
  color: var(--app-label);
}

.hero {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx;
  border-radius: var(--app-radius-panel);
  margin-bottom: 24rpx;
}

.avatar {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--app-tint-soft), var(--app-tint));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px var(--app-tint-glow);
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-text {
  color: var(--app-on-tint);
  font-size: 44rpx;
  font-weight: 700;
}

.mini-avatar {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--app-tint-soft), var(--app-tint));
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mini-avatar-img {
  width: 100%;
  height: 100%;
}

.mini-avatar-text {
  color: var(--app-on-tint);
  font-size: 20rpx;
  font-weight: 700;
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--app-label);
}

.meta {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--app-secondary);
}

.meta.signature {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.counts-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 4rpx;
  width: 100%;
}

.count-item {
  font-size: 24rpx;
  line-height: 1.2;
  color: var(--app-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.hero-edit {
  font-size: 36rpx;
  color: var(--app-tertiary);
  flex-shrink: 0;
  padding-left: 8rpx;
}

.group {
  margin-bottom: 20rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 96rpx;
  padding: 0 28rpx;
  box-sizing: border-box;
  border-bottom: 0.5px solid var(--app-separator);
}

.row.last {
  border-bottom: none;
}

.label {
  font-size: 30rpx;
  line-height: 1.2;
  color: var(--app-label);
  flex-shrink: 0;
  max-width: 42%;
}

.trailing {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10rpx;
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
}

.notif-badge {
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: var(--app-danger, #d96058);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 34rpx;
  text-align: center;
}

.value {
  font-size: 28rpx;
  line-height: 1.2;
  color: var(--app-secondary);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.chev {
  font-size: 32rpx;
  line-height: 1;
  color: var(--app-tertiary);
  flex-shrink: 0;
  width: 20rpx;
  text-align: center;
}

.link {
  font-size: 28rpx;
  line-height: 1.2;
  color: var(--app-tint);
  font-weight: 500;
}

.pill-btn {
  margin-top: 8rpx;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--app-scrim);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: min(100%, var(--app-sheet-max, 100%));
  background: var(--app-fill-strong);
  backdrop-filter: blur(var(--app-glass-blur));
  -webkit-backdrop-filter: blur(var(--app-glass-blur));
  border-radius: var(--app-radius-panel) var(--app-radius-panel) 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.sheet-title {
  display: block;
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--app-label);
  margin-bottom: 28rpx;
}

.field-label {
  display: block;
  font-size: 24rpx;
  color: var(--app-secondary);
  margin-bottom: 10rpx;
}

.sheet-input {
  height: 80rpx;
  padding: 0 24rpx;
  margin-bottom: 24rpx;
  border-radius: var(--app-radius-control);
  background: var(--app-fill);
  font-size: 30rpx;
  color: var(--app-label);
}

.gender-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 28rpx;
}

.gender-chip {
  padding: 14rpx 24rpx;
  border-radius: var(--app-radius-pill);
  background: var(--app-fill);
  font-size: 26rpx;
  color: var(--app-secondary);
}

.gender-chip.active {
  background: var(--app-tint-soft);
  color: var(--app-tint);
  font-weight: 600;
}

.sheet-actions {
  display: flex;
  gap: 16rpx;
}

.sheet-btn {
  flex: 1;
  height: var(--app-btn-height-sheet);
  border-radius: var(--app-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
}

.sheet-btn.ghost {
  background: var(--app-fill);
  color: var(--app-label);
}

.sheet-btn.primary {
  background: var(--app-tint);
  color: var(--app-on-tint);
}

.sheet-btn.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.locale-sheet {
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.locale-list {
  max-height: 52vh;
  margin-bottom: 20rpx;
}

.locale-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 8rpx;
  border-bottom: 0.5px solid var(--app-separator);
}

.locale-item:last-child {
  border-bottom: none;
}

.locale-name {
  font-size: 30rpx;
  color: var(--app-label);
}

.locale-item.active .locale-name {
  color: var(--app-tint);
  font-weight: 600;
}

.locale-check {
  font-size: 28rpx;
  color: var(--app-tint);
  font-weight: 700;
}

.locale-cancel {
  width: 100%;
}
</style>
