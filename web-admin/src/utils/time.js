/**
 * 后台时间工具：统一格式化北京时间。
 */

const BEIJING = 'Asia/Shanghai'

function asDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const n = Number(value)
  if (Number.isFinite(n) && n > 0) {
    const d = new Date(n)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 按北京时间格式化时间。 */
export function formatBeijingTime(value, { withSeconds = true } = {}) {
  const d = asDate(value)
  if (!d) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  }).formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value || ''
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const time = withSeconds
    ? `${get('hour')}:${get('minute')}:${get('second')}`
    : `${get('hour')}:${get('minute')}`
  return `${date} ${time}`
}

/** 格式化北京时间标签。 */
export function formatBeijingTimeLabel(value) {
  const s = formatBeijingTime(value)
  return s ? `${s} (北京时间)` : ''
}
