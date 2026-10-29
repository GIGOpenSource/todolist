<!-- PC 客户端根组件：挂载路由与全局壳。 -->
<script setup>
import { useToast } from './utils/toast.js'

const { visible, message } = useToast()
</script>

<template>
  <div class="ambient" aria-hidden="true" />
  <router-view />
  <div class="toast-host" aria-live="polite">
    <div v-if="visible" class="toast">{{ message }}</div>
  </div>
</template>
