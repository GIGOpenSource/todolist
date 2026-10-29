<script setup>
/**
 * @file pages-sub/post — 社区帖子详情
 * @description 单帖详情、点赞、评论；带 x-device-id。
 * @depends apiFetch、deviceHeaders
 */
import { ref, onMounted } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import AppAvatarImage from "@/components/AppAvatarImage.vue";
import AppListSkeleton from "@/components/AppListSkeleton.vue";
import { requireAuth, getCurrentUserId } from "@/composables/useAuth";
import { deviceHeaders } from "@/utils/device";
import { normalizeMediaUrl } from "@/utils/media";
import apiFetch from "@/utils/api";
import { showToast } from "@/stores/toast";
import { useRelativeTime } from "@/composables/useRelativeTime";

import {
		useThemeStore
	} from "@/stores/theme";
 const themeStore = useThemeStore();


let postId = "";
const { t } = useI18n();
const { format: formatTime } = useRelativeTime("discover");
requireAuth();

// ——— 状态 ———
const post = ref(null);
const loading = ref(true);
const commentText = ref("");
const commentInputKey = ref(0);
const sending = ref(false);
const inputFocus = ref(false);


onLoad((q) => {
  postId = String(q?.id || "");
  // 发现页点评论入口时带 focus=1，进入后自动聚焦输入框
  if (q?.focus === "1" || q?.focus === "true") {
    inputFocus.value = true;
  }
});

// ——— 加载详情 ———
async function fetchPost({ silent = false } = {}) {
  if (!silent && !post.value) loading.value = true;
  try {
    post.value = await apiFetch(`/api/posts/${postId}`, { header: deviceHeaders() });
  } catch (e) {
    const err = e;
    if (err.status === 401) uni.navigateBack();
  } finally {
    loading.value = false;
  }
}

onMounted(fetchPost);


function onCommentInput(e) {
  commentText.value = e?.detail?.value ?? "";
}

function focusCommentInput() {
  inputFocus.value = false;
  // 先关掉再开，强制触发 uni-input focus
  setTimeout(() => {
    inputFocus.value = true;
  }, 0);
}
function categoryLabel(key) {
  if (!key) return "";
  const labels = {
    dating: "Dating & Relationships",
    psychology: "Psychology",
    tips: "Tips & Advice",
    story: "Sharing Stories",
    offtopic: "Casual Musings",
  };
  return labels[key] || String(key);
}
function formatPublishDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${t("discover.publishedOn")} ${y}-${m}-${day}`;
}
function previewImage(currentIndex) {
  if (!post.value?.images || post.value.images.length === 0) return;
  const urls = post.value.images.map((img) => normalizeMediaUrl(img)).filter(Boolean);
  uni.previewImage({
    current: urls[currentIndex] || urls[0],
    urls: urls,
  });
}
// ——— 点赞评论 ———
async function handleLike() {
  if (!post.value) return;
  try {
    const data = await apiFetch(
      `/api/posts/${post.value.id}/like`,
      { method: "POST", header: deviceHeaders() }
    );
    if (data?.ok && post.value) {
      post.value.liked = !!data.liked;
      post.value.likes_count = data.likes_count ?? post.value.likes_count;
    }
  } catch (e) {
    console.error("点赞失败:", e);
  }
}

async function handleSendComment() {
  const content = commentText.value.trim();
  if (!content || !post.value || sending.value) return;
  sending.value = true;
  try {
    const data = await apiFetch(`/api/posts/${post.value.id}/comment`, {
      method: "POST",
      header: {
        ...deviceHeaders(),
        "Content-Type": "application/json",
      },
      data: { content },
    });

    // 成功：清空输入（remount 强制同步 uni-input）+ 乐观追加
    commentText.value = "";
    commentInputKey.value += 1;
    inputFocus.value = false;

    if (data?.ok || data?.id != null) {
      const next = {
        id: data.id,
        user_id: getCurrentUserId(),
        user_name: data.user_name || "我",
        content: data.content || content,
        created_at: data.created_at || new Date().toISOString(),
      };
      const comments = [...(post.value.comments || []), next];
      post.value = {
        ...post.value,
        comments,
        comments_count: (post.value.comments_count || 0) + 1,
      };
      // 静默刷新对齐服务端
      void fetchPost({ silent: true });
    } else {
      await fetchPost({ silent: true });
    }
  } catch (e) {
    const err = e;
    if (err.status === 401) showToast(t("discover.loginExpired"));
    else console.error("评论失败:", e);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AppPageShell :title="t('discover.postDetail')" :show-back="true">
    <view class="detail-wrap">

        <AppListSkeleton v-if="loading && !post" :rows="3" />
        <view v-else-if="!post" class="center text-muted">{{ t("discover.postNotFound") }}</view>
        <template v-else>
			
          <view class="card block">
            <view class="flex-row items-center gap-sm">
              <AppAvatarImage :src="post.avatar" :seed="String(post.user_id || 'user')" size="sm" />
              <view class="min-w-0">
                <text class="author-name">{{ post.user_name }}</text>
              </view>
            </view>
          
            <image
              v-for="(img, idx) in post.images"
              :key="idx"
              class="post-img"
              :src="normalizeMediaUrl(img) || ''"
              mode="widthFix"
              @tap="previewImage(idx)"
            />
            <text class="post-title">{{ post.title }}</text>
            <text v-if="post.category" class="post-cat-tag">{{ categoryLabel(post.category) }}</text>
            <text class="post-content">{{ post.content }}</text>
            <text class="text-muted post-publish-time">{{ formatPublishDate(post.created_at) }}</text>
            <view class="actions">
              <view class="like-wrap" @tap="handleLike">
                                          <image
  class="like-icon"
  :src="post.liked 
    ? '/static/discover/ico-like-sel.svg' 
    : themeStore.isDark ?  '/static/discover/ico-like.svg':  '/static/discover/ico-like-white.svg'"
  mode="aspectFit"
/>

    
                <text class="like-count" :class="{ liked: post.liked }">{{ post.likes_count || 0 }}</text>
              </view>
            </view>
          </view>

          <view class="comments-section px-md">
            <text class="section-title">
              {{ t("discover.comments") }} ({{ post.comments_count || 0 }})
            </text>

            <view v-if="!(post.comments && post.comments.length)" class="empty-comments text-muted">
              {{ t("discover.noComments") }}
            </view>

                        <view
                          v-for="c in post.comments"
                          :key="c.id"
                          class="comment-card"
                        >
                          <AppAvatarImage
                            :src="c.avatar"
                            :seed="String(c.user_id || c.user_name || 'user')"
                            size="sm"
                          />
                          <view class="comment-main">
                            <text class="comment-name">{{ c.user_name }}</text>
                            <text class="comment-body">{{ c.content }}</text>
                            <text class="text-muted comment-time">{{ formatTime(c.created_at) }}</text>
                          </view>
                        </view>
          </view>
        </template>
		

     <view class="input-bar flex-row items-center gap-sm">
        <input
          :key="`post-cmt-${commentInputKey}`"
          class="input-field flex-1"
          :value="commentText"
          :placeholder="t('discover.commentPlaceholder')"
          :disabled="sending || !post"
          :focus="inputFocus"
          maxlength="500"
          confirm-type="send"
          @input="onCommentInput"
          @confirm="handleSendComment"
          @blur="inputFocus = false"
        />
        <view
          class="send-btn "
          :class="{ disabled: sending || !commentText.trim() || !post }"
          @tap="handleSendComment"
        >
          <image
            v-if="!sending"
            class="send-icon bg-btn"
            src="/static/discover/ico-Send.svg"
            mode="aspectFit"
          />
          <text v-else>…</text>
        </view>
      </view>
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.detail-wrap {
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}



.center {
  text-align: center;
  padding: 80rpx 0;
}

.block {
  margin: 24rpx 32rpx;
  padding: 24rpx;
}

.author-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--fg);
}

.author-time {
  display: block;
  font-size: 22rpx;
  margin-top: 4rpx;
}

.post-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  margin: 16rpx 0;
  color: var(--fg);
  word-break: break-word;
  white-space: normal;
}
.post-cat-tag {
  display: inline-block;
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  background: var(--bg-input);
  border-radius: 999px;
  color: var(--fg-muted);
  margin: 8rpx 0 16rpx;
}

.post-content {
  display: block;
  line-height: 1.6;
  white-space: pre-wrap;
  margin-bottom: 16rpx;
  color: var(--fg);
  font-size: 28rpx;
  word-break: break-word;
}
.post-publish-time {
  display: block;
  font-size: 22rpx;
  margin-top: 16rpx;
}
.post-img {
  width: 100%;
  border-radius: 16rpx;
  margin-bottom: 12rpx;
  margin-top: 20rpx;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24rpx;
}

.like-wrap {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8rpx;
}

.like-icon {
  width: 40rpx;
  height: 40rpx;
}

.like-count {
  font-size: 28rpx;
  color: var(--fg-muted);

  &.liked {
    color: #ff375f;
  }
}

.comments-section {
  padding-bottom: 32rpx;
}

.section-title {
  font-weight: 600;
  display: block;
  margin-bottom: 16rpx;
  color: var(--fg);
}

.empty-comments {
  text-align: center;
  padding: 48rpx 0;
  font-size: 26rpx;
}

.comment-card {
  background: var(--bg-input);
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}

.comment-main {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.comment-name {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--fg);
  margin-bottom: 8rpx;
}

.comment-time {
  font-size: 20rpx;
  margin-top: 8rpx;
  display: block;
}

.comment-body {
  display: block;
  font-size: 28rpx;
  color: var(--fg);
  word-break: break-word;
  line-height: 1.5;
}

.input-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
  background: var(--modal-bg);
}

.send-btn {
  width: 96rpx;
  height: 96rpx;
  border-radius: 16rpx;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.disabled {
    opacity: 0.3;
    pointer-events: none;
  }
}

.send-icon {
  width: 48rpx;
  height: 48rpx;
}

.flex-1 {
  flex: 1;
}

.min-w-0 {
  min-width: 0;
}
</style>
