<script setup>
/**
 * @file pages-sub/my-posts — 我的帖子
 * @description 拉取当前用户发帖列表，支持删除。
 * @depends apiFetch
 */
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import AppAvatarImage from "@/components/AppAvatarImage.vue";
import AppConfirmDialog from "@/components/AppConfirmDialog.vue";
import AppListSkeleton from "@/components/AppListSkeleton.vue";
import { requireAuth } from "@/composables/useAuth";
import { normalizeMediaUrl } from "@/utils/media";
import apiFetch from "@/utils/api";
import { useRelativeTime } from "@/composables/useRelativeTime";

const { t } = useI18n();
const { format: formatTime } = useRelativeTime("discover");
requireAuth();

// ——— 状态 ———
const posts = ref([]);
const loading = ref(true);
const deleteTargetId = ref(null);
const confirmOpen = ref(false);

/** 拉取我的帖子列表 */
async function fetchMyPosts() {
  if (!posts.value.length) loading.value = true;
  try {
    const data = await apiFetch("/api/posts/my");
    posts.value = data.posts || [];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchMyPosts);

/** 确认删除帖子 */
async function handleDeleteConfirm() {
  if (deleteTargetId.value == null) return;
  try {
    await apiFetch(`/api/posts/${deleteTargetId.value}`, { method: "DELETE" });
    posts.value = posts.value.filter((p) => p.id !== deleteTargetId.value);
  } finally {
    deleteTargetId.value = null;
    confirmOpen.value = false;
  }
}
const topath = (id) => {
  uni.navigateTo({ url: `/pages-sub/post/index?id=${id}` })
}
</script>

<template>
  <AppPageShell :title="t('profile.myMoments')" :show-back="true">
    <view class="px-md py-sm">
      <AppListSkeleton v-if="loading && !posts.length" />
      <view v-else-if="!posts.length" class="center text-muted py-lg">{{ t("discover.noPosts") }}</view>
      <view v-else>
        <view v-for="p in posts" :key="p.id" class="card post mt-md">
        <view class="flex-row justify-between items-center">
          <view class="flex-row items-center gap-sm">
            <AppAvatarImage :src="p.avatar" :seed="String(p.user_id || 'user')" size="sm" />
            <view>
              <text>{{ p.user_name }}</text>
              <text class="text-muted" style="display: block; font-size: 22rpx">{{ formatTime(p.created_at) }}</text>
            </view>
          </view>
          <text @tap="deleteTargetId = p.id; confirmOpen = true">🗑</text>
        </view>
        <view @click="topath(p.id)">
          <text class="title">{{ p.title }}</text>
          <text class="text-muted content">{{ p.content }}</text>
        </view>
        <scroll-view v-if="p.images?.length" scroll-x class="imgs">
          <image v-for="(img, i) in p.images.slice(0, 3)" :key="i" class="thumb" :src="normalizeMediaUrl(img) || ''" mode="aspectFill" />
        </scroll-view>
        <view class="flex-row gap-sm text-muted meta">
          <text>♥ {{ p.likes_count }}</text>
          <text>💬 {{ p.comments_count }}</text>
        </view>
        </view>
      </view>
    </view>
    <AppConfirmDialog
      v-model:open="confirmOpen"
      :title="t('profile.deletePost')"
      :description="t('profile.deletePostConfirm')"
      :confirm-text="t('profile.deletePost')"
      destructive
      @confirm="handleDeleteConfirm"
    />
  </AppPageShell>
</template>

<style scoped lang="scss">
.center { text-align: center; padding: 80rpx 0; }
.post { padding: 24rpx; }
.title { display: block; font-weight: 600; margin: 16rpx 0 8rpx; word-break: break-all; }
.content { display: block; font-size: 26rpx; line-height: 1.5; word-break: break-all; }
.imgs { white-space: nowrap; margin: 16rpx 0; }
.thumb { width: 160rpx; height: 160rpx; border-radius: 16rpx; margin-right: 12rpx; display: inline-block; }
.meta { font-size: 24rpx; margin-top: 12rpx; }
.py-lg { padding: 80rpx 0; }
</style>
