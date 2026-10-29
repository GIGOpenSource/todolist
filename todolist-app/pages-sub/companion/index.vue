<script setup>
/**
 * @file pages-sub/companion — 伴侣资料页
 * @description 查看伴侣档案与动态；创建者可清空消息/删除伴侣。
 * @depends apiFetch、AppConfirmDialog、AppMomentCard、stores/chat
 */
import { ref, computed, onMounted, watch } from "vue";
import { onLoad, onPageScroll } from "@dcloudio/uni-app";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import AppAvatarImage from "@/components/AppAvatarImage.vue";
import AppConfirmDialog from "@/components/AppConfirmDialog.vue";
import AppMomentCard from "@/components/AppMomentCard.vue";
import AppListSkeleton from "@/components/AppListSkeleton.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import { requireAuth } from "@/composables/useAuth";
import { readSafeArea } from "@/composables/useStatusBar";
import { getItem, setItem } from "@/utils/storage";
import { useChatStore } from "@/stores/chat";
import { useThemeStore } from "@/stores/theme";
import { showToast } from "@/stores/toast";
import apiFetch from "@/utils/api";
import { getCachedCompanions } from "@/utils/companionsCache";
import { formatAffectionDisplay } from "@/utils/formatAffection";
import { translatePersonalityTag } from "@/utils/personalityTags";
import {
  formatCompanionMeta,
  formatCompanionName,
  uiLangCode,
} from "@/utils/formatCompanion";
import { bindAnalyticsTap } from "@/utils/analytics";

let companionId = "";
const { t, locale } = useI18n();
const chat = useChatStore();
const themeStore = useThemeStore();
requireAuth();

const uiLang = computed(() => uiLangCode(locale.value));
const topBg = computed(() =>
  themeStore.isDark
    ? "/static/companion/profile-top-bg.png"
    : "/static/companion/profile-top-bg-white.png"
);

// 顶部背景图淡入：切换主题时先淡出再淡入，避免生硬跳变
const topBgLoaded = ref(false);
function onTopBgLoad() {
  topBgLoaded.value = true;
}
watch(topBg, () => {
  topBgLoaded.value = false;
});

// ——— 加载资料 ———

function findCachedCompanion(id) {
  const list = getCachedCompanions() ?? [];
  return (
    list.find((c) => String(c.profile?.id || "") === String(id)) ?? null
  );
}

const companion = ref(null);
const moments = ref([]);
const momentsCount = ref(0);
const loading = ref(true);
const error = ref("");
const activeTab = ref("about");
const showMenu = ref(false);
const confirmOpen = ref(false);
const confirmTitle = ref("");
const confirmDesc = ref("");
const confirmDestructive = ref(false);
let confirmAction = null;

onLoad((q) => {
  companionId = String(q?.id || "");
  const cached = findCachedCompanion(companionId);
  if (cached) {
    companion.value = cached;
    loading.value = false;
  }
});

// 顶栏透明/实色切换：顶部时透明透出背景图，滑动后变实色挡住滚过的内容
const headerSolid = ref(false);
onPageScroll((e) => {
  headerSolid.value = (e?.scrollTop || 0) > 60;
});

function openConfirm(title, desc, action, destructive = false) {
  confirmTitle.value = title;
  confirmDesc.value = desc;
  confirmAction = action;
  confirmDestructive.value = destructive;
  confirmOpen.value = true;
}

// ——— 创建者操作 ———

function getCreatorKeys() {
  const keys = [];
  try {
    const raw = getItem("user_info");
    if (raw) {
      const u = JSON.parse(raw);
      if (u.id != null) keys.push(String(u.id));
      if (u.nickname) keys.push(String(u.nickname).trim());
      if (u.username) keys.push(String(u.username).trim());
    }
  } catch { /* ignore */ }
  const did = getItem("device_id");
  if (did) keys.push(did);
  return [...new Set(keys.filter(Boolean))];
}

const isCreator = () => {
  const createdBy = String(companion.value?.profile?.created_by || "").trim();
  return Boolean(createdBy && getCreatorKeys().includes(createdBy));
};

onMounted(async () => {
  try {
    const data = await apiFetch(`/companions/${companionId}`);
    companion.value = data;
    const mData = await apiFetch(
      `/api/companions/${companionId}/moments`
    );
    momentsCount.value = mData.total || 0;
    moments.value = mData.moments || [];
  } catch (e) {
    const err = e;
    if (!companion.value) {
      error.value = t("companionProfile.loadingError");
    }
  } finally {
    loading.value = false;
  }
});

function openChat() {
  uni.navigateTo({ url: `/pages/chat/index?id=${companionId}` });
}

function cloneCompanion() {
  if (!companion.value) return;
  const p = companion.value.profile;
  setItem("clone_companion_data", JSON.stringify({
    name: p.name,
    age: p.age,
    gender: p.gender === "男" ? "male" : "female",
    city: p.city,
    personality: p.personality,
    background: p.background,
    speech_style: p.speech_style,
    hobbies: p.hobbies,
    values: p.values,
    fears: p.fears,
    love_view: p.love_view,
    daily_routine: p.daily_routine,
    favorite_things: p.favorite_things,
    mbti: p.mbti,
    sexual_orientation: p.sexual_orientation,
    life_story: p.life_story || "",
    cultural_values: p.cultural_values || "",
    gender_perspective: p.gender_perspective || "",
  }));
  uni.navigateTo({ url: "/pages-sub/create/index?clone=1" });
}

function clearMessages() {
  showMenu.value = false;
  openConfirm(
    t("chat.clearMessages"),
    t("chat.confirmClearMessages"),
    async () => {
      try {
        await apiFetch(`/companions/${companionId}/clear-messages`, { method: "POST" });
        chat.clearMessages(companionId);
        if (companion.value?.state) companion.value.state.affection = 0;
        showToast(t("chat.clearSuccess"));
      } catch {
        showToast(t("chat.clearFailed"));
      }
    },
    true
  );
}

function deleteCompanion() {
  showMenu.value = false;
  openConfirm(
    t("companionProfile.deleteCompanion"),
    t("companionProfile.deleteConfirm"),
    async () => {
      try {
        await apiFetch(`/companions/${companionId}`, { method: "DELETE" });
        uni.reLaunch({ url: "/pages/messages/index" });
      } catch {
        showToast(t("companionProfile.deleteFailed"));
      }
    },
    true
  );
}

function openMoment(id) {
  uni.navigateTo({ url: `/pages-sub/moment/index?id=${id}` });
}

function toggleMenu() {
  showMenu.value = !showMenu.value;
}

function setAboutTab() {
  activeTab.value = "about";
}

function setMomentsTab() {
  activeTab.value = "moments";
}

const profile = () => companion.value?.profile || {};
const state = () => companion.value?.state || {};
const personalities = () => String(profile().personality || "").split(/[、,，]/).filter(Boolean);

const displayName = computed(() =>
  formatCompanionName(profile().name, t("home.defaultCompanionName"))
);
const displayMeta = computed(() => {
  const meta = formatCompanionMeta(profile(), t);
  const mood = state().mood;
  if (mood) {
    return meta ? `${meta} · ${mood}` : mood;
  }
  return meta;
});

const daysTogether = computed(() => {
  const raw = profile().created_at;
  const createdAt = raw ? new Date(raw) : new Date();
  const ms = Date.now() - createdAt.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
});

function sexualOrientationLabel(value) {
  if (!value) return "";
  const key = `companionProfile.sexualOrientation.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function formatMeetDate(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const aboutCards = computed(() => {
  const p = profile();
  const cards = [
    { key: "background", title: t("companionProfile.background"), content: p.background },
    { key: "speech", title: t("companionProfile.speechStyle"), content: p.speech_style },
    { key: "mbti", title: t("companionProfile.mbti"), content: p.mbti },
    {
      key: "orientation",
      title: t("companionProfile.sexualOrientationLabel"),
      content: sexualOrientationLabel(p.sexual_orientation),
    },
    { key: "creator", title: t("companionProfile.creator"), content: p.created_by },
    { key: "hobbies", title: t("companionProfile.hobbies"), content: p.hobbies },
    { key: "values", title: t("companionProfile.values"), content: p.values },
    { key: "fears", title: t("companionProfile.fears"), content: p.fears },
    { key: "love", title: t("companionProfile.loveView"), content: p.love_view },
    { key: "routine", title: t("companionProfile.dailyRoutine"), content: p.daily_routine },
    { key: "favorites", title: t("companionProfile.favoriteThings"), content: p.favorite_things },
  ];
  return cards.filter((c) => Boolean(c.content));
});

// 顶部背景图：向上延伸覆盖状态栏 + 透明顶栏区域
const topBgStyle = computed(() => {
  const safe = readSafeArea();
  return { top: `-${safe.safeAreaTop + 44}px` };
});

// 固定底栏：JS 读安全区（App 端 env() 可能取不到），无安全区时也垫 16px 兜底
const bottomBarStyle = computed(() => {
  const safe = readSafeArea();
  return { paddingBottom: `${Math.max(safe.safeAreaBottom, 16) + 8}px` };
});
</script>

<template>
  <AppPageShell
    :show-back="true"
    :transparent-header="!headerSolid"
    back-analytics-id="companion-profile-back"
    back-analytics-name="伴侣详情页返回"
  >
    <!-- 顶栏右侧：编辑菜单入口 -->
    <template #header-right>
      <view class="edit-btn" @tap.stop="bindAnalyticsTap('companion-profile-menu', toggleMenu, '伴侣菜单')">
        <image class="edit-icon" src="/static/companion/icon_edit.svg" mode="aspectFit" />
      </view>
    </template>

    <view v-if="!loading && (error || !companion)" class="center text-muted">
      {{ error || t("companionProfile.notFound") }}
    </view>

    <view v-else class="page-content px-md py-sm">
      <!-- 顶部背景图（延伸到屏幕最顶端，透出透明顶栏） -->
      <image
        class="top-bg"
        :class="{ loaded: topBgLoaded }"
        :style="topBgStyle"
        :src="topBg"
        mode="aspectFill"
        @load="onTopBgLoad"
        @error="onTopBgLoad"
      />
      <!-- 背景图底部渐隐，过渡到页面背景色 -->
      <view class="top-bg-fade" :class="{ loaded: topBgLoaded }" :style="topBgStyle" />
      <!-- 顶部人物图：下半身在资料卡顶边处裁掉，视觉上被卡片盖住一半 -->
      <view class="top-hero-clip">
        <image class="top-hero" src="/static/companion/icon_heise.svg" mode="aspectFit" />
      </view>

      <!-- 骨架 -->
      <view v-if="loading && !companion" class="profile-card mt-lg">
        <view class="avatar-holder">
          <view class="hero-avatar-skeleton skeleton" />
        </view>
        <view class="skeleton hero-name-skeleton" />
        <view class="skeleton hero-meta-skeleton" />
      </view>

      <!-- 资料卡 -->
      <view v-else class="profile-card mt-lg">
        <view class="avatar-holder">
          <AppAvatarImage size="lg" :src="companion.avatar" :seed="companionId" :generating="companion.avatar_generating" />
        </view>
        <view class="affection-pill">
          <SvgIcon name="icon_sel" size="28rpx" />
          <text>{{ formatAffectionDisplay(state().affection) }}</text>
        </view>
        <view class="name-line flex-row items-center flex-wrap">
          <text class="hero-name">{{ displayName }}</text>
          <text v-if="profile().mbti" class="mbti-chip">{{ profile().mbti }}</text>
          <text v-if="profile().sexual_orientation" class="orientation-chip">
            {{ sexualOrientationLabel(profile().sexual_orientation) }}
          </text>
        </view>
        <text class="text-muted hero-meta">{{ displayMeta }}</text>
        <view v-if="personalities().length" class="dashed-divider" />
        <view v-if="personalities().length" class="flex-row flex-wrap gap-sm tags-row">
          <text v-for="p in personalities()" :key="p" class="tag">{{ translatePersonalityTag(p, uiLang) }}</text>
        </view>
      </view>

      <!-- 数据统计 -->
      <view class="stats-card flex-row mt-md">
        <view class="stat">
          <text v-if="loading && !companion" class="num skeleton stat-skeleton" />
          <text v-else class="num">{{ state().turns ?? 0 }}</text>
          <text class="stat-label text-muted">{{ t("companionProfile.chatTurns") }}</text>
        </view>
        <view class="stat">
          <text v-if="loading && !companion" class="num skeleton stat-skeleton" />
          <text v-else class="num">{{ momentsCount }}</text>
          <text class="stat-label text-muted">{{ t("companionProfile.moments") }}</text>
        </view>
        <view class="stat">
          <text v-if="loading && !companion" class="num skeleton stat-skeleton" />
          <text v-else class="num">{{ daysTogether }}</text>
          <text class="stat-label text-muted">{{ t("companionProfile.daysTogether") }}</text>
        </view>
      </view>

      <!-- Tabs -->
      <view class="tabs flex-row mt-md">
        <text :class="{ active: activeTab === 'about' }" @tap="bindAnalyticsTap('companion-profile-tab-about', setAboutTab, '关于 Tab')">{{ t("companionProfile.about") }}</text>
        <text :class="{ active: activeTab === 'moments' }" @tap="bindAnalyticsTap('companion-profile-tab-moments', setMomentsTab, '动态 Tab')">{{ t("companionProfile.momentsTab") }}</text>
      </view>

      <AppListSkeleton v-if="loading && !companion" :rows="3" class="mt-md" />

      <!-- About Tab -->
      <view v-else-if="activeTab === 'about'" class="mt-sm">
        <view v-for="card in aboutCards" :key="card.key" class="card info-card mt-md">
          <text class="info-title text-muted">{{ card.title }}</text>
          <text v-if="card.key === 'mbti'" class="mbti-chip info-chip">{{ card.content }}</text>
          <text v-else class="info-content">{{ card.content }}</text>
        </view>
        <view v-if="profile().created_at" class="card info-card mt-md">
          <text class="info-title text-muted">{{ t("companionProfile.meetTime") }}</text>
          <text class="info-content">{{ formatMeetDate(profile().created_at) }}</text>
        </view>
      </view>

      <!-- Moments Tab（复用首页朋友圈卡片，精简形态） -->
      <view v-else class="mt-sm">
        <view v-if="!moments.length" class="center text-muted py-lg">{{ t("companionProfile.noMoments") }}</view>
        <view v-for="m in moments" :key="m.id" class="profile-moment-card">
          <AppMomentCard
            variant="compact"
            :moment="m"
            @detail-tap="openMoment(m.id)"
          />
        </view>
      </view>

      <!-- 底部操作按钮：固定在页面最下方，内容在其上方滚动 -->
      <view class="bottom-bar" :style="bottomBarStyle">
        <view class="bottom-actions flex-row gap-sm">
          <button
            v-if="companion && !isCreator()"
            class="btn-clone flex-1"
            @tap="bindAnalyticsTap('companion-profile-clone', cloneCompanion, '克隆')"
          >{{ t("companionProfile.clone") }}</button>
          <button
            v-if="companion && isCreator()"
            class="delete-footer flex-1"
            @tap="bindAnalyticsTap('companion-profile-delete-footer', deleteCompanion, '底部删除伴侣')"
          >{{ t("companionProfile.deleteCompanion") }}</button>
          <button
            class="btn-send flex-1"
            :disabled="!companion"
            @tap="bindAnalyticsTap('companion-profile-chat', openChat, '聊天')"
          >{{ t("companionProfile.sendMessage") }}</button>
        </view>
      </view>
    </view>

    <!-- 顶栏菜单弹层 -->
    <view v-if="showMenu && companion" class="menu-mask" @tap="showMenu = false">
      <view class="menu-popup" @tap.stop>
        <view class="menu-item" @tap="bindAnalyticsTap('companion-profile-clear-messages', clearMessages, '清空消息')">{{ t("chat.clearMessages") }}</view>
        <view v-if="isCreator()" class="menu-item danger" @tap="bindAnalyticsTap('companion-profile-delete', deleteCompanion, '删除伴侣')">{{ t("companionProfile.deleteCompanion") }}</view>
      </view>
    </view>

    <AppConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDesc"
      :destructive="confirmDestructive"
      :confirm-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      @confirm="confirmAction?.()"
    />
  </AppPageShell>
</template>

<style scoped lang="scss">
.center { text-align: center; padding: 80rpx 0; }
.page-content {
  position: relative;
  z-index: 0; /* 建立层叠上下文，让 top-bg 的负 z-index 垫底且不被页面背景盖住 */
  background: var(--bg);
  /* 预留固定底栏高度（单行按钮 + 底部安全区），防止内容被遮挡 */
  padding-bottom: 200rpx;
}

/* ── 顶部背景图 ── */
.top-bg {
  position: absolute;
  left: 0;
  right: 0;
  z-index: -1; /* 垫在全部内容下面 */
  width: 100%;
  height: 640rpx; /* 固定高度 + aspectFill 裁剪，避免宽屏下图占太高 */
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.45s ease;
  will-change: opacity;

  &.loaded {
    opacity: 1;
  }
}
.top-bg-fade {
  position: absolute;
  left: 0;
  right: 0;
  z-index: -1;
  height: 640rpx; /* 与 top-bg 同高，底部渐隐到页面背景色 */
  pointer-events: none;
  background: linear-gradient(180deg, transparent 45%, var(--bg) 92%);
  opacity: 0;
  transition: opacity 0.45s ease;
  will-change: opacity;

  &.loaded {
    opacity: 1;
  }
}
.top-hero-clip {
  position: absolute;
  top: -20rpx;
  left: 0;
  right: 0;
  height: 176rpx; /* 底边 = 卡片顶边（16rpx padding + 140rpx mt-lg），超出部分裁掉 → 人物被卡片盖住一半 */
  overflow: hidden;
  pointer-events: none; /* 不挡资料卡的点击 */
}
.top-hero {
  position: absolute;
  top: 0;
  left: 80%;
  transform: translateX(-50%);
  width: 260rpx;
  height: 260rpx;
}

/* ── 顶栏编辑按钮 ── */
.edit-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.edit-icon { width: 44rpx; height: 44rpx; }

/* ── 顶栏菜单弹层 ── */
.menu-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
.menu-popup {
  position: absolute;
  right: 24rpx;
  top: calc(env(safe-area-inset-top) + 100rpx);
  background: var(--modal-bg);
  border-radius: 16rpx;
  min-width: 280rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.4);
}
.menu-item {
  padding: 28rpx 32rpx;
  font-size: 28rpx;
  color: var(--fg);
  &.danger { color: var(--destructive); }
}

/* ── 资料卡：头像上浮 + 好感度徽标 ── */
.mt-lg { margin-top: 140rpx; }
.profile-card {
  position: relative;
  background: var(--card-bg);
  border-radius: 28rpx;
  padding: 96rpx 28rpx 28rpx;
}
.avatar-holder {
  position: absolute;
  top: -80rpx;
  left: 28rpx;
}
.hero-avatar-skeleton {
  width: 160rpx; height: 160rpx; border-radius: 50%;
}
.hero-name-skeleton {
  width: 200rpx; height: 40rpx; margin-top: 24rpx; border-radius: 8rpx;
}
.hero-meta-skeleton {
  width: 320rpx; height: 28rpx; margin-top: 16rpx; border-radius: 8rpx;
}
.stat-skeleton {
  display: inline-block; width: 64rpx; height: 36rpx; border-radius: 8rpx; margin-bottom: 8rpx;
}
.affection-pill {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  border-radius: 999px;
  background: rgba(231, 71, 164, 0.16);
  font-size: 24rpx;
  color: var(--fg);
}
.name-line { gap: 16rpx; }
.hero-name { font-size: 32rpx; font-weight: 400; color: var(--fg); }
.mbti-chip {
  padding: 6rpx 18rpx;
  background: rgba(255, 249, 70, 0.18);
  color: var(--fg);
  border-radius: 20rpx;
  font-size: 18rpx;
  font-weight: 600;
}
.orientation-chip {
  padding: 6rpx 18rpx;
  background: rgba(59, 130, 246, 0.18);
  color: var(--fg);
  border-radius: 20rpx;
  font-size: 18rpx;
}
.hero-meta {
  display: block;
  font-size: 18rpx;
  margin-top: 12rpx;
  line-height: 1.4;
  word-break: break-word;
}
.dashed-divider {
  margin: 24rpx 0;
  border-top: 2rpx dashed var(--border);
}
.tag {
  padding: 10rpx 24rpx;
  background: var(--bg-input);
  color: var(--fg-muted);
  border-radius: 999px;
  font-size: 18rpx;
}

/* ── 数据统计：整体一个卡片 ── */
.stats-card {
  background: var(--card-bg);
  border-radius: 28rpx;
  padding: 32rpx 0;
}
.stat {
  flex: 1;
  text-align: center;
}
.num { display: block; font-size: 40rpx; font-weight: 400; color: var(--fg); }
.stat-label { display: block; font-size: 20rpx; margin-top: 8rpx; }

/* ── Tabs：左对齐 + 渐变下划线 ── */
.tabs {
  gap: 48rpx;
  padding: 0 8rpx;
}
.tabs text {
  position: relative;
  padding: 20rpx 0 24rpx;
  font-size: 26rpx;
  color: var(--fg-muted);
  &.active {
    color: var(--fg);
    font-weight: 400;
    &::after {
      content: "";
      position: absolute;
      left: 0;
      bottom: 10rpx;
      width: 48rpx;
      height: 6rpx;
      border-radius: 6rpx;
      background: var(--gradient-brand);
    }
  }
}

/* ── About 信息卡 ── */
.info-card {
  background: var(--card-bg);
  padding: 28rpx;
  border-radius: 28rpx;
}
.info-title { display: block; font-size: 20rpx; margin-bottom: 14rpx; }
.info-content { font-size: 24rpx; color: var(--fg); line-height: 1.5; word-break: break-word; }
.info-chip { display: inline-block; }

/* ── Moments 卡片 ── */
.profile-moment-card { margin-top: 24rpx; }

/* ── 底部操作按钮：固定在页面底部 ── */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10; /* 盖住滚动内容，低于 menu-mask(1000) */
  padding: 16rpx 32rpx; /* 底部安全区 padding 由 bottomBarStyle 动态注入 */
  background: var(--bg);
}
.bottom-actions {
  gap: 24rpx;
}
.btn-clone {
  background: var(--card-bg);
  color: var(--fg);
  border-radius: 32rpx;
  font-size: 26rpx;
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 32rpx;
}
.btn-send {
  background: var(--gradient-brand);
  color: #1a1a1a;
  font-weight: 600;
  border-radius: 32rpx;
  font-size: 26rpx;
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 32rpx;
  &[disabled] { opacity: 0.6; }
}
.delete-footer {
  background: var(--card-bg);
  color: var(--fg);
  border-radius: 32rpx;
  font-size: 26rpx;
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 32rpx;
}
.py-lg { padding: 80rpx 0; }
.flex-1 { flex: 1; }
</style>
