<template>
  <view
    class="poster-capture"
    :job="job"
    :change:job="posterBridge.capture"
  />
</template>

<script>
/**
 * App 视图层海报渲染：逻辑层没有 DOM，html2canvas 必须跑在 renderjs。
 */
export default {
  name: 'PosterCapture',
  props: {
    job: { type: String, default: '' },
  },
  emits: ['done'],
  methods: {
    onPosterDone(payload) {
      this.$emit('done', payload)
    },
  },
}
</script>

<script module="posterBridge" lang="renderjs">
import { renderHighlightPoster } from '../utils/reportPoster.js'

export default {
  methods: {
    async capture(newValue, oldValue, ownerInstance) {
      if (!newValue || newValue === oldValue) return
      let job = newValue
      if (typeof newValue === 'string') {
        try {
          job = JSON.parse(newValue)
        } catch {
          return
        }
      }
      if (!job || !job.id || !job.data) return
      try {
        const dataUrl = await renderHighlightPoster(job.data, {
          logoSrc: job.logoSrc,
        })
        ownerInstance.callMethod('onPosterDone', {
          ok: true,
          dataUrl,
          id: job.id,
        })
      } catch (e) {
        ownerInstance.callMethod('onPosterDone', {
          ok: false,
          message: (e && e.message) || '',
          id: job.id,
        })
      }
    },
  },
}
</script>

<style scoped>
.poster-capture {
  position: fixed;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
}
</style>
