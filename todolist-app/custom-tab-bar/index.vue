<script setup>
/**
 * 微信小程序 custom tabBar 入口；H5 上也会参与叠层。
 * App 端 pages.json 的 custom:true 不会自动隐藏原生 tabBar，
 * 实际导航统一由各 Tab 页内的 GlassTabBar + uni.hideTabBar 负责。
 * 这里留空占位即可。
 */
</script>

<template>
  <view class="custom-tabbar-placeholder"></view>
</template>

<style scoped>
.custom-tabbar-placeholder {
  display: none;
}
</style>
