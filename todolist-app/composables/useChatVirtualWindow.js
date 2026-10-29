/**
 * @file useChatVirtualWindow.js
 * @description 聊天列表简易虚拟窗口：消息很多时只渲染可视区 + overscan。
 * uni-app 的 scroll-view + 估算高度 padding 容易把布局高度撑乱，
 * 默认阈值抬高，优先保证布局正确。
 */
import { computed } from "vue";

const ROW_EST_HEIGHT = 88;
const OVERSCAN = 12;
/** uni 端估算高度不准，阈值提高，避免消息增多后出现大片空白/跳动 */
const VIRTUAL_THRESHOLD = 400;

/**
 * @param {import('vue').Ref|import('vue').ComputedRef} rows 行数组 ref
 * @param {import('vue').Ref<number>} scrollTop
 * @param {import('vue').Ref<number>} viewHeight
 */
export function useChatVirtualWindow(rows, scrollTop, viewHeight) {
  const enabled = computed(() => rows.value.length > VIRTUAL_THRESHOLD);

  const range = computed(() => {
    if (!enabled.value) {
      return { start: 0, end: rows.value.length };
    }
    const top = scrollTop.value;
    const h = viewHeight.value || 600;
    const start = Math.max(0, Math.floor(top / ROW_EST_HEIGHT) - OVERSCAN);
    const end = Math.min(
      rows.value.length,
      Math.ceil((top + h) / ROW_EST_HEIGHT) + OVERSCAN
    );
    return { start, end };
  });

  const slice = computed(() =>
    enabled.value
      ? rows.value.slice(range.value.start, range.value.end)
      : rows.value
  );

  const topPad = computed(() =>
    enabled.value ? range.value.start * ROW_EST_HEIGHT : 0
  );

  const bottomPad = computed(() =>
    enabled.value
      ? (rows.value.length - range.value.end) * ROW_EST_HEIGHT
      : 0
  );

  return {
    enabled,
    slice,
    topPad,
    bottomPad,
    rangeStart: computed(() => range.value.start),
  };
}
