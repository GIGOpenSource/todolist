<script setup>
/**
 * 用户协议页：展示当前语言的服务条款。
 */
import { ref, computed } from 'vue'
import { onShow, onPageScroll } from '@dcloudio/uni-app'
import CollapsingNavBar from '../../components/CollapsingNavBar.vue'
import { syncPageChrome, themeClass } from '../../utils/theme.js'
import { t, localeVersion } from '../../utils/i18n.js'
import { termsSections } from '../../utils/legalContent.js'
import { resyncScrollEdges, onPageScrollEdge } from '../../utils/scrollEdgeBlur.js'
import {
  collapsingProgress,
  scrollTopFromEvent,
  readActiveScrollTop,
} from '../../utils/collapsingTitle.js'

const titleProgress = ref(0)
const pageThemeClass = computed(() => themeClass())
const doc = computed(() => {
  void localeVersion.value
  return termsSections()
})

onShow(() => {
  syncPageChrome()
  resyncScrollEdges()
  titleProgress.value = collapsingProgress(readActiveScrollTop())
})

onPageScroll((e) => {
  onPageScrollEdge(e)
  titleProgress.value = collapsingProgress(scrollTopFromEvent(e))
})

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}
</script>

<template>
  <view class="page ios-page legal-page" :class="pageThemeClass">
    <CollapsingNavBar
      :title="doc.title"
      :progress="titleProgress"
      show-back
      :back-label="t('common.back')"
      @back="goBack"
    />
    <view class="content ios-content has-collapse-nav">
      <text class="title">{{ doc.title }}</text>
      <text class="updated">{{ doc.updated }}</text>
      <view v-for="(p, i) in doc.paragraphs" :key="i" class="block">
        <text class="para">{{ p }}</text>
      </view>
      <view class="bottom-space" />
    </view>
  </view>
</template>

<style scoped>
.legal-page {
  min-height: 100vh;
  min-height: 100dvh;
}

.content {
  padding-left: var(--app-space-page);
  padding-right: var(--app-space-page);
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.title {
  display: block;
  font-size: var(--app-type-large-title);
  font-weight: 700;
  letter-spacing: -1.5px;
  color: var(--app-label);
  margin-bottom: 12rpx;
  line-height: 1.15;
}

.updated {
  display: block;
  font-size: 24rpx;
  color: var(--app-tertiary);
  margin-bottom: 28rpx;
}

.block {
  margin-bottom: 24rpx;
}

.para {
  display: block;
  font-size: 28rpx;
  line-height: 1.65;
  color: var(--app-secondary);
  white-space: pre-wrap;
}

.bottom-space {
  height: 48rpx;
}
</style>
