/**
 * 日期时间工具：按设备本地时区格式化日期与时间。
 */

function asDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const n = Number(value)
  if (Number.isFinite(n) && String(value).trim() !== '') {
    // Treat numeric strings / numbers as epoch ms
    if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value).trim())) {
      const d = new Date(n < 1e12 ? n * 1000 : n)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function pad(n) {
  return String(n).padStart(2, '0')
}

/** 按设备时区格式化本地时间。 */
export function formatLocalTime(value, { withSeconds = false } = {}) {
  const d = asDate(value)
  if (!d) return ''
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = withSeconds
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${date} ${time}`
}

/** 按设备时区格式化本地日期。 */
export function formatLocalDate(value) {
  const d = asDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
