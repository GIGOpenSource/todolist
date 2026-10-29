<script setup>
/**
 * @file pages-sub/feedback — 用户反馈会话
 * @description 拉取/发送反馈消息列表；需登录。
 * @depends apiFetch、useAuth
 */
import { ref, onMounted, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import AppListSkeleton from "@/components/AppListSkeleton.vue";
import { requireAuth, isLoggedIn } from "@/composables/useAuth";
import apiFetch from "@/utils/api";
import { showToast } from "@/stores/toast";
import { bindAnalyticsTap } from "@/utils/analytics";

const { t } = useI18n();
requireAuth();

// ——— 状态 ———
const messages = ref([]);
const input = ref("");
const isSending = ref(false);
const loading = ref(true);
const scrollInto = ref("");

/** 拉取反馈历史并滚到底 */
async function loadMessages() {
  try {
    const data = await apiFetch("/api/feedback/messages");
    messages.value = data.messages || [];
    await nextTick();
    scrollInto.value = "fb-bottom";
  } catch (e) {
    const err = e;
    if (err.status === 401) {
      showToast(t("feedback.loginExpired"));
      uni.reLaunch({ url: "/pages/login/login" });
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!isLoggedIn()) {
    showToast(t("feedback.loginRequired"));
    uni.reLaunch({ url: "/pages/login/login" });
    return;
  }
  loadMessages();
});

// ——— 发送 ———
function formatTime(iso) {
  if (!iso) return "";
  let normalized = iso.trim();
  if (!normalized.endsWith("Z") && !normalized.match(/[+-]\d{2}:\d{2}$/)) normalized += "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function handleSend() {
  if (!input.value.trim() || isSending.value) return;
  const text = input.value.trim();
  isSending.value = true;
  input.value = "";
  const optimistic = { id: Date.now(), sender: "user", content: text, created_at: new Date().toISOString() };
  messages.value.push(optimistic);
  try {
    const data = await apiFetch("/api/feedback/messages", {
      method: "POST",
      data: { content: text },
    });
    if (data.messages?.length) {
      const ids = new Set(messages.value.map((m) => m.id));
      messages.value = [
        ...messages.value.filter((m) => m.id !== optimistic.id),
        ...data.messages.filter((m) => !ids.has(m.id)),
      ];
    } else {
      await loadMessages();
    }
  } catch {
    messages.value = messages.value.filter((m) => m.id !== optimistic.id);
    showToast(t("feedback.sendFailed"));
  } finally {
    isSending.value = false;
    scrollInto.value = "fb-bottom";
  }
}
</script>

<template>
  <AppPageShell
    :title="t('feedback.title')"
    :show-back="true"
    back-analytics-id="feedback-back"
    back-analytics-name="反馈页返回"
  >
    <view class="chat-wrap">
      <scroll-view scroll-y class="scroll" :scroll-into-view="scrollInto">
        <AppListSkeleton v-if="loading && !messages.length" :rows="4" :avatar="false" />
        <view v-else-if="!messages.length" class="center text-muted">{{ t("feedback.noMessages") }}</view>
        <view v-for="m in messages" :key="m.id" :id="'fb-' + m.id" class="msg" :class="{ user: m.sender === 'user' }">
          <view :class="m.sender === 'user' ? 'bubble-user' : 'bubble-ai'">
            <text>{{ m.content }}</text>
            <text class="time">{{ formatTime(m.created_at) }}</text>
          </view>
        </view>
        <view id="fb-bottom" />
      </scroll-view>
      <view class="input-bar flex-row gap-sm">
        <input v-model="input" class="input-field flex-1" :placeholder="t('feedback.placeholder')" @confirm="handleSend" />
        <button class="send-btn" :disabled="!input.trim() || isSending" @tap="bindAnalyticsTap('feedback-send', handleSend, '发送反馈')">➤</button>
      </view>
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.chat-wrap { display: flex; flex-direction: column; height: calc(100vh - 120rpx); }
.scroll { flex: 1; padding: 24rpx 32rpx; box-sizing: border-box; }
.center { text-align: center; padding: 80rpx 0; }
.msg { display: flex; margin-bottom: 20rpx; &.user {
  display: flex; justify-content: flex-end; } }
.bubble-user {
  background: var(--gradient-brand); color: #fff;
  border-radius: 24rpx; padding: 20rpx 28rpx; max-width: 75%;
}
.bubble-ai { background: var(--bg-input); border-radius: 24rpx; padding: 20rpx 28rpx; max-width: 75%; }
.time { display: block; font-size: 20rpx; opacity: 0.7; margin-top: 8rpx; }
.input-bar { padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--bg-card); }
.send-btn { width: 72rpx; height: 72rpx; border-radius: 50%; background: var(--brand); color: #fff; padding: 0; }
.flex-1 { flex: 1; }
</style>
