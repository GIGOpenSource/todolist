<script setup>
/**
 * @file pages-sub/moment — 朋友圈动态详情
 * @description 单条 moment 详情、点赞、评论；带 x-device-id。
 * @depends apiFetch、deviceHeaders、useAuth
 */
import { ref, computed, onMounted, nextTick } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useI18n } from "vue-i18n";
import { useThemeStore } from "@/stores/theme";
import AppPageShell from "@/components/AppPageShell.vue";
import AppAvatarImage from "@/components/AppAvatarImage.vue";
import AppMomentImage from "@/components/AppMomentImage.vue";
import AppListSkeleton from "@/components/AppListSkeleton.vue";
import { requireAuth, getCurrentUserId } from "@/composables/useAuth";
import { deviceHeaders } from "@/utils/device";
import apiFetch from "@/utils/api";
import { useRelativeTime } from "@/composables/useRelativeTime";
import { showToast } from "@/stores/toast";
import { findAiRepliesToUser, recordLocalReplyNotif } from "@/utils/notifications";
import { formatCompanionName } from "@/utils/formatCompanion";
import { MOMENT_COMMENT_MAX_LENGTH } from "@/utils/constants";

let momentId = "";
const { t } = useI18n();
const { format: formatTime } = useRelativeTime("home");
const themeStore = useThemeStore();
const likeIcon = computed(() =>
  themeStore.isDark ? "/static/home/icon-like.svg" : "/static/home/icon-like-white.svg"
);
const commentIcon = computed(() =>
  themeStore.isDark ? "/static/home/icon-comment.svg" : "/static/home/icon-comment-white.svg"
);
requireAuth();

// ——— 状态 ———
const moment = ref(null);
const loading = ref(true);
const commentText = ref("");
const commentInputKey = ref(0);
const commentFocus = ref(false);
const sending = ref(false);
const replyTo = ref(null);
const scrollIntoView = ref("");

onLoad((q) => { momentId = String(q?.id || ""); });

function scrollBottom() {
  scrollIntoView.value = "";
  void nextTick(() => {
    scrollIntoView.value = "bottom-anchor";
  });
}

function captureReplyNotifs(prevReplyIds = new Set()) {
  const m = moment.value;
  if (!m) return;
  for (const c of findAiRepliesToUser(m.comments)) {
    if (prevReplyIds.has(String(c.id))) continue;
    recordLocalReplyNotif({
      replyId: c.id,
      momentId: m.id,
      title: c.companion_name || m.companion_name || t("home.defaultCompanionName"),
      content: c.content || "",
      avatar: m.companion_avatar || "",
      imageUrl: m.image_url || "",
      time: c.created_at,
      companionId: c.companion_id || m.companion_id,
    });
  }
}

// ——— 加载详情 ———
async function fetchMoment() {
  if (!moment.value) loading.value = true;
  try {
    moment.value = await apiFetch(`/api/moments/${momentId}`, { header: deviceHeaders() });
  } finally {
    loading.value = false;
  }
}

onMounted(fetchMoment);

// ——— 点赞评论 ———
async function handleLike() {
  if (!moment.value) return;
  const data = await apiFetch(
    `/api/moments/${moment.value.id}/like`,
    { method: "POST", header: deviceHeaders() }
  );
  if (data?.ok && moment.value) {
    moment.value.liked = !!data.liked;
    moment.value.likes_count = data.likes_count ?? moment.value.likes_count;
  }
}

function onCommentInput(e) {
  commentText.value = e?.detail?.value ?? "";
}

function focusCommentInput() {
  commentFocus.value = false;
  void nextTick(() => {
    commentFocus.value = true;
  });
}

function onCommentBlur() {
  commentFocus.value = false;
}

function openPreview(url) {
  if (!url) return;
  const normalized = url.trim();
  uni.previewImage({
    urls: [normalized],
    fail: (err) => {
      console.warn("[moment] previewImage fail:", err);
      // #ifdef APP-PLUS
      plus.runtime.openURL(normalized);
      // #endif
      // #ifdef H5
      window.open(normalized, "_blank");
      // #endif
    },
  });
}

function breakableText(text, max = 20) {
  if (!text) return "";
  return String(text).replace(new RegExp(`[^\\s]{${max}}`, "g"), (m) => m + "\u200B");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** AI 后台生成完成后刷新详情评论 */
async function pollAiReply(afterCount) {
  const prevReplyIds = new Set(
    findAiRepliesToUser(moment.value?.comments).map((c) => String(c.id))
  );
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    try {
      await fetchMoment();
      const count = moment.value?.comments?.length || 0;
      if (count > afterCount) {
        captureReplyNotifs(prevReplyIds);
        void nextTick(() => { scrollBottom(); });
        return;
      }
    } catch (e) {
      console.warn("轮询 AI 回复失败:", e);
    }
  }
}

async function handleSendComment(e) {
  const fromEvent = typeof e?.detail?.value === "string" ? e.detail.value : null;
  const content = (fromEvent ?? commentText.value).trim();
  if (!content || !moment.value || sending.value) return;
  sending.value = true;

  const curReplyTo = replyTo.value;
  const tempId = `temp-${Date.now()}`;
  const optimistic = {
    id: tempId,
    content,
    companion_name: t("common.me"),
    created_at: new Date().toISOString(),
    is_me: true,
    _optimistic: true,
  };
  if (curReplyTo) {
    optimistic.parent_id = curReplyTo.id;
    optimistic.reply_to_name = isMe(curReplyTo)
      ? t("common.me")
      : (curReplyTo.companion_name || t("home.defaultCompanionName"));
  }

  // 乐观插入，同时清空输入框
  const comments = moment.value.comments || [];
  moment.value.comments = [...comments, optimistic];
  moment.value.comments_count = (moment.value.comments_count || 0) + 1;

  commentText.value = "";
  commentInputKey.value += 1;
  commentFocus.value = false;
  replyTo.value = null;

  void nextTick(() => { scrollBottom(); });

  // 保存当前回复信息，失败时需要恢复
  const savedReplyTo = curReplyTo;

  const prevCount = comments.length;
  try {
    const body = { content };
    if (curReplyTo) body.parent_id = curReplyTo.id;
    const data = await apiFetch(`/api/moments/${moment.value.id}/comment`, {
      method: "POST",
      header: {
        ...deviceHeaders(),
        "Content-Type": "application/json",
      },
      data: body,
      timeout: 20000,
    });
    if (data?.ok === false || data?.error) {
      moment.value.comments = moment.value.comments.filter((c) => c.id !== tempId);
      moment.value.comments_count = Math.max(0, (moment.value.comments_count || 0) - 1);
      commentText.value = content;
      replyTo.value = savedReplyTo;
      showToast("发送失败");
      return;
    }
    await fetchMoment();
    void nextTick(() => { scrollBottom(); });
    if (data?.ai_reply) {
      captureReplyNotifs(new Set());
    } else {
      void pollAiReply(prevCount + 1);
    }
  } catch (err) {
    moment.value.comments = moment.value.comments.filter((c) => c.id !== tempId);
    moment.value.comments_count = Math.max(0, (moment.value.comments_count || 0) - 1);
    commentText.value = content;
    replyTo.value = savedReplyTo;
    showToast("发送失败");
    console.error("评论失败:", err);
    const msg = String(err?.errMsg || err?.message || err || "");
    if (/timeout|超时|timed?\s*out/i.test(msg)) {
      void pollAiReply(prevCount);
    }
  } finally {
    sending.value = false;
  }
}

function isMe(comment) {
  if (!comment) return false;
  // 优先用接口返回的 is_me 字段
  if (comment.is_me === true) return true;
  // 兼容未返回 is_me 的情况，回退 user_id 比对
  const uid = getCurrentUserId();
  const userId = comment.user_id;
  return userId != null && uid != null && String(userId) === String(uid);
}

function setReplyTo(comment) {
  console.log("[moment] 长按回复人信息:", JSON.stringify(comment, null, 2), comment);
  replyTo.value = comment;
  focusCommentInput();
}

let longPressTimer = null;
let touchStartY = 0;

function onCommentTouchStart(comment, e) {
  const y = e?.touches?.[0]?.clientY ?? e?.changedTouches?.[0]?.clientY ?? 0;
  touchStartY = y;
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    setReplyTo(comment);
  }, 600);
}

function onCommentTouchMove(e) {
  if (!longPressTimer) return;
  const y = e?.touches?.[0]?.clientY ?? e?.changedTouches?.[0]?.clientY ?? 0;
  if (Math.abs(y - touchStartY) > 10) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onCommentTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

// App 端 vue-i18n 不编译 {name} 占位符，手动替换兜底
const replyToName = computed(() => {
  if (!replyTo.value) return "";
  return isMe(replyTo.value)
    ? t("common.me")
    : formatCompanionName(replyTo.value.companion_name, t("home.defaultCompanionName"));
});
const replyToLabel = computed(() =>
  replyTo.value ? t("home.replyTo", { name: replyToName.value }).replace(/{name}/g, replyToName.value) : ""
);
const replyPlaceholderText = computed(() =>
  replyTo.value ? t("home.replyPlaceholder", { name: replyToName.value }).replace(/{name}/g, replyToName.value) : ""
);
</script>

<template>
  <AppPageShell title="朋友圈详情" :show-back="true">
    <view class="detail-wrap">
      <scroll-view scroll-y class="scroll-area" :scroll-into-view="scrollIntoView">
        <AppListSkeleton v-if="loading && !moment" :rows="3" />
        <view v-else-if="!moment" class="center text-muted">朋友圈不存在</view>
        <template v-else>
        <view class="card block">
          <view class="flex-row items-center gap-sm">
            <AppAvatarImage :src="moment.companion_avatar" :seed="moment.companion_id" size="sm" />
            <view>
              <text>{{ formatCompanionName(moment.companion_name, t("home.defaultCompanionName")) }}</text>
              <text class="text-muted" style="display: block; font-size: 22rpx">{{ formatTime(moment.created_at) }}</text>
            </view>
          </view>
          <text class="caption">{{ moment.caption }}</text>
          <view v-if="moment.image_generating" class="generating">图片生成中...</view>
          <AppMomentImage
            v-else-if="moment.image_url"
            :src="moment.image_url"
            :prefer-thumb="false"
            img-class="hero-img"
            @click="openPreview(moment.image_url)"
          />
          <view class="actions flex-row items-end justify-end mt-md">
            <view class="action-btn flex-row items-end" @tap="handleLike">
              <image
                :src="moment.liked ? '/static/home/icon-like-active.svg' : likeIcon"
                class="action-img"
                mode="aspectFit"
              />
              <text class="action-count">{{ moment.likes_count }}</text>
            </view>
            <view class="action-btn flex-row items-end" @tap="focusCommentInput">
              <image :src="commentIcon" class="action-img" mode="aspectFit" />
              <text class="action-count">{{ moment.comments_count }}</text>
            </view>
          </view>
        </view>

        <view class="px-md py-sm">
          <text class="section-title">评论 ({{ moment.comments_count || 0 }})</text>
          <view
            v-for="c in moment.comments"
            :key="c.id"
            class="comment-row"
            @touchstart="onCommentTouchStart(c, $event)"
            @touchmove="onCommentTouchMove($event)"
            @touchend="onCommentTouchEnd"
            @touchcancel="onCommentTouchEnd"
          >
            <view class="comment-avatar">{{ (c.companion_name || "?").charAt(0) }}</view>
            <view class="flex-1">
              <view class="comment-bubble">
                <text class="comment-name" :class="{ me: isMe(c) }">{{
                  isMe(c)
                    ? t("common.me")
                    : formatCompanionName(c.companion_name, t("home.defaultCompanionName"))
                }}</text>
                <view class="comment-content">
                  <text v-if="c.reply_to_name" :class="c.is_reply_me ? 'reply-to-me' : 'reply-to'">@{{ c.reply_to_name }} </text>
                  {{ breakableText(c.content) }}
                </view>
              </view>
              <text class="text-muted" style="font-size: 20rpx; margin-top: 8rpx">{{ formatTime(c.created_at) }}</text>
            </view>
          </view>
        </view>
        <view id="bottom-anchor" style="height: 1rpx"></view>
        </template>
      </scroll-view>

      <view class="input-bar">
        <view v-if="replyTo" class="reply-hint flex-row justify-between">
          <text class="text-muted">{{ replyToLabel }}</text>
          <text @tap="replyTo = null">{{ t("common.cancel") }}</text>
        </view>
        <view class="flex-row gap-sm">
          <input
            :key="`moment-cmt-${commentInputKey}`"
            :value="commentText"
            class="input-field chat-input flex-1"
            :placeholder="replyTo ? replyPlaceholderText : t('home.writeComment')"
            :maxlength="MOMENT_COMMENT_MAX_LENGTH"
            confirm-type="send"
            :focus="commentFocus"
            :disabled="sending"
            @input="onCommentInput"
            @confirm="handleSendComment"
            @blur="onCommentBlur"
          />
          <button class="send-btn" :class="{ busy: sending }" :disabled="sending || !commentText.trim() || !moment" @tap="handleSendComment">
            <text v-if="sending" class="send-spinner"></text>
            <image v-else src="/static/meaasge/send.svg" class="send-img" mode="aspectFit" />
          </button>
        </view>
      </view>
    </view>

  </AppPageShell>
</template>

<style scoped lang="scss">
.center { text-align: center; padding: 80rpx 0; }
.detail-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.scroll-area { flex: 1; min-height: 0; }
.block { margin: 24rpx 32rpx; padding: 24rpx; }
.caption { display: block; margin: 16rpx 0; line-height: 1.6; word-break: break-all; overflow-wrap: break-word; }
.generating { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: var(--bg-input); border-radius: 16rpx; color: var(--fg-muted); }
.hero-img { width: 100%; border-radius: 16rpx; }
.actions { gap: 32rpx; margin: 4rpx 0 12rpx; justify-content: flex-end; }
.action-btn {
  display: flex;
  align-items: flex-end;
  gap: 6rpx;
}
.action-img {
  display: block;
  width: 42rpx;
  height: 42rpx;
}
.action-count { font-size: 20rpx; color: var(--fg-muted); line-height: 1; }
.section-title { font-weight: 600; margin-bottom: 16rpx; display: block; }
.comment-row { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.comment-avatar {
  width: 64rpx; height: 64rpx; border-radius: 50%; background: var(--bg-input);
  display: flex; align-items: center; justify-content: center; font-size: 24rpx; flex-shrink: 0;
}
.comment-bubble { background: var(--bg-input); border-radius: 16rpx; padding: 16rpx 20rpx; word-break: break-all; overflow-wrap: break-word; }
.comment-bubble text { word-break: break-all; }
.comment-name { display: block; font-size: 22rpx; margin-bottom: 4rpx; &.me { font-weight: bold; } }
.comment-content {
  word-break: break-all;
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-break: anywhere;
  display: block;
  width: 100%;
}
.reply-to {
  color: #3291f6;
  font-weight: 500;
  margin-right: 4rpx;
}
.reply-to-me {
  color: #3291f6;
  font-weight: bold;
  margin-right: 4rpx;
}
.reply-hint {
  padding: 8rpx 0;
  margin-bottom: 8rpx;
}
.input-bar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 0;
  padding: 20rpx 24rpx;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}
.input-bar .flex-row {
  align-items: center;
  gap: 16rpx;
}
.input-field {
  flex: 1;
  border-radius: 999px;
  background: var(--bg-btn);
  border: none;
  min-height: 72rpx;
  height: 72rpx;
  padding: 0 24rpx;
  color: var(--fg);
  line-height: 72rpx;
}
.send-btn {
  width: 80rpx; height: 80rpx; border-radius: 50%; padding: 0; margin: 0;
  background: var(--bg-btn) !important; color: #fff; font-size: 28rpx;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border: none;
  &.busy { opacity: 0.7; pointer-events: none; }
  image { width: 65%; height: 70%; }
}
.send-spinner {
  display: inline-block;
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid var(--border);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: send-spin 0.6s linear infinite;
}
@keyframes send-spin {
  to { transform: rotate(360deg); }
}
.flex-1 { flex: 1; }
</style>
