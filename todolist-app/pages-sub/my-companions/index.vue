<script setup>
/**
 * @file pages-sub/my-companions — 我的伴侣列表
 * @description 展示已创建/拥有的伴侣；支持隐藏本地标记。
 * @depends companionsCache、storage、AppAvatarImage
 */
import { ref, computed, onMounted } from "vue";
import { onShow, onLoad } from "@dcloudio/uni-app";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import AppAvatarImage from "@/components/AppAvatarImage.vue";
import AppConfirmDialog from "@/components/AppConfirmDialog.vue";
import AppListSkeleton from "@/components/AppListSkeleton.vue";
import { requireAuth } from "@/composables/useAuth";
import { getItem, setItem } from "@/utils/storage";
import { fetchCompanions, getCachedCompanions } from "@/utils/companionsCache";
import { sortCompanionsByUserLang } from "@/utils/companionLang";
import { formatAffectionDisplay } from "@/utils/formatAffection";
import { formatCompanionName } from "@/utils/formatCompanion";
import { useChatStore } from "@/stores/chat";
import { bindAnalyticsTap, bindAnalyticsTapArg } from "@/utils/analytics";

const MY_COMPANIONS_HIDDEN_KEY = "my_companions_hidden_ids";
const { t, locale } = useI18n();
const chat = useChatStore();
requireAuth();

const specialFrom = ref("");

const companionsFilter = computed(() => {
  if (specialFrom.value == 1) {
    return {  is_create:true,intimacy_value:0};
  }
  return { is_create: 'none', intimacy_value: 5 };
});

const pageTitle = computed(() => {
  if (specialFrom.value == 1) {
    return t("messages.viewAllCompanions");
  }
  return t("profile.myCompanions");
});

// ——— 状态与隐藏 ———
function mapCompanion(c) {
  const profile = c.profile || {};
  const state = c.state || {};
  return {
    id: String(profile.id || ""),
    name: formatCompanionName(profile.name, t("home.defaultCompanionName")),
    avatar: c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`,
    gender: profile.gender || "",
    city: profile.city || "",
    personality: profile.personality || "",
    mbti: profile.mbti || "",
    affection: state.affection || 0,
    turns: state.turns || 0,
    mood: state.mood || profile.mood || "",
    createdBy: profile.created_by || "",
    avatar_generating: c.avatar_generating,
  };
}

function mapCompanions(data) {
  const sorted = sortCompanionsByUserLang(data || [], locale.value);
  return sorted.map(mapCompanion);
}

const companions = ref([]);
const loading = ref(true);
const currentUserId = ref("");
const hiddenIds = ref(new Set());
const removeTargetId = ref(null);

function loadHidden() {
  try {
    const raw = getItem(MY_COMPANIONS_HIDDEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

const visibleCompanions = computed(() => companions.value.filter((c) => !hiddenIds.value.has(c.id)));

function getAffectionLevel(affection) {
  if (affection >= 80) return { label: t("myCompanions.soulmate"), color: "text-primary" };
  if (affection >= 50) return { label: t("myCompanions.close"), color: "purple" };
  if (affection >= 20) return { label: t("myCompanions.familiar"), color: "blue" };
  return { label: t("myCompanions.stranger"), color: "muted" };
}

// ——— 加载列表 ———
async function loadCompanions(background = false) {
  if (!background) loading.value = true;
  try {
    const data = await fetchCompanions(companionsFilter.value);
    companions.value = mapCompanions(data);
  } finally {
    loading.value = false;
  }
}

onLoad((options) => {
  if (options?.a) {
    specialFrom.value = options.a
  }
});

onMounted(() => {
  hiddenIds.value = loadHidden();
  try {
    const raw = getItem("user_info");
    if (raw) {
      const u = JSON.parse(raw);
      currentUserId.value = u.nickname || u.username || "";
    }
  } catch { /* ignore */ }
  if (!currentUserId.value) currentUserId.value = getItem("device_id") || "";

  loadCompanions(!!companions.value.length);
});

onShow(() => {
  if (companions.value.length) loadCompanions(true);
});

const confirmOpen = ref(false);

// ——— 操作 ———
function handleRemoveConfirm() {
  if (!removeTargetId.value) return;
  hiddenIds.value = new Set([...hiddenIds.value, removeTargetId.value]);
  setItem(MY_COMPANIONS_HIDDEN_KEY, JSON.stringify([...hiddenIds.value]));
  removeTargetId.value = null;
  confirmOpen.value = false;
}

function openChat(id) {
  chat.connect(id);
  uni.navigateTo({ url: `/pages/chat/index?id=${id}` });
}

function promptRemove(id) {
  removeTargetId.value = id;
  confirmOpen.value = true;
}

const onChatTap = bindAnalyticsTapArg(
  (id) => `my-companions-chat-${id}`,
  openChat
);
const onRemoveTap = bindAnalyticsTapArg(
  (id) => `my-companions-remove-${id}`,
  promptRemove
);
</script>

<template>
  <AppPageShell
    :title="pageTitle"
    :show-back="specialFrom !== 'message'"
    :show-tab-bar="specialFrom === 'message'"
    back-analytics-id="my-companions-back"
    back-analytics-name="我的伴侣页返回"
  >
    <view class="px-md py-sm">
      <view class="stats-row flex-row">
        <view class="stat card"><text class="num">{{ visibleCompanions.length }}</text><text class="text-muted">{{ t("myCompanions.total") }}</text></view>
        <view class="stat card"><text class="num">{{ visibleCompanions.reduce((s, c) => s + c.affection, 0).toFixed(2) }}</text><text class="text-muted">{{ t("myCompanions.totalAffection") }}</text></view>
        <view class="stat card"><text class="num">{{ visibleCompanions.reduce((s, c) => s + c.turns, 0) }}</text><text class="text-muted">{{ t("profile.chatTurns") }}</text></view>
      </view>

      <AppListSkeleton v-if="loading && !visibleCompanions.length" />
      <view v-else-if="!visibleCompanions.length" class="center text-muted py-lg">{{ t("common.noData") }}</view>
      <template v-else>
        <view v-for="c in visibleCompanions" :key="c.id" class="card row mt-md">
        <AppAvatarImage :src="c.avatar" :seed="c.id" :generating="c.avatar_generating" />
        <view class="flex-1">
          <view class="flex-row items-center gap-sm">
            <text class="name">{{ c.name }}</text>
            <text v-if="c.mbti" class="mbti">{{ c.mbti }}</text>
            <text v-if="c.createdBy === currentUserId" class="self-tag">{{ t("myCompanions.selfCreated") }}</text>
          </view>
          <text class="text-muted meta">{{ c.city }} · {{ c.mood }}</text>
          <text class="affection">♥ {{ formatAffectionDisplay(c.affection) }} · {{ getAffectionLevel(c.affection).label }}</text>
        </view>
        <view class="actions flex-col gap-sm">
          <button class="icon-btn primary" @tap="onChatTap(c.id)">💬</button>
          <button class="icon-btn" @tap="onRemoveTap(c.id)">🗑️</button>
        </view>
        </view>
      </template>
    </view>

    <AppConfirmDialog
      v-model:open="confirmOpen"
      :title="t('myCompanions.removeFromList')"
      :description="t('myCompanions.removeConfirm')"
      :confirm-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      destructive
      @confirm="handleRemoveConfirm"
    />
  </AppPageShell>
</template>

<style scoped lang="scss">
.center { text-align: center; padding: 80rpx 0; }
.stats-row { gap: 16rpx; margin-bottom: 24rpx; }
.stat { flex: 1; padding: 24rpx; text-align: center; }
.num { display: block; font-size: 36rpx; font-weight: 600; }
.row { display: flex; gap: 16rpx; padding: 24rpx; align-items: center; }
.name { font-weight: 600; }
.mbti, .self-tag { font-size: 20rpx; padding: 4rpx 12rpx; background: var(--bg-input); border-radius: 8rpx; }
.meta { display: block; font-size: 24rpx; margin: 8rpx 0; }
.affection { font-size: 24rpx; color: var(--brand); }
.icon-btn { width: 64rpx; height: 64rpx; border-radius: 50%; padding: 0; font-size: 28rpx; background: var(--bg-input); &.primary { background: var(--gradient-brand); } }
.flex-1 { flex: 1; min-width: 0; }
.py-lg { padding: 80rpx 0; }
</style>
