<script setup>
/**
 * @file pages-sub/notifications — 通知列表
 * @description 聚合：朋友圈新动态 + 系统通知。支持触底分页加载。
 * @depends apiFetch、storage、utils/notifications
 */
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import AppAvatarImage from "@/components/AppAvatarImage.vue";
import AppMomentImage from "@/components/AppMomentImage.vue";
import AppListSkeleton from "@/components/AppListSkeleton.vue";
import { requireAuth } from "@/composables/useAuth";
import { getItem, setItem } from "@/utils/storage";
import { deviceHeaders } from "@/utils/device";
import apiFetch from "@/utils/api";
import { readHomeMomentsCache } from "@/utils/homeCache";
import { useRelativeTime } from "@/composables/useRelativeTime";
import {
  buildMomentPostItems,
  parseStoredIdList,
} from "@/utils/notifications";

const { t, locale } = useI18n();
const { format: formatTime } = useRelativeTime("messages");
requireAuth();

const PAGE_SIZE = 5;
let momentsOffset = 0;

/** 朋友圈通知 items */
const momentItems = ref([]);
/** 系统通知 items */
const systemNotifs = ref([]);
/** 合并排序后的全部通知（computed 自动响应） */
const notifications = computed(() => {
  const list = [...momentItems.value, ...systemNotifs.value];
  list.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
  return list;
});

const filter = ref("all");
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(true);

const filtered = computed(() =>
  filter.value === "all"
    ? notifications.value
    : notifications.value.filter((n) => n.type === filter.value)
);

const tabs = computed(() => [
  ["all", t("notifications.tabAll")],
  ["moment", t("notification.moments")],
  ["system", t("notification.system")],
]);

function buildFromMoments(moments) {
  const lastViewed = getItem("moments_last_viewed");
  return buildMomentPostItems(moments, lastViewed, t);
}

/** 加载朋友圈（支持分页） */
async function loadMomentsPage(offset = 0) {
  const mq = {
     limit: String(PAGE_SIZE),
    offset: String(offset),
    lang: locale.value || "zh",
  }

  const momentsRes = await apiFetch(
    `/api/moments?${mq.toString()}`,
    { header: deviceHeaders() }
  );

  const newMoments = momentsRes?.moments || [];
  const total = momentsRes?.total || 0;
  const nextOffset = offset + newMoments.length;
  momentsOffset = nextOffset;
  hasMore.value = nextOffset < total;

  // 直接用 API 数据构建，不混入首页缓存
  const items = buildFromMoments(newMoments);
  return { items, total };
}

/** 加载系统通知（仅首次） */
async function loadSystemNotifs() {
  try {
    const viewedKey = `sys_notifications_viewed_${locale.value}`;
    const viewedIds = parseStoredIdList(getItem(viewedKey));

    const sysRes = await apiFetch(
      `/api/notifications?language=${locale.value}&limit=20`
    );

    systemNotifs.value = (sysRes?.notifications || []).map((n) => ({
      id: `sys-${n.id}`,
      type: "system",
      title: n.title,
      content: n.content,
      time: n.created_at,
      read: viewedIds.includes(String(n.id)),
    }));

    if (sysRes?.notifications?.length) {
      setItem(
        viewedKey,
        JSON.stringify(sysRes.notifications.map((n) => n.id))
      );
    }
  } catch (e) {
    console.error("加载系统通知失败:", e);
  }
}

/** 首次加载 */
async function loadInitialNotifications() {
  loading.value = true;
  try {
    const [{ items }] = await Promise.all([
      loadMomentsPage(0),
      loadSystemNotifs(),
    ]);
    momentItems.value = items;
    setItem("moments_last_viewed", new Date().toISOString());
  } finally {
    loading.value = false;
  }
}

onMounted(() => loadInitialNotifications());

/** 触底加载更多 */
async function loadMore() {
  if (loadingMore.value || !hasMore.value || loading.value) return;
  loadingMore.value = true;
  try {
    const { items } = await loadMomentsPage(momentsOffset);
    if (items.length) {
      // 直接 push 到 momentItems，computed 的 notifications 自动更新
      momentItems.value = [...momentItems.value, ...items];
    }
  } catch (e) {
    console.error("加载更多失败:", e);
  } finally {
    loadingMore.value = false;
  }
}

function handleClick(item) {
  if (item.type === "moment" && item.momentId) {
    uni.navigateTo({ url: `/pages-sub/moment/index?id=${item.momentId}` });
  }
}

/* 用首页缓存做初始占位，不参与 loadMore 逻辑 */
function hydrateFromCache() {
  const cached = readHomeMomentsCache();
  if (!cached?.length) return;
  const items = buildFromMoments(cached);
  momentItems.value = items;
}
hydrateFromCache();
</script>

<template>
  <AppPageShell
    :title="t('notifications.title')"
    :show-back="true"
    back-analytics-id="notifications-back"
    back-analytics-name="通知页返回"
  >
    <view class="notif-body">
      <!-- tabs 在 scroll-view 外面，flex-shrink:0 自然固定 -->
      <view class="tabs">
        <view
          v-for="tab in tabs"
          :key="tab[0]"
          class="tab-item"
          :class="{ active: filter === tab[0] }"
          @tap="filter = tab[0]"
        >{{ tab[1] }}</view>
      </view>

      <!-- scroll-view 填满剩余高度 -->
      <scroll-view
        scroll-y
        class="list-scroll"
        :lower-threshold="150"
        @scrolltolower="loadMore"
      >
        <AppListSkeleton v-if="loading && !notifications.length" />
        <view v-else-if="!filtered.length" class="center text-muted py-lg">
          {{ t("notifications.empty") }}
        </view>
        <view v-else>
          <view
            v-for="item in filtered"
            :key="item.id"
            class="notif-row"
            :class="{ unread: !item.read }"
            @tap="handleClick(item)"
          >
            <AppAvatarImage v-if="item.avatar" :src="item.avatar" :seed="item.companionId || item.id" size="sm" />
            <view v-else class="icon-wrap">{{ item.type === "moment" ? "📷" : "ℹ️" }}</view>
            <view class="flex-1">
              <view class="flex-row justify-between">
                <text class="title">{{ item.title }}</text>
                <text class="text-muted time">{{ formatTime(item.time) }}</text>
              </view>
              <text class="text-muted snippet">{{ item.content }}</text>
              <AppMomentImage v-if="item.imageUrl" :src="item.imageUrl" mode="aspectFill" img-class="notif-moment-img" />
            </view>
          </view>

          <view class="footer-hint">
            <text v-if="loadingMore" class="text-muted">{{ t("common.loading") }}</text>
            <text v-else-if="!hasMore && notifications.length" class="text-muted no-more">
              {{ t("home.noMoreMoments") }}
            </text>
          </view>
        </view>
      </scroll-view>
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
/* flex 列：tabs 固定 + scroll-view 填满 */
.notif-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.tabs {
  flex-shrink: 0;
  display: flex;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  padding: 0 32rpx;
}
.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 8rpx;
  color: var(--fg-muted);
  font-size: 24rpx;
  &.active {
    color: var(--brand);
    border-bottom: 2px solid var(--brand);
  }
}

/* scroll-view 占据剩余高度 */
.list-scroll {
  flex: 1;
  min-height: 0;
}

.center { text-align: center; padding: 80rpx 0; }
.notif-row {
  display: flex; gap: 16rpx; padding: 24rpx 32rpx; border-bottom: 1px solid var(--border);
  &.unread { background: color-mix(in srgb, var(--brand) 6%, transparent); }
}
.icon-wrap { width: 64rpx; height: 64rpx; border-radius: 50%; background: var(--bg-input); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.title { font-weight: 500; font-size: 28rpx; }
.time { font-size: 22rpx; }
.snippet { display: block; font-size: 26rpx; margin-top: 8rpx; overflow: hidden; max-height: 80rpx; }

.notif-moment-img {
  width: 100%;
  max-height: 360rpx;
  border-radius: 16rpx;
  margin-top: 12rpx;
  overflow: hidden;
}

.footer-hint {
  padding: 32rpx 0;
  text-align: center;
  .no-more { font-size: 24rpx; opacity: 0.6; }
}

.flex-1 { flex: 1; min-width: 0; }
.py-lg { padding: 80rpx 0; }
</style>
