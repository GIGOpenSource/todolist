<script setup>
/**
 * @file pages-sub/intimacy — 亲密度记录
 * @description 列出我的伴侣及亲密度等级展示。
 * @depends companionsCache、formatAffection
 */
import { ref, onMounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import AppAvatarImage from "@/components/AppAvatarImage.vue";
import AppListSkeleton from "@/components/AppListSkeleton.vue";
import { requireAuth } from "@/composables/useAuth";
import { fetchCompanions, getCachedCompanions } from "@/utils/companionsCache";
import { formatAffectionDisplay } from "@/utils/formatAffection";

const { t } = useI18n();
requireAuth();

// ——— 状态 ———
function mapIntimacyCompanion(c) {
  const profile = c.profile || {};
  const state = c.state || {};
  return {
    id: profile.id || "",
    name: profile.name || "",
    avatar: c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`,
    gender: profile.gender || "",
    affection: state.affection || 0,
    turns: state.turns || 0,
    mbti: profile.mbti || "",
  };
}

function mapIntimacyCompanions(data) {
  return (data || [])
    .map(mapIntimacyCompanion)
    .sort((a, b) => b.affection - a.affection);
}

const companions = ref([]);
const loading = ref(true);

// ——— 加载 ———
async function loadIntimacy(silent = false) {
  if (!silent) loading.value = true;
  try {
    
    const data = await fetchCompanions({ is_create:'none',intimacy_value:0.001 }, { force: true });
    companions.value = mapIntimacyCompanions(data);
  } finally {
    loading.value = false;
  }
}

onMounted(() => loadIntimacy(false));
onShow(() => {
  loadIntimacy(false);
});

// ——— 等级 ———
const avgAffection = () =>
  companions.value.length
    ? companions.value.reduce((s, c) => s + c.affection, 0) / companions.value.length
    : 0;

function affectionInfo(a) {
  if (a >= 80) return { label: t("myCompanions.soulmate"), color: "pink" };
  if (a >= 50) return { label: t("myCompanions.close"), color: "purple" };
  if (a >= 20) return { label: t("myCompanions.familiar"), color: "blue" };
  return { label: t("myCompanions.stranger"), color: "muted" };
}
</script>

<template>
  <AppPageShell :title="t('profile.intimacyRecord')" :show-back="true">
    <view class="px-md py-sm">
      <view class="stats-row flex-row">
        <view class="stat card"><text class="num">{{ formatAffectionDisplay(avgAffection()) }}</text><text class="text-muted">{{ t("intimacy.avgAffection") }}</text></view>
        <view class="stat card"><text class="num">{{ formatAffectionDisplay(companions[0]?.affection ?? 0) }}</text><text class="text-muted">{{ t("intimacy.highest") }}</text></view>
        <view class="stat card"><text class="num">{{ companions.reduce((s, c) => s + c.turns, 0) }}</text><text class="text-muted">{{ t("profile.chatTurns") }}</text></view>
      </view>

      <AppListSkeleton v-if="loading && !companions.length" />
      <template v-else>
        <view v-if="companions[0]" class="card highlight mt-md flex-row items-center gap-sm">
          <AppAvatarImage :src="companions[0].avatar" :seed="companions[0].id" />
          <view>
            <text class="name">{{ companions[0].name }}</text>
            <text class="text-muted">{{ t("intimacy.topCompanion") }}</text>
            <text class="text-primary">♥ {{ formatAffectionDisplay(companions[0].affection) }}</text>
          </view>
        </view>

        <view v-if="!companions.length" class="center text-muted py-lg">{{ t("common.noData") }}</view>
        <template v-else>
          <view
            v-for="(c, idx) in companions"
            :key="c.id"
            class="card row mt-md"
            @tap="uni.navigateTo({ url: `/pages/chat/index?id=${c.id}` })"
          >
            <AppAvatarImage :src="c.avatar" :seed="c.id" size="sm" />
            <view class="flex-1">
              <text class="name">{{ idx + 1 }}. {{ c.name }}</text>
              <text class="text-muted">{{ affectionInfo(c.affection).label }} · {{ c.turns }} {{ t("profile.chatTurns") }}</text>
              <view class="progress"><view class="bar" :style="{ width: Math.min(c.affection, 100) + '%' }" /></view>
            </view>
            <text class="score">{{ formatAffectionDisplay(c.affection) }}</text>
          </view>
        </template>
      </template>
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.center { text-align: center; padding: 80rpx 0; }
.stats-row { gap: 16rpx; }
.stat { flex: 1; padding: 24rpx; text-align: center; }
.num { display: block; font-size: 36rpx; font-weight: 600; }
.highlight { padding: 24rpx; background: rgba(236, 72, 153, 0.08); border-color: rgba(236, 72, 153, 0.2); }
.row { display: flex; gap: 16rpx; padding: 24rpx; align-items: center; }
.name { display: block; font-weight: 600; }
.progress { height: 8rpx; background: var(--bg-input); border-radius: 999px; margin-top: 12rpx; overflow: hidden; }
.bar { height: 100%; background: var(--brand); border-radius: 999px; }
.score { color: var(--brand); font-weight: 600; }
.flex-1 { flex: 1; }
.py-lg { padding: 80rpx 0; }
.px-md{
  height: 100vh;
  overflow-y: scroll;
}
</style>

