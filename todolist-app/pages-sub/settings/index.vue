<script setup>
/**
 * @file pages-sub/settings — 更多设置
 * @description 主题切换、语言偏好、隐私政策、退出登录。
 */
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import AppConfirmDialog from "@/components/AppConfirmDialog.vue";
import { clearAuth } from "@/utils/storage";
import { useChatStore } from "@/stores/chat";
import { useThemeStore } from "@/stores/theme";
import { setAppLanguage } from "@/i18n";
import { invalidateCompanionsCache } from "@/utils/companionsCache";
import { bindAnalyticsTap } from "@/utils/analytics";
import { openPrivacyPolicy } from "@/utils/openPrivacy";
import { standardApi } from "@/utils/api";
import { showToast } from "@/stores/toast";

const { t, locale } = useI18n();
const themeStore = useThemeStore();
const chat = useChatStore();

const showLangPicker = ref(false);
const showLogoutConfirm = ref(false);
const showDeleteAccountConfirm = ref(false);

const languages = [
  // { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
];

function selectLanguage(code) {
  setAppLanguage(code);
  showLangPicker.value = false;
}

function handleLogout() {
  chat.disconnectAll();
  invalidateCompanionsCache();
  clearAuth();
  uni.reLaunch({ url: "/pages/login/login" });
}

async function handleDeleteAccount() {
  try {
    const res = await standardApi.post("/api/auth/delete-account");
    showToast(res?.message || "账号已注销");
  } catch {
    return;
  }
  chat.disconnectAll();
  invalidateCompanionsCache();
  clearAuth();
  uni.reLaunch({ url: "/pages/login/login" });
}

function promptLogout() {
  showLogoutConfirm.value = true;
}

function promptDeleteAccount() {
  showDeleteAccountConfirm.value = true;
}

function goPrivacy() {
  openPrivacyPolicy();
}
</script>

<template>
  <AppPageShell
    :title="t('profile.moreSettings')"
    :show-back="true"
    back-analytics-id="settings-back"
    back-analytics-name="更多设置页返回"
  >
    <view class="settings-page">
      <view class="menu-list">
        <!-- 组1：Light Mode / Language Preference / Privacy Policy -->
        <view class="menu-group">
          <!-- <view
            class="menu-item-simple"
            hover-class="menu-item-hover"
            :hover-stay-time="200"
            @tap="themeStore.toggleTheme()"
          >
            <text class="menu-item-label">{{ themeStore.isDark ? t("profile.darkMode") : t("profile.lightMode") }}</text>
            <view class="theme-switch" :class="{ on: themeStore.isDark }">
              <view class="theme-knob" />
            </view>
          </view> -->
          <view
            class="menu-item-simple"
            hover-class="menu-item-hover"
            :hover-stay-time="200"
            @tap="showLangPicker = true"
          >
            <text class="menu-item-label">{{ t("profile.languagePreference") }}</text>
            <text class="menu-chevron">›</text>
          </view>
          <view
            class="menu-item-simple"
            hover-class="menu-item-hover"
            :hover-stay-time="200"
            @tap="goPrivacy"
          >
            <text class="menu-item-label">{{ t("profile.privacyPolicy") }}</text>
            <text class="menu-chevron">›</text>
          </view>
        </view>

        <!-- 组2：退出 / 注销账号 -->
        <view class="account-actions">
          <view
            class="account-action-btn logout-action"
            hover-class="account-action-hover"
            :hover-stay-time="200"
            @tap="bindAnalyticsTap('settings-logout', promptLogout, '退出登录')"
          >
            <text class="logout-text">{{ t("profile.logout") }}</text>
          </view>
          <view
            class="account-action-btn delete-action"
            hover-class="account-action-hover"
            :hover-stay-time="200"
            @tap="bindAnalyticsTap('settings-delete-account', promptDeleteAccount, '注销登录')"
          >
            <text class="delete-text">{{ t("profile.deleteAccount") }}</text>
          </view>
        </view>
      </view>

      <!-- 语言选择 -->
      <view v-if="showLangPicker" class="modal-mask bottom" @tap="showLangPicker = false">
        <view class="modal-sheet lang-sheet" @tap.stop>
          <view class="modal-header-row sheet-header">
            <text class="modal-title">{{ t("profile.selectLanguage") }}</text>
            <text class="modal-close" @tap="showLangPicker = false">✕</text>
          </view>
          <scroll-view scroll-y class="lang-list">
            <view
              v-for="lang in languages"
              :key="lang.code"
              class="lang-item"
              :class="{ active: locale === lang.code }"
              @tap="selectLanguage(lang.code)"
            >
              <text class="lang-flag">{{ lang.flag }}</text>
              <text class="lang-label">{{ lang.label }}</text>
              <text v-if="locale === lang.code" class="lang-check">✓</text>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- 退出登录确认 -->
      <AppConfirmDialog
        :open="showLogoutConfirm"
        :title="t('profile.logout')"
        :description="t('profile.logoutConfirm')"
        :confirm-text="t('common.confirm')"
        :cancel-text="t('common.cancel')"
        destructive
        @update:open="showLogoutConfirm = $event"
        @confirm="handleLogout"
      />

      <!-- 注销账号确认 -->
      <AppConfirmDialog
        :open="showDeleteAccountConfirm"
        :title="t('profile.deleteAccount')"
        :description="t('profile.deleteAccountConfirm')"
        :confirm-text="t('common.confirm')"
        :cancel-text="t('common.cancel')"
        destructive
        @update:open="showDeleteAccountConfirm = $event"
        @confirm="handleDeleteAccount"
      />
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.settings-page {
  padding: 0 32rpx 48rpx;
  box-sizing: border-box;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-top: 24rpx;
}

.menu-group {
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-radius: 24rpx;
  overflow: hidden;
}

.menu-item-simple {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 20rpx;
}

.menu-item-hover {
  background: var(--bg-secondary);
}

.menu-item-label {
  font-size: 28rpx;
  color: var(--fg);
}

.menu-chevron {
  font-size: 32rpx;
  line-height: 1;
  color: var(--fg-muted);
  flex-shrink: 0;
}

.theme-switch {
  width: 100rpx;
  height: 56rpx;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--bg-input);
  border: 1px solid var(--border);
  position: relative;
  transition: background-color 0.3s ease;

  &.on {
    background: var(--brand);
    border-color: var(--brand);
  }
}

.theme-knob {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
  background: #fff;
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  transition: transform 0.3s ease;
  .on & {
    transform: translateX(44rpx);
  }
}

.account-actions {
  display: flex;
  flex-direction: row;
}

.account-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border-radius: 24rpx;
  padding: 28rpx 24rpx;
}

.logout-action {
  margin-right: 20rpx;
}

.account-action-hover {
  background: var(--bg-secondary) !important;
}

.logout-text {
  font-size: 28rpx;
  color: var(--destructive);
  font-weight: 500;
}

.delete-text {
  font-size: 28rpx;
  color: var(--destructive);
  font-weight: 500;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.55);
  padding: 32rpx;
  box-sizing: border-box;

  &.bottom {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
  }
}

.modal-sheet {
  width: 100%;
  max-width: 672px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  max-height: 85vh;
  box-sizing: border-box;
}

.sheet-header {
  margin-bottom: 16rpx;
}

.modal-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
  flex-shrink: 0;
}

.modal-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--fg);
}

.modal-close {
  font-size: 36rpx;
  color: var(--fg-muted);
  padding: 8rpx 12rpx;
  line-height: 1;
}

.lang-list {
  max-height: 60vh;
  box-sizing: border-box;
}

.lang-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  border-radius: 24rpx;
  margin-bottom: 8rpx;
  padding: 24rpx 20rpx;
  background: var(--bg-input);
  border: 1px solid var(--border);

  &.active {
    border-color: rgba(236, 72, 153, 0.35);
    background: rgba(236, 72, 153, 0.08);
  }
}

.lang-flag {
  font-size: 40rpx;
}

.lang-label {
  flex: 1;
  font-size: 30rpx;
  color: var(--fg);
}

.lang-check {
  font-size: 32rpx;
  color: var(--brand);
}
</style>