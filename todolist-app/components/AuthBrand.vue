<script setup>
import { BRAND_LOGO } from '../utils/brand.js'

defineProps({
  title: { type: String, default: '' },
  /** Hero tagline under the brand name */
  slogan: { type: String, default: '' },
  /** Quieter supporting line */
  hint: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <view class="auth-brand" :class="{ compact }">
    <view class="logo-wrap">
      <image class="logo" :src="BRAND_LOGO" mode="aspectFit" />
    </view>
    <text v-if="title" class="brand">{{ title }}</text>
    <text v-if="slogan" class="slogan">{{ slogan }}</text>
    <text v-if="hint" class="hint">{{ hint }}</text>
  </view>
</template>

<style scoped>
.brand {
  display: block;
  font-family: "Manrope", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
    "Noto Sans SC", sans-serif;
  font-size: clamp(36px, 9vw, 48px);
  font-weight: 700;
  letter-spacing: -2px;
  color: var(--app-label);
  line-height: 1;
}

.compact .brand {
  font-size: clamp(28px, 7vw, 34px);
  letter-spacing: -1.4px;
}

.slogan {
  display: block;
  margin-top: 16px;
  max-width: 28em;
  font-family: "Manrope", "PingFang SC", "Hiragino Sans GB", sans-serif;
  font-size: clamp(17px, 4.2vw, 20px);
  font-weight: 600;
  letter-spacing: -0.4px;
  line-height: 1.35;
  color: var(--app-label);
  opacity: 0.88;
}

.compact .slogan {
  margin-top: 10px;
  font-size: 16px;
  font-weight: 500;
}

.logo-wrap {
  width: clamp(72px, 18vw, 96px);
  height: clamp(72px, 18vw, 96px);
  border-radius: 22px;
  overflow: hidden;
  margin-bottom: 24px;
  box-shadow: 0 18px 44px var(--app-tint-glow);
  animation: logo-float 5.5s ease-in-out infinite;
}

.compact .logo-wrap {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  margin-bottom: 14px;
  animation: none;
}

.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 28px;
  padding: 0 8px;
  animation: brand-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.auth-brand.compact {
  margin-bottom: 20px;
  animation-duration: 0.45s;
}

.logo {
  width: 100%;
  height: 100%;
  display: block;
}

.hint {
  display: block;
  margin-top: 12px;
  max-width: 28em;
  font-size: 14px;
  line-height: 1.45;
  color: var(--app-secondary);
}

.compact .hint {
  margin-top: 8px;
  font-size: 13px;
}

@keyframes brand-in {
  from {
    opacity: 0;
    transform: translateY(18rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes logo-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6rpx);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-brand,
  .logo-wrap {
    animation: none;
  }
}
</style>
